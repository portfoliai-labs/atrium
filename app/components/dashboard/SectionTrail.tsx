"use client";

import { createContext, useContext, useState } from "react";

/**
 * SECTION TRAIL — where the user is inside a section that has pages of its own (Portfolios:
 * "Portfolios / Main portfolio / Dividends"), shared between the page that knows it (through
 * Breadcrumb, which publishes it) and the Sidebar, which draws the page right under the section
 * as a row under the section's own entry. `labels` are the pages above the current one, the section itself first;
 * `go(i)` goes back to `labels[i]`. null on a section's first page, where there's nothing to show.
 */
export interface SectionTrail {
  labels: string[];
  current: string;
  go: (index: number) => void;
}

const SectionTrailContext = createContext<{ trail: SectionTrail | null; setTrail: (trail: SectionTrail | null) => void } | null>(null);

export function SectionTrailProvider({ children }: { children: React.ReactNode }) {
  const [trail, setTrail] = useState<SectionTrail | null>(null);
  return <SectionTrailContext.Provider value={{ trail, setTrail }}>{children}</SectionTrailContext.Provider>;
}

/** The trail and its setter; both no-ops outside a SectionTrailProvider. */
export function useSectionTrail() {
  return useContext(SectionTrailContext) ?? { trail: null, setTrail: () => {} };
}
