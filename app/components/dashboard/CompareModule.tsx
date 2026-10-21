// components/dashboard/CompareModule.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";
import { portfoliosService } from "../../services/portfoliosService";
import { portfolioColorMap } from "../../lib/chartColors";
import { toChartPoints } from "../../lib/series";
import { AXIS_TICK_COLOR, Fig, MODULE_BODY, Module, ModuleHead, TOOLTIP_STYLE } from "./PerformanceSection";
import { formatPct } from "./CompareCharts";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";

const DESC = "Every portfolio's time-weighted return since its first day, side by side. Open it for the returns, the risk and what they hold.";

const monthShortYearLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
const fullDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const toneOf = (v: number | null) => (v === null || v === 0 ? undefined : v > 0 ? "gain" as const : "loss" as const);
const totalOf = (e: PortfolioComparisonEntry) => e.performance?.totalReturnPct ?? null;

/**
 * COMPARE — All portfolios' preview of Compare (with two portfolios or more), across the page under
 * the Portfolios module, laid out as the Performance module is: its figures in a column beside the
 * chart (above it on a narrow card), the best and the worst return since inception (each with
 * its portfolio's colour, for its line) and the gap between them; the chart every portfolio's cumulative return since its own first day, in the
 * colours of the Portfolios' donut above it, which says whose line is whose. The module opens
 * Compare (`onOpen`), every portfolio side by side, nothing to pick. Figures from one call
 * (GET /v1/portfolios/comparison).
 */
export function CompareModule({ onOpen }: { onOpen: () => void }) {
  const { entries, colorOf } = useCompareEntries();
  // Best return since inception first; those with none yet left out.
  const ranked = useMemo(() => (entries ?? []).filter((e) => totalOf(e) !== null).sort((a, b) => totalOf(b)! - totalOf(a)!), [entries]);
  const best = ranked[0];
  const worst = ranked.at(-1);

  return (
    <Module className="@container">
      <ModuleHead title="Compare" desc={DESC} onExplore={onOpen} />
      <div className={`${MODULE_BODY} cursor-pointer`} onClick={onOpen}>
        {entries === undefined ? (
          <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 text-slate-300 animate-spin" /></div>
        ) : entries === null ? (
          <p className="text-[12.5px] text-[#857e78]">Can&apos;t be compared right now: open it to try again.</p>
        ) : (
          <div className="grid grid-cols-1 @2xl:grid-cols-[auto_minmax(0,1fr)] gap-[22px] @2xl:gap-8 items-center">
            {/* One column beside the chart on a wide card, side by side above it on a narrow one. */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] @2xl:grid-cols-1 gap-x-5 gap-y-3 @2xl:min-w-[150px] @2xl:max-w-[200px]">
              {best && worst ? (
                <>
                  <Fig label="Best, since inception" value={formatPct(totalOf(best)!)} tone={toneOf(totalOf(best))} strong badge={<Dot entry={best} colorOf={colorOf} />} />
                  {worst !== best && (
                    <>
                      <Fig label="Worst" value={formatPct(totalOf(worst)!)} tone={toneOf(totalOf(worst))} strong badge={<Dot entry={worst} colorOf={colorOf} />} />
                      <Fig label="Gap, best to worst" value={`${(totalOf(best)! - totalOf(worst)!).toFixed(2)} pts`} strong />
                    </>
                  )}
                </>
              ) : (
                <Fig label="Since inception" value="—" strong />
              )}
            </div>
            <CompareReturnsChart entries={entries} colorOf={colorOf} />
          </div>
        )}
      </div>
    </Module>
  );
}

/**
 * Every one of the user's portfolios' figures side by side (GET /v1/portfolios/comparison, the
 * client's on an advisor's view), in the portfolio list's order, and each one's colour
 * (portfolioColorMap, as everywhere else on the page). undefined while loading, null when they
 * couldn't be read.
 */
export function useCompareEntries() {
  const { portfolios, client } = usePortfolio();
  const real = useMemo(() => portfolios.filter((p) => !p.isVirtual && !p.isAggregate), [portfolios]);
  const colorOf = useMemo(() => portfolioColorMap(portfolios), [portfolios]);
  const key = `${client?.uuid ?? "own"}:${real.map((p) => p.uuid).join(",")}`;
  const [state, setState] = useState<{ key: string; entries: PortfolioComparisonEntry[] | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    portfoliosService.compare(real.map((p) => p.uuid), client?.uuid ?? null)
      .then((entries) => { if (!cancelled) setState({ key, entries }); })
      .catch(() => { if (!cancelled) setState({ key, entries: null }); });
    return () => { cancelled = true; };
    // `real` and the client are read through `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { entries: state?.key === key ? state.entries : undefined, colorOf };
}

/** A figure's portfolio: its colour, as its line and its slice of the donut have it, its name on hover. */
function Dot({ entry, colorOf }: { entry: PortfolioComparisonEntry; colorOf: (uuid: string) => string }) {
  return <span title={entry.portfolio.name} aria-label={entry.portfolio.name} className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colorOf(entry.portfolio.uuid) }} />;
}

/** The portfolios' cumulative returns since each one's first day, a line each in its colour (as the Performance module's chart is drawn). */
function CompareReturnsChart({ entries, colorOf }: { entries: PortfolioComparisonEntry[]; colorOf: (uuid: string) => string }) {
  const withSeries = useMemo(() => entries.filter((e) => e.performance?.cumulativeReturnPct), [entries]);
  const data = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const e of withSeries) {
      for (const p of toChartPoints(e.performance!.cumulativeReturnPct!, 160)) {
        const row = byDate.get(p.date) ?? { date: p.date };
        row[e.portfolio.uuid] = p.value;
        byDate.set(p.date, row);
      }
    }
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [withSeries]);
  const nameOf = (uuid: string) => entries.find((e) => e.portfolio.uuid === uuid)?.portfolio.name ?? uuid;

  if (data.length < 2) return <p className="text-[12.5px] text-[#857e78]">Not enough history yet to chart.</p>;
  return (
    <div className="h-[240px] min-w-0">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 240 }}>
        <LineChart data={data} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={monthShortYearLabel}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            minTickGap={30}
            padding={{ left: 12 }}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={56}
          />
          <Tooltip
            labelFormatter={(label) => fullDateLabel(label as string)}
            formatter={(value, name) => [formatPct(Number(value)), nameOf(String(name))]}
            itemSorter={(item) => -Number(item.value)}
            contentStyle={TOOLTIP_STYLE}
          />
          {withSeries.map((e) => (
            <Line
              key={e.portfolio.uuid}
              type="monotone"
              dataKey={e.portfolio.uuid}
              stroke={colorOf(e.portfolio.uuid)}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3.5 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
