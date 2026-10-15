// lib/dashboardHistory.ts
//
// DASHBOARD HISTORY — lets the browser's back and forward buttons move through the dashboard,
// which is one URL whose pages are all component state: the section open (dashboard page), the
// page inside a section that has pages of its own (WealthSection, PlanSection…) and, on a
// portfolio's Insights, the detail view or month open over it (PerformanceSection). Each history
// entry carries where the dashboard was, under its own key next to Next.js's (Next copies its
// keys into every pushState / replaceState, so a popstate never reloads the page); each of those
// components pushes an entry when the user moves deeper and listens for popstate to show the
// entry it lands on.
//
// A detail view or a month can't be rebuilt from an entry (its state lives in the module that
// opened it), so its entry is never left behind: closing it goes back past it, and moving
// elsewhere from it replaces it (see pushDashboardEntry).

import { useEffect, useState } from "react";

export type DashboardOverlay = "explore" | "month";

export interface DashboardEntry {
  section: string;
  // The page inside the section, for a section that has pages of its own (WealthSection's
  // WealthView).
  view?: unknown;
  overlay?: DashboardOverlay;
}

export function readDashboardEntry(): DashboardEntry | null {
  if (typeof window === "undefined") return null;
  return (window.history.state?.dashboard as DashboardEntry | undefined) ?? null;
}

/**
 * Records where the dashboard is now: a new entry, or (`replace`) in place of the current one. An
 * entry for a detail view or month that's being left for somewhere else is always replaced, so
 * going back from there doesn't land on a detail that can't be shown again.
 */
export function pushDashboardEntry(entry: DashboardEntry, replace = false) {
  const state = { ...window.history.state, dashboard: entry };
  if (replace || (readDashboardEntry()?.overlay && !entry.overlay)) window.history.replaceState(state, "");
  else window.history.pushState(state, "");
  window.dispatchEvent(new Event(ENTRY_EVENT));
}

// Fired on every push above; with popstate, it's how anything outside a section (the Sidebar's
// rows under a section) follows the page the section is on.
const ENTRY_EVENT = "dashboard-entry";

/** The current history entry, kept up to date as sections push entries and back / forward land. */
export function useDashboardEntry(): DashboardEntry | null {
  const [entry, setEntry] = useState<DashboardEntry | null>(null);
  useEffect(() => {
    const update = () => setEntry(readDashboardEntry());
    update();
    window.addEventListener(ENTRY_EVENT, update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener(ENTRY_EVENT, update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return entry;
}
