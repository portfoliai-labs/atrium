// components/dashboard/FinancialStatementsModule.tsx
"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { portfolioService } from "../../services/portfolioService";
import { useInvestmentsRead } from "../../context/PortfolioContext";
import {
  STATEMENTS,
  type FinancialStatements,
  type StatementFigure,
  type StatementKey,
  type StatementPeriod,
  type StatementsFrequency,
  type StatementsSource,
} from "../../models/FinancialStatements";
import { CardFoot, CardInfo, LINK_CLASS } from "./InstrumentProfileModule";
import { MODULE_BODY, Module, ModuleHead } from "./PerformanceSection";

const DESC = "The company's income statement, balance sheet and cash flow, as it filed them.";

// A date (YYYY-MM-DD) as the day it names, whatever the viewer's time zone.
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
// A period's column: its fiscal year's end ("FY Sep 2025"), a quarter's ("Q Jun 2026").
const periodLabel = (period: StatementPeriod, frequency: StatementsFrequency) => {
  const end = new Date(`${period.end}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return `${frequency === "annual" ? "FY" : "Q"} ${end}`;
};

// An amount in its unit: a currency's and a count of shares compact (416.16B), per share with
// cents; a negative one in brackets, as statements write it.
const amount = (figure: StatementFigure) => {
  const text = figure.unit.endsWith("/shares")
    ? Math.abs(figure.value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.abs(figure.value).toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });
  return figure.value < 0 ? `(${text})` : text;
};

// The table's currency: its monetary figures' (a company reports in one).
const currencyOf = (periods: StatementPeriod[]) =>
  periods.flatMap((p) => p.figures).find((f) => f.unit !== "shares" && !f.unit.endsWith("/shares"))?.unit ?? null;

// A period's filing, what its column links to: the one most of its figures were read from.
const filingOf = (period: StatementPeriod) => {
  const counts = new Map<string, number>();
  period.figures.forEach((f) => f.url && counts.set(f.url, (counts.get(f.url) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

const SOURCE_NOTES: Record<StatementsSource, string> = {
  sec_filing: "Read from the company's filings with the SEC (its 10-Ks and 10-Qs, or 20-Fs), as EDGAR's XBRL data reports them.",
  esef_report: "Read from the company's annual financial reports in ESEF, the format the EU's listed companies file in, via filings.xbrl.org. Annual only.",
  price_provider: "The company files neither with the SEC nor in ESEF: these are the price provider's statements (Yahoo Finance), not read from a filing.",
};

/**
 * FINANCIAL STATEMENTS — on a share's page (AssetExplore), under Market data: the company's income
 * statement, balance sheet and cash flow (GET /v1/assets/{listing_id}/financial-statements), by
 * fiscal year or quarter, a statement at a time; periods as columns, the latest first, scrolling
 * sideways on a narrow screen. Amounts in the currency the company reports in, as filed: compact,
 * negatives in brackets, per-share figures with cents. A computed figure (a fourth quarter's flow,
 * the free cash flow) is marked; each column links to the filing its figures were read from, a
 * figure's own filing (a later one, for a restated value) in its tooltip. The foot names the
 * source: the SEC (never its seal or logos), the ESEF reports via filings.xbrl.org, or the price
 * provider. Left out for a fund, and for a company no source has statements of.
 */
export function FinancialStatementsModule({ listingId }: { listingId: string }) {
  const [frequency, setFrequency] = useState<StatementsFrequency>("annual");
  const [statement, setStatement] = useState<StatementKey>("income");
  // undefined while it's read, null when it couldn't be.
  const data = useInvestmentsRead<FinancialStatements>(
    ["asset", listingId, "financialStatements", frequency],
    () => portfolioService.getAssetFinancialStatements(listingId, frequency),
  );
  // A company with no quarters (an ESEF one) keeps its annual table rather than an empty one.
  if (data === null || (data && frequency === "annual" && data.periods.length === 0)) return null;

  const chip = (on: boolean) =>
    `px-2.5 py-1 rounded-full border text-[11.5px] font-semibold transition-colors ${on ? "bg-[#1c1917] border-[#1c1917] text-white" : "border-[#E0DACC] text-[#78716c] hover:text-[#1c1917]"}`;
  const currency = data ? currencyOf(data.periods) : null;
  const info = [
    DESC,
    data?.source && SOURCE_NOTES[data.source],
    currency && `Amounts in ${currency}, as the company reports them; per-share figures with cents, shares as a count.`,
    "Each line is a standard item, the same for every company: a company's own items aren't shown, and an item it doesn't report stays empty.",
    "Where the company restated a figure, the latest filing's is shown. Marked * are computed: the free cash flow (from operations less capital expenditure), a fourth quarter's flows (the year's less its first three quarters').",
  ].filter(Boolean).join("\n\n");

  return (
    <Module>
      <ModuleHead
        title={currency ? `Financial statements · ${currency}` : "Financial statements"}
        desc={DESC}
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            {STATEMENTS.map((s) => (
              <button key={s.key} type="button" aria-pressed={s.key === statement} onClick={() => setStatement(s.key)} className={chip(s.key === statement)}>
                {s.title}
              </button>
            ))}
            <div role="group" aria-label="Periods" className="ml-1.5 inline-flex rounded-lg bg-[#F3EFE6] p-0.5">
              {(["annual", "quarterly"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={f === frequency}
                  onClick={() => setFrequency(f)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-[0.04em] transition-colors ${f === frequency ? "bg-white text-[#1c1917] shadow-sm" : "text-[#78716c] hover:text-[#1c1917]"}`}
                >
                  {f === "annual" ? "Annual" : "Quarterly"}
                </button>
              ))}
            </div>
            <CardInfo text={info} />
          </div>
        }
      />
      <div className={`${MODULE_BODY} flex flex-col gap-5`}>
        {data === undefined ? (
          <p className="flex items-center gap-2 text-[12.5px] text-[#857e78]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C49A3C]" /> Loading…
          </p>
        ) : data.periods.length === 0 ? (
          <p className="text-[12.5px] text-[#857e78]">No quarterly statements: the company files its accounts by year.</p>
        ) : (
          <StatementTable data={data} statement={statement} />
        )}
        {data && data.source && <StatementsFoot source={data.source} />}
      </div>
    </Module>
  );
}

function StatementTable({ data, statement }: { data: FinancialStatements; statement: StatementKey }) {
  const items = STATEMENTS.find((s) => s.key === statement)?.items ?? [];
  const byPeriod = data.periods.map((period) => new Map(period.figures.map((f) => [f.item, f])));
  const rows = items.filter(([item]) => byPeriod.some((figures) => figures.has(item)));
  if (rows.length === 0) {
    return <p className="text-[12.5px] text-[#857e78]">The company&apos;s filings report none of this statement&apos;s items.</p>;
  }
  return (
    <div className="-mx-6 overflow-x-auto px-6">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[#EEE9DD]">
            <th scope="col" className="sticky left-0 bg-white py-2 pr-4 text-left text-[11px] font-semibold text-[#857e78]" />
            {data.periods.map((period) => {
              const filing = filingOf(period);
              const label = periodLabel(period, data.frequency);
              return (
                <th key={period.end} scope="col" title={`${dayLabel(period.start)} to ${dayLabel(period.end)}`} className="py-2 pl-4 text-right text-[11px] font-semibold text-[#857e78] whitespace-nowrap">
                  {filing ? (
                    <a href={filing} target="_blank" rel="noopener noreferrer" className={LINK_CLASS} title="Open the filing">
                      {label}<ExternalLink className="h-2.5 w-2.5 shrink-0" />
                    </a>
                  ) : label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(([item, label]) => (
            <tr key={item} className="border-b border-[#EEE9DD] last:border-b-0">
              <th scope="row" className="sticky left-0 bg-white py-2.5 pr-4 text-left text-[12.5px] font-normal text-[#78716c] whitespace-nowrap">{label}</th>
              {byPeriod.map((figures, i) => {
                const figure = figures.get(item);
                return (
                  <td
                    key={data.periods[i].end}
                    title={figure ? (figure.computed ? "Computed" : figure.filed ? `Filed ${dayLabel(figure.filed)}` : undefined) : undefined}
                    className="py-2.5 pl-4 text-right text-[13px] font-bold tabular-nums text-[#1c1917] whitespace-nowrap"
                  >
                    {figure ? amount(figure) : <span className="font-normal text-[#c4bdb4]">—</span>}
                    {figure?.computed && <sup className="ml-0.5 text-[9.5px] font-semibold text-[#857e78]">*</sup>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatementsFoot({ source }: { source: StatementsSource }) {
  return (
    <CardFoot>
      <p>
        <span className="font-semibold text-[#857e78]">Source</span>{" "}
        {source === "sec_filing" && <>the company&apos;s filings with the SEC (EDGAR); each period links to its filing.</>}
        {source === "esef_report" && <>the company&apos;s annual financial reports (ESEF, via filings.xbrl.org); each year links to its report.</>}
        {source === "price_provider" && <>Yahoo Finance (the company files neither with the SEC nor in ESEF).</>}
      </p>
      <p>* Computed by PortfoliAI from the filed figures.</p>
    </CardFoot>
  );
}
