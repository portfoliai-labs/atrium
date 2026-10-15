"use client";

import { Fragment, useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { useSectionTrail } from "./SectionTrail";

export interface Crumb {
  label: string;
  onClick: () => void;
}

/**
 * BREADCRUMB — where a page sits in its section: "Wealth › All portfolios › Long-term ETF ›
 * Performance", "Plan › Strategy"… Drawn at the top of the page, each step above the current one
 * a way back to it (the browser's back button goes up a level too, see lib/dashboardHistory), with
 * the page's own action (`right`: a month's report link, "New backtest") at the top right. Also
 * published to SectionTrail, for anything outside the page that follows where it is.
 */
export function Breadcrumb({ trail, current, right }: { trail: Crumb[]; current: string; right?: React.ReactNode }) {
  const { setTrail } = useSectionTrail();

  // Published by label, not by the crumbs themselves: their handlers are new on every render,
  // and whoever reads the trail only needs to call the latest ones.
  const trailRef = useRef(trail);
  useEffect(() => {
    trailRef.current = trail;
  });
  const labelsKey = trail.map((c) => c.label).join("\u0000");
  useEffect(() => {
    setTrail({ labels: labelsKey ? labelsKey.split("\u0000") : [], current, go: (i) => trailRef.current[i]?.onClick() });
    return () => setTrail(null);
  }, [labelsKey, current, setTrail]);

  // A section's first page has nothing above it: only its action, if any.
  if (trail.length === 0) return right ? <div className="flex justify-end">{right}</div> : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 min-w-0 text-xs font-semibold text-[#78716c]">
        {trail.map((c, i) => (
          <Fragment key={`${i}:${c.label}`}>
            <button type="button" onClick={c.onClick} className="rounded hover:text-[#8A6A28] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40">
              {c.label}
            </button>
            <ChevronRight className="h-3 w-3 text-[#a8a29e] shrink-0" aria-hidden />
          </Fragment>
        ))}
        <span aria-current="page" className="text-[#1c1917] truncate">{current}</span>
      </nav>
      {right}
    </div>
  );
}
