"use client";

import {
  Area, AreaChart, Bar, BarChart, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { CATEGORICAL_PALETTE } from "../../../lib/chartColors";
import { formatCompact, formatCurrency } from "../../../lib/format";
import type { ChartBlock, MessageBlock, TableBlock } from "../../../models/Conversation";
import { AXIS_TICK, TOOLTIP_STYLE } from "../../preview/PreviewKit";
import { Markdown } from "./Markdown";

const FALLBACK_COLOR = "#94a3b8";
const colorOf = (i: number) => CATEGORICAL_PALETTE[i] ?? FALLBACK_COLOR;

/**
 * A message's blocks, in order: an answer's text as markdown, a person's as the plain text it is;
 * charts and tables. Every figure in them is the user's own data, shown as it is: a missing value
 * is a gap or "—", never 0.
 */
export function MessageBlocks({ blocks, markdown }: { blocks: MessageBlock[]; markdown: boolean }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        if (block.type === "text") {
          return markdown
            ? <Markdown key={i} text={block.text} />
            : <p key={i} className="text-sm whitespace-pre-line wrap-break-word">{block.text}</p>;
        }
        if (block.type === "chart") return <AnswerChart key={i} chart={block} />;
        if (block.type === "table") return <AnswerTable key={i} table={block} />;
        return null;
      })}
    </div>
  );
}

/** A value in its unit: a currency's code, "%", or none. Null is "—". */
export function formatValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (unit === "%") return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  if (/^[A-Z]{3}$/.test(unit)) return formatCurrency(value, unit);
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function Figure({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <figure className="rounded-2xl border border-[rgba(196,154,60,0.2)] bg-white">
      {title && <figcaption className="px-4 pt-3 text-sm font-bold text-[#1c1917]">{title}</figcaption>}
      {children}
    </figure>
  );
}

// A chart's series by unit: one axis can't hold a currency and a percentage, so each unit is a
// panel of its own (its own axis), under the one title, in the order the units first come. Each
// series keeps its colour (by its place in the chart).
function AnswerChart({ chart }: { chart: ChartBlock }) {
  if (chart.chartType === "pie") return <AnswerPie chart={chart} />;
  const byUnit = new Map<string, number[]>();
  (chart.series ?? []).forEach((s, j) => byUnit.set(s.unit, [...(byUnit.get(s.unit) ?? []), j]));
  const groups = [...byUnit.entries()];
  return (
    <Figure title={chart.title}>
      {groups.length <= 1 ? (
        <ChartPanel chart={chart} indexes={groups[0]?.[1] ?? []} />
      ) : (
        groups.map(([unit, indexes]) => (
          <div key={unit} className="border-t first:border-t-0 border-[rgba(196,154,60,0.15)]">
            <p className="px-4 pt-3 text-[11px] font-bold uppercase tracking-wide text-[#78716c]">{unitName(unit)}</p>
            <ChartPanel chart={chart} indexes={indexes} />
          </div>
        ))
      )}
    </Figure>
  );
}

function unitName(unit: string): string {
  if (unit === "%") return "In %";
  return unit ? `In ${unit}` : "Values";
}

// The chart's series at `indexes` (all of one unit) on one axis.
function ChartPanel({ chart, indexes }: { chart: ChartBlock; indexes: number[] }) {
  const series = indexes.map((j) => ({ ...chart.series[j], j }));
  const x = chart.x ?? [];
  const unit = series[0]?.unit ?? "";

  // One row per x, a key per series: s0, s1… by the series' place in the chart (labels may
  // repeat or hold any character).
  const data = x.map((label, i) => Object.fromEntries([["label", label], ...series.map((s) => [`s${s.j}`, s.values[i] ?? null])]));
  const tick = (v: unknown) => `${formatCompact(Number(v))}${unit === "%" ? "%" : ""}`;
  const tooltip = (
    <Tooltip
      contentStyle={TOOLTIP_STYLE}
      formatter={(value, name) => [formatValue(value == null ? null : Number(value), unit), name]}
    />
  );
  const axes = (
    <>
      <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={12} />
      <YAxis tickFormatter={tick} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
    </>
  );
  const legend = series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null;
  const margin = { top: 8, right: 8, left: 0, bottom: 0 };

  let body: React.ReactElement;
  if (chart.chartType === "line") {
    body = (
      <LineChart data={data} margin={margin}>
        {axes}{tooltip}{legend}
        {series.map((s) => (
          <Line key={s.j} dataKey={`s${s.j}`} name={s.label} stroke={colorOf(s.j)} strokeWidth={2} dot={x.length <= 24} connectNulls={false} isAnimationActive={false} />
        ))}
      </LineChart>
    );
  } else if (chart.chartType === "area") {
    body = (
      <AreaChart data={data} margin={margin}>
        {axes}{tooltip}{legend}
        {series.map((s) => (
          <Area key={s.j} dataKey={`s${s.j}`} name={s.label} stroke={colorOf(s.j)} fill={colorOf(s.j)} fillOpacity={0.15} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
        ))}
      </AreaChart>
    );
  } else {
    const stacked = chart.chartType === "stacked_bar";
    body = (
      <BarChart data={data} margin={margin} stackOffset={stacked ? "sign" : undefined}>
        {axes}{tooltip}{legend}
        {series.map((s) => (
          <Bar key={s.j} dataKey={`s${s.j}`} name={s.label} fill={colorOf(s.j)} stackId={stacked ? "stack" : undefined} maxBarSize={28} isAnimationActive={false} />
        ))}
      </BarChart>
    );
  }

  return (
    <div className="h-64 p-3">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 240 }}>
        {body}
      </ResponsiveContainer>
    </div>
  );
}

// A pie per series (one, mostly), each slice's value listed beside it: a missing one as "—", not
// drawn. A pie can't show a value at or below zero: listed, not drawn either.
function AnswerPie({ chart }: { chart: ChartBlock }) {
  const x = chart.x ?? [];
  return (
    <Figure title={chart.title}>
      {(chart.series ?? []).map((s, j) => {
        const slices = x.map((label, i) => ({ label, value: s.values[i] ?? null, color: colorOf(i) }));
        return (
          <div key={j} className="grid sm:grid-cols-[12rem_1fr] gap-3 items-center p-3">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 192, height: 192 }}>
                <PieChart>
                  <Pie
                    data={slices.filter((d) => d.value !== null && d.value > 0)}
                    dataKey="value"
                    nameKey="label"
                    innerRadius="55%"
                    outerRadius="90%"
                    isAnimationActive={false}
                  >
                    {slices.filter((d) => d.value !== null && d.value > 0).map((d) => <Cell key={d.label} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [formatValue(value == null ? null : Number(value), s.unit), name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-xs">
              {s.label && (chart.series.length > 1) && <li className="font-bold text-[#1c1917]">{s.label}</li>}
              {slices.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="truncate text-[#57534e]">{d.label}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-[#1c1917]">{formatValue(d.value, s.unit)}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </Figure>
  );
}

function AnswerTable({ table }: { table: TableBlock }) {
  const columns = table.columns ?? [];
  const cell = (value: string | number | boolean | null | undefined, unit: string) => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "number") return formatValue(value, unit);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return value;
  };
  return (
    <Figure title={table.title}>
      <div className="overflow-x-auto p-3">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {columns.map((c, j) => (
                <th key={j} className="px-3 py-2 text-left font-bold text-[#57534e] border-b border-[rgba(196,154,60,0.3)] whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(table.rows ?? []).map((row, r) => (
              <tr key={r} className="border-b border-[rgba(196,154,60,0.1)] last:border-0">
                {columns.map((c, j) => (
                  <td key={j} className={`px-3 py-2 text-[#1c1917] ${typeof row[j] === "number" ? "text-right tabular-nums whitespace-nowrap" : ""}`}>
                    {cell(row[j], c.unit)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Figure>
  );
}
