// components/dashboard/journal/ArticleList.tsx
"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useJournal } from "../../../context/JournalContext";
import { CATEGORIES, CATEGORY_LABELS, QUERY_MAX } from "../../../lib/journal";
import type { ArticleCategory } from "../../../models/Journal";
import type { JournalFilters } from "../JournalSection";
import { ArticleCard, EmptyState, ErrorState, JournalHeader, LeadCard, LoadMore, PAGE_SIZE, Spinner, usePaged } from "./JournalKit";

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
 * The Journal's articles, newest first (or a search's, by relevance), the reader's language
 * first: the newest on a large card, the rest in a grid. Narrowed by a category, words, an
 * author or an instrument (the last two from an article's page); the narrowing lives in the
 * history entry (`onFilters` replaces it), so coming back from an article finds it.
 */
export function ArticleList({ filters, onFilters, onOpen }: {
  filters: JournalFilters;
  onFilters: (filters: JournalFilters) => void;
  onOpen: (slug: string) => void;
}) {
  const { source, language, mode } = useJournal();
  const [query, setQuery] = useState(filters.q ?? "");

  // Words typed reach the list once the reader pauses.
  useEffect(() => {
    const q = query.trim();
    if (q === (filters.q ?? "")) return;
    const timer = setTimeout(() => onFilters({ ...filters, q: q || undefined }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, filters, onFilters]);

  const { category, q, author, instrument } = filters;
  const list = usePaged(
    (offset) => source.list({
      category,
      q,
      authorUuid: author?.uuid,
      ...(instrument?.instrumentId
        ? { instrumentId: instrument.instrumentId }
        : { ticker: instrument?.ticker, isin: instrument?.isin ?? undefined }),
      preferredLanguage: language,
      limit: PAGE_SIZE,
      offset,
    }),
    JSON.stringify([mode, category, q, author?.uuid, instrument?.instrumentId, instrument?.ticker, instrument?.isin, language]),
  );

  const narrowed = !!(category || q || author || instrument);
  const setCategory = (next: ArticleCategory | undefined) => onFilters({ ...filters, category: next });
  const [lead, ...rest] = list.items ?? [];
  // The newest gets the large card only on the unnarrowed list.
  const grid = narrowed ? list.items ?? [] : rest;

  return (
    <div className="space-y-6 pb-12">
      <JournalHeader
        title="Journal"
        subtitle="Notes on investing by PortfoliAI, advisors and investors: the ideas behind the numbers on your dashboard."
      />

      <div className="space-y-3">
        <label className="relative block max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={query}
            maxLength={QUERY_MAX}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles"
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#C49A3C]"
          />
        </label>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
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
        </div>
        {(author || instrument) && (
          <div className="flex flex-wrap gap-2">
            {author && <FilterChip label={`By ${author.name}`} onClear={() => onFilters({ ...filters, author: undefined })} />}
            {instrument && <FilterChip label={`About ${instrument.ticker}`} onClear={() => onFilters({ ...filters, instrument: undefined })} />}
          </div>
        )}
      </div>

      {list.error ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : !list.items ? (
        <Spinner />
      ) : list.items.length === 0 ? (
        <EmptyState>{narrowed ? "No articles match." : "No articles yet."}</EmptyState>
      ) : (
        <>
          {!narrowed && lead && <LeadCard article={lead} onOpen={() => lead.slug && onOpen(lead.slug)} />}
          {grid.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {grid.map((a) => <ArticleCard key={a.uuid} article={a} onOpen={() => a.slug && onOpen(a.slug)} />)}
            </div>
          )}
          {list.hasMore && <LoadMore onClick={() => void list.more()} loading={list.loadingMore} />}
        </>
      )}
    </div>
  );
}
