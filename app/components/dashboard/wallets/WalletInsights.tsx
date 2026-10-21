// components/dashboard/wallets/WalletInsights.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Lightbulb, Loader2 } from "lucide-react";
import { useWallets } from "../../../context/WalletsContext";
import { formatCompact, formatCurrency } from "../../../lib/format";
import {
  CADENCE_LABELS, dayLabel, errorText, monthLabel, monthName, observationText, savingsRate, type CategoryRef, type CategoryTree,
} from "../../../lib/wallets";
import type { CategoryMonths, Merchants, MovementCategory, Observations, RecurringPayments, WalletSummary } from "../../../models/Wallet";
import { AXIS_TICK, TOOLTIP_STYLE } from "../../preview/PreviewKit";
import { DataTable, ExplorePanel, ExploreView, type DataColumn } from "../ExploreView";
import { Fig, Figs, HBars, MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";

// The categories the month-by-month chart names; the rest are "Other".
const TOP = 6;
// The merchants asked for; rent, mortgages and bills (fixed costs, not where the money "goes")
// are left out of them unless asked for.
const MERCHANTS_ASKED = 20;
// The categories a module shows; the rest are in its detail.
const MODULE_ROWS = 5;
const NOTE = "Last 12 months, transfers between your wallets excluded.";
const FIXED_COSTS: (MovementCategory | null)[] = ["housing", "utilities"];

// A row of modules, a lone one (its neighbour hidden for having nothing to show) the whole of it.
const ROW = "grid grid-cols-1 lg:grid-cols-2 gap-[22px] lg:[&>*:only-child]:col-span-2";

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

/**
 * Each category's money out or in over the months, its subcategories' added in (arca's figures are
 * per movement's own category): the top level, largest first, and with `nested` each followed by
 * its subcategories, largest first. A category the tree doesn't know stands at the top.
 */
function byCategory(months: CategoryMonths["months"], field: "spending" | "income", tree: CategoryTree, nested = false): CategoryRow[] {
  const totals = new Map<string, { ref: CategoryRef; parent: string | null; amount: number }>();
  const add = (key: string, ref: CategoryRef, parent: string | null, amount: number) => {
    const t = totals.get(key);
    if (t) t.amount += amount;
    else totals.set(key, { ref, parent, amount });
  };
  for (const m of months) {
    for (const c of m.categories) {
      if (c[field] <= 0) continue;
      const own = tree.get(c.categoryUuid);
      if (!own) add(c.categoryUuid ?? c.category ?? "none", c, null, c[field]);
      else for (const x of [own, ...tree.ancestors(own.uuid)]) add(x.uuid, { categoryUuid: x.uuid, category: x.preset ?? c.category }, x.parentUuid, c[field]);
    }
  }
  const level = (parent: string | null, depth: number): CategoryRow[] => [...totals]
    .filter(([, t]) => t.parent === parent)
    .sort((a, b) => b[1].amount - a[1].amount)
    .flatMap(([key, t]) => [{ key, ref: t.ref, amount: t.amount, depth }, ...(nested ? level(key, depth + 1) : [])]);
  return level(null, 0);
}

/**
 * A wallet's Insights (or every wallet's: `scope` null), over the summary's months (the last 12),
 * as a portfolio's are: modules that sum up, each opening its detail (ExploreView, hosted by
 * ExploreHost in WalletNode). What stands out about last month; the last 12 months' money in and
 * out and the balance (the summary's); where the money went and came from by category (the
 * payees and the payments that repeat in the spending's detail), all arca's, transfers between
 * the user's wallets left out. Across wallets, in the reference currency, archived wallets left
 * out as the summary leaves them. A demo account reads its sample's, worked out the same way.
 */
export function WalletInsights({ scope, summary }: { scope: string | null; summary: WalletSummary | null | undefined }) {
  const first = summary?.months[0]?.month;
  const last = summary?.months.at(-1)?.month;
  const current = useInsights(scope, first, last);
  const read = current?.read ?? null;
  const { categories } = useWallets();
  const currency = read?.categories.currency ?? summary?.currency ?? "EUR";
  const eur = (v: number, d = 0) => formatCurrency(v, currency, d);

  const spending = useMemo(() => byCategory(read?.categories.months ?? [], "spending", categories), [read, categories]);
  const income = useMemo(() => byCategory(read?.categories.months ?? [], "income", categories), [read, categories]);

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
  const empty = months.every((m) => m.income === 0 && m.spending === 0);
  // Modules with nothing to show are left out, not drawn empty.
  const hasBalance = months.some((m) => m.closingBalance !== 0);
  const spendingTotal = spending.reduce((s, c) => s + c.amount, 0);
  const incomeTotal = income.reduce((s, c) => s + c.amount, 0);

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
              <li key={`${o.kind}:${o.categoryUuid ?? o.category ?? o.name ?? i}`} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-[13px] text-stone-300 leading-relaxed">
                {observationText(o, read.observations.currency, categories)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(!empty || hasBalance) && (
        <div className={ROW}>
          {!empty && <FlowModule months={months} scope={scope} eur={eur} />}
          {hasBalance && <BalanceModule months={months} eur={eur} />}
        </div>
      )}

      {/* Nothing in or out in the 12 months: no modules, and nothing said in their place. */}
      {empty ? null : !current ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 text-slate-300 animate-spin" /></div>
      ) : !read ? (
        <p className="text-sm font-semibold text-rose-600">{current.error}</p>
      ) : (
        <>
          {(spendingTotal > 0 || incomeTotal > 0) && (
            <div className={ROW}>
              {spendingTotal > 0 && <SpendingModule read={read} rows={spending} total={spendingTotal} scope={scope} eur={eur} />}
              {incomeTotal > 0 && <IncomeModule rows={income} total={incomeTotal} eur={eur} />}
            </div>
          )}
        </>
      )}
    </>
  );
}

type Eur = (v: number, d?: number) => string;
type Months = WalletSummary["months"];

/** LAST 12 MONTHS — money in and out, and the share saved; its detail month by month. */
function FlowModule({ months, scope, eur }: { months: Months; scope: string | null; eur: Eur }) {
  const [exploring, setExploring] = useState(false);
  const flow = months.map((m) => ({ label: monthLabel(m.month), income: m.income, spending: -m.spending }));
  const rates = months.map((m) => ({ label: monthLabel(m.month), rate: m.income > 0 ? Math.round(((m.income - m.spending) / m.income) * 100) : null }));
  const yearIn = months.reduce((s, m) => s + m.income, 0);
  const yearOut = months.reduce((s, m) => s + m.spending, 0);
  const rate = savingsRate(months);
  const rateText = (r: number | null) => (r === null ? "—" : `${r.toFixed(0)}%`);
  const rows = [...months].reverse();
  const columns: DataColumn<Months[number]>[] = [
    { key: "month", label: "Month", sortValue: (m) => m.month, render: (m) => monthName(m.month), grow: true },
    { key: "in", label: "In", align: "right", sortValue: (m) => m.income, render: (m) => <span className="text-emerald-700 font-bold tabular-nums">{eur(m.income)}</span> },
    { key: "out", label: "Out", align: "right", sortValue: (m) => m.spending, render: (m) => <span className="text-rose-600 font-bold tabular-nums">{eur(m.spending)}</span> },
    { key: "net", label: "Net", align: "right", sortValue: (m) => m.income - m.spending, render: (m) => <span className="font-bold tabular-nums">{eur(m.income - m.spending)}</span> },
    { key: "saved", label: "Saved", align: "right", sortValue: (m) => (m.income > 0 ? (m.income - m.spending) / m.income : null), render: (m) => rateText(m.income > 0 ? ((m.income - m.spending) / m.income) * 100 : null) },
  ];
  const figs = (
    <Figs>
      <Fig label="In" value={eur(yearIn)} tone="gain" strong />
      <Fig label="Out" value={eur(yearOut)} tone="loss" strong />
      <Fig label="Saved" value={rateText(rate)} sub="of what came in" />
    </Figs>
  );
  const chart = (height: string) => (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 560, height: 200 }}>
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
  );

  return (
    <Module>
      <ModuleHead
        title="Last 12 months"
        desc={scope ? "Money in and out, transfers included." : "Money in and out across your wallets, transfers between them left out."}
        onExplore={() => setExploring(true)}
      />
      <div className={`${MODULE_BODY} space-y-5`}>
        {figs}
        {chart("h-40")}
      </div>
      {exploring && (
        <ExploreView title="Last 12 months" onClose={() => setExploring(false)}>
          <ExplorePanel title="Money in and out" desc="Month by month.">
            <div className="px-6 pb-6 space-y-5">{figs}{chart("h-80")}</div>
          </ExplorePanel>
          {rates.some((r) => r.rate !== null) && (
            <ExplorePanel title="Savings rate" desc="Share of each month's income not spent.">
              <div className="px-6 pb-6 h-56">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 560, height: 200 }}>
                  <LineChart data={rates} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
                    <ReferenceLine y={0} stroke="#cbd5e1" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Saved"]} />
                    <Line type="monotone" dataKey="rate" stroke="#C49A3C" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ExplorePanel>
          )}
          <ExplorePanel title="Month by month">
            <DataTable columns={columns} rows={rows} rowKey={(m) => m.month} />
          </ExplorePanel>
        </ExploreView>
      )}
    </Module>
  );
}

/** BALANCE — at each month's end; its detail the longer chart and each month's change. */
function BalanceModule({ months, eur }: { months: Months; eur: Eur }) {
  const [exploring, setExploring] = useState(false);
  const balance = months.map((m) => ({ label: monthLabel(m.month), balance: m.closingBalance }));
  const now = months.at(-1)?.closingBalance ?? 0;
  const before = months[0]?.closingBalance ?? 0;
  const change = now - before;
  const rows = months.map((m, i) => ({ month: m.month, balance: m.closingBalance, change: i > 0 ? m.closingBalance - months[i - 1].closingBalance : null })).reverse();
  const columns: DataColumn<(typeof rows)[number]>[] = [
    { key: "month", label: "Month", sortValue: (r) => r.month, render: (r) => monthName(r.month), grow: true },
    { key: "balance", label: "Balance", align: "right", sortValue: (r) => r.balance, render: (r) => <span className="font-bold tabular-nums">{eur(r.balance)}</span> },
    {
      key: "change", label: "Change", align: "right", sortValue: (r) => r.change,
      render: (r) => (r.change === null ? "—" : <span className={`font-bold tabular-nums ${r.change < 0 ? "text-rose-600" : "text-emerald-700"}`}>{r.change > 0 ? "+" : ""}{eur(r.change)}</span>),
    },
  ];
  const figs = (
    <Figs>
      <Fig label="Now" value={eur(now)} strong />
      <Fig label="Over 12 months" value={`${change > 0 ? "+" : ""}${eur(change)}`} tone={change === 0 ? undefined : change > 0 ? "gain" : "loss"} />
    </Figs>
  );
  const chart = (height: string) => (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 200 }}>
        <LineChart data={balance} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} domain={["auto", "auto"]} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [eur(Number(v)), "Balance"]} />
          <Line type="monotone" dataKey="balance" stroke="#C49A3C" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <Module>
      <ModuleHead title="Balance" desc="At each month's end (today, for this one)." onExplore={() => setExploring(true)} />
      <div className={`${MODULE_BODY} space-y-5`}>
        {figs}
        {chart("h-40")}
      </div>
      {exploring && (
        <ExploreView title="Balance" onClose={() => setExploring(false)}>
          <ExplorePanel title="Balance" desc="At each month's end (today, for this one).">
            <div className="px-6 pb-6 space-y-5">{figs}{chart("h-80")}</div>
          </ExplorePanel>
          <ExplorePanel title="Month by month">
            <DataTable columns={columns} rows={rows} rowKey={(r) => r.month} />
          </ExplorePanel>
        </ExploreView>
      )}
    </Module>
  );
}

/** The largest few of `rows` (`all`: every one) as bars, by their share of `total`. */
function CategoryBars({ rows, total, eur, all = false }: { rows: CategoryRow[]; total: number; eur: Eur; all?: boolean }) {
  const { categories } = useWallets();
  return (
    <HBars
      max={100}
      rows={(all ? rows : rows.slice(0, MODULE_ROWS)).map((r) => ({
        key: r.key,
        label: categories.label(r.ref),
        value: (r.amount / total) * 100,
        figure: eur(r.amount),
        color: categories.color(r.ref),
        title: `${categories.label(r.ref)} · ${((r.amount / total) * 100).toFixed(0)}%`,
      }))}
    />
  );
}

/**
 * SPENDING — where the money went, the largest categories, and what the recurring payments come
 * to in a year; its detail every category, the largest month by month, the payees and the
 * recurring payments.
 */
function SpendingModule({ read, rows, total, scope, eur }: { read: Read; rows: CategoryRow[]; total: number; scope: string | null; eur: Eur }) {
  const [exploring, setExploring] = useState(false);
  const [fixedCosts, setFixedCosts] = useState(false);
  const { categories } = useWallets();
  // Every category, each followed by its subcategories, for the detail.
  const all = useMemo(() => byCategory(read.categories.months, "spending", categories, true), [read, categories]);
  const top = useMemo(() => rows.slice(0, TOP), [rows]);
  const stacked = useMemo(() => read.categories.months.map((m) => {
    const month = new Map(byCategory([m], "spending", categories).map((r) => [r.key, r.amount]));
    const row: Record<string, string | number> = { label: monthLabel(m.month) };
    for (const c of top) row[categories.label(c.ref)] = month.get(c.key) ?? 0;
    row.Other = [...month].filter(([key]) => !top.some((c) => c.key === key)).reduce((s, [, v]) => s + v, 0);
    return row;
  }), [read, top, categories]);
  const recurring = read.recurring;
  const merchants = read.merchants.merchants.filter((m) => fixedCosts || !FIXED_COSTS.includes(m.category));
  const merchantColumns: DataColumn<Merchants["merchants"][number]>[] = [
    { key: "name", label: "Merchant", sortValue: (m) => m.name, render: (m) => <span className="font-bold text-slate-800">{m.name}</span>, grow: true },
    { key: "category", label: "Category", sortValue: (m) => categories.label(m), render: (m) => categories.label(m) },
    { key: "payments", label: "Payments", align: "right", sortValue: (m) => m.payments, render: (m) => m.payments },
    { key: "last", label: "Last", align: "right", sortValue: (m) => m.lastBookedOn, render: (m) => dayLabel(m.lastBookedOn) },
    { key: "spent", label: "Spent", align: "right", sortValue: (m) => m.spent, render: (m) => <span className="font-bold tabular-nums">{formatCurrency(m.spent, read.merchants.currency, 0)}</span> },
  ];

  return (
    <Module>
      <ModuleHead title="Spending" desc={NOTE} onExplore={() => setExploring(true)} />
      <div className={`${MODULE_BODY} space-y-5`}>
        <Figs>
          <Fig label="Spent" value={eur(total)} strong sub={`${rows.length} ${rows.length === 1 ? "category" : "categories"}`} />
          {recurring.payments.length > 0 && (
            <Fig
              label="Recurring, a year"
              value={formatCurrency(recurring.yearlyTotal, recurring.currency, 0)}
              sub={`${recurring.payments.length} ${recurring.payments.length === 1 ? "payment" : "payments"}`}
            />
          )}
        </Figs>
        <CategoryBars rows={rows} total={total} eur={eur} />
      </div>
      {exploring && (
        <ExploreView title="Spending" onClose={() => setExploring(false)}>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6">
            <ExplorePanel title="By category" desc={NOTE} right={<span className="text-[13px] font-black tabular-nums text-slate-900">{eur(total)}</span>}>
              <CategoryBreakdown rows={all} total={total} format={eur} />
            </ExplorePanel>
            <ExplorePanel title="Month by month" desc="Spending in the largest categories, the rest as Other.">
              <div className="px-6 pb-6 h-80">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 560, height: 300 }}>
                  <BarChart data={stacked} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={8} />
                    <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} formatter={(v, n) => [eur(Number(v)), n]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {top.map((c) => <Bar key={c.key} dataKey={categories.label(c.ref)} stackId="s" fill={categories.color(c.ref)} maxBarSize={26} isAnimationActive={false} />)}
                    <Bar dataKey="Other" stackId="s" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ExplorePanel>
          </div>
          {read.merchants.merchants.length > 0 && (
            <ExplorePanel
              title="Top merchants"
              desc={`Where the money went, last 12 months${fixedCosts ? "" : ", rent and bills aside"}.`}
              right={
                <button type="button" onClick={() => setFixedCosts((v) => !v)} className="text-[11px] font-bold text-[#8A6A28] hover:text-[#C49A3C]">
                  {fixedCosts ? "Leave rent and bills aside" : "Include rent and bills"}
                </button>
              }
            >
              {/* With payees only among rent and bills it stays, its toggle the way to them. */}
              {merchants.length === 0
                ? <p className="px-6 pb-6 text-sm font-semibold text-slate-500">Only rent and bills in this period.</p>
                : <DataTable columns={merchantColumns} rows={merchants} rowKey={(m) => m.name} initialSort={{ key: "spent", desc: true }} />}
            </ExplorePanel>
          )}
          {recurring.payments.length > 0 && <RecurringPanel recurring={recurring} scope={scope} />}
        </ExploreView>
      )}
    </Module>
  );
}

/** INCOME — where the money came from: every source, so it has no detail of its own. */
function IncomeModule({ rows, total, eur }: { rows: CategoryRow[]; total: number; eur: Eur }) {
  return (
    <Module>
      <ModuleHead title="Income" desc={NOTE} />
      <div className={`${MODULE_BODY} space-y-5`}>
        <Figs>
          <Fig label="Came in" value={eur(total)} tone="gain" strong sub={`${rows.length} ${rows.length === 1 ? "source" : "sources"}`} />
        </Figs>
        <CategoryBars rows={rows} total={total} eur={eur} all />
      </div>
    </Module>
  );
}

/** RECURRING PAYMENTS — in Spending's detail: every payment that repeats, and what they come to in a year. */
function RecurringPanel({ recurring, scope }: { recurring: RecurringPayments; scope: string | null }) {
  const { wallets } = useWallets();
  const walletName = (uuid: string) => wallets.find((w) => w.uuid === uuid)?.name ?? "A wallet";
  type Payment = RecurringPayments["payments"][number];
  const columns: DataColumn<Payment>[] = [
    { key: "name", label: "Payment", sortValue: (r) => r.name, render: (r) => <span className="font-bold text-slate-800">{r.name}</span>, grow: true },
    { key: "cadence", label: "Every", sortValue: (r) => CADENCE_LABELS[r.cadence], render: (r) => CADENCE_LABELS[r.cadence] },
    ...(scope ? [] : [{ key: "wallet", label: "Wallet", sortValue: (r: Payment) => walletName(r.walletUuid), render: (r: Payment) => walletName(r.walletUuid) }]),
    { key: "next", label: "Next", align: "right", sortValue: (r) => r.nextExpectedOn, render: (r) => dayLabel(r.nextExpectedOn) },
    { key: "amount", label: "Amount", align: "right", sortValue: (r) => r.amount, render: (r) => <span className="font-bold tabular-nums">{formatCurrency(r.amount, r.currency, 2)}</span> },
  ];
  return (
    <ExplorePanel
      title="Recurring payments"
      desc="Detected from repeating payments, the last 13 months."
      right={<MiniFig label="A year" value={formatCurrency(recurring.yearlyTotal, recurring.currency, 0)} />}
    >
      <DataTable columns={columns} rows={recurring.payments} rowKey={(r) => `${r.walletUuid}:${r.name}`} initialSort={{ key: "next", desc: false }} />
    </ExplorePanel>
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

// `key`: the category's uuid ("none": uncategorised); `depth`: 0 at the top level.
type CategoryRow = { key: string; ref: CategoryRef; amount: number; depth: number };

// Where the money went: a bar split by top-level category, each its colour, over the categories
// (each followed by its subcategories, indented) with their amount and share.
function CategoryBreakdown({ rows, total, format }: { rows: CategoryRow[]; total: number; format: (v: number) => string }) {
  const { categories } = useWallets();
  return (
    <div className="p-6 md:p-7 space-y-4">
      <div className="flex h-3 rounded-full overflow-hidden">
        {rows.filter((r) => r.depth === 0).map((r) => (
          <span key={r.key} title={categories.label(r.ref)} style={{ width: `${(r.amount / total) * 100}%`, background: categories.color(r.ref) }} />
        ))}
      </div>
      <ul className="w-full space-y-1.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 text-[13px]" style={{ paddingLeft: `${r.depth * 18}px` }}>
            <span className={`flex items-center gap-2 ${r.depth === 0 ? "font-semibold text-slate-700" : "font-medium text-slate-500"}`}>
              <span className={`${r.depth === 0 ? "h-2.5 w-2.5" : "h-2 w-2"} rounded-full`} style={{ background: categories.color(r.ref) }} />{categories.label(r.ref)}
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
