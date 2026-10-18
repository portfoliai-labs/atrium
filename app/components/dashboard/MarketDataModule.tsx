// components/dashboard/MarketDataModule.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { portfolioService } from "../../services/portfolioService";
import { MARKET_DATA_SOURCE_LABELS, type AssetMarketData, type RiskStatistics } from "../../models/MarketData";
import { CardFoot, CardInfo } from "./InstrumentProfileModule";
import { MODULE_BODY, Module, ModuleHead } from "./PerformanceSection";

const DESC = "The listing's size, how much of it trades and how its price has behaved, each value marked with the number of its source, listed at the foot.";

// A date (YYYY-MM-DD) as the day it names, whatever the viewer's time zone.
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const compact = (value: number) => value.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
const signedPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;

// How long the window the statistics cover is, from its months: "3 years", "18 months".
const windowLabel = (risk: RiskStatistics) => {
  const months = Math.round(
    (new Date(`${risk.end}T00:00:00`).getTime() - new Date(`${risk.start}T00:00:00`).getTime()) / (30.44 * 86_400_000),
  );
  return months % 12 === 0 ? `${months / 12} year${months === 12 ? "" : "s"}` : `${months} months`;
};

type Row = { key: string; label: string; value: string; source: number };

/**
 * MARKET DATA — on an asset's page (AssetExplore), beside Key facts: a company's market cap (its
 * shares outstanding at the last price), the listing's average daily volume, and the statistics
 * of its own daily closes over the last three years (or what it has, from one): annualised
 * return and volatility, max drawdown, Sharpe ratio against its currency's central bank rate
 * (GET /v1/assets/{asset}/market-data). The provider's figures cite the provider; the statistics
 * are the platform's own, computed with the method in the "i", never a provider's. Computed once
 * a day per listing, so the first visit of the day can take a few seconds: it loads on its own,
 * after the page. An error, or a listing with none of them, leaves the card out.
 */
export function MarketDataModule({ asset }: { asset: string }) {
  const [state, setState] = useState<{ asset: string; data: AssetMarketData | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    portfolioService.getAssetMarketData(asset)
      .then((data) => { if (!cancelled) setState({ asset, data }); })
      .catch(() => { if (!cancelled) setState({ asset, data: null }); });
    return () => { cancelled = true; };
  }, [asset]);

  const current = state?.asset === asset ? state : undefined;
  if (current === undefined) {
    return (
      <Module className="flex flex-col">
        <ModuleHead title="Market data" desc={DESC} />
        <div className={MODULE_BODY}>
          <p className="flex items-center gap-2 text-[12.5px] text-[#a8a29e]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C49A3C]" /> Computing…
          </p>
        </div>
      </Module>
    );
  }
  const data = current.data;
  if (data === null || (!data.marketCap && !data.averageVolume && !data.risk)) return null;

  // The providers first, each once (Yahoo Finance's shares and volumes are one source), then the
  // platform's statistics.
  const providers = [...new Set([data.marketCap?.source, data.averageVolume?.source].filter((s): s is string => !!s))];
  const providerRef = (source: string) => providers.indexOf(source) + 1;
  const computedRef = providers.length + 1;
  const { marketCap, averageVolume, risk } = data;
  const rows: (Row | false)[] = [
    !!marketCap && { key: "marketCap", label: "Market cap", value: `${compact(marketCap.value)} ${data.currency}`, source: providerRef(marketCap.source) },
    !!averageVolume && {
      key: "averageVolume", label: "Avg. volume", value: `${compact(averageVolume.shares)} a day`, source: providerRef(averageVolume.source),
    },
    !!risk && { key: "return", label: "Return", value: `${signedPct(risk.annualizedReturnPct)} a year`, source: computedRef },
    !!risk && { key: "volatility", label: "Volatility", value: `${risk.annualizedVolatilityPct.toFixed(2)}% a year`, source: computedRef },
    !!risk && { key: "maxDrawdown", label: "Max drawdown", value: `${risk.maxDrawdownPct.toFixed(2)}%`, source: computedRef },
    !!risk && risk.sharpeRatio !== null && { key: "sharpe", label: "Sharpe ratio", value: risk.sharpeRatio.toFixed(2), source: computedRef },
  ];

  const info = [
    DESC,
    marketCap && `Market cap: the company's ${compact(marketCap.sharesOutstanding)} shares outstanding at the last price, ${marketCap.price.toFixed(2)} ${data.currency}.`,
    averageVolume && `Average volume: the mean of the shares traded a day over the last ${averageVolume.sessions} sessions, to ${dayLabel(averageVolume.asOf)}.`,
    risk && [
      `Return, volatility, drawdown and Sharpe ratio are computed by PortfoliAI from the listing's daily closes over ${windowLabel(risk)} (${dayLabel(risk.start)} to ${dayLabel(risk.end)}; at most ${risk.windowMonths / 12} years, from at least ${risk.minimumMonths} months of history).`,
      `Return: compounded a year (CAGR). Volatility: the standard deviation of the ${risk.observations} daily returns, annualised over the ${Math.round(risk.observationsPerYear)} days a year the listing trades. Max drawdown: the deepest fall from a previous high.`,
      risk.sharpeRatio !== null && risk.riskFreeRate
        ? `Sharpe ratio: the return above the risk-free rate (the ${risk.riskFreeRate.centralBank}'s policy rate, ${risk.riskFreeRate.meanRatePct.toFixed(2)}% on average over the period) per unit of volatility.`
        : null,
      "Past figures say nothing certain about the future.",
    ].filter(Boolean).join(" "),
  ].filter(Boolean).join("\n\n");

  return (
    <Module className="flex flex-col">
      <ModuleHead title="Market data" desc={DESC} right={<CardInfo text={info} />} />
      <div className={`${MODULE_BODY} flex flex-1 flex-col gap-5`}>
        <table className="w-full table-fixed border-collapse">
          <tbody>
            {rows.filter((r): r is Row => !!r).map((row) => (
              <tr key={row.key} className="border-b border-[#EEE9DD] last:border-b-0">
                <th scope="row" className="w-28 py-2.5 pr-4 text-left align-top text-[12.5px] font-normal text-[#78716c]">{row.label}</th>
                <td className="py-2.5 text-right align-top text-[13.5px] font-bold tabular-nums text-[#1c1917]">
                  {row.value}
                  <sup className="ml-0.5 text-[9.5px] font-semibold text-[#a8a29e]">[{row.source}]</sup>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <CardFoot>
          <p className="flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="font-semibold text-[#a8a29e]">Sources</span>
            {providers.map((source, i) => (
              <span key={source}><span className="tabular-nums text-[#a8a29e]">[{i + 1}]</span> {MARKET_DATA_SOURCE_LABELS[source] ?? source}</span>
            ))}
            {risk && (
              <span>
                <span className="tabular-nums text-[#a8a29e]">[{computedRef}]</span> Computed by PortfoliAI, {dayLabel(risk.start)} to {dayLabel(risk.end)}
              </span>
            )}
          </p>
        </CardFoot>
      </div>
    </Module>
  );
}
