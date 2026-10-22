// components/dashboard/DashboardSummaries.tsx
"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Sparkles } from "lucide-react";
import { useUser } from "../../context/UserContext";
import { useWallets } from "../../context/WalletsContext";
import { formatCurrency } from "../../lib/format";
import { CADENCE_LABELS, dayLabel, monthName, today } from "../../lib/wallets";
import type { BudgetMonth, RecurringPayments } from "../../models/Wallet";
import { Fig, Figs, MODULE_BODY, Module, ModuleHead } from "./PerformanceSection";
import { riskToleranceLabel } from "./InvestorPolicyDialog";

// The days ahead Coming up looks at, and the payments it names.
const AHEAD_DAYS = 30;
const SHOWN = 4;

/** "2026-10-22" moved by `days`, as a calendar day (no time zone shift). */
function shiftDay(day: string, days: number) {
  const [y, m, d] = day.split("-").map(Number);
  const moved = new Date(y, m - 1, d + days);
  return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, "0")}-${String(moved.getDate()).padStart(2, "0")}`;
}

const PLAN_LABELS: Record<string, string> = { FREE: "Free plan", TESTER: "Tester", DEMO: "Demo account" };

/**
 * YOUR PROFILE — on the Dashboard: who the account is, its plan (Free with the way to upgrade),
 * since when, its reference currency, tax residence and risk tolerance, and how much of the
 * investor profile is filled in, the way to the rest (`onOpenProfile`).
 */
export function ProfileSummaryModule({ onOpenProfile, onUpgrade }: { onOpenProfile?: () => void; onUpgrade?: () => void }) {
  const { user } = useUser();
  if (!user) return null;

  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
  const initials = [user.first_name, user.last_name].filter(Boolean).map((n) => n![0]).join("").toUpperCase() || user.email[0].toUpperCase();
  // The investor profile's parts, each counted once filled in.
  const parts = [
    user.estimated_wealth, user.annual_income, user.savings_rate, user.financial_goals?.length ? user.financial_goals : null,
    user.risk_tolerance, user.financial_knowledge_level, user.currency, user.tax_residence,
  ];
  const filled = parts.filter((p) => p !== null && p !== undefined).length;
  const complete = Math.round((filled / parts.length) * 100);
  const plan = user.subscription_tier ? PLAN_LABELS[user.subscription_tier] ?? user.subscription_tier : "Free plan";
  const since = new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return (
    <Module>
      <ModuleHead title="Your profile" desc="Your account, your plan, and how much of your investor profile is filled in." onExplore={onOpenProfile} />
      <div className={`${MODULE_BODY} space-y-4`}>
        <div className="flex items-center gap-3">
          {user.profile_picture
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={user.profile_picture} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
            : <span className="w-11 h-11 rounded-full bg-[#1c1917] text-[#C49A3C] font-black flex items-center justify-center shrink-0">{initials}</span>}
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-[#1c1917] truncate">{name}</p>
            <p className="flex items-center gap-2 text-xs text-[#78716c]">
              <span className="px-2 py-0.5 rounded-full bg-[#C49A3C]/10 text-[#8A6A28] font-bold">{plan}</span>
              since {since}
            </p>
          </div>
          {user.subscription_tier === "FREE" && onUpgrade && (
            <button
              type="button"
              onClick={onUpgrade}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1c1917] text-white hover:bg-[#C49A3C] transition-colors shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" /> Upgrade
            </button>
          )}
        </div>
        <Figs pairs>
          <Fig label="Currency" value={user.currency ?? "—"} />
          <Fig label="Tax residence" value={user.tax_residence ?? "—"} />
          <Fig label="Risk tolerance" value={riskToleranceLabel(user.risk_tolerance) ?? "—"} />
          <Fig label="Goals" value={user.financial_goals?.length ? String(user.financial_goals.length) : "—"} />
        </Figs>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#78716c]">Investor profile</span>
            <span className="font-bold text-[#1c1917] tabular-nums">{complete}% complete</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#EEE9DD] overflow-hidden">
            <div className="h-full rounded-full bg-[#C49A3C]" style={{ width: `${complete}%` }} />
          </div>
          {complete < 100 && onOpenProfile && (
            <button type="button" onClick={onOpenProfile} className="text-xs font-bold text-[#8A6A28] hover:text-[#C49A3C]">
              Complete your profile →
            </button>
          )}
        </div>
      </div>
    </Module>
  );
}

/** A wallets' read for the Dashboard, refetched as the wallets change: undefined loading, null failed. */
function useWalletRead<T>(read: (source: ReturnType<typeof useWallets>["source"]) => Promise<T>, enabled: boolean) {
  const { source, version } = useWallets();
  const [state, setState] = useState<{ version: number; value: T | null } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    read(source)
      .then((value) => { if (!cancelled) setState({ version, value }); })
      .catch(() => { if (!cancelled) setState({ version, value: null }); });
    return () => { cancelled = true; };
    // `read` is the caller's inline function, the same read every time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, version, enabled]);
  return state?.version === version ? state.value : undefined;
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
  const month = useWalletRead<BudgetMonth>((source) => source.budgetMonth(), hasWallets);
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
  const recurring = useWalletRead<RecurringPayments>((source) => source.recurringPayments(null), hasWallets);
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
