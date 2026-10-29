// app/hooks/useInsights.ts
"use client";

import { useEffect, useState } from "react";
import { useQueries, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { investmentsKey } from "../context/PortfolioContext";
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

/** One section of the page: `data` null while its first answer is on its way (or when it failed). */
export interface SectionState<T> {
  data: T | null;
  failed: boolean;
}

interface Sections {
  composition: SectionState<InsightsCompositionResponse>;
  incomeCosts: SectionState<InsightsIncomeCostsResponse>;
  performance: SectionState<InsightsPerformanceResponse>;
  risk: SectionState<InsightsRiskResponse>;
}

export type SectionKey = keyof Sections;

/**
 * An Insights read's key in the query cache: a section's (`insightsKey(uuid, "risk")`), or a
 * detail's under the section its module is in (`insightsKey(uuid, "risk", "riskModel")`), so the
 * section read again after a rebuild reads its open details again too.
 */
export const insightsKey = (portfolioUuid: string, section?: SectionKey, ...detail: unknown[]) =>
  investmentsKey("insights", portfolioUuid, ...(section ? [section, ...detail] : []));

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
function staleKeys(sections: { [K in SectionKey]: { data: Sections[K]["data"] } }, key: SectionKey): StaleKey[] {
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
      add("factorExposures", d?.factorExposures);
      break;
    }
  }
  return stale;
}

const isFresh = (status: InsightsStatusResponse, key: StaleKey) =>
  key === "history" ? !status.historyIsStale : status.modules[key]?.isStale === false;

/** The sections as last read for the portfolio, from the cache. */
const cachedSections = (queryClient: QueryClient, portfolioUuid: string) =>
  Object.fromEntries(SECTION_KEYS.map((key) => [key, { data: queryClient.getQueryData(insightsKey(portfolioUuid, key)) ?? null }])) as
    { [K in SectionKey]: { data: Sections[K]["data"] } };

/**
 * The Insights page's main data: its four sections, read in parallel (and kept in the query cache,
 * see context/PortfolioContext), each drawn as soon as it arrives and failing on its own. While any
 * module is stale, polls /insights/status (not the sections) every STALE_POLL_INTERVAL_MS, and reads
 * a section again (its open details with it) once one of its stale modules is reported fresh; after
 * STALE_TIMEOUT_MS it stops and sets `timedOut`.
 */
export function useInsights(portfolioUuid: string): Insights {
  const queryClient = useQueryClient();
  const results = useQueries({
    queries: SECTION_KEYS.map((key) => ({ queryKey: insightsKey(portfolioUuid, key), queryFn: () => LOADERS[key](portfolioUuid) })),
  });
  // A failed read again keeps what was already on screen; a failed first read has nothing to keep.
  const sections = Object.fromEntries(SECTION_KEYS.map((key, i) => {
    const data = results[i].data ?? null;
    return [key, { data, failed: results[i].isError && data === null }];
  })) as unknown as Sections;

  const anyStale = SECTION_KEYS.some((key) => staleKeys(sections, key).length > 0);

  // The portfolio whose rebuild has been waited on for STALE_TIMEOUT_MS; cleared once nothing is stale.
  const [timedOutFor, setTimedOutFor] = useState<string | null>(null);
  useEffect(() => {
    if (!anyStale) return;
    const timer = setTimeout(() => setTimedOutFor(portfolioUuid), STALE_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
      setTimedOutFor(null);
    };
  }, [anyStale, portfolioUuid]);
  const timedOut = anyStale && timedOutFor === portfolioUuid;

  useQuery({
    queryKey: [...insightsKey(portfolioUuid), "status"],
    queryFn: async () => {
      const status = await portfolioService.getInsightsStatus(portfolioUuid);
      const read = cachedSections(queryClient, portfolioUuid);
      for (const key of SECTION_KEYS) {
        if (staleKeys(read, key).some((k) => isFresh(status, k))) {
          void queryClient.invalidateQueries({ queryKey: insightsKey(portfolioUuid, key) });
          // The volatility's detail is drawn from the returns too (the Performance section's).
          if (key === "performance") void queryClient.invalidateQueries({ queryKey: insightsKey(portfolioUuid, "risk", "volatility") });
        }
      }
      return status;
    },
    enabled: anyStale && !timedOut,
    // Every tick asks again (a transient error is tried again on the next one); the first waits a
    // tick too, as the rebuild has only just started.
    refetchInterval: STALE_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
    staleTime: STALE_POLL_INTERVAL_MS,
    initialData: null,
    initialDataUpdatedAt: () => Date.now(),
  });

  return { ...sections, timedOut };
}

/**
 * A detail view's own document, read when the view opens (`load` non-null) under `key` (an
 * insightsKey, or another investmentsKey), and again whenever its section is. The previous answer stays on screen while the
 * next one loads. `error` keeps the thrown error, so a caller can tell a 404 from a failure.
 */
export function useDetail<T>(load: (() => Promise<T>) | null, key: unknown[]) {
  // A disabled query never calls it.
  const query = useQuery({ queryKey: key, queryFn: load ?? (() => Promise.reject(new Error("Not open"))), enabled: load !== null });
  // Another key's answer (a different month, say) is never shown for this one.
  return {
    data: query.data ?? null,
    error: query.error,
    loading: load !== null && query.isPending,
  };
}
