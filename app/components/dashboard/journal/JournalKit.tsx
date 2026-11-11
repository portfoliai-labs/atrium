// components/dashboard/journal/JournalKit.tsx
"use client";

import { useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowLeft, ArrowUpRight, Check, Clock, Copy, Globe, HandHeart, Loader2, MessageCircle, UserCheck, UserPlus,
} from "lucide-react";
import { journalKey, useJournal } from "../../../context/JournalContext";
import { journalService } from "../../../services/journalService";
import type { ArticleAuthor, ArticleFilters, ArticleStatus, ArticleSummary, NetworkStatus, Page } from "../../../models/Journal";
import {
  CATEGORY_LABELS, DEFAULT_CATEGORY, NETWORK_STATE_LABELS, STATUS_LABELS, authorName, dateLabel, imageSrc, isNetworkArticle,
  journalErrorText, shortNpub,
} from "../../../lib/journal";
import { serif } from "../../preview/PreviewKit";
import { JournalMenu } from "./JournalMenu";

/** A Journal page's head: the eyebrow, its title, a line under it, its actions and the Journal's menu. */
export function JournalHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">PortfoliAI Journal</p>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900" style={serif}>{title}</h1>
        {subtitle && <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed max-w-xl">{subtitle}</p>}
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {actions}
        <JournalMenu />
      </div>
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

/** An article read from the network (another instance, another Nostr app): read-only here. */
export function NetworkBadge({ dark = false }: { dark?: boolean }) {
  return (
    <span
      title="From the network: written on another PortfoliAI instance or Nostr app"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${dark ? "bg-sky-400/15 text-sky-200" : "bg-sky-50 text-sky-700"}`}
    >
      <Globe className="h-2.5 w-2.5" /> Network
    </span>
  );
}

/** A network author's profile picture, when they have one. */
export function AuthorAvatar({ author, size = 20 }: { author: ArticleAuthor; size?: number }) {
  if (!author.pictureUrl) return null;
  return (
    // An address on another server: next/image can't optimise it.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={author.pictureUrl} alt="" width={size} height={size} className="rounded-full object-cover shrink-0 bg-slate-100" style={{ width: size, height: size }} />
  );
}

/** An author's npub, shortened, a click copying it whole. */
export function NpubChip({ npub }: { npub: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(npub);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the npub stays in the title to copy by hand */ }
  };
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); void copy(); }}
      title={copied ? "Copied" : `${npub} (copy)`}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 font-mono text-[10px] text-slate-500 hover:border-[#C49A3C]/50 hover:text-[#9a7424]"
    >
      {shortNpub(npub)}
      {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
    </button>
  );
}

/**
 * Follow or unfollow an author by their public key, as `author.followed` says; `onChange` gets
 * the new state once the API took it. Nothing for an author without a key.
 */
export function FollowButton({ author, onChange }: { author: ArticleAuthor; onChange: (followed: boolean) => void }) {
  const { canWrite, changed } = useJournal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = author.pubkey ?? author.npub;
  if (!key || !canWrite) return null;
  const followed = !!author.followed;
  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (followed) await journalService.unfollow(key);
      else await journalService.follow(key);
      onChange(!followed);
      changed();
    } catch (err) {
      setError(journalErrorText(err, "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        title={followed ? `Stop following ${authorName(author)}` : `Follow ${authorName(author)}`}
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${followed ? "bg-[#C49A3C]/15 text-[#9a7424]" : "text-slate-500 hover:bg-slate-100"}`}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : followed ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
        {followed ? "Following" : "Follow"}
      </button>
      {error && <span className="text-[11px] font-medium text-rose-600">{error}</span>}
    </span>
  );
}

const NETWORK_TONES: Record<NetworkStatus["state"], string> = {
  pending: "text-amber-700",
  published: "text-emerald-700",
  withdrawn: "text-slate-500",
  failed: "text-rose-600",
};

/** Where the author's own article stands on the network, with why the last attempt failed. */
export function NetworkStatusLine({ network }: { network: NetworkStatus | null | undefined }) {
  if (!network) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 text-[11px] font-semibold ${NETWORK_TONES[network.state]}`}>
      {network.lastError ? <AlertTriangle className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
      {NETWORK_STATE_LABELS[network.state]}
      {network.state === "published" && network.publishedVersionAt && <span className="text-slate-400">· {dateLabel(network.publishedVersionAt)}</span>}
      {network.state === "pending" && network.lastError && <span className="text-slate-400">· will retry</span>}
      {network.lastError && <span className="font-normal text-slate-500" title={network.lastError}>· {network.lastError}</span>}
    </span>
  );
}

/** "Performance · Oct 12, 2026 · 5 min read". */
export function Meta({ article, dark = false }: { article: ArticleSummary; dark?: boolean }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold ${dark ? "text-stone-400" : "text-slate-400"}`}>
      {article.category && article.category !== DEFAULT_CATEGORY && <span className="font-black uppercase tracking-wider text-[#C49A3C]">{CATEGORY_LABELS[article.category]}</span>}
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
      <AuthorAvatar author={article.author} size={18} />
      {authorName(article.author)}
      <AuthorBadge author={article.author} dark={dark} />
      {isNetworkArticle(article) && <NetworkBadge dark={dark} />}
      <Engagement article={article} dark={dark} />
    </p>
  );
}

const coverUrl = (article: ArticleSummary) => imageSrc(article.cover);

/** The list's lead (today's most applauded, or the newest): dark and full width, the way into the page; `badge` says why it leads. */
export function LeadCard({ article, onOpen, badge }: { article: ArticleSummary; onOpen: () => void; badge?: React.ReactNode }) {
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
          {badge && (
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[#C49A3C]/15 px-3 py-1 text-xs font-bold text-[#E2C27A]">{badge}</span>
          )}
          <Meta article={article} dark />
          <h2 className="text-2xl md:text-3xl font-black text-white mt-3 leading-tight" style={serif}>{article.title}</h2>
          {article.dek && <p className="text-sm md:text-[15px] text-stone-400 mt-3 leading-relaxed">{article.dek}</p>}
          <div className="mt-4"><CardByline article={article} dark /></div>
        </div>
        {!cover && <ArrowUpRight className="h-5 w-5 shrink-0 text-stone-500 group-hover:text-[#C49A3C] transition-colors" />}
      </div>
      {cover && (
        // A signed link to a private bucket (a network article's: another server): next/image can't optimise it.
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
  draft: "bg-[#F1EADB] text-[#8A6A28]",
  published: "bg-emerald-50 text-emerald-700",
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
 * A list read a page at a time, through the query cache under `journalKey(...key)`: the first page
 * when it's first shown, the next on `more()`. `items` is undefined until the first page answers.
 */
export function usePaged<T>(key: unknown[], fetchPage: (offset: number) => Promise<Page<T>>, enabled = true) {
  const { mode } = useJournal();
  const queryClient = useQueryClient();
  const queryKey = journalKey(...key);
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 0,
    // The next page starts after every item read so far.
    getNextPageParam: (last, pages) => {
      const read = pages.reduce((n, p) => n + p.items.length, 0);
      return read < last.total ? read : undefined;
    },
    enabled: mode !== "loading" && enabled,
  });

  /** Changes the items in place (an article unsaved, deleted…), in the cache. */
  const update = (change: (items: T[]) => T[]) => queryClient.setQueryData<InfiniteData<Page<T>, number>>(queryKey, (data) => {
    if (!data) return data;
    const pages = data.pages.map((p) => ({ ...p, items: change(p.items) }));
    const removed = data.pages.reduce((n, p, i) => n + p.items.length - pages[i].items.length, 0);
    return { ...data, pages: pages.map((p) => ({ ...p, total: p.total - removed })) };
  });

  const pages = query.data?.pages;
  return {
    items: pages?.flatMap((p) => p.items),
    total: pages?.[pages.length - 1].total ?? 0,
    hasMore: query.hasNextPage,
    error: query.isError
      ? journalErrorText(query.error, query.isFetchNextPageError ? "More couldn't be loaded." : "This list couldn't be loaded.")
      : null,
    loadingMore: query.isFetchingNextPage,
    more: () => query.fetchNextPage(),
    update,
    retry: () => void query.refetch(),
  };
}

/**
 * The Journal's articles narrowed by `filters` (without limit or offset), a page at a time: the
 * Journal's list and an asset's "From the Journal" read the same pages.
 */
export function useArticles(filters: ArticleFilters, enabled = true) {
  const { source } = useJournal();
  return usePaged(["articles", filters], (offset) => source.list({ ...filters, limit: PAGE_SIZE, offset }), enabled);
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
