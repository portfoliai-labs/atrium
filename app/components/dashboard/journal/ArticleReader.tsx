// components/dashboard/journal/ArticleReader.tsx
"use client";

import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, EyeOff, Flag, HandHeart, Info, Loader2, PenLine } from "lucide-react";
import { useUser } from "../../../context/UserContext";
import { useJournal } from "../../../context/JournalContext";
import { journalService } from "../../../services/journalService";
import type { Article, ArticleInstrument } from "../../../models/Journal";
import {
  DISCLOSURE_TITLE, EDITORS_NOTICE, NOT_ADVICE_NOTICE, REASON_LABELS, authorName, dateLabel, isArticleNotFound, journalErrorText,
} from "../../../lib/journal";
import { serif } from "../../preview/PreviewKit";
import type { JournalFilters } from "../JournalSection";
import { ArticleBody, ArticleFigure } from "./ArticleBody";
import { AuthorBadge, BackLink, EmptyState, ErrorState, Meta, Spinner } from "./JournalKit";
import { ReportDialog } from "./ReportDialog";
import { ArticleComments } from "./ArticleComments";

/**
 * An article as its readers see it: the byline, cover, body, the instruments it's about, and
 * the notices it comes with (an editor's: education only; anyone else's: their own opinion, not
 * advice, and an advisor's interests in the instruments). `onAuthor` / `onInstrument` narrow the
 * list to them; `actions` sit under the title. The editor's preview and the editors' cases show
 * an article the same way.
 */
export function ArticleDocument({ article, actions, onAuthor, onInstrument }: {
  article: Article;
  actions?: React.ReactNode;
  onAuthor?: () => void;
  onInstrument?: (instrument: ArticleInstrument) => void;
}) {
  const byEditors = article.author.kind === "editor";
  const name = authorName(article.author);
  return (
    <article className="bg-white rounded-3xl border border-slate-200 shadow-sm px-6 py-8 md:px-14 md:py-12">
      <div className="max-w-2xl mx-auto">
        <Meta article={article} />
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 mt-3 leading-tight" style={serif}>{article.title || "Untitled"}</h1>
        {article.dek && <p className="text-base md:text-lg text-slate-500 mt-4 leading-relaxed">{article.dek}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>By</span>
            {onAuthor ? (
              <button type="button" onClick={onAuthor} className="font-bold text-slate-800 hover:text-[#C49A3C]">{name}</button>
            ) : (
              <span className="font-bold text-slate-800">{name}</span>
            )}
            <AuthorBadge author={article.author} />
            {article.editedAt && <span className="text-slate-400">· Updated {dateLabel(article.editedAt)}</span>}
          </p>
          {actions}
        </div>
        {article.cover && <ArticleFigure image={article.cover} className="mt-8" />}
        <div className="mt-8 pt-8 border-t border-slate-100">
          <ArticleBody blocks={article.body} />
        </div>

        {article.instruments.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">About</span>
            {article.instruments.map((i) => (
              <button
                key={i.listingId ?? i.ticker}
                type="button"
                disabled={!onInstrument}
                onClick={() => onInstrument?.(i)}
                title={onInstrument ? `More articles about ${i.ticker}` : undefined}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 enabled:hover:border-[#C49A3C]/50 enabled:hover:text-[#9a7424]"
              >
                {i.ticker}
              </button>
            ))}
          </div>
        )}

        {article.interestDisclosure && (
          <div className="mt-8 rounded-2xl bg-amber-50/70 border border-amber-100 px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">{DISCLOSURE_TITLE}</p>
            <p className="mt-1.5 text-[13px] text-slate-700 leading-relaxed whitespace-pre-line">{article.interestDisclosure}</p>
          </div>
        )}
        <p className="mt-10 pt-6 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
          {!byEditors && <Info className="h-3.5 w-3.5 shrink-0 mt-px" />}
          {byEditors ? EDITORS_NOTICE : NOT_ADVICE_NOTICE}
        </p>
      </div>
    </article>
  );
}

/** Why the editors hid the caller's own article, on its pages. */
export function HiddenNotice({ article }: { article: Article }) {
  if (article.status !== "hidden" || !article.moderation) return null;
  const { reason, note, hiddenAt, reviewRequested } = article.moderation;
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
      <p className="flex items-center gap-2 font-bold"><EyeOff className="h-4 w-4" /> Hidden by the editors on {dateLabel(hiddenAt)}: {REASON_LABELS[reason]}</p>
      {note && <p className="mt-1.5 text-[13px] leading-relaxed whitespace-pre-line">{note}</p>}
      <p className="mt-1.5 text-xs text-rose-700">
        {reviewRequested
          ? "You asked for a review: the editors will look at it again."
          : "Only you and the editors can read it. Edit it, then ask the editors to look again."}
      </p>
    </div>
  );
}

/**
 * ARTICLE — one article by its slug, as the reader's page: applauding it (once, not one's own),
 * saving it, reporting it, its comments, and, the author's own, a way to its editor.
 */
export function ArticleReader({ slug, onBack, onEdit, onFilter }: {
  slug: string;
  onBack: () => void;
  onEdit: (uuid: string) => void;
  onFilter: (filters: JournalFilters) => void;
}) {
  const { user } = useUser();
  const { source, canWrite, mode } = useJournal();
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState<{ message: string; missing: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [applauding, setApplauding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    source.bySlug(slug)
      .then((a) => { if (!cancelled) { setArticle(a); setError(null); } })
      .catch((err) => { if (!cancelled) setError({ message: journalErrorText(err, "This article couldn't be loaded."), missing: isArticleNotFound(err) }); });
    return () => { cancelled = true; };
  }, [source, slug, attempt]);

  const back = <BackLink label="Journal" onClick={onBack} />;
  if (error) {
    return (
      <div className="pb-12 space-y-5">
        {back}
        {error.missing
          ? <EmptyState>This article isn&apos;t available: it may have been unpublished or removed.</EmptyState>
          : <ErrorState message={error.message} onRetry={() => setAttempt((n) => n + 1)} />}
      </div>
    );
  }
  if (!article) return <div className="pb-12 space-y-5">{back}<Spinner /></div>;

  const own = !!user && article.author.userUuid === user.uuid;

  const toggleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (article.saved) await journalService.unsave(article.uuid);
      else await journalService.save(article.uuid);
      setArticle({ ...article, saved: !article.saved });
    } catch (err) {
      setSaveError(journalErrorText(err, "That didn't work. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const toggleApplause = async () => {
    setApplauding(true);
    setSaveError(null);
    try {
      if (article.applauded) {
        await journalService.withdrawApplause(article.uuid);
        setArticle({ ...article, applauded: false, applauseCount: Math.max(0, article.applauseCount - 1) });
      } else {
        const { applauseCount } = await journalService.applaud(article.uuid);
        setArticle({ ...article, applauded: true, applauseCount });
      }
    } catch (err) {
      setSaveError(journalErrorText(err, "That didn't work. Try again."));
    } finally {
      setApplauding(false);
    }
  };

  const applause = mode === "api" && (
    <button
      type="button"
      onClick={() => void toggleApplause()}
      // One's own article shows its count, without the button.
      disabled={!canWrite || own || applauding}
      title={own ? "Readers' applause" : article.applauded ? "Take your applause back" : "Applaud this article"}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${article.applauded ? "bg-[#C49A3C]/15 text-[#9a7424]" : "text-slate-500 enabled:hover:bg-slate-100"} disabled:cursor-default`}
    >
      {applauding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HandHeart className="h-3.5 w-3.5" />}
      {article.applauseCount > 0 ? article.applauseCount : own ? "0" : "Applaud"}
    </button>
  );

  const actions = (
    <div className="flex items-center gap-1.5">
      {applause}
      {canWrite && (
        <button
          type="button"
          onClick={() => void toggleSave()}
          disabled={saving}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${article.saved ? "bg-[#C49A3C]/15 text-[#9a7424]" : "text-slate-500 hover:bg-slate-100"}`}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : article.saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
          {article.saved ? "Saved" : "Save"}
        </button>
      )}
      {own ? (
        <button type="button" onClick={() => onEdit(article.uuid)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100">
          <PenLine className="h-3.5 w-3.5" /> Edit
        </button>
      ) : canWrite && (
        <button type="button" onClick={() => setReporting(true)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Report this article">
          <Flag className="h-3.5 w-3.5" /> Report
        </button>
      )}
    </div>
  );

  const { author } = article;
  const authorUuid = author.kind !== "editor" ? author.userUuid : null;
  return (
    <div className="pb-12 space-y-5">
      {back}
      {own && <HiddenNotice article={article} />}
      {saveError && <p className="text-xs font-medium text-rose-600">{saveError}</p>}
      <ArticleDocument
        article={article}
        actions={actions}
        onAuthor={authorUuid ? () => onFilter({ author: { uuid: authorUuid, name: authorName(author) } }) : undefined}
        onInstrument={(i) => onFilter({ instrument: { ticker: i.ticker, isin: i.isin, instrumentId: i.instrumentId } })}
      />
      {mode === "api" && article.status === "published" && (
        <ArticleComments
          article={article}
          canWrite={canWrite}
          ownArticle={own}
          onCount={(delta) => setArticle((a) => (a ? { ...a, commentCount: Math.max(0, a.commentCount + delta) } : a))}
        />
      )}
      {reporting && <ReportDialog target={{ kind: "article", uuid: article.uuid }} onClose={() => setReporting(false)} />}
    </div>
  );
}
