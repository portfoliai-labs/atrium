// components/dashboard/MarketDataModule.tsx
"use client";

import { Loader2 } from "lucide-react";
import { portfolioService } from "../../services/portfolioService";
import { useInvestmentsRead } from "../../context/PortfolioContext";
import { MARKET_DATA_SOURCE_LABELS, type AssetMarketData, type RiskStatistics } from "../../models/MarketData";
import { CardFoot, CardInfo } from "./InstrumentProfileModule";
import { MODULE_BODY, Module, ModuleHead } from "./PerformanceSection";

const DESC = "How the listing trades, what its price says of the company and how the price has behaved.";
const MARKED = "Each value is marked with the number of its source, listed at the foot.";

// A date (YYYY-MM-DD) as the day it names, whatever the viewer's time zone.
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const momentLabel = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const compact = (value: number) => value.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 3 });
const grouped = (value: number) => Math.round(value).toLocaleString("en-US");
const price = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signedPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
const range = (low: number | null, high: number | null) => (low !== null && high !== null ? `${price(low)} - ${price(high)}` : null);

// How long the window the statistics cover is: "3 years", "18 months".
const windowLabel = (risk: RiskStatistics) => {
  const months = Math.round(
    (new Date(`${risk.end}T00:00:00`).getTime() - new Date(`${risk.start}T00:00:00`).getTime()) / (30.44 * 86_400_000),
  );
  return months % 12 === 0 ? `${months / 12} year${months === 12 ? "" : "s"}` : `${months} months`;
};

// A row's source: a provider's (by its key) or the platform's own statistics.
type Row = { key: string; label: string; value: string | null; source: string | null };
type Column = { key: string; title: string; desc: string; info: (string | false | null | undefined)[]; rows: Row[] };

const COMPUTED = "portfoliai";

// The grid for as many cards as there are, side by side from md up.
const COLUMNS_CLASS: Record<number, string> = { 1: "", 2: "md:grid-cols-2", 3: "md:grid-cols-3" };

/**
 * MARKET DATA — on an asset's page (AssetExplore), under the price: three cards side by side, as a
 * quote page lays them out (GET /v1/assets/{listing_id}/market-data, by the page's listing id).
 * TRADING: the last session's previous close, open, range and volume, the 52 weeks' range and the
 * three months' average volume. VALUATION, for a company: its market cap, P/E and EPS over the
 * last twelve months, forward dividend and yield, next earnings date and the analysts' target.
 * RISK: the statistics of its own daily closes over the last three years (or what it has, from
 * one): annualised return and volatility, max drawdown, Sharpe ratio against its currency's
 * central bank rate. Prices in the listing's currency (a London listing's in pounds). The
 * provider's figures cite the provider; the statistics are the platform's own. Each card numbers
 * its own sources at its foot, what its values mean in its "i". Computed once a day per listing (the quote every few minutes), so the first visit
 * of the day can take a few seconds: it loads on its own, after the page. An error, or a listing
 * with none of them, leaves the cards out; a card with no values is left out too.
 */
export function MarketDataModule({ listingId }: { listingId: string }) {
  // undefined while it's computed, null when it couldn't be.
  const data = useInvestmentsRead<AssetMarketData>(["asset", listingId, "marketData"], () => portfolioService.getAssetMarketData(listingId));
  if (data === undefined) {
    return (
      <Module>
        <ModuleHead title="Market data" desc={DESC} />
        <div className={MODULE_BODY}>
          <p className="flex items-center gap-2 text-[12.5px] text-[#857e78]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C49A3C]" /> Computing…
          </p>
        </div>
      </Module>
    );
  }
  if (data === null) return null;
  const { quote, marketCap, valuation, averageVolume, risk, currency } = data;

  const dividend = valuation?.dividendRate != null
    ? `${price(valuation.dividendRate)}${valuation.dividendYieldPct != null ? ` (${valuation.dividendYieldPct.toFixed(2)}%)` : ""}`
    : null;
  const columns: Column[] = [
    {
      key: "trading", title: `Trading · ${currency}`, desc: "How the listing trades: its last session and the year's range.",
      info: [
        `Prices in ${currency}.`,
        quote?.marketTime && `The last session's, as of ${momentLabel(quote.marketTime)}; the 52-week range from the daily highs and lows.`,
        `The average volume is the mean of the shares traded a day over the last ${averageVolume?.sessions ?? 63} sessions.`,
      ],
      rows: [
        { key: "previousClose", label: "Previous close", value: quote?.previousClose != null ? price(quote.previousClose) : null, source: quote?.source ?? null },
        { key: "open", label: "Open", value: quote?.open != null ? price(quote.open) : null, source: quote?.source ?? null },
        { key: "dayRange", label: "Day's range", value: quote ? range(quote.dayLow, quote.dayHigh) : null, source: quote?.source ?? null },
        { key: "yearRange", label: "52-week range", value: quote ? range(quote.fiftyTwoWeekLow, quote.fiftyTwoWeekHigh) : null, source: quote?.source ?? null },
        { key: "volume", label: "Volume", value: quote?.volume != null ? grouped(quote.volume) : null, source: quote?.source ?? null },
        { key: "averageVolume", label: "Avg. volume (3M)", value: averageVolume ? grouped(averageVolume.shares) : null, source: averageVolume?.source ?? null },
      ],
    },
    {
      key: "valuation", title: "Valuation", desc: "What the price says of the company.",
      info: [
        `Prices in ${currency}.`,
        marketCap && `Market cap: the company's ${compact(marketCap.sharesOutstanding)} shares outstanding at the last price, ${price(marketCap.price)} ${currency}; the P/E and the yield are at that price too.`,
        "EPS over the last twelve months; the dividend is the forward yearly one per share; the target is the analysts' mean.",
      ],
      rows: [
        { key: "marketCap", label: "Market cap", value: marketCap ? compact(marketCap.value) : null, source: marketCap?.source ?? null },
        { key: "pe", label: "P/E (TTM)", value: valuation?.peRatio != null ? valuation.peRatio.toFixed(2) : null, source: valuation?.source ?? null },
        { key: "eps", label: "EPS (TTM)", value: valuation?.trailingEps != null ? price(valuation.trailingEps) : null, source: valuation?.source ?? null },
        { key: "dividend", label: "Dividend & yield", value: dividend, source: valuation?.source ?? null },
        {
          key: "earnings", label: "Earnings date",
          value: valuation?.earningsDate ? `${dayLabel(valuation.earningsDate)}${valuation.earningsDateEstimated ? " (est.)" : ""}` : null,
          source: valuation?.source ?? null,
        },
        { key: "target", label: "1y target", value: valuation?.targetMeanPrice != null ? price(valuation.targetMeanPrice) : null, source: valuation?.source ?? null },
      ],
    },
    {
      key: "risk", title: risk ? `Risk · ${windowLabel(risk)}` : "Risk", desc: "How the price has behaved, computed by PortfoliAI from its daily closes.",
      info: risk ? [
        `Computed by PortfoliAI from the listing's daily closes over ${windowLabel(risk)} (${dayLabel(risk.start)} to ${dayLabel(risk.end)}; at most ${risk.windowMonths / 12} years, from at least ${risk.minimumMonths} months of history).`,
        `Return: compounded a year (CAGR). Volatility: the standard deviation of the ${risk.observations} daily returns, annualised over the ${Math.round(risk.observationsPerYear)} days a year the listing trades. Max drawdown: the deepest fall from a previous high.`,
        risk.sharpeRatio !== null && risk.riskFreeRate
          && `Sharpe ratio: the return above the risk-free rate (the ${risk.riskFreeRate.centralBank}'s policy rate, ${risk.riskFreeRate.meanRatePct.toFixed(2)}% on average over the period) per unit of volatility.`,
        "Past figures say nothing certain about the future.",
      ] : [],
      rows: risk ? [
        { key: "return", label: "Return", value: `${signedPct(risk.annualizedReturnPct)} a year`, source: COMPUTED },
        { key: "volatility", label: "Volatility", value: `${risk.annualizedVolatilityPct.toFixed(2)}% a year`, source: COMPUTED },
        { key: "maxDrawdown", label: "Max drawdown", value: `${risk.maxDrawdownPct.toFixed(2)}%`, source: COMPUTED },
        { key: "sharpe", label: "Sharpe ratio", value: risk.sharpeRatio !== null ? risk.sharpeRatio.toFixed(2) : null, source: COMPUTED },
      ] : [],
    },
  ].map((column) => ({ ...column, rows: column.rows.filter((row) => row.value !== null) })).filter((column) => column.rows.length > 0);
  if (columns.length === 0) return null;

  return (
    <div className={`grid grid-cols-1 ${COLUMNS_CLASS[columns.length]} gap-[22px]`}>
      {columns.map((column) => (
        <MarketDataCard key={column.key} column={column} risk={risk} />
      ))}
    </div>
  );
}

/**
 * One of Market data's cards: its values as a table, each marked with its source's number, its
 * sources (each once, Yahoo Finance's quote, shares and volumes are one) at its foot, level with
 * its neighbours'.
 */
function MarketDataCard({ column, risk }: { column: Column; risk: RiskStatistics | null }) {
  const sources = [...new Set(column.rows.map((row) => row.source).filter((s): s is string => !!s))];
  const ref = (source: string | null) => (source ? sources.indexOf(source) + 1 : null);
  const info = [column.desc, MARKED, ...column.info].filter(Boolean).join("\n\n");

  return (
    <Module className="flex flex-col">
      <ModuleHead title={column.title} desc={column.desc} right={<CardInfo text={info} />} />
      <div className={`${MODULE_BODY} flex flex-1 flex-col gap-5`}>
        <table className="w-full table-fixed border-collapse">
          <tbody>
            {column.rows.map((row) => (
              <tr key={row.key} className="border-b border-[#EEE9DD] last:border-b-0">
                <th scope="row" className="py-2.5 pr-3 text-left align-top text-[12.5px] font-normal text-[#78716c]">{row.label}</th>
                <td className="py-2.5 text-right align-top text-[13.5px] font-bold tabular-nums text-[#1c1917] whitespace-nowrap">
                  {row.value}
                  {ref(row.source) !== null && <sup className="ml-0.5 text-[9.5px] font-semibold text-[#857e78]">[{ref(row.source)}]</sup>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sources.length > 0 && (
          <CardFoot>
            <p className="flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="font-semibold text-[#857e78]">{sources.length > 1 ? "Sources" : "Source"}</span>
              {sources.map((source, i) => (
                <span key={source}>
                  <span className="tabular-nums text-[#857e78]">[{i + 1}]</span>{" "}
                  {source === COMPUTED
                    ? <>Computed by PortfoliAI{risk && <>, {dayLabel(risk.start)} to {dayLabel(risk.end)}</>}</>
                    : MARKET_DATA_SOURCE_LABELS[source] ?? source}
                </span>
              ))}
            </p>
          </CardFoot>
        )}
      </div>
    </Module>
  );
}
