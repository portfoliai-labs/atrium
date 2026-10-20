// lib/classifications.ts
//
// A portfolio's allocations by census' classification (GET /insights/composition's
// `classifications`): what each dimension and value is called, and a dimension as rows of the whole,
// its cash included. What the instruments are, never what the funds hold: the look-through sector
// and region exposure are other breakdowns.

import type {
  AllocationEntryResponse, ClassificationDimension, DimensionAllocationResponse, InsightsClassificationsModule,
} from "../models/PortfolioData";
import { FACTOR_LABELS, REGION_LABELS, SECTOR_LABELS, labelOf, type Factor, type Region, type Sector } from "../models/InstrumentProfile";
import { STRATEGY_CATEGORY_LABELS, type StrategyCategory } from "../models/Strategy";
import { countryName } from "./taxes";

// On the composition card's carousel, beside "By sector" / "By region" (the look-through).
export const DIMENSION_LABELS: Record<ClassificationDimension, string> = {
  category: "By category",
  sector: "By company sector",
  headquarters: "By head office",
  index_region: "By index region",
  index_factors: "By index factor",
};

// The composition's detail: each dimension's panel, and what it reads.
export const DIMENSION_PANELS: Record<ClassificationDimension, { title: string; desc: string }> = {
  category: { title: "By Category", desc: "What each holding is exposed to: equity, bonds, real estate, commodities, cash, crypto." },
  sector: { title: "By Company Sector", desc: "Each share's GICS sector. Funds have none: see By Sector for what they hold." },
  headquarters: { title: "By Head Office", desc: "Where each company has its head office. Funds have none: see By Region for what they hold." },
  index_region: { title: "By Index Region", desc: "The region of the index each fund tracks, as the fund states it, not looked through." },
  index_factors: {
    title: "By Index Factor",
    desc: "The factor tilts of the index each fund tracks. A multi-factor fund counts under each, so the shares add up to more.",
  },
};

export const UNCLASSIFIED_LABEL = "Unclassified";
export const NO_FACTOR = "no_factor";
const CASH_KEY = "\u0000cash";

/** A value as the user reads it: a category, a GICS sector, a country, a region, a factor. */
export function allocationLabel(dimension: ClassificationDimension, value: string | null): string {
  if (value === null) return UNCLASSIFIED_LABEL;
  switch (dimension) {
    case "category": return STRATEGY_CATEGORY_LABELS[value as StrategyCategory] ?? value;
    case "sector": return labelOf(SECTOR_LABELS, value as Sector);
    case "headquarters": return countryName(value);
    case "index_region": return labelOf(REGION_LABELS, value as Region);
    case "index_factors": return value === NO_FACTOR ? "No factor tilt" : labelOf(FACTOR_LABELS, value as Factor);
  }
}

export interface AllocationRow {
  key: string;
  label: string;
  marketValue: number;
  // Of the whole portfolio, its cash included.
  weightPct: number;
  assetCount: number | null;
  isUnclassified: boolean;
  isCash: boolean;
}

/** A dimension's values, the largest first, then the unclassified, then the cash (when there is some). */
export function allocationRows(module: InsightsClassificationsModule, allocation: DimensionAllocationResponse): AllocationRow[] {
  const rows = allocation.entries.map((e: AllocationEntryResponse): AllocationRow => ({
    key: e.value ?? UNCLASSIFIED_LABEL,
    label: allocationLabel(allocation.dimension, e.value),
    marketValue: e.marketValue,
    weightPct: e.weightPct,
    assetCount: e.assetCount,
    isUnclassified: e.value === null,
    isCash: false,
  }));
  if (module.cashWeightPct <= 0) return rows;
  return [...rows, {
    key: CASH_KEY, label: "Cash", marketValue: module.cashValue, weightPct: module.cashWeightPct, assetCount: null,
    isUnclassified: false, isCash: true,
  }];
}

/** The dimension, when the module has it. */
export function dimensionOf(
  module: InsightsClassificationsModule | null | undefined, dimension: ClassificationDimension,
): DimensionAllocationResponse | null {
  return module?.dimensions.find((d) => d.dimension === dimension) ?? null;
}

/** Whether it tells anything: more than one classified value, or one beside the unclassified. */
export function isInformative(allocation: DimensionAllocationResponse | null): boolean {
  if (!allocation) return false;
  const classified = allocation.entries.filter((e) => e.value !== null).length;
  return classified > 1 || (classified === 1 && allocation.entries.length > 1);
}
