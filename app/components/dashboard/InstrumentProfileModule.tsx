// components/dashboard/InstrumentProfileModule.tsx
"use client";

import { ExternalLink, Info } from "lucide-react";
import { STRATEGY_CATEGORY_LABELS } from "../../models/Strategy";
import type { Listing } from "../../models/Listing";
import {
  CONSENSUS_LABELS, DISTRIBUTION_LABELS, FACTOR_LABELS, INDEX_SIZE_LABELS, PROFILE_ASSET_CLASS_LABELS, PROFILE_SOURCE_LABELS,
  INDUSTRY_LABELS, REBALANCING_LABELS, REGION_LABELS, REPLICATION_LABELS, SECTOR_LABELS, WEIGHTING_LABELS, labelOf,
  type InstrumentProfile, type ProfileSourceRef,
} from "../../models/InstrumentProfile";
import { InfoTip, MODULE_BODY, Module, ModuleHead } from "./PerformanceSection";

// What a FIRDS citation links to: its register (its reuse is authorised with ESMA acknowledged as
// the source).
const ESMA_FIRDS_URL = "https://registers.esma.europa.eu/publication/searchRegister?core=esma_registers_firds";

const AI_TIP = "Read from the source document by an AI model: it may be wrong, so check it against the document.";
const IN_REVIEW_TIP = "Provisional: its sources disagree or it isn't well established yet, and it is being reviewed.";

export const LINK_CLASS = "inline-flex items-center gap-0.5 underline decoration-[#E0DACC] underline-offset-2 hover:text-[#C49A3C] hover:decoration-[#C49A3C] transition-colors";

// A source's date (YYYY-MM-DD) as the day it names, whatever the viewer's time zone.
const sourceDateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

/** A launch as precise as its source states it (ISO 8601: 2009-01-03, 2015-07, 2015): Jan 3, 2009; July 2015; 2015. */
const launchLabel = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  if (!month) return String(year);
  const date = new Date(year, month - 1, day || 1);
  return day
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

/** A company's website as a link (http or https only) and its host to show; null for anything else. */
const websiteLink = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return { href: parsed.href, host: parsed.hostname.replace(/^www\./, "") };
  } catch {
    return null;
  }
};

/** One of the profile's facts: its label, its value (linked to `href`) and where the value comes from. */
type ProfileFact = { key: string; label: string; value: string; href?: string; source?: ProfileSourceRef };

/**
 * INSTRUMENT PROFILE MODULE — what census knows the instrument is, as two cards side by side:
 * KEY FACTS (its category; a fund's costs, distribution, domicile, replication, hedge and risk
 * class; a company's GICS sector and industry, head office, employees and website; a crypto
 * asset's launch, consensus, maximum supply, website and white paper) and, for a
 * fund tracking one, INDEX (the index it tracks and how that's built). Each a table, each value
 * marked with the number of its source, the sources listed once at the card's foot: ESMA's FIRDS
 * by name, a KID or an index methodology linked with its date. A value an AI model read is marked
 * as such, one under review shown as provisional. Under Key facts' sources, the registries the
 * listing's reference data comes from, as their terms ask: ESMA's FIRDS for a security, the SEC's
 * EDGAR too for a US listing.
 */
export function InstrumentProfileModule({ profile, listing }: { profile: InstrumentProfile | null; listing: Listing | null }) {
  const facts = profile ? profileFacts(profile) : [];
  const index = profile?.index ?? null;
  const isSecurity = listing?.kind === "security";
  // Key facts only with something to show: no card saying nothing is known.
  const showFacts = facts.length > 0;
  if (!showFacts && !index) return null;

  return (
    <>
      {showFacts && (
        <FactsCard
          title="Key facts"
          desc="What the instrument is, each value marked with the number of its source, listed at the foot."
          facts={facts}
          attribution={isSecurity
            ? `Reference data from ESMA's Financial Instruments Reference Data System (FIRDS), source: ESMA${listing?.country === "US" ? "; and the U.S. Securities and Exchange Commission's EDGAR, source: SEC" : ""}.`
            : undefined}
        />
      )}
      {index && (
        <FactsCard
          title="Index"
          desc="The index the fund tracks and how it's built, each value marked with the number of its source, listed at the foot."
          facts={[{ key: "name", label: "Tracks", value: index.name, source: profile?.sources.index }, ...indexProfileFacts(index)]}
        />
      )}
    </>
  );
}

/**
 * One of the profile's cards: its facts as a table and, at the card's foot (level with its
 * neighbours'), their sources numbered on a line. What the card is, what the AI and provisional
 * marks mean when a value carries one, and `attribution` (the registries the reference data comes
 * from, as their terms ask) are in the tip by its title, as on the portfolio's modules.
 */
function FactsCard({ title, desc, facts, attribution }: { title: string; desc: string; facts: ProfileFact[]; attribution?: string }) {
  const refs = sourceRefs(facts.map((f) => f.source));
  const { sources } = refs;
  const info = [
    desc,
    sources.some((s) => s.ai) && `AI: ${AI_TIP}`,
    sources.some((s) => s.inReview) && IN_REVIEW_TIP,
    attribution,
  ].filter(Boolean).join("\n\n");

  return (
    <Module className="flex flex-col">
      <ModuleHead title={title} desc={desc} right={<CardInfo text={info} />} />
      <div className={`${MODULE_BODY} flex flex-1 flex-col gap-5`}>
        <FactTable facts={facts} refOf={refs.numberOf} />
        {sources.length > 0 && (
          <CardFoot>
            <p className="flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="font-semibold text-[#a8a29e]">Sources</span>
              {sources.map((source, i) => (
                <span key={i}><span className="tabular-nums text-[#a8a29e]">[{i + 1}]</span> <SourceCitation source={source} /></span>
              ))}
            </p>
          </CardFoot>
        )}
      </div>
    </Module>
  );
}

/** The "i" by a profile card's title: what the card is and its notes, on hovering it. */
export function CardInfo({ text }: { text: string }) {
  return (
    <InfoTip text={text}>
      <Info className="h-3.5 w-3.5 text-[#a8a29e] hover:text-[#78716c] cursor-help transition-colors" />
    </InfoTip>
  );
}

/** A profile card's foot: its sources and notes, small, under a hairline, at the card's bottom. */
export function CardFoot({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto space-y-1.5 border-t border-[#EEE9DD] pt-3 text-[11px] leading-relaxed text-[#78716c]">{children}</div>;
}

/**
 * The values' sources, each once (one KID cited by five values is one reference), numbered in
 * the order they're first cited; `numberOf` gives a value's.
 */
function sourceRefs(cited: (ProfileSourceRef | undefined)[]) {
  const keyOf = (s: ProfileSourceRef) => `${s.source}|${s.url ?? ""}|${s.asOf ?? ""}`;
  const numbers = new Map<string, number>();
  const sources: ProfileSourceRef[] = [];
  for (const s of cited) {
    if (!s || numbers.has(keyOf(s))) continue;
    sources.push(s);
    numbers.set(keyOf(s), sources.length);
  }
  return { sources, numberOf: (s?: ProfileSourceRef) => (s ? numbers.get(keyOf(s)) : undefined) };
}

function profileFacts(p: InstrumentProfile): ProfileFact[] {
  const s = p.sources;
  // The city and the country, either alone when the other isn't known (Santa Clara, United States).
  const headOffice = [p.headquartersCity, p.headquarters && countryName(p.headquarters)].filter(Boolean).join(", ") || null;
  const website = p.website ? websiteLink(p.website) : null;
  const whitePaper = p.whitePaper ? websiteLink(p.whitePaper) : null;
  // A capped supply's cap; "No cap" for an uncapped one (Ether). The crypto fields are checked
  // with != null: a profile from a backend that doesn't send them yet has them undefined.
  const maxSupply = p.supplyCapped === false ? "No cap"
    : p.maxSupply != null ? p.maxSupply.toLocaleString("en-US", { maximumFractionDigits: 0 }) : null;
  const facts: (ProfileFact | false)[] = [
    p.category !== null && { key: "category", label: "Category", value: STRATEGY_CATEGORY_LABELS[p.category] ?? p.category, source: s.category },
    p.terPct !== null && { key: "terPct", label: "Ongoing costs (TER)", value: `${p.terPct.toFixed(2)}% a year`, source: s.terPct },
    p.distribution !== null && { key: "distribution", label: "Income", value: labelOf(DISTRIBUTION_LABELS, p.distribution), source: s.distribution },
    p.assetClass !== null && { key: "assetClass", label: "Invests in", value: labelOf(PROFILE_ASSET_CLASS_LABELS, p.assetClass), source: s.assetClass },
    p.domicile !== null && { key: "domicile", label: "Domicile", value: countryName(p.domicile), source: s.domicile },
    p.replication !== null && { key: "replication", label: "Replication", value: labelOf(REPLICATION_LABELS, p.replication), source: s.replication },
    p.currencyHedged !== null && { key: "currencyHedged", label: "Currency hedged", value: p.currencyHedged ? "Yes" : "No", source: s.currencyHedged },
    p.riskIndicator !== null && { key: "riskIndicator", label: "Risk class", value: `${p.riskIndicator} of 7`, source: s.riskIndicator },
    p.sector !== null && { key: "sector", label: "Sector", value: labelOf(SECTOR_LABELS, p.sector), source: s.sector },
    p.industry !== null && { key: "industry", label: "Industry", value: labelOf(INDUSTRY_LABELS, p.industry), source: s.industry },
    headOffice !== null && { key: "headquarters", label: "Head office", value: headOffice, source: s.headquarters ?? s.headquartersCity },
    p.employees !== null && { key: "employees", label: "Employees", value: p.employees.toLocaleString("en-US"), source: s.employees },
    p.launched != null && { key: "launched", label: "Launched", value: launchLabel(p.launched), source: s.launched },
    p.consensus != null && { key: "consensus", label: "Consensus", value: labelOf(CONSENSUS_LABELS, p.consensus), source: s.consensus },
    maxSupply !== null && { key: "maxSupply", label: "Maximum supply", value: maxSupply, source: s.maxSupply ?? s.supplyCapped },
    website !== null && { key: "website", label: "Website", value: website.host, href: website.href, source: s.website },
    whitePaper !== null && { key: "whitePaper", label: "White paper", value: "Read", href: whitePaper.href, source: s.whitePaper },
  ];
  return facts.filter((f): f is ProfileFact => !!f);
}

function indexProfileFacts(index: NonNullable<InstrumentProfile["index"]>): ProfileFact[] {
  const s = index.sources;
  // No factors with a source for them: an index weighted by market capitalisation alone.
  const factors = index.factors.length > 0
    ? index.factors.map((f) => labelOf(FACTOR_LABELS, f)).join(", ")
    : s.factors ? "None" : null;
  const facts: (ProfileFact | false)[] = [
    factors !== null && { key: "factors", label: "Factor tilts", value: factors, source: s.factors },
    index.weighting !== null && { key: "weighting", label: "Weighting", value: labelOf(WEIGHTING_LABELS, index.weighting), source: s.weighting },
    index.region !== null && { key: "region", label: "Region", value: labelOf(REGION_LABELS, index.region), source: s.region },
    index.size !== null && { key: "size", label: "Company size", value: labelOf(INDEX_SIZE_LABELS, index.size), source: s.size },
    index.rebalancing !== null && { key: "rebalancing", label: "Rebalanced", value: labelOf(REBALANCING_LABELS, index.rebalancing), source: s.rebalancing },
  ];
  return facts.filter((f): f is ProfileFact => !!f);
}

// The facts as a table, as the Profile beside it: the label on the left, the value (wrapping, not
// cut) on the right with its badges and the number of its source.
function FactTable({ facts, refOf }: { facts: ProfileFact[]; refOf: (s?: ProfileSourceRef) => number | undefined }) {
  return (
    <table className="w-full table-fixed border-collapse">
      <tbody>
        {facts.map((f) => <FactRow key={f.key} fact={f} n={refOf(f.source)} />)}
      </tbody>
    </table>
  );
}

// A provisional value is drawn lighter, with a dashed underline, next to its badge.
function FactRow({ fact, n }: { fact: ProfileFact; n?: number }) {
  const provisional = !!fact.source?.inReview;
  return (
    <tr className="border-b border-[#EEE9DD] last:border-b-0">
      <th scope="row" className="w-28 py-2.5 pr-4 text-left align-top text-[12.5px] font-normal text-[#78716c]">{fact.label}</th>
      <td className="py-2.5 text-right align-top">
        <span className="inline-flex flex-wrap items-center justify-end gap-1.5 max-w-full">
          <span className={`text-[13.5px] font-bold break-words min-w-0 ${provisional ? "text-[#78716c] underline decoration-dashed decoration-[#C49A3C]/60 underline-offset-4" : "text-[#1c1917]"}`}>
            {fact.href ? (
              <a href={fact.href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                {fact.value}<ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ) : fact.value}
            <RefMark n={n} />
          </span>
          {fact.source?.ai && <AiBadge />}
          {provisional && <ProvisionalBadge />}
        </span>
      </td>
    </tr>
  );
}

// A value's source, by its number in the list at the module's foot.
function RefMark({ n }: { n?: number }) {
  if (n === undefined) return null;
  return <sup className="ml-0.5 text-[9.5px] font-semibold text-[#a8a29e] no-underline">[{n}]</sup>;
}

/**
 * Where a value comes from: ESMA's FIRDS as its terms ask (ESMA named the source, its register
 * linked), a company's annual report with the SEC named as its source (its filing linked), an EU
 * company's ESEF report with the year it covers (the report linked, filings.xbrl.org named), a
 * document (a KID, a methodology) linked by its url, and the day its source dates it.
 */
export function SourceCitation({ source }: { source: ProfileSourceRef }) {
  const date = source.asOf ? sourceDateLabel(source.asOf) : null;
  if (source.source === "esma_firds") {
    return (
      <span>
        Source: ESMA (<a href={source.url ?? ESMA_FIRDS_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>FIRDS</a>)
        {date && <> · {date}</>}
      </span>
    );
  }
  if (source.source === "sec_filing") {
    return (
      <span>
        Source: SEC (
        {source.url ? (
          <a href={source.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS} title="Open the annual report on EDGAR">
            annual report<ExternalLink className="h-2.5 w-2.5 shrink-0" />
          </a>
        ) : "annual report"})
        {date && <> · filed {date}</>}
      </span>
    );
  }
  if (source.source === "esef_report") {
    return (
      <span>
        Source: the company&apos;s{" "}
        {source.url ? (
          <a href={source.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS} title="Open the annual financial report on filings.xbrl.org">
            annual financial report<ExternalLink className="h-2.5 w-2.5 shrink-0" />
          </a>
        ) : "annual financial report"}{" "}
        (ESEF, via filings.xbrl.org)
        {date && <> · year ended {date}</>}
      </span>
    );
  }
  const label = PROFILE_SOURCE_LABELS[source.source] ?? PROFILE_SOURCE_LABELS.unknown;
  return (
    <span>
      {source.url ? (
        <a href={source.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS} title={`Open the ${label.toLowerCase()}`}>
          {label}<ExternalLink className="h-2.5 w-2.5 shrink-0" />
        </a>
      ) : label}
      {date && <> · {date}</>}
    </span>
  );
}

export function AiBadge() {
  return (
    <InfoTip text={AI_TIP}>
      <span className="inline-flex items-center rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-1.5 py-px text-[9.5px] font-black uppercase tracking-[0.08em] text-[#4338CA] cursor-help">
        AI
      </span>
    </InfoTip>
  );
}

function ProvisionalBadge() {
  return (
    <InfoTip text={IN_REVIEW_TIP}>
      <span className="inline-flex items-center gap-0.5 rounded-full border border-[#F2DFB5] bg-[#FBF5E6] px-1.5 py-px text-[9.5px] font-black uppercase tracking-[0.08em] text-[#A07A22] cursor-help">
        <Info className="h-2.5 w-2.5" /> Provisional
      </span>
    </InfoTip>
  );
}
