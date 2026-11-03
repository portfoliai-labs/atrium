// hooks/useChainHoldings.ts
import { useWalletQuery } from "../context/WalletsContext";
import { tradingService } from "../services/tradingService";
import type { ChainHolding } from "../models/Trading";

/**
 * The stablecoins of the user's addresses, each linked to a wallet or not: one read for every
 * module that wants them, read again with the rest of the wallets after `changed()`.
 */
export function useChainHoldings(enabled = true) {
  return useWalletQuery(["chainHoldings"], () => tradingService.holdings(), { enabled });
}

/** The trading accounts, to find an address' stablecoins (TradingAccount.reference). */
export function useTradingAccounts(enabled = true) {
  return useWalletQuery(["tradingAccounts"], () => tradingService.tradingAccounts(), { enabled });
}

/**
 * The stablecoin a wallet takes its movements from: undefined while they load (and for no wallet),
 * then the holding or null.
 */
export function useWalletHolding(walletUuid: string | undefined): ChainHolding | null | undefined {
  const holdings = useChainHoldings(!!walletUuid);
  if (!walletUuid || holdings.isPending) return undefined;
  return holdings.data?.find((h) => h.walletUuid === walletUuid) ?? null;
}
