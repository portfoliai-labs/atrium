// components/dashboard/CompareCharts.tsx
"use client";

import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { toChartPoints } from "../../lib/series";
import { VirtualBadge } from "./BacktestMarks";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";

// Compare's pieces under its table (see ComparisonView), and what the table shares with them.

const AXIS_TICK_COLOR = "#64748b";
const TOOLTIP_STYLE: React.CSSProperties = { borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12, color: "#334155" };

const ASSET_CLASS_LABELS: Record<string, string> = {
  EQUITY: "Stocks", ETF: "ETFs", MUTUALFUND: "Funds", CRYPTOCURRENCY: "Crypto", BOND: "Bonds", UNKNOWN: "Other", REAL_ESTATE: "Real estate",
};
const assetClassLabel = (c: string) => ASSET_CLASS_LABELS[c] ?? c.charAt(0) + c.slice(1).toLowerCase();

export const formatPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
const monthShortYearLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
const fullDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** One of Compare's white modules; `className` sizes it within a grid (h-full, flex-1…). */
export function Module({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-[1.75rem] border border-[#EEE9DD] overflow-hidden ${className}`}>
      {children}
    </section>
  );
}

// The same small heading as the portfolio page's modules (see ModuleHead in PerformanceSection):
// the title in small capitals, what it shows on hovering it. (`eyebrow` is no longer drawn.)
export function ModuleHead({ title, desc }: { eyebrow?: string; title: string; desc?: string }) {
  return (
    <div className="px-6 md:px-7 pt-5 md:pt-6 pb-3">
      <h2 title={desc} className="text-[10px] font-black uppercase tracking-[0.14em] text-[#78716c]">{title}</h2>
    </div>
  );
}

/** A portfolio's line in a legend: its colour, dashed for the aggregate (as its chart line is). */
export function Swatch({ color, dashed = false }: { color: string; dashed?: boolean }) {
  return <span className="w-4 shrink-0 border-t-2" style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} />;
}

/**
 * CUMULATIVE RETURNS — one line per portfolio, each from its own first day, so the lines start
 * at different dates. Merged on date; a portfolio with no point on a date just has a gap there
 * that connectNulls bridges.
 */
export function CumulativeReturnsModule({ entries, colorOf }: { entries: PortfolioComparisonEntry[]; colorOf: (uuid: string) => string }) {
  const withSeries = useMemo(() => entries.filter((e) => e.performance?.cumulativeReturnPct), [entries]);
  const data = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const e of withSeries) {
      for (const p of toChartPoints(e.performance!.cumulativeReturnPct!, 250)) {
        const row = byDate.get(p.date) ?? { date: p.date };
        row[e.portfolio.uuid] = p.value;
        byDate.set(p.date, row);
      }
    }
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [withSeries]);

  return (
    <Module>
      <ModuleHead
        eyebrow="Performance"
        title="Cumulative return"
        desc="Time-weighted growth since each portfolio's first transaction."
      />
      {data.length < 2 ? (
        <p className="text-sm text-slate-400 p-6 md:p-7">Not enough history yet to chart.</p>
      ) : (
        <>
          <div className="p-6 md:p-7 pb-2 h-72">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 288 }}>
              <LineChart data={data} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tickFormatter={monthShortYearLabel} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} minTickGap={40} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  labelFormatter={(label) => fullDateLabel(label as string)}
                  formatter={(value, name) => [formatPct(Number(value)), entries.find((e) => e.portfolio.uuid === name)?.portfolio.name ?? String(name)]}
                  contentStyle={TOOLTIP_STYLE}
                />
                {withSeries.map((e) => (
                  <Line
                    key={e.portfolio.uuid}
                    type="monotone"
                    dataKey={e.portfolio.uuid}
                    stroke={colorOf(e.portfolio.uuid)}
                    strokeWidth={2}
                    strokeDasharray={e.portfolio.isAggregate ? "5 4" : undefined}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* Legend with each line's latest value as its direct label. */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 px-6 md:px-7 pb-6">
            {withSeries.map((e) => {
              const values = e.performance!.cumulativeReturnPct!.values;
              const last = values[values.length - 1];
              return (
                <span key={e.portfolio.uuid} className="flex items-center gap-2 text-xs">
                  <Swatch color={colorOf(e.portfolio.uuid)} dashed={e.portfolio.isAggregate} />
                  <span className="font-bold text-slate-700">{e.portfolio.name}</span>
                  {e.portfolio.isVirtual && <VirtualBadge portfolio={e.portfolio} />}
                  {last !== undefined && <span className="text-slate-500 tabular-nums">{formatPct(last)}</span>}
                </span>
              );
            })}
          </div>
        </>
      )}
    </Module>
  );
}

/**
 * ALLOCATION — for each asset class, one bar per portfolio showing its weight there. Grouped
 * by asset class rather than one stacked bar per portfolio, so colour keeps meaning "which
 * portfolio" everywhere on the page instead of switching to "which asset class" here.
 */
export function AllocationModule({ entries, colorOf }: { entries: PortfolioComparisonEntry[]; colorOf: (uuid: string) => string }) {
  const withAllocation = useMemo(() => entries.filter((e) => e.allocation && e.allocation.length > 0), [entries]);
  const classes = useMemo(() => {
    const maxWeight = new Map<string, number>();
    for (const e of withAllocation) {
      for (const a of e.allocation!) maxWeight.set(a.assetClass, Math.max(maxWeight.get(a.assetClass) ?? 0, a.weightPct));
    }
    return [...maxWeight.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [withAllocation]);

  return (
    <Module>
      <ModuleHead eyebrow="Composition" title="Allocation by asset class" desc="Share of each portfolio's market value today." />
      {classes.length === 0 ? (
        <p className="text-sm text-slate-400 p-6 md:p-7">Not available yet.</p>
      ) : (
        <div className="p-6 md:p-7 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
          {classes.map((c) => (
            <div key={c}>
              <h3 className="text-sm font-black text-slate-900 mb-2">{assetClassLabel(c)}</h3>
              <div className="space-y-1.5">
                {withAllocation.map((e) => {
                  const weight = e.allocation!.find((a) => a.assetClass === c)?.weightPct ?? 0;
                  return (
                    <div key={e.portfolio.uuid} className="flex items-center gap-3" title={`${e.portfolio.name}: ${weight.toFixed(1)}%`}>
                      <span className="w-24 shrink-0 truncate text-xs font-semibold text-slate-500">{e.portfolio.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(weight, 100)}%`, background: colorOf(e.portfolio.uuid), opacity: e.portfolio.isAggregate ? 0.6 : 1 }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-xs font-bold text-slate-600 tabular-nums">{weight.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Module>
  );
}
