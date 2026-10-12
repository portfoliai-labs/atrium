// app/context/RealEstateContext.tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useUser } from "./UserContext";
import { ApiError } from "../services/apiClient";
import { realEstateService } from "../services/realEstateService";
import { apiRealEstateSource, type RealEstateSource } from "../lib/realEstate";
import { DEMO_PROPERTIES, demoRealEstateSource } from "../lib/mock/realEstate";
import type { Property, RealEstateOverview, RealEstateSummary } from "../models/RealEstate";

/**
 * REAL ESTATE CONTEXT — an investor's properties, loaded once for the dashboard: Wealth, the
 * Sidebar and the real estate pages read the same list, archived properties included. A demo
 * account's are the sample data (lib/mock/realEstate), read only. Pages that read transactions,
 * mortgages or summaries refetch when `version` moves: after any write, `changed()` bumps it and
 * reloads the list (the figures move with every transaction). Empty, and never loaded, for an
 * advisor.
 */
interface RealEstateContextType {
  // As the API lists them, archived included.
  properties: Property[];
  loading: boolean;
  error: string | null;
  // Whether the real estate can be shown at all: false while the API doesn't have it (a backend
  // without /v1/real-estate answers 404), and for an advisor.
  available: boolean;
  // A demo account's sample data: read only, and said so.
  sample: boolean;
  source: RealEstateSource;
  version: number;
  changed: () => void;
}

const RealEstateContext = createContext<RealEstateContextType | undefined>(undefined);

export function RealEstateProvider({ children }: { children: React.ReactNode }) {
  const { user, isDemo } = useUser();
  const enabled = !!user && user.role !== "ADVISOR";
  const sample = enabled && isDemo;
  const [properties, setProperties] = useState<Property[]>([]);
  // Loading until the first answer only: a reload after a write keeps the pages up.
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    if (!enabled || sample) return;
    try {
      setProperties(await realEstateService.list(true));
      setError(null);
      setMissing(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setMissing(true);
      else setError(err instanceof Error ? err.message : "Unable to load your properties.");
    } finally {
      setLoaded(true);
    }
  }, [enabled, sample]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const loading = enabled && !sample && !loaded;
  const changed = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo<RealEstateContextType>(() => ({
    properties: sample ? DEMO_PROPERTIES : properties,
    loading,
    error,
    available: enabled && !missing,
    sample,
    source: sample ? demoRealEstateSource : apiRealEstateSource,
    version,
    changed,
  }), [sample, properties, loading, error, enabled, missing, version, changed]);
  return <RealEstateContext.Provider value={value}>{children}</RealEstateContext.Provider>;
}

export const useRealEstate = (): RealEstateContextType => {
  const context = useContext(RealEstateContext);
  if (context === undefined) throw new Error("useRealEstate must be used within a RealEstateProvider");
  return context;
};

/**
 * A read from the source, refetched as the real estate changes. undefined while loading, null when
 * it couldn't be read (e.g. no exchange rate for a property's currency on the figures across
 * properties).
 */
function useSourceRead<T>(key: string, read: (source: RealEstateSource) => Promise<T>, enabled: boolean) {
  const { source, version, available } = useRealEstate();
  const fullKey = `${key}:${version}`;
  const [state, setState] = useState<{ key: string; value: T | null } | null>(null);
  useEffect(() => {
    if (!enabled || !available) return;
    let cancelled = false;
    read(source)
      .then((value) => { if (!cancelled) setState({ key: fullKey, value }); })
      .catch(() => { if (!cancelled) setState({ key: fullKey, value: null }); });
    return () => { cancelled = true; };
    // `read` is identified by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, fullKey, enabled, available]);
  return state?.key === fullKey ? state.value : undefined;
}

/** Every non-archived property together, today, in the reference currency. */
export function useRealEstateOverview(enabled = true): RealEstateOverview | null | undefined {
  return useSourceRead("overview", (source) => source.overview(), enabled);
}

/** One property's months (its currency) or every non-archived property's (`null`, the reference currency). */
export function useRealEstateSummary(propertyUuid: string | null, from?: string, to?: string, enabled = true): RealEstateSummary | null | undefined {
  return useSourceRead(
    `summary:${propertyUuid ?? "all"}:${from ?? ""}:${to ?? ""}`,
    (source) => source.summary(propertyUuid, from, to),
    enabled,
  );
}
