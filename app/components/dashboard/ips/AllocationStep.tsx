"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { ALLOCATION_PRESETS, ASSET_CLASSES, allocationTotal } from "../../../lib/ips";
import type { AssetClassId } from "../../../models/InvestorPolicy";
import { FieldGroup, NumberInput } from "./fields";
import type { StepProps } from "./steps";

const TRACK = "#ece6d6";

// Only the two outer ends of the bar are rounded; segments in between stay square.
const endRadius = (first: boolean, last: boolean) => `${first ? 4 : 0}px ${last ? 4 : 0}px ${last ? 4 : 0}px ${first ? 4 : 0}px`;

/** The target mix as one bar, one segment per asset class, with whatever is left over as an empty track. */
export function AllocationBar({ targets }: { targets: Record<AssetClassId, number | null> }) {
  const [hovered, setHovered] = useState<AssetClassId | "left" | null>(null);
  const segments = ASSET_CLASSES.filter((c) => (targets[c.id] ?? 0) > 0);
  const total = segments.reduce((acc, c) => acc + (targets[c.id] ?? 0), 0);
  const left = Math.round((100 - total) * 100) / 100;

  const caption =
    hovered === "left"
      ? `Not allocated yet ${left}%`
      : hovered
      ? `${ASSET_CLASSES.find((c) => c.id === hovered)?.label} ${targets[hovered]}%`
      : null;

  return (
    <div className="space-y-3">
      <div className="h-5 text-xs font-bold text-[#1c1917]" aria-live="polite">{caption}</div>
      {/* The 2px gap between segments is the surface showing through, not a stroke. */}
      <div
        className="flex gap-0.5 h-5"
        role="img"
        aria-label={`Target allocation: ${segments.map((c) => `${c.label} ${targets[c.id]}%`).join(", ") || "nothing set yet"}`}
        onMouseLeave={() => setHovered(null)}
      >
        {segments.map((c, i) => (
          <div
            key={c.id}
            onMouseEnter={() => setHovered(c.id)}
            style={{
              flexGrow: targets[c.id] ?? 0, flexBasis: 0, backgroundColor: c.color,
              borderRadius: endRadius(i === 0, i === segments.length - 1 && left <= 0),
            }}
            className="min-w-0.5"
          />
        ))}
        {left > 0 && (
          <div
            onMouseEnter={() => setHovered("left")}
            style={{ flexGrow: left, flexBasis: 0, backgroundColor: TRACK, borderRadius: endRadius(segments.length === 0, true) }}
            className="min-w-0.5"
          />
        )}
      </div>
    </div>
  );
}

export function AllocationStep({ policy, update }: StepProps) {
  const targets = policy.allocation.targets;
  const total = allocationTotal(policy);
  const diff = Math.round((100 - total) * 100) / 100;

  const setTarget = (id: AssetClassId, value: number | null) =>
    update((p) => ({ ...p, allocation: { targets: { ...p.allocation.targets, [id]: value } } }));

  const applyPreset = (presetTargets: Record<AssetClassId, number>) =>
    update((p) => ({ ...p, allocation: { targets: { ...presetTargets } } }));

  return (
    <div className="space-y-8">
      <FieldGroup label="Start from a template" hint="Fills the weights below; adjust them freely afterwards. Equities / bonds / cash.">
        <div className="flex flex-wrap gap-2">
          {ALLOCATION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.targets)}
              className="px-4 py-2 rounded-full border border-[rgba(196,154,60,0.3)] bg-white text-[13px] font-semibold text-[#44403c] hover:border-[#C49A3C] hover:text-[#C49A3C] transition-all"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </FieldGroup>

      <div className="space-y-6">
        <AllocationBar targets={targets} />

        {/* The weights double as the chart's table view and its legend: every class named, its swatch beside it. */}
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {ASSET_CLASSES.map((c) => (
            <li key={c.id} className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-[3px] shrink-0" style={{ backgroundColor: c.color }} aria-hidden />
              <span className="flex-1 text-sm font-bold text-[#1c1917]">{c.label}</span>
              <div className="w-32">
                <NumberInput
                  aria-label={`${c.label} target weight`}
                  value={targets[c.id]}
                  onChange={(v) => setTarget(c.id, v)}
                  placeholder="0"
                  suffix="%"
                  max={100}
                  step={0.5}
                />
              </div>
            </li>
          ))}
        </ul>

        <div
          className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-sm font-bold ${
            diff === 0
              ? "bg-emerald-50 border-emerald-100 text-emerald-700"
              : "bg-[#F7F5EF] border-[rgba(196,154,60,0.2)] text-[#44403c]"
          }`}
        >
          {diff === 0 ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>
            Total {total}% ·{" "}
            {diff === 0 ? "adds up to 100%" : diff > 0 ? `${diff}% left to allocate` : `${Math.abs(diff)}% over`}
          </span>
        </div>
      </div>
    </div>
  );
}
