// components/dashboard/CompanyDescriptionModule.tsx
"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { InstrumentProfile, ProfileSourceRef } from "../../models/InstrumentProfile";
import { CardFoot, CardInfo, LINK_CLASS, SourceCitation } from "./InstrumentProfileModule";
import { MODULE_BODY, Module, ModuleHead } from "./PerformanceSection";

const CC_BY_SA_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

// Past this many characters the text opens on its first lines, with "Read more".
const LONG_DESCRIPTION = 480;

// A source's date (YYYY-MM-DD) as the day it names, whatever the viewer's time zone.
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * COMPANY DESCRIPTION MODULE — what a company does, on its asset page (AssetExplore), beside its
 * Key facts: a paragraph an AI model summarised from its latest annual report (filed with the
 * SEC, a 10-K or a foreign company's 20-F, the SEC named as the source; or an EU company's ESEF
 * report), the report linked; else its English Wikipedia article's lead as written, attributed
 * as its licence asks (the article's revision, its authors, CC BY-SA 4.0). A fund's: what it aims
 * to do, an AI model's summary of its KID's objectives, the KID linked ("About the fund"). A long
 * one opens on its first lines, so the row stays as tall as the facts; an AI's summary is marked
 * as such in the tip by its title, the source at the card's foot. A crypto asset's: what it is,
 * its Wikipedia article's lead ("About the asset"). Nothing for an asset census has no description
 * of.
 */
export function CompanyDescriptionModule({ profile }: { profile: InstrumentProfile | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!profile?.description) return null;
  const source = profile.sources.description;
  const fromWikipedia = source?.source === "wikipedia";
  const fromKid = source?.source === "issuer_kid";
  const isCrypto = profile.category === "crypto";
  const long = profile.description.length > LONG_DESCRIPTION;
  const desc = fromKid ? "What it aims to do, from its key information document."
    : isCrypto ? "What it is, from its Wikipedia article."
    : fromWikipedia ? "What it does, from its Wikipedia article."
    : "What it does, from its latest annual report.";
  const info = source && !fromWikipedia
    ? `${desc}\n\nSummarised by an AI model from ${fromKid ? "the fund\u2019s key information document" : "the company\u2019s annual report"}: it may be wrong, so check it against the document linked.`
    : desc;

  return (
    <Module className="flex flex-col">
      <ModuleHead title={fromKid ? "About the fund" : isCrypto ? "About the asset" : "About the company"} desc={desc} right={<CardInfo text={info} />} />
      <div className={`${MODULE_BODY} flex flex-1 flex-col gap-5`}>
        <div>
          {/* Collapsed, the first lines fading out: a height, not a line clamp, as it can be several paragraphs. */}
          <div className={`space-y-3 ${long && !expanded ? "max-h-[12.5rem] overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]" : ""}`}>
            {profile.description.split(/\n\s*\n/).map((paragraph, i) => (
              <p key={i} className="text-[13.5px] leading-relaxed text-[#44403c]">{paragraph}</p>
            ))}
          </div>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-1.5 text-[12px] font-bold text-[#C49A3C] hover:text-[#8A6A28] transition-colors"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
        {source && (
          <CardFoot>
            {fromWikipedia ? (
              <p><WikipediaAttribution source={source} subject={isCrypto ? "the asset" : "the company"} /></p>
            ) : (
              <p className="flex flex-wrap gap-x-3 gap-y-0.5">
                <span className="font-semibold text-[#a8a29e]">Source</span>
                <SourceCitation source={source} />
              </p>
            )}
          </CardFoot>
        )}
      </div>
    </Module>
  );
}

/**
 * Wikipedia's text as CC BY-SA 4.0 asks it attributed: the article (its revision read, linked),
 * its authors (its history) and the licence (linked).
 */
function WikipediaAttribution({ source, subject }: { source: ProfileSourceRef; subject: string }) {
  const title = articleTitle(source.url);
  const history = title ? `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title.replaceAll(" ", "_"))}&action=history` : null;
  return (
    <span>
      From the Wikipedia article{" "}
      {source.url ? (
        <a href={source.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          {title ? `“${title}”` : `on ${subject}`}<ExternalLink className="h-2.5 w-2.5 shrink-0" />
        </a>
      ) : `on ${subject}`}
      {source.asOf && <> (revision of {dayLabel(source.asOf)})</>}
      {history && (
        <>, by <a href={history} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>its authors</a></>
      )}
      , licensed under{" "}
      <a href={CC_BY_SA_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>CC BY-SA 4.0</a>.
    </span>
  );
}

/** The article's title from its revision's URL (…/index.php?title=Prysmian_Group&oldid=…). */
function articleTitle(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get("title")?.replaceAll("_", " ") ?? null;
  } catch {
    return null;
  }
}
