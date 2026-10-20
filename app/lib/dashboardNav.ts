// lib/dashboardNav.ts
//
// DASHBOARD NAVIGATION — opening a section on one of its own pages from elsewhere in the dashboard
// (the Dashboard's cards, Strategies opening a backtest, a notification's link).
// The page is recorded in the history entry (see lib/dashboardHistory), which the section reads
// when it mounts. One entry for the whole move: the one `onNavigate` may have just pushed for the
// section is replaced by the page.

import { createContext, useContext } from "react";
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
// Messages' page with a new chat with the AI assistant open: from the top bar's AI button, or a
// widget's (AiHelpButton), with the question to send at once.
export const MESSAGES_NEW_AI_CHAT = "new-ai-chat";
export type AiChatView = { page: typeof MESSAGES_NEW_AI_CHAT; question?: string };
export const aiChatView = (question?: string): AiChatView => ({ page: MESSAGES_NEW_AI_CHAT, question });
export const readAiChatView = (view: unknown): AiChatView | null => (
  typeof view === "object" && view !== null && (view as AiChatView).page === MESSAGES_NEW_AI_CHAT ? (view as AiChatView) : null
);
// Profile: the user's preferences (language, currency, tax residence), once Settings' tab, an
// investor's Investment Policy, and Find an advisor under it, once a section of its own (see
// MyProfileSection). Not "profile",
// the old investor profile's.
export const PROFILE_SECTION = "myProfile";
// The user's plan and the plans to move to (see SubscriptionPage), once Settings' first tab.
export const SUBSCRIPTION_SECTION = "subscription";

type Navigate = (section: string) => void;

/**
 * Opens a section on one of its pages, from anywhere under the dashboard page (which provides it):
 * for a page deep inside another section (a Journal article from an asset's page), where no
 * `onNavigate` is passed down. Null outside the dashboard.
 */
export const DashboardPageContext = createContext<((section: string, view: unknown) => void) | null>(null);
export const useOpenDashboardPage = () => useContext(DashboardPageContext);

/** Opens `section` on `view`, one history entry for the move. */
export function openSectionView(onNavigate: Navigate, section: string, view: unknown) {
  const before = window.history.state;
  onNavigate(section);
  pushDashboardEntry({ section, view }, window.history.state !== before);
}

/** Profile, where the language, the currency and the tax residence are set. */
export const openProfilePreferences = (onNavigate: Navigate) =>
  openSectionView(onNavigate, PROFILE_SECTION, { page: "home" });

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
