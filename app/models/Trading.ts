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
