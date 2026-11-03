// services/tradingService.ts
import type { AddressProof, ChainHolding, OnchainAddress, TradingAccount } from "../models/Trading";
import { apiFetch } from "./apiClient";

// Errors come back as ApiError with the backend's `error_type`: InvalidFieldError (422, an unknown
// chain or not an address), AddressProofExpiredError (409, the message is older than 5 minutes or
// was used: ask for a new one), AddressSignatureInvalidError (422, another wallet signed),
// AddressAlreadyRegisteredError (409), AddressLimitReachedError (409, 20 addresses),
// AddressNotFoundError (404), TradingAccountNotFoundError (404), ChainHoldingNotFoundError (404),
// InvalidChainHoldingLinkError (422, a wallet of another currency or a day out of range),
// WalletAlreadyLinkedError (409, the wallet takes a bank account's or another stablecoin's
// movements), WalletArchivedError (409). A demo account's writes are
// refused before they leave (see lib/demo).
export const tradingService = {
  // POST /v1/addresses/proofs — the message the address' wallet signs, valid for 5 minutes.
  async startProof(chain: string, address: string): Promise<AddressProof> {
    return apiFetch<AddressProof>(`/v1/addresses/proofs`, { method: "POST", body: JSON.stringify({ chain, address }) });
  },

  // POST /v1/addresses — the proof's address, with the wallet's signature of its message (base64).
  async register(nonce: string, signature: string): Promise<OnchainAddress> {
    return apiFetch<OnchainAddress>(`/v1/addresses`, { method: "POST", body: JSON.stringify({ nonce, signature }) });
  },

  // GET /v1/addresses — oldest first.
  async addresses(): Promise<OnchainAddress[]> {
    return apiFetch<OnchainAddress[]>(`/v1/addresses`);
  },

  // POST /v1/addresses/{a}/read — its stablecoins read now; their movements come into its wallets
  // moments later. 503 while the Solana node fails.
  async read(addressUuid: string): Promise<{ movements: number }> {
    return apiFetch<{ movements: number }>(`/v1/addresses/${addressUuid}/read`, { method: "POST" });
  },

  // DELETE /v1/addresses/{a} — nothing is read from it any more; its portfolio and wallets stay.
  async remove(addressUuid: string): Promise<void> {
    await apiFetch(`/v1/addresses/${addressUuid}`, { method: "DELETE" });
  },

  // GET /v1/trading-accounts — oldest first.
  async tradingAccounts(): Promise<TradingAccount[]> {
    return apiFetch<TradingAccount[]>(`/v1/trading-accounts`);
  },

  // GET /v1/chain-holdings — the addresses' stablecoins, in the order their reads told them.
  async holdings(): Promise<ChainHolding[]> {
    return apiFetch<ChainHolding[]>(`/v1/chain-holdings`);
  },

  // PUT /v1/chain-holdings/{h}/wallet — into one of the user's wallets of its currency, or a new
  // one (null); the movements already read come in at once.
  async linkHolding(holdingUuid: string, walletUuid: string | null): Promise<ChainHolding> {
    return apiFetch<ChainHolding>(`/v1/chain-holdings/${holdingUuid}/wallet`, {
      method: "PUT", body: JSON.stringify(walletUuid ? { walletUuid } : {}),
    });
  },

  // DELETE /v1/chain-holdings/{h}/wallet — the movements it brought stay.
  async unlinkHolding(holdingUuid: string): Promise<ChainHolding> {
    return apiFetch<ChainHolding>(`/v1/chain-holdings/${holdingUuid}/wallet`, { method: "DELETE" });
  },
};
