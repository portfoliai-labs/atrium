// components/dashboard/wallets/WalletsSection.tsx
"use client";

import { useSectionView } from "../../../lib/dashboardHistory";
import { WALLETS_SECTION } from "../../../lib/dashboardNav";
import { ALL_WALLETS, accountOfView, accountView } from "../../../lib/wallets";
import { AccountNode } from "./AccountNode";
import { WALLET_PAGE_LABELS, WalletNode, type WalletPage } from "./WalletNode";

// A wallet, or every wallet together (ALL_WALLETS), on one of its pages; or an account's page
// (lib/wallets' accountView), its only one being its overview.
export type WalletsView = { id: string; page: WalletPage };

// A link into a page from outside the dashboard: `/dashboard?section=wallets&account=<uuid>` for
// an account's (where the bank sends the user back to), `&wallet=<uuid>` for a wallet's, with
// `&walletsPage=` for one of its pages. Read when the history entry has no view yet.
const WALLETS_PAGE_PARAM = "walletsPage";
const WALLET_PARAM = "wallet";
// Its links are made by walletPageUrl and accountPageUrl (WalletBanks).
const ACCOUNT_PARAM = "account";

/** The page a history entry's view is on, well formed (one from Wealth's, `kind` and all, too). */
function walletsViewOf(raw: unknown): WalletsView {
  const params = raw === undefined && typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const account = params?.get(ACCOUNT_PARAM);
  const linked = { id: account ? accountView(account) : params?.get(WALLET_PARAM) ?? undefined, page: params?.get(WALLETS_PAGE_PARAM) ?? undefined };
  const v = (typeof raw === "object" && raw !== null ? raw : linked) as { id?: unknown; page?: unknown };
  const page = (v.page as string) in WALLET_PAGE_LABELS ? (v.page as WalletPage) : "insights";
  return { id: typeof v.id === "string" ? v.id : ALL_WALLETS, page };
}

/**
 * WALLETS SECTION — Cash, accounts and cards (a demo account's are sample data): every account
 * and wallet together, each account's page (AccountNode: a bank's or an address', where its
 * wallets come from) and each wallet's pages (WalletNode), each a browser history entry (see
 * lib/dashboardHistory). It opens on all of them, where the first one is added. An id that is no
 * wallet's (one gone) opens them all.
 */
export function WalletsSection() {
  const [view, open] = useSectionView(WALLETS_SECTION, walletsViewOf);
  const account = accountOfView(view.id);
  if (account) return <AccountNode key={view.id} accountUuid={account} rootTrail={[]} onOpen={(id, page) => open({ id, page })} />;
  return <WalletNode key={view.id} id={view.id} page={view.page} rootTrail={[]} onOpen={(id, page) => open({ id, page })} />;
}
