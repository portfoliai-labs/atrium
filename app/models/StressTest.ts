// models/StressTest.ts
// Matches StressTestResponse (POST /v1/portfolios/{p}/stress-test): how a past crisis, or shocks
// the user picks, would hit the portfolio as it is today. A simulation: nothing is recorded. Any
// portfolio the user can read: the aggregate, a backtest, a published or shared strategy too. The
// body is one of a crisis or custom shocks (422 otherwise); a shock to the reference currency, or a
// category or currency given twice, is a 400 INVALID_FIELD. Every amount is in `currency`.

import type { StrategyCategory } from "./Strategy";

type StressCrisis = "global_financial" | "covid_crash" | "rate_hikes";

// The "cash" category's shock hits the cash-like funds (money market), not the cash balance: that
// moves only with the currency shocks. changePct is -100 or more.
interface CategoryShock {
  category: StrategyCategory;
  changePct: number;
}

interface CurrencyShock {
  currency: string;
  changePct: number;
}

interface CustomShocks {
  categories: CategoryShock[];
  currencies: CurrencyShock[];
}

type StressTestRequest = { crisis: StressCrisis } | { custom: CustomShocks };

// own_history: the asset's own prices over the crisis; category_proxy: its category's stand-in
// index (proxyTicker, null for cash-like funds); custom_shock: the shocks picked; uncovered: no
// data, kept flat.
type StressSource = "own_history" | "category_proxy" | "custom_shock" | "uncovered";

interface StressPosition {
  assetId: string;
  ticker: string | null;
  listingId: string | null;
  isin: string | null;
  name: string;
  assetCurrency: string;
  category: StrategyCategory | null;
  valueBefore: number;
  valueAfter: number;
  change: number;
  changePct: number;
  source: StressSource;
  proxyTicker: string | null;
}

interface StressCash {
  currency: string;
  // In its own currency.
  amount: number;
  valueBefore: number;
  valueAfter: number;
  covered: boolean;
}

interface StressCategory {
  // null: no category.
  category: StrategyCategory | null;
  valueBefore: number;
  valueAfter: number;
  change: number;
  changePct: number;
  // The change in points of the whole portfolio. "cash" includes the cash balance.
  contributionPct: number;
}

interface StressTest {
  currency: string;
  // The last update the positions come from; null if the portfolio was never updated.
  pricedAt: string | null;
  // The market's peak and trough.
  crisis: { crisis: StressCrisis; startDate: string; endDate: string } | null;
  custom: CustomShocks | null;
  // The total, cash included.
  valueBefore: number;
  valueAfter: number;
  change: number;
  changePct: number;
  // What no data covers, kept flat: the loss shown is understated by it.
  uncoveredValue: number;
  // Largest first.
  positions: StressPosition[];
  cash: StressCash[];
  categories: StressCategory[];
}

const STRESS_CRISES: { crisis: StressCrisis; label: string; startDate: string; endDate: string; detail: string }[] = [
  { crisis: "global_financial", label: "Global financial crisis", startDate: "2007-10-09", endDate: "2009-03-09", detail: "Lehman and the credit crunch: global equities lost more than half" },
  { crisis: "covid_crash", label: "Covid crash", startDate: "2020-02-19", endDate: "2020-03-23", detail: "The pandemic: markets fell by a third in five weeks" },
  { crisis: "rate_hikes", label: "2022 rate hikes", startDate: "2022-01-03", endDate: "2022-10-12", detail: "Inflation and rising rates: bonds fell with equities" },
];

export type {
  StressCrisis, CategoryShock, CurrencyShock, CustomShocks, StressTestRequest, StressSource,
  StressPosition, StressCash, StressCategory, StressTest,
};
export { STRESS_CRISES };
