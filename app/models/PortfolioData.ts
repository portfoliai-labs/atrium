// models/PortfolioData.ts
//
// Types for the Insights page's endpoints under GET /v1/portfolios/{p}/insights/* (four section
// overviews, a status to poll, and one detail per explore view), /positions/{asset_id},
// /v1/portfolios/comparison and /v1/assets/{ticker}. Mirrors the backend's generated
// doc/frontend/portfolio-data-api.d.ts — regenerate from there if the routes change.
//
// Conventions shared by all of them:
// - A section is never null; each module in it is null until its document is first computed.
//   A detail endpoint's body can be null for the same reason (its service method returns
//   `T | null`).
// - Every key is always present; a value that doesn't apply is `null` (never NaN, never a
//   missing key), so those fields are typed `T | null`, not optional.
// - `*Pct` is already a percentage (5.0 = 5%), `*Bps` is in basis points, and beta / sharpe /
//   informationRatio / riskAdjustedReturn are plain ratios. Series are parallel arrays.
// - Every module carries its own `status`, `isStale` and `computedAt`: null → "being prepared",
//   status → its empty state, isStale → "updating" (the user edited transactions and the
//   rebuild hasn't landed). The tick modules (holdings, exposure, realized P&L), dividends and
//   trading costs are always "ok"; the tick ones are never stale.

import type { Portfolio, DailyValueChange } from "./Portfolio";

// "unavailable" only ever appears on the risk model.
type AnalyticsStatus = "ok" | "insufficient_history" | "unavailable";

type WeightGapDirection = "overweight" | "underweight" | "in_line";

// Why the risk model is "unavailable" (set only with that status, null otherwise):
// - too_few_assets: fewer than two held assets share at least 30 days of history;
// - no_positive_returns: every asset's trailing mean return is at or below the risk-free
//   rate (0), so no max-Sharpe allocation exists;
// - solver_failed: the optimiser did not converge.
type RiskModelUnavailableReason = "too_few_assets" | "no_positive_returns" | "solver_failed";

// Two parallel arrays, ascending by date. `values` are in the unit stated where the series
// is used (percent for the return / drawdown / volatility curves, money for cumulativeCosts).
interface TimeSeries {
  dates: string[];
  values: number[];
}

// What every module of a section carries about its own document.
interface ModuleState {
  status: AnalyticsStatus;
  computedAt: string;
  isStale: boolean;
}

// ---------- holdings ----------

// A position held now, in the reference currency except `currency`, the one it trades in.
// assetClass is the metadata provider's quoteType, uppercase and not normalised (EQUITY, ETF,
// MUTUALFUND, CRYPTOCURRENCY, UNKNOWN — but not a closed set), so anything that styles it
// needs a fallback. The per-currency detail uses the same labels.
interface PortfolioHoldingResponse {
  assetId: string;
  ticker: string | null;
  isin: string | null;
  name: string;
  assetClass: string;
  currency: string;
  quantity: number;
  currentPrice: number;
  marketValue: number;
  weightPct: number;
  avgCost: number;
  costBasis: number;
  unrealizedPnl: number;
  roiPct: number;
}

// ---------- exposure ----------

// label is a GICS sector (sector exposure) or North America / Europe / Pacific / Emerging
// Markets (region exposure), plus "Unknown" for assets with no known breakdown so entries
// always add up to the full held weight. A name the provider spells differently passes
// through unchanged.
interface ExposureEntryResponse {
  label: string;
  weightPct: number;
}

// ---------- returns ----------

// `period` is "1 Month", "6 Months", "1 Year", "3 Years", "5 Years", "10 Years" or "Inception"; a horizon longer than
// the portfolio's history isn't returned at all. windowDays counts the calendar days it covers.
interface HorizonEntry {
  period: string;
  windowDays: number;
  totalReturnPct: number | null;
  volatilityPct: number | null;
  maxDrawdownPct: number | null;
  riskAdjustedReturn: number | null;
}

interface AnnualReturnEntry {
  year: number;
  returnPct: number | null;
}

interface MonthReturn {
  month: string;
  returnPct: number;
}

// ---------- volatility ----------

interface RiskEventEntry {
  startDate: string;
  endDate: string;
  annualizedVolatilityPct: number | null;
  cumulativeReturnPct: number | null;
  assetNames: string[];
}

// ---------- dividends ----------

interface DividendAssetEntry {
  assetId: string;
  ticker: string | null;
  name: string;
  trailing12MIncome: number;
  prior12MIncome: number;
  lifetimeIncome: number;
  marketValue: number;
  costBasis: number;
  yieldPct: number | null;
  yieldOnCostPct: number | null;
  growthYoyPct: number | null;
}

// ---------- trading costs ----------

interface PlatformCostEntry {
  platform: string;
  transactionCount: number;
  tradedVolume: number;
  explicitFees: number;
  implicitCosts: number;
  totalCosts: number;
  costBps: number | null;
  avgCostPerTrade: number | null;
  shareOfTotalPct: number | null;
}

// One asset on one broker: an asset traded on two brokers has two rows.
interface AssetCostEntry {
  assetId: string;
  ticker: string | null;
  name: string;
  broker: string;
  transactionCount: number;
  tradedVolume: number;
  explicitFees: number;
  implicitCosts: number;
  totalCosts: number;
  costBps: number | null;
}

// ---------- realized P&L ----------

// One asset ever sold (or that paid dividends), in the reference currency, each sale converted
// at its own date — the PDF report's figures. realizedPnl = realizedTradingPnl + dividendIncome.
interface RealizedPnlEntryResponse {
  assetId: string;
  ticker: string | null;
  name: string;
  assetClass: string;
  realizedTradingPnl: number;
  dividendIncome: number;
  realizedPnl: number;
  isHeld: boolean;
}

// ---------- benchmark ----------

// components also lists the proxies of closed positions, at weightPct 0 — filter to
// weightPct > 0 to show only the current basket.
interface BenchmarkComponentEntry {
  ticker: string | null;
  name: string;
  weightPct: number | null;
}

// ---------- risk model ----------

interface RiskAssetEntry {
  ticker: string;
  name: string;
  expectedReturnPct: number | null;
  volatilityPct: number | null;
}

interface PortfolioWeightEntry {
  ticker: string;
  name: string;
  weightPct: number;
}

// expectedReturnPct is a trailing historical mean, not a forecast — anything showing it says
// "based on past returns" and avoids recommendation wording.
interface RiskPointResponse {
  expectedReturnPct: number | null;
  volatilityPct: number | null;
  sharpeRatio: number | null;
}

interface RiskPortfolioEntry extends RiskPointResponse {
  weights: PortfolioWeightEntry[];
}

interface FrontierPointEntry {
  volatilityPct: number | null;
  expectedReturnPct: number | null;
}

interface WeightGapEntry {
  ticker: string;
  name: string;
  currentWeightPct: number;
  targetWeightPct: number;
  deltaPct: number;
  direction: WeightGapDirection;
}

// matrix[i][j] is the correlation of tickers[i] with tickers[j] (−1 to 1); a cell can be null.
interface CorrelationMatrix {
  tickers: string[];
  matrix: (number | null)[][];
}

// ---------- aggregate composition ----------

// How the user's portfolios make up the aggregate. members is largest market value first.
// pnlSharePct can exceed 100 or go negative (one portfolio lost while another gained), null when
// the combined profit is 0. riskContributionPct adds up to 100 across members: above weightPct
// means the portfolio adds more risk than its size, below 0 that it offsets the others. Under
// "insufficient_history" (fewer than 60 shared trading days) correlation and every
// riskContributionPct are null; the rest is always there.
interface CompositionMemberEntry {
  portfolioUuid: string;
  name: string;
  marketValue: number;
  weightPct: number;
  totalPnl: number;
  pnlSharePct: number | null;
  riskContributionPct: number | null;
}

// matrix[i][j] pairs portfolioUuids[i] and [j], -1 to 1 (1 on the diagonal); null for a pair
// where one portfolio's returns never varied. observations = days every portfolio traded.
interface PortfolioCorrelationMatrix {
  portfolioUuids: string[];
  matrix: (number | null)[][];
  observations: number;
}

interface AssetHoldingEntry {
  portfolioUuid: string;
  marketValue: number;
}

// An asset held in 2+ portfolios: exposure each portfolio's own view understates. holdings is
// largest first.
interface OverlappingAssetEntry {
  assetId: string;
  ticker: string | null;
  name: string;
  marketValue: number;
  weightPct: number;
  holdings: AssetHoldingEntry[];
}

// ---------- the month-by-month values ----------

interface ValuePoint {
  snapshotAt: string;
  totalMarketValue: number;
}

// One month's cell of the returns heatmap. Only months with computable data are included; a
// (year, month) pair simply absent means "nothing to show", not zero. timeWeightedReturnPct is
// the "return" (the same figure as the returns document), null under a year of history.
interface MonthlyMarketEffectEntry {
  year: number;
  month: number;
  marketEffectPct: number;
  timeWeightedReturnPct: number | null;
}

// ========== GET /insights/composition ==========

interface InsightsHoldingsModule extends ModuleState {
  // Largest market value first; closed positions aren't listed.
  holdings: PortfolioHoldingResponse[];
}

interface InsightsExposureModule extends ModuleState {
  // Largest first; entries below 0.01% are dropped.
  entries: ExposureEntryResponse[];
}

interface InsightsPortfoliosModule extends ModuleState {
  members: CompositionMemberEntry[];
}

// Same document as InsightsPortfoliosModule, so the same status and isStale.
interface InsightsComovementModule extends ModuleState {
  correlation: PortfolioCorrelationMatrix | null;
  overlappingAssets: OverlappingAssetEntry[];
}

// `portfolios` and `comovement` exist only on the aggregate (null on a standard portfolio).
interface InsightsCompositionResponse {
  currency: string;
  isAggregate: boolean;
  holdings: InsightsHoldingsModule | null;
  sectorExposure: InsightsExposureModule | null;
  regionExposure: InsightsExposureModule | null;
  portfolios: InsightsPortfoliosModule | null;
  comovement: InsightsComovementModule | null;
}

// ========== GET /insights/income-costs ==========

// Two yields: wholePortfolioYieldPct is "what does the portfolio yield" (income over the whole
// portfolio); the detail's portfolioYieldPct only counts the holdings that pay.
interface InsightsDividendsModule extends ModuleState {
  totalLifetimeIncome: number;
  totalTrailing12MIncome: number;
  wholePortfolioYieldPct: number | null;
  portfolioYieldOnCostPct: number | null;
  portfolioGrowthYoyPct: number | null;
  // The 5 largest payers over the last 12 months, only those that paid.
  topPayers: DividendAssetEntry[];
}

// annualizedCostDragPct is under 0.10 = negligible, over 0.50 = material (the PDF report's own
// thresholds).
interface InsightsTradingCostsModule extends ModuleState {
  totalCosts: number;
  totalTransactions: number;
  avgCostPerTrade: number | null;
  costRatioPct: number | null;
  annualizedCostDragPct: number | null;
  // The 5 costliest platforms.
  topPlatforms: PlatformCostEntry[];
}

interface InsightsRealizedPnlModule extends ModuleState {
  totalRealizedPnl: number;
  totalRealizedTradingPnl: number;
  totalDividendIncome: number;
  // The 5 largest trading P&Ls by absolute value; assets that only paid dividends aren't here.
  topAssets: RealizedPnlEntryResponse[];
}

interface InsightsIncomeCostsResponse {
  currency: string;
  isAggregate: boolean;
  dividends: InsightsDividendsModule | null;
  tradingCosts: InsightsTradingCostsModule | null;
  realizedPnl: InsightsRealizedPnlModule | null;
}

// ========== GET /insights/performance ==========

// One point per closed month (valued at its real end), then today's.
interface InsightsValueModule {
  inceptionDate: string;
  currentValue: number;
  chart: ValuePoint[];
}

// The month so far. monthStartValue is the value at the end of last month (0 for a portfolio
// created this month: no percentage to show), previousDayValue 0 when the portfolio started
// today. `chart` has a day-over-day delta per day, not guaranteed in order.
interface InsightsThisMonthModule {
  currentValue: number;
  previousDayValue: number;
  dayMarketEffect: number;
  dayMarketEffectPct: number;
  monthStartValue: number;
  deltaMtdValue: number;
  mtdNetCapitalContributed: number;
  mtdMarketEffect: number;
  mtdMarketEffectPct: number;
  chart: DailyValueChange[];
}

interface InsightsHeatmapModule {
  entries: MonthlyMarketEffectEntry[];
}

// value, thisMonth and heatmap come from the stored daily and month-end values: no status of
// their own, and historyIsStale is their isStale. All three are null without any stored value,
// i.e. no history at all. The returns and the benchmark are their own detail endpoints.
interface InsightsPerformanceResponse {
  currency: string;
  isAggregate: boolean;
  historyIsStale: boolean;
  value: InsightsValueModule | null;
  thisMonth: InsightsThisMonthModule | null;
  heatmap: InsightsHeatmapModule | null;
}

// ========== GET /insights/risk ==========

interface InsightsVolatilityModule extends ModuleState {
  annualizedVolatilityPct: number | null;
  rollingWindowDays: number | null;
  rollingVolatilityPct: TimeSeries | null;
}

// The frontier and the three mixes on it, without their weights (those are in the detail).
interface InsightsFrontierModule extends ModuleState {
  unavailableReason: RiskModelUnavailableReason | null;
  frontier: FrontierPointEntry[];
  current: RiskPointResponse | null;
  maxSharpe: RiskPointResponse | null;
  minVolatility: RiskPointResponse | null;
}

interface InsightsRiskResponse {
  currency: string;
  isAggregate: boolean;
  volatility: InsightsVolatilityModule | null;
  frontier: InsightsFrontierModule | null;
}

// ========== GET /insights/status ==========

interface FacetState {
  computedAt: string;
  isStale: boolean;
}

// Keyed like the modules; `composition` covers the aggregate's portfolios and comovement,
// `returns` also the drawdown in the volatility detail, `riskModel` the frontier.
interface InsightsStatusModules {
  holdings: FacetState | null;
  sectorExposure: FacetState | null;
  regionExposure: FacetState | null;
  composition: FacetState | null;
  dividends: FacetState | null;
  tradingCosts: FacetState | null;
  realizedPnl: FacetState | null;
  returns: FacetState | null;
  benchmark: FacetState | null;
  volatility: FacetState | null;
  riskModel: FacetState | null;
}

// Poll this (not the sections) every 15s while anything is stale, for up to 5 minutes; when a
// module turns fresh, refetch its section and its open detail.
interface InsightsStatusResponse {
  version: number;
  historyIsStale: boolean;
  anyStale: boolean;
  modules: InsightsStatusModules;
}

// ========== detail endpoints ==========

interface BrokerTotal {
  broker: string;
  totalInvested: number;
}

interface AssetClassTotal {
  assetClass: string;
  totalInvested: number;
}

// A position within one currency, from the recorded transactions (not market prices), one row
// per asset and broker. quantity is a string: arbitrary decimal precision (crypto).
interface CurrencyHolding {
  ticker: string | null;
  isin: string | null;
  name: string;
  assetClass: string;
  quantity: string;
  investedValue: number;
  currency: string;
  fees: number;
  broker: string | null;
}

// One currency present in the portfolio, every figure in that currency (never converted, so
// never summed across currencies). Dividends are excluded from its realized P&L.
interface CurrencyDetail {
  currency: string;
  totalInvested: number;
  totalFeesPaid: number;
  holdingsCount: number;
  purchasesByBroker: BrokerTotal[];
  purchasesByAssetClass: AssetClassTotal[];
  totalRealizedPl: number;
  sellCount: number;
  // The share of its sales made at a gain, a fraction from 0 to 1.
  winRate: number;
  holdings: CurrencyHolding[];
}

// GET /insights/holdings/currencies — computed from the transactions on each call (the one
// costly endpoint of the page), never null and never stale.
interface HoldingsByCurrencyResponse {
  currencies: CurrencyDetail[];
}

// GET /positions/{asset_id} — the user's own position in one asset, in `currency` (the
// reference one). Each part is null when it doesn't apply (not held, never sold, never paid);
// `costs` has one row per broker the asset was traded on.
interface PositionResponse {
  currency: string;
  holding: PortfolioHoldingResponse | null;
  realized: RealizedPnlEntryResponse | null;
  dividends: DividendAssetEntry | null;
  costs: AssetCostEntry[];
  isStale: boolean;
}

// GET /insights/dividends
interface DividendsResponse extends ModuleState {
  currency: string;
  totalLifetimeIncome: number;
  totalTrailing12MIncome: number;
  totalPrior12MIncome: number;
  portfolioYieldPct: number | null;
  wholePortfolioYieldPct: number | null;
  payersShareOfPortfolioPct: number | null;
  portfolioYieldOnCostPct: number | null;
  portfolioGrowthYoyPct: number | null;
  byAsset: DividendAssetEntry[];
}

// GET /insights/trading-costs — cumulativeCosts values are money in `currency`, not percent.
interface TradingCostsResponse extends ModuleState {
  currency: string;
  explicitFees: number;
  implicitCosts: number;
  totalCosts: number;
  totalVolume: number;
  totalTransactions: number;
  costRatioBps: number | null;
  costRatioPct: number | null;
  avgCostPerTrade: number | null;
  implicitCostWeightPct: number | null;
  costToEquityPct: number | null;
  annualizedCostDragPct: number | null;
  byPlatform: PlatformCostEntry[];
  byAsset: AssetCostEntry[];
  cumulativeCosts: TimeSeries | null;
}

// GET /insights/realized-pnl — every asset, trading P&L largest first by absolute value, the
// ones that only paid dividends last.
interface RealizedPnlResponse extends ModuleState {
  currency: string;
  totalRealizedPnl: number;
  totalRealizedTradingPnl: number;
  totalDividendIncome: number;
  byAsset: RealizedPnlEntryResponse[];
}

// GET /insights/returns
interface ReturnsResponse extends ModuleState {
  lifespanDays: number;
  totalReturnPct: number | null;
  annualizedReturnPct: number | null;
  maxDrawdownPct: number | null;
  horizons: HorizonEntry[];
  annual: AnnualReturnEntry[];
  bestMonth: MonthReturn | null;
  worstMonth: MonthReturn | null;
  cumulativeReturnPct: TimeSeries | null;
}

// GET /insights/monthly/{YYYY-MM} — one month, from the value at the end of the previous one to
// its own end (today for the month in progress, `inProgress: true`). marketEffect isolates price
// movement from netCapitalContributed; flows are converted at each trade's own date. For the
// portfolio's very first month t0Value is 0 and both percentages come back as exactly 0 (no
// baseline — see hasPeriodBaseline in PerformanceSection.tsx). volatilityPct and maxDrawdownPct
// are null on the month in progress. isStale: see InsightsPerformanceResponse.historyIsStale.
interface PeriodDashboard {
  periodStart: string;
  periodEnd: string;
  t0Value: number;
  t1Value: number;
  deltaValue: number;
  deltaValuePct: number;
  marketEffect: number;
  marketEffectPct: number;
  netCapitalContributed: number;
  tradingCostsInPeriod: number;
  dividendsInPeriod: number;
  volatilityPct: number | null;
  maxDrawdownPct: number | null;
  timeWeightedReturnPct: number | null;
  inProgress: boolean;
  currency: string;
  reportDocumentId: string | null;
  isStale: boolean;
}

// GET /insights/benchmark
interface BenchmarkResponse extends ModuleState {
  components: BenchmarkComponentEntry[];
  tradingDays: number | null;
  yearsCovered: number | null;
  portfolioTotalReturnPct: number | null;
  benchmarkTotalReturnPct: number | null;
  portfolioAnnualizedReturnPct: number | null;
  benchmarkAnnualizedReturnPct: number | null;
  excessReturnPct: number | null;
  portfolioVolatilityPct: number | null;
  benchmarkVolatilityPct: number | null;
  portfolioMaxDrawdownPct: number | null;
  benchmarkMaxDrawdownPct: number | null;
  beta: number | null;
  alphaPct: number | null;
  trackingErrorPct: number | null;
  informationRatio: number | null;
  sharpeRatioDiff: number | null;
  recoveryRatio: number | null;
  winRatePct: number | null;
  timeOutperformingPct: number | null;
  outperformed: boolean | null;
  portfolioCumulativeReturnPct: TimeSeries | null;
  benchmarkCumulativeReturnPct: TimeSeries | null;
}

// GET /insights/volatility — with the drawdown (how far below its previous high the portfolio
// stood each day: 0 at a new high, always ≤0). isStale when either the volatility or the returns
// document is.
interface VolatilityDetailResponse extends ModuleState {
  annualizedVolatilityPct: number | null;
  rollingWindowDays: number | null;
  rollingVolatilityPct: TimeSeries | null;
  riskEvents: RiskEventEntry[];
  drawdownPct: TimeSeries | null;
  maxDrawdownPct: number | null;
}

// GET /insights/risk-model — `correlation` needs only returns, not the optimiser, so it is also
// present with status "unavailable" for no_positive_returns / solver_failed (null for
// too_few_assets). An unavailable model can still carry a null reason (a document stored before
// the field existed), so it needs a generic fallback.
interface RiskModelResponse extends ModuleState {
  unavailableReason: RiskModelUnavailableReason | null;
  riskFreeRatePct: number | null;
  appliedViewsCount: number;
  assets: RiskAssetEntry[];
  current: RiskPortfolioEntry | null;
  maxSharpe: RiskPortfolioEntry | null;
  minVolatility: RiskPortfolioEntry | null;
  frontier: FrontierPointEntry[];
  weightGaps: WeightGapEntry[];
  correlation: CorrelationMatrix | null;
}

// ---------- portfolio comparison ----------

// GET /v1/portfolios/comparison — one entry per compared portfolio, each section a slice of the
// matching single-portfolio document, all in the user's reference currency. A section is null
// until that portfolio has been computed. The aggregate is recomputed from the combined
// transactions, so its column isn't the sum of the others. Compare returns through `horizons`,
// matched by `period` (same window for every portfolio); cumulativeReturnPct starts on each
// portfolio's own first day.
interface ComparisonValue {
  valuedAt: string;
  currency: string;
  marketValue: number;
  investedCapital: number;
  unrealizedPnl: number;
  realizedPnl: number;
  dividendIncome: number;
  netContributed: number;
  tradingCosts: number;
}

interface ComparisonPerformance {
  status: AnalyticsStatus;
  lifespanDays: number;
  totalReturnPct: number | null;
  annualizedReturnPct: number | null;
  maxDrawdownPct: number | null;
  horizons: HorizonEntry[];
  cumulativeReturnPct: TimeSeries | null;
}

interface ComparisonVolatility {
  status: AnalyticsStatus;
  annualizedVolatilityPct: number | null;
}

interface ComparisonAllocationEntry {
  assetClass: string;
  weightPct: number;
  marketValue: number;
}

interface ComparisonDividends {
  totalTrailing12MIncome: number;
  wholePortfolioYieldPct: number | null;
  portfolioYieldOnCostPct: number | null;
}

interface ComparisonTradingCosts {
  totalCosts: number;
  costRatioBps: number | null;
  annualizedCostDragPct: number | null;
}

interface ComparisonBenchmark {
  status: AnalyticsStatus;
  excessReturnPct: number | null;
  alphaPct: number | null;
  beta: number | null;
  trackingErrorPct: number | null;
  informationRatio: number | null;
}

// isStale is per portfolio, same handling as every other document.
interface PortfolioComparisonEntry {
  portfolio: Portfolio;
  isStale: boolean;
  value: ComparisonValue | null;
  performance: ComparisonPerformance | null;
  volatility: ComparisonVolatility | null;
  allocation: ComparisonAllocationEntry[] | null;
  dividends: ComparisonDividends | null;
  tradingCosts: ComparisonTradingCosts | null;
  benchmark: ComparisonBenchmark | null;
}

// ---------- asset detail ----------

// GET /v1/assets/{ticker}?range= — one listed asset's price history and metadata, for any
// authenticated user, held or not. Not an analytics document: read on request (the first call
// for a ticker nobody holds can take a few seconds), never null, no status / isStale. A 404
// (error_type "AssetNotFoundError") means no market-data provider knows the ticker.
type AssetChartRange = "1M" | "6M" | "1Y" | "5Y" | "MAX";

// Follows the range: 1M / 6M daily, 1Y / 5Y weekly, MAX monthly.
type ChartFrequency = "daily" | "weekly" | "monthly";

interface AssetWeightEntryResponse {
  label: string;
  weightPct: number;
}

// prices are adjusted closes in the caller's reference `currency` (each converted at its own
// date's FX rate); quotePrices the same closes unconverted, in quoteCurrency. The first point
// is the close the range starts from, so change over the range is last / first − 1. Weekly /
// monthly points sit on the period's last real close. Both are null only when no close falls
// in the range. sector / industry / country are for single stocks (null for funds, which use
// the weightings instead); terPct for funds. topHoldings is [] for anything but a fund.
interface AssetDetailResponse {
  ticker: string;
  isin: string | null;
  name: string;
  assetClass: string;
  sector: string | null;
  industry: string | null;
  country: string | null;
  terPct: number | null;
  quoteCurrency: string;
  currency: string;
  range: AssetChartRange;
  frequency: ChartFrequency;
  pricesAsOf: string | null;
  prices: TimeSeries | null;
  quotePrices: TimeSeries | null;
  topHoldings: AssetWeightEntryResponse[];
  sectorWeightings: AssetWeightEntryResponse[];
  regionWeightings: AssetWeightEntryResponse[];
}

export type {
  AnalyticsStatus, RiskModelUnavailableReason, WeightGapDirection, TimeSeries, ModuleState,
  PortfolioHoldingResponse, ExposureEntryResponse,
  HorizonEntry, AnnualReturnEntry, MonthReturn, RiskEventEntry,
  DividendAssetEntry, PlatformCostEntry, AssetCostEntry, RealizedPnlEntryResponse,
  BenchmarkComponentEntry,
  RiskAssetEntry, PortfolioWeightEntry, RiskPointResponse, RiskPortfolioEntry, FrontierPointEntry, WeightGapEntry,
  CorrelationMatrix,
  CompositionMemberEntry, PortfolioCorrelationMatrix, AssetHoldingEntry, OverlappingAssetEntry,
  ValuePoint, MonthlyMarketEffectEntry,
  InsightsHoldingsModule, InsightsExposureModule, InsightsPortfoliosModule, InsightsComovementModule, InsightsCompositionResponse,
  InsightsDividendsModule, InsightsTradingCostsModule, InsightsRealizedPnlModule, InsightsIncomeCostsResponse,
  InsightsValueModule, InsightsThisMonthModule, InsightsHeatmapModule, InsightsPerformanceResponse,
  InsightsVolatilityModule, InsightsFrontierModule, InsightsRiskResponse,
  FacetState, InsightsStatusModules, InsightsStatusResponse,
  BrokerTotal, AssetClassTotal, CurrencyHolding, CurrencyDetail, HoldingsByCurrencyResponse,
  PositionResponse, DividendsResponse, TradingCostsResponse, RealizedPnlResponse, ReturnsResponse, PeriodDashboard,
  BenchmarkResponse, VolatilityDetailResponse, RiskModelResponse,
  ComparisonValue, ComparisonPerformance, ComparisonVolatility, ComparisonAllocationEntry,
  ComparisonDividends, ComparisonTradingCosts, ComparisonBenchmark, PortfolioComparisonEntry,
  AssetChartRange, ChartFrequency, AssetWeightEntryResponse, AssetDetailResponse,
};
