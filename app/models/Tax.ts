import type { PropertyTax, TaxKind } from "./RealEstate";
// models/Tax.ts
// The user's taxes on their investments (GET /v1/taxes/..., an advisor's client's under
// /v1/advisor/clients/{c}/taxes/...), after nucleo's contracts: camelCase, amounts numbers in the
// response's `currency`. The taxpayer is the owner, across all their standard portfolios (not the
// strategies' backtests). Estimates on the recorded transactions: the disclaimer is the
// frontend's, the backend sends none.

// Who pays a portfolio's taxes (PortfolioResponse.taxationMode, PUT .../taxation-mode): the user,
// in their tax return ("declared", Italy's regime dichiarativo, the default), or its broker, as
// they come ("withheld", regime amministrato). A withheld portfolio's lots, gains and losses are
// its own: they never offset another portfolio's.
type TaxationMode = "declared" | "withheld";

// How a sale's cost is taken. Without one asked, the tax regime's (Italy: average_cost).
type CostMethod = "average_cost" | "fifo";

// How a regime taxes a gain or an income. Italy's gains': redditi_diversi (capital gains, offset by the losses),
// redditi_diversi_titoli_pubblici (government bonds, a share of the gain taxed), redditi_di_capitale
// (an ETF's or a fund's gain: it offsets no loss), cripto_attivita; its income's: dividendi,
// proventi_oicr, interessi, interessi_titoli_pubblici. Another regime may add its own.
type TaxCategory = "redditi_diversi" | "redditi_diversi_titoli_pubblici" | "redditi_di_capitale" | "cripto_attivita" | (string & {});

// FIFO only: one lot a sale took, oldest first.
interface ConsumedLot {
  acquiredOn: string;
  quantity: number;
  cost: number;
}

// One disposal (a sale, a redemption): its proceeds net of fees against what its units cost.
interface RealizedGain {
  transactionUuid: string;
  portfolioUuid: string;
  assetId: string;
  ticker: string | null;
  isin: string | null;
  executedAt: string;
  quantity: number;
  proceeds: number;
  cost: number;
  gain: number;
  // Units sold beyond those held then: neither their proceeds nor a cost are in the gain.
  uncoveredQuantity: number;
  lots: ConsumedLot[];
  // null without a tax regime.
  taxCategory: TaxCategory | null;
  // The share of the gain that's taxed (Italy: 0.4808 for government bonds, otherwise 1).
  taxableShare: number | null;
  taxationMode: TaxationMode;
  // A withheld portfolio's, with a regime: what its broker withholds. Otherwise null.
  withheldTax: number | null;
}

// A breakdown's row: `key` an asset id (byAsset) or a portfolio uuid (byPortfolio).
interface GainsBreakdown {
  key: string;
  gains: number;
  // ≤ 0.
  losses: number;
  net: number;
}

// GET /v1/taxes/realized-gains?year=&method= — the year's disposals. 422 for a year before 1900 or
// in the future; 503 for a currency without rates.
interface RealizedGains {
  currency: string;
  method: CostMethod;
  gains: RealizedGain[];
  totalGains: number;
  // ≤ 0.
  totalLosses: number;
  net: number;
  byAsset: GainsBreakdown[];
  byPortfolio: GainsBreakdown[];
  // ISO 3166-1 alpha-2; null until the user gives it.
  taxResidence: string | null;
  // Assets the market data couldn't describe, classed as the regime's default.
  unclassifiedAssetIds: string[];
}

interface OffsetLoss {
  originYear: number;
  amount: number;
}

// A kind of income in the year, its amounts counted by their taxable share.
interface TaxedIncome {
  category: TaxCategory;
  gains: number;
  // ≤ 0.
  losses: number;
  // The earlier years' losses it took.
  offsetLosses: OffsetLoss[];
  taxable: number;
  // e.g. 0.26.
  rate: number;
  tax: number;
}

// What one withheld portfolio's broker takes in the year.
interface WithheldAccount {
  portfolioUuid: string;
  incomes: TaxedIncome[];
  tax: number;
}

// A loss left to offset later gains (Italy's zainetto fiscale).
interface CarriedLoss {
  // The kind of income it offsets: "redditi_diversi" | "cripto_attivita".
  category: TaxCategory;
  originYear: number;
  // The last year it can offset gains in: lost on 31 December of it.
  usableUntil: number;
  amount: number;
  // A withheld portfolio's (its broker offsets it against that portfolio's gains only); null:
  // the tax return's.
  portfolioUuid: string | null;
}

// A position held in gain, as if sold today at its last price.
interface UnrealizedGain {
  // The withheld portfolio holding it; null for the declared ones.
  portfolioUuid: string | null;
  assetId: string;
  ticker: string | null;
  isin: string | null;
  quantity: number;
  cost: number;
  value: number;
  gain: number;
  taxCategory: TaxCategory;
  taxableShare: number;
  // The losses' category its gain would offset; null when it wouldn't (Italy: an ETF's or a
  // fund's gain, redditi di capitale): selling it doesn't use the losses.
  offsets: TaxCategory | null;
}

// GET /v1/taxes/years/{year} — the year by the regime of the user's tax residence. 409
// TaxRegimeUnavailableError without a residence, or for a country without a regime (Italy only,
// for now).
interface TaxYear {
  // ISO 3166-1 alpha-2: whose regime.
  country: string;
  currency: string;
  year: number;
  // The declared portfolios': what goes in the tax return.
  incomes: TaxedIncome[];
  tax: number;
  // Each withheld portfolio's, as its broker takes it.
  withheld: WithheldAccount[];
  withheldTax: number;
  // The losses left for the years after it.
  carriedLosses: CarriedLoss[];
  // The losses whose last usable year it is.
  expiringLosses: CarriedLoss[];
  // The year in course only, while a loss expires: the positions in gain that would take it.
  harvestable: UnrealizedGain[];
  unclassifiedAssetIds: string[];
  // The investment income (dividends, coupons, interest): the declared portfolios' by category,
  // never offset with the gains' losses; each withheld portfolio's, as its broker taxed it at
  // source; and the declared income's estimated tax. `tax` is the gains': what's declared in all
  // is tax + incomeTax.
  investmentIncome: IncomeCategory[];
  withheldIncome: WithheldIncome[];
  incomeTax: number;
}

// What a payment of investment income is: a dividend, a coupon, the accrued interest received
// with a bond's sale, the cash's interest.
type IncomeKind = "dividend" | "coupon" | "accrued_interest" | "cash_interest";

// One payment of investment income, in the response's currency at its day's rate.
interface IncomePayment {
  transactionUuid: string;
  portfolioUuid: string;
  // null for the cash's interest.
  assetId: string | null;
  ticker: string | null;
  isin: string | null;
  executedAt: string;
  kind: IncomeKind;
  gross: number;
  // The tax withheld at source (abroad), as recorded.
  withheldAtSource: number;
  // The accrued interest paid with the bond's buy that this coupon gives back.
  accruedOffset: number;
  taxationMode: TaxationMode;
  // With a regime: its category and rate (Italy: dividendi 0.26, proventi_oicr 0.26 for ETFs and
  // funds, interessi 0.26, interessi_titoli_pubblici 0.125). null without one.
  taxCategory: TaxCategory | null;
  rate: number | null;
  // A declared portfolio's only (gross − withheld at source − accrued offset, in the quadro RM),
  // with a regime; a withheld one's was taxed at source by its broker: null.
  taxable: number | null;
  tax: number | null;
}

// GET /v1/taxes/income?year= — the year's investment income. 422 for a year before 1900 or in
// the future; 503 for a currency without rates.
interface InvestmentIncome {
  currency: string;
  payments: IncomePayment[];
  totalGross: number;
  totalWithheldAtSource: number;
  // With a regime: the declared payments' estimated tax.
  totalTax: number | null;
  taxResidence: string | null;
  unclassifiedAssetIds: string[];
}

// A year's declared income of one category.
interface IncomeCategory {
  category: TaxCategory;
  gross: number;
  withheldAtSource: number;
  accruedOffset: number;
  taxable: number;
  rate: number;
  tax: number;
}

// A year's income in a portfolio whose broker taxed it at source.
interface WithheldIncome {
  portfolioUuid: string;
  gross: number;
  withheldAtSource: number;
}

// The 409's error_type: no tax residence, or no regime for it.
const TAX_REGIME_UNAVAILABLE = "TaxRegimeUnavailableError";

// ── A whole year ──────────────────────────────────────────────────────────────────────────

// A currency's taxes of the year, never converted.
interface YearTotal {
  currency: string;
  // What the tax return pays on the investments (gains and income).
  investments: number;
  // What the brokers withhold.
  withheld: number;
  // The properties' computed taxes, what was paid of them (up to each tax) and what is left.
  properties: number;
  propertiesPaid: number;
  propertiesDue: number;
  // The taxes on holdings the user pays (IVAFE, the crypto-assets' tax, IVIE: in `total`), and the
  // stamp duty the banks and brokers charge (estimated: outside `total`). Absent from an older backend.
  wealth?: number;
  wealthWithheld?: number;
  total: number;
}

// A property's tax instalment with something to pay, or a tax on holdings' (`wealthKind`: no
// property, `paid` always false, its F24 `taxCode`).
interface DueInstalment {
  propertyUuid: string | null;
  propertyName: string | null;
  kind: TaxKind | null;
  taxName: string;
  number: number;
  dueOn: string;
  currency: string;
  amount: number;
  paid: boolean;
  wealthKind?: WealthTaxKind | null;
  taxCode?: string | null;
}

// GET /v1/taxes/overview/{year} — every tax of a year. 422 for a year before 1900 or in the
// future; 503 for a currency without rates.
interface YearTaxes {
  year: number;
  // Null without a regime: investmentsUnavailable says why (TAX_REGIME_UNAVAILABLE).
  investments: TaxYear | null;
  investmentsUnavailable: { errorType: string; country: string | null } | null;
  // False for an advisor reading a client's: the properties are the owner's to read.
  propertiesIncluded: boolean;
  properties: { propertyUuid: string; name: string; taxes: PropertyTax[] }[];
  totals: YearTotal[];
  // The properties' and the taxes on holdings' instalments by due day.
  instalments: DueInstalment[];
  // The taxes on holdings: the user's own only (null for an advisor's client, or with
  // wealthUnavailable: no regime, a currency without a rate).
  wealth?: WealthTaxes | null;
  wealthUnavailable?: { errorType: string; country: string | null } | null;
}

// ── The taxes on holdings (GET /v1/taxes/wealth/{year}, and the overview's `wealth`) ──────
// Italy's, by who keeps each holding (models/Custody): the stamp duty a bank or broker in Italy
// charges (withheld, estimated, outside what the user pays), the IVAFE on accounts and products
// abroad, the tax on crypto-assets kept without an Italian intermediary, the IVIE on properties
// abroad (their purchase price, else the latest valuation, else the user's value for the year).

type WealthTaxKind =
  | "accounts_stamp_duty" | "securities_stamp_duty" | "foreign_accounts_tax" | "foreign_securities_tax"
  | "crypto_assets_tax" | "foreign_property_tax";

type HoldingKind = "account" | "portfolio" | "property";

type WealthValueSource = "year_end_price" | "exit_price" | "average_balance" | "purchase_price" | "valuation" | "user";

interface Holding {
  kind: HoldingKind;
  uuid: string;
  name: string;
}

// One holding's part of a tax: an account, an instrument (or the cash) in a portfolio, a property.
interface WealthLine {
  holding: Holding;
  assetId: string | null;
  isin: string | null;
  ticker: string | null;
  custodyCountry: string | null;
  intermediaryName: string | null;
  // An account's mean balance (the threshold's), else the value taxed, at full ownership, in
  // `currency`; null for a property without one (set it: PUT .../overrides).
  value: number | null;
  currency: string;
  valueSource: WealthValueSource | null;
  // Days held (accounts, products, crypto-assets), months (properties).
  days: number;
  months: number;
  sharePct: number;
  ratePct: number | null;
  fixedAmount: number | null;
  // Accounts: false when the intermediary's mean balance is within 5,000 euro; properties: false
  // when the tax on the whole value for a whole year is within 200 euro. Either way no tax.
  aboveThreshold: boolean;
  // The IVAFE at 4 per mille, in a state with a privileged tax regime.
  privilegedRegime: boolean;
  tax: number;
  credit: number;
  exemptMonths: number;
}

interface WealthInstalment {
  // 1, 2: on account for the year; 3: the balance with the next year's return.
  number: number;
  dueOn: string;
  amount: number;
  // The F24's codice tributo.
  taxCode: string;
}

interface WealthTax {
  kind: WealthTaxKind;
  name: string;
  status: "computed" | "exempt" | "not_computed";
  notComputed: string | null;
  // The stamp duty: charged by the bank or broker, outside toPay, no instalments.
  withheld: boolean;
  gross: number;
  credit: number;
  deduction: number;
  amount: number;
  lines: WealthLine[];
  instalments: WealthInstalment[];
}

interface WealthTaxes {
  year: number;
  country: string;
  // Every amount's (the regime's: EUR).
  currency: string;
  taxes: WealthTax[];
  toPay: number;
  withheld: number;
  // Left out: who keeps them isn't known yet (set it on the wallet or the portfolio).
  unknownCustody: Holding[];
  unpricedAssetIds: string[];
}

// PUT /v1/taxes/wealth/overrides/{kind}/{uuid}/{year}: a property's `value` (its currency, the
// whole property's), an account's or a portfolio's `foreignTaxPaid` (euro).
interface HoldingOverrideRequest {
  value?: number | null;
  foreignTaxPaid?: number | null;
}

// ── The tax alert rules (/v1/taxes/alert-rules) ──────────────────────────────────────────

type TaxAlertType = "tax_due" | "losses_expiring";

// tax_due: an instalment of a property's tax due within `daysBefore` days (or overdue), not paid.
// losses_expiring: earlier losses the year in course is the last to offset, from fromMonth/fromDay
// on (1 October by default).
type TaxAlertParams =
  | { type: "tax_due"; daysBefore: number }
  | { type: "losses_expiring"; fromMonth: number; fromDay: number };

interface ExpiringLoss {
  category: TaxCategory;
  originYear: number;
  amount: number;
  // A withheld portfolio's; null for the tax return's.
  portfolioUuid: string | null;
  portfolioName: string | null;
}

interface TaxAlertFinding {
  key: string;
  kind: TaxAlertType;
  currency: string;
  // The instalment's due day; the year's last day for losses_expiring.
  dueOn: string | null;
  amount: number;
  // tax_due.
  propertyUuid: string | null;
  propertyName: string | null;
  taxKind: TaxKind | null;
  taxName: string | null;
  taxYear: number | null;
  instalmentNumber: number | null;
  // losses_expiring.
  losses: ExpiringLoss[];
  harvestablePositions: number | null;
}

interface TaxAlertRule {
  uuid: string;
  // tax_due only: one property's taxes; null: every tax.
  propertyUuid: string | null;
  params: TaxAlertParams;
  notifyEmail: boolean;
  notifyInApp: boolean;
  enabled: boolean;
  findings: TaxAlertFinding[];
  lastCheckedAt: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TaxAlertRuleRequest {
  propertyUuid: string | null;
  params: TaxAlertParams;
  notifyEmail: boolean;
  notifyInApp: boolean;
}

type TaxAlertRuleUpdateRequest = Partial<Pick<TaxAlertRule, "params" | "notifyEmail" | "notifyInApp" | "enabled">>;

export type {
  TaxationMode, CostMethod, TaxCategory, ConsumedLot, RealizedGain, GainsBreakdown, RealizedGains,
  OffsetLoss, TaxedIncome, WithheldAccount, CarriedLoss, UnrealizedGain, TaxYear,
  IncomeKind, IncomePayment, InvestmentIncome, IncomeCategory, WithheldIncome,
  YearTotal, DueInstalment, YearTaxes,
  WealthTaxKind, HoldingKind, WealthValueSource, Holding, WealthLine, WealthInstalment, WealthTax, WealthTaxes,
  HoldingOverrideRequest,
  TaxAlertType, TaxAlertParams, ExpiringLoss, TaxAlertFinding, TaxAlertRule, TaxAlertRuleRequest, TaxAlertRuleUpdateRequest,
};
export { TAX_REGIME_UNAVAILABLE };
