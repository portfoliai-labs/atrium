// models/Transaction.ts
// Aligned with backend DTOs in app/api/dto/routes_transactions.py

// Matches TransactionOperation enum from backend
type TransactionOperation = 'buy' | 'sell' | 'dividend' | 'other';

// Matches TransactionInput DTO (POST /v1/transactions/, POST /v1/transactions/validate)
interface TransactionInput {
  asset_id: string;
  isin?: string | null;
  ticker: string;
  date: string;
  operation: TransactionOperation;
  amount: number;
  // number for plain amounts; string (arbitrary decimal precision) for crypto quantities
  quantity?: number | string | null;
  price?: number | null;
  fees?: number;
  currency: string;
  broker?: string | null;
}

// Matches TransactionResponse DTO (GET/POST /v1/transactions/, PATCH /v1/transactions/{uuid})
interface TransactionResponse {
  transaction_uuid: string;
  asset_id: string;
  isin: string | null;
  ticker: string | null;
  name: string | null;
  asset_class: string | null;
  date: string;
  operation: TransactionOperation;
  amount: number;
  // Always returned as a string (arbitrary decimal precision, e.g. crypto amounts)
  quantity: string | null;
  price: number | null;
  fees: number;
  currency: string;
  broker: string | null;
}

// Matches TransactionListResponse DTO (GET /v1/transactions/)
interface TransactionListResponse {
  items: TransactionResponse[];
  total: number;
  limit: number;
  offset: number;
}

// Matches TransactionUpdatePayload DTO (PATCH /v1/transactions/{uuid})
interface TransactionUpdatePayload {
  asset_id?: string | null;
  isin?: string | null;
  ticker?: string | null;
  date?: string | null;
  operation?: TransactionOperation | null;
  amount?: number | null;
  quantity?: number | string | null;
  price?: number | null;
  fees?: number | null;
  currency?: string | null;
  broker?: string | null;
}

// Matches TransactionValidationResult DTO (POST /v1/transactions/validate)
interface TransactionValidationResult {
  asset_id: string;
  ticker: string | null;
  isin: string | null;
  valid: boolean;
  reason: string | null;
}

// Matches TransactionValidationResponse DTO (POST /v1/transactions/validate)
interface TransactionValidationResponse {
  results: TransactionValidationResult[];
  all_valid: boolean;
}

export type {
  TransactionOperation,
  TransactionInput,
  TransactionResponse,
  TransactionListResponse,
  TransactionUpdatePayload,
  TransactionValidationResult,
  TransactionValidationResponse,
};
