"use client";

import { ArrowLeft } from "lucide-react";
import { useDashboardEntry } from "../../lib/dashboardHistory";
import { ASSET_SECTION } from "../../lib/dashboardNav";
import type { Listing } from "../../models/Listing";
import { AssetExplore } from "./PerformanceSection";

/** The security a page is open on, as the history entry keeps it. */
export type AssetView = Pick<Listing, "listingId" | "instrumentId" | "ticker" | "name">;

/**
 * ASSET SECTION — a security's own page, opened on one of census' listings from the top bar's
 * search: the same page a holding opens on in Insights (AssetExplore), with the user's position
 * in `portfolioUuid` when they hold it there (an investment on a listing is kept under its
 * instrument, which is what the position is asked by). The listing is in the history entry, so
 * back and forward move between the securities looked up.
 */
export function AssetSection({ portfolioUuid }: { portfolioUuid?: string }) {
  const entry = useDashboardEntry();
  if (!entry) return null;
  const view = entry.section === ASSET_SECTION ? (entry.view as AssetView | undefined) : undefined;

  if (!view?.listingId) {
    return <p className="py-16 text-center text-sm font-semibold text-[#78716c]">Search for a security from the top bar.</p>;
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="flex items-center gap-1.5 text-xs font-bold text-[#78716c] hover:text-[#C49A3C] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <AssetExplore key={view.listingId} asset={view.listingId} assetId={view.instrumentId} portfolioUuid={portfolioUuid} revision={0} />
    </div>
  );
}
