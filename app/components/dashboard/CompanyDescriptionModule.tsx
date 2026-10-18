// components/dashboard/CompanyDescriptionModule.tsx
"use client";

import type { InstrumentProfile } from "../../models/InstrumentProfile";
import { AiBadge, SourceCitation } from "./InstrumentProfileModule";
import { MODULE_BODY, Module, ModuleHead, NoteS } from "./PerformanceSection";

/**
 * COMPANY DESCRIPTION MODULE — what a company filing with the SEC does, in a paragraph an AI model
 * summarised from its latest annual report (a 10-K, a foreign company's 20-F), on its asset page
 * (AssetExplore).
 * Marked as the AI's, with the report linked and the SEC named as the source, as its terms ask.
 * Nothing for an asset census has no description of.
 */
export function CompanyDescriptionModule({ profile }: { profile: InstrumentProfile | null }) {
  if (!profile?.description) return null;
  const source = profile.sources.description;

  return (
    <Module className="md:col-span-2">
      <ModuleHead title="About the company" desc="What it does, from its latest annual report." />
      <div className={`${MODULE_BODY} space-y-3`}>
        <p className="text-[14px] leading-relaxed text-[#1c1917]">{profile.description}</p>
        <div className="space-y-1 border-t border-[#EEE9DD] pt-3">
          <NoteS>
            <AiBadge /> Summarised by an AI model from the company&apos;s annual report: check it against the report linked.
          </NoteS>
          {source && <NoteS><SourceCitation source={source} /></NoteS>}
        </div>
      </div>
    </Module>
  );
}
