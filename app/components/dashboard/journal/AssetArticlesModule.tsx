// components/dashboard/journal/AssetArticlesModule.tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useJournal } from "../../../context/JournalContext";
import { JOURNAL_SECTION, useOpenDashboardPage } from "../../../lib/dashboardNav";
import { authorName } from "../../../lib/journal";
import type { ArticleSummary } from "../../../models/Journal";
import type { JournalView } from "../JournalSection";
import { serif } from "../../preview/PreviewKit";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { Meta } from "./JournalKit";

// How many the module lists; the rest are on the Journal, narrowed to the asset.
const SHOWN = 3;

/**
 * FROM THE JOURNAL — on an asset's page (AssetExplore), the Journal's newest articles tagged with
 * it: by its instrument (across its listings), or by its ticker and ISIN for an asset without a
 * listing. Each opens on the Journal, and "All" the Journal narrowed to the asset. The API's
 * only (the written articles name no instrument), and not shown when none is tagged with it.
 */
export function AssetArticlesModule({ instrumentId, ticker, isin }: { instrumentId: string | null; ticker: string; isin: string | null }) {
  const { mode, source, language } = useJournal();
  const openPage = useOpenDashboardPage();
  const [page, setPage] = useState<{ items: ArticleSummary[]; total: number } | null>(null);

  useEffect(() => {
    if (mode !== "api") return;
    let cancelled = false;
    source.list({
      ...(instrumentId ? { instrumentId } : { ticker, isin: isin ?? undefined }),
      preferredLanguage: language,
      limit: SHOWN,
    })
      .then((p) => { if (!cancelled) setPage({ items: p.items, total: p.total }); })
      // An extra on the asset's page: without it the page is whole.
      .catch(() => { if (!cancelled) setPage(null); });
    return () => { cancelled = true; };
  }, [mode, source, language, instrumentId, ticker, isin]);

  if (mode !== "api" || !page || page.items.length === 0) return null;
  const open = (view: JournalView) => openPage?.(JOURNAL_SECTION, view);
  const all: JournalView = { page: "journal", filters: { instrument: { ticker, isin, instrumentId } } };

  return (
    <Module className="md:col-span-2">
      <ModuleHead
        title="From the Journal"
        desc={`Articles tagged with ${ticker}.`}
        right={openPage && page.total > page.items.length ? (
          <button type="button" onClick={() => open(all)} className="text-xs font-bold text-[#78716c] hover:text-[#C49A3C] transition-colors">
            All {page.total}
          </button>
        ) : undefined}
      />
      <div className={`${MODULE_BODY} grid grid-cols-1 md:grid-cols-3 gap-3`}>
        {page.items.map((a) => (
          <button
            key={a.uuid}
            type="button"
            disabled={!openPage || !a.slug}
            onClick={() => a.slug && open({ page: "article", slug: a.slug })}
            className="group text-left rounded-2xl border border-[#EEE9DD] p-4 flex flex-col gap-2 hover:border-[#C49A3C]/60 hover:bg-[#FBFAF6] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40"
          >
            <Meta article={a} />
            <span className="text-[15px] font-bold text-[#1c1917] leading-snug line-clamp-3" style={serif}>{a.title}</span>
            <span className="mt-auto pt-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-[#78716c]">
              <span className="truncate">{authorName(a.author)}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 group-hover:text-[#C49A3C] transition-colors" />
            </span>
          </button>
        ))}
      </div>
    </Module>
  );
}
