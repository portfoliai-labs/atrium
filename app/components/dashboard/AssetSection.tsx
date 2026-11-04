"use client";

import { useDashboardEntry } from "../../lib/dashboardHistory";
import { ASSET_SECTION, useOpenDashboardPage } from "../../lib/dashboardNav";
import type { Listing } from "../../models/Listing";
import { OrderPage, type OrderTarget } from "./OrderPage";
import { AssetExplore } from "./PerformanceSection";

/** The security a page is open on, as the history entry keeps it; with `order`, the order page
 * of one of its tokens (a tracker), over it, and the reference price it compares the venue's to. */
export type AssetView = Pick<Listing, "listingId" | "instrumentId" | "ticker" | "name"> & {
  order?: OrderTarget & { referencePrice: number | null; referenceCurrency: string | null };
};

/**
 * ASSET SECTION — a security's own page, opened on one of census' listings from the top bar's
 * search: the same page a holding opens on in Insights (AssetExplore), with the user's position
 * in `portfolioUuid` when they hold it there (an investment on a listing is kept under its
 * instrument, which is what the position is asked by). The listing is in the history entry, so
 * back and forward move between the securities looked up. A token's order page opens under it.
 */
export function AssetSection({ portfolioUuid }: { portfolioUuid?: string }) {
  const entry = useDashboardEntry();
  const openPage = useOpenDashboardPage();
  if (!entry) return null;
  const view = entry.section === ASSET_SECTION ? (entry.view as AssetView | undefined) : undefined;

  if (!view?.listingId) {
    return <p className="py-16 text-center text-sm font-semibold text-[#78716c]">Search for a security from the top bar.</p>;
  }

  if (view.order) {
    const { order, ...asset } = view;
    return (
      <OrderPage
        key={`${order.listingId}:${order.side}`}
        target={order}
        assetName={asset.name}
        referencePrice={order.referencePrice}
        referenceCurrency={order.referenceCurrency}
        onBack={() => openPage?.(ASSET_SECTION, asset)}
      />
    );
  }

  return <AssetExplore key={view.listingId} listingId={view.listingId} assetId={view.instrumentId} portfolioUuid={portfolioUuid} />;
}
