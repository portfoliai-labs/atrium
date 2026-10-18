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

// The mean daily volume, in shares, of the last `sessions` sessions up to `asOf` (YYYY-MM-DD).
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
  // ISO 4217: the listing's, the market cap's.
  currency: string;
  marketCap: MarketCap | null;
  averageVolume: AverageVolume | null;
  risk: RiskStatistics | null;
}

// A figure's provider, as its citation names it.
export const MARKET_DATA_SOURCE_LABELS: Record<string, string> = {
  yahoo_finance: "Yahoo Finance",
  onvista: "onvista",
};
