// components/dashboard/StrategyProfile.tsx
"use client";

import { allocationLabel } from "../../lib/classifications";
import type { ProfileDimension, ProfileShare, StrategyProfile } from "../../models/PublishedStrategy";

// What each dimension is called on a catalog card.
const DIMENSION_TITLES: Record<ProfileDimension, string> = {
  category: "Category",
  asset_class: "Asset class",
  region: "Region",
  sector: "Sector",
  index_factors: "Index factors",
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
