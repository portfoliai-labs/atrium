// components/dashboard/wallets/WalletInsights.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, Cell, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Lightbulb, Loader2 } from "lucide-react";
import { useWallets } from "../../../context/WalletsContext";
import { formatCompact, formatCurrency } from "../../../lib/format";
import {
  CADENCE_LABELS, categoryColor, categoryLabel, dayLabel, errorText, monthLabel, observationText, savingsRate,
} from "../../../lib/wallets";
import type { CategoryMonths, Merchants, MovementCategory, Observations, RecurringPayments, WalletSummary } from "../../../models/Wallet";
import { AXIS_TICK, Panel, TOOLTIP_STYLE } from "../../preview/PreviewKit";

// The categories the month-by-month chart names; the rest are "Other".
const TOP = 6;
// The merchants shown, from the most asked: rent, mortgages and bills (fixed costs, not where the
// money "goes") are left out unless asked for.
const MERCHANTS_SHOWN = 8;
const MERCHANTS_ASKED = 20;
const FIXED_COSTS: (MovementCategory | null)[] = ["housing", "utilities"];

type Read = { categories: CategoryMonths; merchants: Merchants; recurring: RecurringPayments; observations: Observations };

/** The insights' four reads for the summary's months, refetched as the wallets change. */
function useInsights(scope: string | null, from: string | undefined, to: string | undefined) {
  const { source, version } = useWallets();
  const key = `${scope ?? "all"}:${from}:${to}:${version}`;
  const [state, setState] = useState<{ key: string; read: Read | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!from) return;
    let cancelled = false;
    Promise.all([
      source.categoryMonths(scope, from, to),
      source.merchants(scope, from, to, MERCHANTS_ASKED),
      source.recurringPayments(scope),
      source.observations(scope),
    ])
      .then(([categories, merchants, recurring, observations]) => {
        if (!cancelled) setState({ key, read: { categories, merchants, recurring, observations }, error: null });
      })
      .catch((err) => { if (!cancelled) setState({ key, read: null, error: errorText(err, "Unable to work out the insights.") }); });
    return () => { cancelled = true; };
  }, [source, scope, from, to, key]);
  return state?.key === key ? state : null;
}

/** Each category's money out or in over the months, largest first. */
function byCategory(months: CategoryMonths["months"], field: "spending" | "income") {
  const map = new Map<MovementCategory | null, number>();
  for (const m of months) for (const c of m.categories) if (c[field] > 0) map.set(c.category, (map.get(c.category) ?? 0) + c[field]);
  return [...map].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

/**
 * A wallet's Insights (or every wallet's: `scope` null), over the summary's months (the last 12):
 * what stands out about last month, money in and out and the balance month by month (the
 * summary's), then where the money went and came from by category, the payees and the payments
 * that repeat, all arca's, transfers between the user's wallets left out. Across wallets, in the
 * reference currency, archived wallets left out as the summary leaves them. A demo account reads
 * its sample's, worked out the same way.
 */
export function WalletInsights({ scope, summary }: { scope: string | null; summary: WalletSummary | null | undefined }) {
  const { wallets } = useWallets();
  const first = summary?.months[0]?.month;
  const last = summary?.months.at(-1)?.month;
  const current = useInsights(scope, first, last);
  const read = current?.read ?? null;
  const currency = read?.categories.currency ?? summary?.currency ?? "EUR";
  const eur = (v: number, d = 0) => formatCurrency(v, currency, d);

  const spending = useMemo(() => byCategory(read?.categories.months ?? [], "spending"), [read]);
  const income = useMemo(() => byCategory(read?.categories.months ?? [], "income"), [read]);
  const spendingTotal = spending.reduce((s, c) => s + c.amount, 0);
  const incomeTotal = income.reduce((s, c) => s + c.amount, 0);
  const top = useMemo(() => spending.slice(0, TOP).map((c) => c.category), [spending]);
  const stacked = useMemo(() => (read?.categories.months ?? []).map(({ month, categories }) => {
    const row: Record<string, string | number> = { label: monthLabel(month) };
    for (const c of top) row[categoryLabel(c)] = categories.find((x) => x.category === c)?.spending ?? 0;
    row.Other = categories.filter((x) => !top.includes(x.category)).reduce((s, x) => s + x.spending, 0);
    return row;
  }), [read, top]);
  const walletName = (uuid: string) => wallets.find((w) => w.uuid === uuid)?.name ?? "A wallet";
  const [fixedCosts, setFixedCosts] = useState(false);
  const shownMerchants = (read?.merchants.merchants ?? []).filter((m) => fixedCosts || !FIXED_COSTS.includes(m.category)).slice(0, MERCHANTS_SHOWN);

  if (summary === undefined) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 text-slate-300 animate-spin" /></div>;
  }
  if (summary === null) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-500">
        The figures can&apos;t be worked out right now{scope ? "" : " (an exchange rate may be missing for one of your wallets' currencies)"}. Try again later.
      </p>
    );
  }

  const months = summary.months;
  const flow = months.map((m) => ({ label: monthLabel(m.month), income: m.income, spending: -m.spending }));
  const balance = months.map((m) => ({ label: monthLabel(m.month), balance: m.closingBalance }));
  const rates = months.map((m) => ({ label: monthLabel(m.month), rate: m.income > 0 ? Math.round(((m.income - m.spending) / m.income) * 100) : null }));
  const yearIn = months.reduce((s, m) => s + m.income, 0);
  const yearOut = months.reduce((s, m) => s + m.spending, 0);
  const rate = savingsRate(months);
  const empty = yearIn === 0 && yearOut === 0;
  const note = "Last 12 months, transfers between your wallets excluded.";

  return (
    <>
      {read && read.observations.observations.length > 0 && (
        <div className="bg-[#1c1917] rounded-3xl p-5 md:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-[#C49A3C]" />
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C]">What PortfoliAI noticed</p>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {read.observations.observations.slice(0, 6).map((o, i) => (
              <li key={`${o.kind}:${o.category ?? o.name ?? i}`} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-[13px] text-stone-300 leading-relaxed">
                {observationText(o, read.observations.currency)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6">
        <Panel
          title="Money in and out"
          subtitle={scope ? "Month by month, transfers included." : "Month by month, across your wallets."}
          right={
            <div className="flex gap-5 text-right">
              <MiniFig label="In" value={eur(yearIn)} tone="gain" />
              <MiniFig label="Out" value={eur(yearOut)} tone="loss" />
              <MiniFig label="Saved" value={rate === null ? "—" : `${rate.toFixed(0)}%`} />
            </div>
          }
        >
          <div className="p-4 md:p-6 h-72">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 560, height: 260 }}>
              <BarChart data={flow} stackOffset="sign" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={8} />
                <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} formatter={(v, n) => [eur(Math.abs(Number(v))), n === "income" ? "In" : "Out"]} />
                <ReferenceLine y={0} stroke="#cbd5e1" />
                <Bar dataKey="income" stackId="flow" fill="#1baf7a" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                <Bar dataKey="spending" stackId="flow" fill="#e11d48" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Balance" subtitle="At each month's end (today, for this one).">
          <div className="p-4 md:p-6 h-72">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 260 }}>
              <LineChart data={balance} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} domain={["auto", "auto"]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [eur(Number(v)), "Balance"]} />
                <Line type="monotone" dataKey="balance" stroke="#C49A3C" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {empty ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-500">
          Nothing came in or went out in the last 12 months. Add movements, or import a statement, to see where the money goes.
        </p>
      ) : !current ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 text-slate-300 animate-spin" /></div>
      ) : !read ? (
        <p className="text-sm font-semibold text-rose-600">{current.error}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6">
            <Panel title="Spending by category" subtitle={`${eur(spendingTotal)} · ${note}`}>
              <CategoryBreakdown rows={spending} total={spendingTotal} format={eur} empty="No spending in this period." />
            </Panel>
            <Panel title="Month by month" subtitle="Spending in the largest categories, the rest as Other.">
              <div className="p-4 md:p-6 h-80">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 560, height: 300 }}>
                  <BarChart data={stacked} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={8} />
                    <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} formatter={(v, n) => [eur(Number(v)), n]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {top.map((c) => <Bar key={c ?? "none"} dataKey={categoryLabel(c)} stackId="s" fill={categoryColor(c)} maxBarSize={26} isAnimationActive={false} />)}
                    <Bar dataKey="Other" stackId="s" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel title="Income sources" subtitle={`${eur(incomeTotal)} · ${note}`}>
              <IncomeBar rows={income} total={incomeTotal} format={eur} />
            </Panel>
            <Panel title="Savings rate" subtitle="Share of each month's income not spent.">
              <div className="p-4 md:p-6 h-56">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 200 }}>
                  <LineChart data={rates} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
                    <ReferenceLine y={0} stroke="#cbd5e1" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Saved"]} />
                    <Line type="monotone" dataKey="rate" stroke="#C49A3C" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel
              title="Top merchants"
              subtitle={`Where the money went, last 12 months${fixedCosts ? "" : ", rent and bills aside"}.`}
              right={
                <button type="button" onClick={() => setFixedCosts((v) => !v)} className="text-[11px] font-bold text-[#8A6A28] hover:text-[#C49A3C]">
                  {fixedCosts ? "Leave rent and bills aside" : "Include rent and bills"}
                </button>
              }
            >
              {shownMerchants.length === 0 ? (
                <p className="p-6 text-sm font-semibold text-slate-500">No payments in this period.</p>
              ) : (
                <ul className="px-6 md:px-7 py-4 divide-y divide-slate-100">
                  {shownMerchants.map((m) => (
                    <li key={m.name} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-800 truncate">{m.name}</p>
                        <p className="text-[11px] font-semibold text-slate-400">
                          {m.payments} {m.payments === 1 ? "payment" : "payments"} · {categoryLabel(m.category)} · last {dayLabel(m.lastBookedOn)}
                        </p>
                      </div>
                      <span className="text-[13px] font-black tabular-nums text-slate-900">{formatCurrency(m.spent, read.merchants.currency, 0)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel
              title="Recurring payments"
              subtitle="Detected from repeating payments, the last 13 months."
              right={read.recurring.payments.length > 0 ? <MiniFig label="A year" value={formatCurrency(read.recurring.yearlyTotal, read.recurring.currency, 0)} /> : undefined}
            >
              {read.recurring.payments.length === 0 ? (
                <p className="p-6 text-sm font-semibold text-slate-500">Nothing repeats yet: recurring payments show after a few of them.</p>
              ) : (
                <ul className="px-6 md:px-7 py-4 divide-y divide-slate-100">
                  {read.recurring.payments.map((r) => (
                    <li key={`${r.walletUuid}:${r.name}`} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-800 truncate">{r.name}</p>
                        <p className="text-[11px] font-semibold text-slate-400">
                          {CADENCE_LABELS[r.cadence]} · next {dayLabel(r.nextExpectedOn)}{scope ? "" : ` · ${walletName(r.walletUuid)}`}
                        </p>
                      </div>
                      <span className="text-[13px] font-black tabular-nums text-slate-900">{formatCurrency(r.amount, r.currency, 2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

function MiniFig({ label, value, tone }: { label: string; value: string; tone?: "gain" | "loss" }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-sm font-black tabular-nums ${tone === "gain" ? "text-emerald-600" : tone === "loss" ? "text-rose-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

type CategoryRow = { category: MovementCategory | null; amount: number };

function CategoryBreakdown({ rows, total, format, empty }: { rows: CategoryRow[]; total: number; format: (v: number) => string; empty: string }) {
  if (total <= 0) return <p className="p-6 text-sm font-semibold text-slate-500">{empty}</p>;
  return (
    <div className="p-6 md:p-7 flex flex-col sm:flex-row items-center gap-6">
      <PieChart width={150} height={150}>
        <Pie data={rows.map((r) => ({ name: categoryLabel(r.category), amount: r.amount }))} dataKey="amount" nameKey="name" innerRadius={46} outerRadius={72} paddingAngle={1.5} stroke="none" isAnimationActive={false}>
          {rows.map((r) => <Cell key={r.category ?? "none"} fill={categoryColor(r.category)} />)}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [format(Number(v)), n]} />
      </PieChart>
      <ul className="flex-1 w-full space-y-1.5">
        {rows.map((r) => (
          <li key={r.category ?? "none"} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex items-center gap-2 font-semibold text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: categoryColor(r.category) }} />{categoryLabel(r.category)}
            </span>
            <span className="tabular-nums font-bold text-slate-900">
              {format(r.amount)} <span className="text-slate-400 font-semibold">{((r.amount / total) * 100).toFixed(0)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IncomeBar({ rows, total, format }: { rows: CategoryRow[]; total: number; format: (v: number) => string }) {
  if (total <= 0) return <p className="p-6 text-sm font-semibold text-slate-500">No income in this period.</p>;
  return (
    <div className="p-6 md:p-7 space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden">
        {rows.map((r) => <span key={r.category ?? "none"} style={{ width: `${(r.amount / total) * 100}%`, background: categoryColor(r.category) }} />)}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {rows.map((r) => (
          <span key={r.category ?? "none"} className="flex items-center gap-2 text-[13px] font-semibold text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: categoryColor(r.category) }} />
            {categoryLabel(r.category)} <span className="font-black text-slate-900 tabular-nums">{format(r.amount)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
