// components/dashboard/journal/BodyEditor.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Extension, Node, isTextSelection, mergeAttributes, type Editor, type JSONContent } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState, type ReactNodeViewProps } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Blockquote } from "@tiptap/extension-blockquote";
import { Heading } from "@tiptap/extension-heading";
import { ListItem } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Highlight } from "@tiptap/extension-highlight";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import {
  BetweenHorizontalEnd, BetweenHorizontalStart, BetweenVerticalEnd, BetweenVerticalStart, Bold, Check, Heading2, Heading3,
  Highlighter, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, PanelTop, Plus, Quote, Strikethrough, Table2, Trash2, X,
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

// The page's own face, for the fields inside the text (an image's, a quote's), set in the serif.
const UI_FONT = { fontFamily: "Arial, Helvetica, sans-serif" } as const;

/** An image of the article: one of the author's uploads, with its alt text and caption. */
function ImageView({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) {
  const { src, altText, caption } = node.attrs as { src: string | null; altText: string; caption: string };
  const editable = editor.isEditable;
  return (
    <NodeViewWrapper className={`my-6 rounded-2xl border p-3 bg-white/60 ${selected ? "border-[#C49A3C]" : "border-[#E7E1D3]"}`} contentEditable={false} style={UI_FONT}>
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
    <NodeViewWrapper as="blockquote" className="my-6 border-l-[3px] border-[#C49A3C] pl-6 py-1">
      <NodeViewContent className="italic text-[22px] leading-snug text-[#44403c]" />
      <div contentEditable={false} className="mt-2 flex items-center gap-1.5 text-xs text-[#a8a29e]" style={UI_FONT}>
        <span>—</span>
        <input
          value={String(node.attrs.attribution ?? "")}
          maxLength={ATTRIBUTION_MAX}
          disabled={!editor.isEditable}
          onChange={(e) => updateAttributes({ attribution: e.target.value })}
          placeholder="Who said it (optional)"
          className="flex-1 bg-transparent font-bold text-[#78716c] outline-none placeholder:font-medium placeholder:text-[#b5ad9e]"
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
  // ==text== highlights it, as ~~text~~ strikes it through.
  Highlight,
  ArticleImageNode,
  InstrumentTagNode,
  ArticleTable,
  TableRow,
  ArticleTableHeader,
  ArticleTableCell,
  FlagBlock,
  Placeholder.configure({ placeholder: "Tell your story… Select words to format them, type # to tag an instrument, and on an empty line + adds an image or a table." }),
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
      className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${active ? "bg-[#C49A3C]/15 text-[#8A6A28]" : "text-[#78716c] hover:bg-[#F1EADB] hover:text-[#1c1917]"}`}
    >
      {children}
    </button>
  );
}

/** A button of the bar over a selection: light on dark, gold when its mark is on. */
function BubbleButton({ active = false, disabled = false, label, onClick, children }: {
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
      className={`p-1.5 rounded-md transition-colors disabled:opacity-30 ${active ? "text-[#E3C77F]" : "text-slate-200 hover:text-white"}`}
    >
      {children}
    </button>
  );
}

// The state of a document nobody has touched yet.
const NO_MARKS = {
  bold: false, italic: false, strike: false, highlight: false, link: false, h2: false, h3: false,
  quote: false, inHeading: false, canTable: true, table: null as TableState | null, tag: null as TagQuery | null, at: 0,
};

// The menus' settings, made once: a new one on each render would be sent to their plugins each time.
const PLUS_KEY = "journalPlus";
const PLUS_OPTIONS = { placement: "left", offset: 12 } as const;
const BUBBLE_OPTIONS = { placement: "top", offset: 8 } as const;

/** The +: on an empty paragraph at the top level (not a heading's, a list's or a table's), where the cursor is. */
const showPlus = ({ editor, state }: { editor: Editor; state: Editor["state"] }) => {
  const { $anchor, empty } = state.selection;
  return editor.isEditable && editor.isFocused && empty && $anchor.depth === 1 && $anchor.parent.type.name === "paragraph" && $anchor.parent.childCount === 0;
};

/** The bar over a selection: words selected only, not an image, nor cells across a table. */
const showBubble = ({ editor, state, from, to }: { editor: Editor; state: Editor["state"]; from: number; to: number }) =>
  editor.isEditable && isTextSelection(state.selection) && from !== to && !!state.doc.textBetween(from, to).trim();

const Divider = ({ dark = false }: { dark?: boolean }) => <span className={`w-px h-5 mx-1 ${dark ? "bg-white/15" : "bg-slate-200"}`} />;

/**
 * The article's body, written as rich text and kept as acta's blocks (see bodyDoc): paragraphs with
 * bold, italic, struck through and highlighted text, links and instruments tagged with "#", two
 * levels of heading, one-level lists, quotes, tables and the author's images (uploaded straight to
 * acta's bucket). It reads as the page it's on, Medium's way: no frame and no bar. Words selected
 * get a bar over them (their marks, a link, a heading or a quote); an empty line a + at its left
 * (an image, a table, a list, a quote); a table its own bar while the cursor is in it. Markdown's
 * shorthands work as typed ("- " a list, "1. " a numbered one, "> " a quote, "## " a heading,
 * **bold**, ~~struck~~, ==highlighted==). `initial` (with the article's `instruments`, its tags)
 * is read once; every change hands the document to `onChange`. `editorRef` lets the page point at
 * a block acta refused (focusNode).
 */
export function BodyEditor({ initial, instruments = [], onChange, editorRef, disabled = false }: {
  initial: Block[];
  instruments?: ArticleInstrument[];
  onChange: (doc: JSONContent) => void;
  editorRef: React.RefObject<Editor | null>;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  // The selection whose link is being written, by its position: selecting elsewhere closes it.
  const [linkAt, setLinkAt] = useState<number | null>(null);
  const [linkValue, setLinkValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The empty line whose + is open, by its position: moving elsewhere closes it.
  const [plusAt, setPlusAt] = useState<number | null>(null);
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

  // The + is placed once its line changes; what moves the page under it (the title wrapping, an
  // image loading, the table's bar) has it placed again.
  useEffect(() => {
    if (!editor) return;
    const observer = new ResizeObserver(() => {
      if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(PLUS_KEY, "updatePosition"));
    });
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [editor]);

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
      strike: editor.isActive("strike"),
      highlight: editor.isActive("highlight"),
      link: editor.isActive("link"),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      quote: editor.isActive("blockquote"),
      // Marks don't exist in a heading.
      inHeading: editor.isActive("heading"),
      canTable: !editor.isActive("table") && editor.can().insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
      table: tableStateOf(editor),
      tag: tagQueryOf(editor),
      at: editor.state.selection.from,
    } : null,
  });
  // The instruments tagged so far, as the menu offers them: read again only once a tag is typed.
  const tagging = !!toolbar?.tag;
  const tagged = useMemo(() => (tagging && editor ? docInstruments(editor.getJSON()) : []), [tagging, editor]);

  if (!editor) {
    return <div className="min-h-[360px] rounded-xl bg-white/40 animate-pulse" />;
  }
  // The state follows the editor's transactions, so it's only there after the first: until then,
  // a fresh document's.
  const state = toolbar ?? NO_MARKS;
  const tag = state.tag && state.tag.from !== dismissedAt ? state.tag : null;
  const table = state.table;
  const plusOpen = plusAt === state.at;
  const linkOpen = linkAt === state.at;
  const setLinkOpen = (open: boolean) => setLinkAt(open ? state.at : null);

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

  // What the + adds in place of its empty line.
  const insert = (run: () => void) => {
    setPlusAt(null);
    run();
  };

  return (
    <div>
      {!disabled && table && (
        <div className="sticky top-0 z-10 -mx-2 mb-2 flex flex-wrap items-center gap-0.5 border-y border-[#E7E1D3] bg-[#F7F5EF]/95 backdrop-blur px-1 py-1">
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
      {error && <p className="pb-3 text-xs font-medium text-rose-600">{error}</p>}
      <EditorContent editor={editor} />
      <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />

      {!disabled && (
        <BubbleMenu
          editor={editor}
          options={BUBBLE_OPTIONS}
          shouldShow={showBubble}
          className="flex items-center gap-0.5 rounded-lg bg-[#1c1917] px-1.5 py-1 shadow-lg"
        >
          {linkOpen ? (
            <>
              <input
                autoFocus
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); applyLink(); }
                  if (e.key === "Escape") { setLinkOpen(false); editor.commands.focus(); }
                }}
                placeholder="Paste or type a link…"
                className="w-60 bg-transparent px-2 py-1 text-xs text-white outline-none placeholder:text-slate-400"
              />
              <BubbleButton label="Apply" onClick={applyLink}><Check className="h-4 w-4" /></BubbleButton>
              {state.link && (
                <BubbleButton label="Remove link" onClick={() => { editor.chain().focus().extendMarkRange("link").unsetLink().run(); setLinkOpen(false); }}>
                  <Trash2 className="h-4 w-4" />
                </BubbleButton>
              )}
              <BubbleButton label="Close" onClick={() => { setLinkOpen(false); editor.commands.focus(); }}><X className="h-4 w-4" /></BubbleButton>
            </>
          ) : (
            <>
              <BubbleButton label="Bold" active={state.bold} disabled={state.inHeading} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></BubbleButton>
              <BubbleButton label="Italic" active={state.italic} disabled={state.inHeading} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></BubbleButton>
              <BubbleButton label="Strikethrough" active={state.strike} disabled={state.inHeading} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></BubbleButton>
              <BubbleButton label="Highlight" active={state.highlight} disabled={state.inHeading} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter className="h-4 w-4" /></BubbleButton>
              <BubbleButton label="Link" active={state.link} disabled={state.inHeading} onClick={openLink}><Link2 className="h-4 w-4" /></BubbleButton>
              <Divider dark />
              <BubbleButton label="Heading" active={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></BubbleButton>
              <BubbleButton label="Subheading" active={state.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></BubbleButton>
              <BubbleButton label="Quote" active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></BubbleButton>
            </>
          )}
        </BubbleMenu>
      )}

      {!disabled && (
        <FloatingMenu
          editor={editor}
          pluginKey={PLUS_KEY}
          options={PLUS_OPTIONS}
          shouldShow={showPlus}
          className="flex items-center gap-1"
        >
          <button
            type="button"
            aria-label={plusOpen ? "Close" : "Add an image, a table, a list or a quote"}
            title={plusOpen ? "Close" : "Add an image, a table, a list or a quote"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPlusAt(plusOpen ? null : state.at)}
            className={`h-8 w-8 shrink-0 flex items-center justify-center rounded-full border bg-[#F7F5EF] transition ${plusOpen ? "rotate-45 border-[#C49A3C] text-[#8A6A28]" : "border-[#D9D0BC] text-[#a8a29e] hover:border-[#C49A3C] hover:text-[#8A6A28]"}`}
          >
            <Plus className="h-4 w-4" />
          </button>
          {plusOpen && (
            // Laid over the line, to the + button's right.
            <div className="absolute left-full ml-2 flex items-center gap-1 rounded-full border border-[#E7E1D3] bg-white px-1.5 py-1 shadow-md shadow-[#1c1917]/5">
              <ToolButton label="Image" disabled={uploading} onClick={() => insert(() => fileRef.current?.click())}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              </ToolButton>
              <ToolButton label="Table" disabled={!state.canTable} onClick={() => insert(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}>
                <Table2 className="h-4 w-4" />
              </ToolButton>
              <ToolButton label="Bulleted list" onClick={() => insert(() => editor.chain().focus().toggleBulletList().run())}><List className="h-4 w-4" /></ToolButton>
              <ToolButton label="Numbered list" onClick={() => insert(() => editor.chain().focus().toggleOrderedList().run())}><ListOrdered className="h-4 w-4" /></ToolButton>
              <ToolButton label="Quote" onClick={() => insert(() => editor.chain().focus().toggleBlockquote().run())}><Quote className="h-4 w-4" /></ToolButton>
            </div>
          )}
        </FloatingMenu>
      )}

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
