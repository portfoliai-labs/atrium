// lib/dashboardNav.ts
//
// DASHBOARD NAVIGATION — opening a section on one of its own pages from elsewhere in the dashboard
// (the Dashboard's cards, Strategies opening a backtest, the Sidebar's rows under a section).
// The page is recorded in the history entry (see lib/dashboardHistory), which the section reads
// when it mounts. One entry for the whole move: the one `onNavigate` may have just pushed for the
// section is replaced by the page.

import { pushDashboardEntry } from "./dashboardHistory";
import type { InvestmentsView, PortfolioPage } from "../components/dashboard/InvestmentsSection";
import type { StrategiesView } from "../components/dashboard/StrategiesSection";
import type { WalletPage } from "../components/dashboard/wallets/WalletNode";
import type { WalletsView } from "../components/dashboard/wallets/WalletsSection";
import type { RealEstateView } from "../components/dashboard/realEstate/RealEstateSection";

// The dashboard's section ids (see the dashboard page). Investments keeps "performance", the id it
// had as Insights, then Manage, then Wealth, so old links and history entries still land on it.
export const INVESTMENTS_SECTION = "performance";
// The wallets and the real estate, each a section of its own (they were Wealth's).
export const WALLETS_SECTION = "wallets";
export const REAL_ESTATE_SECTION = "realEstate";
// The strategies: the user's backtests and the published ones (see StrategiesSection). An
// advisor's own section; an investor's is Investments', beside All portfolios, where a link to
// this one lands.
export const STRATEGIES_SECTION = "strategies";
// The Journal: its articles, and each reader's and author's pages (see JournalSection).
export const JOURNAL_SECTION = "journal";
// Today's market headlines (see NewsSection).
export const NEWS_SECTION = "news";
// Sections that are gone, kept so old links and history entries land where their pages went (see
// the dashboard page): Plan's (Projection and Stress test, each portfolio's own now; Strategy,
// Strategies) and Explore's (the strategies catalog, once; then the Journal and News together).
export const PLAN_SECTION = "plan";
export const EXPLORE_SECTION = "explore";
// An advisor's clients: the list, and each client's investments (see ClientsSection).
export const CLIENTS_SECTION = "clients";
// A security's page, opened from the top bar's search (see AssetSection).
export const ASSET_SECTION = "asset";

type Navigate = (section: string) => void;

/** Opens `section` on `view`, one history entry for the move. */
export function openSectionView(onNavigate: Navigate, section: string, view: unknown) {
  const before = window.history.state;
  onNavigate(section);
  pushDashboardEntry({ section, view }, window.history.state !== before);
}

export const openInvestmentsView = (onNavigate: Navigate, view: InvestmentsView) =>
  openSectionView(onNavigate, INVESTMENTS_SECTION, view);

/**
 * A client's page (an advisor's), on one of their investments' pages: All portfolios unless said.
 * The client is in the view: `{ client, ...investmentsView }`.
 */
export const openClientPage = (onNavigate: Navigate, clientUuid: string, view?: InvestmentsView) =>
  openSectionView(onNavigate, CLIENTS_SECTION, { client: clientUuid, ...(view ?? {}) });

/** A portfolio (All portfolios included) on one of its pages: its own page unless said. */
export const openPortfolioPage = (onNavigate: Navigate, portfolioUuid: string, page: PortfolioPage = "overview") =>
  openInvestmentsView(onNavigate, { kind: "portfolio", uuid: portfolioUuid, page });

/** A wallet (or "all", every wallet) on one of its pages. */
export const openWalletPage = (onNavigate: Navigate, id: string, page: WalletPage = "insights") =>
  openSectionView(onNavigate, WALLETS_SECTION, { id, page } satisfies WalletsView);

/** The real estate (its home page), or one property's page. */
export const openRealEstatePage = (onNavigate: Navigate, property?: string) =>
  openSectionView(onNavigate, REAL_ESTATE_SECTION, (property ? { page: "property", property } : { page: "home" }) satisfies RealEstateView);

/** Strategies, on one of its pages: its own (the user's strategies and the catalog) unless said. */
export const openStrategiesPage = (onNavigate: Navigate, view: StrategiesView = { page: "home" }) =>
  openSectionView(onNavigate, STRATEGIES_SECTION, view);

/** A backtest's page, under Strategies. */
export const openBacktestPage = (onNavigate: Navigate, portfolioUuid: string) =>
  openStrategiesPage(onNavigate, { page: "backtest", uuid: portfolioUuid, sub: "overview" });

/**
 * Compare (on the investments, see PortfolioNode), from outside Investments: the user's
 * portfolios with these strategies that aren't theirs beside them (published strategies, by
 * their portfolioUuid; the backtest a strategy their advisor shared came from).
 */
export const openCompareWith = (onNavigate: Navigate, strategies: { uuid: string; name: string } | { uuid: string; name: string }[]) =>
  openInvestmentsView(onNavigate, {
    kind: "portfolio",
    uuid: "",
    page: "compare",
    compareWith: Array.isArray(strategies) ? strategies : [strategies],
  });
