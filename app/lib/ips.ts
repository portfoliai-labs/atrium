// app/lib/ips.ts
// Definitions, completion rules and the written-out document for the Investor Policy Statement.
import { CATEGORICAL_PALETTE } from "./chartColors";
import type {
  AssetClassId, InvestorPolicy, IpsDropReaction, IpsIncomeStability, IpsLiquidityNeed,
  IpsPurpose, IpsRebalanceMethod, IpsReviewFrequency, IpsStepId,
} from "../models/InvestorPolicy";

export const IPS_STEPS: { id: IpsStepId; label: string; description: string }[] = [
  { id: "objectives", label: "Objectives", description: "What the portfolio is for and the return it should aim at." },
  { id: "risk", label: "Risk", description: "How much loss you can bear, financially and emotionally." },
  { id: "constraints", label: "Constraints", description: "Time, liquidity, tax and other limits the portfolio has to respect." },
  { id: "allocation", label: "Allocation", description: "The target mix across asset classes." },
  { id: "guidelines", label: "Guidelines", description: "What you will and won't invest in." },
  { id: "monitoring", label: "Monitoring", description: "How and when the policy is reviewed and the portfolio rebalanced." },
];

export interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export const PURPOSE_OPTIONS: Option<IpsPurpose>[] = [
  { value: "growth", label: "Grow my wealth", hint: "Long-term capital growth, no need to draw on it soon." },
  { value: "income", label: "Generate income", hint: "Regular cash flow from the portfolio." },
  { value: "preservation", label: "Preserve capital", hint: "Protect what I have, keep up with inflation." },
  { value: "retirement", label: "Fund retirement", hint: "Build a pot, then live off it." },
  { value: "purchase", label: "Save for a purchase", hint: "A house or another large expense." },
  { value: "other", label: "Something else" },
];

export const DROP_REACTION_OPTIONS: Option<IpsDropReaction>[] = [
  { value: "sell_all", label: "Sell everything", hint: "I couldn't stand the losses." },
  { value: "sell_some", label: "Sell some", hint: "Cut the risk until things settle." },
  { value: "hold", label: "Hold", hint: "Stick to the plan." },
  { value: "buy_more", label: "Buy more", hint: "Prices are lower, so it's an opportunity." },
];

export const INCOME_STABILITY_OPTIONS: Option<IpsIncomeStability>[] = [
  { value: "stable", label: "Stable", hint: "Salary or a pension I can count on." },
  { value: "variable", label: "Variable", hint: "It moves, but I have a good idea of the range." },
  { value: "uncertain", label: "Uncertain", hint: "It could drop or stop." },
];

export const LIQUIDITY_OPTIONS: Option<IpsLiquidityNeed>[] = [
  { value: "low", label: "Low", hint: "I won't need to withdraw for years." },
  { value: "moderate", label: "Moderate", hint: "Some withdrawals are planned." },
  { value: "high", label: "High", hint: "I may need to sell on short notice." },
];

export const REVIEW_OPTIONS: Option<IpsReviewFrequency>[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semiannual", label: "Every 6 months" },
  { value: "annual", label: "Yearly" },
];

export const REBALANCE_OPTIONS: Option<IpsRebalanceMethod>[] = [
  { value: "calendar", label: "On a schedule", hint: "At every review, whatever the drift." },
  { value: "threshold", label: "When it drifts", hint: "Only when a class strays past its band." },
  { value: "both", label: "Both", hint: "At each review, if a class is outside its band." },
];

export const INSTRUMENT_OPTIONS = [
  "Individual stocks", "ETFs", "Mutual funds", "Government bonds", "Corporate bonds",
  "Real estate funds", "Options & derivatives", "Crypto", "Private / alternative funds",
];

export const EXCLUSION_SUGGESTIONS = ["Tobacco", "Weapons", "Fossil fuels", "Gambling", "Adult entertainment"];

// Fixed order and fixed colors: a class keeps its color wherever it appears (the palette is
// validated for these six; a seventh would put magenta beside red, which fails the normal-vision check).
export const ASSET_CLASSES: { id: AssetClassId; label: string; color: string }[] = [
  { id: "equities", label: "Equities", color: CATEGORICAL_PALETTE[0] },
  { id: "bonds", label: "Bonds", color: CATEGORICAL_PALETTE[1] },
  { id: "cash", label: "Cash", color: CATEGORICAL_PALETTE[2] },
  { id: "real_estate", label: "Real estate", color: CATEGORICAL_PALETTE[3] },
  { id: "commodities", label: "Commodities & gold", color: CATEGORICAL_PALETTE[4] },
  { id: "crypto_other", label: "Crypto & other", color: CATEGORICAL_PALETTE[5] },
];

export const ALLOCATION_PRESETS: { id: string; label: string; targets: Record<AssetClassId, number> }[] = [
  { id: "conservative", label: "Conservative 20 / 70 / 10", targets: { equities: 20, bonds: 70, cash: 10, real_estate: 0, commodities: 0, crypto_other: 0 } },
  { id: "balanced", label: "Balanced 60 / 35 / 5", targets: { equities: 60, bonds: 35, cash: 5, real_estate: 0, commodities: 0, crypto_other: 0 } },
  { id: "growth", label: "Growth 80 / 15 / 5", targets: { equities: 80, bonds: 15, cash: 5, real_estate: 0, commodities: 0, crypto_other: 0 } },
];

export const GOAL_LIMIT = 10;

export function optionLabel<T extends string>(options: Option<T>[], value: T | null): string | null {
  return options.find((o) => o.value === value)?.label ?? null;
}

export function emptyPolicy(): InvestorPolicy {
  return {
    objectives: { purpose: null, goals: [], targetReturnPct: null, annualIncomeNeed: null, monthlyContribution: null },
    risk: { maxDrawdownPct: null, dropReaction: null, incomeStability: null, emergencyFundMonths: null },
    constraints: { timeHorizonYears: null, liquidityNeed: null, liquidityNotes: "", taxResidence: "", taxNotes: "", otherConstraints: "" },
    allocation: {
      targets: { equities: null, bonds: null, cash: null, real_estate: null, commodities: null, crypto_other: null },
    },
    guidelines: { allowedInstruments: [], leverageAllowed: null, maxPositionPct: null, exclusions: [] },
    monitoring: { reviewFrequency: null, rebalanceMethod: null, rebalanceBandPct: null, benchmark: "", reviewTriggers: "" },
    updated_at: null,
  };
}

/** Stored policies may predate a field: fill whatever is missing from the empty policy, section by section. */
export function mergeWithDefaults(stored: Partial<InvestorPolicy> | null | undefined): InvestorPolicy {
  const base = emptyPolicy();
  if (!stored || typeof stored !== "object") return base;
  return {
    objectives: { ...base.objectives, ...stored.objectives },
    risk: { ...base.risk, ...stored.risk },
    constraints: { ...base.constraints, ...stored.constraints },
    allocation: { targets: { ...base.allocation.targets, ...stored.allocation?.targets } },
    guidelines: { ...base.guidelines, ...stored.guidelines },
    monitoring: { ...base.monitoring, ...stored.monitoring },
    updated_at: stored.updated_at ?? null,
  };
}

export function allocationTotal(policy: InvestorPolicy): number {
  // Round away float noise from sums like 0.1 + 0.2.
  const sum = Object.values(policy.allocation.targets).reduce<number>((acc, v) => acc + (v ?? 0), 0);
  return Math.round(sum * 100) / 100;
}

/** What is still needed for a step to count as complete; empty means complete. */
export function stepIssues(step: IpsStepId, p: InvestorPolicy): string[] {
  const issues: string[] = [];
  switch (step) {
    case "objectives":
      if (!p.objectives.purpose) issues.push("Choose the main purpose of the portfolio");
      if (p.objectives.goals.length === 0) issues.push("Add at least one goal");
      if (p.objectives.targetReturnPct === null) issues.push("Set a target annual return");
      break;
    case "risk":
      if (p.risk.maxDrawdownPct === null) issues.push("Set the largest loss you could accept");
      if (!p.risk.dropReaction) issues.push("Say how you would react to a 20% fall");
      if (!p.risk.incomeStability) issues.push("Describe how stable your income is");
      break;
    case "constraints":
      if (p.constraints.timeHorizonYears === null) issues.push("Set your time horizon");
      if (!p.constraints.liquidityNeed) issues.push("Choose your liquidity need");
      break;
    case "allocation": {
      const total = allocationTotal(p);
      if (total === 0) issues.push("Set target weights that add up to 100%");
      else if (total !== 100) issues.push(`Weights add up to ${total}%, not 100%`);
      break;
    }
    case "guidelines":
      if (p.guidelines.allowedInstruments.length === 0) issues.push("Choose at least one instrument type you allow");
      break;
    case "monitoring":
      if (!p.monitoring.reviewFrequency) issues.push("Choose how often you review");
      if (!p.monitoring.rebalanceMethod) issues.push("Choose a rebalancing approach");
      else if (p.monitoring.rebalanceMethod !== "calendar" && p.monitoring.rebalanceBandPct === null) {
        issues.push("Set the drift band that triggers a rebalance");
      }
      break;
  }
  return issues;
}

export function completedSteps(p: InvestorPolicy): IpsStepId[] {
  return IPS_STEPS.filter((s) => stepIssues(s.id, p).length === 0).map((s) => s.id);
}

const NOT_SET = "Not specified";

function money(value: number | null, currency: string): string {
  return value === null ? NOT_SET : `${currency} ${value.toLocaleString("en-US")}`;
}

function pct(value: number | null): string {
  return value === null ? NOT_SET : `${value}%`;
}

function text(value: string): string {
  return value.trim() || NOT_SET;
}

function list(values: string[]): string {
  return values.length ? values.join(", ") : NOT_SET;
}

export interface PolicySection {
  id: IpsStepId;
  title: string;
  rows: { label: string; value: string }[];
}

interface PolicyContext {
  currency: string;
  // The general risk tolerance from the profile, already worded for display (e.g. "Moderate").
  riskTolerance: string | null;
}

/** The policy written out, one section per step; the on-screen document and the Markdown both come from it. */
export function policySections(p: InvestorPolicy, ctx: PolicyContext): PolicySection[] {
  const { currency } = ctx;
  const band = p.monitoring.rebalanceBandPct;
  const row = (label: string, value: string) => ({ label, value });

  const goals = p.objectives.goals.map((g) => {
    const extras = [
      g.targetAmount !== null ? money(g.targetAmount, currency) : null,
      g.targetYear !== null ? `by ${g.targetYear}` : null,
    ].filter(Boolean);
    return row("Goal", `${g.description.trim() || "Untitled goal"}${extras.length ? ` (${extras.join(", ")})` : ""}`);
  });

  const allocation = ASSET_CLASSES
    .filter((c) => (p.allocation.targets[c.id] ?? 0) > 0)
    .map((c) => row(c.label, `${p.allocation.targets[c.id]}%${band !== null ? ` (±${band} pts)` : ""}`));

  return [
    {
      id: "objectives",
      title: "Objectives",
      rows: [
        row("Purpose", optionLabel(PURPOSE_OPTIONS, p.objectives.purpose) ?? NOT_SET),
        ...(goals.length ? goals : [row("Goals", NOT_SET)]),
        row("Target annual return", pct(p.objectives.targetReturnPct)),
        row("Income needed per year", money(p.objectives.annualIncomeNeed, currency)),
        row("Contribution per month", money(p.objectives.monthlyContribution, currency)),
      ],
    },
    {
      id: "risk",
      title: "Risk",
      rows: [
        ...(ctx.riskTolerance ? [row("General risk tolerance", ctx.riskTolerance)] : []),
        row("Largest acceptable loss", pct(p.risk.maxDrawdownPct)),
        row("Reaction to a 20% fall", optionLabel(DROP_REACTION_OPTIONS, p.risk.dropReaction) ?? NOT_SET),
        row("Income stability", optionLabel(INCOME_STABILITY_OPTIONS, p.risk.incomeStability) ?? NOT_SET),
        row("Emergency fund", p.risk.emergencyFundMonths === null ? NOT_SET : `${p.risk.emergencyFundMonths} months of expenses`),
      ],
    },
    {
      id: "constraints",
      title: "Constraints",
      rows: [
        row("Time horizon", p.constraints.timeHorizonYears === null ? NOT_SET : `${p.constraints.timeHorizonYears} years`),
        row("Liquidity need", optionLabel(LIQUIDITY_OPTIONS, p.constraints.liquidityNeed) ?? NOT_SET),
        ...(p.constraints.liquidityNotes.trim() ? [row("Liquidity notes", p.constraints.liquidityNotes.trim())] : []),
        row("Tax residence", text(p.constraints.taxResidence)),
        ...(p.constraints.taxNotes.trim() ? [row("Tax notes", p.constraints.taxNotes.trim())] : []),
        ...(p.constraints.otherConstraints.trim() ? [row("Other constraints", p.constraints.otherConstraints.trim())] : []),
      ],
    },
    {
      id: "allocation",
      title: "Strategic asset allocation",
      rows: allocation.length ? [...allocation, row("Total", `${allocationTotal(p)}%`)] : [row("Target weights", NOT_SET)],
    },
    {
      id: "guidelines",
      title: "Investment guidelines",
      rows: [
        row("Allowed instruments", list(p.guidelines.allowedInstruments)),
        row("Leverage", p.guidelines.leverageAllowed === null ? NOT_SET : p.guidelines.leverageAllowed ? "Allowed" : "Not allowed"),
        row("Largest single position", pct(p.guidelines.maxPositionPct)),
        row("Exclusions", list(p.guidelines.exclusions)),
      ],
    },
    {
      id: "monitoring",
      title: "Monitoring & rebalancing",
      rows: [
        row("Review frequency", optionLabel(REVIEW_OPTIONS, p.monitoring.reviewFrequency) ?? NOT_SET),
        row("Rebalancing", optionLabel(REBALANCE_OPTIONS, p.monitoring.rebalanceMethod) ?? NOT_SET),
        ...(p.monitoring.rebalanceMethod !== "calendar" ? [row("Drift band", band === null ? NOT_SET : `±${band} percentage points`)] : []),
        row("Benchmark", text(p.monitoring.benchmark)),
        ...(p.monitoring.reviewTriggers.trim() ? [row("Review triggers", p.monitoring.reviewTriggers.trim())] : []),
      ],
    },
  ];
}

export function policyToMarkdown(p: InvestorPolicy, ctx: PolicyContext): string {
  const body = policySections(p, ctx).flatMap((s, i) => [
    `## ${i + 1}. ${s.title}`,
    "",
    ...s.rows.map((r) => `- **${r.label}:** ${r.value}`),
    "",
  ]);
  return ["# Investor Policy Statement", "", ...body].join("\n");
}
