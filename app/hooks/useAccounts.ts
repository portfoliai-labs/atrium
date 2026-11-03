// hooks/useAccounts.ts
import { useWalletQuery } from "../context/WalletsContext";
import { accountService } from "../services/accountService";

/** The user's accounts, read again with the rest of the wallets after `changed()`. */
export function useAccounts(enabled = true) {
  return useWalletQuery(["accounts"], () => accountService.list(), { enabled });
}

/** The user's cards, every wallet's: a wallet's are filtered from them. */
export function useCards(enabled = true) {
  return useWalletQuery(["cards"], () => accountService.cards(), { enabled });
}
