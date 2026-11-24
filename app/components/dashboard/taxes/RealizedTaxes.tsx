// components/dashboard/taxes/RealizedTaxes.tsx
"use client";

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronRight, Hourglass, Info } from "lucide-react";
import { useInvestmentsRead, usePortfolio } from "../../../context/PortfolioContext";
import { fetchTaxYears, taxYearsKey, useRealizedGains, useTaxYear } from "../../../hooks/useTaxes";
import { ApiError } from "../../../services/apiClient";
import { formatCompact, formatCurrency } from "../../../lib/format";
import { CATEGORICAL_PALETTE } from "../../../lib/chartColors";
import { TAX_DISCLAIMER } from "../../../lib/taxes";
import { TAX_REGIME_UNAVAILABLE, type TaxYear } from "../../../models/Tax";
import { ExplorePanel } from "../ExploreView";
import { AXIS_TICK_COLOR, Fig, FigRows, Figs, TOOLTIP_STYLE } from "../PerformanceSection";

const isNoRegime = (err: unknown) => err instanceof ApiError && err.status === 409 && err.errorType === TAX_REGIME_UNAVAILABLE;

// The bars' series, in the palette's fixed order: what goes in the tax return (gains, then
// income) and what the brokers withhold.
const SERIES = [
  { key: "gains", label: "Tax on gains", color: CATEGORICAL_PALETTE[0], of: (t: TaxYear) => t.tax },
  { key: "income", label: "Tax on income", color: CATEGORICAL_PALETTE[1], of: (t: TaxYear) => t.incomeTax },
  { key: "withheld", label: "Withheld by brokers", color: CATEGORICAL_PALETTE[2], of: (t: TaxYear) => t.withheldTax },
] as const;

export const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

// The widest a year's bar gets, with a year or two: the fewer the years, the wider.
const BAR_MAX = 160;

/**
 * Every year's taxes on the investments, from the first transaction's (GET /v1/taxes/years):
 * undefined loading; "noRegime" without a residence or a regime for it; null failed; [] without
 * any transaction. Each year also goes in the cache, for the Taxes page's.
 */
export function useTaxYearsRead() {
  const { client } = usePortfolio();
  const clientUuid = client?.uuid ?? null;
  const queryClient = useQueryClient();
  return useInvestmentsRead<TaxYear[] | "noRegime">(taxYearsKey(clientUuid), async () => {
    try {
      return await fetchTaxYears(queryClient, clientUuid);
    } catch (err) {
      if (isNoRegime(err)) return "noRegime";
      throw err;
    }
  });
}

/** The figures of every year together: what the taxes came to, and the losses carried on now. */
export function taxTotals(rows: TaxYear[]) {
  const last = rows[rows.length - 1];
  const current = new Date().getFullYear();
  return {
    currency: rows[0]?.currency ?? "EUR",
    declared: sum(rows.map((t) => t.tax + t.incomeTax)),
    withheld: sum(rows.map((t) => t.withheldTax)),
    total: sum(rows.map((t) => t.tax + t.incomeTax + t.withheldTax)),
    thisYear: rows.filter((t) => t.year === current).reduce((s, t) => s + t.tax + t.incomeTax + t.withheldTax, 0),
    carried: last ? sum(last.carriedLosses.map((l) => l.amount)) : 0,
    expiring: last && last.year === current ? sum(last.expiringLosses.map((l) => l.amount)) : 0,
  };
}

/**
 * TAXES — Profit & Loss's short of them (the investments': All portfolios, or the only
 * portfolio): what the taxes came to since the first year, this year's so far, the losses carried
 * on; the whole card opens the Taxes section (`onOpen`: TaxesOverviewPage). Without a residence (or
 * a regime for it), that the taxes need one.
 */
export function TaxesSummaryPanel({ onOpen }: { onOpen: () => void }) {
  const data = useTaxYearsRead();
  const rows = Array.isArray(data) ? data : [];
  const t = taxTotals(rows);
  const money = (v: number) => formatCurrency(v, t.currency, 0);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className="block cursor-pointer rounded-[1.75rem] outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40 [&>section]:transition-colors [&>section]:hover:border-[#C49A3C]"
    >
      <ExplorePanel
        title="Taxes"
        desc="The estimated taxes on your investments, every year together. Opens the taxes year by year."
        right={<span className="inline-flex items-center gap-1 text-xs font-bold text-[#8A6A28]">Taxes <ChevronRight className="h-3.5 w-3.5" /></span>}
      >
        <div className="px-6 pb-6">
          {data === undefined ? (
            <p className="text-[12.5px] text-[#857e78]">Loading…</p>
          ) : data === null ? (
            <p className="text-[12.5px] text-[#857e78]">The taxes couldn&apos;t be read right now.</p>
          ) : data === "noRegime" ? (
            <p className="text-[12.5px] text-[#857e78]">Set your tax residence to see your taxes. Only Italy&apos;s are computed for now.</p>
          ) : rows.length === 0 ? (
            <p className="text-[12.5px] text-[#857e78]">No transactions yet.</p>
          ) : (
            <Figs spread>
              <Fig label={`Total since ${rows[0].year}`} strong value={money(t.total)} info="The tax return's on the gains and the income, and what the brokers withheld, every year together. An estimate." />
              <Fig label="This year so far" value={money(t.thisYear)} />
              <Fig label="Losses carried forward" value={money(t.carried)} sub={t.expiring > 0 ? `${money(t.expiring)} expire this year` : undefined} info="The losses left to offset in the years after, the tax return's and each broker's." />
            </Figs>
          )}
        </div>
      </ExplorePanel>
    </div>
  );
}

/**
 * TAXES BY YEAR — the Taxes section's (the investments': All portfolios, or the only portfolio):
 * the estimated tax of each calendar year since the first transaction, by the regime of the tax
 * residence, as stacked bars (what goes in the tax return on the gains and on the income, what the
 * brokers withhold; a bar's tooltip names them, the fewer the years the wider) over a table that
 * adds the losses carried forward. A year (its bar, its row) opens the Taxes page on it (`onOpen`).
 * Without a residence (or a regime for it), the way there.
 */
export function TaxesByYearPanel({ onOpen }: { onOpen: (year?: number) => void }) {
  const data = useTaxYearsRead();

  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const currency = rows[0]?.currency ?? "EUR";
  const money = (v: number) => formatCurrency(v, currency, 0);
  // Only the series some year has.
  const series = SERIES.filter((s) => rows.some((t) => s.of(t) !== 0));
  const chart = rows.map((t) => ({ year: t.year, ...Object.fromEntries(series.map((s) => [s.label, s.of(t)])) }));
  const total = sum(rows.map((t) => t.tax + t.incomeTax + t.withheldTax));
  const current = new Date().getFullYear();

  return (
    <ExplorePanel
      title="Taxes by year"
      desc="The estimated tax of each calendar year on your investments, by the rules of your tax residence. A year opens its detail."
      right={rows.length > 0 ? <span className="text-[13px] font-black tabular-nums text-slate-900">{money(total)} <span className="font-semibold text-[#857e78]">since {rows[0].year}</span></span> : undefined}
    >
      {data === undefined ? (
        <p className="px-6 pb-6 text-[12.5px] text-[#857e78]">Loading…</p>
      ) : data === null ? (
        <p className="px-6 pb-6 text-[12.5px] text-[#857e78]">The taxes couldn&apos;t be read right now.</p>
      ) : data === "noRegime" ? (
        <div className="px-6 pb-6 space-y-2">
          <p className="text-[12.5px] text-[#857e78]">Set your tax residence to see the taxes year by year. Only Italy&apos;s are computed for now.</p>
          <button type="button" onClick={() => onOpen()} className="text-xs font-bold text-[#8A6A28] hover:text-[#C49A3C]">Taxes →</button>
        </div>
      ) : rows.length === 0 ? (
        <p className="px-6 pb-6 text-[12.5px] text-[#857e78]">No transactions yet.</p>
      ) : (
        <div className="space-y-5 pb-6">
          {series.length === 0 ? (
            <p className="px-6 text-[12.5px] text-[#857e78]">No tax in any year so far.</p>
          ) : (
            <div className="px-6 h-64">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 256 }}>
                <BarChart
                  data={chart}
                  barCategoryGap="22%"
                  margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                  onClick={(s) => {
                    const row = rows[Number(s?.activeIndex)];
                    if (row) onOpen(row.year);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: "#f8fafc" }}
                    labelFormatter={(y) => (Number(y) === current ? `${y} so far` : String(y))}
                    formatter={(v, n) => [money(Number(v)), n]}
                  />
                  {series.map((s, i) => (
                    <Bar
                      key={s.key}
                      dataKey={s.label}
                      stackId="t"
                      fill={s.color}
                      radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
                      maxBarSize={BAR_MAX}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-136 text-[13px]">
              <thead>
                <tr className="text-[11px] text-[#78716c] text-right">
                  <th className="px-6 py-2 font-semibold text-left">Year</th>
                  <th className="px-3 py-2 font-semibold">Tax to declare</th>
                  <th className="px-3 py-2 font-semibold">Withheld by brokers</th>
                  <th className="px-6 py-2 font-semibold">Losses carried forward</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((t) => {
                  const expiring = sum(t.expiringLosses.map((l) => l.amount));
                  return (
                    <tr key={t.year} onClick={() => onOpen(t.year)} className="border-t border-[#EEE9DD] cursor-pointer hover:bg-[#F7F5EF] text-right tabular-nums">
                      <td className="px-6 py-2.5 text-left">
                        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(t.year); }} className="font-bold text-[#1c1917] hover:text-[#8A6A28]">
                          {t.year}{t.year === current && <span className="font-semibold text-[#857e78]"> so far</span>}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-[#1c1917]">{money(t.tax + t.incomeTax)}</td>
                      <td className="px-3 py-2.5 text-[#57534e]">{money(t.withheldTax)}</td>
                      <td className="px-6 py-2.5 text-[#57534e]">
                        {money(sum(t.carriedLosses.map((l) => l.amount)))}
                        {expiring > 0 && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-amber-700" title={`${money(expiring)} of losses lost at the end of ${t.year}`}>
                            <Hourglass className="h-3 w-3" />{money(expiring)} expire
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-6 flex items-start gap-2 text-[11px] text-[#857e78]">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            {TAX_DISCLAIMER}
          </p>
        </div>
      )}
    </ExplorePanel>
  );
}

/**
 * A PORTFOLIO'S TAXES THIS YEAR — under its Realized P&L (one portfolio, not the investments):
 * - one its broker taxes ("withheld"): what the broker withholds this year, and its own losses
 *   carried forward;
 * - the only portfolio declared in the tax return: the tax to declare;
 * - one declared with others: their gains and losses offset each other, so it has no tax of its
 *   own. Its net realized this year instead, and that it's taxed with them.
 * Opens the Taxes page on the year (`onOpen`). Nothing without a residence or when it can't be read.
 * This year's, or `year`'s (a Profit & Loss year's page, `bare` in its own module).
 */
export function PortfolioTaxYear({ portfolioUuid, onOpen, year = new Date().getFullYear(), bare = false }: {
  portfolioUuid: string;
  onOpen: (year?: number) => void;
  year?: number;
  bare?: boolean;
}) {
  const { portfolios } = usePortfolio();
  const portfolio = portfolios.find((p) => p.uuid === portfolioUuid);
  const declared = portfolios.filter((p) => !p.isVirtual && p.taxationMode === "declared");
  const withheld = portfolio?.taxationMode === "withheld";
  // Declared with others: its own net, from the year's sales.
  const shared = !withheld && declared.length > 1;
  const tax = useTaxYear(year);
  const gains = useRealizedGains(year, null, { enabled: shared });
  const data = tax.data && (!shared || gains.data) ? { tax: tax.data, gains: shared ? gains.data ?? null : null } : undefined;
  if (!portfolio || !data) return null;

  const money = (v: number) => formatCurrency(v, data.tax.currency, 0);
  const carried = sum(data.tax.carriedLosses.filter((l) => l.portfolioUuid === portfolioUuid).map((l) => l.amount));
  const net = data.gains?.byPortfolio.find((b) => b.key === portfolioUuid)?.net ?? 0;

  return (
    <div className={bare ? "space-y-2" : "pt-3 border-t border-[#EEE9DD] space-y-2"}>
      {/* `bare`: its module's head says it and opens the year. */}
      {!bare && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#78716c]">Taxes {year} · estimate</p>
          <button type="button" onClick={() => onOpen(year)} className="text-xs font-bold text-[#8A6A28] hover:text-[#C49A3C]">Details →</button>
        </div>
      )}
      {withheld ? (
        <FigRows
          rows={[
            { key: "withheld", label: "Withheld by the broker", value: money(data.tax.withheld.find((w) => w.portfolioUuid === portfolioUuid)?.tax ?? 0), info: "What its broker withholds on the year's gains (regime amministrato). Its income is taxed at source." },
            carried > 0 && { key: "carried", label: "Its losses carried forward", value: money(carried), info: "Only its broker can offset them, against this portfolio's gains." },
          ]}
        />
      ) : shared ? (
        <>
          <FigRows rows={[{ key: "net", label: `Net realized in ${year}`, value: money(net), tone: net > 0 ? "gain" : net < 0 ? "loss" : undefined, info: "The year's gains less its losses, on this portfolio." }]} />
          <p className="text-xs text-[#78716c]">
            Declared in your tax return with your other {declared.length - 1 === 1 ? "portfolio" : `${declared.length - 1} portfolios`}: their gains and losses offset each other, so the tax is theirs together.
          </p>
        </>
      ) : (
        <FigRows
          rows={[{ key: "tax", label: "Tax to declare", value: money(data.tax.tax + data.tax.incomeTax), info: "What the year's gains and income owe, to put in the tax return." }]}
        />
      )}
    </div>
  );
}
