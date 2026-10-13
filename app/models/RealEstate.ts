// models/RealEstate.ts
// The real estate's bodies (/v1/real-estate, ianus' dto/real_estate.py, praedium's contracts):
// camelCase. Amounts and rates come back as numbers and are accepted as numbers or decimal strings.
// Dates are YYYY-MM-DD, months YYYY-MM. A property's amounts are in its own currency; the figures
// across properties in the user's reference currency.

export type Amount = number | string;

export type PropertyKind = "apartment" | "house" | "commercial" | "garage" | "land" | "other";

// free_loan: lent free of charge (Italy's comodato). uninhabitable: declared unfit to live in or
// use (major works, damage).
export type PropertyUse =
  | "primary_residence" | "second_home" | "long_term_rental" | "short_term_rental" | "vacant" | "free_loan" | "uninhabitable";

// Who holds a property: its taxes differ (a company has no primary residence).
export type HolderKind = "person" | "company";

// purchase_price: no valuation yet, so the purchase price. Only read, never recorded.
export type ValuationSource = "user_estimate" | "appraisal" | "purchase_price";

// Each kind has its sign (money in positive): the purchase, its costs, works, expenses, property
// taxes and the mortgage's payments are negative; the sale, rents and short-stay payouts positive.
// An expense alone may be positive: a refund.
export type PropertyTransactionKind =
  | "purchase" | "purchase_cost" | "sale" | "sale_cost"
  | "rent" | "short_stay_payout" | "expense" | "works" | "property_tax"
  | "mortgage_instalment" | "mortgage_prepayment"
  // The tax on the rents (Italy: the cedolare secca, or IRPEF's part): taxYear, negative.
  | "income_tax";

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
  // Listed as of historic or artistic interest: IMU on half the base.
  historic: boolean;
  // While lent free of charge (use free_loan): the user confirms IMU's conditions for halving the
  // base (to a parent or child who lives in it, a registered contract, no other home of the
  // lender's in Italy but their own in the same municipality, not A/1, A/8, A/9).
  freeLoanToRelative: boolean;
}

/** A person without a name is the user. */
export interface Holder {
  kind: HolderKind;
  name: string | null;
}

/** The use a property has had from a day on; the first (effectiveOn null) since the start. */
export interface UsePeriod {
  effectiveOn: string | null;
  use: PropertyUse;
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
  // In effect today; `uses` is its history.
  use: PropertyUse;
  // The use since the start, then each change, oldest first.
  uses: UsePeriod[];
  holder: Holder;
  // Another of the user's properties this one belongs to (a garage or a cellar to the house, Italy's
  // pertinenza), one level deep.
  appurtenantToUuid: string | null;
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
  // The user, a person, by default.
  holder?: Holder | null;
  appurtenantToUuid?: string | null;
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

// The fields to change: null or left out keeps the value. "" clears surfaceSqm, energyRating, note
// and appurtenantToUuid; address, details and holder are replaced whole. The currency changes only
// while the property has no transactions, mortgages or valuations (otherwise
// PropertyHasTransactionsError, 409). `use` corrects today's period (the whole period in effect
// today); a use that changed on a day is POST .../use-changes.
export type PropertyUpdateRequest = Partial<Omit<PropertyInput, "surfaceSqm" | "energyRating" | "note" | "appurtenantToUuid">> & {
  surfaceSqm?: Amount | null | "";
  energyRating?: string | null | "";
  note?: string | null | "";
  appurtenantToUuid?: string | null | "";
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
  // short_stay_payout: what the platform kept, and the tax it withheld (Italy: 21%). The guests
  // paid the amount and both: what the tax is levied on.
  platformFee: number | null;
  taxWithheld: number | null;
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
  // short_stay_payout only, 0 and up.
  platformFee?: Amount | null;
  taxWithheld?: Amount | null;
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

// ── Taxes ──

// property_tax: the yearly tax on owning a property (Italy's IMU). rental_income_tax: the tax on
// its rents (Italy's cedolare secca or IRPEF), from praedium 0.4; not shown yet.
export type TaxKind = "property_tax" | "rental_income_tax";

// exempt: not owed for any month of the year (Italy: a primary residence). not_computed:
// `notComputed` says why.
export type TaxStatus = "computed" | "exempt" | "not_computed";

// missing_details: `missingFields` names what's missing: the property's (as PATCH /properties
// names it) or the taxpayer's year (taxpayer.otherIncome: PUT /taxpayer-years). unsupported_property
// (Italy): land, a category F unit, a region with its own tax, a currency other than EUR; for the
// rents' tax, a company's rents or the flat rate on a unit that isn't a home. unsupported_year
// (Italy): IMU before 2020, the rents' tax before 2024. business_activity: short stays in more
// apartments than a person may let in the year (2 from 2026, 4 before): a business's income.
export type NotComputedReason = "missing_details" | "unsupported_property" | "unsupported_year" | "business_activity";

// municipality_earlier_year: the municipality's of an earlier year (`rateYear`), which applies
// while it publishes none. legal: the law's, the municipality having published nothing.
export type RateSource = "user" | "municipality" | "municipality_earlier_year" | "legal" | "exempt";

// agreed_rent: a lease at an agreed rent: IMU at 75%; in a municipality of high housing tension,
// the cedolare at 10% or IRPEF on 70% of the rent.
export type TaxReduction = "historic" | "uninhabitable" | "free_loan_to_relative" | "agreed_rent";

// ordinary: the income tax at the taxpayer's rates (Italy: IRPEF). flat_rate: a flat rate in its
// place (Italy: the cedolare secca, a person's homes only).
export type TaxRegime = "ordinary" | "flat_rate";

/** Months of the year computed alike. The rents' tax: one per lease, one for the short stays. */
export interface TaxPeriod {
  firstMonth: number;
  lastMonth: number;
  months: number;
  use: PropertyUse;
  // As the country names it. Italy: primary_residence, primary_residence_luxury, appurtenance,
  // exempt_category, rural, group_d, other_buildings. Italy's rents: flat_rate (21%),
  // flat_rate_agreed (10%), flat_rate_short_stay (21%), flat_rate_short_stay_other (26%),
  // ordinary (IRPEF: ratePct the effective rate with the surcharges).
  rateClass: string;
  // IMU: the whole property's yearly base, after its reductions. The rents' tax: the period's
  // taxable income at the user's share.
  taxableBase: number;
  reductions: TaxReduction[];
  ratePct: number;
  rateSource: RateSource;
  rateYear: number | null;
  deduction: number;
  // At the user's share, for the period's months, less the deduction.
  amount: number;
  // The rents' tax: the period's regime; its rent (or the guests' payments) at the share before
  // any deduction; what the other regime would cost (null when it can't be told); the lease it is
  // of (null for short stays). IMU: null, 0, null, null.
  regime: TaxRegime | null;
  income: number;
  alternativeAmount: number | null;
  rentalContractUuid: string | null;
}

/**
 * Italy's IMU: 1 is the first instalment (acconto, at the previous year's rates), 2 the balance
 * (saldo). The rents' tax: the cedolare's payments on account (30 June 40%, 30 November 60%, from
 * the previous year's net; only November when small, none when tiny or with no previous year), then
 * the balance with the return (30 June of the next year, IRPEF's part included).
 */
export interface TaxInstalment {
  number: number;
  dueOn: string;
  // Rounded as it's paid (to the euro), at the user's share.
  amount: number;
  // paidAmount covers it and every instalment before it.
  paid: boolean;
  // The payments whose share of the running total reaches it, oldest first: one payment can be on
  // both instalments, an instalment can list several. Refunds are never listed.
  transactionUuids: string[];
}

export interface PropertyTax {
  propertyUuid: string;
  kind: TaxKind;
  // What the country calls it: "IMU"; "Cedolare secca", "IRPEF", "Cedolare secca e IRPEF".
  name: string;
  country: string;
  year: number;
  currency: string;
  status: TaxStatus;
  notComputed: NotComputedReason | null;
  // As PATCH /properties/{uuid} names them, e.g. details.municipalityCode.
  missingFields: string[];
  // At the user's share; 0 when exempt or not computed. IMU: the sum of the instalments. The rents'
  // tax: the year's, which the instalments and withheldAmount pay.
  amount: number;
  // Empty when exempt.
  instalments: TaxInstalment[];
  periods: TaxPeriod[];
  // The year's rates or income can still change: an estimate (IMU: until 28 October; the rents'
  // tax: until the year ends).
  provisional: boolean;
  // What the property's property_tax (rents' tax: income_tax) transactions of that taxYear paid
  // (money out positive, refunds taken off, never below 0), in every status. Above `amount`: a
  // credit. It fills the instalments in order; a payment without taxYear counts for no year.
  paidAmount: number;
  // The rents' tax: what the platforms withheld on the short stays, paid already. IMU: 0.
  withheldAmount: number;
}

/** `totals`: the computed taxes' sum per currency, never converted. */
export interface TaxList {
  taxes: PropertyTax[];
  totals: { currency: string; amount: number }[];
}

export interface TaxRate {
  propertyUuid: string;
  kind: TaxKind;
  year: number;
  ratePct: number;
}

/** A municipality to pick for a property (Italy: `code` is the codice catastale of details.italy.municipalityCode). */
export interface Municipality {
  country: string;
  code: string;
  name: string;
  // Italy: the province's abbreviation ("MI").
  province: string;
  region: string;
}

// ── Leases and taxpayers ──

// residential: a home at a rent freely agreed (Italy: canone libero, 4+4). agreed (3+2),
// transitional and student are Italy's only.
export type RentalContractKind = "residential" | "agreed" | "transitional" | "student" | "commercial";

/** A property's long-term lease: its rent is taxed as it falls due, paid or not. */
export interface RentalContract {
  uuid: string;
  propertyUuid: string;
  kind: RentalContractKind;
  startsOn: string;
  // Null while it runs on.
  endsOn: string | null;
  // The whole property's rent for a month: the taxes take the user's share of it.
  monthlyRent: number;
  currency: string;
  taxRegime: TaxRegime;
  // agreed, transitional, student: the municipality is one of high housing tension (cedolare 10%).
  highTensionMunicipality: boolean;
  tenant: string | null;
  note: string | null;
  createdAt: string;
}

export interface RentalContractInput {
  kind: RentalContractKind;
  startsOn: string;
  endsOn?: string | null;
  monthlyRent: Amount;
  // Null: ordinary. flat_rate only for a person's home in Italy, never a commercial lease.
  taxRegime?: TaxRegime | null;
  highTensionMunicipality?: boolean;
  tenant?: string | null;
  note?: string | null;
}

// The fields to change: null or left out keeps the value. "" clears endsOn (it runs on again),
// tenant and note. Changing the kind away from agreed, transitional or student drops
// highTensionMunicipality.
export type RentalContractUpdateRequest = Partial<Omit<RentalContractInput, "endsOn">> & { endsOn?: string | null | "" };

/**
 * What the rents' tax needs of a taxpayer for a year: the user (holderName null), or a person named
 * as a property's holder, exactly as the property names them.
 */
export interface TaxpayerYear {
  year: number;
  holderName: string | null;
  // Income at the ordinary rates other than these rents (Italy: from the CU or the 730), in EUR.
  // Null: IRPEF on rents isn't computed nor compared.
  otherIncome: number | null;
  // The regional and municipal surcharges together, in percent (0-10); null is 0.
  surchargesPct: number | null;
  // The property whose short stays take the 21%; null: the one with the most income.
  reducedRatePropertyUuid: string | null;
  // How the short stays are taxed; null: flat_rate.
  shortStayRegime: TaxRegime | null;
}

/** PUT /taxpayer-years replaces the whole record. */
export interface TaxpayerYearInput {
  year: number;
  holderName?: string | null;
  otherIncome?: Amount | null;
  surchargesPct?: Amount | null;
  reducedRatePropertyUuid?: string | null;
  shortStayRegime?: TaxRegime | null;
}
