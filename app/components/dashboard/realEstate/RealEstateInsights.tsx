// components/dashboard/realEstate/RealEstateInsights.tsx
"use client";

import { useMemo } from "react";
import { useRealEstate } from "../../../context/RealEstateContext";
import { CATEGORICAL_PALETTE } from "../../../lib/chartColors";
import { formatCurrency } from "../../../lib/format";
import { PROPERTY_KIND_LABELS, PROPERTY_USE_LABELS } from "../../../lib/realEstate";
import type { Property } from "../../../models/RealEstate";
import { DataTable, type DataColumn } from "../ExploreView";
import { HBars, MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { RealEstateMarketPreview } from "../../preview/RealEstatePortfolio";

const USE_STYLE: Record<Property["use"], string> = {
  primary_residence: "bg-blue-50 text-blue-700",
  second_home: "bg-indigo-50 text-indigo-700",
  long_term_rental: "bg-emerald-50 text-emerald-700",
  short_term_rental: "bg-orange-50 text-orange-700",
  vacant: "bg-slate-100 text-slate-500",
};

const signedPct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;

/**
 * REAL ESTATE INSIGHTS — the properties side by side: a table of each one's figures (value at the
 * user's share, gain on what was put in, the last 12 months' income and yield, debt and equity),
 * each opening its page; then where the value sits, by town. A property's amounts are in its own
 * currency; the split by town is in the reference one, leaving out a property it can't convert
 * today. A demo account also sees, below, the market and short-stay analyses (a preview).
 */
export function RealEstateInsights({ currency, onOpenProperty }: { currency: string; onOpenProperty: (uuid: string) => void }) {
  const { properties, sample } = useRealEstate();
  const active = useMemo(() => properties.filter((p) => !p.archived), [properties]);

  const columns: DataColumn<Property>[] = [
    {
      key: "name", label: "Property", sortValue: (p) => p.name, grow: true,
      render: (p) => (
        <button type="button" onClick={() => onOpenProperty(p.uuid)} className="text-left group min-w-44">
          <span className="font-bold text-slate-900 group-hover:text-[#C49A3C] transition-colors">{p.name}</span>
          <span className="block text-[11px] text-slate-400 font-semibold">{PROPERTY_KIND_LABELS[p.kind]} · {p.address.locality}</span>
        </button>
      ),
    },
    { key: "sqm", label: "m²", align: "right", sortValue: (p) => p.surfaceSqm, render: (p) => p.surfaceSqm ?? "—" },
    {
      key: "value", label: "Value", align: "right", sortValue: (p) => p.figures.reference?.valueAtShare ?? p.figures.valueAtShare,
      render: (p) => <span className="font-bold text-slate-900">{formatCurrency(p.figures.valueAtShare, p.currency, 0)}</span>,
    },
    {
      key: "gain", label: "Gain", align: "right",
      sortValue: (p) => (p.figures.invested > 0 ? p.figures.valueAtShare / p.figures.invested : null),
      render: (p) => {
        if (p.figures.invested <= 0 || p.soldOn) return "—";
        const v = (p.figures.valueAtShare / p.figures.invested - 1) * 100;
        return <span className={`font-bold ${v >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{signedPct(v)}</span>;
      },
    },
    { key: "income", label: "Income / yr", align: "right", sortValue: (p) => p.figures.yearlyIncome, render: (p) => formatCurrency(p.figures.yearlyIncome, p.currency, 0) },
    { key: "yield", label: "Gross yield", align: "right", sortValue: (p) => p.figures.grossYieldPct, render: (p) => (p.figures.grossYieldPct === null ? "—" : `${p.figures.grossYieldPct.toFixed(1)}%`) },
    {
      key: "cash", label: "Net cash / yr", align: "right", sortValue: (p) => p.figures.yearlyNetCashFlow,
      render: (p) => <span className={p.figures.yearlyNetCashFlow < 0 ? "text-rose-600 font-bold" : ""}>{formatCurrency(p.figures.yearlyNetCashFlow, p.currency, 0)}</span>,
    },
    { key: "debt", label: "Mortgage", align: "right", sortValue: (p) => p.figures.residualDebt, render: (p) => (p.figures.residualDebt > 0 ? formatCurrency(p.figures.residualDebt, p.currency, 0) : "—") },
    { key: "ltv", label: "LTV", align: "right", sortValue: (p) => p.figures.loanToValuePct, render: (p) => (p.figures.loanToValuePct ? `${p.figures.loanToValuePct.toFixed(0)}%` : "—") },
    {
      key: "use", label: "Use", sortValue: (p) => p.use,
      render: (p) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${USE_STYLE[p.use]}`}>
          {p.soldOn ? "Sold" : PROPERTY_USE_LABELS[p.use]}
        </span>
      ),
    },
  ];

  // By town, in the reference currency: what can't be converted today is left out.
  const byTown = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of active) {
      const ref = p.figures.reference;
      const value = ref?.currency === currency ? ref.valueAtShare : p.currency === currency ? p.figures.valueAtShare : null;
      if (value === null || value <= 0) continue;
      map.set(p.address.locality, (map.get(p.address.locality) ?? 0) + value);
    }
    return [...map].map(([town, value]) => ({ town, value })).sort((a, b) => b.value - a.value);
  }, [active, currency]);
  const townTotal = byTown.reduce((s, t) => s + t.value, 0);

  return (
    <>
      <Module>
        <ModuleHead title="Properties" desc="Each one's figures in its own currency, at your share. Open one for its page." />
        <div className="pb-2">
          {active.length === 0
            ? <p className={`${MODULE_BODY} text-[12.5px] text-[#a8a29e]`}>No properties yet.</p>
            : <DataTable columns={columns} rows={active} rowKey={(p) => p.uuid} initialSort={{ key: "value", desc: true }} />}
        </div>
      </Module>
      {byTown.length > 0 && (
        <Module>
          <ModuleHead title="Where the value sits" desc={`Your share of each town's properties, in ${currency}.`} />
          <div className={MODULE_BODY}>
            <HBars
              max={100}
              rows={byTown.map((t, i) => ({
                key: t.town,
                label: t.town,
                value: (t.value / townTotal) * 100,
                figure: `${((t.value / townTotal) * 100).toFixed(0)}%`,
                color: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length],
                title: formatCurrency(t.value, currency, 0),
              }))}
            />
          </div>
        </Module>
      )}
      {sample && <RealEstateMarketPreview />}
    </>
  );
}
