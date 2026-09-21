// models/InvestorPolicy.ts
// The user's Investor Policy Statement (IPS), filled in step by step from Profile.
// Not backed by an API yet: ipsService keeps it in the browser, so this shape is what a
// future endpoint would have to carry.

type IpsStepId =
  | "objectives"
  | "risk"
  | "constraints"
  | "allocation"
  | "guidelines"
  | "monitoring";

type IpsPurpose = "growth" | "income" | "preservation" | "retirement" | "purchase" | "other";

interface IpsGoal {
  id: string;
  description: string;
  targetAmount: number | null;
  targetYear: number | null;
}

type IpsDropReaction = "sell_all" | "sell_some" | "hold" | "buy_more";
type IpsIncomeStability = "stable" | "variable" | "uncertain";
type IpsLiquidityNeed = "low" | "moderate" | "high";
type IpsReviewFrequency = "monthly" | "quarterly" | "semiannual" | "annual";
type IpsRebalanceMethod = "calendar" | "threshold" | "both";

type AssetClassId = "equities" | "bonds" | "cash" | "real_estate" | "commodities" | "crypto_other";

interface IpsObjectives {
  purpose: IpsPurpose | null;
  goals: IpsGoal[];
  targetReturnPct: number | null;
  annualIncomeNeed: number | null;
  monthlyContribution: number | null;
}

interface IpsRisk {
  maxDrawdownPct: number | null;
  dropReaction: IpsDropReaction | null;
  incomeStability: IpsIncomeStability | null;
  emergencyFundMonths: number | null;
}

interface IpsConstraints {
  timeHorizonYears: number | null;
  liquidityNeed: IpsLiquidityNeed | null;
  liquidityNotes: string;
  taxResidence: string;
  taxNotes: string;
  otherConstraints: string;
}

interface IpsAllocation {
  // Target weight per asset class, in percent. null = not set; the step is complete at exactly 100.
  targets: Record<AssetClassId, number | null>;
}

interface IpsGuidelines {
  allowedInstruments: string[];
  leverageAllowed: boolean | null;
  maxPositionPct: number | null;
  exclusions: string[];
}

interface IpsMonitoring {
  reviewFrequency: IpsReviewFrequency | null;
  rebalanceMethod: IpsRebalanceMethod | null;
  // Allowed drift from a target, in percentage points, before rebalancing.
  rebalanceBandPct: number | null;
  benchmark: string;
  reviewTriggers: string;
}

interface InvestorPolicy {
  objectives: IpsObjectives;
  risk: IpsRisk;
  constraints: IpsConstraints;
  allocation: IpsAllocation;
  guidelines: IpsGuidelines;
  monitoring: IpsMonitoring;
  updated_at: string | null;
}

export type {
  IpsStepId,
  IpsPurpose,
  IpsGoal,
  IpsDropReaction,
  IpsIncomeStability,
  IpsLiquidityNeed,
  IpsReviewFrequency,
  IpsRebalanceMethod,
  AssetClassId,
  IpsObjectives,
  IpsRisk,
  IpsConstraints,
  IpsAllocation,
  IpsGuidelines,
  IpsMonitoring,
  InvestorPolicy,
};
