// components/dashboard/pnl/ProfitLossYears.tsx
"use client";

import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { portfolioService } from "../../../services/portfolioService";
import { ApiError } from "../../../services/apiClient";
import { insightsKey, useDetail } from "../../../hooks/useInsights";
import { useTaxYear } from "../../../hooks/useTaxes";
import { formatCompact, formatCurrency } from "../../../lib/format";
import { CATEGORICAL_PALETTE } from "../../../lib/chartColors";
import { TAX_REGIME_UNAVAILABLE } from "../../../models/Tax";
import type { RealizedPnlResponse, RealizedPnlYear, RealizedPnlYearAsset } from "../../../models/PortfolioData";
import { DataTable, ExplorePanel, type DataColumn } from "../ExploreView";
import {
  AXIS_TICK_COLOR, Fig, Figs, MODULE_BODY, Module, ModuleHead, TOOLTIP_STYLE, formatSignedCurrency, toneOfValue,
} from "../PerformanceSection";
import { Breadcrumb, type Crumb } from "../Breadcrumb";
import { PAGE_HEAD, PageTitle } from "../PageHeader";
import { PortfolioTaxYear } from "../taxes/RealizedTaxes";

const SALES = { label: "From sales", color: CATEGORICAL_PALETTE[0] } as const;
const DIVIDENDS = { label: "From dividends", color: CATEGORICAL_PALETTE[1] } as const;
// The widest a year's bar gets, with a year or two: wider reads as a block, not a bar.
const BAR_MAX = 160;

const toneClass = (v: number) => (v > 0 ? "text-[#047857]" : v < 0 ? "text-[#e11d48]" : "text-[#1c1917]");

/**
 * REALIZED P&L BY YEAR — Profit & Loss's: what each calendar year realized, from sales (either
 * sign) and from dividends, as stacked bars, every year's adding up to the totals above (nucleo's
 * byYear). No legend and no table: a bar's tooltip names its parts, and a year (its bar) opens
 * its page with every figure (`onOpen`: ProfitLossYearPage).
 * Nothing from a document built before the years were (byYear missing).
 */
export function PnlByYearPanel({ data, onOpen }: { data: RealizedPnlResponse; onOpen: (year: number) => void }) {
  const years = data.byYear;
  if (!years) return null;
  const money = (v: number) => formatCurrency(v, data.currency, 0);
  const current = new Date().getFullYear();
  const withDividends = years.some((y) => y.dividendIncome !== 0);
  const chart = years.map((y) => ({ year: y.year, [SALES.label]: y.realizedTradingPnl, [DIVIDENDS.label]: y.dividendIncome }));
  const series = withDividends ? [SALES, DIVIDENDS] : [SALES];

  return (
    <ExplorePanel
      title="Realized P&L by year"
      desc="What each calendar year locked in, from sales and from dividends. A year opens its detail."
    >
      {years.length === 0 ? (
        <p className="px-6 pb-6 text-[12.5px] text-[#857e78]">Nothing realized yet.</p>
      ) : (
        <div className="pb-6">
          <div className="px-6 h-64">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 256 }}>
              <BarChart
                data={chart}
                stackOffset="sign"
                // Each year's bar takes most of its slot: the fewer the years, the wider (up to BAR_MAX).
                barCategoryGap="22%"
                margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                onClick={(s) => {
                  const row = years[Number(s?.activeIndex)];
                  if (row) onOpen(row.year);
                }}
                style={{ cursor: "pointer" }}
              >
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} width={48} />
                <ReferenceLine y={0} stroke="#E0DACC" />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: "#f8fafc" }}
                  labelFormatter={(y) => (Number(y) === current ? `${y} so far` : String(y))}
                  formatter={(v, n) => [money(Number(v)), n]}
                />
                {series.map((s) => (
                  <Bar key={s.label} dataKey={s.label} stackId="pnl" fill={s.color} maxBarSize={BAR_MAX} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </ExplorePanel>
  );
}

/**
 * PROFIT & LOSS OF A YEAR — a portfolio's page (any the user reads), opened from Profit & Loss's
 * year by year (PnlByYearPanel): what the year realized (from sales, from dividends, and the
 * year's return), each asset's part in it, and the year's taxes: the investments' (the tax
 * return's, the brokers'), opening the Taxes page on the year (`onOpenTaxes`); a single
 * portfolio's own (PortfolioTaxYear). The year is the trail's last step, after Profit & loss
 * (`trail`'s, opening it).
 */
export function ProfitLossYearPage({ portfolioUuid, year, trail, isInvestments, onOpenTaxes }: {
  portfolioUuid: string;
  year: number;
  trail: Crumb[];
  // The investments (All portfolios, or the only portfolio): the taxes are theirs.
  isInvestments: boolean;
  onOpenTaxes?: (year?: number) => void;
}) {
  // The same reads as Profit & Loss's and the Returns', shared with them.
  const realized = useDetail(() => portfolioService.getRealizedPnl(portfolioUuid), insightsKey(portfolioUuid, "incomeCosts", "realizedPnl"));
  const returns = useDetail(() => portfolioService.getReturns(portfolioUuid), insightsKey(portfolioUuid, "performance", "returns"));
  const data = realized.data;
  const currency = data?.currency ?? "EUR";
  const row: RealizedPnlYear | null = data?.byYear?.find((y) => y.year === year) ?? null;
  const returnPct = returns.data?.annual.find((a) => a.year === year)?.returnPct ?? null;
  const current = year === new Date().getFullYear();

  return (
    <div className="space-y-6 pb-12">
      <div className={PAGE_HEAD}>
        {/* Profit & loss is the trail's (`trail`'s last step, opening it), the year its page. */}
        <Breadcrumb trail={trail} current={String(year)} />
        <PageTitle
          title={`Profit & loss ${year}`}
          info={`What ${current ? "this year has" : `${year}`} locked in by selling, and the dividends received${current ? " so far" : ""}, in ${currency}: each sale converted at its own date.`}
        />
      </div>

      {realized.loading ? (
        <Module><div className={`${MODULE_BODY} pt-[22px]`}><p className="text-[12.5px] text-[#857e78]">Loading…</p></div></Module>
      ) : !data ? (
        <Module><div className={`${MODULE_BODY} pt-[22px]`}><p className="text-[12.5px] text-[#857e78]">The year&apos;s figures couldn&apos;t be read right now.</p></div></Module>
      ) : (
        <>
          <Module>
            <ModuleHead title={current ? `${year} so far` : String(year)} desc="What the year realized, and how the portfolio did." />
            <div className={MODULE_BODY}>
              <Figs spread>
                <Fig label="Total realized" strong value={formatSignedCurrency(row?.realizedPnl ?? 0, currency)} tone={toneOfValue(row?.realizedPnl)} info="From sales plus the dividends, net of the tax withheld on them." />
                <Fig label="From sales" value={formatSignedCurrency(row?.realizedTradingPnl ?? 0, currency)} tone={toneOfValue(row?.realizedTradingPnl)} info="Sale proceeds minus what those units cost, each sale converted at its own date." />
                <Fig label="From dividends" value={formatCurrency(row?.dividendIncome ?? 0, currency, 0)} info="The dividends received in the year, gross." />
                <Fig
                  label="Return"
                  value={returnPct === null ? "—" : `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(2)}%`}
                  tone={toneOfValue(returnPct)}
                  sub={current ? "So far" : undefined}
                  info="The portfolio's return over the year, held and sold together, net of what was put in or taken out."
                />
              </Figs>
            </div>
          </Module>

          <YearAssetsModule assets={row?.byAsset ?? []} currency={currency} year={year} />
        </>
      )}

      {onOpenTaxes && (isInvestments ? (
        <InvestmentsYearTaxes year={year} onOpen={onOpenTaxes} />
      ) : (
        <Module>
          <ModuleHead title="Taxes" desc="This portfolio's part of the year's taxes. Opens the year's Taxes." onExplore={() => onOpenTaxes(year)} />
          <div className={MODULE_BODY}>
            <PortfolioTaxYear portfolioUuid={portfolioUuid} year={year} onOpen={onOpenTaxes} bare />
          </div>
        </Module>
      ))}
    </div>
  );
}

/** Each asset that realized anything in the year: from sales, from dividends, together. */
function YearAssetsModule({ assets, currency, year }: { assets: RealizedPnlYearAsset[]; currency: string; year: number }) {
  const withDividends = assets.some((a) => a.dividendIncome !== 0);
  const columns: DataColumn<RealizedPnlYearAsset>[] = [
    {
      key: "asset", label: "Asset", grow: true, sortValue: (a) => a.ticker ?? a.name,
      render: (a) => (
        <span className="min-w-0">
          <span className="block truncate font-bold text-[#1c1917]">{a.ticker ?? a.name}</span>
          {a.ticker && <span className="block truncate text-[11px] text-[#857e78]">{a.name}</span>}
        </span>
      ),
    },
    {
      key: "sales", label: "From sales", align: "right", sortValue: (a) => a.realizedTradingPnl,
      render: (a) => <span className={`tabular-nums ${toneClass(a.realizedTradingPnl)}`}>{a.realizedTradingPnl === 0 ? "—" : formatSignedCurrency(a.realizedTradingPnl, currency)}</span>,
    },
    ...(withDividends ? [
      {
        key: "dividends", label: "From dividends", align: "right" as const, sortValue: (a: RealizedPnlYearAsset) => a.dividendIncome,
        render: (a: RealizedPnlYearAsset) => <span className="tabular-nums text-[#57534e]">{a.dividendIncome === 0 ? "—" : formatCurrency(a.dividendIncome, currency, 0)}</span>,
      },
      {
        key: "total", label: "Total", align: "right" as const, sortValue: (a: RealizedPnlYearAsset) => a.realizedPnl,
        render: (a: RealizedPnlYearAsset) => <span className={`font-bold tabular-nums ${toneClass(a.realizedPnl)}`}>{formatSignedCurrency(a.realizedPnl, currency)}</span>,
      },
    ] : []),
  ];
  return (
    <Module>
      <ModuleHead title="By asset" desc={`Each asset sold or that paid a dividend in ${year}.`} />
      {assets.length === 0 ? (
        <div className={MODULE_BODY}><p className="text-[12.5px] text-[#857e78]">Nothing sold and no dividend in {year}.</p></div>
      ) : (
        <div className="pb-3">
          <DataTable columns={columns} rows={assets} rowKey={(a) => a.assetId} />
        </div>
      )}
    </Module>
  );
}

/**
 * The year's taxes on the investments (the Taxes page's, in short): what goes in the tax return,
 * what the brokers withhold, the losses carried on; opening the Taxes page on the year.
 */
function InvestmentsYearTaxes({ year, onOpen }: { year: number; onOpen: (year?: number) => void }) {
  const read = useTaxYear(year);
  const noRegime = read.error instanceof ApiError && read.error.status === 409 && read.error.errorType === TAX_REGIME_UNAVAILABLE;
  const t = read.data;
  const money = (v: number) => formatCurrency(v, t?.currency ?? "EUR", 0);
  return (
    <Module>
      {/* Opened as every module's detail: the card's arrow, or its head. */}
      <ModuleHead title="Taxes" desc="The year's estimated taxes on your investments. Opens the year's Taxes." onExplore={() => onOpen(year)} />
      <div className={`${MODULE_BODY} space-y-3.5`}>
        {read.isPending ? (
          <p className="text-[12.5px] text-[#857e78]">Loading…</p>
        ) : noRegime ? (
          <p className="text-[12.5px] text-[#857e78]">Set your tax residence to see the year&apos;s taxes. Only Italy&apos;s are computed for now.</p>
        ) : !t ? (
          <p className="text-[12.5px] text-[#857e78]">The taxes couldn&apos;t be read right now.</p>
        ) : (
          <>
            <Figs spread>
              <Fig label="To declare" strong value={money(t.tax + t.incomeTax)} info="What the declared portfolios' gains and income owe, to put in the tax return." />
              <Fig label="On gains" value={money(t.tax)} />
              <Fig label="On income" value={money(t.incomeTax)} />
              <Fig label="Withheld by brokers" value={money(t.withheldTax)} info="What the withheld portfolios' brokers take, at source." />
            </Figs>
          </>
        )}
      </div>
    </Module>
  );
}
