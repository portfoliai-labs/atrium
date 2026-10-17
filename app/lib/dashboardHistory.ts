// lib/dashboardHistory.ts
//
// DASHBOARD HISTORY — lets the browser's back and forward buttons move through the dashboard,
// which is one URL whose pages are all component state: the section open (dashboard page), the
// page inside a section that has pages of its own (InvestmentsSection, WalletsSection…) and, on a
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
  // The page inside the section, for a section that has pages of its own (InvestmentsSection's
  // InvestmentsView).
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

/**
 * A section's page, kept in its history entry: the one the entry holds (read by `parse`, which
 * also takes an entry with none, or one from an older shape), recorded as it opens so the Sidebar
 * marks it, and followed on back / forward. `open` moves to another page: a new entry, or
 * (`replace`) in place of this one.
 */
export function useSectionView<V>(section: string, parse: (raw: unknown) => V): [V, (next: V, replace?: boolean) => void] {
  const read = () => {
    const entry = readDashboardEntry();
    return parse(entry?.section === section ? entry.view : undefined);
  };
  const [view, setView] = useState<V>(read);

  useEffect(() => {
    const entry = readDashboardEntry();
    if (entry?.section === section && JSON.stringify(entry.view) !== JSON.stringify(view)) {
      pushDashboardEntry({ section, view }, true);
    }
    const onPopState = () => {
      if (readDashboardEntry()?.section === section) setView(read());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // Once: `parse` is the section's own, the same for the whole visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (next: V, replace = false) => {
    pushDashboardEntry({ section, view: next }, replace);
    setView(next);
    if (!replace) window.scrollTo({ top: 0 });
  };
  return [view, open];
}
