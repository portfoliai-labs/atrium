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

export type {
  TaxationMode, CostMethod, TaxCategory, ConsumedLot, RealizedGain, GainsBreakdown, RealizedGains,
  OffsetLoss, TaxedIncome, WithheldAccount, CarriedLoss, UnrealizedGain, TaxYear,
  IncomeKind, IncomePayment, InvestmentIncome, IncomeCategory, WithheldIncome,
};
export { TAX_REGIME_UNAVAILABLE };
