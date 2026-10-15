// models/Projection.ts
// Matches ProjectionResponse (POST /v1/portfolios/{p}/projection): a Monte Carlo of where the
// portfolio as it is could go, nothing recorded. Any portfolio the caller can read (the owner's,
// an advisor's client's, a shared backtest), as the stress test. The body asks one question, a
// goal, whether withdrawals survive, or the safe withdrawal (422 without exactly one). Inputs are
// in today's money (targetAmount, monthlyContribution, monthlyWithdrawal), grown by the simulated
// inflation month by month from today; every balance in the response is nominal at the time it
// refers to, in `currency`, so not comparable with the inputs without deflating. A goal is reached
// when the balance passes the target grown by inflation to that month. The same request on the
// same data gives the same answer. 409 ProjectionHistoryTooShortError (metadata `months`,
// `min_months` "12", strings) when the positions held have under 12 months of returns together;
// `months` "0" when nothing is held, or before the portfolio's first rebuild (nightly at 04:00,
// and after every edit).

// Will the portfolio reach targetAmount, and when? Without a horizon, within 50 years.
interface GoalRequest {
  targetAmount: number;
  monthlyContribution?: number;
  // 1–60.
  targetHorizonYears?: number;
}

// Does monthlyWithdrawal last horizonYears, from yearsUntilRetirement on (adding
// monthlyContribution until then)? horizonYears + yearsUntilRetirement ≤ 60.
interface SurvivalRequest {
  monthlyWithdrawal: number;
  horizonYears: number;
  yearsUntilRetirement?: number;
  monthlyContribution?: number;
}

// The largest monthly withdrawal that lasts horizonYears in targetSuccessPct of the runs (50–99,
// 90 by default).
interface SafeWithdrawalRequest {
  horizonYears: number;
  yearsUntilRetirement?: number;
  monthlyContribution?: number;
  targetSuccessPct?: number;
}

type ProjectionRequest = { goal: GoalRequest } | { survival: SurvivalRequest } | { safeWithdrawal: SafeWithdrawalRequest };

// What the runs rest on.
interface ProjectionBasis {
  simulations: number;
  historyMonths: number;
  // The positions' own annual return over their history.
  ownReturnPct: number;
  // With under 5 years of history, the benchmark's mean the returns are re-centered on; else null.
  longRunReturnPct: number | null;
  simulatedReturnPct: number;
  // Whether the 10%-a-year ceiling cut it.
  capped: boolean;
  // The cash's share, earning 0%.
  cashPct: number;
  inflationPct: number;
  inflationStdPct: number;
}

// One year's end (year 1 the first): the balance's percentiles, and the probability so far (a
// goal: reached by then; survival: run out by then).
interface ProjectionYear {
  year: number;
  balanceP10: number;
  balanceP50: number;
  balanceP90: number;
  probabilityPct: number;
}

interface GoalResult {
  // 50, or the deadline.
  maxHorizonYears: number;
  probabilityPct: number;
  // With a deadline: reached by then.
  deadlineProbabilityPct: number | null;
  // null: not reached within the horizon at that percentile.
  monthsToGoalP10: number | null;
  monthsToGoalP50: number | null;
  monthsToGoalP90: number | null;
  years: ProjectionYear[];
}

interface SurvivalResult {
  successPct: number;
  // null when retiring at once.
  medianBalanceAtRetirement: number | null;
  endingBalanceP10: number;
  endingBalanceP25: number;
  endingBalanceP50: number;
  endingBalanceP75: number;
  endingBalanceP90: number;
  // From retirement.
  years: ProjectionYear[];
}

interface SafeWithdrawalResult {
  // In today's money: each withdrawal is it grown by inflation, from today (so already grown once
  // withdrawals start, after an accumulation).
  monthlyWithdrawal: number;
  // monthlyWithdrawal × 12 over the balance it's drawn from: initialValue, or after an
  // accumulation medianBalanceAtRetirement (nominal then).
  annualWithdrawalRatePct: number;
  targetSuccessPct: number;
  achievedSuccessPct: number;
  // false: the search stopped short of the target.
  converged: boolean;
  medianBalanceAtRetirement: number | null;
}

interface Projection {
  currency: string;
  pricedAt: string | null;
  returnsComputedAt: string | null;
  // Cash included.
  initialValue: number;
  basis: ProjectionBasis;
  // Exactly one is set: the question asked.
  goal: GoalResult | null;
  survival: SurvivalResult | null;
  safeWithdrawal: SafeWithdrawalResult | null;
}

// The 409's error_type.
const PROJECTION_HISTORY_TOO_SHORT = "ProjectionHistoryTooShortError";
const PROJECTION_MIN_MONTHS = 12;
const PROJECTION_MAX_YEARS = 60;

export type {
  GoalRequest, SurvivalRequest, SafeWithdrawalRequest, ProjectionRequest, ProjectionBasis, ProjectionYear,
  GoalResult, SurvivalResult, SafeWithdrawalResult, Projection,
};
export { PROJECTION_HISTORY_TOO_SHORT, PROJECTION_MIN_MONTHS, PROJECTION_MAX_YEARS };
