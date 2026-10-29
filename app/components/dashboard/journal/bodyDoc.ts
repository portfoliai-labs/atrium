// components/dashboard/journal/bodyDoc.ts
//
// An article's body between acta's blocks and the editor's document (TipTap's JSON): paragraphs
// with bold, italic, struck through and highlighted text, links and instruments tagged with "#", headings 2 and 3, one-level lists,
// quotes with an attribution, images, tables. Nothing else exists in the editor (see BodyEditor),
// so every document maps whole. A tag is kept as its text ("#VWCE") in acta's spans; read back,
// the text of a ticker among the article's instruments is a tag again.

import type { JSONContent } from "@tiptap/core";
import type { ArticleInstrument, Block, Span } from "../../../models/Journal";
import { splitTags, tagPattern } from "../../../lib/journal";

// The editor's own nodes for an article's image and a tagged instrument (see BodyEditor).
export const IMAGE_NODE = "articleImage";
export const TAG_NODE = "instrumentTag";

type Mark = NonNullable<JSONContent["marks"]>[number];

/** A tag's attributes: the instrument, as the article names it. */
export const tagAttrs = (i: ArticleInstrument) => ({
  listingId: i.listingId ?? null, instrumentId: i.instrumentId ?? null, ticker: i.ticker, name: i.name ?? null, isin: i.isin,
});

function spansToContent(spans: Span[], instruments: ArticleInstrument[]): JSONContent[] {
  const pattern = tagPattern(instruments);
  return spans
    .filter((s) => s.text)
    .flatMap((s) => {
      const marks: Mark[] = [];
      if (s.bold) marks.push({ type: "bold" });
      if (s.italic) marks.push({ type: "italic" });
      if (s.strike) marks.push({ type: "strike" });
      if (s.highlight) marks.push({ type: "highlight" });
      if (s.linkUrl) marks.push({ type: "link", attrs: { href: s.linkUrl } });
      const withMarks = marks.length ? { marks } : {};
      return splitTags(s.text, pattern).map((part): JSONContent => {
        if ("text" in part) return { type: "text", text: part.text, ...withMarks };
        const instrument = instruments.find((i) => i.ticker === part.ticker)!;
        return { type: TAG_NODE, attrs: tagAttrs(instrument), ...withMarks };
      });
    });
}

export function blocksToDoc(blocks: Block[], instruments: ArticleInstrument[] = []): JSONContent {
  const paragraph = (spans: Span[]): JSONContent => ({ type: "paragraph", content: spansToContent(spans, instruments) });
  const content = blocks.map((b): JSONContent => {
    switch (b.type) {
      case "paragraph":
        return paragraph(b.spans);
      case "heading":
        return { type: "heading", attrs: { level: b.level ?? 2 }, content: b.text ? [{ type: "text", text: b.text }] : [] };
      case "list":
        return {
          type: b.style === "numbered" ? "orderedList" : "bulletList",
          content: b.items.map((item) => ({ type: "listItem", content: [paragraph(item.spans)] })),
        };
      case "quote":
        return { type: "blockquote", attrs: { attribution: b.attribution ?? "" }, content: [paragraph(b.spans)] };
      case "image":
        return {
          type: IMAGE_NODE,
          attrs: { imageUuid: b.imageUuid, altText: b.altText ?? "", caption: b.caption ?? "", src: b.file?.url ?? null },
        };
      case "table":
        return {
          type: "table",
          attrs: { caption: b.caption ?? "" },
          content: b.rows.map((row, r) => ({
            type: "tableRow",
            content: row.cells.map((cell) => ({ type: b.headerRow && r === 0 ? "tableHeader" : "tableCell", content: [paragraph(cell.spans)] })),
          })),
        };
    }
  });
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

/** A node's text as spans, a tag as its text, adjacent runs with the same marks joined; never a line break. */
function contentToSpans(content: JSONContent[] | undefined): Span[] {
  const spans: Span[] = [];
  for (const node of content ?? []) {
    const text = node.type === "text" ? node.text : node.type === TAG_NODE ? `#${node.attrs?.ticker ?? ""}` : null;
    if (!text) continue;
    const marks = node.marks ?? [];
    const span: Span = {
      text: text.replace(/[\r\n]+/g, " "),
      bold: marks.some((m) => m.type === "bold"),
      italic: marks.some((m) => m.type === "italic"),
      linkUrl: (marks.find((m) => m.type === "link")?.attrs?.href as string | undefined) ?? null,
      strike: marks.some((m) => m.type === "strike"),
      highlight: marks.some((m) => m.type === "highlight"),
    };
    const last = spans[spans.length - 1];
    const sameMarks = last && last.bold === span.bold && last.italic === span.italic && last.linkUrl === span.linkUrl
      && last.strike === span.strike && last.highlight === span.highlight;
    if (sameMarks) last.text += span.text;
    else spans.push(span);
  }
  return spans;
}

const textOf = (content: JSONContent[] | undefined) => (content ?? []).map((n) => n.text ?? "").join("").replace(/[\r\n]+/g, " ");

/**
 * A table's rows, as wide as the widest: a merged cell (pasted from elsewhere) is itself and empty
 * cells after it, a short row ends in empty ones. `headerRow` when its first row is all headings.
 */
function tableOf(node: JSONContent): Extract<Block, { type: "table" }> | null {
  const rows = (node.content ?? []).map((row) => (row.content ?? []).flatMap((cell) => {
    const spans = contentToSpans(cell.content?.[0]?.content);
    const span = Math.max(1, Number(cell.attrs?.colspan ?? 1));
    return [{ spans }, ...Array.from({ length: span - 1 }, () => ({ spans: [] as Span[] }))];
  }));
  if (!rows.some((row) => row.some((cell) => cell.spans.length))) return null;
  const width = Math.max(...rows.map((row) => row.length));
  const caption = String(node.attrs?.caption ?? "").trim();
  return {
    type: "table",
    rows: rows.map((cells) => ({ cells: [...cells, ...Array.from({ length: width - cells.length }, () => ({ spans: [] as Span[] }))] })),
    headerRow: !!node.content?.[0]?.content?.length && node.content[0].content.every((cell) => cell.type === "tableHeader"),
    caption: caption || null,
  };
}

/**
 * The document as blocks, empty paragraphs, headings, items, quotes and tables left out, and the
 * instruments its tags name (docInstruments). `nodeIndex[i]` is the document's top-level node
 * block `i` came from: where to point when acta names a block.
 */
export function docToBlocks(doc: JSONContent): { blocks: Block[]; nodeIndex: number[]; instruments: ArticleInstrument[] } {
  const blocks: Block[] = [];
  const nodeIndex: number[] = [];
  const push = (block: Block, index: number) => {
    blocks.push(block);
    nodeIndex.push(index);
  };
  (doc.content ?? []).forEach((node, index) => {
    switch (node.type) {
      case "paragraph": {
        const spans = contentToSpans(node.content);
        if (spans.length) push({ type: "paragraph", spans }, index);
        break;
      }
      case "heading": {
        const text = textOf(node.content).trim();
        if (text) push({ type: "heading", text, level: node.attrs?.level === 3 ? 3 : 2 }, index);
        break;
      }
      case "bulletList":
      case "orderedList": {
        const items = (node.content ?? [])
          .map((item) => ({ spans: contentToSpans(item.content?.[0]?.content) }))
          .filter((item) => item.spans.length);
        if (items.length) push({ type: "list", style: node.type === "orderedList" ? "numbered" : "bulleted", items }, index);
        break;
      }
      case "blockquote": {
        const spans = contentToSpans(node.content?.[0]?.content);
        const attribution = String(node.attrs?.attribution ?? "").trim();
        if (spans.length) push({ type: "quote", spans, attribution: attribution || null }, index);
        break;
      }
      case IMAGE_NODE: {
        const attrs = node.attrs ?? {};
        if (attrs.imageUuid) {
          push({
            type: "image",
            imageUuid: String(attrs.imageUuid),
            altText: String(attrs.altText ?? "").trim(),
            caption: String(attrs.caption ?? "").trim() || null,
          }, index);
        }
        break;
      }
      case "table": {
        const table = tableOf(node);
        if (table) push(table, index);
        break;
      }
    }
  });
  return { blocks, nodeIndex, instruments: docInstruments(doc) };
}

/** The instruments tagged in the document, each once, in the order they first appear. */
export function docInstruments(doc: JSONContent): ArticleInstrument[] {
  const found = new Map<string, ArticleInstrument>();
  const walk = (node: JSONContent) => {
    if (node.type === TAG_NODE && node.attrs?.ticker) {
      const { listingId, instrumentId, ticker, name, isin } = node.attrs;
      const key = instrumentId ?? listingId ?? ticker;
      if (!found.has(key)) found.set(key, { listingId, instrumentId, ticker, name, isin });
    }
    node.content?.forEach(walk);
  };
  walk(doc);
  return [...found.values()];
}
