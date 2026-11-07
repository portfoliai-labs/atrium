// models/Trading.ts
//
// Buying from the app (ianus' /v1/addresses, catena's addresses/v1, and /v1/trading-accounts,
// mercatura's trading_accounts/v1). An address is proved the user's by signing, with the wallet
// that holds it, a message the backend composes: nothing else of the wallet is ever sent, no key
// is kept. Each registered address becomes a trading account, and with it a portfolio (its assets)
// and a wallets' account; its stablecoins (/v1/chain-holdings, arca's chain/v1) come into the
// wallets the user links them to, as a bank's accounts do.

export interface AddressProof {
  nonce: string;
  // What the wallet signs and shows the user (Sign-In With Solana).
  message: string;
  expiresAt: string;
}

export interface OnchainAddress {
  uuid: string;
  // "solana".
  chain: string;
  address: string;
  registeredAt: string;
  // When the chain was last read for it; null before its first read.
  readAt: string | null;
}

export type TradingAccountKind = "chain_address" | "broker_account";

export interface TradingAccount {
  uuid: string;
  kind: TradingAccountKind;
  // The service it executes on ("catena", for an address).
  executor: string;
  // As the executor describes it ("Solana 7xKX…gAsU", "Solana").
  name: string;
  institution: string | null;
  // What its executor calls it: a chain address' is its OnchainAddress' uuid.
  reference: string;
  createdAt: string;
}

/** A stablecoin of one of the user's addresses: as a bank's account, linked to one wallet. */
export interface ChainHolding {
  uuid: string;
  // Its address' TradingAccount.
  tradingAccountUuid: string;
  // The address' account's name ("Solana 7xKX…gAsU"), while that account is there.
  accountName: string | null;
  // "USDC".
  symbol: string;
  // ISO 4217: what it is pegged to; it links only to a wallet of it.
  currency: string;
  // Its balance at its first read plus every movement since.
  balance: number;
  // Its first read: where its history starts.
  openedAt: string;
  // The wallet its movements come into; null while not linked.
  walletUuid: string | null;
  syncFrom: string | null;
  lastMovementAt: string | null;
}

// Orders (ianus' /v1/orders: mercatura's orders/v1, and catena's executions/v1 for what only the
// user's wallet can do). An order buys a token by the cash spent (USD: paid in USDC) or sells it by
// the units given; its venue (Jupiter, on Solana's mainnet) quotes it, catena prepares the
// transaction, the user's own wallet signs it, catena sends it. The platform never holds a key.

export type OrderSide = "buy" | "sell";

// requested → awaiting_signature (the wallet signs it) → submitted → filled, or rejected, failed,
// expired, cancelled.
export type OrderState =
  | "requested" | "awaiting_signature" | "submitted" | "filled" | "rejected" | "failed" | "expired" | "cancelled";

/** A venue's quote: what it would do now. */
export interface OrderQuote {
  venue: string;
  side: OrderSide;
  // The units got (a buy) or given (a sale), as the wallet shows them.
  quantity: number;
  // The cash spent (a buy) or got (a sale).
  cashAmount: number;
  cashCurrency: string;
  // Per unit, before the fees.
  price: number;
  fees: number;
  feeBps: number;
  // The least the order gets: units for a buy, cash for a sale.
  minimum: number;
  priceImpactPct: number | null;
  // "jupiterz": a market maker's firm quote.
  route: string;
}

export interface OrderEvent {
  state: OrderState;
  reason: string | null;
  occurredAt: string;
}

export interface Order {
  uuid: string;
  tradingAccountUuid: string;
  // "catena": signed through /v1/orders/{uuid}/transaction.
  executor: string;
  listingId: string;
  side: OrderSide;
  quantity: number | null;
  cashAmount: number | null;
  cashCurrency: string;
  slippageBps: number;
  state: OrderState;
  // Rejected or failed: a stable code ("NO_ROUTE") and the venue's words.
  reason: string | null;
  detail: string | null;
  venue: string | null;
  filledQuantity: number | null;
  averagePrice: number | null;
  fees: number | null;
  // Its transaction's signature on chain, once known.
  transaction: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  events: OrderEvent[];
}

export interface PlaceOrderInput {
  tradingAccountUuid: string;
  listingId: string;
  side: OrderSide;
  // One of the two: a sale's units, a buy's cash.
  quantity?: number;
  cashAmount?: number;
  cashCurrency: string;
  slippageBps?: number;
  // A uuid the client makes: placing again with it places nothing new.
  idempotencyKey: string;
}

export interface EligibilityNotice {
  // Its text is the client's, by version.
  version: string;
  acceptedAt: string | null;
}

/** An order as catena carries it out: awaiting a signature, the transaction (base64) and until when. */
export interface OrderExecution {
  orderUuid: string;
  state: OrderState;
  venue: string | null;
  reason: string | null;
  detail: string | null;
  quote: OrderQuote | null;
  transaction: string | null;
  expiresAt: string | null;
  signature: string | null;
  filledQuantity: number | null;
  averagePrice: number | null;
  fees: number | null;
  // Sent: the transaction on an explorer of the deployment's network, once its signature is known.
  explorerUrl?: string | null;
}

// GET /v1/orders/{o}/details (ianus' OrderDetailsResponse): a part its service can't give now is null.
export interface BalanceChange {
  // Null for SOL.
  mint: string | null;
  symbol: string | null;
  // Signed: what came in is positive.
  amount: number;
}

export interface OrderReceipt {
  network: string;
  slot: number;
  blockTime: string | null;
  // In SOL; paid by the address or by the venue (a market maker paying it).
  networkFee: number;
  feePayer: string;
  paidByAddress: boolean;
  changes: BalanceChange[];
}

export interface OrderMarket {
  // The listing's price at the minute of the fill, and what the trade paid over it (a sale: got under it).
  referencePrice: number;
  spreadCost: number | null;
  currency: string;
}

export interface OrderDetails {
  order: Order;
  execution: OrderExecution | null;
  receipt: OrderReceipt | null;
  market: OrderMarket | null;
}
