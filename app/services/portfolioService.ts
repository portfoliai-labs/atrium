// services/portfolioService.ts
import type { PortfolioSnapshot, TodayDashboard } from "../models/Portfolio";
import type {
  InsightsCompositionResponse, InsightsIncomeCostsResponse, InsightsPerformanceResponse, InsightsRiskResponse,
  InsightsStatusResponse, HoldingsByCurrencyResponse, PositionResponse, DividendsResponse, TradingCostsResponse,
  RealizedPnlResponse, ReturnsResponse, PeriodDashboard, BenchmarkResponse, VolatilityDetailResponse, RiskModelResponse,
  AssetDetailResponse, AssetChartRange,
} from "../models/PortfolioData";
import { apiFetch } from "./apiClient";

const buildQuery = (params: Record<string, string | number | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const portfolioService = {
  // GET /v1/portfolios/{p}/overview — the latest portfolio-value snapshot. Returns null when
  // there's no snapshot yet, same convention as getTodayDashboard below.
  async getPortfolioOverview(portfolioUuid: string): Promise<PortfolioSnapshot | null> {
    return apiFetch<PortfolioSnapshot | null>(`/v1/portfolios/${portfolioUuid}/overview`);
  },

  // GET /v1/portfolios/{p}/today — today vs. yesterday, and today vs. the start of the current
  // month. Returns null when there's no portfolio history to compute it from (e.g. no
  // transactions yet) — a 200 with a null body, not a 404.
  async getTodayDashboard(portfolioUuid: string): Promise<TodayDashboard | null> {
    return apiFetch<TodayDashboard | null>(`/v1/portfolios/${portfolioUuid}/today`);
  },

  // ---------- the Insights page ----------
  // The main page is four sections, fetched in parallel; each module in a section is null until
  // its document is first computed and carries its own status / isStale (see
  // models/PortfolioData.ts). While anything is stale, poll getInsightsStatus rather than the
  // sections. The detail views each have their own call, made when the view opens.

  // GET /insights/composition — holdings, sector and region exposure, and on the aggregate how
  // its portfolios make it up and move together.
  async getInsightsComposition(portfolioUuid: string): Promise<InsightsCompositionResponse> {
    return apiFetch<InsightsCompositionResponse>(`/v1/portfolios/${portfolioUuid}/insights/composition`);
  },

  // GET /insights/income-costs — dividends, trading costs and realized P&L, each with its 5
  // largest rows.
  async getInsightsIncomeCosts(portfolioUuid: string): Promise<InsightsIncomeCostsResponse> {
    return apiFetch<InsightsIncomeCostsResponse>(`/v1/portfolios/${portfolioUuid}/insights/income-costs`);
  },

  // GET /insights/performance — value over time, this month, headline returns, the monthly
  // heatmap and the benchmark comparison with both curves (the largest section).
  async getInsightsPerformance(portfolioUuid: string): Promise<InsightsPerformanceResponse> {
    return apiFetch<InsightsPerformanceResponse>(`/v1/portfolios/${portfolioUuid}/insights/performance`);
  },

  // GET /insights/risk — volatility with its rolling series, and the efficient frontier.
  async getInsightsRisk(portfolioUuid: string): Promise<InsightsRiskResponse> {
    return apiFetch<InsightsRiskResponse>(`/v1/portfolios/${portfolioUuid}/insights/risk`);
  },

  // GET /insights/status — each module's isStale without the documents: cheap, meant for polling.
  async getInsightsStatus(portfolioUuid: string): Promise<InsightsStatusResponse> {
    return apiFetch<InsightsStatusResponse>(`/v1/portfolios/${portfolioUuid}/insights/status`);
  },

  // GET /insights/holdings/currencies — one entry per currency held, every figure in that
  // currency. Computed from the transactions on each call, so only when its view opens.
  async getHoldingsByCurrency(portfolioUuid: string): Promise<HoldingsByCurrencyResponse> {
    return apiFetch<HoldingsByCurrencyResponse>(`/v1/portfolios/${portfolioUuid}/insights/holdings/currencies`);
  },

  // GET /positions/{asset_id} — the user's own position in one asset (keyed by the holdings'
  // assetId, since a ticker can be null). Pairs with getAssetDetail, which knows no portfolio.
  async getPosition(portfolioUuid: string, assetId: string): Promise<PositionResponse> {
    return apiFetch<PositionResponse>(`/v1/portfolios/${portfolioUuid}/positions/${encodeURIComponent(assetId)}`);
  },

  // GET /insights/dividends — every figure plus every asset that ever paid.
  async getDividends(portfolioUuid: string): Promise<DividendsResponse | null> {
    return apiFetch<DividendsResponse | null>(`/v1/portfolios/${portfolioUuid}/insights/dividends`);
  },

  // GET /insights/trading-costs — the commissions / spread split, the cumulative cost over time,
  // and every platform and asset.
  async getTradingCosts(portfolioUuid: string): Promise<TradingCostsResponse | null> {
    return apiFetch<TradingCostsResponse | null>(`/v1/portfolios/${portfolioUuid}/insights/trading-costs`);
  },

  // GET /insights/realized-pnl — every asset ever sold, in the reference currency.
  async getRealizedPnl(portfolioUuid: string): Promise<RealizedPnlResponse | null> {
    return apiFetch<RealizedPnlResponse | null>(`/v1/portfolios/${portfolioUuid}/insights/realized-pnl`);
  },

  // GET /insights/returns — the growth curve, calendar years, horizons and the extreme months.
  async getReturns(portfolioUuid: string): Promise<ReturnsResponse | null> {
    return apiFetch<ReturnsResponse | null>(`/v1/portfolios/${portfolioUuid}/insights/returns`);
  },

  // GET /insights/monthly/{YYYY-MM} — one month of the heatmap in full. Throws ApiError 404 for
  // a month before the portfolio's history or in the future.
  async getMonth(portfolioUuid: string, year: number, month: number): Promise<PeriodDashboard> {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    return apiFetch<PeriodDashboard>(`/v1/portfolios/${portfolioUuid}/insights/monthly/${key}`);
  },

  // GET /insights/benchmark — side-by-side and relative figures, and the basket.
  async getBenchmark(portfolioUuid: string): Promise<BenchmarkResponse | null> {
    return apiFetch<BenchmarkResponse | null>(`/v1/portfolios/${portfolioUuid}/insights/benchmark`);
  },

  // GET /insights/volatility — the rolling series, the turbulent periods and the drawdown.
  async getVolatility(portfolioUuid: string): Promise<VolatilityDetailResponse | null> {
    return apiFetch<VolatilityDetailResponse | null>(`/v1/portfolios/${portfolioUuid}/insights/volatility`);
  },

  // GET /insights/risk-model — the mixes with their weights, the weight gaps, the per-asset
  // inputs and the correlation matrix. Expected returns are trailing means, not forecasts.
  async getRiskModel(portfolioUuid: string): Promise<RiskModelResponse | null> {
    return apiFetch<RiskModelResponse | null>(`/v1/portfolios/${portfolioUuid}/insights/risk-model`);
  },

  // GET /v1/assets/{ticker}?range= — a listed asset's price history and metadata, not tied to a
  // portfolio. `ticker` is the market-data ticker the holdings rows carry (VWCE.MI, BTC-USD…),
  // not the ISIN; it's URL-encoded since some contain ^ or =. Throws ApiError 404 for a ticker
  // no provider knows.
  async getAssetDetail(ticker: string, range: AssetChartRange = "1Y"): Promise<AssetDetailResponse> {
    return apiFetch<AssetDetailResponse>(`/v1/assets/${encodeURIComponent(ticker)}${buildQuery({ range })}`);
  },
};
