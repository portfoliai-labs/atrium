// models/PublishedStrategy.ts
// Matches PublishedStrategyResponse and CatalogPageResponse (the strategies catalog): a user's
// strategy portfolio, published for every user to read and sent to the Nostr network (POST
// /v1/publications), or another instance's or client's strategy read from the network and
// recomputed here (`source` network); listed at GET /v1/explore/strategies and read at GET
// /v1/explore/strategies/{publicationId}. Its portfolio (`portfolioUuid`, a network strategy's
// once its backtest is made here) is readable by everyone through the usual portfolio routes (its
// Insights, its /strategy), never writable, copyable or adoptable.
//
// Every figure is a simulation: the strategy played on historical prices. The figures are
// time-weighted on the holdings' prices, so cash flows don't move them, and net of trading costs:
// the author's `costs` are shown next to them and taken out of them. The catalog labels them so, with a
// disclaimer, never shows return without volatility and drawdown next to it, and matches nothing to
// the viewer's profile.

import type { StrategyCosts } from "./Strategy";
import type { StrategyAllocation } from "./AdoptedStrategy";
import type { ReportReason } from "./Journal";

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

// A strategy's investment methodology as plain percentages, as its last tick holds it: no label
// or threshold of the platform's. `category` and `index_factors` are census' classification of
// what each holding is (`equity`, `value`, `no_factor` for an index with none); `asset_class` the
// holding's class as its provider names it (`ETF`); `region` and `sector` look through the funds
// to what they hold (`North America`, `Technology`). Weights of the whole portfolio, the cash
// apart (`cashWeightPct`); `value` null: the holdings the dimension knows nothing of.
type ProfileDimension = "category" | "asset_class" | "region" | "sector" | "index_factors";

interface ProfileShare {
  value: string | null;
  weightPct: number;
}

interface ProfileBreakdown {
  dimension: ProfileDimension;
  // A holding counts under several values (a multi-factor index): the weights add up to more.
  overlapping: boolean;
  // The largest first, the unknown last.
  shares: ProfileShare[];
}

// What its equity holdings' returns behaved like (nucleo's daily build), against each factor set
// the backend serves: `long_only` the factor ETFs' (everywhere), `long_short` Fama-French's
// (development only, not shown yet). A long-only set's `value` is the mix's weight (a fraction),
// the rest (`cashWeight`) the risk-free; `significant` a weight of 5% or more. Not what the
// holdings are (that's the breakdowns): how their monthly returns moved, measured over `months`.
type FactorExposuresStatus = "ok" | "insufficient_history" | "unavailable";
type FactorSetKind = "long_short" | "long_only";

interface FactorExposure {
  // `market`, `value`, `momentum`, `quality`, `min_volatility`, `size`, `emerging_markets`
  // (long-only); `profitability`, `investment` too (long-short).
  factor: string;
  // As the set's source names it: "iShares Edge MSCI World Value Factor (IS3S)".
  name: string;
  value: number;
  tStat: number | null;
  significant: boolean;
}

interface FactorSetExposures {
  provider: string;
  region: string;
  kind: FactorSetKind;
  currency: string;
  // What to cite: "iShares factor ETFs' prices (Yahoo Finance)".
  source: string;
  sourceUrl: string;
  firstMonth: string | null;
  lastMonth: string | null;
  months: number;
  // The share of the months' variance the factors explain, 0 to 1.
  rSquared: number;
  alphaAnnualPct: number;
  alphaTStat: number | null;
  cashWeight: number | null;
  exposures: FactorExposure[];
}

interface FactorExposures {
  // insufficient_history: fewer than 3 years of the equity holdings; unavailable: no equity holdings.
  status: FactorExposuresStatus;
  // The equity holdings measured, of the whole portfolio.
  equityWeightPct: number;
  sets: FactorSetExposures[];
}

interface StrategyProfile {
  breakdowns: ProfileBreakdown[];
  cashWeightPct: number;
  computedAt: string;
  // Each of `strategy.targets`' weight of the whole now, in their order (a category target's is
  // its proxy's); absent from an ianus before it.
  targetWeightsPct?: number[];
  // Null until the daily build first measured them; absent from an ianus before them.
  factorExposures?: FactorExposures | null;
}

// Where a catalog strategy comes from: this instance (`platform`) or the network (`network`,
// another instance's user or another client, recomputed here).
type StrategySource = "platform" | "network";
// Whose strategies the catalog reads: this instance's and the reader's web of trust's (the
// authors they follow and those these follow), or every one the reader sees.
type CatalogScope = "trusted" | "all";
// Where a network strategy's recomputation here stands: its backtest has run; it's queued or
// running; nobody here follows its author, so opening it starts it; too many network strategies
// are computed already (computed when room is made); given up on (its instruments' prices).
type NetworkRecompute = "computed" | "running" | "on_open" | "capped" | "failed";
// Where one of the caller's own publications stands on the network: being sent (tried again a
// while after each failure), on it, or given up on until it's published again.
type PublicationNetworkState = "pending" | "sent" | "failed";

interface PublishedStrategy {
  publicationId: string;
  // Null for a network strategy until its backtest is made here: no chart, no Compare until then.
  portfolioUuid: string | null;
  // A network strategy's: its event's title.
  portfolioName: string;
  // Null for a network strategy.
  authorUuid: string | null;
  // Null when the backend has no name for them (always for a network strategy).
  authorName: string | null;
  // The thesis, in Markdown (required on publishing; an older publication's may be null).
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
  // Null until its holdings are first computed; absent from an ianus before the profile.
  profile?: StrategyProfile | null;
  // Absent from an ianus before the network (0.89.0): a platform strategy.
  source?: StrategySource;
  // The author's key (lowercase hex) and npub; null for a local author with no key (then it can't
  // be hidden or reported). The author is muted at the Journal's /mutes/{authorPubkey}.
  authorPubkey?: string | null;
  authorNpub?: string | null;
  // Its `d` on the network (a local one's: its publication id).
  identifier?: string;
  // Its current event on the network, once there.
  eventId?: string | null;
  // A network strategy's only; null for this instance's.
  recompute?: NetworkRecompute | null;
  // The caller's own publications only; null on anyone else's.
  networkState?: PublicationNetworkState | null;
  // The reader hid it themselves (hidden or reported): its page and its menu show it again rather
  // than hide it. Only GET by id answers hidden ones. Absent from an ianus before it: false.
  hiddenByYou?: boolean;
  // Its author is in the reader's web of trust (followed, or followed by whom they follow), or is
  // the reader: a network strategy without it carries the "New author" mark. Absent from an ianus
  // before it: false.
  authorTrusted?: boolean;
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
// `source` platform or network (unset: both); `scope` trusted or all (unset: all). Never the
// strategies the reader hid or reported, their muted authors', nor those hidden by the reports of
// people they follow.
interface CatalogQuery {
  source?: StrategySource;
  scope?: CatalogScope;
  horizon?: FilterHorizon;
  maxVolatilityPct?: number;
  maxDrawdownPct?: number;
  sort?: CatalogSort;
  limit?: number;
  offset?: number;
}

// Body of POST /v1/publications: one of the caller's own strategy portfolios, once its backtest
// has run (409 BacktestNotRunError before, 404 for a portfolio that isn't a strategy's, 403 for a
// client's), sent to the network too. `description` is required: the strategy's thesis, Markdown,
// trimmed, at most MAX_DESCRIPTION_LENGTH characters (422 when blank or past that). Publishing it
// again keeps its publication, replaces the thesis and sends it again.
interface PublishStrategyPayload {
  portfolioUuid: string;
  description: string;
}

// Body of POST /v1/explore/strategies/{id}/reports: the Journal's reasons, a note up to 500.
interface StrategyReportPayload {
  reason: ReportReason;
  note?: string | null;
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

/** Whether it was read from the network (another instance's or client's), recomputed here. */
const isNetworkStrategy = (s: Pick<PublishedStrategy, "source">) => s.source === "network";

/** Whether the reader hid it themselves: "Show strategy" in place of "Hide strategy". */
const isHiddenByYou = (s: Pick<PublishedStrategy, "hiddenByYou">) => s.hiddenByYou === true;

/** Whether it carries the "New author" mark: someone else's from the network, its author outside the reader's web of trust. */
const isNewStrategyAuthor = (s: Pick<PublishedStrategy, "source" | "networkState" | "authorTrusted">) =>
  isNetworkStrategy(s) && !s.networkState && s.authorTrusted !== true;

/** Whether its figures can be drawn and compared: its backtest exists here. */
const hasBacktest = (s: Pick<PublishedStrategy, "portfolioUuid">): s is { portfolioUuid: string } => s.portfolioUuid !== null;

// Where a network strategy's figures stand, when they aren't in yet (`computed` says nothing).
const RECOMPUTE_LABELS: Record<Exclude<NetworkRecompute, "computed">, { title: string; note: string }> = {
  running: {
    title: "Computing",
    note: "Its figures are being simulated here from its rules, on historical prices. Come back to it shortly.",
  },
  on_open: {
    title: "Not computed yet",
    note: "Its figures are simulated here when someone opens it: opening it starts them.",
  },
  capped: {
    title: "Not computed yet",
    note: "Many strategies from the network are simulated here already: this one will be when there's room.",
  },
  failed: {
    title: "Couldn't be computed",
    note: "Its figures couldn't be simulated here: the prices of what it holds aren't available.",
  },
};

// One's own publication on the network.
const NETWORK_STATE_LABELS: Record<PublicationNetworkState, string> = {
  pending: "Sending to the network",
  sent: "On the network",
  failed: "Not sent to the network: publish it again to retry",
};

export type {
  CatalogHorizon, FilterHorizon, CatalogSort, Crisis, HorizonFigures, CrisisFigures, PublishedStrategy, CatalogPage,
  CatalogQuery, PublishStrategyPayload, StrategyReportPayload, StrategySource, CatalogScope, NetworkRecompute,
  PublicationNetworkState, ProfileDimension, ProfileShare, ProfileBreakdown, StrategyProfile,
  FactorExposuresStatus, FactorSetKind, FactorExposure, FactorSetExposures, FactorExposures,
};
export {
  MAX_DESCRIPTION_LENGTH, FILTER_HORIZONS, HORIZON_LABELS, SORT_LABELS, CRISIS_LABELS, RECOMPUTE_LABELS, NETWORK_STATE_LABELS,
  isFigureSort, isNetworkStrategy, isHiddenByYou, isNewStrategyAuthor, hasBacktest,
};
