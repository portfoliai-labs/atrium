// services/walletService.ts
import type {
  AnalyzeStatementRequest, Movement, MovementCategory, MovementFilters, MovementInput, MovementList,
  MovementUpdateRequest, StatementColumnMapping, StatementColumnMappingResponse, StatementImportResult,
  Transfer, TransferCreateRequest, Wallet, WalletCreateRequest, WalletSummary, WalletUpdateRequest,
} from "../models/Wallet";
import { apiFetch, apiFetchForm } from "./apiClient";

// Errors come back as ApiError with the backend's `detail` as the message and its `error_type`:
// WalletNotFoundError / MovementNotFoundError (404, someone else's included), WalletArchivedError
// (409, a write on an archived wallet), WalletHasMovementsError (409, a currency change),
// MovementInTransferError (409, a transfer leg's date, amount or category), InvalidWalletError /
// InvalidMovementError / InvalidTransferError (422), FxRatesUnavailableError (503, the summary
// across wallets), ImportFileParsingError / ImportMappingIncompleteError (422). A demo account's
// writes are refused before they leave (see lib/demo).

function movementQuery(filters: MovementFilters = {}) {
  const params = new URLSearchParams();
  if (filters.bookedFrom) params.set("bookedFrom", filters.bookedFrom);
  if (filters.bookedTo) params.set("bookedTo", filters.bookedTo);
  for (const c of filters.categories ?? []) params.append("category", c);
  if (filters.uncategorizedOnly) params.set("uncategorizedOnly", "true");
  if (filters.text?.trim()) params.set("text", filters.text.trim());
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.excludeTransfers) params.set("excludeTransfers", "true");
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.offset !== undefined) params.set("offset", String(filters.offset));
  const query = params.toString();
  return query ? `?${query}` : "";
}

function monthRange(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const walletService = {
  // GET /v1/wallets — oldest first; the archived ones too when asked.
  async list(includeArchived = false): Promise<Wallet[]> {
    return apiFetch<Wallet[]>(`/v1/wallets${includeArchived ? "?includeArchived=true" : ""}`);
  },

  // POST /v1/wallets — openingBalance 0 and openingDate today unless given.
  async create(payload: WalletCreateRequest): Promise<Wallet> {
    return apiFetch<Wallet>(`/v1/wallets`, { method: "POST", body: JSON.stringify(payload) });
  },

  async get(walletUuid: string): Promise<Wallet> {
    return apiFetch<Wallet>(`/v1/wallets/${walletUuid}`);
  },

  // PATCH /v1/wallets/{w} — only the fields sent change.
  async update(walletUuid: string, payload: WalletUpdateRequest): Promise<Wallet> {
    return apiFetch<Wallet>(`/v1/wallets/${walletUuid}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  // PUT /v1/wallets/{w}/archived — an archived wallet is read only and out of the summary.
  async setArchived(walletUuid: string, archived: boolean): Promise<Wallet> {
    return apiFetch<Wallet>(`/v1/wallets/${walletUuid}/archived`, { method: "PUT", body: JSON.stringify({ archived }) });
  },

  // DELETE /v1/wallets/{w} — its movements go with it (a transfer's other leg too).
  async remove(walletUuid: string): Promise<void> {
    await apiFetch(`/v1/wallets/${walletUuid}`, { method: "DELETE" });
  },

  // GET /v1/wallets/summary (every non-archived wallet, in the user's reference currency) or
  // /v1/wallets/{w}/summary (its own currency). The last 12 months, this one included, by default.
  async summary(walletUuid: string | null, from?: string, to?: string): Promise<WalletSummary> {
    const base = walletUuid ? `/v1/wallets/${walletUuid}/summary` : `/v1/wallets/summary`;
    return apiFetch<WalletSummary>(`${base}${monthRange(from, to)}`);
  },

  // GET /v1/wallets/movements (every wallet's, archived included) or /v1/wallets/{w}/movements.
  async movements(walletUuid: string | null, filters?: MovementFilters): Promise<MovementList> {
    const base = walletUuid ? `/v1/wallets/${walletUuid}/movements` : `/v1/wallets/movements`;
    return apiFetch<MovementList>(`${base}${movementQuery(filters)}`);
  },

  // POST /v1/wallets/{w}/movements — 1 to 500, all or none.
  async addMovements(walletUuid: string, movements: MovementInput[]): Promise<Movement[]> {
    return apiFetch<Movement[]>(`/v1/wallets/${walletUuid}/movements`, { method: "POST", body: JSON.stringify(movements) });
  },

  // PATCH /v1/wallets/movements/{m}
  async updateMovement(movementUuid: string, payload: MovementUpdateRequest): Promise<Movement> {
    return apiFetch<Movement>(`/v1/wallets/movements/${movementUuid}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  // POST /v1/wallets/movements/categorize — null clears the category.
  async categorize(movementUuids: string[], category: MovementCategory | null): Promise<Movement[]> {
    return apiFetch<Movement[]>(`/v1/wallets/movements/categorize`, {
      method: "POST",
      body: JSON.stringify({ movementUuids, category }),
    });
  },

  // DELETE /v1/wallets/movements — all or none; a transfer's leg takes the other with it (counted).
  async deleteMovements(movementUuids: string[]): Promise<{ deleted: number }> {
    return apiFetch<{ deleted: number }>(`/v1/wallets/movements`, { method: "DELETE", body: JSON.stringify(movementUuids) });
  },

  // POST /v1/wallets/transfers
  async transfer(payload: TransferCreateRequest): Promise<Transfer> {
    return apiFetch<Transfer>(`/v1/wallets/transfers`, { method: "POST", body: JSON.stringify(payload) });
  },

  // POST /v1/wallets/transfers/link — two movements of two wallets, opposite in sign, made one
  // transfer (their categories are cleared).
  async linkTransfer(firstMovementUuid: string, secondMovementUuid: string): Promise<Transfer> {
    return apiFetch<Transfer>(`/v1/wallets/transfers/link`, {
      method: "POST",
      body: JSON.stringify({ firstMovementUuid, secondMovementUuid }),
    });
  },

  // POST /v1/wallets/transfers/{t}/unlink — back to two plain, uncategorised movements.
  async unlinkTransfer(transferUuid: string): Promise<Movement[]> {
    return apiFetch<Movement[]>(`/v1/wallets/transfers/${transferUuid}/unlink`, { method: "POST" });
  },

  // POST /v1/wallets/{w}/import/analyze-columns — a proposed mapping for a statement's columns.
  async analyzeStatement(walletUuid: string, payload: AnalyzeStatementRequest): Promise<StatementColumnMappingResponse> {
    return apiFetch<StatementColumnMappingResponse>(`/v1/wallets/${walletUuid}/import/analyze-columns`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // POST /v1/wallets/{w}/import/commit — the file (CSV/XLS/XLSX, up to 10 MB) and the confirmed
  // mapping. Rows already in the wallet are counted as duplicates, not added again; what's imported
  // arrives uncategorised.
  async commitStatement(walletUuid: string, file: File, mapping: StatementColumnMapping): Promise<StatementImportResult> {
    const form = new FormData();
    form.append("file", file);
    form.append("mapping", JSON.stringify(mapping));
    return apiFetchForm<StatementImportResult>(`/v1/wallets/${walletUuid}/import/commit`, form);
  },
};
