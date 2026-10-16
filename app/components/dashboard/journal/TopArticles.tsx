// components/dashboard/journal/TopArticles.tsx
"use client";

import { useEffect, useState } from "react";
import { HandHeart } from "lucide-react";
import { journalService } from "../../../services/journalService";
import type { ArticleLanguage, ArticleSummary } from "../../../models/Journal";
import { authorName } from "../../../lib/journal";
import { serif } from "../../preview/PreviewKit";
import { Engagement, Meta } from "./JournalKit";

// How many the carousel shows.
const TOP_COUNT = 6;

/**
 * ARTICLES OF THE DAY — the most applauded in the last 24 hours (ianus' `order=top_day`), as a
 * row the reader scrolls sideways. The ranking is live and puts the newest after the applauded
 * ones: the row keeps the applauded only, and isn't shown when none is.
 */
export function TopArticles({ language, onOpen }: { language: ArticleLanguage; onOpen: (slug: string) => void }) {
  const [items, setItems] = useState<ArticleSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    journalService.list({ order: "top_day", preferredLanguage: language, limit: TOP_COUNT })
      .then((page) => { if (!cancelled) setItems(page.items.filter((a) => a.applauseCount > 0)); })
      // The carousel is an extra: the list under it says what went wrong.
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [language]);

  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
        <HandHeart className="h-3.5 w-3.5 text-[#C49A3C]" /> Today&apos;s most applauded
      </h2>
      <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 snap-x snap-mandatory">
        {items.map((a, index) => (
          <button
            key={a.uuid}
            type="button"
            onClick={() => a.slug && onOpen(a.slug)}
            className="group snap-start shrink-0 w-72 text-left bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-[#C49A3C]/50 hover:shadow-md transition-all p-5 flex flex-col gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/60"
          >
            <span className="text-2xl font-black text-[#C49A3C]/40 leading-none" style={serif}>{index + 1}</span>
            <Meta article={a} />
            <h3 className="text-base font-black text-slate-900 leading-snug line-clamp-3" style={serif}>{a.title}</h3>
            <div className="mt-auto pt-1 flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600">
              <span className="truncate">{authorName(a.author)}</span>
              <Engagement article={a} />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
