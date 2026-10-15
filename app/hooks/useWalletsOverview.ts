// hooks/useWalletsOverview.ts
"use client";

import { useMemo } from "react";
import { useWallets, useWalletSummaries, useWalletSummary } from "../context/WalletsContext";
import { walletColor } from "../lib/wallets";
import type { WalletKind, WalletSummaryMonth } from "../models/Wallet";

export interface WalletLine {
  id: string;
  name: string;
  kind: WalletKind;
  color: string;
  // In the wallet's own currency.
  balance: number;
  currency: string;
  // This month's money in minus money out, moves to and from the user's other wallets included;
  // null while loading.
  net: number | null;
}

export interface WalletsOverview {
  // The user's reference currency: what every non-archived wallet is added up in.
  currency: string;
  // null when they can't be added up (an exchange rate missing).
  balance: number | null;
  // This month's money in and out, moves between one's own wallets left out.
  income: number;
  expenses: number;
  // The last 12 months, oldest first (empty when they can't be added up).
  months: WalletSummaryMonth[];
  // Each non-archived wallet on its own, oldest first.
  wallets: WalletLine[];
}

/**
 * WALLETS OVERVIEW — every non-archived wallet together, and each on its own, for the Dashboard's
 * net worth and Wealth's first page: the balance, this month's money in and out, the months. null
 * where the wallets can't be shown (an advisor, a backend without them); undefined while loading.
 * A demo account's are the sample data.
 */
export function useWalletsOverview(): WalletsOverview | null | undefined {
  const { wallets, loading, available } = useWallets();
  const active = useMemo(() => wallets.map((w, i) => ({ w, color: walletColor(w, i) })).filter(({ w }) => !w.archived), [wallets]);
  const total = useWalletSummary(null, available && !loading && active.length > 0);
  const each = useWalletSummaries(useMemo(() => active.map(({ w }) => w.uuid), [active]));

  return useMemo(() => {
    if (!available) return null;
    if (loading) return undefined;
    const lines: WalletLine[] = active.map(({ w, color }) => ({
      id: w.uuid, name: w.name, kind: w.kind, color, balance: w.balance, currency: w.currency,
      net: each?.[w.uuid]?.months.at(-1)?.net ?? (each ? 0 : null),
    }));
    if (active.length === 0) return { currency: "EUR", balance: 0, income: 0, expenses: 0, months: [], wallets: [] };
    if (total === undefined) return undefined;
    const month = total?.months.at(-1);
    return {
      currency: total?.currency ?? active[0].w.currency,
      balance: month ? month.closingBalance : null,
      income: month?.income ?? 0,
      expenses: month?.spending ?? 0,
      months: total?.months ?? [],
      wallets: lines,
    };
  }, [available, loading, active, total, each]);
}
