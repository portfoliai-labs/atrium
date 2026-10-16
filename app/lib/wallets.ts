// lib/wallets.ts
//
// WALLETS — what every wallet page shares: the names and colours of kinds and categories, where a
// page reads its figures from (a WalletSource: the API, or a demo account's sample data, see
// lib/mock/wallets), and the sums the API doesn't make yet (spending by category).

import type {
  BudgetMonth, Cadence, CategoryMonths, Merchants, MovementCategory, MovementFilters, MovementList, Observation, Observations,
  RecurringPayments, Wallet, WalletAlertFinding, WalletAlertParams,
  WalletAlertRule, WalletAlertType, WalletKind, WalletSummary,
} from "../models/Wallet";
import { formatCurrency } from "./format";
import { walletService } from "../services/walletService";

/** The id of every wallet together (the Wallets hub, "All wallets"). */
export const ALL_WALLETS = "all";

export const KIND_LABELS: Record<WalletKind, string> = {
  current_account: "Current account",
  credit_card: "Credit card",
  savings: "Savings",
  cash: "Cash",
};
export const WALLET_KINDS = Object.keys(KIND_LABELS) as WalletKind[];

export const INCOME_CATEGORIES: MovementCategory[] = ["salary", "freelance", "refunds", "interest", "other_income"];
export const SPENDING_CATEGORIES: MovementCategory[] = [
  "housing", "groceries", "restaurants", "transport", "utilities", "subscriptions", "shopping", "health", "travel", "leisure", "other_spending",
];

export const CATEGORY_LABELS: Record<MovementCategory, string> = {
  salary: "Salary", freelance: "Freelance", refunds: "Refunds", interest: "Interest", other_income: "Other income",
  housing: "Housing", groceries: "Groceries", restaurants: "Restaurants", transport: "Transport", utilities: "Utilities",
  subscriptions: "Subscriptions", shopping: "Shopping", health: "Health", travel: "Travel", leisure: "Leisure", other_spending: "Other spending",
};

export const CATEGORY_COLORS: Record<MovementCategory, string> = {
  salary: "#1baf7a", freelance: "#008300", refunds: "#2a78d6", interest: "#4a3aa7", other_income: "#64748b",
  housing: "#2a78d6", groceries: "#1baf7a", restaurants: "#eb6834", transport: "#eda100", utilities: "#4a3aa7",
  subscriptions: "#e87ba4", shopping: "#e34948", health: "#008300", travel: "#0ea5e9", leisure: "#a16207", other_spending: "#64748b",
};

// A movement with no category yet; a transfer's leg.
export const UNCATEGORIZED_COLOR = "#94a3b8";
export const TRANSFER_COLOR = "#94a3b8";

export const categoryLabel = (c: MovementCategory | null) => (c ? CATEGORY_LABELS[c] : "Uncategorised");
export const categoryColor = (c: MovementCategory | null) => (c ? CATEGORY_COLORS[c] : UNCATEGORIZED_COLOR);

/** The colours a new wallet can take; the first free one is offered. */
export const WALLET_COLORS = ["#2a78d6", "#1baf7a", "#e34948", "#eda100", "#4a3aa7", "#0ea5e9", "#e87ba4", "#0f766e"];

/** A wallet's colour: its own, or one of WALLET_COLORS by its place in the list. */
export const walletColor = (wallet: Pick<Wallet, "color">, index: number) => wallet.color ?? WALLET_COLORS[index % WALLET_COLORS.length];

/** Currencies offered for a new wallet (any ISO 4217 code can be typed). */
export const COMMON_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "SEK", "NOK", "DKK", "PLN", "CZK"];

/** Today, as the API writes days (YYYY-MM-DD), in the user's own time zone. */
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-10" → "Oct 26". */
export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/** "2026-10" → "October 2026". */
export function monthName(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** "2026-10-04" → "Oct 4, 2026", read as a calendar day (no time zone shift). */
export function dayLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

/** A savings rate: the share of income not spent, null with no income. */
export function savingsRate(months: { income: number; spending: number }[]) {
  const income = months.reduce((s, m) => s + m.income, 0);
  const spending = months.reduce((s, m) => s + m.spending, 0);
  return income > 0 ? ((income - spending) / income) * 100 : null;
}

// ── Where the figures come from ──

/**
 * Where a wallet page reads from: the API (apiWalletSource) or, for a demo account, the sample
 * data (lib/mock/wallets' demoWalletSource), in the same shapes. Writes always go to walletService:
 * a demo account's are refused (see lib/demo).
 */
export interface WalletSource {
  summary(walletUuid: string | null, from?: string, to?: string): Promise<WalletSummary>;
  movements(walletUuid: string | null, filters?: MovementFilters): Promise<MovementList>;
  // A month (YYYY-MM, this one by default) against the budgets, across the wallets.
  budgetMonth(month?: string): Promise<BudgetMonth>;
  // Every alert rule, or a wallet's (its own and those on every wallet), with what each finds today.
  alertRules(walletUuid: string | null): Promise<WalletAlertRule[]>;
  // The insights: one wallet's (in its currency) or every wallet's (in the reference currency).
  categoryMonths(walletUuid: string | null, from?: string, to?: string): Promise<CategoryMonths>;
  merchants(walletUuid: string | null, from?: string, to?: string, limit?: number): Promise<Merchants>;
  recurringPayments(walletUuid: string | null): Promise<RecurringPayments>;
  observations(walletUuid: string | null): Promise<Observations>;
}

export const apiWalletSource: WalletSource = {
  summary: (walletUuid, from, to) => walletService.summary(walletUuid, from, to),
  movements: (walletUuid, filters) => walletService.movements(walletUuid, filters),
  budgetMonth: (month) => walletService.budgetMonth(month),
  alertRules: (walletUuid) => walletService.alertRules(walletUuid),
  categoryMonths: (walletUuid, from, to) => walletService.categoryMonths(walletUuid, from, to),
  merchants: (walletUuid, from, to, limit) => walletService.merchants(walletUuid, from, to, limit),
  recurringPayments: (walletUuid) => walletService.recurringPayments(walletUuid),
  observations: (walletUuid) => walletService.observations(walletUuid),
};

// ── Insights ──

export const CADENCE_LABELS: Record<Cadence, string> = { weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };

/** An observation in a sentence; amounts in `currency`. */
export function observationText(o: Observation, currency: string): string {
  const money = (v: number | null, d = 0) => formatCurrency(v ?? 0, currency, d);
  const month = o.month ? monthName(o.month) : "Last month";
  const category = categoryLabel(o.category);
  switch (o.kind) {
    case "category_up":
      return `${category} went up to ${money(o.amount)} in ${month}, ${Math.round(o.changePct ?? 0)}% above the ${money(o.reference)} of the three months before.`;
    case "category_down":
      return `${category} came down to ${money(o.amount)} in ${month}, ${Math.abs(Math.round(o.changePct ?? 0))}% below the ${money(o.reference)} of the three months before.`;
    case "savings_rate":
      return `You saved ${Math.round(o.ratePct ?? 0)}% of your income in ${month}, against ${Math.round(o.referenceRatePct ?? 0)}% over the year before.`;
    case "new_recurring_payment":
      return `A new ${o.cadence ? CADENCE_LABELS[o.cadence].toLowerCase() : "recurring"} payment since ${month}: ${o.name}, ${money(o.amount, 2)}.`;
    case "subscriptions_yearly":
      return `Your ${o.count ?? 0} ${o.count === 1 ? "subscription costs" : "subscriptions cost"} ${money(o.amount)} a year. Invested monthly instead, that's ${money((o.amount ?? 0) / 12)} a month.`;
  }
}

// ── Alerts ──

/**
 * What each alert type watches, and its one parameter: an amount in the wallet's currency, a
 * percentage of a budget's limit, or an income category. `wallet`: whether a rule names one
 * (always, never, or either).
 */
export const ALERT_TYPES: Record<WalletAlertType, { label: string; desc: string; wallet: "one" | "all" | "either" }> = {
  low_balance: { label: "Low balance", desc: "The wallet's balance drops under an amount (a card's: owes more than it).", wallet: "one" },
  budget_threshold: { label: "Budget running out", desc: "This month's spending in a budget reaches a share of its limit.", wallet: "all" },
  large_payment: { label: "Large payment", desc: "A single payment of an amount or more (transfers left out).", wallet: "one" },
  income_received: { label: "Money in", desc: "Money comes in as a category: the salary has arrived.", wallet: "either" },
};
export const ALERT_TYPE_LIST = Object.keys(ALERT_TYPES) as WalletAlertType[];

/** A rule in a line ("Balance under €500"); amounts in `currency`, the wallet's. */
export function alertRuleText(params: WalletAlertParams, currency = "EUR") {
  switch (params.type) {
    case "low_balance":
      return `Balance under ${formatCurrency(Number(params.threshold), currency, 0)}`;
    case "budget_threshold":
      return `A budget at ${Number(params.thresholdPct)}% of its limit`;
    case "large_payment":
      return `A payment of ${formatCurrency(Number(params.threshold), currency, 0)} or more`;
    case "income_received":
      return `${CATEGORY_LABELS[params.category]} received`;
  }
}

/** A finding in two lines: what, and its figures. */
export function alertFindingText(f: WalletAlertFinding): { title: string; detail: string } {
  const money = (v: number | null) => (v === null ? "" : formatCurrency(v, f.currency, 2));
  switch (f.kind) {
    case "low_balance":
      return { title: `${f.walletName}: balance ${money(f.amount)}`, detail: "Under the amount you set" };
    case "budget_threshold":
      return {
        title: `${categoryLabel(f.category)}: ${money(f.amount)} of ${money(f.limit)}`,
        detail: `${f.month ? monthName(f.month) : "This month"} · ${f.limit ? Math.round((f.amount / f.limit) * 100) : 0}% of the budget`,
      };
    case "large_payment":
    case "income_received":
      return {
        title: `${f.description ?? "A movement"}: ${money(f.amount)}`,
        detail: [f.walletName, f.bookedOn ? dayLabel(f.bookedOn) : null, f.counterparty].filter(Boolean).join(" · "),
      };
  }
}

/** A finding as a WALLET_ALERT notification carries it (praeco's payload: snake_case, amounts as text). */
export function walletFindingFromPayload(p: Record<string, unknown>): WalletAlertFinding {
  const text = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : null);
  const number = (k: string) => (p[k] === null || p[k] === undefined ? null : Number(p[k]));
  return {
    key: text("key") ?? "", kind: (text("kind") ?? "low_balance") as WalletAlertType, currency: text("currency") ?? "EUR",
    amount: number("amount") ?? 0, walletUuid: text("wallet_uuid"), walletName: text("wallet_name"),
    movementUuid: text("movement_uuid"), bookedOn: text("booked_on"), description: text("description"),
    counterparty: text("counterparty"), category: text("category") as MovementCategory | null, limit: number("limit"), month: text("month"),
  };
}

/** What the enabled rules find today, each fact once, oldest day first; a wallet's only with `walletUuid`. */
export function currentAlertFindings(rules: WalletAlertRule[], walletUuid?: string | null) {
  const seen = new Map<string, WalletAlertFinding>();
  for (const r of rules) {
    if (!r.enabled) continue;
    for (const f of r.findings) {
      if (walletUuid && f.walletUuid !== walletUuid) continue;
      seen.set(`${f.kind}:${f.key}`, f);
    }
  }
  return [...seen.values()].sort((a, b) => (a.bookedOn ?? a.month ?? "").localeCompare(b.bookedOn ?? b.month ?? "") || a.key.localeCompare(b.key));
}

/** The text of an API error, or `fallback`. */
export const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
