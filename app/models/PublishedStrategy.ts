// models/PublishedStrategy.ts
// Matches PublishedStrategyResponse and CatalogPageResponse (the strategies catalog): an advisor's
// strategy portfolio, published for every user to read (POST /v1/advisor/publications), listed at
// GET /v1/explore/strategies and read at GET /v1/explore/strategies/{publicationId}. Its portfolio
// (`portfolioUuid`) is readable by everyone through the usual portfolio routes (its Insights, its
// /strategy), never writable, copyable or adoptable.
//
// Every figure is a simulation: the strategy played on historical prices. The figures are
// time-weighted on the holdings' prices, so cash flows don't move them, and gross of trading costs:
// the author's `costs` are shown next to them, never in them. The catalog labels them so, with a
// disclaimer, never shows return without volatility and drawdown next to it, and matches nothing to
// the viewer's profile.

import type { StrategyCosts } from "./Strategy";
import type { StrategyAllocation } from "./AdoptedStrategy";

// The trailing windows the figures are over, ending on the backtest's last day. `inception` is the
// whole history: shown, never filtered or sorted on (422).
type CatalogHorizon = "1y" | "3y" | "5y" | "10y" | "inception";
type FilterHorizon = Exclude<CatalogHorizon, "inception">;
// `newest` (the default) | the highest return | the highest return per risk | the lowest
// volatility | the shallowest drawdown.
type CatalogSort = "newest" | "return" | "return_per_risk" | "volatility" | "drawdown";
type Crisis = "global_financial" | "covid_crash" | "rate_hikes";

// The same window as the portfolio's performance view's horizon (1y = "1 Year" … inception =
// "Inception"): totalReturnPct is the view's totalReturnPct, returnPerRisk its riskAdjustedReturn.
interface HorizonFigures {
  horizon: CatalogHorizon;
  windowDays: number;
  totalReturnPct: number | null;
  annualizedReturnPct: number | null;
  volatilityPct: number | null;
  // The worst drop, negative.
  maxDrawdownPct: number | null;
  returnPerRisk: number | null;
}

// How it went through a past crisis its history covers.
interface CrisisFigures {
  crisis: Crisis;
  start: string;
  end: string;
  returnPct: number | null;
  maxDrawdownPct: number | null;
}

interface PublishedStrategy {
  publicationId: string;
  portfolioUuid: string;
  portfolioName: string;
  authorUuid: string;
  // Null when the backend has no name for them.
  authorName: string | null;
  description: string | null;
  strategy: StrategyAllocation;
  // The author's; the fixed fee is in `currency`.
  costs: StrategyCosts;
  // The author's reference currency (ISO 4217).
  currency: string;
  // The first simulated day; null until the backtest has run.
  startedOn: string | null;
  // Empty until the figures are computed (figuresComputedAt).
  horizons: HorizonFigures[];
  crises: CrisisFigures[];
  publishedAt: string;
  figuresComputedAt: string | null;
}

interface CatalogPage {
  strategies: PublishedStrategy[];
  // How many match, all pages together.
  total: number;
}

// GET /v1/explore/strategies. Without a horizon: newest first, nothing filtered; a filter or a
// sort by figure needs one (422 InvalidFieldError on `horizon` otherwise), and then only the
// strategies whose history covers it come back. `maxDrawdownPct` is positive: 20 = no worse
// than −20%. `limit` 1–100 (20 by default).
interface CatalogQuery {
  horizon?: FilterHorizon;
  maxVolatilityPct?: number;
  maxDrawdownPct?: number;
  sort?: CatalogSort;
  limit?: number;
  offset?: number;
}

// Body of POST /v1/advisor/publications: one of the advisor's own strategy portfolios, once its
// backtest has run (409 BacktestNotRunError before, 404 for a portfolio that isn't a strategy's).
// Publishing it again keeps its publication and replaces the description (at most
// MAX_DESCRIPTION_LENGTH characters, 422 past that).
interface PublishStrategyPayload {
  portfolioUuid: string;
  description?: string;
}

const MAX_DESCRIPTION_LENGTH = 2000;

const FILTER_HORIZONS: FilterHorizon[] = ["1y", "3y", "5y", "10y"];

const HORIZON_LABELS: Record<CatalogHorizon, string> = {
  "1y": "1 year",
  "3y": "3 years",
  "5y": "5 years",
  "10y": "10 years",
  inception: "Since the start",
};

const SORT_LABELS: Record<CatalogSort, string> = {
  newest: "Newest",
  return: "Highest return",
  return_per_risk: "Highest return per risk",
  volatility: "Lowest volatility",
  drawdown: "Shallowest drawdown",
};

const CRISIS_LABELS: Record<Crisis, string> = {
  global_financial: "Global financial crisis",
  covid_crash: "Covid crash",
  rate_hikes: "Rate hikes",
};

/** A sort on the figures, which needs a horizon. */
const isFigureSort = (sort: CatalogSort) => sort !== "newest";

export type {
  CatalogHorizon, FilterHorizon, CatalogSort, Crisis, HorizonFigures, CrisisFigures, PublishedStrategy, CatalogPage,
  CatalogQuery, PublishStrategyPayload,
};
export { MAX_DESCRIPTION_LENGTH, FILTER_HORIZONS, HORIZON_LABELS, SORT_LABELS, CRISIS_LABELS, isFigureSort };
