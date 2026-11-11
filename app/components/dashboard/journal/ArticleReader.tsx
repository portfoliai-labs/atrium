// components/dashboard/journal/ArticleReader.tsx
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, EyeOff, HandHeart, Info, Loader2, PenLine } from "lucide-react";
import { useUser } from "../../../context/UserContext";
import { journalKey, useJournal, useJournalQuery } from "../../../context/JournalContext";
import { journalService } from "../../../services/journalService";
import type { Article, ArticleImage, ArticleInstrument, ReportTarget } from "../../../models/Journal";
import {
  DISCLOSURE_TITLE, NOT_ADVICE_NOTICE, authorKey, authorName, dateLabel, imageSrc, isArticleNotFound, isNetworkArticle, isNewAuthor,
  journalErrorText,
} from "../../../lib/journal";
import { serif, serifText } from "../../preview/PreviewKit";
import type { JournalFilters } from "../JournalSection";
import { ArticleBody, ArticleFigure, ImagePolicy } from "./ArticleBody";
import { ItemMenu, ReportDialog, reportedMessage, useIsMe, type MenuItem } from "./Moderation";
import { AuthorAvatar, AuthorBadge, EmptyState, ErrorState, FollowButton, Meta, NetworkBadge, NpubChip, Spinner } from "./JournalKit";
import { ArticleComments } from "./ArticleComments";

/** The same image: by its upload, or (a network article's, with none) by its address. */
const sameImage = (a: ArticleImage, b: ArticleImage) => (a.imageUuid ? a.imageUuid === b.imageUuid : imageSrc(a) === imageSrc(b));

/**
 * An article as its readers see it: the byline, cover, body, the instruments it's about, and
 * the notices it comes with (its author's own opinion, not advice, and an advisor's interests in
 * the instruments). `onAuthor` / `onInstrument` narrow the list to them; `actions` sit under the
 * title. The editor's preview shows an article the same way, on a card; the reader's page
 * (`bare`) on the page's background.
 */
export function ArticleDocument({ article, actions, onAuthor, onInstrument, bare = false }: {
  article: Article;
  actions?: React.ReactNode;
  onAuthor?: () => void;
  onInstrument?: (instrument: ArticleInstrument) => void;
  bare?: boolean;
}) {
  const name = authorName(article.author);
  return (
    <article className={bare ? "pt-4 md:pt-6" : "bg-white rounded-3xl border border-slate-200 shadow-sm px-6 py-8 md:px-14 md:py-12"}>
      <div className="max-w-2xl mx-auto">
        <Meta article={article} />
        <h1 className="text-4xl md:text-[46px] font-black text-[#1c1917] mt-3 leading-[1.1] tracking-[-0.015em]" style={serif}>{article.title || "Untitled"}</h1>
        {article.dek && <p className="text-lg md:text-[21px] italic text-[#57534e] mt-4 leading-snug" style={serifText}>{article.dek}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <AuthorAvatar author={article.author} size={24} />
            <span>By</span>
            {onAuthor ? (
              <button type="button" onClick={onAuthor} className="font-bold text-slate-800 hover:text-[#C49A3C]">{name}</button>
            ) : (
              <span className="font-bold text-slate-800">{name}</span>
            )}
            <AuthorBadge author={article.author} />
            {isNetworkArticle(article) && <NetworkBadge />}
            {isNetworkArticle(article) && article.author.npub && <NpubChip npub={article.author.npub} />}
            {article.editedAt && <span className="text-slate-400">· Updated {dateLabel(article.editedAt)}</span>}
          </p>
          {actions}
        </div>
        {/* The cover is the body's first image, now: shown there, not twice. */}
        {article.cover && !article.body.some((b) => b.type === "image" && sameImage(b, article.cover!)) && (
          <ArticleFigure image={article.cover} className="mt-8" />
        )}
        <div className="mt-8 pt-8 border-t border-slate-100">
          <ArticleBody blocks={article.body} instruments={article.instruments} onInstrument={onInstrument} />
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
          <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
          {NOT_ADVICE_NOTICE}
        </p>
      </div>
    </article>
  );
}

/**
 * ARTICLE — one article by its slug, as the reader's page: applauding it (once, not one's own),
 * saving it, its comments, and, the author's own, a way to its editor; anyone else's, the
 * reader's moderation (hide it, mute its author, report either). An author outside the reader's
 * network has their images loaded only when the reader asks. Nothing on
 * it leads back: the browser's back button does.
 */
export function ArticleReader({ slug, onEdit, onFilter }: {
  slug: string;
  onEdit: (uuid: string) => void;
  onFilter: (filters: JournalFilters) => void;
}) {
  const { user } = useUser();
  const { canWrite, mode, changed } = useJournal();
  const queryClient = useQueryClient();
  const read = useJournalQuery(["article", slug], (source) => source.bySlug(slug));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [applauding, setApplauding] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [reporting, setReporting] = useState<{ target: ReportTarget; what: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isMe = useIsMe();

  // The article as read, then as the reader's applause, save and comments left it (no refetch).
  const setArticle = (change: (a: Article) => Article) => {
    queryClient.setQueryData<Article>(journalKey("article", slug), (a) => (a ? change(a) : a));
    changed();
  };

  if (read.isError) {
    return (
      <div className="pb-12 space-y-5">
        {isArticleNotFound(read.error)
          ? <EmptyState>This article isn&apos;t available: it may have been unpublished or removed.</EmptyState>
          : <ErrorState message={journalErrorText(read.error, "This article couldn't be loaded.")} onRetry={() => void read.refetch()} />}
      </div>
    );
  }
  const article = read.data;
  if (!article) return <div className="pb-12"><Spinner /></div>;

  // A network article is nobody's here: read-only, even by its author's key.
  const own = !!user && !isNetworkArticle(article) && article.author.userUuid === user.uuid;
  // Nobody moderates their own: not by their account, nor by their key.
  const mine = own || isMe(article.author);
  const key = authorKey(article.author);

  const moderate = async (action: () => Promise<unknown>, change: (a: Article) => Article, message: string | null) => {
    setSaveError(null);
    try {
      await action();
      setArticle(change);
      setNotice(message);
    } catch (err) {
      setSaveError(journalErrorText(err, "That didn't work. Try again."));
    }
  };
  const menuItems: MenuItem[] = !canWrite || mine ? [] : [
    article.hidden
      ? { label: "Unhide article", onClick: () => void moderate(() => journalService.unhideArticle(article.uuid), (a) => ({ ...a, hidden: false }), null) }
      : { label: "Hide article", onClick: () => void moderate(() => journalService.hideArticle(article.uuid), (a) => ({ ...a, hidden: true }), null) },
    ...(key ? [
      article.author.muted
        ? { label: `Unmute ${authorName(article.author)}`, onClick: () => void moderate(() => journalService.unmute(key), (a) => ({ ...a, author: { ...a.author, muted: false } }), null) }
        : { label: `Mute ${authorName(article.author)}`, onClick: () => void moderate(() => journalService.mute(key), (a) => ({ ...a, author: { ...a.author, muted: true } }), null) },
    ] : []),
    { label: "Report article…", danger: true, onClick: () => setReporting({ target: { articleUuid: article.uuid }, what: "this article" }) },
    ...(key ? [{ label: "Report author…", danger: true, onClick: () => setReporting({ target: { pubkey: key }, what: authorName(article.author) }) }] : []),
  ];

  const toggleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (article.saved) await journalService.unsave(article.uuid);
      else await journalService.save(article.uuid);
      setArticle((a) => ({ ...a, saved: !article.saved }));
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
        setArticle((a) => ({ ...a, applauded: false, applauseCount: Math.max(0, article.applauseCount - 1) }));
      } else {
        const { applauseCount } = await journalService.applaud(article.uuid);
        setArticle((a) => ({ ...a, applauded: true, applauseCount }));
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
      {!own && (
        <FollowButton
          author={article.author}
          onChange={(followed) => setArticle((a) => ({ ...a, author: { ...a.author, followed } }))}
        />
      )}
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
      {own && (
        <button type="button" onClick={() => onEdit(article.uuid)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100">
          <PenLine className="h-3.5 w-3.5" /> Edit
        </button>
      )}
      <ItemMenu items={menuItems} label="Article options" />
    </div>
  );

  const { author } = article;
  const authorUuid = author.userUuid;
  // A local author by their account, a network one by their key.
  const authorFilter = authorUuid
    ? { uuid: authorUuid, name: authorName(author) }
    : author.pubkey ? { pubkey: author.pubkey, name: authorName(author) } : null;
  return (
    <div className="pb-12 space-y-5">
      {saveError && <p className="text-xs font-medium text-rose-600">{saveError}</p>}
      {notice && <p className="text-xs font-medium text-slate-600">{notice}</p>}
      {(article.hidden || author.muted) && !mine && (
        <p className="flex items-center gap-1.5 rounded-2xl bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
          <EyeOff className="h-3.5 w-3.5 shrink-0" />
          {article.hidden && author.muted
            ? `You hid this article and muted ${authorName(author)}: neither shows in your lists.`
            : article.hidden
              ? "You hid this article: it doesn't show in your lists."
              : `You muted ${authorName(author)}: their articles and comments don't show in your lists.`}
          <span className="text-slate-400">Undo it from the menu, or in Settings → Muted and hidden.</span>
        </p>
      )}
      <ImagePolicy.Provider value={{ blocked: isNewAuthor(author) && !showImages, show: () => setShowImages(true) }}>
        <ArticleDocument
          article={article}
          actions={actions}
          bare
          onAuthor={authorFilter ? () => onFilter({ author: authorFilter }) : undefined}
          onInstrument={(i) => onFilter({ instrument: { ticker: i.ticker, isin: i.isin, instrumentId: i.instrumentId } })}
        />
      </ImagePolicy.Provider>
      {reporting && (
        <ReportDialog
          target={reporting.target}
          what={reporting.what}
          onClose={() => setReporting(null)}
          onDone={(report) => {
            const onAuthor = "pubkey" in reporting.target;
            setArticle((a) => (onAuthor ? { ...a, author: { ...a.author, muted: true } } : { ...a, hidden: true }));
            setNotice(reportedMessage(report, onAuthor ? `${reporting.what} is muted for you` : "the article is hidden for you"));
            setReporting(null);
          }}
        />
      )}
      {mode === "api" && article.status === "published" && (
        <ArticleComments
          article={article}
          canWrite={canWrite}
          ownArticle={own}
          onCount={(delta) => setArticle((a) => ({ ...a, commentCount: Math.max(0, a.commentCount + delta) }))}
        />
      )}
    </div>
  );
}
