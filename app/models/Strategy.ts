// models/Strategy.ts
// Matches StrategyParams (the `strategy` of POST /v1/portfolios/strategies, and what GET
// /v1/portfolios/{p}/strategy returns): the rules a strategy's backtest plays month by month on
// real prices: its targets, each a macro category bought through its listed proxy (equity SWDA,
// bonds XGLE, real estate IWDP, commodities EXXY, cash XEON, crypto BTC-EUR) or a security bought
// as it is, on adjusted close so distributions are in the price. The backtest is a virtual portfolio (Portfolio.isVirtual): the POST answers at once with
// it empty, a background job then generates its transactions up to the day it was created, and
// its history is built like any portfolio's (its /insights/* answer null or isStale until then).
// The period isn't the user's: it runs from the first month everything it holds is priced (at most
// 40 years back) to today, and keeps playing its rules (rebalancing, contributions, withdrawals)
// every day from then on.
//
// Cash flows and calendar rebalancing act on the first trading day of each month, in this order:
// contribution, withdrawal, rebalance. The drift band is checked every trading day. Amounts are in
// the owner's reference currency (StrategyResponse.currency). Its figures are time-weighted on the
// holdings' prices: cash flows don't move them, and neither do trading costs (commission, fixed fee,
// spread), which show up in the trading costs: they're gross of them. Fund fees (TER) are already in
// the ETFs' prices, and taxes aren't modelled.

type StrategyCategory = "equity" | "bonds" | "real_estate" | "commodities" | "cash" | "crypto";
type StrategyFrequency = "monthly" | "quarterly" | "semiannual" | "annual";
type RebalanceMode = "none" | "calendar" | "threshold" | "both";
// `percent_of_value`: a % of the portfolio's value that day, per occurrence (monthly 4 = 4% every
// month, not per year), at most 100.
type CashFlowAmountType = "fixed" | "percent_of_value";

interface StrategyRebalancing {
  mode: RebalanceMode;
  frequency: StrategyFrequency;
  // Band around each target weight, in percentage points (absolute) or as a % of that weight
  // (relative). With both set, crossing either triggers (the 5/25 rule); `threshold` and `both`
  // need at least one.
  thresholdPct: number | null;
  relativeThresholdPct: number | null;
}

interface StrategyContributions {
  enabled: boolean;
  amount: number;
  amountType: CashFlowAmountType;
  frequency: StrategyFrequency;
  // `current`: bought at the weights the portfolio holds that day; `target`: at the target weights.
  allocation: "current" | "target";
}

interface StrategyWithdrawals {
  enabled: boolean;
  amount: number;
  amountType: CashFlowAmountType;
  frequency: StrategyFrequency;
  // Withdrawals sell every category in proportion, from this many years into the run.
  startAfterYears: number;
}

interface StrategyCosts {
  commissionPct: number;
  // Per trade, in the reference currency.
  fixedFee: number;
  // Bid-ask %, half above the price to buy, half below to sell.
  spreadPct: number;
}

// A security a strategy buys as it is, picked with the asset search (models/AssetSearch). A
// request sends its ticker and isin; the backend answers with the listing it resolved, keyed by
// assetId (the ISIN when there is one, the ticker otherwise). One it can't resolve is a 422
// InvalidFieldError naming the target (e.g. `strategy.targets.1.asset`).
interface StrategyAsset {
  ticker: string;
  isin: string | null;
  assetId?: string;
  exchangeMic?: string | null;
  currency?: string | null;
  name?: string | null;
}

interface StrategyCategoryTarget {
  kind: "category";
  category: StrategyCategory;
  weightPct: number;
}

interface StrategyAssetTarget {
  kind: "asset";
  asset: StrategyAsset;
  weightPct: number;
}

type StrategyTarget = StrategyCategoryTarget | StrategyAssetTarget;

interface StrategyParams {
  // Percent of the portfolio, summing to 100; each category or security at most once, at most
  // MAX_STRATEGY_TARGETS in all. A target at 0 isn't kept.
  targets: StrategyTarget[];
  initialAmount: number;
  // Deprecated: ignored in a request, and never sent; always null in a response. The period is
  // StrategyResponse.startedOn to today.
  startYear?: number | null;
  years?: number | null;
  rebalancing: StrategyRebalancing;
  contributions: StrategyContributions;
  withdrawals: StrategyWithdrawals;
  costs: StrategyCosts;
}

// GET /v1/portfolios/{p}/strategy: the strategy, with the day its backtest started trading on: the
// first month everything it holds is priced (null until it has run). Under 12 months of prices in
// common and the backtest fails (STRATEGY_FAILED, history_too_short).
interface StrategyResponse extends StrategyParams {
  startedOn: string | null;
  // The owner's reference currency, which the amounts and the fixed fee are in.
  currency: string | null;
}

// Body of POST /v1/portfolios/strategies. `name`: 1–80 chars, unique among the user's portfolios
// (409 otherwise); a strategy that doesn't add up is a 422.
interface StrategyPortfolioPayload {
  name: string;
  strategy: StrategyParams;
}

const STRATEGY_CATEGORIES: StrategyCategory[] = ["equity", "bonds", "real_estate", "commodities", "cash", "crypto"];

const STRATEGY_CATEGORY_LABELS: Record<StrategyCategory, string> = {
  equity: "Equity",
  bonds: "Bonds",
  real_estate: "Real estate",
  commodities: "Commodities",
  cash: "Cash",
  crypto: "Crypto",
};

// The listed instrument each category is traded through.
const STRATEGY_PROXIES: Record<StrategyCategory, string> = {
  equity: "SWDA · iShares Core MSCI World",
  bonds: "XGLE · Xtrackers Eurozone Government Bond",
  real_estate: "IWDP · iShares Developed Markets Property Yield",
  commodities: "EXXY · iShares Diversified Commodity Swap",
  cash: "XEON · Xtrackers EUR Overnight Rate Swap",
  crypto: "BTC-EUR · Bitcoin",
};

const MAX_STRATEGY_TARGETS = 20;

/** What a target is called: its category, or its security's name (the ticker until resolved). */
function targetLabel(t: StrategyTarget): string {
  return t.kind === "category" ? STRATEGY_CATEGORY_LABELS[t.category] : t.asset.name || t.asset.ticker;
}

/** "Simulated from Jan 3, 2005 to today", or null until the backtest has run. */
function simulatedPeriod(startedOn: string | null | undefined): string | null {
  if (!startedOn) return null;
  const started = new Date(`${startedOn}T00:00:00`);
  return `Simulated from ${started.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} to today`;
}

export type {
  StrategyCategory, StrategyFrequency, RebalanceMode, CashFlowAmountType, StrategyRebalancing,
  StrategyContributions, StrategyWithdrawals, StrategyCosts, StrategyAsset, StrategyCategoryTarget,
  StrategyAssetTarget, StrategyTarget, StrategyParams, StrategyResponse, StrategyPortfolioPayload,
};
export {
  STRATEGY_CATEGORIES, STRATEGY_CATEGORY_LABELS, STRATEGY_PROXIES, MAX_STRATEGY_TARGETS,
  targetLabel, simulatedPeriod,
};
