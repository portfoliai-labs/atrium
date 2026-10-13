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
  MovementLinkProposal, PrepaymentSimulation, PrepaymentSimulationRequest, RefinancingSimulation, RefinancingSimulationRequest,
  RealEstateAlertFinding, MarketSalesSegment, MarketSemester, MarketZone, PropertyMarket, RealEstateAlertParams, RealEstateAlertRule, RealEstateAlertType,
} from "../models/RealEstate";
import { realEstateService } from "../services/realEstateService";
import { ApiError } from "../services/apiClient";
import { formatCurrency } from "./format";
import { dayLabel, today } from "./wallets";

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
  market_zone: "The zone's market",
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
  name: "Name", kind: "Kind", use: "Use", movementUuid: "The wallet movement", address: "Address", "address.country": "Country", "address.street": "Street",
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
  // Alert rules.
  propertyUuid: "Property", params: "The rule", "params.dayOfMonth": "Day of the month", "params.daysBefore": "Days",
  "params.daysAfter": "Days", "params.thresholdPct": "Threshold",
  // Mortgage simulations.
  prepaidOn: "The day", refinancedOn: "The day", amount: "Amount", costs: "Costs", "rate.fixedPct": "Rate",
  "details.omiZone": "Market zone", "details.omi_zone": "Market zone",
  "rate.variable.spreadPct": "Spread", "rate.variable.initialPct": "Rate today", termMonths: "Term", frequency: "Frequency",
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

// ── Alerts ──

/** Each kind of rule: its name, what it watches, and the one number it takes. */
export const ALERT_TYPES: Record<RealEstateAlertType, {
  label: string;
  desc: string;
  // `exclusiveMin`: above min, not from it.
  param: { key: string; label: string; min: number; max: number; initial: number; unit: string; decimal?: boolean; exclusiveMin?: boolean };
  // Its figures are the zone's market's (OMI): credited wherever they show.
  market?: boolean;
}> = {
  rent_unpaid: {
    label: "Rent not received",
    desc: "A lease's rent with no rent recorded for its month by a day of the month (this month and the two before).",
    param: { key: "dayOfMonth", label: "By day of the month", min: 1, max: 28, initial: 10, unit: "" },
  },
  tax_due: {
    label: "Tax falling due",
    desc: "An instalment of IMU, of the rents' tax or of a sale's tax not paid yet and due soon, overdue ones too.",
    param: { key: "daysBefore", label: "Days before it's due", min: 0, max: 90, initial: 15, unit: "days" },
  },
  mortgage_instalment_unpaid: {
    label: "Mortgage instalment not recorded",
    desc: "An instalment with no transaction some days after its due day (up to 90 days after it).",
    param: { key: "daysAfter", label: "Days after its due day", min: 0, max: 60, initial: 5, unit: "days" },
  },
  lease_ending: {
    label: "Lease ending",
    desc: "A lease whose last day is near: time to renew it or find a tenant.",
    param: { key: "daysBefore", label: "Days before it ends", min: 1, max: 365, initial: 90, unit: "days" },
  },
  loan_to_value: {
    label: "Loan-to-value too high",
    desc: "Your mortgage debt above a share of what your part of the property is worth.",
    param: { key: "thresholdPct", label: "Above", min: 0, max: 200, initial: 60, unit: "%", decimal: true, exclusiveMin: true },
  },
  zone_price_drop: {
    label: "Zone prices falling",
    desc: "The zone's middle sale price down from a year earlier (OMI), told again each new semester while it lasts.",
    param: { key: "thresholdPct", label: "Down by at least", min: 0, max: 50, initial: 5, unit: "%", decimal: true, exclusiveMin: true },
    market: true,
  },
  rent_below_market: {
    label: "Rent below the market",
    desc: "Today's lease's rent per m² under the zone's minimum (OMI), told again each new semester while it lasts.",
    param: { key: "tolerancePct", label: "Under the minimum by at least", min: 0, max: 50, initial: 0, unit: "%", decimal: true },
    market: true,
  },
};
export const ALERT_TYPE_LIST = Object.keys(ALERT_TYPES) as RealEstateAlertType[];

/** A rule's one number (its params' only field besides `type`). */
export const alertParamValue = (params: RealEstateAlertParams) =>
  Number((params as unknown as Record<string, number | string>)[ALERT_TYPES[params.type].param.key]);

/** A rule's params from its kind and number. */
export const alertParams = (type: RealEstateAlertType, value: number | string) =>
  ({ type, [ALERT_TYPES[type].param.key]: value }) as RealEstateAlertParams;

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
const pctText = (v: number) => `${Number(v.toFixed(1))}%`;

/** What a rule watches, in a line. */
export function alertRuleText(params: RealEstateAlertParams) {
  switch (params.type) {
    case "rent_unpaid": return `No rent by the ${ordinal(params.dayOfMonth)} of the month`;
    case "tax_due": return params.daysBefore === 0 ? "A tax instalment due today or overdue" : `A tax instalment due within ${days(params.daysBefore)}`;
    case "mortgage_instalment_unpaid":
      return params.daysAfter === 0 ? "A mortgage instalment not recorded on its due day" : `A mortgage instalment not recorded ${days(params.daysAfter)} after its due day`;
    case "lease_ending": return `A lease ending within ${days(params.daysBefore)}`;
    case "loan_to_value": return `Loan-to-value above ${pctText(Number(params.thresholdPct))}`;
    case "zone_price_drop": return `The zone's prices down ${pctText(Number(params.thresholdPct))} or more in a year`;
    case "rent_below_market":
      return Number(params.tolerancePct) === 0
        ? "A rent below the zone's minimum"
        : `A rent ${pctText(Number(params.tolerancePct))} or more below the zone's minimum`;
  }
}

const monthName = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

/** A finding, said: what happened, and its figures (the property is left to the caller). */
export function alertFindingText(f: RealEstateAlertFinding): { title: string; detail: string } {
  const money = (v: number | null) => (v === null ? null : formatCurrency(v, f.currency, 0));
  const due = f.dueOn ? (f.dueOn < today() ? `was due ${dayLabel(f.dueOn)}` : `due ${dayLabel(f.dueOn)}`) : null;
  const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(" · ");
  switch (f.kind) {
    case "rent_unpaid":
      return { title: `${f.rentPeriod ? monthName(f.rentPeriod) : "A month"}'s rent not received`, detail: join(f.tenant, money(f.amount), due) };
    case "tax_due":
      return { title: `${f.taxName ?? "A tax"}${f.taxYear ? ` ${f.taxYear}` : ""}: an instalment not paid`, detail: join(money(f.amount), due) };
    case "mortgage_instalment_unpaid":
      return { title: `Mortgage instalment${f.instalmentNumber ? ` ${f.instalmentNumber}` : ""} not recorded`, detail: join(f.lender, money(f.amount), due) };
    case "lease_ending":
      return {
        title: `${f.tenant ? `${f.tenant}'s lease` : "A lease"} ends ${f.dueOn ? dayLabel(f.dueOn) : "soon"}`,
        detail: join(f.amount === null ? null : `${money(f.amount)} a month`),
      };
    case "loan_to_value":
      return {
        title: `Loan-to-value at ${f.loanToValuePct === null ? "—" : pctText(f.loanToValuePct)}`,
        detail: join(f.residualDebt === null ? null : `${money(f.residualDebt)} of debt`, f.valueAtShare === null ? null : `on ${money(f.valueAtShare)} of value`),
      };
    case "zone_price_drop":
      return {
        title: `${f.zone ? `Zone ${f.zone.code}` : "The zone"}'s prices down${f.changePct == null ? "" : ` ${pctText(Math.abs(f.changePct))}`} in a year`,
        detail: join(
          f.perSqm == null ? null : `${formatCurrency(f.perSqm, "EUR", 0)}/m²`,
          f.referencePerSqm == null ? null : `${formatCurrency(f.referencePerSqm, "EUR", 0)}/m² a year earlier`,
          f.semester ? semesterLabel(f.semester) : null,
        ),
      };
    case "rent_below_market":
      return {
        title: `${f.tenant ? `${f.tenant}'s rent` : "The rent"} ${f.changePct == null ? "" : `${pctText(Math.abs(f.changePct))} `}below the zone's minimum`,
        detail: join(
          f.perSqm == null ? null : `${formatCurrency(f.perSqm, "EUR", 1)}/m² a month`,
          f.referencePerSqm == null ? null : `the zone's minimum ${formatCurrency(f.referencePerSqm, "EUR", 1)}`,
          f.amount === null ? null : `${money(f.amount)} a month`,
        ),
      };
  }
}

/** A semester, said: "H1 2026". */
export const semesterLabel = (s: MarketSemester) => `H${s.half} ${s.year}`;

/** OMI's sales segments, said. */
export const SALES_SEGMENT_LABELS: Record<MarketSalesSegment, string> = {
  residential: "Homes",
  residential_up_to_50: "Homes up to 50 m²",
  residential_50_85: "Homes 50–85 m²",
  residential_85_115: "Homes 85–115 m²",
  residential_115_145: "Homes 115–145 m²",
  residential_over_145: "Homes over 145 m²",
  appurtenant_garage: "Garages belonging to a home",
  appurtenant_storage: "Store rooms belonging to a home",
  offices: "Offices",
  shops: "Shops",
  storage_and_garages: "Garages and storage",
  public_offices: "Public offices",
  hotels: "Hotels",
  banks: "Banks",
  commercial_buildings: "Commercial buildings",
  productive: "Productive buildings",
  agricultural: "Agricultural buildings",
};

/** Where the market's figures come from, credited wherever they show (CC BY 4.0). */
export const OMI_ATTRIBUTION = "Agenzia delle Entrate – OMI";

/** A REAL_ESTATE_ALERT notification's finding (snake_case, decimals as strings, rent_period a month's first day) as the API's. */
export function findingFromPayload(p: Record<string, unknown>): RealEstateAlertFinding {
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  const num = (v: unknown) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
  return {
    key: str(p.key) ?? "",
    kind: p.kind as RealEstateAlertType,
    propertyUuid: str(p.property_uuid) ?? "",
    propertyName: str(p.property_name) ?? "A property",
    currency: str(p.currency) ?? "EUR",
    dueOn: str(p.due_on),
    amount: num(p.amount),
    rentalContractUuid: str(p.rental_contract_uuid),
    tenant: str(p.tenant),
    rentPeriod: str(p.rent_period)?.slice(0, 7) ?? null,
    mortgageUuid: str(p.mortgage_uuid),
    instalmentNumber: num(p.instalment_number),
    lender: str(p.lender),
    taxKind: str(p.tax_kind) as RealEstateAlertFinding["taxKind"],
    taxName: str(p.tax_name),
    taxYear: num(p.tax_year),
    loanToValuePct: num(p.loan_to_value_pct),
    residualDebt: num(p.residual_debt),
    valueAtShare: num(p.value_at_share),
    zone: str(p.zone_code)
      ? {
          country: "IT", municipalityCode: str(p.zone_municipality_code) ?? "", code: str(p.zone_code)!, band: "",
          description: str(p.zone_description) ?? "", semester: { year: num(p.semester_year) ?? 0, half: (num(p.semester_half) === 2 ? 2 : 1) },
        }
      : null,
    semester: num(p.semester_year) ? { year: num(p.semester_year)!, half: num(p.semester_half) === 2 ? 2 : 1 } : null,
    changePct: num(p.change_pct),
    perSqm: num(p.per_sqm),
    referencePerSqm: num(p.reference_per_sqm),
  };
}

/** A finding's identity across rules: its key is stable, but only read with its kind and property. */
export const findingKey = (f: RealEstateAlertFinding) => `${f.propertyUuid}:${f.kind}:${f.key}`;

/** The facts found by the enabled rules, once each (two rules can find the same), by due day then property. */
export function currentFindings(rules: RealEstateAlertRule[], propertyUuid?: string) {
  const seen = new Map<string, RealEstateAlertFinding>();
  for (const r of rules) {
    if (!r.enabled) continue;
    for (const f of r.findings) {
      if (propertyUuid && f.propertyUuid !== propertyUuid) continue;
      seen.set(findingKey(f), f);
    }
  }
  return [...seen.values()].sort((a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? "") || a.propertyName.localeCompare(b.propertyName));
}

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
  // Every non-archived property's, or one's: the wallets' movements that may be its transactions
  // not linked, or its instalments not recorded, in a range of at most 366 days.
  movementLinkProposals(propertyUuid: string | null, bookedFrom: string, bookedTo: string): Promise<MovementLinkProposal[]>;
  // Every rule, or a property's (its own and those on every property), each with what it finds today.
  alertRules(propertyUuid: string | null): Promise<RealEstateAlertRule[]>;
  // A mortgage's schedule were part of it repaid, or were it refinanced: nothing is stored.
  simulatePrepayment(mortgageUuid: string, request: PrepaymentSimulationRequest): Promise<PrepaymentSimulation>;
  simulateRefinancing(mortgageUuid: string, request: RefinancingSimulationRequest): Promise<RefinancingSimulation>;
  // A municipality's market zones (Italy's OMI), and a property's zone's market.
  marketZones(municipalityCode: string): Promise<MarketZone[]>;
  market(propertyUuid: string): Promise<PropertyMarket>;
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
  movementLinkProposals: (propertyUuid, bookedFrom, bookedTo) => realEstateService.movementLinkProposals(propertyUuid, bookedFrom, bookedTo),
  alertRules: (propertyUuid) => realEstateService.alertRules(propertyUuid),
  simulatePrepayment: (mortgageUuid, request) => realEstateService.simulatePrepayment(mortgageUuid, request),
  simulateRefinancing: (mortgageUuid, request) => realEstateService.simulateRefinancing(mortgageUuid, request),
  marketZones: (municipalityCode) => realEstateService.marketZones(municipalityCode),
  market: (propertyUuid) => realEstateService.market(propertyUuid),
};
