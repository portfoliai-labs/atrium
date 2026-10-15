// components/dashboard/realEstate/RealEstateNode.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ChevronRight, Loader2, Plus } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useRealEstate, useRealEstateOverview, useRealEstateSummary } from "../../../context/RealEstateContext";
import { CATEGORICAL_PALETTE } from "../../../lib/chartColors";
import { formatCompact, formatCurrency } from "../../../lib/format";
import { PROPERTY_KIND_LABELS, PROPERTY_USE_LABELS } from "../../../lib/realEstate";
import { dayLabel, monthLabel, today } from "../../../lib/wallets";
import type { Property, PropertyUse, TaxList } from "../../../models/RealEstate";
import { Breadcrumb, type Crumb } from "../Breadcrumb";
import { PageHeader, type PageAction, type PageCounter, type PageFigure } from "../PageHeader";
import { Fig, Figs, MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { PreviewBadge } from "../../preview/PreviewKit";
import { RealEstatePortfolio, type RealEstatePreviewPage } from "../../preview/RealEstatePortfolio";
import { RealEstateTransactionDialog, type RealEstateEntryKind } from "./RealEstateTransactionForm";
import { ALL_PROPERTIES, RealEstateTransactions } from "./RealEstateTransactions";
import { RealEstateInsights } from "./RealEstateInsights";
import { PropertyPage } from "./PropertyPage";
import { RealEstateAlerts, alertsCounter, useAlertRules } from "./RealEstateAlerts";

// The real estate's pages: its own, a property's, and those its header leads to. Reports aren't
// in the API yet: a demo account's preview (components/preview/RealEstatePortfolio).
export type RealEstatePage = "home" | "property" | "insights" | "transactions" | "alerts" | RealEstatePreviewPage;
const PREVIEW_PAGES: RealEstatePreviewPage[] = ["reports"];

const VALUE_COLOR = "#C49A3C";

const USE_COLORS: Record<PropertyUse, string> = {
  primary_residence: "#2a78d6", second_home: "#4a3aa7", long_term_rental: "#1baf7a", short_term_rental: "#eb6834", vacant: "#94a3b8",
  free_loan: "#e87ba4", uninhabitable: "#a16207",
};

const pct = (v: number, digits = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
const toneOf = (v: number | null | undefined): "gain" | "loss" | undefined => (v == null || v === 0 ? undefined : v > 0 ? "gain" : "loss");

/**
 * REAL ESTATE NODE — the real estate in Wealth, built like All wallets' page. Its own page: a
 * header with what the properties are worth at the user's share, how that stands against what was
 * put in, and the year's figures (equity, debt, rent, cash flow), its activity (Transactions,
 * Insights) and the way to add to it; under it the value since the first purchase against what was
 * put in, the Composition of the properties (each opening its page, PropertyPage), the last 12
 * months' cash flow, and the archived properties. The figures across properties are in the user's
 * reference currency (the overview's); a property whose currency can't be converted today is
 * listed in its own but takes no share. New properties and their transactions are added from one
 * form (RealEstateTransactionForm): a property comes with its Purchase. Transactions can be every
 * property's or one's (`property`), and so can the Alerts (RealEstateAlerts). A demo account's are
 * sample data, read only, and it also has Reports, a preview. A property that's gone (deleted, an old link) opens the real
 * estate's own page.
 */
export function RealEstateNode({ page: requested, property: propertyUuid, rootTrail, onOpen }: {
  page: RealEstatePage;
  property?: string;
  rootTrail: Crumb[];
  onOpen: (page: RealEstatePage, property?: string) => void;
}) {
  const { properties, loading, error, sample, source, version } = useRealEstate();
  const property = propertyUuid ? properties.find((p) => p.uuid === propertyUuid) : undefined;
  const page: RealEstatePage = (!sample && PREVIEW_PAGES.includes(requested as RealEstatePreviewPage)) || (requested === "property" && !property)
    ? "home"
    : requested;
  const active = useMemo(() => properties.filter((p) => !p.archived), [properties]);
  const archived = useMemo(() => properties.filter((p) => p.archived), [properties]);
  const overview = useRealEstateOverview(!loading);
  // From the first purchase among the properties counted, monthly.
  const firstMonth = useMemo(() => active.map((p) => p.purchasedOn?.slice(0, 7)).filter((m): m is string => !!m).sort()[0], [active]);
  const summary = useRealEstateSummary(null, firstMonth, undefined, !loading && page === "home");
  const [entry, setEntry] = useState<RealEstateEntryKind | null>(null);
  const count = useTransactionTotal(source, version);
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

  if (page === "reports") {
    return <RealEstatePortfolio trail={rootTrail} page={page} onOpenHome={() => onOpen("home")} />;
  }

  const money = (v: number) => formatCurrency(v, currency, 0);
  const gain = overview && overview.invested > 0 ? ((overview.value - overview.invested) / overview.invested) * 100 : null;
  const figures: PageFigure[] = overview ? [
    { label: "Equity", value: money(overview.equity), sub: overview.loanToValuePct === null ? undefined : `Loan-to-value ${overview.loanToValuePct.toFixed(0)}%` },
    { label: "Mortgage debt", value: money(overview.residualDebt) },
    { label: "Income, 12 months", value: money(overview.yearlyIncome), sub: overview.grossYieldPct === null ? undefined : `${overview.grossYieldPct.toFixed(1)}% gross yield` },
    { label: "Net cash flow, 12 months", value: money(overview.yearlyNetCashFlow), tone: toneOf(overview.yearlyNetCashFlow), sub: "After expenses, taxes and mortgages" },
  ] : [];
  // One way in for everything: a purchase adds a property, anything else is one of theirs.
  const actions: PageAction[] = [{ label: "Add transaction", primary: true, onClick: addEntry }];
  const counters: PageCounter[] = [
    { key: "transactions", label: "transactions", count, onClick: () => onOpen("transactions") },
    { key: "insights", label: "insights", onClick: () => onOpen("insights") },
    // None while the API has no alerts.
    ...(alertRules === null ? [] : [alertsCounter(alertRules, () => onOpen("alerts"))]),
    ...(sample ? PREVIEW_PAGES.map((p) => ({ key: p, label: p, onClick: () => onOpen(p) })) : []),
  ];

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={rootTrail} current="Real estate" />
      <PageHeader
        eyebrow="Real estate"
        badge={sample ? <PreviewBadge label="Sample" /> : undefined}
        title="Real estate"
        value={overview === undefined ? null : overview ? money(overview.value) : "—"}
        change={gain === null ? null : { text: `${pct(gain)} on what was put in`, tone: toneOf(gain) }}
        note={sample ? "Sample data" : `${active.length} ${active.length === 1 ? "property" : "properties"}${overview ? ", at your share" : ""}`}
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
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6">
            <PropertiesComposition properties={active} currency={currency} onOpen={(uuid) => onOpen("property", uuid)} />
            <CashFlowModule summary={summary} />
          </div>
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
 * IRPEF): what they come to, what's been paid (the platforms' withholding included), what's left and
 * the next due day; then each property's, opening its page (where its taxes are worked out and
 * paid). Shown only when some property has them (one in Italy).
 */
function TaxesModule({ properties, onOpen }: { properties: Property[]; onOpen: (uuid: string) => void }) {
  const { source, version } = useRealEstate();
  const year = Number(today().slice(0, 4));
  const taxed = properties.some((p) => p.address.country === "IT");
  const [state, setState] = useState<{ version: number; list: TaxList | null } | null>(null);
  useEffect(() => {
    if (!taxed) return;
    let cancelled = false;
    source.taxes(null, year)
      .then((list) => { if (!cancelled) setState({ version, list }); })
      .catch(() => { if (!cancelled) setState({ version, list: null }); });
    return () => { cancelled = true; };
  }, [source, version, year, taxed]);
  if (!taxed) return null;
  const list = state?.version === version ? state.list : undefined;
  const byUuid = new Map(properties.map((p) => [p.uuid, p]));
  const taxes = list?.taxes.filter((t) => byUuid.has(t.propertyUuid)) ?? [];
  // In euro: the tax is Italy's.
  const money = (v: number) => formatCurrency(v, "EUR", 0);
  const owed = taxes.reduce((s, t) => s + t.amount, 0);
  const paid = taxes.reduce((s, t) => s + Math.min(t.paidAmount + t.withheldAmount, t.amount), 0);
  const next = taxes.flatMap((t) => t.instalments.filter((i) => !i.paid && i.amount > 0)).map((i) => i.dueOn).sort()[0];
  const provisional = taxes.some((t) => t.provisional && t.status === "computed");
  const missing = taxes.filter((t) => t.status === "not_computed").length;

  return (
    <Module>
      <ModuleHead
        title={`Taxes ${year}`}
        desc="IMU and the tax on rents this year, at your share. Open a property to see how they're worked out and record a payment."
        right={provisional ? <span className="px-2 py-0.5 rounded-full bg-amber-50 text-[10px] font-black uppercase tracking-wider text-amber-700">Estimate</span> : undefined}
      />
      <div className={`${MODULE_BODY} space-y-4`}>
        {list === undefined ? (
          <p className="text-[12.5px] text-[#a8a29e]">Loading…</p>
        ) : list === null ? (
          <p className="text-[12.5px] text-rose-600">Unable to work out the taxes right now.</p>
        ) : taxes.length === 0 ? (
          <p className="text-[12.5px] text-[#a8a29e]">No property tax this year.</p>
        ) : (
          <>
            <Figs>
              <Fig label="Owed" value={money(owed)} strong />
              <Fig label="Paid" value={money(paid)} tone={paid > 0 ? "gain" : undefined} />
              <Fig label="Left" value={money(Math.max(0, owed - paid))} sub={next ? `Next due ${dayLabel(next)}` : owed > 0 ? "All paid" : undefined} />
            </Figs>
            {missing > 0 && (
              <p className="text-[12px] font-semibold text-amber-700">
                {missing === 1 ? "One tax isn't" : `${missing} taxes aren't`} worked out: open the property to see what&apos;s missing.
              </p>
            )}
            <ul className="divide-y divide-[#EEE9DD]">
              {taxes.map((t) => {
                const p = byUuid.get(t.propertyUuid)!;
                const due = t.instalments.find((i) => !i.paid && i.amount > 0);
                const status = t.status === "exempt" ? "Exempt"
                  : t.status === "not_computed" ? (t.notComputed === "missing_details" ? "Details missing" : "Not worked out")
                  : !due ? "Paid"
                  : due.dueOn < today() ? `Overdue since ${dayLabel(due.dueOn)}`
                  : `Due by ${dayLabel(due.dueOn)}`;
                const tone = t.status === "not_computed" ? "text-amber-700" : !due ? "text-emerald-600" : due.dueOn < today() ? "text-rose-600" : "text-slate-500";
                return (
                  <li key={`${t.propertyUuid}:${t.kind}`}>
                    <button type="button" onClick={() => onOpen(t.propertyUuid)} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-[#F7F5EF] rounded-lg px-1.5 transition-colors">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold text-slate-800">{p.name} <span className="font-semibold text-slate-400">· {t.name}</span></span>
                        <span className={`block text-[11.5px] font-semibold ${tone}`}>{status}</span>
                      </span>
                      <span className="font-bold tabular-nums text-slate-900">{t.status === "computed" ? money(t.amount) : "—"}</span>
                      <ChevronRight className="h-4 w-4 text-[#a8a29e]" />
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

/** How many transactions there are across the properties: null while loading. */
function useTransactionTotal(source: ReturnType<typeof useRealEstate>["source"], version: number) {
  const [state, setState] = useState<{ version: number; total: number | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    source.transactions(null, { limit: 1 })
      .then((list) => { if (!cancelled) setState({ version, total: list.total }); })
      .catch(() => { if (!cancelled) setState({ version, total: null }); });
    return () => { cancelled = true; };
  }, [source, version]);
  return state?.version === version ? state.total : null;
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
          <p className="text-[12.5px] text-[#a8a29e]">Loading…</p>
        ) : summary === null || data.length === 0 ? (
          <p className="text-[12.5px] text-[#a8a29e]">Can&apos;t be added up right now: an exchange rate is missing.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 240 }}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false} minTickGap={40} />
              <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false} width={48} domain={["auto", "auto"]} />
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
          <p className="text-[12.5px] text-[#a8a29e]">Loading…</p>
        ) : months.length === 0 ? (
          <p className="text-[12.5px] text-[#a8a29e]">Can&apos;t be added up right now: an exchange rate is missing.</p>
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
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v, name) => [formatCurrency(Math.abs(Number(v)), currency, 0), name === "income" ? "In" : "Out"]} contentStyle={{ borderRadius: 12, border: "1px solid #E0DACC", fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="#a8a29e" />
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

interface Item {
  key: string;
  label: string;
  sub: string;
  value: number;
  currency: string;
  // Counted in the donut and the shares: in the total's currency, and worth something.
  counted: boolean;
  color: string;
  onOpen?: () => void;
}

/**
 * The properties (not archived) on a donut and in a list, by property or by use, each at the user's
 * share: in the reference currency where it could be converted today (figures.reference), otherwise
 * in its own and out of the shares.
 */
function PropertiesComposition({ properties, currency, onOpen }: { properties: Property[]; currency: string; onOpen: (uuid: string) => void }) {
  const [breakdown, setBreakdown] = useState<"property" | "use">("property");
  const [hovered, setHovered] = useState<string | null>(null);

  const items = useMemo((): Item[] => {
    const valued = properties.map((p, i) => {
      const ref = p.figures.reference;
      const inTotal = ref?.currency === currency ? ref.valueAtShare : p.currency === currency ? p.figures.valueAtShare : null;
      return { p, color: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length], inTotal };
    });
    if (breakdown === "use") {
      const uses = [...new Set(valued.map(({ p }) => p.use))];
      return uses.map((use) => {
        const own = valued.filter(({ p, inTotal }) => p.use === use && inTotal !== null);
        const value = own.reduce((s, { inTotal }) => s + inTotal!, 0);
        const count = valued.filter(({ p }) => p.use === use).length;
        return { key: use, label: PROPERTY_USE_LABELS[use], sub: `${count} ${count === 1 ? "property" : "properties"}`, value, currency, counted: value > 0, color: USE_COLORS[use] };
      });
    }
    return valued.map(({ p, color, inTotal }) => ({
      key: p.uuid,
      label: p.name,
      sub: [PROPERTY_KIND_LABELS[p.kind], p.address.locality, p.soldOn ? "Sold" : PROPERTY_USE_LABELS[p.use], inTotal === null ? `in ${p.currency}, not in the total` : null].filter(Boolean).join(" · "),
      value: inTotal ?? p.figures.valueAtShare,
      currency: inTotal === null ? p.currency : currency,
      counted: inTotal !== null && inTotal > 0,
      color,
      onOpen: () => onOpen(p.uuid),
    }));
  }, [breakdown, properties, currency, onOpen]);
  const sorted = [...items].sort((a, b) => Number(b.counted) - Number(a.counted) || b.value - a.value);
  const slices = sorted.filter((i) => i.counted);
  const total = slices.reduce((s, i) => s + i.value, 0);
  const share = (i: Item) => (i.counted && total > 0 ? (i.value / total) * 100 : null);
  const focus = sorted.find((i) => i.key === hovered);

  return (
    <Module>
      <ModuleHead
        title="Composition"
        desc={breakdown === "property" ? "Your properties' value at your share. Open one for its page." : "Your properties' value at your share, by what they're used for."}
        right={
          <div role="group" aria-label="Breakdown" className="flex flex-wrap gap-1.5">
            {(["property", "use"] as const).map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={b === breakdown}
                onClick={() => { setBreakdown(b); setHovered(null); }}
                className={`px-2.5 py-1 rounded-full border text-[11.5px] font-semibold transition-colors ${
                  b === breakdown ? "bg-[#1c1917] border-[#1c1917] text-white" : "border-[#E0DACC] text-[#78716c] hover:text-[#1c1917]"
                }`}
              >
                {b === "property" ? "By property" : "By use"}
              </button>
            ))}
          </div>
        }
      />
      <div className={MODULE_BODY}>
        <div className="grid grid-cols-1 md:grid-cols-[170px_minmax(0,1fr)] gap-[22px] items-center">
          <div className="relative w-full max-w-[170px] aspect-square mx-auto">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 170, height: 170 }}>
              <PieChart>
                <Pie
                  data={slices.length ? slices : [{ key: "none", label: "", value: 1, color: "#EEE9DD" }]}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="67%"
                  outerRadius="98%"
                  paddingAngle={slices.length > 1 ? 1.4 : 0}
                  stroke="none"
                  isAnimationActive={false}
                  onMouseLeave={() => setHovered(null)}
                >
                  {(slices.length ? slices : [{ key: "none", color: "#EEE9DD" } as Item]).map((i) => (
                    <Cell key={i.key} fill={i.color} opacity={hovered && hovered !== i.key ? 0.25 : 1} cursor={i.onOpen ? "pointer" : "default"} onMouseEnter={() => i.key !== "none" && setHovered(i.key)} onClick={i.onOpen} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-[20%] text-center">
              <span className="text-lg font-bold text-[#1c1917] tabular-nums">
                {focus && share(focus) !== null ? `${share(focus)!.toFixed(1)}%` : formatCompact(total)}
              </span>
              <span className="text-[10.5px] text-[#78716c] truncate max-w-full">{focus ? focus.label : "total"}</span>
            </div>
          </div>
          <ul className="min-w-0">
            {sorted.map((i, index) => {
              const s = share(i);
              const content = (
                <>
                  <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: i.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#1c1917]">{i.label}</span>
                    <span className="block truncate text-[11.5px] font-medium text-[#78716c]">{i.sub}</span>
                  </span>
                  <span className="shrink-0 pl-2 text-right font-bold tabular-nums text-[#1c1917]">{formatCurrency(i.value, i.currency, 0)}</span>
                  <span className="hidden sm:block shrink-0 min-w-[56px] text-right text-xs text-[#78716c] tabular-nums">{s === null ? "—" : `${s.toFixed(1)}%`}</span>
                  <span className="w-[18px] shrink-0">{i.onOpen && <ChevronRight className="h-4 w-4 text-[#a8a29e]" />}</span>
                </>
              );
              const row = `w-full flex items-center gap-3 px-2.5 py-[11px] rounded-[14px] text-left transition-colors ${index < sorted.length - 1 ? "border-b border-[#EEE9DD]" : ""} ${hovered === i.key ? "bg-[#F7F5EF]" : ""}`;
              return (
                <li key={i.key} onMouseEnter={() => setHovered(i.key)} onMouseLeave={() => setHovered(null)}>
                  {i.onOpen ? (
                    <button type="button" onClick={i.onOpen} className={`${row} hover:bg-[#F7F5EF] outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40`}>{content}</button>
                  ) : (
                    <div className={row}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
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

