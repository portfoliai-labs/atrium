// components/dashboard/InstrumentProfileModule.tsx
"use client";

import { ExternalLink, Info } from "lucide-react";
import { STRATEGY_CATEGORY_LABELS } from "../../models/Strategy";
import type { Listing } from "../../models/Listing";
import {
  DISTRIBUTION_LABELS, FACTOR_LABELS, INDEX_SIZE_LABELS, PROFILE_ASSET_CLASS_LABELS, PROFILE_SOURCE_LABELS,
  INDUSTRY_LABELS, REBALANCING_LABELS, REGION_LABELS, REPLICATION_LABELS, SECTOR_LABELS, WEIGHTING_LABELS, labelOf,
  type InstrumentProfile, type ProfileSourceRef,
} from "../../models/InstrumentProfile";
import { InfoTip, MODULE_BODY, Module, ModuleHead, NoteS } from "./PerformanceSection";

// What the attributions link to: FIRDS' register (its reuse is authorised with ESMA acknowledged
// as the source) and EDGAR (sec.gov's information may be reused citing the SEC).
const ESMA_FIRDS_URL = "https://registers.esma.europa.eu/publication/searchRegister?core=esma_registers_firds";
const SEC_EDGAR_URL = "https://www.sec.gov/edgar";

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
 * INSTRUMENT PROFILE MODULE — what census knows the instrument is (its category; a fund's costs,
 * distribution, domicile, replication, hedge, risk class and the index it tracks; a company's
 * GICS sector and industry, head office, employees and website), each value
 * citing its source: ESMA's FIRDS by name, a KID or an index methodology linked with its date.
 * A value an AI model read is marked as such, one under review shown as provisional. Below, the
 * registries the listing's reference data comes from, as their terms ask: ESMA's FIRDS for a
 * security, the SEC's EDGAR too for a US listing.
 */
export function InstrumentProfileModule({ profile, listing }: { profile: InstrumentProfile | null; listing: Listing | null }) {
  const facts = profile ? profileFacts(profile) : [];
  const indexFacts = profile?.index ? indexProfileFacts(profile.index) : [];
  const isSecurity = listing?.kind === "security";
  if (facts.length === 0 && !profile?.index && !isSecurity) return null;
  const sources = [...facts.map((f) => f.source), profile?.sources.index, ...indexFacts.map((f) => f.source)]
    .filter((s): s is ProfileSourceRef => !!s);
  const anyAi = sources.some((s) => s.ai);
  const anyInReview = sources.some((s) => s.inReview);

  return (
    <Module>
      <ModuleHead title="Key facts" desc="What the instrument is, each value with where it comes from." />
      <div className={`${MODULE_BODY} space-y-5`}>
        {facts.length > 0 && <FactGrid facts={facts} />}
        {profile?.index && (
          <div className="space-y-3">
            <p className="text-[12.5px] text-[#78716c]">
              Tracks <span className="font-bold text-[#1c1917]">{profile.index.name}</span>
              {profile.sources.index && <> · <SourceCitation source={profile.sources.index} /></>}
            </p>
            {indexFacts.length > 0 && <FactGrid facts={indexFacts} />}
          </div>
        )}
        {facts.length === 0 && !profile?.index && (
          <p className="text-[12.5px] text-[#a8a29e]">Nothing is known about this instrument yet.</p>
        )}
        {(anyAi || anyInReview || isSecurity) && (
          <div className="space-y-1 border-t border-[#EEE9DD] pt-3">
            {anyAi && <NoteS><AiBadge /> Read from the issuer&apos;s or index provider&apos;s document by an AI model: check it against the document linked.</NoteS>}
            {anyInReview && <NoteS><ProvisionalBadge /> Under review: its sources disagree or it isn&apos;t well established yet.</NoteS>}
            {isSecurity && (
              <NoteS>
                Reference data from ESMA&apos;s Financial Instruments Reference Data System (
                <a href={ESMA_FIRDS_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>FIRDS</a>
                ), source: ESMA
                {listing?.country === "US" && (
                  <>; and the U.S. Securities and Exchange Commission (
                    <a href={SEC_EDGAR_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>EDGAR</a>
                    ), source: SEC</>
                )}
                .
              </NoteS>
            )}
          </div>
        )}
      </div>
    </Module>
  );
}

function profileFacts(p: InstrumentProfile): ProfileFact[] {
  const s = p.sources;
  // The city and the country, either alone when the other isn't known (Santa Clara, United States).
  const headOffice = [p.headquartersCity, p.headquarters && countryName(p.headquarters)].filter(Boolean).join(", ") || null;
  const website = p.website ? websiteLink(p.website) : null;
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
    website !== null && { key: "website", label: "Website", value: website.host, href: website.href, source: s.website },
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

// One fact a row, as the Profile beside it: the label on the left, the value (wrapping, not cut)
// with its badges and its source under it on the right.
function FactGrid({ facts }: { facts: ProfileFact[] }) {
  return (
    <dl>
      {facts.map((f) => <FactCell key={f.key} fact={f} />)}
    </dl>
  );
}

// A provisional value is drawn lighter, with a dashed underline, next to its badge.
function FactCell({ fact }: { fact: ProfileFact }) {
  const { source } = fact;
  const provisional = !!source?.inReview;
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-4 py-2.5 border-b border-[#EEE9DD] last:border-b-0">
      <dt className="text-[12.5px] text-[#78716c]">{fact.label}</dt>
      <dd className="flex flex-col items-end gap-0.5 min-w-0 text-right">
        <span className="flex flex-wrap items-center justify-end gap-1.5 min-w-0">
          <span className={`text-[13.5px] font-bold break-words min-w-0 ${provisional ? "text-[#78716c] underline decoration-dashed decoration-[#C49A3C]/60 underline-offset-4" : "text-[#1c1917]"}`}>
            {fact.href ? (
              <a href={fact.href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                {fact.value}<ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ) : fact.value}
          </span>
          {source?.ai && <AiBadge />}
          {provisional && <ProvisionalBadge />}
        </span>
        {source && <span className="text-[11px] text-[#a8a29e] min-w-0"><SourceCitation source={source} /></span>}
      </dd>
    </div>
  );
}

/**
 * Where a value comes from: ESMA's FIRDS as its terms ask (ESMA named the source, its register
 * linked), a company's annual report with the SEC named as its source (its filing linked), a
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
