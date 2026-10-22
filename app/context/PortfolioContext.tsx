// app/context/PortfolioContext.tsx
"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { keepPreviousData, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { portfoliosService } from "../services/portfoliosService";
import { useUser } from "./UserContext";
import { isBacktest, type Portfolio } from "../models/Portfolio";
import type { StrategyPortfolioPayload } from "../models/Strategy";
import type { TaxationMode } from "../models/Tax";

const LAST_SELECTED_KEY = "last_selected_portfolio_uuid";

/**
 * PORTFOLIO CONTEXT — a list of portfolios and which one is selected: the user's own (the
 * dashboard's provider), or, with `client`, one of an advisor's clients' (a provider around that
 * client's pages, see ClientsSection), so the investor's pages work on it unchanged.
 *
 * An advisor's own are their strategies' backtests (Strategies) and the default portfolio
 * every account has, which no page shows. A client's leave out the client's own backtests (they're
 * the client's Strategies, not something the advisor manages), are created through the advisor's route,
 * and can't be renamed or deleted by the advisor (`canManage`), nor take a backtest.
 *
 * Every investments' read is in the query cache (context/QueryContext) under an ["investments", ...]
 * key (useInvestmentsQuery), shared by the modules and pages that ask for it: the list itself, the
 * Insights' sections and details, the alert rules, the comparisons. After a write on the
 * transactions, `changed()` invalidates them all, and what's on screen is read again, staying up
 * meanwhile.
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
  // Who pays a real portfolio's taxes (see models/Tax): its advisor sets a client's too.
  setTaxationMode: (uuid: string, mode: TaxationMode) => Promise<Portfolio>;
  // Throws (with the backend's own message) on the default portfolio's 409 — callers show it.
  // Resolves with the portfolios left, refetched: the aggregate may have gone with it.
  deletePortfolio: (uuid: string) => Promise<Portfolio[]>;
  // The advisor's client these portfolios are, or null for the user's own.
  client: ClientScope | null;
  // The user's own portfolios, whichever list this is: a client's adoption comes from one of them.
  ownPortfolios: Portfolio[];
  // Whether its portfolios can be renamed and deleted (not a client's, for their advisor).
  canManage: boolean;
  // After a write that moves the figures (transactions saved, edited, deleted, imported).
  changed: () => void;
}

/** The client a provider lists the portfolios of, as the pages name them. */
export interface ClientScope {
  uuid: string;
  name: string;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

/** An investments' read's key in the query cache: everything under it goes with `changed()`. */
export const investmentsKey = (...parts: unknown[]) => ["investments", ...parts];

const NO_PORTFOLIOS: Portfolio[] = [];

export function PortfolioProvider({ children, client = null }: { children: React.ReactNode; client?: ClientScope | null }) {
  const { user } = useUser();
  const outer = useContext(PortfolioContext);
  const clientUuid = client?.uuid ?? null;
  const enabled = Boolean(user);

  const queryClient = useQueryClient();
  const listKey = useMemo(() => investmentsKey("portfolios", clientUuid ?? "own"), [clientUuid]);
  const list = useQuery({
    queryKey: listKey,
    queryFn: async () => clientUuid
      ? (await portfoliosService.listForClient(clientUuid)).filter((p) => !isBacktest(p))
      : portfoliosService.list(),
    enabled,
  });
  const portfolios = list.data ?? NO_PORTFOLIOS;
  // Loading until the first answer only: later reads (after create/delete) stay silent instead of
  // swapping the dashboard for its loader.
  const loading = enabled && list.isPending;

  // The one picked, else the last one selected in a previous session if it still exists, else the
  // default portfolio — not list[0], which is the aggregate when there is one.
  const [picked, setPicked] = useState<string | null>(
    () => (typeof window !== "undefined" && !clientUuid ? localStorage.getItem(LAST_SELECTED_KEY) : null),
  );

  // The list read again, as it is now (create and delete: the aggregate appears when the 2nd one is
  // created and disappears when back to 1).
  const fetchPortfolios = useCallback(async (): Promise<Portfolio[]> => {
    if (!enabled) return [];
    await queryClient.invalidateQueries({ queryKey: listKey });
    return queryClient.getQueryData<Portfolio[]>(listKey) ?? [];
  }, [enabled, queryClient, listKey]);

  const selectPortfolio = useCallback((uuid: string) => {
    setPicked(uuid);
    if (typeof window !== "undefined" && !clientUuid) localStorage.setItem(LAST_SELECTED_KEY, uuid);
  }, [clientUuid]);

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

  // A rename or a taxation mode changes the one record, in the list as read.
  const replace = useCallback((updated: Portfolio) => {
    queryClient.setQueryData<Portfolio[]>(listKey, (prev) => prev?.map((p) => (p.uuid === updated.uuid ? updated : p)));
    return updated;
  }, [queryClient, listKey]);

  const renamePortfolio = useCallback(
    async (uuid: string, name: string) => replace(await portfoliosService.rename(uuid, name)),
    [replace],
  );

  const setTaxationMode = useCallback(
    async (uuid: string, mode: TaxationMode) => replace(await portfoliosService.setTaxationMode(uuid, mode)),
    [replace],
  );

  // If the deleted one (or the aggregate, gone once only one portfolio is left) was selected,
  // `current` falls back to the default on its own.
  const deletePortfolio = useCallback(async (uuid: string) => {
    await portfoliosService.remove(uuid);
    return fetchPortfolios();
  }, [fetchPortfolios]);

  const changed = useCallback(() => { void queryClient.invalidateQueries({ queryKey: investmentsKey() }); }, [queryClient]);

  const current = useMemo(
    () => portfolios.find((p) => p.uuid === picked) ?? portfolios.find((p) => p.isDefault) ?? portfolios[0] ?? null,
    [portfolios, picked],
  );

  const ownPortfolios = client ? outer?.ownPortfolios ?? [] : portfolios;
  const contextValue: PortfolioContextType = useMemo(() => ({
    portfolios, current, loading, selectPortfolio,
    refreshPortfolios: fetchPortfolios, createPortfolio, createStrategyPortfolio, renamePortfolio, setTaxationMode, deletePortfolio,
    client, ownPortfolios, canManage: client === null, changed,
  }), [portfolios, current, loading, selectPortfolio, fetchPortfolios, createPortfolio, createStrategyPortfolio, renamePortfolio, setTaxationMode, deletePortfolio, client, ownPortfolios, changed]);

  return <PortfolioContext.Provider value={contextValue}>{children}</PortfolioContext.Provider>;
}

export const usePortfolio = (): PortfolioContextType => {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error("usePortfolio must be used within a PortfolioProvider");
  }
  return context;
};

/**
 * An investments' read through the query cache, under `investmentsKey(...key)`: asked for once
 * however many modules want it, and again after `changed()`. With `keepPrevious`, a new key (other
 * filters, another page, another range) keeps the last answer up until its own.
 */
export function useInvestmentsQuery<T>(
  key: unknown[], read: () => Promise<T>, { enabled = true, keepPrevious = false, pollMs }: { enabled?: boolean; keepPrevious?: boolean; pollMs?: number } = {},
): UseQueryResult<T> {
  return useQuery({
    queryKey: investmentsKey(...key),
    queryFn: read,
    enabled,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    // Read again on that interval while the tab is visible (a reading changing underneath the page).
    refetchInterval: pollMs,
  });
}

/** useInvestmentsQuery's answer alone: undefined while loading, null when it couldn't be read. */
export function useInvestmentsRead<T>(key: unknown[], read: () => Promise<T>, enabled = true): T | null | undefined {
  const query = useInvestmentsQuery(key, read, { enabled });
  return query.isError ? null : query.data;
}
