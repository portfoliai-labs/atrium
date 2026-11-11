// components/dashboard/journal/ArticleList.tsx
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Globe, HandHeart, Search, UserCheck, Users, X } from "lucide-react";
import { useJournal, useJournalRead } from "../../../context/JournalContext";
import { journalService } from "../../../services/journalService";
import {
  ALL_NETWORK_NOTICE, CATEGORIES, CATEGORY_LABELS, QUERY_MAX, readFeedScope, serverFeedScope, subscribeFeedScope, writeFeedScope,
  type FeedScope,
} from "../../../lib/journal";
import type { ArticleCategory, ArticleLanguage, ArticleScope } from "../../../models/Journal";
import type { JournalFilters } from "../JournalSection";
import { ArticleCard, EmptyState, ErrorState, JournalHeader, LeadCard, LoadMore, Spinner, useArticles } from "./JournalKit";
import { useArticleModeration } from "./Moderation";

const SEARCH_DEBOUNCE_MS = 350;

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C49A3C]/15 text-[#9a7424] pl-3 pr-1.5 py-1 text-xs font-bold">
      {label}
      <button type="button" onClick={onClear} className="p-0.5 rounded-full hover:bg-[#C49A3C]/20" aria-label={`Clear ${label}`}>
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/** Which feed: the reader's network (the default) or all of it, as they last left it on this browser. */
function FeedSwitch({ feed, onChange }: { feed: FeedScope; onChange: (feed: FeedScope) => void }) {
  const options: { id: FeedScope; label: string; icon: typeof Users }[] = [
    { id: "trusted", label: "Your network", icon: Users },
    { id: "all", label: "All the network", icon: Globe },
  ];
  return (
    <div role="tablist" aria-label="Feed" className="inline-flex gap-1 p-1 bg-white rounded-full border border-slate-200">
      {options.map((o) => {
        const active = feed === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${active ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}
          >
            <o.icon className="h-3.5 w-3.5" /> {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The day's most applauded article (ianus' `order=top_day`): the ranking puts the newest after the
 * applauded ones, so one without applause is none. `undefined` until it answers; `null` for none,
 * or where it isn't asked (`enabled` false).
 */
function useTopArticle(enabled: boolean, language: ArticleLanguage, scope: ArticleScope | undefined) {
  const top = useJournalRead(
    ["top", language, scope ?? "all"],
    () => journalService.list({ order: "top_day", preferredLanguage: language, scope, limit: 1 })
      .then((page) => page.items.find((a) => a.applauseCount > 0) ?? null),
    enabled,
  );
  if (!enabled) return null;
  // An extra: without it (it couldn't be read: null) the newest leads.
  return top;
}

/**
 * The Journal's articles, newest first (or a search's, by relevance), the reader's language
 * first: on the unnarrowed list the day's most applauded (the API's only) leads on the large
 * dark card, or the newest when none was applauded today; the rest in a grid. Narrowed by a category, words, an
 * author or an instrument (the last two from an article's page); the narrowing lives in the
 * history entry (`onFilters` replaces it), so coming back from an article finds it. With the
 * API, the feed is the reader's network (this instance's authors and the network's in their web
 * of trust) or, as they choose, all of it; one author's articles and Following are never narrowed
 * by it. Each card has the reader's moderation (hide, mute, report), what it takes off the list
 * leaving at once.
 */
export function ArticleList({ filters, onFilters, onOpen }: {
  filters: JournalFilters;
  onFilters: (filters: JournalFilters) => void;
  onOpen: (slug: string) => void;
}) {
  const { language, mode, canWrite } = useJournal();
  const [query, setQuery] = useState(filters.q ?? "");

  // Words typed reach the list once the reader pauses.
  useEffect(() => {
    const q = query.trim();
    if (q === (filters.q ?? "")) return;
    const timer = setTimeout(() => onFilters({ ...filters, q: q || undefined }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, filters, onFilters]);

  const { category, q, author, instrument, following } = filters;
  const feed = useSyncExternalStore(subscribeFeedScope, readFeedScope, serverFeedScope);
  // One author's articles, or the followed ones', are theirs whoever they are.
  const feedApplies = canWrite && !author && !following;
  const scope: ArticleScope | undefined = feedApplies && feed === "trusted" ? "trusted" : undefined;
  const moderation = useArticleModeration();
  const list = useArticles({
    scope,
    category,
    q,
    authorUuid: author?.uuid,
    authorPubkey: author?.uuid ? undefined : author?.pubkey,
    followedOnly: following || undefined,
    ...(instrument?.instrumentId
      ? { instrumentId: instrument.instrumentId }
      : { ticker: instrument?.ticker, isin: instrument?.isin ?? undefined }),
    preferredLanguage: language,
  });

  const narrowed = !!(category || q || author || instrument || following);
  const setCategory = (next: ArticleCategory | undefined) => onFilters({ ...filters, category: next });
  const top = useTopArticle(!narrowed && mode === "api", language, scope);
  const items = list.items?.filter(moderation.visible);
  const shownTop = top && moderation.visible(top) ? top : null;
  // The large card only on the unnarrowed list: today's most applauded, or the newest.
  const lead = narrowed ? undefined : shownTop ?? items?.[0];
  const grid = (items ?? []).filter((a) => a.uuid !== lead?.uuid);

  return (
    <div className="space-y-6 pb-12">
      <JournalHeader
        title="Journal"
        subtitle="Notes on investing by advisors and investors: the ideas behind the numbers on your dashboard."
      />

      <div className="space-y-3">
        {feedApplies && (
          <div className="flex flex-wrap items-center gap-3">
            <FeedSwitch feed={feed} onChange={writeFeedScope} />
            {feed === "all" && <p className="text-xs text-slate-500">{ALL_NETWORK_NOTICE}</p>}
          </div>
        )}
        {/* The categories and the search on one row; the search above them on a phone. */}
        <div className="flex flex-col-reverse md:flex-row md:items-center gap-3 md:gap-6">
          <div className="min-w-0 flex-1 -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[undefined, ...CATEGORIES].map((c) => {
              const active = category === c;
              return (
                <button
                  key={c ?? "all"}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    active ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {c ? CATEGORY_LABELS[c] : "All"}
                </button>
              );
            })}
            {canWrite && (
              <>
                <span className="shrink-0 w-px my-1 bg-slate-200" />
                <button
                  type="button"
                  onClick={() => onFilters({ ...filters, following: following ? undefined : true })}
                  title="Only the authors you follow"
                  className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    following ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <UserCheck className="h-3.5 w-3.5" /> Following
                </button>
              </>
            )}
          </div>
          <label className="relative block shrink-0 md:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={query}
              maxLength={QUERY_MAX}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles"
              className="w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm outline-none focus:border-[#C49A3C]"
            />
          </label>
        </div>
        {(author || instrument) && (
          <div className="flex flex-wrap gap-2">
            {author && <FilterChip label={`By ${author.name}`} onClear={() => onFilters({ ...filters, author: undefined })} />}
            {instrument && <FilterChip label={`About ${instrument.ticker}`} onClear={() => onFilters({ ...filters, instrument: undefined })} />}
          </div>
        )}
      </div>

      {moderation.bar}
      {moderation.dialog}

      {list.error ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : !items || top === undefined ? (
        <Spinner />
      ) : items.length === 0 && !list.hasMore ? (
        <EmptyState>
          {following && !category && !q && !author && !instrument
            ? "No articles from the authors you follow yet: follow an author from one of their articles."
            : narrowed ? "No articles match." : scope === "trusted" ? (
              <span className="flex flex-col items-center gap-3">
                <span>Nothing from your network yet: follow authors from their articles, and their articles (and those of whom they follow) show here.</span>
                <button type="button" onClick={() => writeFeedScope("all")} className="text-xs font-bold text-[#9a7424] hover:text-[#C49A3C]">
                  Open All the network
                </button>
              </span>
            ) : "No articles yet."}
        </EmptyState>
      ) : (
        <>
          {lead && (
            <LeadCard
              article={lead}
              onOpen={() => lead.slug && onOpen(lead.slug)}
              badge={lead === shownTop ? <><HandHeart className="h-3.5 w-3.5" /> Most applauded today</> : undefined}
              menu={moderation.menuFor(lead, true)}
            />
          )}
          {grid.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {grid.map((a) => (
                <ArticleCard key={a.uuid} article={a} onOpen={() => a.slug && onOpen(a.slug)} menu={moderation.menuFor(a)} />
              ))}
            </div>
          )}
          {list.hasMore && <LoadMore onClick={() => void list.more()} loading={list.loadingMore} />}
        </>
      )}
    </div>
  );
}
