// lib/operations.ts
//
// OPERATIONS — what a transaction can be (models/Transaction's TransactionOperation, after nucleo's
// ledger, ianus 0.27.0), and the rules every form, list and import shares: which name an
// instrument and which only move cash, which fields each one takes or requires, and how each reads.

import type { RewardKind, TransactionOperation } from "../models/Transaction";

// On an instrument: a security, a crypto asset or a manual asset.
export const INSTRUMENT_OPERATIONS: TransactionOperation[] = [
  "buy", "sell", "dividend", "coupon", "redemption", "transfer_in", "transfer_out", "reward",
];
// Cash movements: no instrument (no asset_id, listing, isin, ticker, quantity or price).
export const CASH_OPERATIONS: TransactionOperation[] = ["deposit", "withdrawal", "interest", "fee", "tax", "fx_conversion"];
export const OPERATIONS: TransactionOperation[] = [...INSTRUMENT_OPERATIONS, ...CASH_OPERATIONS];

export const isCashOperation = (op: TransactionOperation | string): boolean => (CASH_OPERATIONS as string[]).includes(op);
export const isOperation = (op: unknown): op is TransactionOperation => typeof op === "string" && (OPERATIONS as string[]).includes(op);

// Quantity is required on these (on a bond, the nominal); price on these (a bond's in % of the
// nominal). A dividend in kind takes both or neither; a transfer_out's price is optional.
export const QUANTITY_REQUIRED: TransactionOperation[] = ["buy", "sell", "transfer_in", "transfer_out", "redemption", "reward"];
export const PRICE_REQUIRED: TransactionOperation[] = ["buy", "sell", "transfer_in", "redemption", "reward"];
// Where quantity and price are asked at all.
export const TAKES_QUANTITY: TransactionOperation[] = [...QUANTITY_REQUIRED, "dividend"];
// The amount is > 0 on every operation but these: a transfer_out's is optional (or 0), a
// reward's ≥ 0.
export const AMOUNT_OPTIONAL: TransactionOperation[] = ["transfer_out", "reward"];
// Only these take a withholding tax (0 to the gross amount), an accrued interest (≥ 0), a
// reward kind, a counter amount and currency.
export const WITHHOLDING_OPERATIONS: TransactionOperation[] = ["dividend", "coupon"];
export const ACCRUED_INTEREST_OPERATIONS: TransactionOperation[] = ["buy", "sell"];

export const REWARD_KINDS: RewardKind[] = ["staking", "airdrop"];
export const REWARD_KIND_LABELS: Record<RewardKind, string> = { staking: "Staking", airdrop: "Airdrop" };

export const OPERATION_LABELS: Record<TransactionOperation, string> = {
  buy: "Buy",
  sell: "Sell",
  dividend: "Dividend",
  coupon: "Coupon",
  redemption: "Redemption",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  reward: "Reward",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  interest: "Interest",
  fee: "Fee",
  tax: "Tax",
  fx_conversion: "FX conversion",
};

// What each one is, for a hint under the form's choice.
export const OPERATION_HINTS: Record<TransactionOperation, string> = {
  buy: "Units bought. On a bond, the quantity is the nominal and the price a % of it.",
  sell: "Units sold, at most those held. On a bond, the quantity is the nominal and the price a % of it.",
  dividend: "A dividend paid in cash, or in kind as new units.",
  coupon: "A bond's coupon, as received.",
  redemption: "A bond repaid: the nominal repaid, its price in % (100 at par), and the cash received.",
  transfer_in: "Units brought in from elsewhere, at what they cost you in all.",
  transfer_out: "Units moved out to elsewhere, at most those held.",
  reward: "Units received from staking or an airdrop.",
  deposit: "Cash put into the account.",
  withdrawal: "Cash taken out of the account.",
  interest: "Interest the cash earned.",
  fee: "A fee charged to the account, not on a trade.",
  tax: "A tax charged to the account.",
  fx_conversion: "Cash changed from one currency into another.",
};

export const operationLabel = (op: string) => OPERATION_LABELS[op as TransactionOperation] ?? op.replace(/_/g, " ");
