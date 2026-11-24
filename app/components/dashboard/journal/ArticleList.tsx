// components/dashboard/journal/ArticleList.tsx
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Globe, HandHeart, UserCheck, Users, X } from "lucide-react";
import { useJournal, useJournalRead } from "../../../context/JournalContext";
import { journalService } from "../../../services/journalService";
import {
  readFeedScope, serverFeedScope, subscribeFeedScope, writeFeedScope,
  type FeedScope,
} from "../../../lib/journal";
import type { ArticleCategory, ArticleLanguage, ArticleScope } from "../../../models/Journal";
import type { JournalFilters } from "../JournalSection";
import { ArticleRow, EmptyState, ErrorState, JournalHeader, LeadCard, LoadMore, Spinner, useArticles } from "./JournalKit";
import { JournalRail, JournalSearch, TopicChips } from "./JournalRail";
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

/**
 * Which feed: the reader's network (the default) or all of it, as they last left it on this
 * browser. The strategies catalog's too (`label`).
 */
export function FeedSwitch({ feed, onChange, label = "Feed" }: { feed: FeedScope; onChange: (feed: FeedScope) => void; label?: string }) {
  const options: { id: FeedScope; label: string; icon: typeof Users }[] = [
    { id: "trusted", label: "Your network", icon: Users },
    { id: "all", label: "All the network", icon: Globe },
  ];
  return (
    <div role="tablist" aria-label={label} className="inline-flex gap-1 p-1 bg-white rounded-full border border-slate-200">
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

// The Journal's feeds, as its tabs name them.
const FEED_TABS: { id: FeedScope; label: string }[] = [
  { id: "trusted", label: "Your network" },
  { id: "all", label: "Discover" },
];

/**
 * The Journal's two feeds as tabs over the list, underlined: Your network (whom the reader follows
 * and whom they follow) and Discover (all the network). None is marked while the list is one
 * author's or the followed ones' (`feed` null), which no feed narrows.
 */
function FeedTabs({ feed, onChange }: { feed: FeedScope | null; onChange: (feed: FeedScope) => void }) {
  return (
    <div role="tablist" aria-label="Feed" className="flex gap-7 border-b border-slate-200">
      {FEED_TABS.map((t) => {
        const active = feed === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`-mb-px border-b-2 pb-3 text-sm font-bold transition-colors ${
              active ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            {t.label}
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
 * dark card, or the newest when none was applauded today; the rest one under the other, as rows. Narrowed by a category, words, an
 * author or an instrument (the last two from an article's page); the narrowing lives in the
 * history entry (`onFilters` replaces it), so coming back from an article finds it. With the
 * API, the feed is the reader's network (this instance's authors and the network's in their web
 * of trust) or, as they choose, all of it (Discover), on two tabs; one author's articles and
 * Following are never narrowed by it, and a tab chosen leaves them. Beside the list (on a wide
 * screen), the rail (JournalRail): the search, the reader's pages, the categories and the authors
 * they follow; on a narrow one, the search and the categories over the list. Each card has the reader's moderation (hide, mute, report), what it takes off the list
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
  const rows = (items ?? []).filter((a) => a.uuid !== lead?.uuid);
  // A tab chosen is its feed, out of one author's articles or the followed ones'.
  const chooseFeed = (next: FeedScope) => {
    writeFeedScope(next);
    if (author || following) onFilters({ ...filters, author: undefined, following: undefined });
  };
  const toggleFollowing = () => onFilters({ ...filters, author: undefined, following: following ? undefined : true });

  return (
    <div className="space-y-6 pb-12">
      <JournalHeader
        title="Journal"
        subtitle="Notes on investing by advisors and investors: the ideas behind the numbers on your dashboard."
        // The rail has the Journal's pages on a wide screen.
        menuNarrowOnly
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_300px] gap-10 xl:gap-14 items-start">
        <div className="min-w-0 space-y-6">
          <div className="space-y-4">
            {canWrite && (
              <FeedTabs feed={feedApplies ? feed : null} onChange={chooseFeed} />
            )}
            {/* Without the rail (a narrow screen): the search and the categories, the followed authors' articles too. */}
            <div className="lg:hidden space-y-3">
              <JournalSearch query={query} onQuery={setQuery} />
              <div className="flex items-center gap-1.5">
                <div className="min-w-0 flex-1"><TopicChips category={category} onCategory={setCategory} /></div>
                {canWrite && (
                  <button
                    type="button"
                    onClick={toggleFollowing}
                    title="Only the authors you follow"
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                      following ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <UserCheck className="h-3.5 w-3.5" /> Following
                  </button>
                )}
              </div>
            </div>
            {(author || instrument || following) && (
              <div className="flex flex-wrap gap-2">
                {following && <FilterChip label="From whom you follow" onClear={() => onFilters({ ...filters, following: undefined })} />}
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
                      Open Discover
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
              {rows.length > 0 && (
                <div className="divide-y divide-slate-200">
                  {rows.map((a) => (
                    <ArticleRow key={a.uuid} article={a} onOpen={() => a.slug && onOpen(a.slug)} menu={moderation.menuFor(a)} />
                  ))}
                </div>
              )}
              {list.hasMore && <LoadMore onClick={() => void list.more()} loading={list.loadingMore} />}
            </>
          )}
        </div>

        <aside className="hidden lg:block sticky top-24 border-l border-slate-200 pl-8 xl:pl-10 py-1">
          <JournalRail query={query} onQuery={setQuery} filters={filters} onFilters={onFilters} onFollowing={toggleFollowing} />
        </aside>
      </div>
    </div>
  );
}
