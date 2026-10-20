// components/dashboard/StrategyProfile.tsx
"use client";

import { allocationLabel } from "../../lib/classifications";
import type { ProfileBreakdown, ProfileDimension, ProfileShare, StrategyProfile } from "../../models/PublishedStrategy";

// What each dimension is called, saying which look through the funds (what they hold) and which
// are census' classification of the holdings themselves.
const DIMENSION_TITLES: Record<ProfileDimension, string> = {
  category: "Category",
  asset_class: "Asset class",
  region: "Region",
  sector: "Sector",
  index_factors: "Index factors",
};
const DIMENSION_NOTES: Record<ProfileDimension, string> = {
  category: "What each holding is exposed to.",
  asset_class: "Each holding's class, as its data provider names it.",
  region: "Looking through the funds to where their companies are.",
  sector: "Looking through the funds to the companies they hold.",
  index_factors: "The factor tilts of the indices the funds track; a multi-factor fund counts under each.",
};
// On a catalog card: the dimensions that tell strategies apart at a glance, the largest few of each.
const CARD_DIMENSIONS: ProfileDimension[] = ["category", "region", "index_factors"];
const CARD_SHARES = 2;

/** A share's value as the user reads it: census' values labelled, the look-through's as they are. */
function shareLabel(dimension: ProfileDimension, share: ProfileShare): string {
  if (share.value === null) return "Unknown";
  if (dimension === "category" || dimension === "index_factors") return allocationLabel(dimension, share.value);
  return share.value;
}

const pct = (v: number) => `${v.toFixed(0)}%`;

/**
 * PROFILE SUMMARY — a catalog card's line per dimension (category, region, index factors): its
 * largest values with their weight of the whole, then how many more. Plain percentages, no label
 * of the platform's; nothing until the strategy's holdings are first computed.
 */
export function ProfileSummary({ profile }: { profile: StrategyProfile | null | undefined }) {
  const rows = CARD_DIMENSIONS.flatMap((d) => profile?.breakdowns.filter((b) => b.dimension === d) ?? []);
  if (rows.length === 0) return null;
  return (
    <dl className="space-y-1">
      {rows.map((b) => {
        const known = b.shares.filter((s) => s.value !== null);
        const more = known.length - CARD_SHARES;
        return (
          <div key={b.dimension} className="flex items-baseline gap-2 min-w-0 text-[11.5px]">
            <dt className="shrink-0 w-[84px] text-[#78716c]">{DIMENSION_TITLES[b.dimension]}</dt>
            <dd className="min-w-0 truncate text-[#1c1917]" title={known.map((s) => `${shareLabel(b.dimension, s)} ${pct(s.weightPct)}`).join(" · ")}>
              {known.slice(0, CARD_SHARES).map((s) => (
                <span key={s.value} className="mr-2"><span className="font-semibold">{shareLabel(b.dimension, s)}</span> <span className="tabular-nums">{pct(s.weightPct)}</span></span>
              ))}
              {more > 0 && <span className="text-[#857e78]">+{more}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * PROFILE ROWS — a strategy page's whole profile: every dimension with each of its values and its
 * weight of the whole, the unknown last, and the cash apart.
 */
export function ProfileRows({ profile }: { profile: StrategyProfile }) {
  return (
    <div className="space-y-4">
      {profile.breakdowns.map((b: ProfileBreakdown) => (
        <div key={b.dimension}>
          <p className="text-[12px] font-bold text-slate-900">{DIMENSION_TITLES[b.dimension]}</p>
          <p className="text-[11px] text-slate-500 mb-1.5">{DIMENSION_NOTES[b.dimension]}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {b.shares.map((s) => (
              <li key={s.value ?? "\u0000unknown"} className={`text-[12.5px] ${s.value === null ? "text-slate-400" : "text-slate-700"}`}>
                {shareLabel(b.dimension, s)} <span className="font-bold tabular-nums text-slate-900">{s.weightPct.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {profile.cashWeightPct > 0 && (
        <p className="text-[12px] text-slate-500">Cash <span className="font-bold tabular-nums text-slate-900">{profile.cashWeightPct.toFixed(1)}%</span>, beside every dimension.</p>
      )}
    </div>
  );
}
