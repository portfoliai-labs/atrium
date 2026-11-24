// components/dashboard/journal/JournalRail.tsx
"use client";

import { useContext } from "react";
import { Bookmark, EyeOff, FileText, PenLine, Search } from "lucide-react";
import { useJournal } from "../../../context/JournalContext";
import { CATEGORIES, CATEGORY_LABELS, QUERY_MAX } from "../../../lib/journal";
import type { ArticleCategory } from "../../../models/Journal";
import type { JournalFilters } from "../JournalSection";
import { FollowingRail } from "./FollowingRail";
import { JournalNavContext } from "./JournalMenu";

/** The search box: the rail's, and over the list on a narrow screen. */
export function JournalSearch({ query, onQuery }: { query: string; onQuery: (query: string) => void }) {
  return (
    <label className="relative block">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      <input
        type="search"
        value={query}
        maxLength={QUERY_MAX}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search articles"
        aria-label="Search articles"
        className="w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm outline-none focus:border-[#C49A3C]"
      />
    </label>
  );
}

/** The categories as chips, "All" first; `wrap` in the rail, one scrolling row over the list. */
export function TopicChips({ category, onCategory, wrap = false }: {
  category?: ArticleCategory;
  onCategory: (category: ArticleCategory | undefined) => void;
  wrap?: boolean;
}) {
  return (
    <div className={wrap ? "flex flex-wrap gap-1.5" : "-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"}>
      {[undefined, ...CATEGORIES].map((c) => {
        const active = category === c;
        return (
          <button
            key={c ?? "all"}
            type="button"
            onClick={() => onCategory(c)}
            aria-pressed={active}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              active ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-500 hover:text-slate-800"
            }`}
          >
            {c ? CATEGORY_LABELS[c] : "All"}
          </button>
        );
      })}
    </div>
  );
}

const railHeading = "text-[11px] font-black uppercase tracking-[0.12em] text-slate-900";

/**
 * JOURNAL RAIL — beside the Journal's list on a wide screen, the way a reading site keeps its
 * tools aside: the search, the reader's pages (a new article, Saved, Your articles, Muted and
 * hidden: the API's only), the categories as topics, and the authors they follow (FollowingRail).
 */
export function JournalRail({ query, onQuery, filters, onFilters, onFollowing }: {
  query: string;
  onQuery: (query: string) => void;
  filters: JournalFilters;
  onFilters: (filters: JournalFilters) => void;
  onFollowing: () => void;
}) {
  const { canWrite } = useJournal();
  const nav = useContext(JournalNavContext);
  const link = "flex items-center gap-2.5 rounded-xl px-2 py-2 text-[13px] font-bold text-slate-600 hover:bg-white hover:text-[#9a7424] transition-colors";

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <JournalSearch query={query} onQuery={onQuery} />
        {canWrite && nav && (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => nav.go({ page: "write" })}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
            >
              <PenLine className="h-3.5 w-3.5" /> New article
            </button>
            <nav aria-label="Your Journal" className="-mx-2 pt-2">
              <button type="button" onClick={() => nav.go({ page: "saved" })} className={`w-full ${link}`}>
                <Bookmark className="h-4 w-4 text-slate-400" /> Saved
              </button>
              <button type="button" onClick={() => nav.go({ page: "mine" })} className={`w-full ${link}`}>
                <FileText className="h-4 w-4 text-slate-400" /> Your articles
              </button>
              <button type="button" onClick={() => nav.go({ page: "moderation" })} className={`w-full ${link}`}>
                <EyeOff className="h-4 w-4 text-slate-400" /> Muted and hidden
              </button>
            </nav>
          </div>
        )}
      </div>

      <section aria-label="Topics" className="space-y-3">
        <h2 className={railHeading}>Topics</h2>
        <TopicChips wrap category={filters.category} onCategory={(category) => onFilters({ ...filters, category })} />
      </section>

      {canWrite && nav && (
        <FollowingRail
          author={filters.author}
          following={!!filters.following}
          onAuthor={(author) => onFilters({ ...filters, following: undefined, author })}
          onFollowing={onFollowing}
          onSeeAll={() => nav.go({ page: "following" })}
        />
      )}
    </div>
  );
}
