// components/dashboard/journal/BodyEditor.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Extension, Node, mergeAttributes, type Editor, type JSONContent } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState, type ReactNodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Blockquote } from "@tiptap/extension-blockquote";
import { Heading } from "@tiptap/extension-heading";
import { ListItem } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import {
  BetweenHorizontalEnd, BetweenHorizontalStart, BetweenVerticalEnd, BetweenVerticalStart, Bold, Heading2, Heading3, ImagePlus,
  Italic, Link2, List, ListOrdered, Loader2, PanelTop, Pilcrow, Quote, Redo2, Table2, Trash2, Undo2, X,
} from "lucide-react";
import type { ArticleInstrument, Block } from "../../../models/Journal";
import { exchangeLabel } from "../../../models/Listing";
import { IMAGE_ACCEPT, uploadArticleImage } from "../../../services/journalService";
import { useListingSearch } from "../../../hooks/useListingSearch";
import {
  ALT_TEXT_MAX, ATTRIBUTION_MAX, CAPTION_MAX, MAX_INSTRUMENTS, MAX_TABLE_COLUMNS, MAX_TABLE_ROWS, journalErrorText,
} from "../../../lib/journal";
import { IMAGE_NODE, TAG_NODE, blocksToDoc, docInstruments, tagAttrs } from "./bodyDoc";

// ── The editor's nodes: only what acta's blocks can hold ──

const hasScheme = (url: string) => /^[a-z][a-z0-9+.-]*:/i.test(url);
// A link is absolute http(s); a bare domain gets https:// (the link's default protocol).
const isAllowedLink = (url: string) => (hasScheme(url) ? /^https?:\/\/\S+$/i.test(url) : /^[^\s/]+\.[^\s]+$/.test(url));
const normalizeLink = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return "";
  return hasScheme(trimmed) ? trimmed : `https://${trimmed}`;
};

/** An image of the article: one of the author's uploads, with its alt text and caption. */
function ImageView({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) {
  const { src, altText, caption } = node.attrs as { src: string | null; altText: string; caption: string };
  const editable = editor.isEditable;
  return (
    <NodeViewWrapper className={`my-4 rounded-2xl border p-3 bg-slate-50/60 ${selected ? "border-[#C49A3C]" : "border-slate-200"}`} contentEditable={false}>
      <div className="relative">
        {src
          // A signed link to a private bucket: next/image can't optimise it.
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={src} alt={altText} className="w-full max-h-96 object-contain rounded-xl bg-white" />
          : <div className="h-32 rounded-xl bg-white flex items-center justify-center text-xs text-slate-400">Image</div>}
        {editable && (
          <button
            type="button"
            onClick={deleteNode}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 text-slate-500 hover:text-rose-600 shadow-sm"
            aria-label="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Alt text (required)</span>
          <input
            value={altText}
            maxLength={ALT_TEXT_MAX}
            disabled={!editable}
            onChange={(e) => updateAttributes({ altText: e.target.value })}
            placeholder="What the image shows, for screen readers"
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs bg-white outline-none focus:border-[#C49A3C] ${altText.trim() ? "border-slate-200" : "border-amber-300"}`}
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Caption</span>
          <input
            value={caption}
            maxLength={CAPTION_MAX}
            disabled={!editable}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
            placeholder="Optional, shown under it"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white outline-none focus:border-[#C49A3C]"
          />
        </label>
      </div>
    </NodeViewWrapper>
  );
}

const ArticleImageNode = Node.create({
  name: IMAGE_NODE,
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      imageUuid: { default: null },
      altText: { default: "" },
      caption: { default: "" },
      // The short-lived link, for the preview only: never sent.
      src: { default: null },
    };
  },
  // Only the author's uploads: an image pasted from elsewhere isn't one, so it isn't parsed.
  parseHTML: () => [],
  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes, { "data-article-image": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});

/** A quote: one paragraph, and who said it. */
function QuoteView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper as="blockquote" className="my-4 border-l-2 border-[#C49A3C] pl-5 py-1">
      <NodeViewContent className="italic text-slate-800" />
      <div contentEditable={false} className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
        <span>—</span>
        <input
          value={String(node.attrs.attribution ?? "")}
          maxLength={ATTRIBUTION_MAX}
          disabled={!editor.isEditable}
          onChange={(e) => updateAttributes({ attribution: e.target.value })}
          placeholder="Who said it (optional)"
          className="flex-1 bg-transparent font-bold text-slate-500 outline-none placeholder:font-medium placeholder:text-slate-400"
        />
      </div>
    </NodeViewWrapper>
  );
}

const QuoteNode = Blockquote.extend({
  content: "paragraph",
  addAttributes() {
    return { attribution: { default: "" } };
  },
  addNodeView() {
    return ReactNodeViewRenderer(QuoteView);
  },
});

/** An instrument tagged in the text: "#" and its ticker, one piece the cursor steps over. */
const InstrumentTagNode = Node.create({
  name: TAG_NODE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() {
    return {
      listingId: { default: null },
      instrumentId: { default: null },
      ticker: { default: "" },
      name: { default: null },
      isin: { default: null },
    };
  },
  // Copied and pasted within the editor, a tag stays one.
  parseHTML: () => [{
    tag: "span[data-instrument-tag]",
    getAttrs: (el) => {
      try {
        return JSON.parse((el as HTMLElement).dataset.instrumentTag ?? "");
      } catch {
        return false;
      }
    },
  }],
  renderHTML({ node }) {
    return ["span", { "data-instrument-tag": JSON.stringify(node.attrs), class: "journal-tag", title: node.attrs.name ?? undefined }, `#${node.attrs.ticker}`];
  },
  renderText: ({ node }) => `#${node.attrs.ticker}`,
});

// A table: rows of cells, each cell one paragraph; the first row may be the headings, and it has a
// caption. Cells are never merged (acta's tables have none).
const ArticleTable = Table.extend({
  addAttributes() {
    return { ...this.parent?.(), caption: { default: "" } };
  },
}).configure({ resizable: false });
const ArticleTableCell = TableCell.extend({ content: "paragraph" });
const ArticleTableHeader = TableHeader.extend({ content: "paragraph" });

// A block acta refused, marked a moment (focusNode). A decoration, as ProseMirror redraws a node
// whose DOM is changed from outside.
const flagKey = new PluginKey<DecorationSet>("journalFlag");
const FlagBlock = Extension.create({
  name: "journalFlag",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: flagKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const flag = tr.getMeta(flagKey) as { from: number; to: number } | null | undefined;
            if (flag === null) return DecorationSet.empty;
            if (flag) return DecorationSet.create(tr.doc, [Decoration.node(flag.from, flag.to, { class: "journal-flagged" })]);
            return set.map(tr.mapping, tr.doc);
          },
        },
        props: { decorations: (state) => flagKey.getState(state) },
      }),
    ];
  },
});

const EXTENSIONS = [
  StarterKit.configure({
    blockquote: false,
    heading: false,
    listItem: false,
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    horizontalRule: false,
    hardBreak: false,
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      protocols: ["http", "https"],
      isAllowedUri: (url) => isAllowedLink(url),
    },
  }),
  // A heading is plain text.
  Heading.extend({ marks: "" }).configure({ levels: [2, 3] }),
  // One level of list: an item is a paragraph.
  ListItem.extend({ content: "paragraph" }),
  QuoteNode,
  ArticleImageNode,
  InstrumentTagNode,
  ArticleTable,
  TableRow,
  ArticleTableHeader,
  ArticleTableCell,
  FlagBlock,
  Placeholder.configure({ placeholder: "Write the article here. Type # to tag an instrument; headings, lists, tables and images are in the bar above." }),
];

// ── Tagging an instrument ──

// "#" and what follows it up to the cursor, at the start of a line or after a space or a bracket.
const TAG_QUERY = /(?:^|[\s(])#([\p{L}\p{N}.\-]{0,32})$/u;

interface TagQuery { from: number; to: number; query: string }

/** The tag being typed at the cursor, if any: not in a heading, whose text is plain. */
function tagQueryOf(editor: Editor): TagQuery | null {
  const { selection } = editor.state;
  const { $from } = selection;
  if (!selection.empty || !$from.parent.isTextblock || $from.parent.type.name === "heading") return null;
  const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 40), $from.parentOffset, undefined, "\ufffc");
  const match = before.match(TAG_QUERY);
  if (!match) return null;
  return { from: $from.pos - match[1].length - 1, to: $from.pos, query: match[1] };
}

/**
 * What "#" offers while typed: the instruments already tagged whose ticker starts with what
 * follows it (while that's shorter than a search), else census' listings matching the words. One more instrument than the article can
 * name is listed but can't be picked. Arrows, Enter or Tab and Escape drive it from the editor
 * (`keysRef`).
 */
function TagMenu({ editor, tag, tagged, onPick, onClose, keysRef }: {
  editor: Editor;
  tag: TagQuery;
  tagged: ArticleInstrument[];
  onPick: (instrument: ArticleInstrument) => void;
  onClose: () => void;
  keysRef: React.RefObject<((event: KeyboardEvent) => boolean) | null>;
}) {
  const [active, setActive] = useState(0);
  const { searchable, status, results } = useListingSearch(tag.query, () => setActive(0));
  const options: ArticleInstrument[] = searchable
    ? results.map(({ listingId, instrumentId, name, ticker, isin }) => ({ listingId, instrumentId, name, ticker, isin }))
    : tagged.filter((t) => t.ticker.toLowerCase().startsWith(tag.query.toLowerCase()));
  const full = tagged.length >= MAX_INSTRUMENTS;
  const isTagged = (i: ArticleInstrument) => tagged.some((t) => (t.instrumentId ?? t.ticker) === (i.instrumentId ?? i.ticker));
  const canPick = (i: ArticleInstrument) => !full || isTagged(i);
  // Where each listing found trades, beside it.
  const markets = new Map(results.map((r) => [r.listingId, [exchangeLabel(r.exchangeMic, r.exchangeName), r.currency].filter(Boolean).join(" · ")]));

  // The menu sits under the "#", and follows it as the page scrolls.
  const [, setScrolled] = useState(0);
  useEffect(() => {
    const onScroll = () => setScrolled((n) => n + 1);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, []);
  const at = editor.view.coordsAtPos(tag.from);

  const selected = Math.min(active, Math.max(0, options.length - 1));
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") { onClose(); return true; }
    if (!options.length) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((selected + step + options.length) % options.length);
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      if (canPick(options[selected])) onPick(options[selected]);
      return true;
    }
    return false;
  };
  // The editor hands its keys to the menu's latest render while it's open.
  useEffect(() => {
    keysRef.current = onKey;
  });
  useEffect(() => () => { keysRef.current = null; }, [keysRef]);

  const note = !searchable
    ? (options.length ? null : "Type a name, ticker or ISIN")
    : status === "loading" ? "Searching…"
      : status === "error" ? "The search failed."
        : options.length ? null : "Nothing found.";
  return (
    <div
      className="fixed z-30 w-80 max-w-[calc(100vw-32px)] rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
      style={{ top: at.bottom + 6, left: Math.min(at.left, window.innerWidth - 336) }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {!searchable && options.length > 0 && <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Tagged in this article</p>}
      {options.map((o, i) => (
        <button
          key={o.listingId ?? o.ticker}
          type="button"
          disabled={!canPick(o)}
          onMouseEnter={() => setActive(i)}
          onClick={() => onPick(o)}
          className={`w-full flex items-baseline gap-2 rounded-lg px-2.5 py-1.5 text-left disabled:opacity-40 ${i === selected ? "bg-[#C49A3C]/10" : ""}`}
        >
          <span className="shrink-0 text-xs font-bold text-[#9a7424]">#{o.ticker}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{o.name ?? ""}</span>
          {o.listingId && markets.get(o.listingId) && <span className="shrink-0 text-[10px] text-slate-400">{markets.get(o.listingId)}</span>}
        </button>
      ))}
      {note && <p className="px-2.5 py-1.5 text-xs text-slate-400">{note}</p>}
      {full && searchable && <p className="px-2.5 pt-1 pb-1.5 text-[11px] text-slate-400">Up to {MAX_INSTRUMENTS} instruments: only those already tagged.</p>}
    </div>
  );
}

// ── The table under the cursor ──

interface TableState { rows: number; columns: number; headerRow: boolean; caption: string }

function tableStateOf(editor: Editor): TableState | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name !== "table") continue;
    const first = node.firstChild;
    let headerRow = !!first && first.childCount > 0;
    first?.forEach((cell) => { if (cell.type.name !== "tableHeader") headerRow = false; });
    return { rows: node.childCount, columns: first?.childCount ?? 0, headerRow, caption: String(node.attrs.caption ?? "") };
  }
  return null;
}

// ── Pointing at a block ──

/** Selects the document's top-level node `index`, scrolls to it and marks it a moment. */
export function focusNode(editor: Editor, index: number) {
  const { doc } = editor.state;
  if (index < 0 || index >= doc.childCount) return;
  let pos = 0;
  for (let i = 0; i < index; i++) pos += doc.child(i).nodeSize;
  const node = doc.child(index);
  if (node.isAtom) editor.chain().focus().setNodeSelection(pos).scrollIntoView().run();
  else editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
  editor.view.dispatch(editor.state.tr.setMeta(flagKey, { from: pos, to: pos + node.nodeSize }));
  setTimeout(() => {
    if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(flagKey, null));
  }, 2500);
}

// ── The editor ──

function ToolButton({ active = false, disabled = false, label, onClick, children }: {
  active?: boolean; disabled?: boolean; label: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${active ? "bg-[#C49A3C]/15 text-[#9a7424]" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}
    >
      {children}
    </button>
  );
}

// The toolbar of a document nobody has touched yet.
const NO_MARKS = {
  bold: false, italic: false, link: false, h2: false, h3: false, paragraph: true,
  bullet: false, ordered: false, quote: false, canUndo: false, canRedo: false, inHeading: false,
  canTable: true, table: null as TableState | null, tag: null as TagQuery | null,
};

const Divider = () => <span className="w-px h-5 bg-slate-200 mx-1" />;

/**
 * The article's body, written as rich text and kept as acta's blocks (see bodyDoc): paragraphs with
 * bold, italic, links and instruments tagged with "#", two levels of heading, one-level lists,
 * quotes, tables and the author's images (uploaded straight to acta's bucket). It reads as the page
 * it's on: no frame, a bar above it that stays in sight. `initial` (with the article's
 * `instruments`, its tags) is read once; every change hands the document to `onChange`.
 * `editorRef` lets the page point at a block acta refused (focusNode).
 */
export function BodyEditor({ initial, instruments = [], onChange, editorRef, disabled = false }: {
  initial: Block[];
  instruments?: ArticleInstrument[];
  onChange: (doc: JSONContent) => void;
  editorRef: React.RefObject<Editor | null>;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The tag menu's keys, while it's open; the "#" it was closed at, so it stays closed there.
  const tagKeys = useRef<((event: KeyboardEvent) => boolean) | null>(null);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: blocksToDoc(initial, instruments),
    editable: !disabled,
    // The dashboard renders on the client; rendering on the server would mismatch.
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "journal-editor min-h-[360px] outline-none" },
      handleKeyDown: (_view, event) => tagKeys.current?.(event) ?? false,
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  // The page points at blocks through this editor. A replaced editor is destroyed later than its
  // successor is made, so it clears the ref only while the ref is still its own.
  useEffect(() => {
    if (!editor) return;
    editorRef.current = editor;
    return () => { if (editorRef.current === editor) editorRef.current = null; };
  }, [editor, editorRef]);

  const toolbar = useEditorState({
    editor,
    selector: ({ editor }) => editor ? {
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      link: editor.isActive("link"),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      paragraph: editor.isActive("paragraph") && !editor.isActive("listItem") && !editor.isActive("blockquote") && !editor.isActive("table"),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
      quote: editor.isActive("blockquote"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
      // Marks don't exist in a heading.
      inHeading: editor.isActive("heading"),
      canTable: !editor.isActive("table") && editor.can().insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
      table: tableStateOf(editor),
      tag: tagQueryOf(editor),
    } : null,
  });
  // The instruments tagged so far, as the menu offers them: read again only once a tag is typed.
  const tagging = !!toolbar?.tag;
  const tagged = useMemo(() => (tagging && editor ? docInstruments(editor.getJSON()) : []), [tagging, editor]);

  if (!editor) {
    return <div className="min-h-[360px] rounded-xl bg-white/40 animate-pulse" />;
  }
  // The toolbar's state follows the editor's transactions, so it's only there after the first:
  // until then, a fresh document's.
  const state = toolbar ?? NO_MARKS;
  const tag = state.tag && state.tag.from !== dismissedAt ? state.tag : null;
  const table = state.table;

  const openLink = () => {
    setLinkValue(String(editor.getAttributes("link").href ?? ""));
    setLinkOpen(true);
  };
  const applyLink = () => {
    const href = normalizeLink(linkValue);
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!href) chain.unsetLink().run();
    else if (isAllowedLink(href)) chain.setLink({ href }).run();
    else {
      setError("A link starts with http:// or https://.");
      return;
    }
    setError(null);
    setLinkOpen(false);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { imageUuid, file: stored } = await uploadArticleImage(file);
      editor.chain().focus().insertContent({ type: IMAGE_NODE, attrs: { imageUuid, altText: "", caption: "", src: stored.url } }).run();
    } catch (err) {
      setError(journalErrorText(err, "The image couldn't be uploaded."));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const pickTag = (instrument: ArticleInstrument) => {
    if (!tag) return;
    editor.chain().focus().insertContentAt({ from: tag.from, to: tag.to }, [
      { type: TAG_NODE, attrs: tagAttrs(instrument) },
      { type: "text", text: " " },
    ]).run();
  };

  return (
    <div>
      {!disabled && (
        <div className="sticky top-0 z-10 -mx-2 flex flex-wrap items-center gap-0.5 border-y border-[#E7E1D3] bg-[#F7F5EF]/95 backdrop-blur px-1 py-1">
          <ToolButton label="Paragraph" active={state.paragraph} onClick={() => editor.chain().focus().setParagraph().run()}><Pilcrow className="h-4 w-4" /></ToolButton>
          <ToolButton label="Heading" active={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolButton>
          <ToolButton label="Subheading" active={state.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></ToolButton>
          <Divider />
          <ToolButton label="Bold" active={state.bold} disabled={state.inHeading} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolButton>
          <ToolButton label="Italic" active={state.italic} disabled={state.inHeading} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolButton>
          <ToolButton label="Link" active={state.link || linkOpen} disabled={state.inHeading} onClick={openLink}><Link2 className="h-4 w-4" /></ToolButton>
          <Divider />
          <ToolButton label="Bulleted list" active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolButton>
          <ToolButton label="Numbered list" active={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolButton>
          <ToolButton label="Quote" active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></ToolButton>
          <ToolButton label="Table" active={!!table} disabled={!state.canTable} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <Table2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Image" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </ToolButton>
          <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <span className="flex-1" />
          <ToolButton label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></ToolButton>
          <ToolButton label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></ToolButton>
          {table && (
            <div className="basis-full flex flex-wrap items-center gap-0.5 border-t border-[#E7E1D3] pt-1 mt-0.5">
              <span className="px-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Table</span>
              <ToolButton label="Row above" disabled={table.rows >= MAX_TABLE_ROWS} onClick={() => editor.chain().focus().addRowBefore().run()}><BetweenHorizontalStart className="h-4 w-4" /></ToolButton>
              <ToolButton label="Row below" disabled={table.rows >= MAX_TABLE_ROWS} onClick={() => editor.chain().focus().addRowAfter().run()}><BetweenHorizontalEnd className="h-4 w-4" /></ToolButton>
              <ToolButton label="Column before" disabled={table.columns >= MAX_TABLE_COLUMNS} onClick={() => editor.chain().focus().addColumnBefore().run()}><BetweenVerticalStart className="h-4 w-4" /></ToolButton>
              <ToolButton label="Column after" disabled={table.columns >= MAX_TABLE_COLUMNS} onClick={() => editor.chain().focus().addColumnAfter().run()}><BetweenVerticalEnd className="h-4 w-4" /></ToolButton>
              <ToolButton label="First row as headings" active={table.headerRow} onClick={() => editor.chain().focus().toggleHeaderRow().run()}><PanelTop className="h-4 w-4" /></ToolButton>
              <Divider />
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteRow().run()} className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800">Delete row</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteColumn().run()} className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800">Delete column</button>
              <input
                value={table.caption}
                maxLength={CAPTION_MAX}
                onChange={(e) => editor.chain().updateAttributes("table", { caption: e.target.value }).run()}
                placeholder="Caption (optional)"
                className="min-w-40 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#C49A3C]"
              />
              <ToolButton label="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 className="h-4 w-4" /></ToolButton>
            </div>
          )}
        </div>
      )}
      {linkOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E7E1D3] py-2">
          <input
            autoFocus
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); applyLink(); }
              if (e.key === "Escape") setLinkOpen(false);
            }}
            placeholder="https://…"
            className="flex-1 min-w-48 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-[#C49A3C]"
          />
          <button type="button" onClick={applyLink} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold">Apply</button>
          {state.link && (
            <button type="button" onClick={() => { editor.chain().focus().extendMarkRange("link").unsetLink().run(); setLinkOpen(false); }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-200">
              Remove link
            </button>
          )}
          <button type="button" onClick={() => setLinkOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600" aria-label="Close"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {error && <p className="pt-3 text-xs font-medium text-rose-600">{error}</p>}
      <div className="pt-6">
        <EditorContent editor={editor} />
      </div>
      {tag && !disabled && (
        <TagMenu
          key={tag.from}
          editor={editor}
          tag={tag}
          tagged={tagged}
          onPick={pickTag}
          onClose={() => setDismissedAt(tag.from)}
          keysRef={tagKeys}
        />
      )}
    </div>
  );
}
