// app/context/RealEstateContext.tsx
"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { keepPreviousData, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useUser } from "./UserContext";
import { ApiError } from "../services/apiClient";
import { realEstateService } from "../services/realEstateService";
import { apiRealEstateSource, type RealEstateSource } from "../lib/realEstate";
import { DEMO_PROPERTIES, demoRealEstateSource } from "../lib/mock/realEstate";
import type { Property, RealEstateOverview, RealEstateSummary } from "../models/RealEstate";

/**
 * REAL ESTATE CONTEXT — an investor's properties, loaded once for the dashboard: Wealth, the
 * Sidebar and the real estate pages read the same list, archived properties included. A demo
 * account's are the sample data (lib/mock/realEstate), read only. Every real estate read is in the
 * query cache (context/QueryContext) under a ["realEstate", ...] key (useRealEstateQuery), shared
 * by the modules and pages that ask for it: after any write, `changed()` invalidates them all, the
 * list too (the figures move with every transaction), and what's on screen is read again, staying
 * up meanwhile. Empty, and never loaded, for an advisor.
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
  changed: () => void;
}

const RealEstateContext = createContext<RealEstateContextType | undefined>(undefined);

/** A real estate read's key in the query cache: everything under it goes with `changed()`. */
export const realEstateKey = (...parts: unknown[]) => ["realEstate", ...parts];

const NO_PROPERTIES: Property[] = [];

export function RealEstateProvider({ children }: { children: React.ReactNode }) {
  const { user, isDemo } = useUser();
  const enabled = !!user && user.role !== "ADVISOR";
  const sample = enabled && isDemo;
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: realEstateKey("list"), queryFn: () => realEstateService.list(true), enabled: enabled && !sample });

  const missing = list.error instanceof ApiError && list.error.status === 404;
  const error = list.error && !missing
    ? (list.error instanceof Error ? list.error.message : "Unable to load your properties.")
    : null;
  // Loading until the first answer only: a reload after a write keeps the pages up.
  const loading = enabled && !sample && list.isPending;
  const changed = useCallback(() => { void queryClient.invalidateQueries({ queryKey: realEstateKey() }); }, [queryClient]);
  const properties = sample ? DEMO_PROPERTIES : list.data ?? NO_PROPERTIES;

  const value = useMemo<RealEstateContextType>(() => ({
    properties,
    loading,
    error,
    available: enabled && !missing,
    sample,
    source: sample ? demoRealEstateSource : apiRealEstateSource,
    changed,
  }), [sample, properties, loading, error, enabled, missing, changed]);
  return <RealEstateContext.Provider value={value}>{children}</RealEstateContext.Provider>;
}

export const useRealEstate = (): RealEstateContextType => {
  const context = useContext(RealEstateContext);
  if (context === undefined) throw new Error("useRealEstate must be used within a RealEstateProvider");
  return context;
};

/**
 * A real estate read through the query cache, under `realEstateKey(...key)`: asked for once however
 * many modules want it, and again after `changed()`. Off where the real estate can't be shown. With
 * `keepPrevious`, a new key (other filters, more pages) keeps the last answer up until its own.
 */
export function useRealEstateQuery<T>(
  key: unknown[], read: (source: RealEstateSource) => Promise<T>, { enabled = true, keepPrevious = false } = {},
): UseQueryResult<T> {
  const { source, available } = useRealEstate();
  return useQuery({
    queryKey: realEstateKey(...key),
    queryFn: () => read(source),
    enabled: available && enabled,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  });
}

/**
 * useRealEstateQuery's answer alone: undefined while loading, null when it couldn't be read (e.g.
 * no exchange rate for a property's currency on the figures across properties).
 */
export function useRealEstateRead<T>(key: unknown[], read: (source: RealEstateSource) => Promise<T>, enabled = true): T | null | undefined {
  const query = useRealEstateQuery(key, read, { enabled });
  return query.isError ? null : query.data;
}

/** Every non-archived property together, today, in the reference currency. */
export function useRealEstateOverview(enabled = true): RealEstateOverview | null | undefined {
  return useRealEstateRead(["overview"], (source) => source.overview(), enabled);
}

/** One property's months (its currency) or every non-archived property's (`null`, the reference currency). */
export function useRealEstateSummary(propertyUuid: string | null, from?: string, to?: string, enabled = true): RealEstateSummary | null | undefined {
  return useRealEstateRead(["summary", propertyUuid ?? "all", from, to], (source) => source.summary(propertyUuid, from, to), enabled);
}
