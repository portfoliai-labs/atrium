// models/FinancialStatements.ts
// GET /v1/assets/{listing_id}/financial-statements?frequency=annual|quarterly: a share's company's
// income statement, balance sheet and cash flow statement, census' (from the company's filings).

export type StatementsFrequency = "annual" | "quarterly";

// Where the whole table comes from: the company's filings with the SEC (EDGAR; cite the SEC, never
// its seal or logos), its ESEF reports (via filings.xbrl.org), or the price provider's
// statements (a last resort, for a company filing neither).
export type StatementsSource = "sec_filing" | "esef_report" | "price_provider";

// A line item's figure: `unit` a currency (ISO 4217), per share in it ("USD/shares") or
// "shares", as reported. `url` the filing it was read from and `filed` (YYYY-MM-DD) when it was
// filed; both null for a computed figure (a fourth quarter's flow, the free cash flow), `url`
// null for the price provider's.
export interface StatementFigure {
  item: string;
  value: number;
  unit: string;
  url: string | null;
  filed: string | null;
  computed: boolean;
}

// A fiscal year or quarter (YYYY-MM-DD): its flows over it, its balance at its end.
export interface StatementPeriod {
  start: string;
  end: string;
  figures: StatementFigure[];
}

export interface FinancialStatements {
  frequency: StatementsFrequency;
  // Null with no periods when there are none (a fund, or a company no source has).
  source: StatementsSource | null;
  // The latest first: at most ten years, or twelve quarters.
  periods: StatementPeriod[];
}

export type StatementKey = "income" | "balance" | "cashFlow";

// Each statement's line items, in the order they are shown, with their labels.
export const STATEMENTS: { key: StatementKey; title: string; items: [string, string][] }[] = [
  {
    key: "income", title: "Income", items: [
      ["revenue", "Revenue"],
      ["cost_of_revenue", "Cost of revenue"],
      ["gross_profit", "Gross profit"],
      ["research_and_development", "Research & development"],
      ["selling_general_administrative", "Selling, general & admin."],
      ["operating_income", "Operating income"],
      ["interest_expense", "Interest expense"],
      ["income_before_tax", "Income before tax"],
      ["income_tax", "Income tax"],
      ["net_income", "Net income"],
      ["net_income_to_parent", "Net income to shareholders"],
      ["eps_basic", "EPS (basic)"],
      ["eps_diluted", "EPS (diluted)"],
      ["diluted_shares", "Diluted shares"],
    ],
  },
  {
    key: "balance", title: "Balance sheet", items: [
      ["cash_and_equivalents", "Cash & equivalents"],
      ["current_assets", "Current assets"],
      ["total_assets", "Total assets"],
      ["current_liabilities", "Current liabilities"],
      ["total_liabilities", "Total liabilities"],
      ["long_term_debt", "Long-term debt"],
      ["total_equity", "Total equity"],
      ["equity_to_parent", "Equity to shareholders"],
    ],
  },
  {
    key: "cashFlow", title: "Cash flow", items: [
      ["operating_cash_flow", "From operations"],
      ["capital_expenditure", "Capital expenditure"],
      ["free_cash_flow", "Free cash flow"],
      ["investing_cash_flow", "From investing"],
      ["financing_cash_flow", "From financing"],
      ["dividends_paid", "Dividends paid"],
      ["share_buybacks", "Share buybacks"],
    ],
  },
];
