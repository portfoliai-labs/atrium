// components/dashboard/TrackerOrderButtons.tsx
"use client";

import { ASSET_SECTION, useOpenDashboardPage } from "../../lib/dashboardNav";
import type { Listing } from "../../models/Listing";
import type { OrderSide } from "../../models/Trading";
import type { AssetView } from "./AssetSection";
import { useOrderAccounts } from "./OrderPage";

/**
 * Buy and Sell on a token of the asset's (a tracker row of its Tokenized versions), when the user
 * has an on-chain address to place the order on: each opens the order page under the asset's.
 */
export function TrackerOrderButtons({ tracker, asset, referencePrice, referenceCurrency }: {
  tracker: Listing;
  asset: Omit<AssetView, "order">;
  referencePrice: number | null;
  referenceCurrency: string;
}) {
  const accounts = useOrderAccounts();
  const openPage = useOpenDashboardPage();
  if (accounts.length === 0 || !openPage) return null;
  const open = (side: OrderSide) => openPage(ASSET_SECTION, {
    ...asset,
    order: {
      listingId: tracker.listingId, ticker: tracker.ticker, issuer: tracker.tracking?.issuer ?? null, side,
      referencePrice, referenceCurrency,
    },
  } satisfies AssetView);
  const button = "px-2.5 py-1 rounded-md text-[11px] font-bold border border-slate-200 text-slate-700 hover:border-[#C49A3C]/60 transition-colors";
  return (
    <span className="flex gap-1.5 shrink-0">
      <button type="button" onClick={() => open("buy")} className={button}>Buy</button>
      <button type="button" onClick={() => open("sell")} className={button}>Sell</button>
    </span>
  );
}
