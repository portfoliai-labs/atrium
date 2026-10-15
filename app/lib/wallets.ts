// lib/wallets.ts
//
// WALLETS — what every wallet page shares: the names and colours of kinds and categories, where a
// page reads its figures from (a WalletSource: the API, or a demo account's sample data, see
// lib/mock/wallets), and the sums the API doesn't make yet (spending by category).

import type { Movement, MovementCategory, MovementFilters, MovementList, Wallet, WalletKind, WalletSummary } from "../models/Wallet";
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
}

export const apiWalletSource: WalletSource = {
  summary: (walletUuid, from, to) => walletService.summary(walletUuid, from, to),
  movements: (walletUuid, filters) => walletService.movements(walletUuid, filters),
};

const PAGE = 200;

/**
 * Every movement matching `filters`, page after page, up to `cap` (newest first): for the sums
 * the API doesn't make yet. `complete` is false when there were more than that.
 */
export async function allMovements(source: WalletSource, walletUuid: string | null, filters: MovementFilters, cap = 2000) {
  const items: Movement[] = [];
  let total = 0;
  for (let offset = 0; offset < cap; offset += PAGE) {
    const page = await source.movements(walletUuid, { ...filters, limit: PAGE, offset });
    items.push(...page.items);
    total = page.total;
    if (items.length >= total || page.items.length === 0) break;
  }
  return { items, complete: items.length >= total };
}

/** Money out (as positive amounts) by category, largest first; transfers' legs left out. */
export function spendingByCategory(movements: Movement[]) {
  return sumByCategory(movements.filter((m) => m.amount < 0 && !m.transferUuid), -1);
}

/** Money in by category, largest first; transfers' legs left out. */
export function incomeByCategory(movements: Movement[]) {
  return sumByCategory(movements.filter((m) => m.amount > 0 && !m.transferUuid), 1);
}

function sumByCategory(movements: Movement[], sign: 1 | -1) {
  const map = new Map<MovementCategory | null, number>();
  for (const m of movements) map.set(m.category, (map.get(m.category) ?? 0) + sign * m.amount);
  return [...map].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

/** The text of an API error, or `fallback`. */
export const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
