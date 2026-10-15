// app/context/WalletsContext.tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useUser } from "./UserContext";
import { ApiError } from "../services/apiClient";
import { walletService } from "../services/walletService";
import { apiWalletSource, type WalletSource } from "../lib/wallets";
import { DEMO_WALLETS, demoWalletSource } from "../lib/mock/wallets";
import type { Wallet, WalletSummary } from "../models/Wallet";

/**
 * WALLETS CONTEXT — an investor's wallets, loaded once for the dashboard: the Dashboard, Wealth, the
 * Sidebar's rows under Wealth and the wallet pages read the same list, archived wallets included.
 * A demo account's are the sample data (lib/mock/wallets), read only. Pages that read movements or
 * summaries refetch when `version` moves: after any write, `changed()` bumps it and reloads the
 * list (balances move with every movement). Empty, and never loaded, for an advisor.
 */
interface WalletsContextType {
  // Oldest first, archived included.
  wallets: Wallet[];
  loading: boolean;
  error: string | null;
  // Whether the wallets can be shown at all: false while the API doesn't have them (a backend
  // without /v1/wallets answers 404), and for an advisor.
  available: boolean;
  // A demo account's sample data: read only, and said so.
  sample: boolean;
  source: WalletSource;
  version: number;
  changed: () => void;
}

const WalletsContext = createContext<WalletsContextType | undefined>(undefined);

export function WalletsProvider({ children }: { children: React.ReactNode }) {
  const { user, isDemo } = useUser();
  const enabled = !!user && user.role !== "ADVISOR";
  const sample = enabled && isDemo;
  const [wallets, setWallets] = useState<Wallet[]>([]);
  // Loading until the first answer only: a reload after a write keeps the pages up.
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    if (!enabled || sample) return;
    try {
      setWallets(await walletService.list(true));
      setError(null);
      setMissing(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setMissing(true);
      else setError(err instanceof Error ? err.message : "Unable to load your wallets.");
    } finally {
      setLoaded(true);
    }
  }, [enabled, sample]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const loading = enabled && !sample && !loaded;
  const changed = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo<WalletsContextType>(() => ({
    wallets: sample ? DEMO_WALLETS : wallets,
    loading,
    error,
    available: enabled && !missing,
    sample,
    source: sample ? demoWalletSource : apiWalletSource,
    version,
    changed,
  }), [sample, wallets, loading, error, enabled, missing, version, changed]);
  return <WalletsContext.Provider value={value}>{children}</WalletsContext.Provider>;
}

export const useWallets = (): WalletsContextType => {
  const context = useContext(WalletsContext);
  if (context === undefined) throw new Error("useWallets must be used within a WalletsProvider");
  return context;
};

/**
 * A summary (one wallet's, or every non-archived wallet's: `null`), refetched as the wallets change.
 * undefined while loading, null when it couldn't be read (e.g. no exchange rate for a wallet's
 * currency: FxRatesUnavailableError).
 */
export function useWalletSummary(walletUuid: string | null, enabled = true) {
  const { source, version, available } = useWallets();
  const key = `${walletUuid ?? "all"}:${version}`;
  const [state, setState] = useState<{ key: string; value: WalletSummary | null } | null>(null);
  useEffect(() => {
    if (!enabled || !available) return;
    let cancelled = false;
    source.summary(walletUuid)
      .then((value) => { if (!cancelled) setState({ key, value }); })
      .catch(() => { if (!cancelled) setState({ key, value: null }); });
    return () => { cancelled = true; };
  }, [source, walletUuid, key, enabled, available]);
  return state?.key === key ? state.value : undefined;
}

/** Each wallet's own summary, by uuid (for the hub's cards and the Dashboard's rows). */
export function useWalletSummaries(walletUuids: string[]) {
  const { source, version } = useWallets();
  const key = `${walletUuids.join(",")}:${version}`;
  const [state, setState] = useState<{ key: string; value: Record<string, WalletSummary | null> } | null>(null);
  useEffect(() => {
    if (walletUuids.length === 0) return;
    let cancelled = false;
    Promise.all(walletUuids.map((uuid) => source.summary(uuid).catch(() => null))).then((list) => {
      if (!cancelled) setState({ key, value: Object.fromEntries(walletUuids.map((uuid, i) => [uuid, list[i]])) });
    });
    return () => { cancelled = true; };
    // walletUuids is read through `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, key]);
  if (walletUuids.length === 0) return {};
  return state?.key === key ? state.value : undefined;
}
