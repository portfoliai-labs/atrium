// lib/mock/wallets.ts
//
// SAMPLE DATA for a demo account's Wallets: three made-up accounts with a year of everyday money in
// and out (salary, rent, groceries, bills…), in the API's shapes (models/Wallet), served by
// demoWalletSource as the API would; then what the API doesn't have yet, shown only to a demo
// account as previews (components/preview/WalletPages): budgets, alerts, monthly statements,
// recurring payments and top merchants. Generated from fixed seeds so the pages look the same on
// every visit.

import { hashSeed, round, seeded } from "./random";
import type { WalletSource } from "../wallets";
import type { Movement, MovementCategory, MovementFilters, Wallet, WalletSummary } from "../../models/Wallet";

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

/** A demo account's wallets, read as the API would serve them. */
export const demoWalletSource: WalletSource = {
  summary: async (walletUuid, from, to) => demoSummary(walletUuid, from, to),
  movements: async (walletUuid, filters = {}) => {
    const all = movementsOf(walletUuid).filter((m) => matches(m, filters));
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    return { items: all.slice(offset, offset + limit), total: all.length, limit, offset };
  },
};

// ── What the API doesn't have yet (previews) ────────────────────────────────────────────────

/** The payees money went to most often in the twelve months (rent and bills left out). */
export function topMerchants(walletUuid: string | null, limit = 6) {
  const map = new Map<string, { amount: number; count: number; category: MovementCategory | null }>();
  for (const m of movementsOf(walletUuid)) {
    if (m.amount >= 0 || m.transferUuid || m.category === "housing" || m.category === "utilities") continue;
    const cur = map.get(m.description) ?? { amount: 0, count: 0, category: m.category };
    cur.amount -= m.amount;
    cur.count += 1;
    map.set(m.description, cur);
  }
  return [...map].map(([name, v]) => ({ name, ...v, amount: round(v.amount) })).sort((a, b) => b.amount - a.amount).slice(0, limit);
}

/** This month's spending in one category, on one wallet or all of them. */
export function spentThisMonth(walletUuid: string | null, category: MovementCategory) {
  return -movementsOf(walletUuid)
    .filter((m) => m.bookedOn.startsWith(CURRENT_MONTH) && m.category === category && m.amount < 0 && !m.transferUuid)
    .reduce((s, m) => s + m.amount, 0);
}

export interface Budget {
  category: MovementCategory;
  limit: number; // per month
}

export const BUDGETS: Budget[] = [
  { category: "groceries", limit: 320 },
  { category: "restaurants", limit: 220 },
  { category: "transport", limit: 90 },
  { category: "shopping", limit: 200 },
  { category: "subscriptions", limit: 35 },
  { category: "leisure", limit: 80 },
  { category: "utilities", limit: 170 },
  { category: "health", limit: 60 },
];

export interface WalletAlert {
  id: string;
  // The wallet it watches.
  walletUuid: string;
  title: string;
  detail: string;
  enabled: boolean;
  triggered: boolean;
  // Where it stands, when it measures something: now against the limit, and how far along the
  // way it is (0–100).
  now?: string;
  limit?: string;
  progressPct?: number;
}

export const WALLET_ALERTS: WalletAlert[] = [
  { id: "a1", walletUuid: "everyday", title: "Low balance", detail: "Balance drops under €500", enabled: true, triggered: false, now: "€1,840", limit: "€500", progressPct: 27 },
  { id: "a2", walletUuid: "everyday", title: "Budget at 90%", detail: "Any category reaches 90% of its monthly budget", enabled: true, triggered: true, now: "Restaurants 96%", limit: "90%", progressPct: 100 },
  { id: "a4", walletUuid: "everyday", title: "Salary received", detail: "When the monthly salary lands", enabled: false, triggered: false },
  { id: "a3", walletUuid: "card", title: "Large expense", detail: "A single payment over €250", enabled: true, triggered: true, now: "€312", limit: "€250", progressPct: 100 },
  { id: "a5", walletUuid: "card", title: "New subscription", detail: "A recurring charge from a merchant not seen before", enabled: true, triggered: false },
  { id: "a6", walletUuid: "card", title: "Card statement due", detail: "Three days before the card is settled", enabled: true, triggered: false, now: "5 days left", limit: "3 days", progressPct: 72 },
];

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

export const RECURRING = [
  { name: "Rent — Via Tortona 5", amount: 950, every: "Monthly, 1st" },
  { name: "Transfer to Savings pot", amount: 400, every: "Monthly, 3rd" },
  { name: "Electricity & gas", amount: 110, every: "Monthly, ~5th" },
  { name: "Fibre internet", amount: 29.9, every: "Monthly, 8th" },
  { name: "Netflix", amount: 13.99, every: "Monthly, 12th" },
  { name: "Spotify", amount: 11.99, every: "Monthly, 14th" },
  { name: "Mobile plan", amount: 9.99, every: "Monthly, 9th" },
  { name: "iCloud+", amount: 2.99, every: "Monthly, 20th" },
];
