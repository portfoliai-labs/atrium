// components/dashboard/FinancialStatementsModule.tsx
"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { portfolioService } from "../../services/portfolioService";
import { useInvestmentsRead } from "../../context/PortfolioContext";
import {
  CARD_PERIODS,
  KEY_ITEMS,
  STATEMENTS,
  type FinancialStatements,
  type StatementFigure,
  type StatementPeriod,
  type StatementsFrequency,
  type StatementsSource,
} from "../../models/FinancialStatements";
import { ExplorePanel } from "./ExploreView";
import { CardFoot, CardInfo, LINK_CLASS } from "./InstrumentProfileModule";
import { PageHeader } from "./PageHeader";
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

// The Annual/Quarterly switch, the card's and the full statements'.
function FrequencySwitch({ frequency, onChange }: { frequency: StatementsFrequency; onChange: (f: StatementsFrequency) => void }) {
  return (
    <div role="group" aria-label="Periods" className="inline-flex rounded-lg bg-[#F3EFE6] p-0.5">
      {(["annual", "quarterly"] as const).map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={f === frequency}
          onClick={() => onChange(f)}
          className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-[0.04em] transition-colors ${f === frequency ? "bg-white text-[#1c1917] shadow-sm" : "text-[#78716c] hover:text-[#1c1917]"}`}
        >
          {f === "annual" ? "Annual" : "Quarterly"}
        </button>
      ))}
    </div>
  );
}

// What the "i" says: the source, the currency, how the items and the computed figures are made.
const infoOf = (data: FinancialStatements | null | undefined, currency: string | null) => [
  DESC,
  data?.source && SOURCE_NOTES[data.source],
  currency && `Amounts in ${currency}, as the company reports them; per-share figures with cents, shares as a count.`,
  "Each line is a standard item, the same for every company: a company's own items aren't shown, and an item it doesn't report stays empty.",
  "Where the company restated a figure, the latest filing's is shown. Marked * are computed: the free cash flow (from operations less capital expenditure), a fourth quarter's flows (the year's less its first three quarters').",
].filter(Boolean).join("\n\n");

// The statements of a frequency, as the card and the full statements read them (one request
// each, shared).
const useStatements = (listingId: string, frequency: StatementsFrequency) =>
  useInvestmentsRead<FinancialStatements>(
    ["asset", listingId, "financialStatements", frequency],
    () => portfolioService.getAssetFinancialStatements(listingId, frequency),
  );

// A table's body: loading, a frequency with none (an ESEF company's quarters), or the table.
function StatementsBody({ data, rows, periods }: { data: FinancialStatements | undefined; rows: [string, string][]; periods: number }) {
  if (data === undefined) {
    return (
      <p className="flex items-center gap-2 text-[12.5px] text-[#857e78]">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C49A3C]" /> Loading…
      </p>
    );
  }
  if (data.periods.length === 0) {
    return <p className="text-[12.5px] text-[#857e78]">No quarterly statements: the company files its accounts by year.</p>;
  }
  return <StatementTable data={data} rows={rows} periods={periods} />;
}

/**
 * FINANCIAL STATEMENTS — on a share's page (AssetExplore), under Market data: the company's
 * figures that say most (revenue, gross profit, operating and net income, diluted EPS, free cash
 * flow, total assets, long-term debt) over its latest CARD_PERIODS years or quarters, which fit
 * beside the labels on any screen (GET /v1/assets/{listing_id}/financial-statements). Its arrow
 * (`onExplore`) opens the full statements, a page of the asset's (FinancialStatementsPage).
 * Amounts in the currency the company reports in, as filed: compact, negatives in brackets,
 * per-share figures with cents. A computed figure (a fourth quarter's flow, the free cash flow) is
 * marked; each column links to the filing its figures were read from, a figure's own filing (a
 * later one, for a restated value) in its tooltip. The foot names the source: the SEC (never its
 * seal or logos), the ESEF reports via filings.xbrl.org, or the price provider. Left out for a
 * fund, and for a company no source has statements of.
 */
export function FinancialStatementsModule({ listingId, onExplore }: { listingId: string; onExplore: () => void }) {
  const [frequency, setFrequency] = useState<StatementsFrequency>("annual");
  // undefined while it's read, null when it couldn't be.
  const data = useStatements(listingId, frequency);
  // A company with no quarters (an ESEF one) keeps its annual table rather than an empty one.
  if (data === null || (data && frequency === "annual" && data.periods.length === 0)) return null;
  const currency = data ? currencyOf(data.periods) : null;

  return (
    <Module>
      <ModuleHead
        title={currency ? `Financial statements · ${currency}` : "Financial statements"}
        desc={DESC}
        onExplore={data && data.periods.length > 0 ? onExplore : undefined}
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            <FrequencySwitch frequency={frequency} onChange={setFrequency} />
            <CardInfo text={infoOf(data, currency)} />
          </div>
        }
      />
      <div className={`${MODULE_BODY} flex flex-col gap-5`}>
        <StatementsBody data={data} rows={KEY_ITEMS} periods={CARD_PERIODS} />
        {data && data.source && <StatementsFoot source={data.source} />}
      </div>
    </Module>
  );
}

/**
 * FINANCIAL STATEMENTS PAGE — the full statements, a page of the asset's (`name` its title in the
 * trail, the step back to it; Esc too): the income statement, the balance sheet and the cash flow,
 * one panel each, every item and every period (ten years, twelve quarters), by year or quarter
 * (one switch for the three), the values scrolling sideways beside the labels where they don't
 * fit. The page opens at its top, and the asset's page comes back where it was left.
 */
export function FinancialStatementsPage({ listingId, name, onClose }: { listingId: string; name: string; onClose: () => void }) {
  const [frequency, setFrequency] = useState<StatementsFrequency>("annual");
  const data = useStatements(listingId, frequency);
  useEffect(() => {
    const before = window.scrollY;
    window.scrollTo({ top: 0 });
    return () => {
      requestAnimationFrame(() => window.scrollTo({ top: before }));
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const currency = data ? currencyOf(data.periods) : null;
  const sourceNote = data?.source === "sec_filing" ? "From the company's filings with the SEC"
    : data?.source === "esef_report" ? "From the company's annual financial reports (ESEF)"
    : data?.source === "price_provider" ? "From Yahoo Finance" : undefined;

  return (
    <div className="space-y-[22px]">
      <PageHeader
        crumbs={[{ label: name, onClick: onClose }]}
        title="Financial statements"
        note={[sourceNote, currency && `amounts in ${currency}`].filter(Boolean).join(" · ") || undefined}
      />
      {data === null ? (
        <Module><div className={`${MODULE_BODY} pt-[22px]`}><p className="text-[12.5px] text-[#857e78]">The statements couldn&apos;t be read.</p></div></Module>
      ) : STATEMENTS.map((statement, i) => (
        <ExplorePanel
          key={statement.key}
          title={statement.title === "Income" ? "Income statement" : statement.title}
          desc={DESC}
          right={
            <div className="flex flex-wrap items-center gap-1.5">
              <FrequencySwitch frequency={frequency} onChange={setFrequency} />
              {i === 0 && <CardInfo text={infoOf(data, currency)} />}
            </div>
          }
        >
          <div className={`${MODULE_BODY} flex flex-col gap-5`}>
            <StatementsBody data={data} rows={statement.items} periods={Infinity} />
            {i === STATEMENTS.length - 1 && data && data.source && <StatementsFoot source={data.source} />}
          </div>
        </ExplorePanel>
      ))}
    </div>
  );
}

// Every row the same height, the labels' and the values', so the two sides line up.
const ROW = "h-10 border-b border-[#EEE9DD] last:border-b-0";
const HEAD_ROW = "h-8 border-b border-[#EEE9DD]";

/**
 * A statement as a table: its labels in a column of their own that stays put, its periods'
 * values beside them in the only part that scrolls sideways (a narrow screen, twelve quarters),
 * so a value never passes over a label.
 */
function StatementTable({ data, rows: items, periods: shown }: { data: FinancialStatements; rows: [string, string][]; periods: number }) {
  const periods = data.periods.slice(0, shown);
  const byPeriod = periods.map((period) => new Map(period.figures.map((f) => [f.item, f])));
  const rows = items.filter(([item]) => byPeriod.some((figures) => figures.has(item)));
  if (rows.length === 0) {
    return <p className="text-[12.5px] text-[#857e78]">The company&apos;s filings report none of these items.</p>;
  }
  return (
    // The values' side scrolls with a trackpad, a touch or shift and the wheel, its scrollbar
    // hidden; the labels' column runs as tall as it.
    <div className="flex items-stretch">
      <div className="shrink-0 border-r border-[#EEE9DD]">
        <table className="border-collapse">
          <thead>
            <tr className={HEAD_ROW}><th scope="col" /></tr>
          </thead>
          <tbody>
            {rows.map(([item, label]) => (
              <tr key={item} className={ROW}>
                <th scope="row" className="pr-4 text-left text-[12.5px] font-normal text-[#78716c] whitespace-nowrap">{label}</th>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className={HEAD_ROW}>
              {periods.map((period) => {
                const filing = filingOf(period);
                const label = periodLabel(period, data.frequency);
                return (
                  <th key={period.end} scope="col" title={`${dayLabel(period.start)} to ${dayLabel(period.end)}`} className="pl-4 text-right text-[11px] font-semibold text-[#857e78] whitespace-nowrap">
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
            {rows.map(([item]) => (
              <tr key={item} className={ROW}>
                {byPeriod.map((figures, i) => {
                  const figure = figures.get(item);
                  return (
                    <td
                      key={periods[i].end}
                      title={figure ? (figure.computed ? "Computed" : figure.filed ? `Filed ${dayLabel(figure.filed)}` : undefined) : undefined}
                      className="pl-4 text-right text-[13px] font-bold tabular-nums text-[#1c1917] whitespace-nowrap"
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
