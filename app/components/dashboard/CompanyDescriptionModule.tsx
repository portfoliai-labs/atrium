// components/dashboard/CompanyDescriptionModule.tsx
"use client";

import { useState } from "react";
import type { InstrumentProfile } from "../../models/InstrumentProfile";
import { CardFoot, CardInfo, SourceCitation } from "./InstrumentProfileModule";
import { MODULE_BODY, Module, ModuleHead } from "./PerformanceSection";

// Past this many characters the paragraph opens on its first lines, with "Read more".
const LONG_DESCRIPTION = 480;

/**
 * COMPANY DESCRIPTION MODULE — what a company filing with the SEC does, in a paragraph an AI model
 * summarised from its latest annual report (a 10-K, a foreign company's 20-F), on its asset page
 * (AssetExplore), beside its Key facts: a long one opens on its first lines, so the row stays as
 * tall as the facts. Marked as the AI's in the tip by its title; at its foot the report, linked,
 * and the SEC named as the source, as its terms ask. Nothing for an asset census has no description of.
 */
export function CompanyDescriptionModule({ profile }: { profile: InstrumentProfile | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!profile?.description) return null;
  const source = profile.sources.description;
  const long = profile.description.length > LONG_DESCRIPTION;

  return (
    <Module className="flex flex-col">
      <ModuleHead
        title="About the company"
        desc="What it does, from its latest annual report."
        right={<CardInfo text={"What it does, from its latest annual report.\n\nSummarised by an AI model from the company's annual report: it may be wrong, so check it against the report linked."} />}
      />
      <div className={`${MODULE_BODY} flex flex-1 flex-col gap-5`}>
        <div>
          <p className={`text-[13.5px] leading-relaxed text-[#44403c] ${long && !expanded ? "line-clamp-[8]" : ""}`}>{profile.description}</p>
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
            <p className="flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="font-semibold text-[#a8a29e]">Source</span>
              <SourceCitation source={source} />
            </p>
          </CardFoot>
        )}
      </div>
    </Module>
  );
}
