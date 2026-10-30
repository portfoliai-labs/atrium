// components/dashboard/realEstate/RealEstateNode.tsx
"use client";

import { useMemo, useState } from "react";
import { Archive, ChevronRight, Loader2, Plus } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useRealEstate, useRealEstateOverview, useRealEstateRead, useRealEstateSummary } from "../../../context/RealEstateContext";
import { CATEGORICAL_PALETTE } from "../../../lib/chartColors";
import { formatCompact, formatCurrency } from "../../../lib/format";
import { PROPERTY_KIND_LABELS, PROPERTY_USE_LABELS } from "../../../lib/realEstate";
import { dayLabel, monthLabel, today } from "../../../lib/wallets";
import type { Property, PropertyTax, PropertyUse, TaxList } from "../../../models/RealEstate";
import { Breadcrumb, type Crumb } from "../Breadcrumb";
import { PageHeader, type PageAction, type PageCounter, type PageFigure } from "../PageHeader";
import { Fig, Figs, HBars, MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { DonutList, type DonutItem } from "../DonutList";
import { PreviewBadge } from "../../preview/PreviewKit";
import { RealEstateTransactionDialog, type RealEstateEntryKind } from "./RealEstateTransactionForm";
import { ALL_PROPERTIES, RealEstateTransactions } from "./RealEstateTransactions";
import { RealEstateInsights } from "./RealEstateInsights";
import { PropertyPage } from "./PropertyPage";
import { RealEstateAlerts, alertsCounter, useAlertRules } from "./RealEstateAlerts";

// The real estate's pages: its own, a property's, and those its header leads to.
export type RealEstatePage = "home" | "property" | "insights" | "transactions" | "alerts";

const VALUE_COLOR = "#C49A3C";

const USE_COLORS: Record<PropertyUse, string> = {
  primary_residence: "#2a78d6", second_home: "#4a3aa7", long_term_rental: "#1baf7a", short_term_rental: "#eb6834", vacant: "#94a3b8",
  free_loan: "#e87ba4", uninhabitable: "#a16207",
};

const pct = (v: number, digits = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
const toneOf = (v: number | null | undefined): "gain" | "loss" | undefined => (v == null || v === 0 ? undefined : v > 0 ? "gain" : "loss");

/**
 * REAL ESTATE NODE — the real estate section's pages, built like All wallets' page. Its own page: a
 * header with the figures that say something about what the user has (headerFigures), its activity
 * (Transactions, Insights) and the way to add to it; under it the value since the first purchase
 * against what was put in, the Composition of the properties (each opening its page, PropertyPage),
 * the last 12 months' cash flow (with an income), the year's taxes, and the archived properties. The figures across properties are in the user's
 * reference currency (the overview's); a property whose currency can't be converted today is
 * listed in its own but takes no share. New properties and their transactions are added from one
 * form (RealEstateTransactionForm): a property comes with its Purchase. Transactions can be every
 * property's or one's (`property`), and so can the Alerts (RealEstateAlerts). The Reports (RealEstateReports) are
 * every property's or one's too. A demo account's are sample data, read only. A property that's gone (deleted, an old link) opens the real
 * estate's own page.
 */
export function RealEstateNode({ page: requested, property: propertyUuid, rootTrail, onOpen }: {
  page: RealEstatePage;
  property?: string;
  rootTrail: Crumb[];
  onOpen: (page: RealEstatePage, property?: string) => void;
}) {
  const { properties, loading, error, sample } = useRealEstate();
  const property = propertyUuid ? properties.find((p) => p.uuid === propertyUuid) : undefined;
  const page: RealEstatePage = requested === "property" && !property ? "home" : requested;
  const active = useMemo(() => properties.filter((p) => !p.archived), [properties]);
  const archived = useMemo(() => properties.filter((p) => p.archived), [properties]);
  const overview = useRealEstateOverview(!loading);
  // From the first purchase among the properties counted, monthly.
  const firstMonth = useMemo(() => active.map((p) => p.purchasedOn?.slice(0, 7)).filter((m): m is string => !!m).sort()[0], [active]);
  const summary = useRealEstateSummary(null, firstMonth, undefined, !loading && page === "home");
  const [entry, setEntry] = useState<RealEstateEntryKind | null>(null);
  const count = useTransactionTotal();
  const alertRules = useAlertRules(null, !loading && page === "home");

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 text-[#C49A3C] animate-spin" /></div>;

  const homeCrumb: Crumb = { label: "Real estate", onClick: () => onOpen("home") };
  const trail = [...rootTrail, homeCrumb];
  const currency = overview?.currency ?? summary?.currency ?? active[0]?.currency ?? "EUR";
  const addEntry = () => setEntry(active.length === 0 ? "purchase" : "rent");
  const dialog = entry && (
    <RealEstateTransactionDialog
      initialKind={entry}
      initialPropertyUuid={property?.uuid}
      onClose={() => setEntry(null)}
      onSaved={(uuid) => { setEntry(null); if (entry === "purchase") onOpen("property", uuid); }}
    />
  );

  if (page === "property" && property) {
    return (
      <PropertyPage
        key={property.uuid}
        property={property}
        trail={trail}
        onOpenTransactions={() => onOpen("transactions", property.uuid)}
        onOpenAlerts={() => onOpen("alerts", property.uuid)}
        onGone={() => onOpen("home")}
      />
    );
  }

  if (page === "transactions") {
    const scoped = property ? [...trail, { label: property.name, onClick: () => onOpen("property", property.uuid) }] : trail;
    return (
      <div className="space-y-6 pb-12">
        <Breadcrumb
          trail={scoped}
          current="Transactions"
          right={(
            <button type="button" onClick={addEntry} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#1c1917] text-white hover:bg-[#C49A3C] transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add transaction
            </button>
          )}
        />
        <RealEstateTransactions key={property?.uuid ?? ALL_PROPERTIES} initial={property?.uuid ?? ALL_PROPERTIES} readOnly={sample} />
        {dialog}
      </div>
    );
  }

  if (page === "insights") {
    return (
      <div className="space-y-6 pb-12">
        <Breadcrumb trail={trail} current="Insights" />
        <RealEstateInsights currency={currency} onOpenProperty={(uuid) => onOpen("property", uuid)} />
      </div>
    );
  }

  if (page === "alerts") {
    return <RealEstateAlerts key={property?.uuid ?? "all"} trail={trail} property={property} onOpenProperty={(uuid) => onOpen("property", uuid)} />;
  }

  const money = (v: number) => formatCurrency(v, currency, 0);
  const figures = overview ? headerFigures(overview, money) : [];
  // One way in for everything: a purchase adds a property, anything else is one of theirs.
  const actions: PageAction[] = [{ label: "Add transaction", primary: true, onClick: addEntry }];
  const counters: PageCounter[] = [
    { key: "transactions", label: "transactions", count, onClick: () => onOpen("transactions") },
    { key: "insights", label: "insights", onClick: () => onOpen("insights") },
    // None while the API has no alerts.
    ...(alertRules === null ? [] : [alertsCounter(alertRules, () => onOpen("alerts"))]),
  ];

  // The cash flow only once something brings money in (rents, payouts) in its 12 months: without it, only costs.
  const hasIncome = summary?.months.slice(-12).some((m) => m.income > 0) ?? false;
  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={rootTrail} current="Real estate" />
      <PageHeader
        eyebrow="Real estate"
        badge={sample ? <PreviewBadge label="Sample" /> : undefined}
        title="Real estate"
        // Nothing between the title and the counters, as the wallets' and the portfolios' pages.
        counters={counters}
        actions={actions}
        figures={figures}
      />
      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
      {overview === null && active.length > 0 && (
        <p className="text-[13px] font-semibold text-slate-500">The totals can&apos;t be added up right now: an exchange rate is missing.</p>
      )}
      {active.length === 0 ? (
        <NoProperties onAdd={() => setEntry("purchase")} />
      ) : (
        <>
          <ValueModule summary={summary} />
          <PropertiesComposition properties={active} currency={currency} onOpen={(uuid) => onOpen("property", uuid)} />
          {new Set(active.map((p) => p.use)).size > 1 ? (
            <div className={`grid grid-cols-1 gap-6 ${hasIncome ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" : ""}`}>
              <UseComposition properties={active} currency={currency} />
              {hasIncome && <CashFlowModule summary={summary} />}
            </div>
          ) : hasIncome && <CashFlowModule summary={summary} />}
          <TaxesModule properties={active} onOpen={(uuid) => onOpen("property", uuid)} />
        </>
      )}
      <ArchivedList archived={archived} onOpen={(uuid) => onOpen("property", uuid)} />
      {dialog}
    </div>
  );
}

/**
 * This year's taxes across the properties (Italy's IMU, and the tax on rents: cedolare secca or
 * IRPEF): what's left to pay of what they come to (the platforms' withholding counting as paid),
 * as a bar; the next due day and what falls due on it, or since when something is overdue; what
 * can't be worked out yet; then each property, its taxes as chips with their state, opening its page
 * (where they're worked out and paid). Shown only when some property has them (one in Italy).
 */
function TaxesModule({ properties, onOpen }: { properties: Property[]; onOpen: (uuid: string) => void }) {
  const year = Number(today().slice(0, 4));
  const taxed = properties.some((p) => p.address.country === "IT");
  const list = useRealEstateRead<TaxList>(["taxes", "all", year], (source) => source.taxes(null, year), taxed);
  if (!taxed) return null;
  const byUuid = new Map(properties.map((p) => [p.uuid, p]));
  const taxes = list?.taxes.filter((t) => byUuid.has(t.propertyUuid)) ?? [];
  // In euro: the tax is Italy's.
  const money = (v: number) => formatCurrency(v, "EUR", 0);
  const now = today();
  const owed = taxes.reduce((s, t) => s + t.amount, 0);
  const paid = taxes.reduce((s, t) => s + Math.min(t.paidAmount + t.withheldAmount, t.amount), 0);
  const left = Math.max(0, owed - paid);
  const unpaid = taxes.flatMap((t) => t.instalments.filter((i) => !i.paid && i.amount > 0));
  const overdue = unpaid.filter((i) => i.dueOn < now);
  const nextDay = unpaid.filter((i) => i.dueOn >= now).map((i) => i.dueOn).sort()[0];
  const nextAmount = unpaid.filter((i) => i.dueOn === nextDay).reduce((s, i) => s + i.amount, 0);
  const provisional = taxes.some((t) => t.provisional && t.status === "computed");
  const missing = taxes.filter((t) => t.status === "not_computed").length;
  // Each property once, its taxes under it, in the list's order.
  const groups = [...new Set(taxes.map((t) => t.propertyUuid))].map((uuid) => ({ property: byUuid.get(uuid)!, taxes: taxes.filter((t) => t.propertyUuid === uuid) }));

  return (
    <Module>
      <ModuleHead
        title={`Taxes ${year}`}
        desc="IMU and the tax on rents this year, at your share. Open a property to see how they're worked out and record a payment."
        right={provisional ? <span className="px-2 py-0.5 rounded-full bg-amber-50 text-[10px] font-black uppercase tracking-wider text-amber-700">Estimate</span> : undefined}
      />
      <div className={`${MODULE_BODY} space-y-5`}>
        {list === undefined ? (
          <p className="text-[12.5px] text-[#857e78]">Loading…</p>
        ) : list === null ? (
          <p className="text-[12.5px] text-rose-600">Unable to work out the taxes right now.</p>
        ) : taxes.length === 0 ? (
          <p className="text-[12.5px] text-[#857e78]">No property tax this year.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div>
                <p className="text-[11px] text-[#78716c]">{left > 0 ? "Left to pay" : "Paid"}</p>
                <p className="text-[22px] font-bold tabular-nums tracking-[-0.01em] text-[#1c1917]">{money(left > 0 ? left : paid)}</p>
                <p className="text-[11px] text-[#857e78] tabular-nums">{left > 0 ? `of ${money(owed)}, ${money(paid)} paid` : owed > 0 ? "All of it" : "Nothing owed"}</p>
              </div>
              {overdue.length > 0 ? (
                <DueBox tone="loss" label="Overdue" day={overdue.map((i) => i.dueOn).sort()[0]} amount={money(overdue.reduce((s, i) => s + i.amount, 0))} since />
              ) : nextDay ? (
                <DueBox label="Next due" day={nextDay} amount={money(nextAmount)} />
              ) : null}
            </div>
            {owed > 0 && (
              <div className="h-2 rounded-full bg-[#F7F5EF] overflow-hidden">
                <div className="h-full rounded-full bg-[#1baf7a]" style={{ width: `${Math.min(100, (paid / owed) * 100)}%` }} />
              </div>
            )}
            {missing > 0 && (
              <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] font-semibold text-amber-800">
                {missing === 1 ? "One tax isn't" : `${missing} taxes aren't`} worked out yet: open the property to see what&apos;s missing.
              </p>
            )}
            <ul className="divide-y divide-[#EEE9DD] border-t border-[#EEE9DD]">
              {groups.map(({ property: p, taxes: own }) => {
                const total = own.filter((t) => t.status === "computed").reduce((s, t) => s + t.amount, 0);
                return (
                  <li key={p.uuid}>
                    <button type="button" onClick={() => onOpen(p.uuid)} className="w-full flex items-center gap-3 py-3 text-left hover:bg-[#F7F5EF] rounded-lg px-1.5 -mx-1.5 transition-colors">
                      <span className="min-w-0 flex-1 space-y-1.5">
                        <span className="block truncate text-[13px] font-bold text-[#1c1917]">{p.name}</span>
                        <span className="flex flex-wrap gap-1.5">
                          {own.map((t) => <TaxChip key={t.kind} tax={t} now={now} />)}
                        </span>
                      </span>
                      <span className="font-bold tabular-nums text-[#1c1917]">{own.some((t) => t.status === "computed") ? money(total) : "—"}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#857e78]" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Module>
  );
}

/** The next day something falls due, or the first one missed, and how much. */
function DueBox({ label, day, amount, tone, since = false }: { label: string; day: string; amount: string; tone?: "loss"; since?: boolean }) {
  return (
    <div className={`rounded-xl px-3.5 py-2.5 text-right ${tone === "loss" ? "bg-rose-50" : "bg-[#F7F5EF]"}`}>
      <p className={`text-[11px] ${tone === "loss" ? "text-rose-600" : "text-[#78716c]"}`}>{label}{since ? " since" : ""} {dayLabel(day)}</p>
      <p className={`text-[15px] font-bold tabular-nums ${tone === "loss" ? "text-rose-700" : "text-[#1c1917]"}`}>{amount}</p>
    </div>
  );
}

const CHIP_TONE = {
  done: "bg-emerald-50 text-emerald-700",
  due: "bg-[#F7F5EF] text-[#78716c]",
  late: "bg-rose-50 text-rose-700",
  missing: "bg-amber-50 text-amber-800",
} as const;

/** One of a property's taxes, its name and where it stands: paid, due by a day, overdue, exempt, not worked out. */
function TaxChip({ tax: t, now }: { tax: PropertyTax; now: string }) {
  const due = t.instalments.find((i) => !i.paid && i.amount > 0);
  const [state, tone]: [string, keyof typeof CHIP_TONE] = t.status === "exempt" ? ["exempt", "done"]
    : t.status === "not_computed" ? [t.notComputed === "missing_details" ? "details missing" : "not worked out", "missing"]
    : !due ? ["paid", "done"]
    : due.dueOn < now ? [`overdue since ${dayLabel(due.dueOn)}`, "late"]
    : [`due ${dayLabel(due.dueOn)}`, "due"];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${CHIP_TONE[tone]}`}>
      <span className="font-bold">{t.name}</span> · {state}
    </span>
  );
}

/** How many transactions there are across the properties: null while loading. */
function useTransactionTotal() {
  const list = useRealEstateRead(["transactions", "all", "count"], (source) => source.transactions(null, { limit: 1 }));
  return list?.total ?? null;
}

/**
 * The header's four figures, of the properties together or of one (the same figures, at the
 * ownership shares): the value always, then the first of what says something about what the user
 * has — the return on what was put in (not once sold), the net cash flow and the income with a
 * rent or a payout in the last 12 months, the debt and the loan-to-value with a mortgage, the gross
 * yield, what was put in, the equity. Nothing about a rent or a mortgage there isn't.
 */
export function headerFigures(f: {
  value: number; invested: number; residualDebt: number; equity: number; yearlyIncome: number; yearlyNetCashFlow: number;
  loanToValuePct: number | null; grossYieldPct: number | null;
}, money: (v: number) => string, sold = false): PageFigure[] {
  const gain = f.invested > 0 && !sold ? ((f.value - f.invested) / f.invested) * 100 : null;
  const income = f.yearlyIncome > 0;
  const debt = f.residualDebt > 0;
  const candidates: (PageFigure | false)[] = [
    { label: "Value", value: money(f.value) },
    gain !== null && { label: "Return", value: pct(gain), tone: toneOf(gain) },
    income && { label: "Net cash flow, 12 months", value: money(f.yearlyNetCashFlow), tone: toneOf(f.yearlyNetCashFlow) },
    debt && { label: "Mortgage debt", value: money(f.residualDebt) },
    income && { label: "Income, 12 months", value: money(f.yearlyIncome) },
    debt && f.loanToValuePct !== null && { label: "Loan-to-value", value: `${f.loanToValuePct.toFixed(0)}%` },
    income && f.grossYieldPct !== null && { label: "Gross yield", value: `${f.grossYieldPct.toFixed(1)}%` },
    f.invested > 0 && { label: "Put in", value: money(f.invested) },
    debt && { label: "Equity", value: money(f.equity) },
  ];
  return candidates.filter((c): c is PageFigure => !!c).slice(0, 4);
}

type Summary = ReturnType<typeof useRealEstateSummary>;

/** The properties' value at the user's share against what was put in, month by month. */
export function ValueModule({ summary, desc = "What your properties are worth at your share, against what was put in (purchases, their costs and works)." }: { summary: Summary; desc?: string }) {
  const data = (summary?.months ?? []).map((m) => ({ label: monthLabel(m.month), value: m.value, invested: m.invested, equity: m.value - m.residualDebt }));
  const currency = summary?.currency ?? "EUR";
  return (
    <Module>
      <ModuleHead title="Value" desc={desc} />
      <div className={`${MODULE_BODY} h-64`}>
        {summary === undefined ? (
          <p className="text-[12.5px] text-[#857e78]">Loading…</p>
        ) : summary === null || data.length === 0 ? (
          <p className="text-[12.5px] text-[#857e78]">Can&apos;t be added up right now: an exchange rate is missing.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 240 }}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              {/* Kept clear of each other in the corner they share: the first month off the Y axis, the lowest value off the months. */}
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#857e78" }} axisLine={false} tickLine={false} tickMargin={8} minTickGap={40} padding={{ left: 12 }} />
              <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={{ fontSize: 10, fill: "#857e78" }} axisLine={false} tickLine={false} tickMargin={8} width={52} domain={["auto", "auto"]} />
              <Tooltip
                formatter={(v, name) => [formatCurrency(Number(v), currency, 0), name === "value" ? "Value" : name === "equity" ? "Equity" : "Put in"]}
                contentStyle={{ borderRadius: 12, border: "1px solid #E0DACC", fontSize: 12 }}
              />
              <Area type="stepAfter" dataKey="invested" stroke="#94a3b8" strokeDasharray="4 4" fill="none" strokeWidth={1.5} isAnimationActive={false} />
              <Area type="monotone" dataKey="equity" stroke="#0f766e" fill="none" strokeWidth={1.5} isAnimationActive={false} />
              <Area type="monotone" dataKey="value" stroke={VALUE_COLOR} fill={VALUE_COLOR} fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Module>
  );
}

/** The last 12 months: rents and payouts in; expenses, property taxes and instalments out. */
export function CashFlowModule({ summary }: { summary: Summary }) {
  const months = (summary?.months ?? []).slice(-12);
  const currency = summary?.currency ?? "EUR";
  const money = (v: number) => formatCurrency(v, currency, 0);
  const income = months.reduce((s, m) => s + m.income, 0);
  const out = months.reduce((s, m) => s + m.expenses + m.mortgagePayments, 0);
  const interest = months.reduce((s, m) => s + m.mortgageInterest, 0);
  return (
    <Module>
      <ModuleHead title="Cash flow" desc="Rents and payouts in; expenses, property taxes and mortgage instalments out, over the last 12 months." />
      <div className={`${MODULE_BODY} space-y-4`}>
        {summary === undefined ? (
          <p className="text-[12.5px] text-[#857e78]">Loading…</p>
        ) : months.length === 0 ? (
          <p className="text-[12.5px] text-[#857e78]">Can&apos;t be added up right now: an exchange rate is missing.</p>
        ) : (
          <>
            <Figs>
              <Fig label="In" value={money(income)} tone="gain" strong />
              <Fig label="Out" value={money(out)} sub={`${money(interest)} of it interest`} />
              <Fig label="Net" value={money(income - out)} tone={toneOf(income - out)} />
            </Figs>
            <div className="h-[170px]">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 170 }}>
                <BarChart data={months.map((m) => ({ label: monthLabel(m.month), income: m.income, out: -(m.expenses + m.mortgagePayments) }))} stackOffset="sign" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#857e78" }} axisLine={false} tickLine={false} tickMargin={8} />
                  <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={{ fontSize: 10, fill: "#857e78" }} axisLine={false} tickLine={false} tickMargin={8} width={44} />
                  <Tooltip formatter={(v, name) => [formatCurrency(Math.abs(Number(v)), currency, 0), name === "income" ? "In" : "Out"]} contentStyle={{ borderRadius: 12, border: "1px solid #E0DACC", fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="#857e78" />
                  <Bar dataKey="income" stackId="flow" fill="#1baf7a" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="out" stackId="flow" fill="#e11d48" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </Module>
  );
}

/** The properties (not archived), each at the user's share: in the reference currency where it could be converted today (figures.reference), otherwise in its own and out of the shares. */
const valuedProperties = (properties: Property[], currency: string) => properties.map((p, i) => {
  const ref = p.figures.reference;
  const inTotal = ref?.currency === currency ? ref.valueAtShare : p.currency === currency ? p.figures.valueAtShare : null;
  return { p, color: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length], inTotal };
});

/**
 * The properties on a donut and in a list, each with its value and share, a slice or a row
 * opening its page: fixed on the real estate's page, the way to each property's (as All
 * portfolios' Portfolios and All wallets' Wallets).
 */
function PropertiesComposition({ properties, currency, onOpen }: { properties: Property[]; currency: string; onOpen: (uuid: string) => void }) {
  const items = useMemo((): DonutItem[] => valuedProperties(properties, currency).map(({ p, color, inTotal }) => ({
    key: p.uuid,
    label: p.name,
    sub: [PROPERTY_KIND_LABELS[p.kind], p.address.locality, p.soldOn ? "Sold" : PROPERTY_USE_LABELS[p.use], inTotal === null ? `in ${p.currency}, not in the total` : null].filter(Boolean).join(" · "),
    value: inTotal ?? p.figures.valueAtShare,
    currency: inTotal === null ? p.currency : currency,
    counted: inTotal !== null && inTotal > 0,
    color,
    onOpen: () => onOpen(p.uuid),
  })), [properties, currency, onOpen]);

  return (
    <Module>
      <ModuleHead title="Properties" desc="Your properties' value at your share. Open one for its page." />
      <div className={MODULE_BODY}><DonutList items={items} currency={currency} /></div>
    </Module>
  );
}

/** The properties' value at the user's share by what they're used for, to read; none with a single use. */
function UseComposition({ properties, currency }: { properties: Property[]; currency: string }) {
  const valued = valuedProperties(properties, currency);
  const uses = [...new Set(valued.map(({ p }) => p.use))].map((use) => {
    const count = valued.filter(({ p }) => p.use === use).length;
    const value = valued.filter(({ p, inTotal }) => p.use === use && inTotal !== null).reduce((s, { inTotal }) => s + inTotal!, 0);
    return { use, count, value };
  });
  const total = uses.reduce((s, u) => s + Math.max(u.value, 0), 0);
  if (uses.length < 2) return null;
  return (
    <Module>
      <ModuleHead title="By use" desc={`Your properties' value at your share in ${currency}, by what they're used for.`} />
      <div className={MODULE_BODY}>
        <HBars
          rows={uses.map((u) => ({
            key: u.use,
            label: PROPERTY_USE_LABELS[u.use],
            value: total > 0 ? (Math.max(u.value, 0) / total) * 100 : 0,
            figure: formatCompact(u.value),
            color: USE_COLORS[u.use],
            title: `${PROPERTY_USE_LABELS[u.use]} · ${u.count} ${u.count === 1 ? "property" : "properties"} · ${formatCurrency(u.value, currency, 0)}`,
          }))}
        />
      </div>
    </Module>
  );
}

/** No property yet (archived aside). */
function NoProperties({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 md:p-10 text-center space-y-3">
      <p className="text-lg font-black text-slate-900">No properties yet</p>
      <p className="text-[13px] text-slate-500 max-w-md mx-auto">
        Your home, a rental or a garage: what it&apos;s worth, the mortgage on it, the rent it brings in and what it costs, next to
        your investments and wallets.
      </p>
      <button type="button" onClick={onAdd} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors">
        <Plus className="h-4 w-4" /> Add a property
      </button>
    </section>
  );
}

function ArchivedList({ archived, onOpen }: { archived: Property[]; onOpen: (uuid: string) => void }) {
  if (archived.length === 0) return null;
  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm">
      <p className="px-6 pt-4 pb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <Archive className="h-3 w-3" /> Archived · left out of the totals
      </p>
      <ul className="divide-y divide-slate-100">
        {archived.map((p) => (
          <li key={p.uuid}>
            <button type="button" onClick={() => onOpen(p.uuid)} className="w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-slate-50 transition-colors">
              <span className="flex-1 min-w-0 text-[13px] font-bold text-slate-700 truncate">{p.name}</span>
              <span className="text-[13px] font-bold tabular-nums text-slate-500">{formatCurrency(p.figures.valueAtShare, p.currency, 0)}</span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

