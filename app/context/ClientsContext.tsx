// app/context/ClientsContext.tsx
"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { keepPreviousData, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { advisorService } from "../services/advisorService";
import { useUser } from "./UserContext";
import type { Client } from "../models/Advisor";

/**
 * CLIENTS CONTEXT — an advisor's clients, loaded once for the dashboard: the Dashboard, the Clients
 * section, the Sidebar's rows under Clients and adopting a strategy on a client's portfolio all read
 * the same list, and a client added, changed or removed shows up in all of them. Empty, and never
 * loaded, for anyone else. The list is in the query cache (context/QueryContext) under
 * ["clients", "list"], next to the other reads between advisors and investors (useClientsQuery):
 * the requests on both sides, the suggested advisors, the investor's policy, the advisor's profile.
 * `reload()` invalidates them all.
 */
interface ClientsContextType {
  clients: Client[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  // After a create / profile change / delete made elsewhere, without a refetch.
  added: (client: Client) => void;
  updated: (client: Client) => void;
  removed: (clientUuid: string) => void;
}

const ClientsContext = createContext<ClientsContextType | undefined>(undefined);

/** A clients' (or advisor matching's) read's key in the query cache: everything under it goes with `reload()`. */
export const clientsKey = (...parts: unknown[]) => ["clients", ...parts];

const NO_CLIENTS: Client[] = [];

export function ClientsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const enabled = user?.role === "ADVISOR";
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: clientsKey("list"), queryFn: () => advisorService.getClients(), enabled });

  const clients = list.data ?? NO_CLIENTS;
  // Loading until the first answer only.
  const loading = enabled && list.isPending;
  const error = list.error ? list.error.message || "Unable to load your clients." : null;

  const reload = useCallback(() => queryClient.invalidateQueries({ queryKey: clientsKey() }), [queryClient]);
  const setClients = useCallback(
    (change: (prev: Client[]) => Client[]) => queryClient.setQueryData<Client[]>(clientsKey("list"), (prev) => prev && change(prev)),
    [queryClient],
  );
  const added = useCallback((client: Client) => setClients((prev) => [client, ...prev.filter((c) => c.uuid !== client.uuid)]), [setClients]);
  const updated = useCallback((client: Client) => setClients((prev) => prev.map((c) => (c.uuid === client.uuid ? client : c))), [setClients]);
  const removed = useCallback((uuid: string) => setClients((prev) => prev.filter((c) => c.uuid !== uuid)), [setClients]);

  const value = useMemo(
    () => ({ clients, loading, error, reload, added, updated, removed }),
    [clients, loading, error, reload, added, updated, removed],
  );
  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>;
}

export const useClients = (): ClientsContextType => {
  const context = useContext(ClientsContext);
  if (context === undefined) throw new Error("useClients must be used within a ClientsProvider");
  return context;
};

/**
 * A clients' read through the query cache, under `clientsKey(...key)`: asked for once however many
 * modules want it, and again after `reload()`. With `keepPrevious`, a new key keeps the last answer
 * up until its own; with `pollMs`, it's read again on that interval while the tab is visible.
 */
export function useClientsQuery<T>(
  key: unknown[], read: () => Promise<T>, { enabled = true, keepPrevious = false, pollMs }: { enabled?: boolean; keepPrevious?: boolean; pollMs?: number } = {},
): UseQueryResult<T> {
  return useQuery({
    queryKey: clientsKey(...key),
    queryFn: read,
    enabled,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    refetchInterval: pollMs,
  });
}

/** useClientsQuery's answer alone: undefined while loading, null when it couldn't be read. */
export function useClientsRead<T>(key: unknown[], read: () => Promise<T>, enabled = true): T | null | undefined {
  const query = useClientsQuery(key, read, { enabled });
  return query.isError ? null : query.data;
}

/** "Mario Rossi", or the email without a name. */
export function clientDisplayName(client: Pick<Client, "first_name" | "last_name" | "email">) {
  return client.first_name || client.last_name
    ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
    : client.email;
}

/** "MR", or the email's first letter. */
export function clientInitials(client: Pick<Client, "first_name" | "last_name" | "email">) {
  return ((client.first_name?.[0] ?? "") + (client.last_name?.[0] ?? "")).toUpperCase() || client.email[0].toUpperCase();
}
