// models/Transaction.ts
// Aligned with backend DTOs in app/api/dto/routes_transactions.py (ianus 0.27.0: nucleo's ledger).

// Matches TransactionOperation enum from backend. On an instrument: buy, sell, dividend, coupon,
// redemption (a bond repaid), transfer_in, transfer_out, reward (staking, an airdrop). Cash
// movements, with no instrument: deposit, withdrawal, interest, fee, tax, fx_conversion. Which
// fields each takes is in lib/operations.
type TransactionOperation =
  | 'buy' | 'sell' | 'dividend' | 'coupon' | 'redemption' | 'transfer_in' | 'transfer_out' | 'reward'
  | 'deposit' | 'withdrawal' | 'interest' | 'fee' | 'tax' | 'fx_conversion';

type RewardKind = 'staking' | 'airdrop';

// Matches TransactionInput DTO (POST /v1/portfolios/{p}/transactions, .../validate). With
// listing_id (census' listing, as /v1/listings gives it) the backend takes the identifiers from
// census: asset_id, isin and ticker aren't sent. One no provider prices is a 422. A manual asset
// is named by asset_id "manual:<uuid>" alone, in its own currency. A cash movement names no
// instrument: asset_id, listing_id, isin, ticker, exchange_mic, quantity and price are left out
// (422 otherwise). The amount is > 0 but on transfer_out (optional, or 0) and reward (≥ 0). A
// sale, transfer_out or redemption beyond the units held, and an option, a future or a leveraged
// certificate, are a 422 INVALID_TRANSACTION.
interface TransactionInput {
  listing_id?: string | null;
  asset_id?: string;
  isin?: string | null;
  ticker?: string;
  date: string;
  operation: TransactionOperation;
  amount?: number;
  // number for plain amounts; string (arbitrary decimal precision) for crypto quantities. A
  // bond's is its nominal.
  quantity?: number | string | null;
  // A bond's in % of the nominal.
  price?: number | null;
  fees?: number;
  currency: string;
  broker?: string | null;
  // fx_conversion only, both required: `amount` leaves `currency`, counter_amount (> 0) enters
  // counter_currency (another currency).
  counter_amount?: number | null;
  counter_currency?: string | null;
  // dividend and coupon only: 0 to the gross amount.
  withholding_tax?: number | null;
  // buy and sell only: a bond's accrued interest, ≥ 0.
  accrued_interest?: number | null;
  // reward only, required.
  reward_kind?: RewardKind | null;
}

// Matches TransactionResponse DTO (GET/POST /v1/portfolios/{p}/transactions, PATCH .../transactions/{t})
interface TransactionResponse {
  transaction_uuid: string;
  // The portfolio the row belongs to — differs from the listed one only on the aggregate.
  portfolio_uuid: string;
  // "" for a cash movement; "manual:<uuid>" for a manual asset.
  asset_id: string;
  // census' listing; null for one recorded by a market-data ticker.
  listing_id: string | null;
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
  counter_amount: number | null;
  counter_currency: string | null;
  withholding_tax: number | null;
  accrued_interest: number | null;
  reward_kind: RewardKind | null;
}

// Matches TransactionListResponse DTO (GET /v1/portfolios/{p}/transactions)
interface TransactionListResponse {
  items: TransactionResponse[];
  total: number;
  limit: number;
  offset: number;
}

// Matches TransactionUpdatePayload DTO (PATCH .../transactions/{uuid}). The new fields are
// dropped by nucleo when the operation changes.
interface TransactionUpdatePayload {
  // Moves it to census' listing, its identifiers then census'.
  listing_id?: string | null;
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
  counter_amount?: number | null;
  counter_currency?: string | null;
  withholding_tax?: number | null;
  accrued_interest?: number | null;
  reward_kind?: RewardKind | null;
}

// Matches TransactionValidationResult DTO (POST .../transactions/validate): one per transaction on
// an instrument, in their order; cash movements aren't validated.
interface TransactionValidationResult {
  listing_id?: string | null;
  asset_id: string;
  ticker: string | null;
  isin: string | null;
  valid: boolean;
  reason: string | null;
}

// Matches TransactionValidationResponse DTO (POST .../transactions/validate)
interface TransactionValidationResponse {
  results: TransactionValidationResult[];
  all_valid: boolean;
}

// Body of POST /v1/portfolios/{p}/transactions/transfer: units moved to another standard
// portfolio of the same owner, at the origin's average cost. `asset_id` as the origin's
// transactions name it. 422 INVALID_FIELD naming `toPortfolioUuid` (the same portfolio, or
// another owner's), `assetId` (not held that day) or `quantity` (more than held).
interface TransferPayload {
  to_portfolio_uuid: string;
  asset_id: string;
  // > 0, decimal.
  quantity: string;
  date: string;
}

// 201: the two transactions it recorded.
interface TransferResponse {
  transfer_out: TransactionResponse;
  transfer_in: TransactionResponse;
}

// What a manual asset's transactions name it by.
const MANUAL_ASSET_PREFIX = 'manual:';
const isManualAssetId = (assetId: string | null | undefined) => !!assetId && assetId.startsWith(MANUAL_ASSET_PREFIX);

export type {
  TransactionOperation,
  RewardKind,
  TransactionInput,
  TransactionResponse,
  TransactionListResponse,
  TransactionUpdatePayload,
  TransactionValidationResult,
  TransactionValidationResponse,
  TransferPayload,
  TransferResponse,
};
export { MANUAL_ASSET_PREFIX, isManualAssetId };
