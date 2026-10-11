// lib/realEstate.ts
//
// REAL ESTATE — what every real estate page shares: the names of kinds, uses and transactions, and
// where a page reads its figures from (a RealEstateSource: the API, or a demo account's sample
// data, see lib/mock/realEstate).

import type {
  CostKind, ExpenseKind, InstalmentFrequency, Mortgage, MortgageSchedule, PrepaymentEffect, PropertyKind,
  PropertyTransactionFilters, PropertyTransactionKind, PropertyTransactionList, PropertyUse, RateIndex,
  RealEstateOverview, RealEstateSummary, Valuation, ValuationSource,
} from "../models/RealEstate";
import { realEstateService } from "../services/realEstateService";

export const PROPERTY_KIND_LABELS: Record<PropertyKind, string> = {
  apartment: "Apartment",
  house: "House",
  commercial: "Commercial",
  garage: "Garage",
  land: "Land",
  other: "Other",
};
export const PROPERTY_KINDS = Object.keys(PROPERTY_KIND_LABELS) as PropertyKind[];

export const PROPERTY_USE_LABELS: Record<PropertyUse, string> = {
  primary_residence: "Primary residence",
  second_home: "Second home",
  long_term_rental: "Long-term rental",
  short_term_rental: "Short-term rental",
  vacant: "Vacant",
};
export const PROPERTY_USES = Object.keys(PROPERTY_USE_LABELS) as PropertyUse[];

export const TRANSACTION_KIND_LABELS: Record<PropertyTransactionKind, string> = {
  purchase: "Purchase",
  purchase_cost: "Purchase cost",
  sale: "Sale",
  sale_cost: "Sale cost",
  rent: "Rent",
  short_stay_payout: "Short-stay payout",
  expense: "Expense",
  works: "Works",
  property_tax: "Property tax",
  mortgage_instalment: "Mortgage instalment",
  mortgage_prepayment: "Mortgage prepayment",
};

export const COST_KIND_LABELS: Record<CostKind, string> = {
  notary: "Notary",
  agency: "Agency",
  taxes: "Registration & taxes",
  other: "Other",
};

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  condo_fees: "Condo fees",
  insurance: "Insurance",
  maintenance: "Maintenance",
  utilities: "Utilities",
  management: "Agency / management",
  furnishing: "Furnishing",
  other: "Other",
};

export const PREPAYMENT_EFFECT_LABELS: Record<PrepaymentEffect, string> = {
  reduce_instalment: "Smaller instalments",
  shorten_term: "Shorter term",
};

export const FREQUENCY_LABELS: Record<InstalmentFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semiannual: "Every six months",
};

/** Instalments a year, by frequency. */
export const INSTALMENTS_PER_YEAR: Record<InstalmentFrequency, number> = { monthly: 12, quarterly: 4, semiannual: 2 };

export const RATE_INDEX_LABELS: Record<RateIndex, string> = {
  euribor_1m: "Euribor 1M",
  euribor_3m: "Euribor 3M",
  euribor_6m: "Euribor 6M",
  sofr: "SOFR",
  other: "Other",
};

export const VALUATION_SOURCE_LABELS: Record<ValuationSource, string> = {
  user_estimate: "Your estimate",
  appraisal: "Appraisal",
  purchase_price: "Purchase price",
};

/** Energy ratings offered on the form (any other can be typed). */
export const ENERGY_RATINGS = ["A4", "A3", "A2", "A1", "B", "C", "D", "E", "F", "G"];

const SQFT_PER_SQM = 10.7639;
export const sqmToSqft = (sqm: number) => sqm * SQFT_PER_SQM;
export const sqftToSqm = (sqft: number) => sqft / SQFT_PER_SQM;

// ── Where the figures come from ──

/**
 * Where a real estate page reads from: the API (apiRealEstateSource) or, for a demo account, the
 * sample data (lib/mock/realEstate's demoRealEstateSource), in the same shapes. The properties
 * themselves come from RealEstateContext. Writes always go to realEstateService: a demo account's
 * are refused (see lib/demo).
 */
export interface RealEstateSource {
  overview(): Promise<RealEstateOverview>;
  summary(propertyUuid: string | null, from?: string, to?: string): Promise<RealEstateSummary>;
  transactions(propertyUuid: string | null, filters?: PropertyTransactionFilters): Promise<PropertyTransactionList>;
  mortgages(propertyUuid: string | null): Promise<Mortgage[]>;
  schedule(mortgageUuid: string): Promise<MortgageSchedule>;
  valuations(propertyUuid: string): Promise<Valuation[]>;
}

export const apiRealEstateSource: RealEstateSource = {
  overview: () => realEstateService.overview(),
  summary: (propertyUuid, from, to) => realEstateService.summary(propertyUuid, from, to),
  transactions: (propertyUuid, filters) => realEstateService.transactions(propertyUuid, filters),
  mortgages: (propertyUuid) => realEstateService.mortgages(propertyUuid),
  schedule: (mortgageUuid) => realEstateService.schedule(mortgageUuid),
  valuations: (propertyUuid) => realEstateService.valuations(propertyUuid),
};
