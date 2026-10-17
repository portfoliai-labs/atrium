// models/InvestorPolicy.ts
// The user's Investor Policy Statement (IPS), filled in step by step from Profile: ianus'
// /users/investor-policy (civis keeps every version). A draft: any field may be unset.

type IpsStepId =
  | "objectives"
  | "risk"
  | "constraints"
  | "allocation"
  | "guidelines"
  | "monitoring"
  | "advisor";

type IpsPurpose = "growth" | "income" | "preservation" | "retirement" | "purchase" | "other";

interface IpsGoal {
  // Only the form's: a key for each row, not stored.
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

type IpsInstrument =
  | "stocks"
  | "etfs"
  | "mutual_funds"
  | "government_bonds"
  | "corporate_bonds"
  | "real_estate_funds"
  | "derivatives"
  | "crypto"
  | "alternatives";
type IpsMeetingMode = "remote" | "in_person";
type IpsFeeModel = "fee_only" | "commission" | "mixed";
type IpsAdvisoryTopic =
  | "retirement"
  | "tax_planning"
  | "estate_planning"
  | "real_estate"
  | "sustainable_investing"
  | "insurance"
  | "business_owners";

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
  // The tax residence isn't here: it is the profile's.
  taxNotes: string;
  otherConstraints: string;
}

interface IpsAllocation {
  // Target weight per asset class, in percent. null = not set; the step is complete at exactly 100.
  targets: Record<AssetClassId, number | null>;
}

interface IpsGuidelines {
  allowedInstruments: IpsInstrument[];
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

// What the investor looks for in an advisor: what advisors are matched on. Empty means any.
interface IpsAdvisorPreferences {
  languages: string[];
  meetingModes: IpsMeetingMode[];
  city: string;
  feeModels: IpsFeeModel[];
  topics: IpsAdvisoryTopic[];
}

interface InvestorPolicy {
  objectives: IpsObjectives;
  risk: IpsRisk;
  constraints: IpsConstraints;
  allocation: IpsAllocation;
  guidelines: IpsGuidelines;
  monitoring: IpsMonitoring;
  advisorPreferences: IpsAdvisorPreferences;
  // The saved version: null for one never saved.
  version: number | null;
  savedAt: string | null;
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
  IpsInstrument,
  IpsMeetingMode,
  IpsFeeModel,
  IpsAdvisoryTopic,
  AssetClassId,
  IpsObjectives,
  IpsRisk,
  IpsConstraints,
  IpsAllocation,
  IpsGuidelines,
  IpsMonitoring,
  IpsAdvisorPreferences,
  InvestorPolicy,
};
