// models/Trading.ts
//
// Buying from the app (ianus' /v1/addresses, catena's addresses/v1, and /v1/trading-accounts,
// mercatura's trading_accounts/v1). An address is proved the user's by signing, with the wallet
// that holds it, a message the backend composes: nothing else of the wallet is ever sent, no key
// is kept. Each registered address becomes a trading account, and with it a portfolio (its assets)
// and a wallets' account (its stablecoins).

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
  createdAt: string;
}
