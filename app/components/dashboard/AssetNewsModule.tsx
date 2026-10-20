// components/dashboard/AssetNewsModule.tsx
"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { newsService } from "../../services/newsService";
import type { NewsItem } from "../../models/News";
import { MODULE_BODY, Module, ModuleHead } from "./PerformanceSection";

// The days looked back, and the most articles listed.
const NEWS_DAYS = 7;
const NEWS_LIMIT = 6;

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * NEWS — on an asset's page (AssetExplore), what's been written about it over the last week
 * (GET /v1/assets/{listing_id}/news, by the page's listing id): each article's
 * outlet, day and title, opening it on its site. Searched while asked (a few seconds), so it
 * loads on its own, after the page. A fund nobody writes about (most UCITS ETFs) has none, and
 * — like an error — leaves the module out.
 */
export function AssetNewsModule({ listingId, name }: { listingId: string; name: string }) {
  const [state, setState] = useState<{ listingId: string; items: NewsItem[] | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    newsService.getAssetNews(listingId, NEWS_DAYS, NEWS_LIMIT)
      .then((items) => { if (!cancelled) setState({ listingId, items }); })
      .catch(() => { if (!cancelled) setState({ listingId, items: null }); });
    return () => { cancelled = true; };
  }, [listingId]);

  const current = state?.listingId === listingId ? state : undefined;
  if (current && (current.items === null || current.items.length === 0)) return null;
  // undefined while it's being searched.
  const items = current?.items ?? undefined;

  return (
    <Module className="md:col-span-2">
      <ModuleHead title="News" desc={`What's been written about ${name} over the last ${NEWS_DAYS} days.`} />
      <div className={MODULE_BODY}>
        {items === undefined ? (
          <p className="flex items-center gap-2 text-[12.5px] text-[#857e78]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C49A3C]" /> Looking for news…
          </p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {items.map((item, i) => {
              const content = (
                <>
                  {item.imageUrl && (
                    // A provider's image, from anywhere: next/image can't optimise it.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover bg-[#F7F5EF]" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold text-[#857e78]">
                      {[item.source, item.publishedAt ? dateLabel(item.publishedAt) : null].filter(Boolean).join(" · ")}
                    </span>
                    <span className="mt-0.5 block text-[13px] font-bold leading-snug text-[#1c1917] line-clamp-2">{item.title}</span>
                  </span>
                  {item.url && <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#857e78] group-hover:text-[#C49A3C] transition-colors" />}
                </>
              );
              const row = "group flex items-start gap-3 py-3 border-b border-[#EEE9DD]";
              return (
                <li key={item.url ?? `${item.title}-${i}`}>
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer" className={`${row} hover:bg-[#FBFAF6] outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40`}>{content}</a>
                  ) : (
                    <div className={row}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Module>
  );
}
