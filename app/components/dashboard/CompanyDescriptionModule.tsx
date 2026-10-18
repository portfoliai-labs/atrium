// components/dashboard/CompanyDescriptionModule.tsx
"use client";

import { ExternalLink } from "lucide-react";
import type { InstrumentProfile, ProfileSourceRef } from "../../models/InstrumentProfile";
import { AiBadge, LINK_CLASS, SourceCitation } from "./InstrumentProfileModule";
import { MODULE_BODY, Module, ModuleHead, NoteS } from "./PerformanceSection";

const CC_BY_SA_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

// A source's date (YYYY-MM-DD) as the day it names, whatever the viewer's time zone.
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * COMPANY DESCRIPTION MODULE — what a company does, on its asset page (AssetExplore): a paragraph
 * an AI model summarised from its latest annual report filed with the SEC (a 10-K, a foreign
 * company's 20-F), marked as the AI's, the report linked and the SEC named as the source; else
 * its English Wikipedia article's lead as written, attributed as its licence asks (the article's
 * revision, its authors, CC BY-SA 4.0). Nothing for an asset census has no description of.
 */
export function CompanyDescriptionModule({ profile }: { profile: InstrumentProfile | null }) {
  if (!profile?.description) return null;
  const source = profile.sources.description;
  const fromWikipedia = source?.source === "wikipedia";

  return (
    <Module className="md:col-span-2">
      <ModuleHead
        title="About the company"
        desc={fromWikipedia ? "What it does, from its Wikipedia article." : "What it does, from its latest annual report."}
      />
      <div className={`${MODULE_BODY} space-y-3`}>
        {profile.description.split(/\n\s*\n/).map((paragraph, i) => (
          <p key={i} className="text-[14px] leading-relaxed text-[#1c1917]">{paragraph}</p>
        ))}
        <div className="space-y-1 border-t border-[#EEE9DD] pt-3">
          {source && fromWikipedia && <NoteS><WikipediaAttribution source={source} /></NoteS>}
          {source && !fromWikipedia && (
            <>
              <NoteS>
                <AiBadge /> Summarised by an AI model from the company&apos;s annual report: check it against the report linked.
              </NoteS>
              <NoteS><SourceCitation source={source} /></NoteS>
            </>
          )}
        </div>
      </div>
    </Module>
  );
}

/**
 * Wikipedia's text as CC BY-SA 4.0 asks it attributed: the article (its revision read, linked),
 * its authors (its history) and the licence (linked).
 */
function WikipediaAttribution({ source }: { source: ProfileSourceRef }) {
  const title = articleTitle(source.url);
  const history = title ? `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title.replaceAll(" ", "_"))}&action=history` : null;
  return (
    <span>
      From the Wikipedia article{" "}
      {source.url ? (
        <a href={source.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          {title ? `“${title}”` : "on the company"}<ExternalLink className="h-2.5 w-2.5 shrink-0" />
        </a>
      ) : "on the company"}
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
