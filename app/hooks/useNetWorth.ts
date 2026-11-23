// hooks/useNetWorth.ts
"use client";

import { useInvestmentsQuery, usePortfolio } from "../context/PortfolioContext";
import type { PortfolioSnapshot } from "../models/Portfolio";
import { portfolioService } from "../services/portfolioService";
import { useRealEstateNetWorth, type RealEstateNetWorth } from "./useRealEstateNetWorth";
import { useWalletsOverview, type WalletsOverview } from "./useWalletsOverview";

export interface NetWorth {
  // The portfolios' currency, else the wallets', else the real estate's.
  currency: string;
  investments: number;
  // The wallets' balance and the real estate's equity, only when in that currency (0 otherwise).
  walletsCounted: number;
  realEstateCounted: number;
  total: number;
}

/**
 * The Dashboard's net worth rule: the portfolios at today's prices plus the wallets' balance and the
 * real estate's equity, each of these two added in only when in the portfolios' currency.
 */
export function netWorthOf(
  snapshot: PortfolioSnapshot | null, wallets: WalletsOverview | null, realEstate: RealEstateNetWorth | null,
): NetWorth {
  const currency = snapshot?.currency ?? wallets?.currency ?? realEstate?.overview?.currency ?? "EUR";
  const investments = snapshot?.totalMarketValue ?? 0;
  const walletsCounted = wallets && wallets.currency === currency ? wallets.balance ?? 0 : 0;
  const overview = realEstate?.overview ?? null;
  const realEstateCounted = overview && overview.currency === currency ? overview.equity : 0;
  return { currency, investments, walletsCounted, realEstateCounted, total: investments + walletsCounted + realEstateCounted };
}

/**
 * NET WORTH — what the app tracks for the user, as the Dashboard adds it up (see netWorthOf): every
 * portfolio (the aggregate, or the only real one; a backtest never), the wallets and the real
 * estate. Reads the same caches as the Dashboard. undefined while loading or when a read failed;
 * null when nothing is tracked.
 */
export function useNetWorth(): NetWorth | null | undefined {
  const { portfolios } = usePortfolio();
  const wallets = useWalletsOverview();
  const realEstate = useRealEstateNetWorth();
  const headline = portfolios.find((p) => p.isAggregate) ?? portfolios.find((p) => !p.isVirtual);
  const headlineUuid = headline?.uuid ?? "";
  const overviewRead = useInvestmentsQuery(
    ["overview", headlineUuid], () => portfolioService.getPortfolioOverview(headlineUuid), { enabled: headlineUuid !== "" },
  );

  if (wallets === undefined || realEstate === undefined) return undefined;
  if (headline && overviewRead.data === undefined) return undefined;
  const snapshot = overviewRead.data ?? null;
  const someWallets = wallets && wallets.wallets.length > 0 ? wallets : null;
  const someProperties = realEstate && realEstate.properties.length > 0 ? realEstate : null;
  if (!snapshot && !someWallets && !someProperties) return null;
  return netWorthOf(snapshot, someWallets, someProperties);
}
