// services/accountService.ts
import type { Account, Card, CardCreateRequest, CardUpdateRequest } from "../models/Account";
import { apiFetch } from "./apiClient";

// Errors come back as ApiError with the backend's `error_type`: CardNotFoundError /
// WalletNotFoundError (404, someone else's included), InvalidCardError (422: a card on a wallet
// its kind doesn't take, more than 4 digits), CardLimitReachedError (409, past 20 on a wallet),
// WalletArchivedError (409).
export const accountService = {
  // GET /v1/accounts — oldest first, each with its wallets and their balance.
  async list(): Promise<Account[]> {
    return apiFetch<Account[]>(`/v1/accounts`);
  },

  // GET /v1/cards — all of them, or one wallet's; oldest first.
  async cards(walletUuid?: string): Promise<Card[]> {
    return apiFetch<Card[]>(`/v1/cards${walletUuid ? `?walletUuid=${encodeURIComponent(walletUuid)}` : ""}`);
  },

  async createCard(payload: CardCreateRequest): Promise<Card> {
    return apiFetch<Card>(`/v1/cards`, { method: "POST", body: JSON.stringify(payload) });
  },

  async updateCard(cardUuid: string, payload: CardUpdateRequest): Promise<Card> {
    return apiFetch<Card>(`/v1/cards/${cardUuid}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  // DELETE /v1/cards/{c} — the movements it made stay, no longer naming it.
  async removeCard(cardUuid: string): Promise<void> {
    await apiFetch(`/v1/cards/${cardUuid}`, { method: "DELETE" });
  },
};
