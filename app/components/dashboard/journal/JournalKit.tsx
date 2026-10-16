// components/dashboard/journal/JournalKit.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Clock, HandHeart, Loader2, MessageCircle } from "lucide-react";
import type { ArticleAuthor, ArticleStatus, ArticleSummary, Page } from "../../../models/Journal";
import { CATEGORY_LABELS, STATUS_LABELS, authorName, dateLabel, journalErrorText } from "../../../lib/journal";
import { serif } from "../../preview/PreviewKit";

/** A Journal page's head: the eyebrow, its title, a line under it, and its actions. */
export function JournalHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">PortfoliAI Journal</p>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900" style={serif}>{title}</h1>
        {subtitle && <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed max-w-xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#C49A3C] transition-colors">
      <ArrowLeft className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

export function AuthorBadge({ author, dark = false }: { author: ArticleAuthor; dark?: boolean }) {
  if (author.kind !== "advisor") return null;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${dark ? "bg-white/10 text-stone-300" : "bg-slate-100 text-slate-500"}`}>
      Advisor
    </span>
  );
}

/** "Performance · Oct 12, 2026 · 5 min read". */
export function Meta({ article, dark = false }: { article: ArticleSummary; dark?: boolean }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold ${dark ? "text-stone-400" : "text-slate-400"}`}>
      {article.category && <span className="font-black uppercase tracking-wider text-[#C49A3C]">{CATEGORY_LABELS[article.category]}</span>}
      {article.publishedAt && <><span>·</span><span>{dateLabel(article.publishedAt)}</span></>}
      <span>·</span>
      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{article.readMinutes} min read</span>
    </p>
  );
}

/** Its readers' applause and comments, when it has some. */
export function Engagement({ article, dark = false }: { article: ArticleSummary; dark?: boolean }) {
  if (article.applauseCount === 0 && article.commentCount === 0) return null;
  const tone = dark ? "text-stone-400" : "text-slate-400";
  return (
    <span className={`flex items-center gap-2.5 text-[11px] font-bold ${tone}`}>
      {article.applauseCount > 0 && (
        <span className={`flex items-center gap-1 ${article.applauded ? "text-[#C49A3C]" : ""}`} title="Applause">
          <HandHeart className="h-3 w-3" />{article.applauseCount}
        </span>
      )}
      {article.commentCount > 0 && (
        <span className="flex items-center gap-1" title="Comments"><MessageCircle className="h-3 w-3" />{article.commentCount}</span>
      )}
    </span>
  );
}

/** Who wrote it, under a card's text, with its applause and comments. */
function CardByline({ article, dark = false }: { article: ArticleSummary; dark?: boolean }) {
  return (
    <p className={`flex items-center gap-2 text-[11px] font-bold ${dark ? "text-stone-300" : "text-slate-600"}`}>
      {authorName(article.author)}
      <AuthorBadge author={article.author} dark={dark} />
      <Engagement article={article} dark={dark} />
    </p>
  );
}

const coverUrl = (article: ArticleSummary) => article.cover?.file?.url ?? null;

/** The newest article: dark and full width, the way into the page. */
export function LeadCard({ article, onOpen }: { article: ArticleSummary; onOpen: () => void }) {
  const cover = coverUrl(article);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full text-left bg-[#1c1917] rounded-3xl shadow-md relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/60 md:flex"
    >
      <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#C49A3C]/10 blur-3xl rounded-full" />
      <div className="relative flex-1 flex items-start justify-between gap-6 p-6 md:p-9">
        <div className="max-w-2xl">
          <Meta article={article} dark />
          <h2 className="text-2xl md:text-3xl font-black text-white mt-3 leading-tight" style={serif}>{article.title}</h2>
          {article.dek && <p className="text-sm md:text-[15px] text-stone-400 mt-3 leading-relaxed">{article.dek}</p>}
          <div className="mt-4"><CardByline article={article} dark /></div>
        </div>
        {!cover && <ArrowUpRight className="h-5 w-5 shrink-0 text-stone-500 group-hover:text-[#C49A3C] transition-colors" />}
      </div>
      {cover && (
        // A signed link to a private bucket: next/image can't optimise it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt={article.cover?.altText ?? ""} className="relative w-full md:w-2/5 h-48 md:h-auto object-cover" />
      )}
    </button>
  );
}

export function ArticleCard({ article, onOpen, footer }: { article: ArticleSummary; onOpen: () => void; footer?: React.ReactNode }) {
  const cover = coverUrl(article);
  return (
    <div className="group h-full bg-white rounded-3xl border border-slate-200 shadow-sm hover:border-[#C49A3C]/50 hover:shadow-md transition-all overflow-hidden flex flex-col">
      <button type="button" onClick={onOpen} className="flex-1 text-left flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C49A3C]/60">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={article.cover?.altText ?? ""} className="w-full h-36 object-cover" />
        )}
        <div className="flex-1 p-5 md:p-6 flex flex-col gap-3">
          <Meta article={article} />
          <h3 className="text-lg font-black text-slate-900 leading-snug" style={serif}>{article.title}</h3>
          {article.dek && <p className="text-[13px] text-slate-500 leading-relaxed">{article.dek}</p>}
          <div className="mt-auto pt-2 flex items-center justify-between gap-2">
            <CardByline article={article} />
            <span className="flex items-center gap-1 text-xs font-bold text-slate-400 group-hover:text-[#C49A3C] transition-colors">
              Read <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </button>
      {footer && <div className="border-t border-slate-100 px-5 py-3 md:px-6">{footer}</div>}
    </div>
  );
}

const STATUS_TONES: Record<ArticleStatus, string> = {
  draft: "bg-slate-100 text-slate-500",
  published: "bg-emerald-50 text-emerald-700",
  hidden: "bg-rose-50 text-rose-700",
};

export function StatusChip({ status }: { status: ArticleStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${STATUS_TONES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-semibold text-slate-500 text-center py-12 px-4">{children}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-12 px-4 space-y-3">
      <p className="text-sm font-semibold text-rose-600">{message}</p>
      {onRetry && <button type="button" onClick={onRetry} className="text-xs font-bold text-slate-500 hover:text-[#C49A3C]">Try again</button>}
    </div>
  );
}

export function Spinner() {
  return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" /></div>;
}

export const PAGE_SIZE = 20;

/**
 * A list read a page at a time: the first page whenever `key` changes, the next on `more()`.
 * `items` is undefined until the first page answers.
 */
export function usePaged<T>(fetchPage: (offset: number) => Promise<Page<T>>, key: string) {
  const [state, setState] = useState<{ key: string; items: T[]; total: number } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchPage(0)
      .then((page) => { if (!cancelled) { setState({ key, items: page.items, total: page.total }); setError(null); } })
      .catch((err) => { if (!cancelled) setError({ key, message: journalErrorText(err, "This list couldn't be loaded.") }); });
    return () => { cancelled = true; };
    // fetchPage is read through `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const current = state?.key === key ? state : null;
  const more = useCallback(async () => {
    if (!current) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(current.items.length);
      setState((s) => (s && s.key === key ? { key, items: [...s.items, ...page.items], total: page.total } : s));
    } catch (err) {
      setError({ key, message: journalErrorText(err, "More couldn't be loaded.") });
    } finally {
      setLoadingMore(false);
    }
  }, [current, fetchPage, key]);

  /** Changes the items in place (an article unsaved, deleted…). */
  const update = useCallback((change: (items: T[]) => T[]) => {
    setState((s) => {
      if (!s) return s;
      const items = change(s.items);
      return { ...s, items, total: s.total - (s.items.length - items.length) };
    });
  }, []);

  return {
    items: current?.items,
    total: current?.total ?? 0,
    hasMore: !!current && current.items.length < current.total,
    error: error?.key === key ? error.message : null,
    loadingMore,
    more,
    update,
    retry: () => setAttempt((n) => n + 1),
  };
}

export function LoadMore({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <div className="flex justify-center pt-2">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-[#C49A3C]/50 hover:text-[#9a7424] transition-colors disabled:opacity-60"
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Load more
      </button>
    </div>
  );
}
