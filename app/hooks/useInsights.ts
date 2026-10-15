// app/hooks/useInsights.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { portfolioService } from "../services/portfolioService";
import type {
  InsightsCompositionResponse, InsightsIncomeCostsResponse, InsightsPerformanceResponse, InsightsRiskResponse,
  InsightsStatusResponse, InsightsStatusModules,
} from "../models/PortfolioData";

// How often to ask /insights/status while something on the page is stale (a transaction edit
// triggered a rebuild that hasn't landed yet), and how long to keep asking before giving up and
// showing the possibly-mixed figures anyway, with a hint, rather than waiting forever.
const STALE_POLL_INTERVAL_MS = 15_000;
const STALE_TIMEOUT_MS = 5 * 60_000;

/**
 * One section of the page: `data` null while its first answer is on its way (or when it failed).
 * `revision` goes up every time the section is fetched again, so a detail view open on one of its
 * modules knows to fetch itself again too.
 */
export interface SectionState<T> {
  data: T | null;
  failed: boolean;
  revision: number;
}

interface Sections {
  composition: SectionState<InsightsCompositionResponse>;
  incomeCosts: SectionState<InsightsIncomeCostsResponse>;
  performance: SectionState<InsightsPerformanceResponse>;
  risk: SectionState<InsightsRiskResponse>;
}

type SectionKey = keyof Sections;

export interface Insights extends Sections {
  // True once the page has waited STALE_TIMEOUT_MS for a rebuild: a stale module then shows its
  // figures with a "taking longer than usual" note instead of an "updating" state.
  timedOut: boolean;
}

const LOADERS: { [K in SectionKey]: (portfolioUuid: string) => Promise<NonNullable<Sections[K]["data"]>> } = {
  composition: portfolioService.getInsightsComposition,
  incomeCosts: portfolioService.getInsightsIncomeCosts,
  performance: portfolioService.getInsightsPerformance,
  risk: portfolioService.getInsightsRisk,
};

const SECTION_KEYS = Object.keys(LOADERS) as SectionKey[];

// A stale module, named the way /insights/status names it; "history" stands for the
// Performance section's historyIsStale (its value, this month and heatmap).
type StaleKey = keyof InsightsStatusModules | "history";

/** The modules of a section that are stale in what was last fetched. */
function staleKeys(sections: Sections, key: SectionKey): StaleKey[] {
  const stale: StaleKey[] = [];
  const add = (name: StaleKey, module: { isStale: boolean } | null | undefined) => {
    if (module?.isStale) stale.push(name);
  };
  switch (key) {
    case "composition": {
      const d = sections.composition.data;
      add("holdings", d?.holdings);
      add("sectorExposure", d?.sectorExposure);
      add("regionExposure", d?.regionExposure);
      add("composition", d?.portfolios);
      break;
    }
    case "incomeCosts": {
      const d = sections.incomeCosts.data;
      add("dividends", d?.dividends);
      add("tradingCosts", d?.tradingCosts);
      add("realizedPnl", d?.realizedPnl);
      break;
    }
    case "performance": {
      const d = sections.performance.data;
      // Only the stored values here; the returns and the benchmark are detail endpoints, which
      // show their own isStale.
      if (d?.historyIsStale) stale.push("history");
      break;
    }
    case "risk": {
      const d = sections.risk.data;
      add("volatility", d?.volatility);
      add("riskModel", d?.frontier);
      break;
    }
  }
  return stale;
}

const isFresh = (status: InsightsStatusResponse, key: StaleKey) =>
  key === "history" ? !status.historyIsStale : status.modules[key]?.isStale === false;

const initialSections = (): Sections => ({
  composition: { data: null, failed: false, revision: 0 },
  incomeCosts: { data: null, failed: false, revision: 0 },
  performance: { data: null, failed: false, revision: 0 },
  risk: { data: null, failed: false, revision: 0 },
});

/**
 * The Insights page's main data: its four sections, fetched in parallel, each drawn as soon as
 * it arrives and failing on its own. While any module is stale, polls /insights/status (not the
 * sections) every STALE_POLL_INTERVAL_MS, and fetches a section again once one of its stale
 * modules is reported fresh; after STALE_TIMEOUT_MS it stops and sets `timedOut`.
 */
export function useInsights(portfolioUuid: string): Insights {
  const [sections, setSections] = useState<Sections>(initialSections);
  const [timedOut, setTimedOut] = useState(false);

  // The polling below reads the latest sections without restarting on every refetch.
  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  // Bumped when the portfolio changes, so an answer for the previous one is dropped.
  const generation = useRef(0);

  const fetchSection = async <K extends SectionKey>(key: K, gen: number) => {
    try {
      const data = await LOADERS[key](portfolioUuid);
      if (gen !== generation.current) return;
      setSections((prev) => ({ ...prev, [key]: { data, failed: false, revision: prev[key].revision + 1 } }));
    } catch {
      if (gen !== generation.current) return;
      // A failed refetch keeps what was already on screen; a failed first fetch has nothing to keep.
      setSections((prev) => ({ ...prev, [key]: { ...prev[key], failed: prev[key].data === null } }));
    }
  };

  useEffect(() => {
    const gen = ++generation.current;
    setSections(initialSections());
    setTimedOut(false);
    SECTION_KEYS.forEach((key) => fetchSection(key, gen));
    // fetchSection only reads portfolioUuid, which is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioUuid]);

  const anyStale = SECTION_KEYS.some((key) => staleKeys(sections, key).length > 0);

  useEffect(() => {
    if (!anyStale) {
      setTimedOut(false);
      return;
    }
    const gen = generation.current;
    const deadline = Date.now() + STALE_TIMEOUT_MS;
    const timer = setInterval(async () => {
      if (Date.now() >= deadline) {
        clearInterval(timer);
        if (gen === generation.current) setTimedOut(true);
        return;
      }
      try {
        const status = await portfolioService.getInsightsStatus(portfolioUuid);
        if (gen !== generation.current) return;
        for (const key of SECTION_KEYS) {
          if (staleKeys(sectionsRef.current, key).some((k) => isFresh(status, k))) fetchSection(key, gen);
        }
      } catch {
        // A transient error while polling: the next tick tries again.
      }
    }, STALE_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // fetchSection only reads portfolioUuid, which is a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyStale, portfolioUuid]);

  return { ...sections, timedOut };
}

/**
 * A detail view's own document, fetched when the view opens (`load` non-null) and again whenever
 * `revision` changes (its section was fetched again, e.g. after a rebuild). The previous answer
 * stays on screen while the next one loads. `error` keeps the thrown error, so a caller can tell
 * a 404 from a failure.
 */
export function useDetail<T>(load: (() => Promise<T>) | null, key: string, revision: number) {
  const [state, setState] = useState<{ data: T | null; error: unknown; forKey: string | null }>({ data: null, error: null, forKey: null });
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  const active = load !== null;

  useEffect(() => {
    if (!active || !loadRef.current) return;
    let cancelled = false;
    loadRef.current()
      .then((data) => { if (!cancelled) setState({ data, error: null, forKey: key }); })
      .catch((error: unknown) => { if (!cancelled) setState((prev) => ({ data: prev.forKey === key ? prev.data : null, error, forKey: key })); });
    return () => { cancelled = true; };
  }, [active, key, revision]);

  // Another key's answer (a different month, say) is never shown for this one.
  const current = state.forKey === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: active && !current,
  };
}
