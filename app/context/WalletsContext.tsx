// app/context/WalletsContext.tsx
"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { keepPreviousData, useQueries, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useUser } from "./UserContext";
import { ApiError } from "../services/apiClient";
import { walletService } from "../services/walletService";
import { apiWalletSource, categoryTree, type CategoryTree, type WalletSource } from "../lib/wallets";
import type { Category, Wallet, WalletSummary } from "../models/Wallet";

/**
 * WALLETS CONTEXT — an investor's wallets, loaded once for the dashboard: the Dashboard, Wealth, the
 * Sidebar's rows under Wealth and the wallet pages read the same list, archived wallets included,
 * and the same category tree (the user's categories, which name and colour every figure).
 * A demo account reads its own from the API like any other (arca's demo data), read only. Every
 * wallets' read is in the query cache (context/QueryContext) under a ["wallets", ...] key
 * (useWalletQuery), shared by the modules and pages that ask for it: after any write, `changed()`
 * invalidates them all, the list too (balances move with every movement), and what's on screen is
 * read again, staying up meanwhile. Empty, and never loaded, for an advisor.
 */
interface WalletsContextType {
  // Oldest first, archived included.
  wallets: Wallet[];
  // Empty until read (and where the API doesn't have them): a category then reads as its preset.
  categories: CategoryTree;
  // undefined while the first read is on, then the last read's error (null: read).
  categoriesError: string | null | undefined;
  // A category just made (from a movement's dialog), in the tree at once, before the next read.
  categoryAdded: (category: Category) => void;
  loading: boolean;
  error: string | null;
  // Whether the wallets can be shown at all: false while the API doesn't have them (a backend
  // without /v1/wallets answers 404), and for an advisor.
  available: boolean;
  // A demo account's: its sample data, read only, and said so.
  sample: boolean;
  source: WalletSource;
  changed: () => void;
}

const WalletsContext = createContext<WalletsContextType | undefined>(undefined);

/** A wallets' read's key in the query cache: everything under it goes with `changed()`. */
export const walletKey = (...parts: unknown[]) => ["wallets", ...parts];

const NO_WALLETS: Wallet[] = [];
const NO_CATEGORIES: Category[] = [];
const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export function WalletsProvider({ children }: { children: React.ReactNode }) {
  const { user, isDemo } = useUser();
  const enabled = !!user && user.role !== "ADVISOR";
  const sample = enabled && isDemo;
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: walletKey("list"), queryFn: () => walletService.list(true), enabled });
  // Apart from the wallets: a page shows without them, its categories as their presets.
  const categoryList = useQuery({ queryKey: walletKey("categories"), queryFn: () => apiWalletSource.categories(), enabled });

  const wallets = list.data ?? NO_WALLETS;
  const missing = list.error instanceof ApiError && list.error.status === 404;
  const error = list.error && !missing ? message(list.error, "Unable to load your wallets.") : null;
  // Loading until the first answer only: a reload after a write keeps the pages up.
  const loading = enabled && list.isPending;
  const categoriesError = categoryList.isPending ? undefined : categoryList.error ? message(categoryList.error, "Unable to load your categories.") : null;
  const categories = useMemo(() => categoryTree(categoryList.data ?? NO_CATEGORIES), [categoryList.data]);
  // After its parent's last descendant, or last of its kind at the top: the tree's order.
  const categoryAdded = useCallback((category: Category) => queryClient.setQueryData<Category[]>(walletKey("categories"), (list = []) => {
    const tree = categoryTree(list);
    const after = category.parentUuid
      ? [category.parentUuid, ...tree.descendants(category.parentUuid).map((c) => c.uuid)].at(-1)
      : tree.active(category.kind).at(-1)?.uuid;
    const i = list.findIndex((c) => c.uuid === after);
    return i < 0 ? [...list, category] : [...list.slice(0, i + 1), category, ...list.slice(i + 1)];
  }), [queryClient]);

  const changed = useCallback(() => { void queryClient.invalidateQueries({ queryKey: walletKey() }); }, [queryClient]);

  const value = useMemo<WalletsContextType>(() => ({
    wallets,
    categories,
    categoriesError,
    categoryAdded,
    loading,
    error,
    available: enabled && !missing,
    sample,
    source: apiWalletSource,
    changed,
  }), [sample, wallets, categories, categoriesError, categoryAdded, loading, error, enabled, missing, changed]);
  return <WalletsContext.Provider value={value}>{children}</WalletsContext.Provider>;
}

export const useWallets = (): WalletsContextType => {
  const context = useContext(WalletsContext);
  if (context === undefined) throw new Error("useWallets must be used within a WalletsProvider");
  return context;
};

/**
 * A wallets' read through the query cache, under `walletKey(...key)`: asked for once however many
 * modules want it, and again after `changed()`. Off where the wallets can't be shown. With
 * `keepPrevious`, a new key (another page, other filters) keeps the last answer up until its own.
 */
export function useWalletQuery<T>(
  key: unknown[], read: (source: WalletSource) => Promise<T>, { enabled = true, keepPrevious = false } = {},
): UseQueryResult<T> {
  const { source, available } = useWallets();
  return useQuery({
    queryKey: walletKey(...key),
    queryFn: () => read(source),
    enabled: available && enabled,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  });
}

/** useWalletQuery's answer alone: undefined while loading, null when it couldn't be read. */
export function useWalletRead<T>(key: unknown[], read: (source: WalletSource) => Promise<T>, enabled = true): T | null | undefined {
  const query = useWalletQuery(key, read, { enabled });
  return query.isError ? null : query.data;
}

/**
 * A summary (one wallet's, or every non-archived wallet's: `null`). undefined while loading, null
 * when it couldn't be read (e.g. no exchange rate for a wallet's currency: FxRatesUnavailableError).
 */
export function useWalletSummary(walletUuid: string | null, enabled = true): WalletSummary | null | undefined {
  return useWalletRead(["summary", walletUuid ?? "all"], (source) => source.summary(walletUuid), enabled);
}

/** Each wallet's own summary, by uuid: one call per wallet (the retired hub's cards, see WalletNode). */
export function useWalletSummaries(walletUuids: string[]): Record<string, WalletSummary | null> | undefined {
  const { source, available } = useWallets();
  return useQueries({
    queries: walletUuids.map((uuid) => ({
      queryKey: walletKey("summary", uuid), queryFn: () => source.summary(uuid), enabled: available,
    })),
    combine: (results) => (results.some((r) => r.isPending)
      ? undefined
      : Object.fromEntries(walletUuids.map((uuid, i) => [uuid, results[i].data ?? null]))),
  });
}
