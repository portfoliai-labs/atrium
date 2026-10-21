// components/dashboard/wallets/WalletBudgets.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { useWallets } from "../../../context/WalletsContext";
import { formatCompact, formatCurrency } from "../../../lib/format";
import { CATEGORY_LABELS, SPENDING_CATEGORIES, errorText, monthName, walletColor } from "../../../lib/wallets";
import type { BudgetMonth, BudgetProgress, BudgetStatus, MovementCategory } from "../../../models/Wallet";
import { walletService } from "../../../services/walletService";
import { AXIS_TICK, Panel, TOOLTIP_STYLE } from "../../preview/PreviewKit";
import { ConfirmDialog } from "../ConfirmDialog";
import { DialogShell, Field, INPUT, parseAmount } from "./WalletDialogs";
import { CategoryChip } from "./WalletTransactions";
import { DEMO_DISABLED_TITLE } from "../../preview/DemoBanner";

// How far back the months go: the year the rest of the wallets' pages show.
const MONTHS_BACK = 11;

const STATUS: Record<BudgetStatus, { label: string; tone: string; bar: string }> = {
  over: { label: "Over budget", tone: "text-rose-600 bg-rose-50", bar: "bg-rose-500" },
  almost_used: { label: "Almost used", tone: "text-amber-700 bg-amber-50", bar: "bg-amber-500" },
  ahead_of_pace: { label: "Ahead of pace", tone: "text-amber-700 bg-amber-50", bar: "bg-amber-500" },
  on_track: { label: "On track", tone: "text-emerald-700 bg-emerald-50", bar: "bg-emerald-500" },
};

/** "2026-10" moved by `delta` months. */
function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type Dialog = { kind: "new" } | { kind: "edit"; budget: BudgetProgress } | { kind: "remove"; budget: BudgetProgress };

/**
 * BUDGETS — a monthly limit per spending category, across every non-archived wallet, in the
 * user's reference currency (arca's): a month's spending against the limits it had, each with
 * where it should be by today at an even pace. They are set, changed and removed from any page
 * (from this month on: the months before keep theirs); on a wallet, the same budgets show what
 * that wallet spent of each. A demo account reads its sample's, read only: its buttons show,
 * disabled, so it's clear where budgets are set.
 */
export function WalletBudgets({ scope, onManage }: { scope: string | null; onManage: () => void }) {
  const { wallets, source, version, sample, changed } = useWallets();
  // undefined: this month, as the API counts it.
  const [month, setMonth] = useState<string | undefined>(undefined);
  const key = `${month ?? "now"}:${version}`;
  const [state, setState] = useState<{ key: string; data: BudgetMonth | null; error: string | null } | null>(null);
  // The month the API answers for "this month": the newest one there is.
  const [latest, setLatest] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    source.budgetMonth(month)
      .then((data) => {
        if (cancelled) return;
        setState({ key, data, error: null });
        if (month === undefined) setLatest(data.month);
      })
      .catch((err) => { if (!cancelled) setState({ key, data: null, error: errorText(err, "Unable to load the budgets.") }); });
    return () => { cancelled = true; };
  }, [source, month, key]);

  const current = state?.key === key ? state : null;
  const data = current?.data ?? null;

  const colors = useMemo(() => new Map(wallets.map((w, i) => [w.uuid, walletColor(w, i)])), [wallets]);
  const names = useMemo(() => new Map(wallets.map((w) => [w.uuid, w.name])), [wallets]);

  if (!current) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 text-[#C49A3C] animate-spin" /></div>;
  if (!data) return <p className="text-sm font-semibold text-rose-600">{current.error}</p>;

  const isCurrent = latest === null || data.month === latest;
  const all = scope === null;
  const editable = !sample && isCurrent;
  // Disabled rather than hidden on a demo account, so it's clear where a budget is set.
  const demoLock = sample ? { disabled: true, title: DEMO_DISABLED_TITLE } : {};
  const money = (v: number) => formatCurrency(v, data.currency, 0);
  const pace = data.daysElapsed / data.daysInMonth;
  const share = (b: BudgetProgress) => (all ? b.spent : b.wallets.find((w) => w.walletUuid === scope)?.spent ?? 0);
  const totalShown = share(data.total);
  const free = SPENDING_CATEGORIES.filter((c) => !data.budgets.some((b) => b.category === c));
  const earliest = latest ? shiftMonth(latest, -MONTHS_BACK) : data.month;

  const close = () => { setDialog(null); setDialogError(null); };
  const remove = async (category: MovementCategory) => {
    setBusy(true);
    setDialogError(null);
    try {
      await walletService.deleteBudgets([category]);
      close();
      changed();
    } catch (err) {
      setDialogError(errorText(err, "Unable to remove this budget."));
    } finally {
      setBusy(false);
    }
  };

  const chart = data.budgets.map((b) => ({ name: CATEGORY_LABELS[b.category!], spent: Math.round(share(b)), limit: b.limit }));

  return (
    <>
      <section className="bg-white rounded-4xl border border-slate-200 shadow-sm p-6 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <MonthButton label="Previous month" disabled={data.month <= earliest} onClick={() => setMonth(shiftMonth(data.month, -1))}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </MonthButton>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C]">
                {monthName(data.month)} · {data.daysElapsed < data.daysInMonth ? `day ${data.daysElapsed} of ${data.daysInMonth}` : "whole month"}
              </p>
              <MonthButton label="Next month" disabled={isCurrent} onClick={() => setMonth(latest && shiftMonth(data.month, 1) >= latest ? undefined : shiftMonth(data.month, 1))}>
                <ChevronRight className="h-3.5 w-3.5" />
              </MonthButton>
            </div>
            <p className="text-3xl font-black text-slate-900 tabular-nums">
              {money(totalShown)} <span className="text-lg text-slate-400">of {money(data.total.limit)}</span>
            </p>
            {!all && data.budgets.length > 0 && (
              <p className="text-[12px] font-semibold text-slate-500 mt-1">from this wallet · {money(data.total.spent)} across all of them</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {all && data.budgets.length > 0 && (
              <p className="text-[13px] font-bold text-slate-500">
                {data.total.spent <= data.total.limit
                  ? `${money(data.total.limit - data.total.spent)} left for the month`
                  : `${money(data.total.spent - data.total.limit)} over budget`}
              </p>
            )}
            {isCurrent && free.length > 0 && data.budgets.length > 0 && (
              <button
                type="button"
                onClick={() => setDialog({ kind: "new" })}
                {...demoLock}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#1c1917] text-white hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1c1917]"
              >
                <Plus className="h-3.5 w-3.5" /> New budget
              </button>
            )}
          </div>
        </div>
        {data.budgets.length > 0 && <BudgetBar spent={totalShown} limit={data.total.limit} pace={pace} status={data.total.status} big />}
      </section>

      {!all && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-semibold text-slate-600">
          Budgets are across all your wallets: here, what this wallet spent of each. One set here counts for all of them.
          <button type="button" onClick={onManage} className="font-bold text-[#C49A3C] hover:underline">See them on All wallets</button>
        </p>
      )}

      {data.budgets.length === 0 ? (
        <section className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 md:p-10 text-center space-y-3">
          <p className="text-lg font-black text-slate-900">{isCurrent ? "No budgets yet" : `No budgets in ${monthName(data.month)}`}</p>
          <p className="text-[13px] text-slate-500 max-w-md mx-auto">
            A monthly limit for groceries, restaurants or any other spending, across all your wallets: see each month where you
            stand, and where you should be by today.
          </p>
          {isCurrent ? (
            <button
              type="button"
              onClick={() => setDialog({ kind: "new" })}
              {...demoLock}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1c1917]"
            >
              <Plus className="h-4 w-4" /> Set a budget
            </button>
          ) : (
            <button type="button" onClick={() => setMonth(undefined)} className="text-[13px] font-bold text-[#C49A3C] hover:underline">
              Back to {latest ? monthName(latest) : "this month"}, to set one
            </button>
          )}
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.budgets.map((b) => (
              <div key={b.category} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between gap-3">
                  <CategoryChip category={b.category} />
                  <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS[b.status].tone}`}>{STATUS[b.status].label}</span>
                    {editable && (
                      <>
                        <IconButton label="Change the limit" onClick={() => setDialog({ kind: "edit", budget: b })}><Pencil className="h-3.5 w-3.5" /></IconButton>
                        <IconButton label="Remove the budget" onClick={() => setDialog({ kind: "remove", budget: b })}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-lg font-black tabular-nums text-slate-900 mt-3">
                  {money(share(b))} <span className="text-sm text-slate-400 font-bold">/ {money(b.limit)}</span>
                </p>
                <BudgetBar spent={share(b)} limit={b.limit} pace={pace} status={b.status} />
                {all && b.wallets.length > 0 && (
                  <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
                    {b.wallets.map((w) => (
                      <li key={w.walletUuid} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                        <span className="h-2 w-2 rounded-full" style={{ background: colors.get(w.walletUuid) ?? "#94a3b8" }} />
                        {names.get(w.walletUuid) ?? "Wallet"} {money(w.spent)}
                      </li>
                    ))}
                  </ul>
                )}
                {!all && <p className="text-[11px] font-semibold text-slate-400 mt-2">{money(b.spent)} across all your wallets</p>}
              </div>
            ))}
          </div>

          <Panel title={all ? "Spent vs budget" : "This wallet's spending vs budget"} subtitle={monthName(data.month)}>
            <div className="p-4 md:p-6 h-72">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 280 }}>
                <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={48} />
                  <YAxis tickFormatter={formatCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} formatter={(v, n) => [money(Number(v)), n === "spent" ? "Spent" : "Budget"]} />
                  <Bar dataKey="limit" fill="#e2e8f0" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                  <Bar dataKey="spent" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false}>
                    {chart.map((c) => <Cell key={c.name} fill={c.spent > c.limit ? "#f43f5e" : "#C49A3C"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </>
      )}

      {(dialog?.kind === "new" || dialog?.kind === "edit") && (
        <BudgetDialog
          budget={dialog.kind === "edit" ? dialog.budget : undefined}
          free={free}
          currency={data.currency}
          onClose={close}
          onSaved={() => { close(); changed(); }}
        />
      )}
      {dialog?.kind === "remove" && (
        <ConfirmDialog
          title={`Remove the ${CATEGORY_LABELS[dialog.budget.category!].toLowerCase()} budget?`}
          description="From this month on. The months before keep it, as they were."
          confirmLabel="Remove"
          confirming={busy}
          error={dialogError}
          onConfirm={() => remove(dialog.budget.category!)}
          onClose={close}
        />
      )}
    </>
  );
}

/** The pace marker shows where spending should be this far into the month. */
function BudgetBar({ spent, limit, pace, status, big }: { spent: number; limit: number; pace: number; status: BudgetStatus; big?: boolean }) {
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  return (
    <div className={`relative ${big ? "h-3 mt-5" : "h-2 mt-3"} rounded-full bg-slate-100`}>
      <div className={`h-full rounded-full ${STATUS[status].bar}`} style={{ width: `${pct}%` }} />
      {pace < 1 && <span className="absolute -top-1 -bottom-1 w-0.5 bg-slate-400 rounded" style={{ left: `${pace * 100}%` }} title="Where spending should be by today" />}
    </div>
  );
}

function MonthButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
      {children}
    </button>
  );
}

/** A new budget (a spending category without one) or a budget's limit, from this month on. */
function BudgetDialog({ budget, free, currency, onClose, onSaved }: {
  budget?: BudgetProgress;
  free: MovementCategory[];
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState<MovementCategory | "">(budget?.category ?? free[0] ?? "");
  const [limit, setLimit] = useState(budget ? String(budget.limit) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseAmount(limit);
  const valid = !!category && parsed !== null && Number(parsed) > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await walletService.setBudgets([{ category: category as MovementCategory, monthlyLimit: parsed! }]);
      onSaved();
    } catch (err) {
      setError(errorText(err, "Unable to save this budget."));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      icon={budget ? <Pencil className="h-5 w-5" /> : <Target className="h-5 w-5" />}
      title={budget ? `${CATEGORY_LABELS[budget.category!]} budget` : "New budget"}
      subtitle={`Across all your wallets, in ${currency}, from this month on`}
      busy={busy}
      error={error}
      submitLabel={budget ? "Save" : "Set budget"}
      canSubmit={valid}
      onSubmit={submit}
      onClose={onClose}
    >
      {!budget && (
        <Field label="Category">
          <select className={INPUT} value={category} onChange={(e) => setCategory(e.target.value as MovementCategory)}>
            {free.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </Field>
      )}
      <Field label={`Monthly limit (${currency})`} hint="What you mean to spend at most in a month: money out, less what comes back in the same category.">
        <input className={INPUT} inputMode="decimal" autoFocus value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="300" />
      </Field>
    </DialogShell>
  );
}
