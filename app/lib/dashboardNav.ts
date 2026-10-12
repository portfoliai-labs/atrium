// lib/dashboardNav.ts
//
// DASHBOARD NAVIGATION — opening a section on one of its own pages from elsewhere in the dashboard
// (the Dashboard's cards, Plan's Strategy opening a backtest, the Sidebar's rows under a section).
// The page is recorded in the history entry (see lib/dashboardHistory), which the section reads
// when it mounts. One entry for the whole move: the one `onNavigate` may have just pushed for the
// section is replaced by the page.

import { pushDashboardEntry } from "./dashboardHistory";
import type { WealthView, PortfolioPage } from "../components/dashboard/WealthSection";
import type { PlanPage } from "../components/dashboard/PlanSection";
import type { WalletPage } from "../components/dashboard/wallets/WalletNode";

// The dashboard's section ids (see the dashboard page). Wealth keeps "performance", the id it had
// as Insights, then Manage, so old links and history entries still land on it.
export const WEALTH_SECTION = "performance";
export const PLAN_SECTION = "plan";
// An advisor's clients: the list, and each client's Wealth (see ClientsSection).
export const CLIENTS_SECTION = "clients";
// The strategies catalog's section before it was Plan's, under Strategy: old links land there.
// The Journal: a demo account's preview.
export const EXPLORE_SECTION = "explore";
export const JOURNAL_SECTION = "journal";

type Navigate = (section: string) => void;

/** Opens `section` on `view`, one history entry for the move. */
export function openSectionView(onNavigate: Navigate, section: string, view: unknown) {
  const before = window.history.state;
  onNavigate(section);
  pushDashboardEntry({ section, view }, window.history.state !== before);
}

export const openWealthView = (onNavigate: Navigate, view: WealthView) =>
  openSectionView(onNavigate, WEALTH_SECTION, view);

/**
 * A client's page (an advisor's), on one of their Wealth's pages: their investments unless said.
 * The client is in the view: `{ client, ...wealthView }`.
 */
export const openClientPage = (onNavigate: Navigate, clientUuid: string, view?: WealthView) =>
  openSectionView(onNavigate, CLIENTS_SECTION, { client: clientUuid, ...(view ?? {}) });

/** A portfolio (All portfolios included) on one of its pages: its own page unless said. */
export const openPortfolioPage = (onNavigate: Navigate, portfolioUuid: string, page: PortfolioPage = "overview") =>
  openWealthView(onNavigate, { kind: "portfolio", uuid: portfolioUuid, page });

/** A wallet (or "all", every wallet) on one of its pages. */
export const openWalletPage = (onNavigate: Navigate, id: string, page: WalletPage = "insights") =>
  openWealthView(onNavigate, { kind: "wallet", id, page });

export const openPlanPage = (onNavigate: Navigate, page: Exclude<PlanPage, "backtest" | "explore">) =>
  openSectionView(onNavigate, PLAN_SECTION, { page });

/** A backtest's page, under Plan's Strategy. */
export const openBacktestPage = (onNavigate: Navigate, portfolioUuid: string) =>
  openSectionView(onNavigate, PLAN_SECTION, { page: "backtest", uuid: portfolioUuid, sub: "overview" });

/** Explore, under Plan's Strategy: the catalog, or one strategy of it. */
export const openExplorePage = (onNavigate: Navigate, publicationId?: string) =>
  openSectionView(onNavigate, PLAN_SECTION, publicationId ? { page: "explore", publicationId } : { page: "explore" });
