// components/dashboard/taxes/RealizedTaxes.tsx
"use client";

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Hourglass, Info } from "lucide-react";
import { useInvestmentsRead, usePortfolio } from "../../../context/PortfolioContext";
import { fetchTaxYears, taxYearsKey, useRealizedGains, useTaxYear } from "../../../hooks/useTaxes";
import { ApiError } from "../../../services/apiClient";
import { formatCompact, formatCurrency } from "../../../lib/format";
import { CATEGORICAL_PALETTE } from "../../../lib/chartColors";
import { TAX_DISCLAIMER } from "../../../lib/taxes";
import { TAX_REGIME_UNAVAILABLE, type TaxYear } from "../../../models/Tax";
import { ExplorePanel } from "../ExploreView";
import { AXIS_TICK_COLOR, FigRows, TOOLTIP_STYLE } from "../PerformanceSection";

const isNoRegime = (err: unknown) => err instanceof ApiError && err.status === 409 && err.errorType === TAX_REGIME_UNAVAILABLE;

// The bars' series, in the palette's fixed order: what goes in the tax return (gains, then
// income) and what the brokers withhold.
const SERIES = [
  { key: "gains", label: "Tax on gains", color: CATEGORICAL_PALETTE[0], of: (t: TaxYear) => t.tax },
  { key: "income", label: "Tax on income", color: CATEGORICAL_PALETTE[1], of: (t: TaxYear) => t.incomeTax },
  { key: "withheld", label: "Withheld by brokers", color: CATEGORICAL_PALETTE[2], of: (t: TaxYear) => t.withheldTax },
] as const;

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

/**
 * TAXES BY YEAR — Profit & Loss's (the investments': All portfolios, or the only portfolio): the
 * estimated tax of each calendar year since the first transaction, by the regime of the tax
 * residence, as stacked bars (what goes in the tax return on the gains and on the income, what the
 * brokers withhold) over a table that adds the losses carried forward. A year (its bar, its row)
 * opens the Taxes page on it (`onOpen`). Without a residence (or a regime for it), the way there.
 */
export function TaxesByYearPanel({ onOpen }: { onOpen: (year?: number) => void }) {
  const { client } = usePortfolio();
  const clientUuid = client?.uuid ?? null;
  const queryClient = useQueryClient();
  // undefined loading; "noRegime" without a residence or a regime for it; null failed. [] without
  // any transaction. Each year also goes in the cache, for the Taxes page's.
  const data = useInvestmentsRead<TaxYear[] | "noRegime">(taxYearsKey(clientUuid), async () => {
    try {
      return await fetchTaxYears(queryClient, clientUuid);
    } catch (err) {
      if (isNoRegime(err)) return "noRegime";
      throw err;
    }
  });

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
                  {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                  {series.map((s, i) => (
                    <Bar
                      key={s.key}
                      dataKey={s.label}
                      stackId="t"
                      fill={s.color}
                      radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
                      maxBarSize={40}
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
 */
export function PortfolioTaxYear({ portfolioUuid, onOpen }: { portfolioUuid: string; onOpen: (year?: number) => void }) {
  const { portfolios } = usePortfolio();
  const portfolio = portfolios.find((p) => p.uuid === portfolioUuid);
  const declared = portfolios.filter((p) => !p.isVirtual && p.taxationMode === "declared");
  const withheld = portfolio?.taxationMode === "withheld";
  // Declared with others: its own net, from the year's sales.
  const shared = !withheld && declared.length > 1;
  const year = new Date().getFullYear();
  const tax = useTaxYear(year);
  const gains = useRealizedGains(year, null, { enabled: shared });
  const data = tax.data && (!shared || gains.data) ? { tax: tax.data, gains: shared ? gains.data ?? null : null } : undefined;
  if (!portfolio || !data) return null;

  const money = (v: number) => formatCurrency(v, data.tax.currency, 0);
  const carried = sum(data.tax.carriedLosses.filter((l) => l.portfolioUuid === portfolioUuid).map((l) => l.amount));
  const net = data.gains?.byPortfolio.find((b) => b.key === portfolioUuid)?.net ?? 0;

  return (
    <div className="pt-3 border-t border-[#EEE9DD] space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#78716c]">Taxes {year} · estimate</p>
        <button type="button" onClick={() => onOpen(year)} className="text-xs font-bold text-[#8A6A28] hover:text-[#C49A3C]">Details →</button>
      </div>
      {withheld ? (
        <FigRows
          rows={[
            { key: "withheld", label: "Withheld by the broker", value: money(data.tax.withheld.find((w) => w.portfolioUuid === portfolioUuid)?.tax ?? 0), info: "What its broker withholds on this year's gains (regime amministrato). Its income is taxed at source." },
            carried > 0 && { key: "carried", label: "Its losses carried forward", value: money(carried), info: "Only its broker can offset them, against this portfolio's gains." },
          ]}
        />
      ) : shared ? (
        <>
          <FigRows rows={[{ key: "net", label: `Net realized in ${year}`, value: money(net), tone: net > 0 ? "gain" : net < 0 ? "loss" : undefined, info: "This year's gains less its losses, on this portfolio." }]} />
          <p className="text-xs text-[#78716c]">
            Declared in your tax return with your other {declared.length - 1 === 1 ? "portfolio" : `${declared.length - 1} portfolios`}: their gains and losses offset each other, so the tax is theirs together.
          </p>
        </>
      ) : (
        <FigRows
          rows={[{ key: "tax", label: "Tax to declare", value: money(data.tax.tax + data.tax.incomeTax), info: "What this year's gains and income owe, to put in the tax return." }]}
        />
      )}
    </div>
  );
}
