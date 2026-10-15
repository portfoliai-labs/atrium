// components/dashboard/journal/bodyDoc.ts
//
// An article's body between acta's blocks and the editor's document (TipTap's JSON): paragraphs
// with bold, italic and links, headings 2 and 3, one-level lists, quotes with an attribution,
// images. Nothing else exists in the editor (see BodyEditor), so every document maps whole.

import type { JSONContent } from "@tiptap/core";
import type { Block, Span } from "../../../models/Journal";

// The editor's own node for an article's image (see BodyEditor's ArticleImageNode).
export const IMAGE_NODE = "articleImage";

type Mark = NonNullable<JSONContent["marks"]>[number];

function spansToContent(spans: Span[]): JSONContent[] {
  return spans
    .filter((s) => s.text)
    .map((s) => {
      const marks: Mark[] = [];
      if (s.bold) marks.push({ type: "bold" });
      if (s.italic) marks.push({ type: "italic" });
      if (s.linkUrl) marks.push({ type: "link", attrs: { href: s.linkUrl } });
      return { type: "text", text: s.text, ...(marks.length ? { marks } : {}) };
    });
}

const paragraph = (spans: Span[]): JSONContent => ({ type: "paragraph", content: spansToContent(spans) });

export function blocksToDoc(blocks: Block[]): JSONContent {
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
    }
  });
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

/** A node's text as spans, adjacent runs with the same marks joined; never a line break. */
function contentToSpans(content: JSONContent[] | undefined): Span[] {
  const spans: Span[] = [];
  for (const node of content ?? []) {
    if (node.type !== "text" || !node.text) continue;
    const marks = node.marks ?? [];
    const span: Span = {
      text: node.text.replace(/[\r\n]+/g, " "),
      bold: marks.some((m) => m.type === "bold"),
      italic: marks.some((m) => m.type === "italic"),
      linkUrl: (marks.find((m) => m.type === "link")?.attrs?.href as string | undefined) ?? null,
    };
    const last = spans[spans.length - 1];
    if (last && last.bold === span.bold && last.italic === span.italic && last.linkUrl === span.linkUrl) last.text += span.text;
    else spans.push(span);
  }
  return spans;
}

const textOf = (content: JSONContent[] | undefined) => (content ?? []).map((n) => n.text ?? "").join("").replace(/[\r\n]+/g, " ");

/**
 * The document as blocks, empty paragraphs, headings, items and quotes left out. `nodeIndex[i]` is
 * the document's top-level node block `i` came from: where to point when acta names a block.
 */
export function docToBlocks(doc: JSONContent): { blocks: Block[]; nodeIndex: number[] } {
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
    }
  });
  return { blocks, nodeIndex };
}
