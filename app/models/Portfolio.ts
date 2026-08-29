// models/Portfolio.ts
// Matches TransactionsSummaryResponse / PortfolioOverviewResponse DTOs (GET /v1/portfolio/)

// A single asset currently held, aggregated across all of the user's processed transactions.
// Every field here is derived purely from transaction input data (quantity, price paid, fees,
// broker, currency, asset class) — never from current market prices/values.
interface Holding {
  ticker: string | null;
  isin: string | null;
  name: string;
  assetClass: string;
  // String, not number — arbitrary decimal precision (e.g. crypto quantities)
  quantity: string;
  investedValue: number;
  currency: string;
  fees: number;
  broker: string | null;
}

interface BrokerTotal {
  broker: string;
  totalInvested: number;
}

interface AssetClassTotal {
  assetClass: string;
  totalInvested: number;
}

interface BrokerFeesTotal {
  broker: string;
  totalFees: number;
}

// All monetary figures in here share one currency. A ticker's underlying currency isn't
// something the app can convert (no live FX rate), so every aggregate — total invested,
// fees, broker/asset-class breakdowns, realized P&L — is scoped to a single currency rather
// than summed across them. One of these exists per currency actually present in the portfolio.
interface CurrencyBreakdown {
  currency: string;
  totalInvested: number;
  totalFeesPaid: number;
  holdingsCount: number;
  purchasesByBroker: BrokerTotal[];
  purchasesByAssetClass: AssetClassTotal[];
  feesByBroker: BrokerFeesTotal[];
  totalRealizedPl: number;
  sellCount: number;
  winRate: number;
}

// Every closed round-trip for one asset, aggregated together (not one row per individual
// sell) — cost/proceeds/P&L summed across every sell of this asset, profit/loss derived
// entirely from the buy/sell prices recorded in the transactions, never from a current quote.
interface AssetRealizedTrade {
  assetId: string;
  ticker: string | null;
  name: string;
  assetClass: string;
  currency: string;
  // String, not number — arbitrary decimal precision (e.g. crypto quantities)
  quantitySold: string;
  totalCost: number;
  totalProceeds: number;
  realizedPl: number;
  sellCount: number;
  winRate: number;
}

// Matches TransactionsSummaryResponse
interface PortfolioSummary {
  // Every holding across every currency — safe to list or filter, never summed as one figure.
  holdings: Holding[];
  // One entry per currency present in the portfolio.
  byCurrency: CurrencyBreakdown[];
  // Every asset with at least one closed round-trip, across every currency — filter by
  // currency before pairing with a CurrencyBreakdown, same rule as `holdings`.
  realizedTradesByAsset: AssetRealizedTrade[];
}

// A single day's snapshot of the portfolio's live state in one currency — unlike the rest of
// this file, these figures DO come from current market prices (totalMarketValue, totalUnrealizedPnl),
// not just recorded transactions. One entry per currency per day.
interface PortfolioSnapshot {
  snapshotAt: string;
  currency: string;
  totalMarketValue: number;
  totalInvestedCapital: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  totalDividendIncome: number;
}

// Matches PortfolioOverviewResponse (GET /v1/portfolio/)
interface PortfolioOverview {
  summary: PortfolioSummary;
  // Newest-first or oldest-first isn't guaranteed by the backend — sort before relying on order.
  // Defaults to the last 90 days unless date_from/date_to were passed to the request.
  snapshots: PortfolioSnapshot[];
}

export type {
  Holding, PortfolioSummary, PortfolioSnapshot, PortfolioOverview,
  CurrencyBreakdown, BrokerTotal, AssetClassTotal, BrokerFeesTotal, AssetRealizedTrade,
};
