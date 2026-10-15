// services/transactionService.ts
import type {
  TransactionInput,
  TransactionOperation,
  TransactionResponse,
  TransactionListResponse,
  TransactionUpdatePayload,
} from "../models/Transaction";
import { apiFetch } from "./apiClient";

export interface TransactionFilters {
  ticker?: string | null;
  isin?: string | null;
  broker?: string | null;
  operation?: TransactionOperation | null;
  dateFrom?: string | null; // ISO date-time — only transactions on or after this date
  dateTo?: string | null; // ISO date-time — only transactions on or before this date
}

const filterParams = (params: URLSearchParams, filters?: TransactionFilters) => {
  if (filters?.ticker) params.set("ticker", filters.ticker);
  if (filters?.isin) params.set("isin", filters.isin);
  if (filters?.broker) params.set("broker", filters.broker);
  if (filters?.operation) params.set("operation", filters.operation);
  if (filters?.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters?.dateTo) params.set("date_to", filters.dateTo);
};

export const transactionService = {
  // GET /v1/portfolios/{p}/transactions
  async getUserTransactions(
    portfolioUuid: string,
    limit = 50,
    offset = 0,
    filters?: TransactionFilters
  ): Promise<TransactionListResponse> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    filterParams(params, filters);
    return apiFetch<TransactionListResponse>(`/v1/portfolios/${portfolioUuid}/transactions?${params.toString()}`);
  },

  // POST /v1/portfolios/{p}/transactions — persists one or more new transactions
  async saveTransactions(portfolioUuid: string, transactions: TransactionInput[]): Promise<TransactionResponse[]> {
    return apiFetch<TransactionResponse[]>(`/v1/portfolios/${portfolioUuid}/transactions`, {
      method: 'POST',
      body: JSON.stringify(transactions),
    });
  },

  // PATCH /v1/portfolios/{p}/transactions/{transaction_uuid}
  async updateTransaction(
    portfolioUuid: string, transactionUuid: string, payload: TransactionUpdatePayload,
  ): Promise<TransactionResponse> {
    return apiFetch<TransactionResponse>(`/v1/portfolios/${portfolioUuid}/transactions/${transactionUuid}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // DELETE /v1/portfolios/{p}/transactions — bulk delete by uuid list (at least one), replacing
  // the old delete-by-single-path endpoint.
  async deleteTransactions(portfolioUuid: string, transactionUuids: string[]): Promise<void> {
    return apiFetch<void>(`/v1/portfolios/${portfolioUuid}/transactions`, {
      method: 'DELETE',
      body: JSON.stringify(transactionUuids),
    });
  },

  // DELETE /v1/portfolios/{p}/transactions/all — deletes every transaction matching the given
  // filters; with no filters, deletes every transaction in the portfolio.
  async deleteAllTransactions(portfolioUuid: string, filters?: TransactionFilters): Promise<void> {
    const params = new URLSearchParams();
    filterParams(params, filters);
    const query = params.toString();
    return apiFetch<void>(`/v1/portfolios/${portfolioUuid}/transactions/all${query ? `?${query}` : ''}`, {
      method: 'DELETE',
    });
  },
};
