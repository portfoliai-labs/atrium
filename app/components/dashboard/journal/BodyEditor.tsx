// components/dashboard/journal/BodyEditor.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Extension, Node, mergeAttributes, type Editor, type JSONContent } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState, type ReactNodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Blockquote } from "@tiptap/extension-blockquote";
import { Heading } from "@tiptap/extension-heading";
import { ListItem } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, Pilcrow, Quote, Redo2, Undo2, X,
} from "lucide-react";
import type { Block } from "../../../models/Journal";
import { IMAGE_ACCEPT, uploadArticleImage } from "../../../services/journalService";
import { ALT_TEXT_MAX, ATTRIBUTION_MAX, CAPTION_MAX, journalErrorText } from "../../../lib/journal";
import { IMAGE_NODE, blocksToDoc } from "./bodyDoc";

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
  FlagBlock,
  Placeholder.configure({ placeholder: "Write the article here. Headings, lists, quotes and images are in the bar above." }),
];

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
};

const Divider = () => <span className="w-px h-5 bg-slate-200 mx-1" />;

/**
 * The article's body, written as rich text and kept as acta's blocks (see bodyDoc): paragraphs with
 * bold, italic and links, two levels of heading, one-level lists, quotes and the author's images
 * (uploaded straight to acta's bucket). `initial` is read once; every change hands the document to
 * `onChange`. `editorRef` lets the page point at a block acta refused (focusNode).
 */
export function BodyEditor({ initial, onChange, editorRef, disabled = false }: {
  initial: Block[];
  onChange: (doc: JSONContent) => void;
  editorRef: React.RefObject<Editor | null>;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: blocksToDoc(initial),
    editable: !disabled,
    // The dashboard renders on the client; rendering on the server would mismatch.
    immediatelyRender: false,
    editorProps: { attributes: { class: "journal-editor min-h-[320px] outline-none" } },
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
      paragraph: editor.isActive("paragraph") && !editor.isActive("listItem") && !editor.isActive("blockquote"),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
      quote: editor.isActive("blockquote"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
      // Marks don't exist in a heading.
      inHeading: editor.isActive("heading"),
    } : null,
  });

  if (!editor) {
    return <div className="min-h-[360px] rounded-2xl border border-slate-200 bg-slate-50/50 animate-pulse" />;
  }
  // The toolbar's state follows the editor's transactions, so it's only there after the first:
  // until then, a fresh document's.
  const state = toolbar ?? NO_MARKS;

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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {!disabled && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-white/95 backdrop-blur px-2 py-1.5 rounded-t-2xl">
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
          <ToolButton label="Image" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </ToolButton>
          <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <span className="flex-1" />
          <ToolButton label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></ToolButton>
          <ToolButton label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></ToolButton>
        </div>
      )}
      {linkOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
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
      {error && <p className="px-4 pt-3 text-xs font-medium text-rose-600">{error}</p>}
      <div className="px-5 py-4 md:px-8 md:py-6">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
