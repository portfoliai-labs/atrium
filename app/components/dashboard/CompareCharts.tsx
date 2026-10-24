// components/dashboard/CompareCharts.tsx
"use client";

import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { toChartPoints } from "../../lib/series";
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
        <div className="p-6 md:p-7 h-72">
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
      )}
    </Module>
  );
}

// The comparison's windows, shortest first, as the horizons name them; a short label for an axis.
const WINDOWS: { period: string; short: string }[] = [
  { period: "1 Month", short: "1M" }, { period: "6 Months", short: "6M" }, { period: "1 Year", short: "1Y" },
  { period: "3 Years", short: "3Y" }, { period: "5 Years", short: "5Y" }, { period: "10 Years", short: "10Y" },
];
const horizonIn = (e: PortfolioComparisonEntry, period: string) => e.performance?.horizons.find((h) => h.period === period);
const GRID_COLOR = "#EEE9DD";
const ZERO_COLOR = "#cbd5e1";

/**
 * RISK & RETURN — each portfolio a dot: how much it returned against how much it swung, over one
 * window they all have (each window's own figures, so a younger portfolio isn't measured over a
 * shorter stretch than an older one). The window is picked among those every portfolio reaches,
 * the longest first. Up and to the left is better: more return for less swing.
 */
export function RiskReturnModule({ entries, colorOf }: { entries: PortfolioComparisonEntry[]; colorOf: (uuid: string) => string }) {
  const shared = useMemo(
    () => WINDOWS.filter((w) => entries.length > 0 && entries.every((e) => {
      const h = horizonIn(e, w.period);
      return h?.totalReturnPct != null && h.volatilityPct != null;
    })),
    [entries],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const window = shared.find((w) => w.period === picked) ?? shared.at(-1);
  const points = window
    ? entries.map((e) => {
        const h = horizonIn(e, window.period)!;
        return { entry: e, x: h.volatilityPct!, y: h.totalReturnPct!, name: e.portfolio.name };
      })
    : [];

  return (
    <Module className="h-full">
      <div className="flex flex-wrap items-start justify-between gap-3 pr-6 md:pr-7">
        <ModuleHead eyebrow="Risk" title="Risk and return" desc="Each portfolio's return against its volatility over the same window: up and to the left is more return for less swing." />
        {shared.length > 1 && (
          <div role="radiogroup" aria-label="Window" className="flex gap-1 pt-4 md:pt-5">
            {shared.map((w) => (
              <button
                key={w.period}
                type="button"
                role="radio"
                aria-checked={w.period === window?.period}
                onClick={() => setPicked(w.period)}
                className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition-colors ${
                  w.period === window?.period ? "bg-[#1c1917] text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {w.short}
              </button>
            ))}
          </div>
        )}
      </div>
      {!window ? (
        <p className="text-sm text-slate-400 p-6 md:p-7">Needs a window every portfolio reaches: a month of history each, at least.</p>
      ) : (
        <div className="p-6 md:p-7 pt-2 h-72">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 288 }}>
            <ScatterChart margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid stroke={GRID_COLOR} strokeDasharray="0" />
              <XAxis
                type="number" dataKey="x" name="Volatility" unit="%" domain={[0, "auto"]}
                tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false}
                label={{ value: "Volatility", position: "insideBottomRight", offset: -4, fontSize: 11, fill: AXIS_TICK_COLOR }}
              />
              <YAxis
                type="number" dataKey="y" name="Return" tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} width={56}
              />
              <ZAxis range={[110, 110]} />
              <ReferenceLine y={0} stroke={ZERO_COLOR} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: ZERO_COLOR }}
                contentStyle={TOOLTIP_STYLE}
                content={({ active, payload }) => {
                  const p = active ? (payload?.[0]?.payload as (typeof points)[number] | undefined) : undefined;
                  if (!p) return null;
                  return (
                    <div style={TOOLTIP_STYLE} className="bg-white border px-3 py-2 shadow-sm">
                      <p className="font-bold text-slate-900">{p.name}</p>
                      <p className="tabular-nums">Return {formatPct(p.y)} · volatility {p.x.toFixed(2)}%</p>
                      <p className="text-slate-500">Last {window.period.toLowerCase()}</p>
                    </div>
                  );
                }}
              />
              {points.map((p) => (
                <Scatter
                  key={p.entry.portfolio.uuid}
                  data={[p]}
                  fill={colorOf(p.entry.portfolio.uuid)}
                  fillOpacity={p.entry.portfolio.isAggregate ? 0.6 : 1}
                  stroke="#fff"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {/* Named beside the dot when there are few; the cards above say whose colour is whose. */}
                  {points.length <= 5 && <LabelList dataKey="name" position="right" offset={10} style={{ fontSize: 11, fill: "#475569", fontWeight: 600 }} />}
                </Scatter>
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </Module>
  );
}

/**
 * RETURNS BY WINDOW — for each window, one bar per portfolio: its return over it, the same
 * stretch of calendar for all. A window shows once one of them reaches it; a portfolio that
 * doesn't has no bar there.
 */
export function ReturnsByWindowModule({ entries, colorOf }: { entries: PortfolioComparisonEntry[]; colorOf: (uuid: string) => string }) {
  const rows = useMemo(
    () => WINDOWS
      .filter((w) => entries.some((e) => horizonIn(e, w.period)?.totalReturnPct != null))
      .map((w) => {
        const row: Record<string, string | number | null> = { window: w.short, period: w.period };
        for (const e of entries) row[e.portfolio.uuid] = horizonIn(e, w.period)?.totalReturnPct ?? null;
        return row;
      }),
    [entries],
  );
  const nameOf = (uuid: string) => entries.find((e) => e.portfolio.uuid === uuid)?.portfolio.name ?? uuid;

  return (
    <Module className="h-full">
      <ModuleHead eyebrow="Performance" title="Returns by window" desc="Each portfolio's return over the same stretch of calendar, window by window." />
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400 p-6 md:p-7">Not enough history yet to chart.</p>
      ) : (
        <div className="p-6 md:p-7 pt-2 h-72">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 288 }}>
            <BarChart data={rows} margin={{ top: 12, right: 10, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="window" tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} width={56} />
              <ReferenceLine y={0} stroke={ZERO_COLOR} />
              <Tooltip
                cursor={{ fill: "#F7F5EF" }}
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(_, payload) => `Last ${String(payload?.[0]?.payload?.period ?? "").toLowerCase()}`}
                formatter={(value, name) => [value === null ? "—" : formatPct(Number(value)), nameOf(String(name))]}
              />
              {entries.map((e) => (
                <Bar
                  key={e.portfolio.uuid}
                  dataKey={e.portfolio.uuid}
                  fill={colorOf(e.portfolio.uuid)}
                  fillOpacity={e.portfolio.isAggregate ? 0.6 : 1}
                  radius={[3, 3, 3, 3]}
                  maxBarSize={18}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Module>
  );
}

/**
 * ALLOCATION — for each asset class, one bar per portfolio showing its weight there, on one axis
 * from 0 to 100%. Grouped by asset class rather than one stacked bar per portfolio, so colour
 * keeps meaning "which portfolio" everywhere on the page instead of switching to "which asset
 * class" here. The classes run from the one weighing most in any portfolio down; the chart grows
 * with them and with the portfolios, so the bars keep their thickness.
 */
export function AllocationModule({ entries, colorOf }: { entries: PortfolioComparisonEntry[]; colorOf: (uuid: string) => string }) {
  const withAllocation = useMemo(() => entries.filter((e) => e.allocation && e.allocation.length > 0), [entries]);
  const rows = useMemo(() => {
    const maxWeight = new Map<string, number>();
    for (const e of withAllocation) {
      for (const a of e.allocation!) maxWeight.set(a.assetClass, Math.max(maxWeight.get(a.assetClass) ?? 0, a.weightPct));
    }
    return [...maxWeight.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => {
      const row: Record<string, string | number> = { label: assetClassLabel(c) };
      for (const e of withAllocation) row[e.portfolio.uuid] = e.allocation!.find((a) => a.assetClass === c)?.weightPct ?? 0;
      return row;
    });
  }, [withAllocation]);
  const nameOf = (uuid: string) => withAllocation.find((e) => e.portfolio.uuid === uuid)?.portfolio.name ?? uuid;
  // Each class a group of 12px bars, 2px apart, with room between the groups.
  const height = rows.length * (withAllocation.length * 14 + 22) + 32;

  return (
    <Module className="h-full">
      <ModuleHead eyebrow="Composition" title="Allocation by asset class" desc="Share of each portfolio's market value today." />
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400 p-6 md:p-7">Not available yet.</p>
      ) : (
        <div className="p-6 md:p-7 pt-2" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height }}>
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barGap={2} barCategoryGap={10}>
              <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: "#1c1917", fontWeight: 700 }} axisLine={false} tickLine={false} width={96} />
              <Tooltip
                cursor={{ fill: "#F7F5EF" }}
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, name) => [`${Number(value).toFixed(1)}%`, nameOf(String(name))]}
              />
              {withAllocation.map((e) => (
                <Bar
                  key={e.portfolio.uuid}
                  dataKey={e.portfolio.uuid}
                  fill={colorOf(e.portfolio.uuid)}
                  fillOpacity={e.portfolio.isAggregate ? 0.6 : 1}
                  radius={[0, 3, 3, 0]}
                  barSize={12}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Module>
  );
}
