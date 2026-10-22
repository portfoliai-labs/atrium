// components/dashboard/journal/ArticleEditor.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Editor, JSONContent } from "@tiptap/core";
import {
  AlertTriangle, Check, CheckCircle2, Circle, Eye, ImagePlus, Loader2, PenLine, RotateCcw, Send, Trash2, Undo2, X,
} from "lucide-react";
import { useUser } from "../../../context/UserContext";
import { journalKey, useJournal, useJournalQuery } from "../../../context/JournalContext";
import { ApiError } from "../../../services/apiClient";
import { IMAGE_ACCEPT, journalService, uploadArticleImage } from "../../../services/journalService";
import type {
  Article, ArticleAudience, ArticleCategory, ArticleContent, ArticleImage, ArticleInstrument, ArticleLanguage, Block,
} from "../../../models/Journal";
import { instrumentRef } from "../../../models/Journal";
import type { Listing } from "../../../models/Listing";
import {
  ALT_TEXT_MAX, CAPTION_MAX, CATEGORIES, CATEGORY_LABELS, DEK_MAX, DISCLOSURE_HELP, DISCLOSURE_MAX, DISCLOSURE_TITLE,
  LANGUAGES, LANGUAGE_LABELS, MAX_INSTRUMENTS, NOTE_MAX, TITLE_MAX, dateLabel, journalErrorText,
} from "../../../lib/journal";
import { serif } from "../../preview/PreviewKit";
import { AssetPicker } from "../AssetPicker";
import { ConfirmDialog } from "../ConfirmDialog";
import { BackLink, ErrorState, Spinner, StatusChip } from "./JournalKit";
import { BodyEditor, focusNode } from "./BodyEditor";
import { docToBlocks } from "./bodyDoc";
import { ArticleDocument, HiddenNotice } from "./ArticleReader";

// A draft saves itself once the author pauses.
const AUTOSAVE_MS = 1500;

interface Form {
  title: string;
  dek: string;
  category: ArticleCategory | null;
  language: ArticleLanguage;
  cover: ArticleImage | null;
  instruments: ArticleInstrument[];
  audience: ArticleAudience;
  interestDisclosure: string;
}

const formOf = (article: Article | null, language: ArticleLanguage): Form => ({
  title: article?.title ?? "",
  dek: article?.dek ?? "",
  category: article?.category ?? null,
  language: article?.language ?? language,
  cover: article?.cover ?? null,
  instruments: article?.instruments ?? [],
  audience: article?.audience ?? "everyone",
  interestDisclosure: article?.interestDisclosure ?? "",
});

// What acta refused, and where: a field by its name in the bodies, a block or an instrument by
// its index.
interface Refusal {
  message: string;
  field: string | null;
  index: number | null;
}

function refusalOf(err: unknown): Refusal {
  const message = journalErrorText(err, "The article couldn't be saved.");
  if (!(err instanceof ApiError)) return { message, field: null, index: null };
  const field = err.metadata.field ?? (err.errorType === "DisclosureRequiredError" ? "interestDisclosure" : null);
  const index = err.metadata.index !== undefined ? Number(err.metadata.index) : null;
  return { message, field, index: Number.isFinite(index) ? index : null };
}

const fieldRoot = (field: string | null) => field?.split(".")[0] ?? null;

const inputClass = (flagged: boolean) =>
  `w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#C49A3C] ${flagged ? "border-rose-400" : "border-slate-200"}`;

function SideLabel({ children }: { children: React.ReactNode }) {
  return <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">{children}</span>;
}

/** The images' short-lived links in the editor's document, by block, for the preview. */
function blocksWithFiles(doc: JSONContent, blocks: Block[], nodeIndex: number[]): Block[] {
  return blocks.map((b, i) => {
    if (b.type !== "image") return b;
    const src = doc.content?.[nodeIndex[i]]?.attrs?.src;
    return typeof src === "string" ? { ...b, file: { url: src, urlExpiresAt: "" } } : b;
  });
}

/**
 * THE EDITOR — one of the caller's articles (or a new one, created at its first save): its title,
 * the line under it, its body (BodyEditor), and, on the side, its category, language, cover, the
 * instruments it's about and, for an advisor, who reads it and their interests. A draft saves
 * itself as the author writes; a published or hidden article is checked as publishing and goes
 * live on save, so it's saved by hand. Each save sends the updatedAt last read: an article
 * changed elsewhere since (another tab) is a conflict to resolve, not overwritten.
 */
export function ArticleEditor({ uuid, onCreated, onBack, onRead }: {
  uuid?: string;
  onCreated: (uuid: string) => void;
  onBack: () => void;
  onRead: (slug: string) => void;
}) {
  const { user } = useUser();
  const { language, editor: isEditor, changed } = useJournal();
  const queryClient = useQueryClient();
  const isAdvisor = user?.role === "ADVISOR" && !isEditor;

  // Only the article it opened on: its first save hands it a uuid it already has.
  const [openedOn] = useState(uuid);
  const read = useJournalQuery(["edit", openedOn], () => journalService.get(openedOn!), { enabled: !!openedOn });
  const [article, setArticle] = useState<Article | null>(null);
  const [loaded, setLoaded] = useState(!uuid);
  const [form, setForm] = useState<Form>(() => formOf(null, language));
  const [initialBody, setInitialBody] = useState<Block[]>([]);
  // Bumped to start the body editor over from initialBody (a reload).
  const [bodyKey, setBodyKey] = useState(0);
  const docRef = useRef<JSONContent>({ type: "doc", content: [] });
  const editorRef = useRef<Editor | null>(null);

  // Every change bumps `version`; a save that ends records the version it sent.
  const [version, setVersion] = useState(0);
  const [savedVersion, setSavedVersion] = useState(0);
  const savedVersionRef = useRef(0);
  savedVersionRef.current = savedVersion;
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [conflict, setConflict] = useState(false);
  // The block indexes of the last content sent: where acta's `index` points in the document.
  const sentNodeIndex = useRef<number[]>([]);

  const [busy, setBusy] = useState<null | "publish" | "unpublish" | "review" | "delete">(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [justPublished, setJustPublished] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const status = article?.status ?? "draft";
  const autosave = status === "draft";
  const dirty = version !== savedVersion;

  const reset = useCallback((a: Article) => {
    setArticle(a);
    setForm(formOf(a, language));
    setInitialBody(a.body);
    setBodyKey((k) => k + 1);
    setVersion(0);
    setSavedVersion(0);
    setConflict(false);
    setRefusal(null);
  }, [language]);

  // The article, once, as read fresh (a copy gone stale in the cache waits for its read): a new
  // one starts empty. Read again later, it doesn't touch what's being written.
  if (!loaded && read.data && !read.isStale) {
    reset(read.data);
    setLoaded(true);
  }
  const loadError = !loaded && read.isError ? journalErrorText(read.error, "This article couldn't be loaded.") : null;

  // The article as a write left it, the editor's copy in the cache too; the Journal's other reads go stale.
  const wrote = useCallback((a: Article) => {
    setArticle(a);
    changed();
    queryClient.setQueryData(journalKey("edit", a.uuid), a);
  }, [changed, queryClient]);

  const change = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setVersion((v) => v + 1);
  };
  const onBodyChange = useCallback((doc: JSONContent) => {
    docRef.current = doc;
    setVersion((v) => v + 1);
  }, []);

  const contentOf = (f: Form): ArticleContent => {
    const { blocks, nodeIndex } = docToBlocks(docRef.current);
    sentNodeIndex.current = nodeIndex;
    return {
      title: f.title.trim() || null,
      dek: f.dek.trim() || null,
      category: f.category,
      language: f.language,
      cover: f.cover ? { imageUuid: f.cover.imageUuid, altText: f.cover.altText.trim(), caption: f.cover.caption?.trim() || null } : null,
      body: blocks,
      instruments: f.instruments.map(instrumentRef),
      audience: isAdvisor ? f.audience : null,
      interestDisclosure: isAdvisor ? f.interestDisclosure.trim() || null : null,
    };
  };

  // The latest of everything a save reads, for the autosave's timer.
  const latest = useRef({ form, article, version });
  latest.current = { form, article, version };

  /** Saves the article as it is now; `force` skips the check for a newer version. */
  const save = useCallback(async (force = false): Promise<Article | null> => {
    if (savingRef.current) return null;
    savingRef.current = true;
    setSaving(true);
    const { form: f, article: a, version: sent } = latest.current;
    try {
      const content = contentOf(f);
      const next = a
        ? await journalService.update(a.uuid, { ...content, expectedUpdatedAt: force ? null : a.updatedAt })
        : await journalService.create(content);
      wrote(next);
      setSavedVersion(sent);
      setSavedAt(new Date());
      setRefusal(null);
      setConflict(false);
      if (!a) onCreated(next.uuid);
      return next;
    } catch (err) {
      if (err instanceof ApiError && err.errorType === "ArticleChangedError") setConflict(true);
      else setRefusal(refusalOf(err));
      return null;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    // contentOf reads the refs and isAdvisor only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCreated, isAdvisor, wrote]);

  // A draft's autosave: once the author pauses, unless acta just refused it or it changed elsewhere.
  useEffect(() => {
    if (!loaded || !autosave || !dirty || conflict || saving) return;
    const timer = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [loaded, autosave, dirty, conflict, saving, version, save]);

  // Unsaved changes ask before the tab closes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Points at what acta refused: a block in the body.
  const showRefused = () => {
    if (!refusal || refusal.index === null || fieldRoot(refusal.field) !== "body" || !editorRef.current) return;
    setPreview(false);
    const node = sentNodeIndex.current[refusal.index];
    if (node !== undefined) focusNode(editorRef.current, node);
  };

  const leave = async () => {
    if (dirty && autosave) {
      if (await save()) onBack();
      return;
    }
    if (dirty) setConfirmLeave(true);
    else onBack();
  };

  const run = async (kind: NonNullable<typeof busy>, action: (uuid: string) => Promise<Article | void>) => {
    setBusy(kind);
    setActionError(null);
    try {
      // An autosave on its way first: what it sends is what gets published.
      while (savingRef.current) await new Promise((resolve) => setTimeout(resolve, 100));
      let current = latest.current.article;
      if (!current || latest.current.version !== savedVersionRef.current) current = await save();
      if (!current) return;
      // The content is what was just saved: only the article's state changes, the editor stays.
      const next = await action(current.uuid);
      if (next) wrote(next);
      return next;
    } catch (err) {
      const r = refusalOf(err);
      if (r.field) setRefusal(r);
      else setActionError(r.message);
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    const next = await run("publish", journalService.publish);
    if (next) setJustPublished(true);
  };
  const unpublish = () => run("unpublish", journalService.unpublish);
  const requestReview = async () => {
    const next = await run("review", (id) => journalService.requestReview(id, reviewNote.trim()));
    if (next) { setReviewOpen(false); setReviewNote(""); }
  };
  const remove = async () => {
    if (!article) { onBack(); return; }
    setBusy("delete");
    setActionError(null);
    try {
      await journalService.remove(article.uuid);
      changed();
      onBack();
    } catch (err) {
      setActionError(journalErrorText(err, "The article couldn't be deleted."));
      setBusy(null);
    }
  };

  const uploadCover = async (file: File | undefined) => {
    if (!file) return;
    setCoverUploading(true);
    setCoverError(null);
    try {
      const { imageUuid, file: stored } = await uploadArticleImage(file);
      change({ cover: { imageUuid, altText: "", caption: null, file: stored } });
    } catch (err) {
      setCoverError(journalErrorText(err, "The image couldn't be uploaded."));
    } finally {
      setCoverUploading(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  };

  const addInstrument = (listing: Listing | null) => {
    if (!listing || form.instruments.length >= MAX_INSTRUMENTS) return;
    if (form.instruments.some((i) => i.instrumentId === listing.instrumentId)) return;
    const { listingId, instrumentId, name, ticker, isin } = listing;
    change({ instruments: [...form.instruments, { listingId, instrumentId, name, ticker, isin }] });
  };

  if (loadError) return <div className="pb-12 space-y-5"><BackLink label="Your articles" onClick={onBack} /><ErrorState message={loadError} /></div>;
  if (!loaded) return <div className="pb-12 space-y-5"><BackLink label="Your articles" onClick={onBack} /><Spinner /></div>;

  // What publishing needs, as acta checks it.
  const { blocks, nodeIndex } = docToBlocks(docRef.current);
  const images = blocks.filter((b): b is Extract<Block, { type: "image" }> => b.type === "image");
  const needsDisclosure = isAdvisor && form.instruments.length > 0;
  const checklist = [
    { label: "A title", done: !!form.title.trim() },
    { label: "A category", done: !!form.category },
    { label: "Some text", done: blocks.some((b) => b.type !== "image") },
    ...(images.length || form.cover ? [{ label: "Alt text for every image", done: images.every((i) => i.altText) && (!form.cover || !!form.cover.altText.trim()) }] : []),
    ...(needsDisclosure ? [{ label: "Your interests in the instruments", done: !!form.interestDisclosure.trim() }] : []),
  ];
  const ready = checklist.every((c) => c.done);
  const flagged = fieldRoot(refusal?.field ?? null);

  const saveState = saving
    ? <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>
    : dirty
      ? <span>{autosave ? "Unsaved changes" : "Unsaved changes: save to update the published article"}</span>
      : savedAt
        ? <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Saved</span>
        : article ? <span>{article.publishedAt ? `Published ${dateLabel(article.publishedAt)}` : "Draft"}</span> : <span>New article</span>;

  const previewArticle: Article | null = preview ? {
    uuid: article?.uuid ?? "preview",
    author: article?.author.kind ? article.author : { kind: isEditor ? "editor" : isAdvisor ? "advisor" : "user", userUuid: user?.uuid ?? null, displayName: [user?.first_name, user?.last_name].filter(Boolean).join(" ") || null },
    status,
    title: form.title,
    dek: form.dek || null,
    category: form.category,
    language: form.language,
    cover: form.cover,
    instruments: form.instruments,
    audience: form.audience,
    slug: article?.slug ?? null,
    readMinutes: article?.readMinutes ?? 1,
    publishedAt: article?.publishedAt ?? null,
    editedAt: article?.editedAt ?? null,
    saved: false,
    applauseCount: article?.applauseCount ?? 0,
    applauded: false,
    commentCount: article?.commentCount ?? 0,
    body: blocksWithFiles(docRef.current, blocks, nodeIndex),
    interestDisclosure: isAdvisor ? form.interestDisclosure || null : null,
    moderation: null,
    createdAt: article?.createdAt ?? "",
    updatedAt: article?.updatedAt ?? "",
  } : null;

  const primary = status === "draft" ? (
    <button
      type="button"
      onClick={() => void publish()}
      disabled={!!busy || !ready || conflict}
      title={ready ? undefined : "See what publishing needs, on the side"}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-50"
    >
      {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish
    </button>
  ) : (
    <button
      type="button"
      onClick={() => void save()}
      disabled={!dirty || saving || conflict}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-50"
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save changes
    </button>
  );

  return (
    <div className="pb-12 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackLink label="Your articles" onClick={() => void leave()} />
          <StatusChip status={status} />
          <span className="text-[11px] font-semibold text-slate-400">{saveState}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 bg-white hover:border-slate-300"
          >
            {preview ? <><PenLine className="h-3.5 w-3.5" /> Edit</> : <><Eye className="h-3.5 w-3.5" /> Preview</>}
          </button>
          {status === "published" && (
            <button
              type="button"
              onClick={() => void unpublish()}
              disabled={!!busy}
              title="Back to a draft: only you can read it"
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 bg-white hover:border-slate-300 disabled:opacity-50"
            >
              {busy === "unpublish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Unpublish
            </button>
          )}
          {status === "hidden" && !article?.moderation?.reviewRequested && (
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              disabled={!!busy || dirty}
              title={dirty ? "Save your changes first" : undefined}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 bg-white hover:border-slate-300 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Ask for a review
            </button>
          )}
          {primary}
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={!!busy}
            className="p-2.5 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
            aria-label="Delete article"
            title="Delete article"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {article && <HiddenNotice article={article} />}

      {justPublished && article?.slug && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-900">
          <span className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4" /> Published: it&apos;s in the Journal now.</span>
          <button type="button" onClick={() => onRead(article.slug!)} className="text-xs font-bold underline underline-offset-2">Read it</button>
        </div>
      )}

      {conflict && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> This article was changed somewhere else (another tab or device) since you opened it.</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { if (article) void journalService.get(article.uuid).then((a) => { reset(a); queryClient.setQueryData(journalKey("edit", a.uuid), a); }).catch((err) => setActionError(journalErrorText(err, "It couldn't be reloaded."))); }}
              className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-xs font-bold"
            >
              Load that version
            </button>
            <button type="button" onClick={() => void save(true)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold">Keep mine</button>
          </div>
        </div>
      )}

      {(refusal || actionError) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-800">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> {refusal?.message ?? actionError}</span>
          <div className="flex items-center gap-2">
            {refusal && fieldRoot(refusal.field) === "body" && refusal.index !== null && (
              <button type="button" onClick={showRefused} className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-bold">Show me</button>
            )}
            <button type="button" onClick={() => { setRefusal(null); setActionError(null); }} className="p-1 text-rose-400 hover:text-rose-600" aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className={preview ? "hidden" : "space-y-4"}>
          <textarea
            value={form.title}
            maxLength={TITLE_MAX}
            onChange={(e) => change({ title: e.target.value.replace(/\n/g, " ") })}
            rows={1}
            placeholder="Title"
            style={serif}
            className={`w-full resize-none field-sizing-content bg-transparent text-3xl md:text-4xl font-black text-slate-900 leading-tight outline-none placeholder:text-slate-400 ${flagged === "title" ? "underline decoration-rose-400" : ""}`}
          />
          <textarea
            value={form.dek}
            maxLength={DEK_MAX}
            onChange={(e) => change({ dek: e.target.value.replace(/\n/g, " ") })}
            rows={1}
            placeholder="Subtitle (optional): one line on what the reader will take away"
            className={`w-full resize-none field-sizing-content bg-transparent text-base md:text-lg text-slate-500 leading-relaxed outline-none placeholder:text-slate-400 ${flagged === "dek" ? "underline decoration-rose-400" : ""}`}
          />
          <BodyEditor key={bodyKey} initial={initialBody} onChange={onBodyChange} editorRef={editorRef} />
        </div>
        {previewArticle && <ArticleDocument article={previewArticle} />}

        <aside className="space-y-4 xl:sticky xl:top-4">
          {status === "draft" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <SideLabel>To publish</SideLabel>
              <ul className="space-y-1.5">
                {checklist.map((c) => (
                  <li key={c.label} className={`flex items-center gap-2 text-xs font-semibold ${c.done ? "text-slate-400" : "text-slate-700"}`}>
                    {c.done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Circle className="h-3.5 w-3.5 text-slate-300" />}
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <label className="block">
              <SideLabel>Category</SideLabel>
              <select
                value={form.category ?? ""}
                onChange={(e) => change({ category: (e.target.value || null) as ArticleCategory | null })}
                className={inputClass(flagged === "category")}
              >
                <option value="">Choose one</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </label>
            <label className="block">
              <SideLabel>Language</SideLabel>
              <select value={form.language} onChange={(e) => change({ language: e.target.value as ArticleLanguage })} className={inputClass(flagged === "language")}>
                {LANGUAGES.map((l) => <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>)}
              </select>
            </label>
            {isAdvisor && (
              <label className="block">
                <SideLabel>Who reads it</SideLabel>
                <select value={form.audience} onChange={(e) => change({ audience: e.target.value as ArticleAudience })} className={inputClass(flagged === "audience")}>
                  <option value="everyone">Everyone on PortfoliAI</option>
                  <option value="advisor_clients">Only my clients</option>
                </select>
              </label>
            )}
          </div>

          <div className={`rounded-2xl border bg-white p-5 space-y-3 ${flagged === "cover" ? "border-rose-400" : "border-slate-200"}`}>
            <SideLabel>Cover image</SideLabel>
            {form.cover ? (
              <>
                <div className="relative">
                  {form.cover.file?.url && (
                    // A signed link to a private bucket: next/image can't optimise it.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.cover.file.url} alt={form.cover.altText} className="w-full h-36 object-cover rounded-xl" />
                  )}
                  <button type="button" onClick={() => change({ cover: null })} className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 text-slate-500 hover:text-rose-600 shadow-sm" aria-label="Remove cover">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  value={form.cover.altText}
                  maxLength={ALT_TEXT_MAX}
                  onChange={(e) => change({ cover: { ...form.cover!, altText: e.target.value } })}
                  placeholder="Alt text (required): what it shows"
                  className={inputClass(!form.cover.altText.trim())}
                />
                <input
                  value={form.cover.caption ?? ""}
                  maxLength={CAPTION_MAX}
                  onChange={(e) => change({ cover: { ...form.cover!, caption: e.target.value } })}
                  placeholder="Caption (optional)"
                  className={inputClass(false)}
                />
              </>
            ) : (
              <button
                type="button"
                onClick={() => coverInput.current?.click()}
                disabled={coverUploading}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-6 text-xs font-bold text-slate-500 hover:border-[#C49A3C] hover:text-[#9a7424] disabled:opacity-60"
              >
                {coverUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {coverUploading ? "Uploading…" : "Add a cover (JPEG, PNG or WebP, up to 5 MB)"}
              </button>
            )}
            <input ref={coverInput} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => void uploadCover(e.target.files?.[0])} />
            {coverError && <p className="text-xs font-medium text-rose-600">{coverError}</p>}
          </div>

          <div className={`rounded-2xl border bg-white p-5 space-y-3 ${flagged === "instruments" ? "border-rose-400" : "border-slate-200"}`}>
            <SideLabel>Instruments it&apos;s about</SideLabel>
            {form.instruments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.instruments.map((i, idx) => (
                  <span
                    key={i.listingId ?? i.ticker}
                    className={`inline-flex items-center gap-1 rounded-full pl-3 pr-1.5 py-1 text-xs font-bold ${flagged === "instruments" && refusal?.index === idx ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}
                  >
                    {i.ticker}
                    <button type="button" onClick={() => change({ instruments: form.instruments.filter((x) => x !== i) })} className="p-0.5 rounded-full hover:bg-slate-200" aria-label={`Remove ${i.ticker}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {form.instruments.length < MAX_INSTRUMENTS ? (
              <AssetPicker
                key={form.instruments.length}
                value={null}
                onChange={addInstrument}
                label="Add one"
                excludeInstrumentIds={form.instruments.flatMap((i) => (i.instrumentId ? [i.instrumentId] : []))}
              />
            ) : (
              <p className="text-xs text-slate-400">Up to {MAX_INSTRUMENTS} instruments.</p>
            )}
            <p className="text-[11px] text-slate-400 leading-relaxed">Readers find the article from the instruments it names.</p>
          </div>

          {isAdvisor && (needsDisclosure || form.interestDisclosure) && (
            <label className={`block rounded-2xl border bg-white p-5 ${flagged === "interestDisclosure" ? "border-rose-400" : "border-slate-200"}`}>
              <SideLabel>{DISCLOSURE_TITLE}{needsDisclosure ? " (required)" : ""}</SideLabel>
              <textarea
                value={form.interestDisclosure}
                maxLength={DISCLOSURE_MAX}
                onChange={(e) => change({ interestDisclosure: e.target.value })}
                rows={4}
                className={`${inputClass(false)} resize-none`}
              />
              <span className="mt-1.5 block text-[11px] text-slate-400 leading-relaxed">{DISCLOSURE_HELP}</span>
            </label>
          )}
        </aside>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this article?"
          description={status === "draft"
            ? "The draft and its images are deleted for good."
            : "It disappears from the Journal and from everyone's saved articles, for good. To take it down for now, unpublish it instead."}
          confirming={busy === "delete"}
          error={actionError}
          onConfirm={() => void remove()}
          onClose={() => setConfirmDelete(false)}
        />
      )}
      {confirmLeave && (
        <ConfirmDialog
          title="Leave without saving?"
          description="Your changes to the published article haven't been saved, and will be lost."
          confirmLabel="Discard changes"
          onConfirm={onBack}
          onClose={() => setConfirmLeave(false)}
        />
      )}
      {reviewOpen && (
        <ConfirmDialog
          title="Ask the editors for a review"
          description="They'll read the article again, as it is now, and decide whether to show it again."
          confirmLabel="Ask for a review"
          tone="neutral"
          confirming={busy === "review"}
          error={actionError}
          onConfirm={() => void requestReview()}
          onClose={() => setReviewOpen(false)}
        >
          <textarea
            value={reviewNote}
            maxLength={NOTE_MAX}
            onChange={(e) => setReviewNote(e.target.value)}
            rows={3}
            placeholder="What you changed (optional)"
            className={`${inputClass(false)} resize-none`}
          />
        </ConfirmDialog>
      )}
    </div>
  );
}
