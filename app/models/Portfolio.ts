// models/Portfolio.ts
// Matches TransactionsSummaryResponse / PortfolioOverviewResponse DTOs (GET /v1/portfolios/{p}/overview)

// Matches PortfolioResponse (GET/POST/PATCH /v1/portfolios, GET /v1/portfolios/{p},
// GET/POST /v1/advisor/clients/{client_uuid}/portfolios) — a user can own several of these
// (e.g. "Main portfolio", "Pensione", "Trading"); every dashboard/transactions/alerts/reports
// endpoint is scoped to one via its uuid in the path. Every user (including advisor-created
// clients, advisors themselves, and demo accounts) has exactly one `isDefault` portfolio,
// created at registration and never deletable (DELETE on it is a 409). While a user owns 2+
// portfolios they also get an automatic `isAggregate` one ("All portfolios"): its figures are
// recomputed from every portfolio's transactions combined, it's readable everywhere (incl.
// alert rules) but otherwise read-only — transaction writes, import commit, reports, rename
// and delete all 409. GET /v1/portfolios returns the aggregate first (if any), then the
// default, then oldest first; an advisor lists a client's the same way via
// GET /v1/advisor/clients/{client_uuid}/portfolios, then reaches each through the same
// /v1/portfolios/{p}/... paths the client would.
//
// `isVirtual` marks a portfolio the backend puts together rather than one the user writes: the
// aggregate is one, and so is a strategy's backtest (POST /v1/portfolios/strategies, see
// models/Strategy). Neither takes transactions, imports or reports (409). A backtest can be
// renamed and deleted like a standard portfolio, and it isn't one of the aggregate's members:
// it's simulated money, never counted in the user's wealth.
interface Portfolio {
  uuid: string;
  name: string;
  isDefault: boolean;
  isVirtual: boolean;
  isAggregate: boolean;
  createdAt: string;
}

/** A strategy's backtest: virtual, and not the aggregate. */
const isBacktest = (p: Pick<Portfolio, "isVirtual" | "isAggregate">) => p.isVirtual && !p.isAggregate;

/**
 * The portfolio that stands for all the investments: "All portfolios" while there are two or
 * more, otherwise the only real one (the default).
 */
const investmentsOf = (portfolios: Portfolio[]): Portfolio | undefined =>
  portfolios.find((p) => p.isAggregate) ?? portfolios.find((p) => p.isDefault) ?? portfolios.find((p) => !p.isVirtual);

// A single day's snapshot of the portfolio's live state in one currency — unlike the rest of
// this file, these figures DO come from current market prices (totalMarketValue, totalUnrealizedPnl),
// not just recorded transactions. One entry per currency per day.
//
// Also the exact shape GET /v1/portfolio/ itself returns (the latest one, or null when there's
// no snapshot yet) — that endpoint used to wrap it in a PortfolioOverviewResponse alongside the
// transaction-derived summary and a snapshot history list, both dropped as unused.
interface PortfolioSnapshot {
  snapshotAt: string;
  currency: string;
  totalMarketValue: number;
  totalInvestedCapital: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  totalDividendIncome: number;
}

// Matches DailyValueChangeResponse (one entry of TodayDashboardResponse.chart, and of the
// Insights page's thisMonth.chart) — a day-over-day delta rather than an absolute value.
// Absolute-value context lives in the response's own top-level scalars (currentValue,
// monthStartValue, etc.), not duplicated here.
interface DailyValueChange {
  snapshotAt: string;
  value: number;
  previousValue: number;
  deltaValue: number;
  deltaValuePct: number;
  // The day's change net of flows (buys/sells, costs, dividends) — a purchase isn't a gain here.
  marketEffect: number;
  marketEffectPct: number;
}

// Matches TodayDashboardResponse (GET /v1/portfolio/today) — today vs. yesterday, and
// today vs. the end of the previous month (month-to-date), always in the user's
// reference currency. `chart` is the month-to-date day-over-day deltas (one per day,
// oldest→newest not guaranteed — sort before use); their deltaValue sums to deltaMtdValue.
// The month-to-date figures equal /monthly's last (in-progress) entry. The endpoint returns
// null (not a zeroed-out object) when there's no snapshot history yet to compute this from.
interface TodayDashboard {
  currentValue: number;
  previousDayValue: number;
  deltaDayValue: number;
  deltaDayValuePct: number;
  // deltaDayValue net of flows — "how much the market moved" today.
  dayMarketEffect: number;
  dayMarketEffectPct: number;
  // Value at the end of the previous month, not on the 1st. 0 for a portfolio created this
  // month, in which case deltaMtdValuePct / mtdMarketEffectPct have no baseline.
  monthStartValue: number;
  deltaMtdValue: number;
  deltaMtdValuePct: number;
  mtdNetCapitalContributed: number;
  mtdMarketEffect: number;
  mtdMarketEffectPct: number;
  currency: string;
  chart: DailyValueChange[];
  // True while a transaction edit has landed but the rebuild it triggered hasn't yet: today's
  // value/transactions are already the new portfolio while the past days here are still being
  // rebuilt, so chart/deltas can mix two different portfolios. Don't render them while true —
  // show an "updating" state and refetch every 15s; if it's still true after ~5 minutes, stop
  // polling and show the (possibly still-mixed) data with a "taking longer than usual" hint.
  // Unlike PortfolioSnapshot (from GET /v1/portfolio/, no isStale — never mixes history with
  // fresh data), this endpoint does, hence the flag.
  isStale: boolean;
}

export type { Portfolio, PortfolioSnapshot, DailyValueChange, TodayDashboard };
export { isBacktest, investmentsOf };
