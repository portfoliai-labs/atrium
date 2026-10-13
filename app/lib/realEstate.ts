// lib/realEstate.ts
//
// REAL ESTATE — what every real estate page shares: the names of kinds, uses and transactions, and
// where a page reads its figures from (a RealEstateSource: the API, or a demo account's sample
// data, see lib/mock/realEstate).

import type {
  CostKind, ExpenseKind, HolderKind, InstalmentFrequency, Mortgage, MortgageSchedule, Municipality, NotComputedReason,
  PrepaymentEffect, PropertyKind, PropertyTransactionFilters, PropertyTransactionKind, PropertyTransactionList, PropertyUse,
  RateIndex, RateSource, RealEstateOverview, RealEstateSummary, RentalContract, RentalContractKind, TaxList, TaxReduction,
  TaxRegime, TaxpayerYear, Valuation, ValuationSource, AcquisitionKind, IncentiveKind, PropertyTax, SaleSimulationRequest,
} from "../models/RealEstate";
import { realEstateService } from "../services/realEstateService";
import { ApiError } from "../services/apiClient";

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
  free_loan: "Lent free (comodato)",
  uninhabitable: "Uninhabitable",
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
  income_tax: "Tax on rents",
  capital_gains_tax: "Tax on a sale's gain",
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

export const HOLDER_KIND_LABELS: Record<HolderKind, string> = { person: "A person", company: "A company" };

export const ACQUISITION_KIND_LABELS: Record<AcquisitionKind, string> = {
  purchase: "Bought (before tracking it here)",
  inheritance: "Inherited",
  donation: "Donated to me",
};

export const INCENTIVE_KIND_LABELS: Record<IncentiveKind, string> = {
  superbonus_110_transferred: "Superbonus 110%, credit transferred or discounted",
  superbonus: "Superbonus, deducted in the return",
  other: "Another incentive (50% bonus, ecobonus…)",
};

// ── Taxes (Italy's IMU) ──

// What each rate class means (the country's names: Italy's).
export const RATE_CLASS_LABELS: Record<string, string> = {
  primary_residence: "Primary residence: exempt",
  primary_residence_luxury: "Luxury primary residence (A/1, A/8, A/9)",
  appurtenance: "Appurtenance of the primary residence: exempt",
  exempt_category: "Exempt category (group E)",
  rural: "Rural building (D/10)",
  group_d: "Productive building (group D)",
  other_buildings: "Other buildings",
  // The rents' tax.
  flat_rate: "Cedolare secca, 21%",
  flat_rate_agreed: "Cedolare secca on an agreed rent, 10%",
  flat_rate_short_stay: "Cedolare secca on short stays, 21%",
  flat_rate_short_stay_other: "Cedolare secca on short stays, 26% (a further apartment)",
  ordinary: "IRPEF, at your rates",
  // A sale's gain.
  substitute_tax: "Substitute tax at the deed, 26%",
  inherited: "Inherited: a sale's gain is never taxed",
  outside_window: "Held long enough: the gain isn't taxed",
};
export const rateClassLabel = (c: string) => RATE_CLASS_LABELS[c] ?? c.replaceAll("_", " ");

export const REDUCTION_LABELS: Record<TaxReduction, string> = {
  historic: "Historic building: half the base",
  uninhabitable: "Uninhabitable: half the base",
  free_loan_to_relative: "Lent to a relative: half the base",
  agreed_rent: "Agreed rent",
};

/** Where a period's rate comes from, as a sentence. */
export function rateSourceText(source: RateSource, year: number, rateYear: number | null) {
  switch (source) {
    case "user": return "Your rate";
    case "municipality": return `The municipality's ${year} rate`;
    case "municipality_earlier_year": return `The municipality's ${rateYear ?? "earlier"} rate: none published for ${year} yet`;
    case "legal": return "The legal rate: the municipality hasn't published one";
    case "exempt": return "Exempt";
  }
}

export const NOT_COMPUTED_TEXT: Record<NotComputedReason, string> = {
  missing_details: "Some land registry details are missing.",
  unsupported_property: "Not computed for this property: land, a category F unit, a region with its own tax, or a currency other than euro.",
  unsupported_year: "Not computed for that year.",
  business_activity: "Short stays in more apartments than a person may let in the year: it's a business's income, not worked out here.",
};

export const RENTAL_CONTRACT_KIND_LABELS: Record<RentalContractKind, string> = {
  residential: "Free rent (4+4)",
  agreed: "Agreed rent (3+2)",
  transitional: "Transitional",
  student: "Students",
  commercial: "Commercial",
};
export const RENTAL_CONTRACT_KINDS = Object.keys(RENTAL_CONTRACT_KIND_LABELS) as RentalContractKind[];
// The kinds at an agreed rent, Italy's only: IMU at 75%, and the cedolare at 10% where housing is tight.
export const AGREED_KINDS: RentalContractKind[] = ["agreed", "transitional", "student"];

export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  flat_rate: "Cedolare secca",
  ordinary: "IRPEF",
};

// The fields as the API names them (PATCH /properties, errors' `field`), as the form shows them.
export const PROPERTY_FIELD_LABELS: Record<string, string> = {
  name: "Name", kind: "Kind", use: "Use", address: "Address", "address.country": "Country", "address.street": "Street",
  "address.locality": "Town", "address.region": "Region", "address.postalCode": "Postal code", "address.neighbourhood": "Neighbourhood",
  "address.location": "Location", currency: "Currency", surfaceSqm: "Surface", rooms: "Rooms", yearBuilt: "Year built",
  energyRating: "Energy rating", ownershipSharePct: "Your share", note: "Note", details: "Land registry",
  "details.municipalityCode": "Municipality", "details.cadastralCategory": "Cadastral category", "details.cadastralIncome": "Cadastral income",
  "details.cadastralSheet": "Sheet", "details.cadastralParcel": "Parcel", "details.cadastralSubunit": "Subunit",
  "holder.name": "Holder's name", appurtenantToUuid: "Belongs to", effectiveOn: "From", ratePct: "Rate", year: "Year",
  // Leases and taxpayers.
  startsOn: "Start", endsOn: "End", monthlyRent: "Monthly rent", taxRegime: "Tax regime",
  highTensionMunicipality: "High housing tension", tenant: "Tenant", "taxpayer.otherIncome": "Your other income",
  otherIncome: "Other income", surchargesPct: "Surcharges", reducedRatePropertyUuid: "Short stays at 21%",
  shortStayRegime: "Short stays' regime", holderName: "Taxpayer", platformFee: "Platform fee", taxWithheld: "Tax withheld",
  // Sales.
  purchase: "The purchase", "acquisition.kind": "How you got it", "acquisition.acquiredOn": "The day you got it",
  "acquisition.donorPurchasedOn": "The donor's purchase day", "acquisition.donorCost": "The donor's cost",
  "works.worksCompletedOn": "The day the works ended", soldOn: "The sale's day", price: "The sale price",
};
export const fieldLabel = (field: string) => PROPERTY_FIELD_LABELS[field] ?? field;

/** An API error's text, led by the field it names (InvalidPropertyError's `field`…), or `fallback`. */
export function fieldErrorText(err: unknown, fallback: string) {
  if (!(err instanceof Error) || !err.message) return fallback;
  const field = err instanceof ApiError ? err.metadata.field : undefined;
  return field ? `${fieldLabel(field)}: ${err.message}` : err.message;
}

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
  // Every property's of the year (archived ones too when asked), or one's.
  taxes(propertyUuid: string | null, year?: number, includeArchived?: boolean): Promise<TaxList>;
  municipalities(query: { search?: string; codes?: string[] }): Promise<Municipality[]>;
  // Every property's leases (archived ones' too), or one's, by start.
  rentalContracts(propertyUuid: string | null): Promise<RentalContract[]>;
  // A year's, or every year's.
  taxpayerYears(year?: number): Promise<TaxpayerYear[]>;
  simulateSale(propertyUuid: string, request: SaleSimulationRequest): Promise<PropertyTax | null>;
}

export const apiRealEstateSource: RealEstateSource = {
  overview: () => realEstateService.overview(),
  summary: (propertyUuid, from, to) => realEstateService.summary(propertyUuid, from, to),
  transactions: (propertyUuid, filters) => realEstateService.transactions(propertyUuid, filters),
  mortgages: (propertyUuid) => realEstateService.mortgages(propertyUuid),
  schedule: (mortgageUuid) => realEstateService.schedule(mortgageUuid),
  valuations: (propertyUuid) => realEstateService.valuations(propertyUuid),
  taxes: (propertyUuid, year, includeArchived) => realEstateService.taxes(propertyUuid, year, includeArchived),
  municipalities: (query) => realEstateService.municipalities(query),
  rentalContracts: (propertyUuid) => realEstateService.rentalContracts(propertyUuid),
  taxpayerYears: (year) => realEstateService.taxpayerYears(year),
  simulateSale: (propertyUuid, request) => realEstateService.simulateSale(propertyUuid, request),
};
