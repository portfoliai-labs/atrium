"use client";

import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";

/**
 * The account's reads in the query cache (context/QueryContext), the ones no section's context
 * holds: the profile, the settings, the subscription, the reports, the assistant's collection.
 * Each under an ["account", ...] key, shared by the pages that ask for the same one; a write
 * patches what it changed (setQueryData) or invalidates its prefix (e.g. accountKey("reports")).
 */
export const accountKey = (...parts: unknown[]) => ["account", ...parts];

/**
 * An account read through the query cache, under `accountKey(...key)`: asked for once however
 * many modules want it. With `keepPrevious`, a new key keeps the last answer up until its own;
 * with `pollMs`, it's read again on that interval while the tab is visible.
 */
export function useAccountQuery<T>(
  key: unknown[], read: () => Promise<T>, { enabled = true, keepPrevious = false, pollMs }: { enabled?: boolean; keepPrevious?: boolean; pollMs?: number } = {},
): UseQueryResult<T> {
  return useQuery({
    queryKey: accountKey(...key),
    queryFn: read,
    enabled,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    refetchInterval: pollMs,
  });
}

/** useAccountQuery's answer alone: undefined while loading, null when it couldn't be read. */
export function useAccountRead<T>(key: unknown[], read: () => Promise<T>, enabled = true): T | null | undefined {
  const query = useAccountQuery(key, read, { enabled });
  return query.isError ? null : query.data;
}
