// models/MarketData.ts
// GET /v1/assets/{listing_id}/market-data: a listing's market data, apart from its key facts.
// Each figure null where its data doesn't give it, each with its source.

// A company's shares outstanding (the provider's, `source`: yahoo_finance) times the listing's
// current price, in the response's currency.
export interface MarketCap {
  value: number;
  sharesOutstanding: number;
  price: number;
  priceTime: string;
  source: string;
}

// The provider's quote, a few minutes old at most: the last session (as of `marketTime`) and the
// 52 weeks' range. Prices in the response's currency; volume in shares (null for a crypto).
export interface Quote {
  previousClose: number | null;
  open: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  volume: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  marketTime: string | null;
  source: string;
}

// A company's per-share figures (the provider's) and, at the current price, the P/E (null
// without a positive EPS) and the forward dividend's yield (%). `earningsDate` YYYY-MM-DD.
export interface Valuation {
  trailingEps: number | null;
  peRatio: number | null;
  dividendRate: number | null;
  dividendYieldPct: number | null;
  earningsDate: string | null;
  earningsDateEstimated: boolean;
  targetMeanPrice: number | null;
  source: string;
}

// The mean daily volume, in shares, of the last `sessions` sessions (three months) up to `asOf`
// (YYYY-MM-DD).
export interface AverageVolume {
  shares: number;
  sessions: number;
  asOf: string;
  source: string;
}

// The central bank's policy rate of the listing's currency, its mean over the window, % a year.
export interface RiskFreeRate {
  currency: string;
  centralBank: string;
  meanRatePct: number;
}

// Computed by the platform (`source`: computed) from the listing's daily closes between `start`
// and `end`: simple daily returns, volatility annualized by the square root of
// `observationsPerYear`, return geometric (CAGR), drawdown from the running peak (negative),
// Sharpe the return less `riskFreeRate` over the volatility. Percent.
export interface RiskStatistics {
  start: string;
  end: string;
  windowMonths: number;
  minimumMonths: number;
  observations: number;
  observationsPerYear: number;
  annualizedReturnPct: number;
  annualizedVolatilityPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number | null;
  riskFreeRate: RiskFreeRate | null;
  source: "computed";
}

export interface AssetMarketData {
  // ISO 4217: the listing's, every price's (a London listing's pence as pounds).
  currency: string;
  quote: Quote | null;
  marketCap: MarketCap | null;
  valuation: Valuation | null;
  averageVolume: AverageVolume | null;
  risk: RiskStatistics | null;
}

// A figure's provider, as its citation names it.
export const MARKET_DATA_SOURCE_LABELS: Record<string, string> = {
  yahoo_finance: "Yahoo Finance",
  onvista: "onvista",
};
