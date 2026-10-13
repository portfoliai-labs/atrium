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

// How the holder came to own it: whether a sale's gain is taxed (Italy: never an inheritance's; a
// donation's from the donor's purchase, at the donor's cost).
export type AcquisitionKind = "purchase" | "inheritance" | "donation";

/** A property inherited or donated takes no purchase (422). Days aren't after today. */
export interface Acquisition {
  kind: AcquisitionKind;
  // An inheritance's or a donation's day; null for a purchase (its transaction's).
  acquiredOn: string | null;
  // A donation's: the day the donor bought it, and what it cost them with its costs (the user's part).
  donorPurchasedOn: string | null;
  donorCost: number | null;
}

// The incentive works claim, as far as the taxes tell them apart. superbonus_110_transferred (Italy):
// the Superbonus at 110%, its credit transferred or discounted: a sale within 10 years of the works'
// end is taxed, the works counting for nothing within 5 years of their end, for half after.
export type IncentiveKind = "superbonus_110_transferred" | "superbonus" | "other";

// purchase_price: no valuation yet, so the purchase price. Only read, never recorded.
// market_zone: no valuation of the user's, the middle of the zone's market range (Italy: OMI).
export type ValuationSource = "user_estimate" | "appraisal" | "market_zone" | "purchase_price";

// Each kind has its sign (money in positive): the purchase, its costs, works, expenses, property
// taxes and the mortgage's payments are negative; the sale, rents and short-stay payouts positive.
// An expense alone may be positive: a refund.
export type PropertyTransactionKind =
  | "purchase" | "purchase_cost" | "sale" | "sale_cost"
  | "rent" | "short_stay_payout" | "expense" | "works" | "property_tax"
  | "mortgage_instalment" | "mortgage_prepayment"
  // The tax on the rents (Italy: the cedolare secca, or IRPEF's part): taxYear, negative.
  | "income_tax"
  // The tax on a sale's gain (Italy: the notary's substitute tax, or IRPEF's part): taxYear, negative.
  | "capital_gains_tax";

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
  // The OMI market zone the user picked ("B1"), of the municipality's; null: the one the address's
  // location falls in.
  omiZone?: string | null;
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
  acquisition: Acquisition;
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
  // A purchase by default (its day and price are its purchase transaction's).
  acquisition?: { kind: AcquisitionKind; acquiredOn?: string | null; donorPurchasedOn?: string | null; donorCost?: Amount | null } | null;
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
  // works: the incentive as the taxes tell it apart, and the day the works ended (needed by a sale's
  // tax for Superbonus works).
  incentiveKind: IncentiveKind | null;
  worksCompletedOn: string | null;
  // sale: how its gain is taxed (flat_rate: the notary's 26%; ordinary: IRPEF with the return).
  taxRegime: TaxRegime | null;
  // The wallets' movement it is, if linked; the state and the movement as the wallets have it.
  movementUuid: string | null;
  movementState: MovementLinkState | null;
  movement: LinkedMovement | null;
}

// found: `movement` is the wallets'; gone: the wallets no longer have it (unlink it, or link
// another); unavailable: the wallets couldn't be asked, `movement` is null and the link stays.
export type MovementLinkState = "found" | "gone" | "unavailable";

/** A wallets' movement as a property's transaction reads it. */
export interface LinkedMovement {
  movementUuid: string;
  walletUuid: string;
  bookedOn: string;
  // Signed, money in positive, in the wallet's currency.
  amount: number;
  currency: string;
  description: string;
  counterparty: string | null;
}

/**
 * What wallets' movements may be: a transaction recorded and not linked (`transactionUuid`: PATCH
 * it with movementUuid), or an instalment due and not recorded (`mortgageUuid` and
 * `instalmentNumber`: POST a mortgage_instalment with the movement's day, amount and movementUuid).
 */
export interface MovementLinkProposal {
  propertyUuid: string;
  transactionUuid: string | null;
  mortgageUuid: string | null;
  instalmentNumber: number | null;
  // The transaction's day, or the instalment's due day.
  dueOn: string;
  // Signed, as the transaction is (an instalment's negative).
  amount: number;
  currency: string;
  // Same amount and currency, booked within 5 days; nearest first, then those naming the
  // counterparty or the lender.
  candidates: LinkedMovement[];
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
  // works only.
  incentiveKind?: IncentiveKind | null;
  worksCompletedOn?: string | null;
  // sale only; null: flat_rate.
  taxRegime?: TaxRegime | null;
  // The wallets' movement it is: the caller's, in the property's currency, the same direction, not
  // a transfer's leg, not linked to another transaction (422, field movementUuid; 503 when the
  // wallets can't be asked). Its day and amount may differ.
  movementUuid?: string | null;
}

// The fields to change: null or left out keeps the value. "" clears counterparty, note and
// incentive, unlinks movementUuid, gives back the kind's name to description and the schedule's to interest. The kind
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

// property_tax: the yearly tax on owning a property (Italy's IMU). rental_income_tax: the tax on its
// rents (Italy's cedolare secca or IRPEF). capital_gains_tax: the tax on a sale's gain, for the
// sale's year (Italy's 26% substitute tax at the deed, or IRPEF with the return).
export type TaxKind = "property_tax" | "rental_income_tax" | "capital_gains_tax";

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
  // The sale's tax: its gain; null for an inheritance, when not computed, and for the other taxes.
  capitalGain: CapitalGain | null;
}

// within_five_years: sold within 5 years of the purchase (a donation: the donor's). superbonus:
// within 10 years of the end of Superbonus works.
export type GainRule = "within_five_years" | "superbonus";

/** A sale's gain as its tax counts it, the user's part. */
export interface CapitalGain {
  soldOn: string;
  salePrice: number;
  saleCosts: number;
  // The purchase's price (a donation: the donor's cost) and its costs.
  acquisitionCost: number;
  acquisitionCosts: number;
  // The works counted in the cost, and those the rules leave out (Superbonus at 110% transferred).
  works: number;
  worksExcluded: number;
  // Negative is a loss, untaxed.
  gain: number;
  // Null when no window taxes it.
  rule: GainRule | null;
  // The last day a sale is still taxed: from the day after, the gain isn't.
  taxedUntil: string | null;
  // The purchase price is revalued by ISTAT's FOI index (a Superbonus sale over 5 years after the
  // purchase; a donation: the donor's). Due but null: the index has no month for the purchase
  // (before 1976, or January to September 1978), and the gain uses the price as it was (an
  // overestimate; the tax is provisional).
  costRevaluationDue: boolean;
  // Only the purchase price, not its costs nor the works; `gain` counts revaluedCost in its place.
  // toMonth before the sale's month: that month's index isn't out yet (the tax is provisional).
  costRevaluation: { fromMonth: string; toMonth: string; factor: number; revaluedCost: number } | null;
}

/** A sale to simulate, the user's part: nothing is stored, a sale recorded is replaced. */
export interface SaleSimulationRequest {
  soldOn: string;
  price: Amount;
  costs?: { kind: CostKind; amount: Amount }[];
  // Null: flat_rate.
  regime?: TaxRegime | null;
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

// ── Alerts ──

export type RealEstateAlertType =
  | "rent_unpaid" | "tax_due" | "mortgage_instalment_unpaid" | "lease_ending" | "loan_to_value" | "zone_price_drop" | "rent_below_market";

/** What a rule watches, by `type`. */
export type RealEstateAlertParams =
  // A lease's rent for a month has no rent transaction for that month by that day (1-28): the
  // current month and the two before.
  | { type: "rent_unpaid"; dayOfMonth: number }
  // A tax instalment (this year's and last year's) not paid and due within N days (0-90), overdue
  // ones included.
  | { type: "tax_due"; daysBefore: number }
  // A mortgage instalment with no transaction N days (0-60) after its due day, up to 90 days after.
  | { type: "mortgage_instalment_unpaid"; daysAfter: number }
  // A lease ending within N days (1-365).
  | { type: "lease_ending"; daysBefore: number }
  // Residual debt over the value at the share above the threshold (>0, ≤200), in percent.
  | { type: "loan_to_value"; thresholdPct: number | string }
  // The zone's middle sale price down from the same semester a year earlier by the threshold or
  // more (>0, ≤50, in percent): told again each new semester while it lasts.
  | { type: "zone_price_drop"; thresholdPct: number | string }
  // Today's lease's rent per m² below the zone's minimum by the tolerance or more (0-50, in
  // percent; 0: any rent below it): told again each new semester while it lasts.
  | { type: "rent_below_market"; tolerancePct: number | string };

/** A fact a rule finds today: only its kind's fields are set, the others null. Amounts are the user's share. */
export interface RealEstateAlertFinding {
  // Stable while the fact lasts.
  key: string;
  kind: RealEstateAlertType;
  propertyUuid: string;
  propertyName: string;
  currency: string;
  // The rent's due day, the instalment's due day, the lease's last day; null for loan-to-value and the market's.
  dueOn: string | null;
  // The month's rent, the tax instalment, the mortgage instalment, or the lease's monthly rent (rent_below_market's too).
  amount: number | null;
  // rent_unpaid, lease_ending and rent_below_market.
  rentalContractUuid: string | null;
  tenant: string | null;
  rentPeriod: string | null; // "YYYY-MM"
  // mortgage_instalment_unpaid.
  mortgageUuid: string | null;
  instalmentNumber: number | null;
  lender: string | null;
  // tax_due.
  taxKind: TaxKind | null;
  taxName: string | null;
  taxYear: number | null;
  // loan_to_value.
  loanToValuePct: number | null;
  residualDebt: number | null;
  valueAtShare: number | null;
  // zone_price_drop and rent_below_market: the zone, the semester quoted, and the gap (negative,
  // in percent) between perSqm and referencePerSqm — the latest middle sale price per m² against a
  // year earlier's, or the lease's rent per m² a month against the zone's minimum.
  zone?: MarketZone | null;
  semester?: MarketSemester | null;
  changePct?: number | null;
  perSqm?: number | null;
  referencePerSqm?: number | null;
}

/**
 * A rule, checked every morning: it notifies only the facts it hadn't found at its previous check.
 * `findings` is what it finds now ([] while disabled); those found when it was created, changed or
 * re-enabled are known already and not notified.
 */
export interface RealEstateAlertRule {
  uuid: string;
  // Null: every property.
  propertyUuid: string | null;
  params: RealEstateAlertParams;
  notifyEmail: boolean;
  notifyInApp: boolean;
  enabled: boolean;
  findings: RealEstateAlertFinding[];
  lastCheckedAt: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RealEstateAlertRuleInput {
  propertyUuid?: string | null;
  params: RealEstateAlertParams;
  notifyEmail?: boolean;
  notifyInApp?: boolean;
}

// Only the fields sent change; params may switch type.
export interface RealEstateAlertRuleUpdateRequest {
  params?: RealEstateAlertParams;
  notifyEmail?: boolean;
  notifyInApp?: boolean;
  enabled?: boolean;
}

// ── Mortgage simulations (nothing is stored) ──

/** A mortgage's schedule from a day on: as it stands, or as a prepayment or refinancing would leave it. */
export interface ScheduleOutlook {
  // Owed at the end of the day, after that day's instalment and, simulated, the prepayment.
  residualDebt: number;
  // Due after the day, oldest first.
  instalments: Instalment[];
  instalmentCount: number;
  // 0 when none is left.
  nextPayment: number;
  ratePct: number;
  lastInstalmentOn: string | null;
  // The instalments' interest, summed.
  interest: number;
  totalPaid: number;
}

export interface PrepaymentSimulationRequest {
  // Today or later, while something is still owed.
  prepaidOn: string;
  // > 0; more than is owed pays the mortgage off.
  amount: Amount;
  // Default reduce_instalment.
  effect?: PrepaymentEffect;
  // The bank's charges, ≥ 0 (Italy: none on a person's home loan).
  costs?: Amount;
}

export interface PrepaymentSimulation {
  currency: string;
  // The amount applied: at most what was owed.
  prepaid: number;
  current: ScheduleOutlook;
  simulated: ScheduleOutlook;
  interestSaved: number;
  costs: number;
  // interestSaved - costs.
  netSaving: number;
}

/** A surroga or renegotiation: the residual debt moved to a new rate and term, no extra money. */
export interface RefinancingSimulationRequest {
  refinancedOn: string;
  rate: MortgageRateInput;
  // 1-600; default: the months left, rounded up to whole instalments.
  termMonths?: number;
  // Default: the current one.
  frequency?: InstalmentFrequency;
  // Notary, appraisal, fees, ≥ 0 (Italy: none on a surroga).
  costs?: Amount;
}

export interface RefinancingSimulation {
  currency: string;
  // Owed on the day: the new mortgage's principal.
  principal: number;
  termMonths: number;
  current: ScheduleOutlook;
  refinanced: ScheduleOutlook;
  // Negative when the new schedule costs more interest (a longer term).
  interestSaved: number;
  costs: number;
  netSaving: number;
  // With costs only: the first new instalment by which the interest saved covers them; null if never.
  breakEvenInstalment: number | null;
  breakEvenOn: string | null;
}

// ── Market (Italy: the OMI, Agenzia delle Entrate) ──

export interface MarketSemester {
  year: number;
  half: 1 | 2;
}

/** A municipality's market zone: its code ("B1"), its band (central, semi-central…) and what it covers. */
export interface MarketZone {
  country: string;
  municipalityCode: string;
  code: string;
  band: string;
  description: string;
  semester: MarketSemester;
}

/** A zone's quotation for a kind of building, per m²: the sale range, and the rent's a month. */
export interface MarketQuotation {
  semester: MarketSemester;
  buildingTypeCode: string;
  buildingType: string;
  // The state of repair quoted ("normal", "excellent"…).
  state: string;
  saleMin: number;
  saleMax: number;
  saleSurface: "gross" | "net" | null;
  rentMin: number | null;
  rentMax: number | null;
  rentSurface: "gross" | "net" | null;
}

export type MarketStatus = "available" | "no_source" | "missing_fields" | "no_data" | "no_zone" | "not_quoted";

/** What the market of a property's zone says of it: an indicative range, not an appraisal. */
export interface PropertyMarket {
  propertyUuid: string;
  status: MarketStatus;
  // missing_fields: address.location, details.municipality_code; available: surface_sqm (the value needs it).
  missingFields: string[];
  zone: MarketZone | null;
  // How the zone was found: picked by the user, or from the address's location.
  match: "user" | "location" | null;
  // For the property's kind.
  quotation: MarketQuotation | null;
  // Every kind of building the zone has.
  zoneQuotations: MarketQuotation[];
  // The whole property's, in EUR: the surface by the sale range.
  value: { low: number; mid: number; high: number } | null;
  // Today's lease against the zone's rents.
  rent: { monthlyRent: number; monthlyRentPerSqm: number; position: "below" | "within" | "above"; rentalContractUuid?: string } | null;
  // The zone's middle prices by semester, for the quotation's building type and state; null unless available.
  trend?: MarketTrend | null;
  // To show wherever these figures are (CC BY 4.0).
  attribution: string | null;
}

/**
 * A zone's middle prices over the semesters, oldest first (a semester without the building type and
 * state is left out: they needn't follow on). Changes in percent: against the semester before the
 * latest, and against the same half a year earlier; null when that point is missing.
 */
export interface MarketTrend {
  buildingTypeCode: number | string;
  buildingType: string;
  state: string;
  points: { semester: MarketSemester; saleMid: number; rentMid: number | null }[];
  saleChangeSemesterPct: number | null;
  saleChangeYearPct: number | null;
  rentChangeSemesterPct: number | null;
  rentChangeYearPct: number | null;
}

