// lib/wallets.ts
//
// WALLETS — what every wallet page shares: the names and colours of kinds and categories (the
// user's category tree), where a page reads its figures from (a WalletSource: the API, a demo
// account's too), and how a rule, a finding or an observation is worded.

import type {
  BudgetMonth, Cadence, Category, CategoryKind, CategoryMonths, Merchants, MovementCategory, MovementFilters, MovementList, Observation, Observations,
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

// The presets, as every user's categories start: worded and coloured here until renamed or recoloured.
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

// A category the user made, with no colour of its own nor a parent's.
export const CUSTOM_CATEGORY_COLOR = "#64748b";

export const categoryLabel = (c: MovementCategory | null) => (c ? CATEGORY_LABELS[c] : "Uncategorised");

// ── The user's categories ──

/** How deep the tree goes: a category, a subcategory, and one under it. */
export const CATEGORY_MAX_DEPTH = 3;

/** The colours a category can be given (none: its preset's, or its parent's). */
export const CATEGORY_PALETTE = [
  "#2a78d6", "#0ea5e9", "#1baf7a", "#008300", "#0f766e", "#eda100", "#eb6834", "#e34948", "#e87ba4", "#4a3aa7", "#a16207", "#64748b",
];

/** A category as an answer names it: its uuid, and its preset (deprecated) when the uuid isn't known. */
export type CategoryRef = { categoryUuid?: string | null; category?: MovementCategory | null };

/**
 * The user's categories (both kinds, the deleted ones too: a past month's budget or an old
 * finding can be on one), read as a tree: names and colours, parents and children, in the API's
 * tree order. Built empty while they're loading, or where the API doesn't have them: a ref then
 * reads as its preset.
 */
export interface CategoryTree {
  get(uuid: string | null | undefined): Category | undefined;
  // Not deleted, in tree order; of one kind when given.
  active(kind?: CategoryKind): Category[];
  // Not deleted: a category's (null: the top level's of `kind`).
  children(uuid: string | null, kind?: CategoryKind): Category[];
  // Every active one under it, at any level, in tree order.
  descendants(uuid: string): Category[];
  // Nearest first.
  ancestors(uuid: string): Category[];
  // 0 for a top-level category.
  depth(uuid: string): number;
  // How many levels its descendants go down: 0 with none.
  height(uuid: string): number;
  // Its top-level category (itself, at the top or unknown).
  root(uuid: string): string;
  preset(preset: MovementCategory): Category | undefined;
  label(ref: CategoryRef): string;
  color(ref: CategoryRef): string;
  // "Leisure › Gym".
  path(uuid: string): string;
}

export function categoryTree(list: Category[]): CategoryTree {
  const byUuid = new Map(list.map((c) => [c.uuid, c]));
  const live = list.filter((c) => !c.deletedAt);
  const get = (uuid: string | null | undefined) => (uuid ? byUuid.get(uuid) : undefined);
  const ancestors = (uuid: string) => {
    const out: Category[] = [];
    for (let c = get(get(uuid)?.parentUuid); c && out.length < 10; c = get(c.parentUuid)) out.push(c);
    return out;
  };
  const children = (uuid: string | null, kind?: CategoryKind) =>
    live.filter((c) => c.parentUuid === uuid && (uuid !== null || !kind || c.kind === kind));
  const descendants = (uuid: string): Category[] => children(uuid).flatMap((c) => [c, ...descendants(c.uuid)]);
  const height = (uuid: string): number => Math.max(0, ...children(uuid).map((c) => 1 + height(c.uuid)));
  const nameOf = (c: Category) => c.name ?? (c.preset ? CATEGORY_LABELS[c.preset] : "Category");
  const colorOf = (c: Category): string =>
    c.color ?? (c.preset ? CATEGORY_COLORS[c.preset] : null) ?? (get(c.parentUuid) ? colorOf(get(c.parentUuid)!) : CUSTOM_CATEGORY_COLOR);
  return {
    get,
    active: (kind) => (kind ? live.filter((c) => c.kind === kind) : live),
    children,
    descendants,
    ancestors,
    depth: (uuid) => ancestors(uuid).length,
    height,
    root: (uuid) => ancestors(uuid).at(-1)?.uuid ?? uuid,
    preset: (preset) => live.find((c) => c.preset === preset) ?? list.find((c) => c.preset === preset),
    label: (ref) => {
      const c = get(ref.categoryUuid);
      return c ? nameOf(c) : categoryLabel(ref.category ?? null);
    },
    color: (ref) => {
      const c = get(ref.categoryUuid);
      return c ? colorOf(c) : ref.category ? CATEGORY_COLORS[ref.category] : UNCATEGORIZED_COLOR;
    },
    path: (uuid) => {
      const c = get(uuid);
      return c ? [...ancestors(uuid).reverse(), c].map(nameOf).join(" › ") : "Category";
    },
  };
}

/** A category in a <select>, indented by its depth (an option can't be styled). */
export const categoryOptionLabel = (tree: CategoryTree, c: Category) => `${"\u00a0\u00a0\u00a0".repeat(tree.depth(c.uuid))}${tree.label({ categoryUuid: c.uuid })}`;

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
 * Where a wallet page reads from: the API (apiWalletSource), for a demo account too (arca's demo
 * data). Writes always go to walletService: a demo account's are refused (see lib/demo, and ianus'
 * read-only gate).
 */
export interface WalletSource {
  summary(walletUuid: string | null, from?: string, to?: string): Promise<WalletSummary>;
  movements(walletUuid: string | null, filters?: MovementFilters): Promise<MovementList>;
  // Every category, the deleted ones too, in tree order.
  categories(): Promise<Category[]>;
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
  categories: () => walletService.categories(true),
  budgetMonth: (month) => walletService.budgetMonth(month),
  alertRules: (walletUuid) => walletService.alertRules(walletUuid),
  categoryMonths: (walletUuid, from, to) => walletService.categoryMonths(walletUuid, from, to),
  merchants: (walletUuid, from, to, limit) => walletService.merchants(walletUuid, from, to, limit),
  recurringPayments: (walletUuid) => walletService.recurringPayments(walletUuid),
  observations: (walletUuid) => walletService.observations(walletUuid),
};

// ── Insights ──

export const CADENCE_LABELS: Record<Cadence, string> = { weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };

/** An observation in a sentence; amounts in `currency`, the category named from `tree`. */
export function observationText(o: Observation, currency: string, tree: CategoryTree): string {
  const money = (v: number | null, d = 0) => formatCurrency(v ?? 0, currency, d);
  const month = o.month ? monthName(o.month) : "Last month";
  const category = tree.label(o);
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

/** A rule in a line ("Balance under €500"); amounts in `currency`, the wallet's, a category named from `tree`. */
export function alertRuleText(params: WalletAlertParams, currency: string, tree: CategoryTree) {
  switch (params.type) {
    case "low_balance":
      return `Balance under ${formatCurrency(Number(params.threshold), currency, 0)}`;
    case "budget_threshold":
      return `A budget at ${Number(params.thresholdPct)}% of its limit`;
    case "large_payment":
      return `A payment of ${formatCurrency(Number(params.threshold), currency, 0)} or more`;
    case "income_received":
      return `${tree.label(params)} received`;
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
        title: `${f.categoryName ?? categoryLabel(f.category)}: ${money(f.amount)} of ${money(f.limit)}`,
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
    counterparty: text("counterparty"), categoryUuid: text("category_uuid"), categoryName: text("category_name"),
    category: text("category") as MovementCategory | null, limit: number("limit"), month: text("month"),
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
