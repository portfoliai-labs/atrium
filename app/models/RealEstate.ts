// models/RealEstate.ts
// The real estate's bodies (/v1/real-estate, ianus' dto/real_estate.py, praedium's contracts):
// camelCase. Amounts and rates come back as numbers and are accepted as numbers or decimal strings.
// Dates are YYYY-MM-DD, months YYYY-MM. A property's amounts are in its own currency; the figures
// across properties in the user's reference currency.

export type Amount = number | string;

export type PropertyKind = "apartment" | "house" | "commercial" | "garage" | "land" | "other";

export type PropertyUse = "primary_residence" | "second_home" | "long_term_rental" | "short_term_rental" | "vacant";

// purchase_price: no valuation yet, so the purchase price. Only read, never recorded.
export type ValuationSource = "user_estimate" | "appraisal" | "purchase_price";

// Each kind has its sign (money in positive): the purchase, its costs, works, expenses, property
// taxes and the mortgage's payments are negative; the sale, rents and short-stay payouts positive.
// An expense alone may be positive: a refund.
export type PropertyTransactionKind =
  | "purchase" | "purchase_cost" | "sale" | "sale_cost"
  | "rent" | "short_stay_payout" | "expense" | "works" | "property_tax"
  | "mortgage_instalment" | "mortgage_prepayment";

// "taxes": registration, stamp and transfer taxes.
export type CostKind = "notary" | "agency" | "taxes" | "other";

export type ExpenseKind = "condo_fees" | "insurance" | "maintenance" | "utilities" | "management" | "furnishing" | "other";

// reduce_instalment: the same end, smaller instalments. shorten_term: the same instalment, an
// earlier end.
export type PrepaymentEffect = "reduce_instalment" | "shorten_term";

export type InstalmentFrequency = "monthly" | "quarterly" | "semiannual";

// "other": its changes are entered by hand.
export type RateIndex = "euribor_1m" | "euribor_3m" | "euribor_6m" | "sofr" | "other";

// ── Properties ──

export interface Address {
  // ISO 3166-1 alpha-2: it picks the country's rules (and which `details` apply).
  country: string;
  street: string;
  locality: string;
  region?: string | null;
  postalCode?: string | null;
  neighbourhood?: string | null;
  // A map's pin.
  location?: { latitude: number; longitude: number } | null;
}

// Italy's land registry: what IMU and the rents' taxes are computed from. Every field optional.
export interface ItalianDetails {
  // The municipality's cadastral code (Belfiore, e.g. F205 for Milan).
  municipalityCode: string | null;
  cadastralSheet: string | null;
  cadastralParcel: string | null;
  cadastralSubunit: string | null;
  // E.g. "A/2".
  cadastralCategory: string | null;
  // The rendita catastale in EUR, before the revaluations.
  cadastralIncome: number | null;
}

// Only the property's country's: anything else is a 422 (field "details").
export interface CountryDetails {
  italy: ItalianDetails | null;
}

/** Today's figures in the user's reference currency, at today's rate. */
export interface ReferenceFigures {
  currency: string;
  valueAtShare: number;
  residualDebt: number;
  equity: number;
}

/**
 * Computed on read, in the property's currency. The value is the whole property's; the residual
 * debt and what was put in are the user's part, as entered.
 */
export interface PropertyFigures {
  // The whole property's latest value; 0 once sold.
  value: number;
  valueSource: ValuationSource | null;
  valuedOn: string | null;
  // The value at the ownership share.
  valueAtShare: number;
  // The mortgages' residual debt today.
  residualDebt: number;
  // valueAtShare less residualDebt.
  equity: number;
  // The purchase, its costs and the works.
  invested: number;
  // The last 12 months' rents and payouts, and what's left of them after expenses, property taxes
  // and instalments.
  yearlyIncome: number;
  yearlyNetCashFlow: number;
  // Null when the value is 0.
  loanToValuePct: number | null;
  // The last 12 months' income over valueAtShare.
  grossYieldPct: number | null;
  // On GET /properties only; null elsewhere, and when there's no rate for today: fall back to the
  // property's own currency.
  reference: ReferenceFigures | null;
}

export interface Property {
  uuid: string;
  name: string;
  kind: PropertyKind;
  use: PropertyUse;
  address: Address;
  // ISO 4217: every amount of the property's.
  currency: string;
  // Square metres (square feet are the page's conversion).
  surfaceSqm: number | null;
  rooms: number | null;
  yearBuilt: number | null;
  // As the energy certificate writes it ("A4", "D").
  energyRating: string | null;
  // The user's share: transactions and mortgages are entered as their part, valuations as the
  // whole property's.
  ownershipSharePct: number;
  details: CountryDetails;
  note: string | null;
  // From the purchase transaction.
  purchasedOn: string | null;
  // From the sale transaction: from that day it's worth nothing and out of the current figures.
  soldOn: string | null;
  // Takes no writes and is left out of the figures across properties.
  archived: boolean;
  figures: PropertyFigures;
  createdAt: string;
}

export interface PropertyInput {
  name: string;
  kind: PropertyKind;
  use: PropertyUse;
  address: Address;
  currency: string;
  surfaceSqm?: Amount | null;
  rooms?: number | null;
  yearBuilt?: number | null;
  energyRating?: string | null;
  // 100 by default.
  ownershipSharePct?: Amount | null;
  details?: { italy?: ItalianDetailsInput | null } | null;
  note?: string | null;
}

export type ItalianDetailsInput = Partial<Omit<ItalianDetails, "cadastralIncome">> & { cadastralIncome?: Amount | null };

/** The purchase, the user's part of it: amounts positive, booked as money out. */
export interface PurchaseInput {
  purchasedOn: string;
  price: Amount;
  costs?: { kind: CostKind; amount: Amount }[];
}

/**
 * A property with, if given, its purchase (a purchase transaction and one purchase_cost per cost)
 * and its mortgage, all or none. Without a purchase (inherited, bought before it was tracked) its
 * value is its valuations'.
 */
export interface PropertyCreateRequest extends PropertyInput {
  purchase?: PurchaseInput | null;
  mortgage?: MortgageInput | null;
}

export interface PropertyCreateResponse {
  property: Property;
  mortgage: Mortgage | null;
}

// The fields to change: null or left out keeps the value. "" clears surfaceSqm, energyRating and
// note; address and details are replaced whole. The currency changes only while the property has
// no transactions, mortgages or valuations (otherwise PropertyHasTransactionsError, 409).
export type PropertyUpdateRequest = Partial<Omit<PropertyInput, "surfaceSqm" | "energyRating" | "note">> & {
  surfaceSqm?: Amount | null | "";
  energyRating?: string | null | "";
  note?: string | null | "";
};

// ── Transactions ──

export interface PropertyTransaction {
  uuid: string;
  propertyUuid: string;
  kind: PropertyTransactionKind;
  bookedOn: string;
  // Signed as its kind wants it (money in positive), in the property's currency.
  amount: number;
  currency: string;
  // The kind's name unless given.
  description: string;
  // The tenant, the platform, the condo's administrator.
  counterparty: string | null;
  note: string | null;
  // purchase_cost and sale_cost.
  costKind: CostKind | null;
  // expense.
  expenseKind: ExpenseKind | null;
  // rent: the month it pays (YYYY-MM).
  rentPeriod: string | null;
  // property_tax.
  taxYear: number | null;
  // works: the incentive claimed ("Bonus ristrutturazione 50%").
  incentive: string | null;
  // mortgage_instalment and mortgage_prepayment.
  mortgageUuid: string | null;
  instalmentNumber: number | null;
  // An instalment's interest: the bank's, or the schedule's.
  interest: number | null;
  prepaymentEffect: PrepaymentEffect | null;
  createdAt: string;
}

/**
 * A transaction to add. The fields after `note` belong to some kinds only (see
 * PropertyTransactionKind); given to another kind they're a 422 (InvalidTransactionError).
 */
export interface PropertyTransactionInput {
  kind: PropertyTransactionKind;
  bookedOn: string;
  // Signed, never 0.
  amount: Amount;
  description?: string | null;
  counterparty?: string | null;
  note?: string | null;
  costKind?: CostKind | null;
  expenseKind?: ExpenseKind | null;
  // Default: bookedOn's month.
  rentPeriod?: string | null;
  // Default: bookedOn's year.
  taxYear?: number | null;
  incentive?: string | null;
  mortgageUuid?: string | null;
  // Default: the first not paid yet.
  instalmentNumber?: number | null;
  // Default: the schedule's.
  interest?: Amount | null;
  prepaymentEffect?: PrepaymentEffect | null;
}

// The fields to change: null or left out keeps the value. "" clears counterparty, note and
// incentive, gives back the kind's name to description and the schedule's to interest. The kind
// and the mortgage don't change: delete the transaction and add another.
export type PropertyTransactionUpdateRequest = Partial<Omit<PropertyTransactionInput, "kind" | "mortgageUuid">>;

/** Newest first. `totals`: the signed sum of every match on every page, per currency (never converted). */
export interface PropertyTransactionList {
  items: PropertyTransaction[];
  total: number;
  limit: number;
  offset: number;
  totals: { currency: string; amount: number }[];
}

export interface PropertyTransactionFilters {
  bookedFrom?: string;
  bookedTo?: string;
  kinds?: PropertyTransactionKind[];
  // In the description, the counterparty or the note.
  text?: string;
  mortgageUuid?: string;
  // 1-200, 50 by default.
  limit?: number;
  offset?: number;
}

// ── Mortgages ──

/** Fixed (fixedPct, percent a year) or variable: exactly one. */
export type MortgageRateInput =
  | { fixedPct: Amount; variable?: never }
  | { fixedPct?: never; variable: { index: RateIndex; spreadPct: Amount; initialPct: Amount } };

/** A mortgage in its property's currency, the user's part of it, amortised the French way. */
export interface MortgageInput {
  principal: Amount;
  firstInstalmentOn: string;
  // 1-600.
  termMonths: number;
  // Monthly by default.
  frequency?: InstalmentFrequency | null;
  rate: MortgageRateInput;
  lender?: string | null;
  note?: string | null;
}

export interface Mortgage {
  uuid: string;
  propertyUuid: string;
  principal: number;
  currency: string;
  firstInstalmentOn: string;
  termMonths: number;
  frequency: InstalmentFrequency;
  // The rate it started at: one of the two.
  rate: {
    fixedPct: number | null;
    variable: { index: RateIndex; spreadPct: number; initialPct: number } | null;
  };
  // Oldest first; the first is the initial rate.
  rateChanges: { effectiveOn: string; ratePct: number }[];
  lender: string | null;
  note: string | null;
  // Paid off or refinanced.
  closedOn: string | null;
  // Today's.
  residualDebt: number;
  currentRatePct: number;
  currentInstalment: number;
  lastInstalmentOn: string | null;
  createdAt: string;
}

// The fields to change: null or left out keeps the value. "" clears lender and note; closedOn
// closes the mortgage, "" opens it again. The rate changes through rate-changes.
export interface MortgageUpdateRequest {
  principal?: Amount | null;
  firstInstalmentOn?: string | null;
  termMonths?: number | null;
  frequency?: InstalmentFrequency | null;
  lender?: string | null;
  note?: string | null;
  closedOn?: string | null;
}

export interface Instalment {
  number: number;
  dueOn: string;
  // principal + interest.
  payment: number;
  principal: number;
  interest: number;
  // What's owed after it.
  residualDebt: number;
  ratePct: number;
  // The instalment transaction that paid it.
  transactionUuid: string | null;
}

/** Computed on read. Instalments oldest first, until the debt is paid or the mortgage closed. */
export interface MortgageSchedule {
  currency: string;
  instalments: Instalment[];
  prepayments: { transactionUuid: string; bookedOn: string; amount: number; residualDebt: number }[];
  totalInterest: number;
}

// ── Valuations ──

/** The whole property's value on a day, in its currency. */
export interface Valuation {
  uuid: string;
  propertyUuid: string;
  valuedOn: string;
  value: number;
  currency: string;
  source: ValuationSource;
  note: string | null;
  createdAt: string;
}

export interface ValuationInput {
  valuedOn: string;
  value: Amount;
  source: "user_estimate" | "appraisal";
  note?: string | null;
}

// ── Figures across properties ──

/** Every non-archived property together, today, in the user's reference currency. */
export interface RealEstateOverview {
  currency: string;
  propertyCount: number;
  // At the ownership shares.
  value: number;
  residualDebt: number;
  equity: number;
  invested: number;
  // The last 12 months'.
  yearlyIncome: number;
  yearlyNetCashFlow: number;
  // Null when the value is 0.
  loanToValuePct: number | null;
  grossYieldPct: number | null;
}

export interface RealEstateMonth {
  month: string;
  // Rents and short-stay payouts.
  income: number;
  // Expenses (net of refunds) and property taxes, positive.
  expenses: number;
  // The instalments paid in the month, positive, and the interest in them.
  mortgagePayments: number;
  mortgageInterest: number;
  // income - expenses - mortgagePayments.
  netCashFlow: number;
  // At the month's end (today, for the current one).
  value: number;
  residualDebt: number;
  invested: number;
}

/**
 * One property's months in its currency, or every non-archived property's in the user's reference
 * currency. Oldest first, empty months included.
 */
export interface RealEstateSummary {
  currency: string;
  months: RealEstateMonth[];
}
