// models/Wallet.ts
// The wallets' bodies (/v1/wallets, ianus' dto/wallets.py, arca's contracts): camelCase. Amounts
// come back as numbers and are accepted as numbers or decimal strings. Dates are YYYY-MM-DD,
// months YYYY-MM.

export type WalletKind = "current_account" | "credit_card" | "savings" | "cash";

// Whether a movement is income or spending is its sign (money in positive), never its category.
export type MovementCategory =
  | "salary" | "freelance" | "refunds" | "interest" | "other_income"
  | "housing" | "groceries" | "restaurants" | "transport" | "utilities" | "subscriptions"
  | "shopping" | "health" | "travel" | "leisure" | "other_spending";

export type MovementSource = "manual" | "import" | "bank";

export type Amount = number | string;

export interface Wallet {
  uuid: string;
  name: string;
  kind: WalletKind;
  institution: string | null;
  // ISO 4217, the wallet's own.
  currency: string;
  openingBalance: number;
  // No movement can be booked before it.
  openingDate: string;
  color: string | null;
  // Read only, and left out of the figures across wallets.
  archived: boolean;
  // The opening balance plus every movement, in the wallet's currency (negative on a card: owed).
  balance: number;
  lastMovementDate: string | null;
  createdAt: string;
}

export interface WalletCreateRequest {
  name: string;
  kind: WalletKind;
  currency: string;
  institution?: string | null;
  openingBalance?: Amount;
  openingDate?: string;
  color?: string | null;
}

// The fields to change: null or left out keeps the value. The currency changes only while the
// wallet has no movements.
export type WalletUpdateRequest = Partial<WalletCreateRequest>;

export interface Movement {
  uuid: string;
  walletUuid: string;
  bookedOn: string;
  description: string;
  counterparty: string | null;
  // null: not categorised yet, and always on a transfer's leg.
  category: MovementCategory | null;
  // Signed: money in positive. In the wallet's currency.
  amount: number;
  currency: string;
  note: string | null;
  source: MovementSource;
  // The transfer it is a leg of, and the other leg's wallet.
  transferUuid: string | null;
  counterpartWalletUuid: string | null;
  createdAt: string;
}

export interface MovementInput {
  bookedOn: string;
  description: string;
  amount: Amount;
  category?: MovementCategory | null;
  counterparty?: string | null;
  note?: string | null;
}

// The fields to change. A transfer's leg takes no date, amount or category change; a category is
// cleared with categorize.
export type MovementUpdateRequest = Partial<MovementInput>;

// Newest first.
export interface MovementList {
  items: Movement[];
  total: number;
  limit: number;
  offset: number;
}

export interface MovementFilters {
  bookedFrom?: string;
  bookedTo?: string;
  categories?: MovementCategory[];
  uncategorizedOnly?: boolean;
  // In the description, the counterparty or the note.
  text?: string;
  direction?: "in" | "out";
  excludeTransfers?: boolean;
  // 1-200, 50 by default.
  limit?: number;
  offset?: number;
}

export interface TransferCreateRequest {
  fromWalletUuid: string;
  toWalletUuid: string;
  bookedOn: string;
  // Leaves "from", in its currency (> 0).
  amount: Amount;
  // Reaches "to", in its own currency: required when the currencies differ.
  receivedAmount?: Amount;
  description?: string;
  note?: string;
}

export interface Transfer {
  transferUuid: string;
  outgoing: Movement;
  incoming: Movement;
}

export interface WalletSummaryMonth {
  month: string;
  income: number;
  // A positive amount.
  spending: number;
  net: number;
  // At the month's end (today, for the current one).
  closingBalance: number;
}

/**
 * A wallet's months in its own currency, or every non-archived wallet's in the user's reference
 * currency (transfers between them neither income nor spending). Oldest first, empty months
 * included.
 */
export interface WalletSummary {
  currency: string;
  months: WalletSummaryMonth[];
}

// ── Budgets ──

/** A spending category's monthly limit, across every non-archived wallet. */
export interface Budget {
  category: MovementCategory;
  monthlyLimit: number;
  // The user's reference currency when the limit was set.
  currency: string;
  // YYYY-MM: the month the limit holds from (a limit changed or removed later keeps the months before).
  since: string;
}

export interface BudgetInput {
  category: MovementCategory;
  // Above 0; a decimal string stays exact.
  monthlyLimit: string;
}

// The first that holds: over the limit, 90% of it or more, ahead of the even pace by over 5% of it.
export type BudgetStatus = "over" | "almost_used" | "ahead_of_pace" | "on_track";

export interface BudgetProgress {
  // null for the total.
  category: MovementCategory | null;
  limit: number;
  // Money out less money in, never below 0.
  spent: number;
  // Where spending would be at an even pace: limit × daysElapsed / daysInMonth.
  expected: number;
  status: BudgetStatus;
  // The wallets that spent in it, most first, in the reference currency.
  wallets: { walletUuid: string; spent: number }[];
}

/** A month's spending against the budgets it had, in the user's reference currency. */
export interface BudgetMonth {
  currency: string;
  // YYYY-MM.
  month: string;
  daysInMonth: number;
  // Every day of a past month; today included, for the current one.
  daysElapsed: number;
  // In the categories' order.
  budgets: BudgetProgress[];
  total: BudgetProgress;
}

// ── Alerts ──

export type WalletAlertType = "low_balance" | "budget_threshold" | "large_payment" | "income_received";

// One type with its one parameter: an amount (as a decimal string: in the wallet's currency), a
// percentage of a budget's limit, or an income category.
export type WalletAlertParams =
  | { type: "low_balance"; threshold: string }
  | { type: "budget_threshold"; thresholdPct: string }
  | { type: "large_payment"; threshold: string }
  | { type: "income_received"; category: MovementCategory };

/** A fact a rule finds; amounts in `currency` (the wallet's, or the reference one for a budget). */
export interface WalletAlertFinding {
  // Stable while the fact lasts: a rule tells it once.
  key: string;
  kind: WalletAlertType;
  currency: string;
  // The balance, the month's spending, the payment (positive), the money in.
  amount: number;
  // null for a budget.
  walletUuid: string | null;
  walletName: string | null;
  movementUuid: string | null;
  bookedOn: string | null;
  description: string | null;
  counterparty: string | null;
  category: MovementCategory | null;
  // budget_threshold: the limit and the month (YYYY-MM).
  limit: number | null;
  month: string | null;
}

/**
 * A rule on one wallet or on every one (`walletUuid` null): low_balance and large_payment name
 * their wallet, budget_threshold none, income_received either. Checked every morning: it tells,
 * by email and/or in the app, only what it hadn't found the day before.
 */
export interface WalletAlertRule {
  uuid: string;
  walletUuid: string | null;
  params: WalletAlertParams;
  notifyEmail: boolean;
  notifyInApp: boolean;
  enabled: boolean;
  // What it finds today; empty while it's off.
  findings: WalletAlertFinding[];
  lastCheckedAt: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WalletAlertRuleCreateRequest {
  walletUuid: string | null;
  params: WalletAlertParams;
  notifyEmail: boolean;
  notifyInApp: boolean;
}

// Only the fields sent change; params keep the rule's type.
export interface WalletAlertRuleUpdateRequest {
  params?: WalletAlertParams;
  notifyEmail?: boolean;
  notifyInApp?: boolean;
  enabled?: boolean;
}

// ── Statement import ──

export type StatementField = "date" | "description" | "amount" | "debit" | "credit" | "counterparty" | "currency";

export interface StatementFieldMapping {
  sourceColumn: string;
  confidence: "high" | "medium" | "low";
  // For a date that isn't ISO 8601 (strptime, e.g. "%d/%m/%Y").
  dateFormat?: string | null;
  decimalSeparator?: string | null;
  thousandsSeparator?: string | null;
}

// Proposed by analyze-columns, sent back to commit as it is with the user's corrections. Needs date,
// description and an amount (or debit and/or credit).
export interface StatementColumnMapping {
  fingerprint: string;
  fields: Partial<Record<StatementField, StatementFieldMapping>>;
  // The amount column writes spending as positive (many card statements do).
  spendingIsPositive: boolean;
  // Lines before the column names.
  skipRows: number;
}

export interface StatementColumnMappingResponse extends StatementColumnMapping {
  isFromCache: boolean;
}

export interface AnalyzeStatementRequest {
  headers: string[];
  sampleRows: Record<string, string>[];
  columnProfiles?: Record<string, { distinctValues: string[]; nullRatePct: number }>;
}

export interface StatementImportResult {
  imported: number;
  // Already in the wallet from an earlier import.
  duplicates: number;
  rejected: { rowNumber: number; reason: string }[];
  firstBookedOn: string | null;
  lastBookedOn: string | null;
}
