// models/Custody.ts
// Who keeps a wallet's money or a portfolio's assets, and where (CustodyResponse on WalletResponse
// and PortfolioResponse): what the taxes on holdings tell apart (models/Tax, WealthTaxes): a bank,
// broker or exchange in Italy charges the stamp duty, one abroad leaves the IVAFE to the user, and
// crypto-assets on one's own addresses pay their own tax. Prefilled by the backend (a wallet's
// IBAN or linked bank, a crypto wallet's own keeping; a withheld portfolio's Italy, an on-chain
// account's own keeping); the user's own once set (PUT .../custody), cleared back to the prefill
// (DELETE .../custody). Null: not known yet, and the holding is left out of the taxes.

export type CustodyKind = "intermediary" | "self";

export type CustodySource = "iban" | "bank_link" | "chain" | "taxation_mode" | "trading_account" | "user";

export interface Custody {
  kind: CustodyKind;
  // An intermediary's: ISO 3166-1 alpha-2.
  country: string | null;
  source: CustodySource;
}

export interface CustodyRequest {
  kind: CustodyKind;
  country?: string | null;
}

export const CUSTODY_SOURCE_LABELS: Record<CustodySource, string> = {
  iban: "from the IBAN",
  bank_link: "from the linked bank",
  chain: "an on-chain address",
  taxation_mode: "a withheld portfolio is kept in Italy",
  trading_account: "an on-chain address",
  user: "set by you",
};
