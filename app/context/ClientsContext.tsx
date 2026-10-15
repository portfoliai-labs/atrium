// app/context/ClientsContext.tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { advisorService } from "../services/advisorService";
import { useUser } from "./UserContext";
import type { Client } from "../models/Advisor";

/**
 * CLIENTS CONTEXT — an advisor's clients, loaded once for the dashboard: the Dashboard, the Clients
 * section, the Sidebar's rows under Clients and adopting a strategy on a client's portfolio all read
 * the same list, and a client added, changed or removed shows up in all of them. Empty, and never
 * loaded, for anyone else.
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

export function ClientsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const enabled = user?.role === "ADVISOR";
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      setClients(await advisorService.getClients());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your clients.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const added = useCallback((client: Client) => setClients((prev) => [client, ...prev.filter((c) => c.uuid !== client.uuid)]), []);
  const updated = useCallback((client: Client) => setClients((prev) => prev.map((c) => (c.uuid === client.uuid ? client : c))), []);
  const removed = useCallback((uuid: string) => setClients((prev) => prev.filter((c) => c.uuid !== uuid)), []);

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
