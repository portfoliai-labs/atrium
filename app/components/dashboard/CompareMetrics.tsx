// components/dashboard/CompareMetrics.tsx
"use client";

import { useMemo } from "react";
import { Info, Loader2, Star } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import { Module, ModuleHead, formatPct } from "./CompareCharts";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";
import type { RealEstateOverview } from "../../models/RealEstate";

/**
 * A column of Compare: a portfolio's comparison, or the real estate's dressed as one (its value,
 * what went into it, 100% real estate), its own figures in `realEstate`. The real estate has no
 * returns, risk or benchmark (a value that moves only at each valuation would make them
 * meaningless), and is never a row's best.
 */
export type CompareEntry = PortfolioComparisonEntry & { realEstate?: RealEstateOverview };

const HORIZONS = ["1 Month", "6 Months", "1 Year", "3 Years", "5 Years", "10 Years"];

type Better = "higher" | "lower";

interface MetricRow {
  label: string;
  info?: string;
  get: (e: CompareEntry) => number | null | undefined;
  format: (v: number, currency: string) => string;
  // Omitted for amounts, where "more" isn't better or worse on its own (a bigger portfolio
  // isn't a better one).
  better?: Better;
  // Colour the figure green/red by its sign.
  signed?: boolean;
}

// One of Compare's figure modules: what it's about, then its rows.
interface MetricGroup {
  eyebrow: string;
  title: string;
  desc: string;
  rows: MetricRow[];
}

const money = (v: number, currency: string) => formatCurrency(v, currency, 0);
const signedMoney = (v: number, currency: string) => `${v >= 0 ? "+" : ""}${formatCurrency(v, currency, 0)}`;
const plainPct = (v: number) => `${v.toFixed(2)}%`;

const horizonOf = (e: CompareEntry, period: string) =>
  e.performance?.horizons.find((h) => h.period === period)?.totalReturnPct;

function buildGroups(entries: CompareEntry[], currency: string): MetricGroup[] {
  const realEstate = entries.some((e) => e.realEstate);
  // A horizon row only when at least one column reaches that far back.
  const horizonRows: MetricRow[] = HORIZONS
    .filter((period) => entries.some((e) => horizonOf(e, period) != null))
    .map((period) => ({
      label: `Last ${period.toLowerCase()}`,
      get: (e) => horizonOf(e, period),
      format: formatPct,
      better: "higher",
      signed: true,
    }));

  return [
    {
      eyebrow: currency,
      title: "Value",
      desc: realEstate ? "What each is worth today, what went into it, and what's owed on it." : "What each portfolio is worth today, and what went into it.",
      rows: [
        {
          label: "Market value",
          info: realEstate ? "The real estate's is its latest valuations', at your share." : undefined,
          get: (e) => e.value?.marketValue,
          format: money,
        },
        {
          label: "Invested",
          info: realEstate ? "What you paid for the positions you hold; for the real estate, the purchases, their costs and the works." : "What you paid for the positions you hold.",
          get: (e) => e.value?.investedCapital,
          format: money,
        },
        { label: "Unrealized P&L", get: (e) => e.value?.unrealizedPnl, format: signedMoney, signed: true },
        ...(realEstate ? [
          { label: "Residual debt", info: "What's still owed on the mortgages, at your share.", get: (e: CompareEntry) => e.realEstate?.residualDebt, format: money },
          {
            label: "Equity",
            info: "What's yours of it: a portfolio's market value, the real estate's value less its mortgages. What counts in your net worth.",
            get: (e: CompareEntry) => (e.realEstate ? e.realEstate.equity : e.value?.marketValue),
            format: money,
          },
        ] : []),
      ],
    },
    {
      eyebrow: "Performance",
      title: "Returns",
      desc: "Time-weighted, so money added or withdrawn doesn't count.",
      rows: [
        ...horizonRows,
        {
          label: "Since inception",
          info: "Each portfolio since its own first transaction, so the periods can differ in length.",
          get: (e) => e.performance?.totalReturnPct,
          format: formatPct,
          better: "higher",
          signed: true,
        },
        { label: "Per year", info: "Annualized, available after a year of history.", get: (e) => e.performance?.annualizedReturnPct, format: formatPct, better: "higher", signed: true },
      ],
    },
    {
      eyebrow: "Risk",
      title: "How much it swings",
      desc: "How bumpy the ride is, and the worst fall along the way.",
      rows: [
        { label: "Volatility", info: "How much daily returns swing, annualized. Lower is steadier.", get: (e) => e.volatility?.annualizedVolatilityPct, format: plainPct, better: "lower" },
        { label: "Deepest fall", info: "The largest drop from a previous high.", get: (e) => e.performance?.maxDrawdownPct, format: plainPct, better: "higher" },
      ],
    },
    {
      eyebrow: currency,
      title: "Income & costs",
      desc: realEstate ? "Dividends and rents coming in, and what trading takes out." : "Dividends coming in, and what trading takes out.",
      rows: [
        { label: "Dividends, last 12 months", get: (e) => e.dividends?.totalTrailing12MIncome, format: money },
        { label: "Dividend yield", info: "Last 12 months' dividends over the portfolio's value today.", get: (e) => e.dividends?.wholePortfolioYieldPct, format: plainPct, better: "higher" },
        { label: "Trading costs", info: "Commissions plus spread, since inception.", get: (e) => (e.realEstate ? null : e.value?.tradingCosts), format: money },
        { label: "Yearly cost drag", info: "How much costs take off the return each year. Lower is better.", get: (e) => e.tradingCosts?.annualizedCostDragPct, format: plainPct, better: "lower" },
        ...(realEstate ? [
          { label: "Rents, last 12 months", info: "Rents and short-stay payouts, at your share.", get: (e: CompareEntry) => e.realEstate?.yearlyIncome, format: money },
          {
            label: "Net cash flow, last 12 months",
            info: "The rents less the expenses, the property taxes and the mortgage instalments.",
            get: (e: CompareEntry) => e.realEstate?.yearlyNetCashFlow,
            format: signedMoney,
            signed: true,
          },
          { label: "Gross yield", info: "The last 12 months' rents over the value today.", get: (e: CompareEntry) => e.realEstate?.grossYieldPct, format: plainPct },
        ] : []),
      ],
    },
    {
      eyebrow: "Benchmark",
      title: "Against the market",
      desc: "Each portfolio against matching ETFs fed the same money on the same days.",
      rows: [
        {
          label: "vs benchmark",
          info: "Annualized return above (or below) a benchmark of matching ETFs fed the same deposits and withdrawals.",
          get: (e) => e.benchmark?.excessReturnPct,
          format: formatPct,
          better: "higher",
          signed: true,
        },
      ],
    },
  ];
}

/**
 * The columns holding the best value of a row: among the real portfolios (the aggregate is the
 * whole, not a competitor; the real estate isn't measured the same way) with a figure to compare, and only when there are two or more and
 * they aren't all equal.
 */
function bestColumns(row: MetricRow, entries: CompareEntry[], hidden: (e: CompareEntry) => boolean): Set<string> {
  if (!row.better) return new Set();
  const values = entries
    .filter((e) => !e.portfolio.isAggregate && !e.realEstate && !hidden(e))
    .map((e) => ({ uuid: e.portfolio.uuid, v: row.get(e) }))
    .filter((x): x is { uuid: string; v: number } => x.v != null);
  if (values.length < 2) return new Set();
  const best = row.better === "higher" ? Math.max(...values.map((x) => x.v)) : Math.min(...values.map((x) => x.v));
  const winners = values.filter((x) => x.v === best);
  return winners.length === values.length ? new Set() : new Set(winners.map((x) => x.uuid));
}

/**
 * COMPARE METRICS — the compared portfolios' figures (picked on the cards above, see
 * ComparisonView), a white module per subject (Value, Returns, Risk, Income & costs, Benchmark):
 * its head, then a tile per figure (MetricTile), all alike, as many to a row as the subject has
 * (up to three), so they line up whatever the subject.
 */
export function CompareMetrics({
  entries, colorOf, isUpdating,
}: {
  entries: CompareEntry[];
  colorOf: (uuid: string) => string;
  isUpdating: (e: CompareEntry) => boolean;
}) {
  const currency = entries.find((e) => e.value)?.value?.currency ?? "EUR";
  const groups = useMemo(() => buildGroups(entries, currency), [entries, currency]);

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <Module key={g.title}>
          <ModuleHead eyebrow={g.eyebrow} title={g.title} desc={g.desc} />
          <div className={`p-5 md:p-6 grid grid-cols-1 gap-4 ${
            g.rows.length >= 3 ? "sm:grid-cols-2 xl:grid-cols-3" : g.rows.length === 2 ? "sm:grid-cols-2" : ""
          }`}>
            {g.rows.map((row) => (
              <MetricTile key={row.label} row={row} entries={entries} currency={currency} colorOf={colorOf} isUpdating={isUpdating} />
            ))}
          </div>
        </Module>
      ))}
    </div>
  );
}

/**
 * METRIC TILE — one figure across the compared portfolios: a bar each, in the portfolio's colour
 * (the cards above say whose), as long as its figure is large next to the others', with the figure
 * beside it and a star on the best. The row's `info` shows on the (i). A column still updating, or
 * with no figure yet, gets an empty track.
 */
function MetricTile({ row, entries, currency, colorOf, isUpdating }: {
  row: MetricRow;
  entries: CompareEntry[];
  currency: string;
  colorOf: (uuid: string) => string;
  isUpdating: (e: CompareEntry) => boolean;
}) {
  const best = bestColumns(row, entries, isUpdating);
  const values = entries.map((e) => (isUpdating(e) ? null : row.get(e) ?? null));
  // An amount in another currency (the real estate's, in the user's reference) has its figure but
  // no bar: lengths across currencies would mislead.
  const comparable = entries.map((e) => !e.value || e.value.currency === currency || row.format === plainPct || row.format === formatPct);
  const scale = Math.max(0, ...values.map((v, i) => (v == null || !comparable[i] ? 0 : Math.abs(v))));

  return (
    <div className="bg-[#FBFAF6] rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-black text-slate-900">{row.label}</h3>
        {row.info && (
          <span title={row.info} aria-label={row.info} className="text-slate-300 hover:text-slate-500 cursor-help transition-colors">
            <Info className="h-4 w-4" />
          </span>
        )}
      </div>
      <ul className="space-y-3">
        {entries.map((e, i) => {
          const v = values[i];
          const isBest = best.has(e.portfolio.uuid);
          const width = v == null || scale === 0 || !comparable[i] ? 0 : Math.max(4, (Math.abs(v) / scale) * 100);
          return (
            <li key={e.portfolio.uuid} className="flex items-center gap-3" title={e.portfolio.name}>
              <span className="sr-only">{e.portfolio.name}</span>
              <div className="flex-1 h-2.5 rounded-full bg-slate-200/60 overflow-hidden">
                {width > 0 && <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: colorOf(e.portfolio.uuid) }} />}
              </div>
              <span className={`w-24 shrink-0 flex items-center justify-end gap-1 text-[13px] font-bold tabular-nums ${
                v == null ? "text-slate-300" : row.signed ? (v >= 0 ? "text-emerald-600" : "text-rose-600") : "text-slate-900"
              }`}>
                {isBest && <Star className="h-3 w-3 fill-[#C49A3C] text-[#C49A3C] shrink-0" aria-label="Best" />}
                {isUpdating(e)
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" aria-label="Updating" />
                  : v == null ? <span title={e.realEstate ? "Not measured for real estate" : "Not available yet"}>—</span> : row.format(v, e.value?.currency ?? currency)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
