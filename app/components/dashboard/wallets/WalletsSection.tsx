// components/dashboard/wallets/WalletsSection.tsx
"use client";

import { useSectionView } from "../../../lib/dashboardHistory";
import { WALLETS_SECTION } from "../../../lib/dashboardNav";
import { ALL_WALLETS } from "../../../lib/wallets";
import { WALLET_PAGE_LABELS, WalletNode, type WalletPage } from "./WalletNode";

// A wallet, or every wallet together (ALL_WALLETS), on one of its pages.
export type WalletsView = { id: string; page: WalletPage };

// A link into All wallets' page from outside the dashboard (`/dashboard?section=wallets&walletsPage=banks`,
// where the bank sends the user back to): read when the history entry has no view yet.
const WALLETS_PAGE_PARAM = "walletsPage";

/** The page a history entry's view is on, well formed (one from Wealth's, `kind` and all, too). */
function walletsViewOf(raw: unknown): WalletsView {
  const linked = raw === undefined && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get(WALLETS_PAGE_PARAM) : null;
  const v = (typeof raw === "object" && raw !== null ? raw : linked ? { page: linked } : {}) as { id?: unknown; page?: unknown };
  const page = (v.page as string) in WALLET_PAGE_LABELS ? (v.page as WalletPage) : "insights";
  return { id: typeof v.id === "string" ? v.id : ALL_WALLETS, page };
}

/**
 * WALLETS SECTION — the investor's wallets (a demo account's are sample data): All wallets, and
 * each wallet's pages (WalletNode), each a browser history entry (see lib/dashboardHistory). It
 * opens on All wallets, where the first one is added.
 */
export function WalletsSection() {
  const [view, open] = useSectionView(WALLETS_SECTION, walletsViewOf);
  return <WalletNode key={view.id} id={view.id} page={view.page} rootTrail={[]} onOpen={(id, page) => open({ id, page })} />;
}
