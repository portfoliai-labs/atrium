// app/context/PortfolioContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { portfoliosService } from "../services/portfoliosService";
import { useUser } from "./UserContext";
import { isBacktest, type Portfolio } from "../models/Portfolio";
import type { StrategyPortfolioPayload } from "../models/Strategy";

const LAST_SELECTED_KEY = "last_selected_portfolio_uuid";

/**
 * PORTFOLIO CONTEXT — a list of portfolios and which one is selected: the user's own (the
 * dashboard's provider), or, with `client`, one of an advisor's clients' (a provider around that
 * client's pages, see ClientsSection), so the investor's pages work on it unchanged.
 *
 * An advisor's own are their strategies' backtests (Plan's Strategy) and the default portfolio
 * every account has, which no page shows. A client's leave out the client's own backtests (they're
 * the client's Plan, not something the advisor manages), are created through the advisor's route,
 * and can't be renamed or deleted by the advisor (`canManage`), nor take a backtest.
 */
interface PortfolioContextType {
  portfolios: Portfolio[];
  // The selected portfolio's full record — never null once `loading` is false and the user has
  // at least the one default portfolio every account is created with.
  current: Portfolio | null;
  loading: boolean;
  selectPortfolio: (uuid: string) => void;
  refreshPortfolios: () => Promise<Portfolio[]>;
  createPortfolio: (name: string) => Promise<Portfolio>;
  // A strategy's backtest (see models/Strategy): joins the list, selected, like a new portfolio.
  createStrategyPortfolio: (payload: StrategyPortfolioPayload) => Promise<Portfolio>;
  renamePortfolio: (uuid: string, name: string) => Promise<Portfolio>;
  // Throws (with the backend's own message) on the default portfolio's 409 — callers show it.
  // Resolves with the portfolios left, refetched: the aggregate may have gone with it.
  deletePortfolio: (uuid: string) => Promise<Portfolio[]>;
  // The advisor's client these portfolios are, or null for the user's own.
  client: ClientScope | null;
  // The user's own portfolios, whichever list this is: a client's adoption comes from one of them.
  ownPortfolios: Portfolio[];
  // Whether its portfolios can be renamed and deleted (not a client's, for their advisor).
  canManage: boolean;
}

/** The client a provider lists the portfolios of, as the pages name them. */
export interface ClientScope {
  uuid: string;
  name: string;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children, client = null }: { children: React.ReactNode; client?: ClientScope | null }) {
  const { user } = useUser();
  const outer = useContext(PortfolioContext);
  const clientUuid = client?.uuid ?? null;
  const enabled = Boolean(user);

  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchPortfolios = useCallback(async (): Promise<Portfolio[]> => {
    if (!enabled) {
      setLoading(false);
      return [];
    }
    // No setLoading(true) here: `loading` starts true for the first fetch, and later refetches
    // (after create/delete) stay silent instead of swapping the dashboard for its loader.
    try {
      const list = clientUuid
        ? (await portfoliosService.listForClient(clientUuid)).filter((p) => !isBacktest(p))
        : await portfoliosService.list();
      setPortfolios(list);
      setCurrentUuid((prevUuid) => {
        if (prevUuid && list.some((p) => p.uuid === prevUuid)) return prevUuid;
        // Open the last one selected in a previous session if it still exists, else the
        // default portfolio — not list[0], which is the aggregate when there is one.
        const lastSelected = typeof window !== "undefined" && !clientUuid ? localStorage.getItem(LAST_SELECTED_KEY) : null;
        const remembered = lastSelected ? list.find((p) => p.uuid === lastSelected) : undefined;
        return (remembered ?? list.find((p) => p.isDefault) ?? list[0])?.uuid ?? null;
      });
      return list;
    } finally {
      setLoading(false);
    }
  }, [enabled, clientUuid]);

  useEffect(() => {
    fetchPortfolios();
  }, [fetchPortfolios]);

  const selectPortfolio = useCallback((uuid: string) => {
    setCurrentUuid(uuid);
    if (typeof window !== "undefined" && !clientUuid) localStorage.setItem(LAST_SELECTED_KEY, uuid);
  }, [clientUuid]);

  // Create and delete refetch the whole list rather than patching it locally: the aggregate
  // portfolio appears when the 2nd one is created and disappears when back to 1.
  const createPortfolio = useCallback(async (name: string) => {
    const created = clientUuid ? await portfoliosService.createForClient(clientUuid, name) : await portfoliosService.create(name);
    await fetchPortfolios();
    selectPortfolio(created.uuid);
    return created;
  }, [selectPortfolio, fetchPortfolios, clientUuid]);

  const createStrategyPortfolio = useCallback(async (payload: StrategyPortfolioPayload) => {
    if (clientUuid) throw new Error("A backtest is made in your own Strategy, then adopted on a client's portfolio.");
    const created = await portfoliosService.createStrategy(payload);
    await fetchPortfolios();
    selectPortfolio(created.uuid);
    return created;
  }, [selectPortfolio, fetchPortfolios, clientUuid]);

  const renamePortfolio = useCallback(async (uuid: string, name: string) => {
    const updated = await portfoliosService.rename(uuid, name);
    setPortfolios((prev) => prev.map((p) => (p.uuid === uuid ? updated : p)));
    return updated;
  }, []);

  // If the deleted one (or the aggregate, gone once only one portfolio is left) was selected,
  // fetchPortfolios falls back to the default on its own.
  const deletePortfolio = useCallback(async (uuid: string) => {
    await portfoliosService.remove(uuid);
    return fetchPortfolios();
  }, [fetchPortfolios]);

  const current = useMemo(
    () => portfolios.find((p) => p.uuid === currentUuid) ?? null,
    [portfolios, currentUuid],
  );

  const ownPortfolios = client ? outer?.ownPortfolios ?? [] : portfolios;
  const contextValue: PortfolioContextType = useMemo(() => ({
    portfolios, current, loading, selectPortfolio,
    refreshPortfolios: fetchPortfolios, createPortfolio, createStrategyPortfolio, renamePortfolio, deletePortfolio,
    client, ownPortfolios, canManage: client === null,
  }), [portfolios, current, loading, selectPortfolio, fetchPortfolios, createPortfolio, createStrategyPortfolio, renamePortfolio, deletePortfolio, client, ownPortfolios]);

  return <PortfolioContext.Provider value={contextValue}>{children}</PortfolioContext.Provider>;
}

export const usePortfolio = (): PortfolioContextType => {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error("usePortfolio must be used within a PortfolioProvider");
  }
  return context;
};
