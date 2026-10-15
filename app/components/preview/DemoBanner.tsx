// components/preview/DemoBanner.tsx
"use client";

import { Eye } from "lucide-react";

/**
 * DEMO BANNER — the strip at the top of every dashboard page for a demo account (see lib/demo):
 * it can look at everything, including the previews of what's coming, but change nothing.
 */
export function DemoBanner() {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl bg-[#1c1917] px-4 py-3 text-white">
      <span className="w-8 h-8 rounded-xl bg-[#C49A3C]/15 text-[#C49A3C] flex items-center justify-center shrink-0">
        <Eye className="h-4 w-4" />
      </span>
      <p className="text-[13px] leading-snug">
        <span className="font-black">Demo account — read only.</span>{" "}
        <span className="text-stone-400">Explore everything, including features still in preview; changes can&apos;t be saved.</span>
      </p>
    </div>
  );
}

/** The tooltip on a control a demo account can't use. */
export const DEMO_DISABLED_TITLE = "Not available on a demo account";
