// components/dashboard/DashboardSummaries.tsx
"use client";

import { CalendarClock } from "lucide-react";
import { useWalletRead, useWallets } from "../../context/WalletsContext";
import { formatCurrency } from "../../lib/format";
import { CADENCE_LABELS, dayLabel, monthName, today } from "../../lib/wallets";
import type { BudgetMonth, RecurringPayments } from "../../models/Wallet";
import { MODULE_BODY, Module, ModuleHead } from "./PerformanceSection";

// The days ahead Coming up looks at, and the payments it names.
const AHEAD_DAYS = 30;
const SHOWN = 4;

/** "2026-10-22" moved by `days`, as a calendar day (no time zone shift). */
function shiftDay(day: string, days: number) {
  const [y, m, d] = day.split("-").map(Number);
  const moved = new Date(y, m - 1, d + days);
  return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, "0")}-${String(moved.getDate()).padStart(2, "0")}`;
}

/**
 * BUDGETS THIS MONTH — on the Dashboard, with wallets: what's been spent of the month's budgets
 * (the outermost ones, as the Budgets page adds them up) against where it should be by today, how
 * many are over, and the three most used. Opens the Budgets page (`onOpen`); with none set, the
 * way to set one.
 */
export function BudgetsSummaryModule({ onOpen }: { onOpen?: () => void }) {
  const { available, wallets } = useWallets();
  const hasWallets = available && wallets.some((w) => !w.archived);
  const month = useWalletRead<BudgetMonth>(["budgetMonth", "now"], (source) => source.budgetMonth(), hasWallets);
  if (!hasWallets || month === null) return null;

  const money = (v: number) => formatCurrency(v, month?.currency ?? "EUR", 0);
  const used = (b: BudgetMonth["budgets"][number]) => (b.limit > 0 ? b.spent / b.limit : 0);
  const pace = month ? month.daysElapsed / month.daysInMonth : 0;
  const over = month?.budgets.filter((b) => b.status === "over").length ?? 0;
  const top = month ? [...month.budgets].sort((a, b) => used(b) - used(a)).slice(0, 3) : [];
  const pct = month && month.total.limit > 0 ? Math.min(100, (month.total.spent / month.total.limit) * 100) : 0;

  return (
    <Module>
      <ModuleHead title="Budgets this month" desc="What you've spent of your monthly limits, across your wallets, and where you should be by today." onExplore={onOpen} />
      <div className={`${MODULE_BODY} space-y-4`}>
        {month === undefined ? (
          <p className="text-[12.5px] text-[#857e78]">Loading…</p>
        ) : month.budgets.length === 0 ? (
          <div className="space-y-2">
            <p className="text-[12.5px] text-[#857e78]">No budgets yet: a monthly limit for groceries, restaurants or anything else shows here.</p>
            {onOpen && <button type="button" onClick={onOpen} className="text-xs font-bold text-[#8A6A28] hover:text-[#C49A3C]">Set a budget →</button>}
          </div>
        ) : (
          <>
            <div>
              <p className="text-[11px] text-[#78716c]">{monthName(month.month)}</p>
              <p className="text-[22px] font-bold tabular-nums text-[#1c1917]">
                {money(month.total.spent)} <span className="text-sm font-semibold text-[#857e78]">of {money(month.total.limit)}</span>
              </p>
              <div className="relative h-2 mt-2 rounded-full bg-[#EEE9DD]">
                <div className={`h-full rounded-full ${month.total.status === "over" ? "bg-rose-500" : month.total.status === "on_track" ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                {pace < 1 && <span className="absolute -top-1 -bottom-1 w-0.5 bg-slate-400 rounded" style={{ left: `${pace * 100}%` }} title="Where spending should be by today" />}
              </div>
              <p className="text-xs mt-1.5 text-[#78716c]">
                {over > 0 ? <span className="font-bold text-rose-600">{over} over budget</span> : "None over budget"}
                {" · "}{month.budgets.length} {month.budgets.length === 1 ? "budget" : "budgets"}
              </p>
            </div>
            <ul className="space-y-2">
              {top.map((b) => (
                <li key={b.categoryUuid ?? b.category ?? "total"} className="flex items-center gap-3 text-[13px]">
                  <span className="flex-1 min-w-0 truncate font-semibold text-[#57534e]">{b.category ? budgetName(b) : "Budget"}</span>
                  <span className={`tabular-nums font-bold ${b.status === "over" ? "text-rose-600" : "text-[#1c1917]"}`}>{Math.round(used(b) * 100)}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Module>
  );
}

// A budget's category, as the wallets' tree names it.
function budgetName(b: BudgetMonth["budgets"][number]) {
  return <BudgetLabel categoryUuid={b.categoryUuid} category={b.category} />;
}
function BudgetLabel(ref: { categoryUuid: string | null; category: BudgetMonth["budgets"][number]["category"] }) {
  const { categories } = useWallets();
  return <>{categories.label(ref)}</>;
}

/**
 * COMING UP — on the Dashboard, with wallets: the recurring payments expected in the next
 * AHEAD_DAYS days (the ones the wallets' Insights detect), soonest first, and what they come to.
 * Opens the wallets (`onOpen`).
 */
export function UpcomingPaymentsModule({ onOpen }: { onOpen?: () => void }) {
  const { available, wallets } = useWallets();
  const hasWallets = available && wallets.some((w) => !w.archived);
  const recurring = useWalletRead<RecurringPayments>(["recurring", "all"], (source) => source.recurringPayments(null), hasWallets);
  if (!hasWallets || recurring === null) return null;

  const now = today();
  const until = shiftDay(now, AHEAD_DAYS);
  const due = (recurring?.payments ?? [])
    .filter((p) => p.nextExpectedOn >= now && p.nextExpectedOn <= until)
    .sort((a, b) => a.nextExpectedOn.localeCompare(b.nextExpectedOn));
  const total = due.reduce((s, p) => s + p.amount, 0);
  const currency = due[0]?.currency ?? recurring?.currency ?? "EUR";
  const oneCurrency = due.every((p) => p.currency === currency);

  return (
    <Module>
      <ModuleHead title="Coming up" desc={`The recurring payments expected in the next ${AHEAD_DAYS} days, from your wallets' history.`} onExplore={onOpen} />
      <div className={`${MODULE_BODY} space-y-4`}>
        {recurring === undefined ? (
          <p className="text-[12.5px] text-[#857e78]">Loading…</p>
        ) : due.length === 0 ? (
          <p className="text-[12.5px] text-[#857e78]">Nothing expected in the next {AHEAD_DAYS} days.</p>
        ) : (
          <>
            {oneCurrency && (
              <div>
                <p className="text-[11px] text-[#78716c]">Next {AHEAD_DAYS} days · {due.length} {due.length === 1 ? "payment" : "payments"}</p>
                <p className="text-[22px] font-bold tabular-nums text-[#1c1917]">{formatCurrency(total, currency, 0)}</p>
              </div>
            )}
            <ul className="space-y-2.5">
              {due.slice(0, SHOWN).map((p) => (
                <li key={`${p.walletUuid}:${p.name}`} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[#F7F5EF] text-[#78716c] flex items-center justify-center shrink-0">
                    <CalendarClock className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-[#1c1917] truncate">{p.name}</span>
                    <span className="block text-[11px] text-[#78716c]">{dayLabel(p.nextExpectedOn)} · {CADENCE_LABELS[p.cadence]}</span>
                  </span>
                  <span className="text-[13px] font-bold tabular-nums text-[#1c1917]">{formatCurrency(p.amount, p.currency, 0)}</span>
                </li>
              ))}
            </ul>
            {due.length > SHOWN && <p className="text-[11px] text-[#857e78]">and {due.length - SHOWN} more</p>}
          </>
        )}
      </div>
    </Module>
  );
}
