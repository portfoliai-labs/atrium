// models/Rates.ts
// Matches /v1/rates (ianus 0.18, mercurius' market rates): central banks' policy rates, government
// yield curves and the overnight benchmarks. Dates are YYYY-MM-DD and every rate is in percent.
// Each call answers one entry per distinct code, in the order asked; a code nobody knows comes back
// with found: false (not an error).

import type { TimeSeries } from "./PortfolioData";

/** A currency's central bank rate (EUR → the ECB…). `changes` only with history=true. */
export interface PolicyRate {
  currency: string;
  found: boolean;
  centralBank: string | null;
  rate: number | null;
  // When the rate took its current level.
  since: string | null;
  asOf: string | null;
  changes: TimeSeries | null;
}

export interface YieldPoint {
  tenorMonths: number;
  yieldPct: number;
}

/**
 * An area's government curve: a country (IT, DE, US…) or XM, the euro area's AAA curve. US, XM, DE,
 * GB and JP are full daily curves; the other EU countries and CH, CA, AU, NZ, NO, KR, MX, ZA, IL, CL
 * are one 10-year point, a monthly average. `description` names the source, to show by the data.
 */
export interface YieldCurve {
  area: string;
  found: boolean;
  currency: string | null;
  description: string | null;
  asOf: string | null;
  points: YieldPoint[];
}

export interface YieldHistory {
  area: string;
  tenorMonths: number;
  yields: TimeSeries | null;
}

// Only these two: Euribor needs an EMMI licence, so it isn't served.
export type BenchmarkCode = "ESTR" | "SOFR";

/** An overnight benchmark's fixing. `fixings` only with history=true; `administrator` is its source. */
export interface Benchmark {
  benchmark: string;
  found: boolean;
  currency: string | null;
  administrator: string | null;
  rate: number | null;
  asOf: string | null;
  fixings: TimeSeries | null;
}
