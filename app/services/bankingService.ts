// services/bankingService.ts
import type { Bank, BankAccount, BankLink, BankLinkSync, StartedBankLink } from "../models/Banking";
import { apiFetch } from "./apiClient";

// Errors come back as ApiError with the backend's `error_type`: BankNotFoundError (404),
// BankLinkNotFoundError (404, a state already used or someone else's), BankAccountNotFoundError (404),
// BankAuthorizationFailedError (409, the bank refused the code), BankConsentExpiredError (409, link
// the bank again), WalletAlreadyLinkedError (409), WalletArchivedError (409),
// InvalidBankAccountLinkError (422, another currency, a day out of range), BankingUnavailableError
// (503, the aggregator down or not configured). A demo account's writes are refused before they
// leave (see lib/demo).
export const bankingService = {
  // GET /v1/banking/banks?country= — by name.
  async banks(country: string): Promise<Bank[]> {
    return apiFetch<Bank[]>(`/v1/banking/banks?country=${encodeURIComponent(country)}`);
  },

  // GET /v1/banking/links — oldest first, each with its accounts.
  async links(): Promise<BankLink[]> {
    return apiFetch<BankLink[]>(`/v1/banking/links`);
  },

  // POST /v1/banking/links — the caller is then sent to `authorizationUrl`; the bank sends them
  // back to /dashboard/bank-link with `state` and `code`.
  async start(bankName: string, country: string, replacesLinkUuid?: string): Promise<StartedBankLink> {
    return apiFetch<StartedBankLink>(`/v1/banking/links`, {
      method: "POST", body: JSON.stringify({ bankName, country, replacesLinkUuid: replacesLinkUuid ?? null }),
    });
  },

  // POST /v1/banking/links/complete — what the bank sent the caller back with.
  async complete(state: string, code: string): Promise<BankLink> {
    return apiFetch<BankLink>(`/v1/banking/links/complete`, { method: "POST", body: JSON.stringify({ state, code }) });
  },

  // POST /v1/banking/links/{l}/sync — reads its linked accounts now.
  async sync(linkUuid: string): Promise<BankLinkSync> {
    return apiFetch<BankLinkSync>(`/v1/banking/links/${linkUuid}/sync`, { method: "POST" });
  },

  // DELETE /v1/banking/links/{l} — ends the consent; the movements it brought stay.
  async remove(linkUuid: string): Promise<void> {
    await apiFetch(`/v1/banking/links/${linkUuid}`, { method: "DELETE" });
  },

  // PUT /v1/banking/accounts/{a}/wallet — into a wallet of its currency; `syncFrom` defaults to
  // the day after the wallet's last movement (at most 90 days back).
  async linkAccount(accountUuid: string, walletUuid: string, syncFrom?: string): Promise<BankAccount> {
    return apiFetch<BankAccount>(`/v1/banking/accounts/${accountUuid}/wallet`, {
      method: "PUT", body: JSON.stringify({ walletUuid, syncFrom: syncFrom ?? null }),
    });
  },

  // DELETE /v1/banking/accounts/{a}/wallet — the movements it brought stay.
  async unlinkAccount(accountUuid: string): Promise<BankAccount> {
    return apiFetch<BankAccount>(`/v1/banking/accounts/${accountUuid}/wallet`, { method: "DELETE" });
  },
};
