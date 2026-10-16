// lib/mock/wallets.ts
//
// SAMPLE DATA for a demo account's Wallets: three made-up accounts with a year of everyday money in
// and out (salary, rent, groceries, bills…), in the API's shapes (models/Wallet), served by
// demoWalletSource as the API would (their budgets, alert rules and insights included); then what
// the API doesn't have yet, shown only to a demo account as previews (components/preview/WalletPages):
// the monthly statements. Generated from fixed seeds so the pages look the same on
// every visit.

import { hashSeed, round, seeded } from "./random";
import type { WalletSource } from "../wallets";
import type {
  CategoryMonths, Merchants, Observation, Observations, RecurringPayments,
  BudgetMonth, BudgetProgress, BudgetStatus, Movement, MovementCategory, MovementFilters, Wallet, WalletAlertFinding,
  WalletAlertParams, WalletAlertRule, WalletSummary,
} from "../../models/Wallet";

const OPENING_DATE = "2025-10-01";

const WALLETS: Omit<Wallet, "balance" | "lastMovementDate">[] = [
  { uuid: "everyday", name: "Everyday account", kind: "current_account", institution: "Banca Esempio", currency: "EUR", openingBalance: 3200, openingDate: OPENING_DATE, color: "#2a78d6", archived: false, createdAt: "2025-10-01T08:00:00Z" },
  { uuid: "card", name: "Credit card", kind: "credit_card", institution: "Carta Demo", currency: "EUR", openingBalance: -460, openingDate: OPENING_DATE, color: "#e34948", archived: false, createdAt: "2025-10-01T08:00:00Z" },
  { uuid: "savings", name: "Savings pot", kind: "savings", institution: "Conto Deposito Demo", currency: "EUR", openingBalance: 12500, openingDate: OPENING_DATE, color: "#1baf7a", archived: false, createdAt: "2025-10-01T08:00:00Z" },
];

// Twelve months, October 2025 to September 2026 (the last one, running to the 28th).
export const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2025, 9 + i, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
});
export const CURRENT_MONTH = MONTHS.at(-1)!;

const MERCHANTS: Partial<Record<MovementCategory, string[]>> = {
  groceries: ["Esselunga", "Coop", "Carrefour Express", "Lidl", "Local market"],
  restaurants: ["Pizzeria Da Gino", "Sushi Zen", "Bar Centrale", "Trattoria Rossi", "Deliveroo"],
  transport: ["ATM Milano", "Trenitalia", "Q8 fuel", "Italo", "Parking"],
  shopping: ["Amazon", "Zara", "Decathlon", "IKEA", "MediaWorld"],
  health: ["Farmacia Centrale", "Dentist", "Gym membership"],
  leisure: ["Cinema", "Concert tickets", "Bookshop", "Padel court"],
  travel: ["Ryanair", "Booking.com", "Airbnb"],
};

const DEMO_MOVEMENTS: Movement[] = (() => {
  const out: Movement[] = [];
  let n = 0;
  const push = (walletUuid: string, bookedOn: string, description: string, category: MovementCategory | null, amount: number, transfer?: { uuid: string; to: string }) =>
    out.push({
      uuid: `m${n++}`, walletUuid, bookedOn, description, counterparty: null, category: transfer ? null : category,
      amount: round(amount, 2), currency: "EUR", note: null, source: "import",
      transferUuid: transfer?.uuid ?? null, counterpartWalletUuid: transfer?.to ?? null, createdAt: `${bookedOn}T09:00:00Z`,
    });
  // Both legs of a move between two of the wallets.
  const transfer = (from: string, to: string, day: string, out: string, into: string, amount: number) => {
    const uuid = `t-${from}-${to}-${day}`;
    push(from, day, out, null, -amount, { uuid, to });
    push(to, day, into, null, amount, { uuid, to: from });
  };

  // The card is settled from the Everyday account on the 6th, for what it spent the month before.
  let cardDue = 460;
  MONTHS.forEach((key, mi) => {
    const rand = seeded(hashSeed(key));
    const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
    const day = (d: number) => `${key}-${String(Math.min(d, 28)).padStart(2, "0")}`;

    // Everyday account: salary in, fixed bills out, the card settled, savings put aside.
    push("everyday", day(27), "Salary — Acme S.r.l.", "salary", mi === 2 ? 2480 * 2 : 2480); // December: 13th month
    if (rand() > 0.6) push("everyday", day(15), "Invoice — freelance project", "freelance", 400 + round(rand() * 900));
    push("everyday", day(1), "Rent — Via Tortona 5", "housing", -950);
    push("everyday", day(5), "Electricity & gas", "utilities", -(70 + rand() * 60 + (mi >= 2 && mi <= 5 ? 45 : 0)));
    push("everyday", day(8), "Fibre internet", "utilities", -29.9);
    push("everyday", day(9), "Mobile plan", "utilities", -9.99);
    transfer("everyday", "savings", day(3), "Transfer to Savings pot", "From Everyday account", 400);
    transfer("everyday", "card", day(6), "Credit card settlement", "Payment from Everyday account", round(cardDue, 2));
    for (let w = 0; w < 4; w++) push("everyday", day(2 + w * 7), pick(MERCHANTS.groceries!), "groceries", -(38 + rand() * 55));
    for (let t = 0; t < 3; t++) push("everyday", day(4 + t * 9), pick(MERCHANTS.transport!), "transport", -(4 + rand() * 38));
    if (rand() > 0.7) push("everyday", day(19), pick(MERCHANTS.health!), "health", -(25 + rand() * 90));
    if (rand() > 0.85) push("everyday", day(21), "Tax refund", "refunds", 120 + rand() * 300);

    // Credit card: eating out, shopping, subscriptions, trips.
    for (let r = 0; r < 4 + Math.floor(rand() * 4); r++) push("card", day(1 + Math.floor(rand() * 27)), pick(MERCHANTS.restaurants!), "restaurants", -(12 + rand() * 55));
    for (let s = 0; s < 1 + Math.floor(rand() * 3); s++) push("card", day(1 + Math.floor(rand() * 27)), pick(MERCHANTS.shopping!), "shopping", -(20 + rand() * (mi === 2 ? 260 : 120)));
    push("card", day(12), "Netflix", "subscriptions", -13.99);
    push("card", day(14), "Spotify", "subscriptions", -11.99);
    push("card", day(20), "iCloud+", "subscriptions", -2.99);
    if (rand() > 0.5) push("card", day(10 + Math.floor(rand() * 15)), pick(MERCHANTS.leisure!), "leisure", -(15 + rand() * 60));
    if (mi === 9 || mi === 10 || mi === 5) push("card", day(11), pick(MERCHANTS.travel!), "travel", -(180 + rand() * 420));
    cardDue = -out.filter((t) => t.walletUuid === "card" && t.bookedOn.startsWith(key) && t.amount < 0).reduce((s, t) => s + t.amount, 0);

    // Savings pot: quarterly interest, a summer trip.
    if (mi % 3 === 2) push("savings", day(28), "Interest", "interest", 12500 * 0.025 / 4 * (1 + mi / 30));
    if (mi === 9) push("savings", day(10), "Summer holiday — Sardinia", "travel", -1500);
  });
  // Newest first, as the API lists them.
  return out.sort((a, b) => b.bookedOn.localeCompare(a.bookedOn) || b.uuid.localeCompare(a.uuid, undefined, { numeric: true }));
})();

const movementsOf = (walletUuid: string | null) =>
  walletUuid ? DEMO_MOVEMENTS.filter((m) => m.walletUuid === walletUuid) : DEMO_MOVEMENTS;

export const DEMO_WALLETS: Wallet[] = WALLETS.map((w) => {
  const own = movementsOf(w.uuid);
  return { ...w, balance: round(w.openingBalance + own.reduce((s, m) => s + m.amount, 0), 2), lastMovementDate: own[0]?.bookedOn ?? null };
});

function demoSummary(walletUuid: string | null, from?: string, to?: string): WalletSummary {
  const wallets = walletUuid ? WALLETS.filter((w) => w.uuid === walletUuid) : WALLETS;
  let balance = wallets.reduce((s, w) => s + w.openingBalance, 0);
  const own = movementsOf(walletUuid);
  const months = MONTHS.map((month) => {
    const inMonth = own.filter((m) => m.bookedOn.startsWith(month));
    // Moves between one's own wallets aren't income or spending across all of them.
    const counted = walletUuid ? inMonth : inMonth.filter((m) => !m.transferUuid);
    const income = counted.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
    const spending = -counted.filter((m) => m.amount < 0).reduce((s, m) => s + m.amount, 0);
    balance += inMonth.reduce((s, m) => s + m.amount, 0);
    return { month, income: round(income, 2), spending: round(spending, 2), net: round(income - spending, 2), closingBalance: round(balance, 2) };
  });
  return { currency: "EUR", months: months.filter((m) => (!from || m.month >= from) && (!to || m.month <= to)) };
}

function matches(m: Movement, f: MovementFilters) {
  if (f.bookedFrom && m.bookedOn < f.bookedFrom) return false;
  if (f.bookedTo && m.bookedOn > f.bookedTo) return false;
  if (f.categories?.length && (!m.category || !f.categories.includes(m.category))) return false;
  if (f.uncategorizedOnly && m.category) return false;
  if (f.direction && (f.direction === "in" ? m.amount < 0 : m.amount > 0)) return false;
  if (f.excludeTransfers && m.transferUuid) return false;
  const text = f.text?.trim().toLowerCase();
  if (text && ![m.description, m.counterparty ?? "", m.note ?? ""].some((s) => s.toLowerCase().includes(text))) return false;
  return true;
}

// The sample's budgets (arca's demo seed has the same), every month.
const BUDGETS: { category: MovementCategory; limit: number }[] = [
  { category: "groceries", limit: 320 },
  { category: "restaurants", limit: 220 },
  { category: "transport", limit: 90 },
  { category: "shopping", limit: 200 },
  { category: "subscriptions", limit: 35 },
  { category: "leisure", limit: 80 },
  { category: "utilities", limit: 170 },
  { category: "health", limit: 60 },
];

// The sample's last month runs to the 28th of September's 30.
const DAYS_ELAPSED = 28;

// arca's rule (domain/budget.py): over, almost used from 90%, ahead of pace by over 5% of the limit.
function budgetStatus(limit: number, spent: number, expected: number): BudgetStatus {
  if (spent > limit) return "over";
  if (limit > 0 && spent >= limit * 0.9) return "almost_used";
  if (spent > expected + limit * 0.05) return "ahead_of_pace";
  return "on_track";
}

function progress(category: MovementCategory | null, limit: number, byWallet: Map<string, number>, elapsed: number, days: number): BudgetProgress {
  const wallets = [...byWallet].map(([walletUuid, spent]) => ({ walletUuid, spent: round(spent, 2) }))
    .filter((w) => w.spent > 0).sort((a, b) => b.spent - a.spent);
  const spent = round(Math.max(0, [...byWallet.values()].reduce((s, v) => s + v, 0)), 2);
  const expected = round((limit * elapsed) / days, 2);
  return { category, limit, spent, expected, status: budgetStatus(limit, spent, expected), wallets };
}

/** A month against the sample's budgets, as arca computes it: money out less money in, never below 0. */
function demoBudgetMonth(month = CURRENT_MONTH): BudgetMonth {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const elapsed = month === CURRENT_MONTH ? DAYS_ELAPSED : days;
  const budgets = BUDGETS.map((b) => {
    const byWallet = new Map<string, number>();
    for (const mv of movementsOf(null)) {
      if (mv.category === b.category && mv.bookedOn.startsWith(month)) byWallet.set(mv.walletUuid, (byWallet.get(mv.walletUuid) ?? 0) - mv.amount);
    }
    return progress(b.category, b.limit, byWallet, elapsed, days);
  });
  const shares = new Map<string, number>();
  for (const b of budgets) for (const w of b.wallets) shares.set(w.walletUuid, (shares.get(w.walletUuid) ?? 0) + w.spent);
  const total = progress(null, budgets.reduce((s, b) => s + b.limit, 0), shares, elapsed, days);
  return { currency: "EUR", month, daysInMonth: days, daysElapsed: elapsed, budgets, total };
}

// The sample's alert rules: (wallet or null for every one, params, enabled), as arca finds them on
// the sample's last day (the 28th) — payments and money in among the last 31 days.
const SAMPLE_TODAY = `${CURRENT_MONTH}-28`;
const SAMPLE_RULES: [string | null, WalletAlertParams, boolean][] = [
  ["everyday", { type: "low_balance", threshold: "2500" }, true],
  [null, { type: "budget_threshold", thresholdPct: "90" }, true],
  ["card", { type: "large_payment", threshold: "150" }, true],
  ["everyday", { type: "income_received", category: "salary" }, true],
  ["card", { type: "low_balance", threshold: "-1500" }, false],
];

function sampleFindings(walletUuid: string | null, params: WalletAlertParams): WalletAlertFinding[] {
  const wallets = DEMO_WALLETS.filter((w) => !walletUuid || w.uuid === walletUuid);
  const base = { movementUuid: null, bookedOn: null, description: null, counterparty: null, category: null, limit: null, month: null };
  const since = new Date(SAMPLE_TODAY);
  since.setDate(since.getDate() - 31);
  const recent = (w: Wallet) => movementsOf(w.uuid).filter((m) => !m.transferUuid && new Date(m.bookedOn) >= since && m.bookedOn <= SAMPLE_TODAY);
  const movement = (m: Movement, w: Wallet, amount: number): WalletAlertFinding => ({
    ...base, key: `${params.type}:${m.uuid}`, kind: params.type, currency: w.currency, amount, walletUuid: w.uuid, walletName: w.name,
    movementUuid: m.uuid, bookedOn: m.bookedOn, description: m.description, counterparty: m.counterparty, category: m.category,
  });
  switch (params.type) {
    case "low_balance":
      return wallets.filter((w) => w.balance < Number(params.threshold)).map((w) => ({
        ...base, key: `low_balance:${w.uuid}`, kind: "low_balance", currency: w.currency, amount: w.balance, walletUuid: w.uuid, walletName: w.name,
      }));
    case "large_payment":
      return wallets.flatMap((w) => recent(w).filter((m) => -m.amount >= Number(params.threshold)).map((m) => movement(m, w, -m.amount)));
    case "income_received":
      return wallets.flatMap((w) => recent(w).filter((m) => m.amount > 0 && m.category === params.category).map((m) => movement(m, w, m.amount)));
    case "budget_threshold": {
      const month = demoBudgetMonth();
      return month.budgets.filter((b) => b.spent * 100 >= b.limit * Number(params.thresholdPct)).map((b) => ({
        ...base, key: `budget:${b.category}:${month.month}`, kind: "budget_threshold", currency: month.currency, amount: b.spent,
        walletUuid: null, walletName: null, category: b.category, limit: b.limit, month: month.month,
      }));
    }
  }
}

function demoAlertRules(walletUuid: string | null): WalletAlertRule[] {
  return SAMPLE_RULES
    .filter(([wallet]) => !walletUuid || !wallet || wallet === walletUuid)
    .map(([wallet, params, enabled], i) => ({
      uuid: `sample-rule-${i + 1}`, walletUuid: wallet, params, notifyEmail: true, notifyInApp: true, enabled,
      findings: enabled ? sampleFindings(wallet, params) : [],
      lastCheckedAt: `${SAMPLE_TODAY}T05:30:00Z`, lastTriggeredAt: null, createdAt: "2025-10-01T08:00:00Z", updatedAt: "2025-10-01T08:00:00Z",
    }));
}

// ── Insights, as arca computes them (domain/insights.py), transfers left out ──

const inRange = (month: string, from?: string, to?: string) => MONTHS.filter((m) => (!from || m >= from) && (!to || m <= to)).includes(month);
const CATALOGUE: (MovementCategory | null)[] = [
  "salary", "freelance", "refunds", "interest", "other_income", "housing", "groceries", "restaurants", "transport", "utilities",
  "subscriptions", "shopping", "health", "travel", "leisure", "other_spending", null,
];

function demoCategoryMonths(walletUuid: string | null, from?: string, to?: string): CategoryMonths {
  const own = movementsOf(walletUuid).filter((m) => !m.transferUuid);
  return {
    currency: "EUR",
    months: MONTHS.filter((month) => inRange(month, from, to)).map((month) => ({
      month,
      categories: CATALOGUE.map((category) => {
        const inMonth = own.filter((m) => m.bookedOn.startsWith(month) && m.category === category);
        return {
          category,
          spending: round(-inMonth.filter((m) => m.amount < 0).reduce((s, m) => s + m.amount, 0), 2),
          income: round(inMonth.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0), 2),
        };
      }).filter((c) => c.spending || c.income),
    })),
  };
}

function demoMerchants(walletUuid: string | null, from?: string, to?: string, limit = 10): Merchants {
  const map = new Map<string, { spent: number; payments: number; category: MovementCategory | null; lastBookedOn: string }>();
  for (const m of movementsOf(walletUuid)) {
    if (m.amount >= 0 || m.transferUuid || !inRange(m.bookedOn.slice(0, 7), from, to)) continue;
    const name = m.counterparty || m.description;
    const cur = map.get(name) ?? { spent: 0, payments: 0, category: m.category, lastBookedOn: m.bookedOn };
    map.set(name, { ...cur, spent: cur.spent - m.amount, payments: cur.payments + 1, lastBookedOn: m.bookedOn > cur.lastBookedOn ? m.bookedOn : cur.lastBookedOn });
  }
  const merchants = [...map].map(([name, v]) => ({ name, ...v, spent: round(v.spent, 2) })).sort((a, b) => b.spent - a.spent).slice(0, limit);
  return { currency: "EUR", merchants };
}

// The sample's recurring payments, on the everyday account and the card (transfers aren't payments).
const SAMPLE_RECURRING: { name: string; amount: number; day: number; wallet: string; category: MovementCategory }[] = [
  { name: "Rent — Via Tortona 5", amount: 950, day: 1, wallet: "everyday", category: "housing" },
  { name: "Electricity & gas", amount: 110, day: 5, wallet: "everyday", category: "utilities" },
  { name: "Fibre internet", amount: 29.9, day: 8, wallet: "everyday", category: "utilities" },
  { name: "Netflix", amount: 13.99, day: 12, wallet: "card", category: "subscriptions" },
  { name: "Spotify", amount: 11.99, day: 14, wallet: "card", category: "subscriptions" },
  { name: "Mobile plan", amount: 9.99, day: 9, wallet: "everyday", category: "utilities" },
  { name: "iCloud+", amount: 2.99, day: 20, wallet: "card", category: "subscriptions" },
];

function demoRecurring(walletUuid: string | null): RecurringPayments {
  const [y, mo] = CURRENT_MONTH.split("-").map(Number);
  const day = (year: number, month: number, d: number) => {
    const date = new Date(year, month - 1, d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const payments = SAMPLE_RECURRING.filter((r) => !walletUuid || r.wallet === walletUuid).map((r) => ({
    name: r.name, walletUuid: r.wallet, currency: "EUR", amount: r.amount, cadence: "monthly" as const, occurrences: 12,
    firstBookedOn: day(y - 1, mo + 1, r.day), lastBookedOn: day(y, r.day <= 28 ? mo : mo - 1, r.day), nextExpectedOn: day(y, mo + 1, r.day),
    category: r.category, yearlyAmount: round(r.amount * 12, 2),
  })).sort((a, b) => b.yearlyAmount - a.yearlyAmount);
  return { currency: "EUR", yearlyTotal: round(payments.reduce((s, p) => s + p.yearlyAmount, 0), 2), payments };
}

function demoObservations(walletUuid: string | null): Observations {
  // About August, the sample's last whole month, against May to July.
  const months = demoCategoryMonths(walletUuid).months;
  const last = months.at(-2)!;
  const before = months.slice(-5, -2);
  const observations: Observation[] = [];
  const base = { category: null, month: last.month, amount: null, reference: null, changePct: null, ratePct: null, referenceRatePct: null, name: null, cadence: null, count: null };
  for (const category of CATALOGUE.slice(5, -1)) {
    const now = last.categories.find((c) => c.category === category)?.spending ?? 0;
    const avg = before.reduce((s, m) => s + (m.categories.find((c) => c.category === category)?.spending ?? 0), 0) / before.length;
    if (Math.max(now, avg) < 50 || avg === 0) continue;
    const change = ((now - avg) / avg) * 100;
    if (Math.abs(change) >= 25) {
      observations.push({ ...base, kind: change > 0 ? "category_up" : "category_down", category, amount: round(now, 2), reference: round(avg, 2), changePct: round(change, 1) });
    }
  }
  const subscriptions = demoRecurring(walletUuid).payments.filter((p) => p.category === "subscriptions");
  if (subscriptions.length) {
    observations.push({ ...base, kind: "subscriptions_yearly", month: null, category: "subscriptions", amount: round(subscriptions.reduce((s, p) => s + p.yearlyAmount, 0), 2), count: subscriptions.length });
  }
  return { currency: "EUR", observations: observations.slice(0, 4) };
}

/** A demo account's wallets, read as the API would serve them. */
export const demoWalletSource: WalletSource = {
  categoryMonths: async (walletUuid, from, to) => demoCategoryMonths(walletUuid, from, to),
  merchants: async (walletUuid, from, to, limit) => demoMerchants(walletUuid, from, to, limit),
  recurringPayments: async (walletUuid) => demoRecurring(walletUuid),
  observations: async (walletUuid) => demoObservations(walletUuid),
  alertRules: async (walletUuid) => demoAlertRules(walletUuid),
  budgetMonth: async (month) => demoBudgetMonth(month),
  summary: async (walletUuid, from, to) => demoSummary(walletUuid, from, to),
  movements: async (walletUuid, filters = {}) => {
    const all = movementsOf(walletUuid).filter((m) => matches(m, filters));
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    return { items: all.slice(offset, offset + limit), total: all.length, limit, offset };
  },
};

// ── What the API doesn't have yet (previews) ────────────────────────────────────────────────



/** A report in the Wallets preview's archive: a month's statement or a year's summary. */
export interface WalletReport {
  id: string;
  walletUuid: string;
  kind: "monthly" | "yearly";
  name: string;
  createdAt: string;
  tags: string[];
}

// Each wallet's last three monthly statements (made on the 1st of the month after) and its 2025
// summary.
export const WALLET_REPORTS: WalletReport[] = WALLETS.flatMap((w) => [
  ...MONTHS.slice(-4, -1).reverse().map((key, i) => {
    const [y, mo] = key.split("-").map(Number);
    const month = new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return {
      id: `${w.uuid}-${key}`,
      walletUuid: w.uuid,
      kind: "monthly" as const,
      name: `${w.name} — ${month} statement`,
      createdAt: new Date(y, mo, 1, 7).toISOString(),
      tags: i === 0 && w.uuid === "everyday" ? ["Taxes"] : [],
    };
  }),
  {
    id: `${w.uuid}-2025`,
    walletUuid: w.uuid,
    kind: "yearly" as const,
    name: `${w.name} — 2025 summary`,
    createdAt: new Date(2026, 0, 2, 7).toISOString(),
    tags: w.uuid === "savings" ? ["Year end", "Taxes"] : ["Year end"],
  },
]);

