// app/context/QueryContext.tsx
"use client";

import React, { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUser } from "./UserContext";

/**
 * QUERY CACHE — the reads the dashboard's pages share (TanStack Query): the same read asked for by
 * two modules, or again on another page within FRESH_MS, is one request. A page's writes invalidate
 * what they change (e.g. the wallets' `changed()`, which invalidates every ["wallets", ...] key).
 * One cache per account: a new one when the user changes (a logout, another login), so nothing
 * read for one account is ever shown to the next.
 */
const FRESH_MS = 30_000;

const newClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FRESH_MS,
      // As the pages did before: a failed read says so at once, and a tab coming back doesn't refetch.
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const uuid = user?.uuid ?? null;
  // A new cache for each account, by its uuid.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const client = useMemo(() => newClient(), [uuid]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
