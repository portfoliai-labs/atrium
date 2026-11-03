// models/Account.ts
// The accounts and cards (/v1/accounts, /v1/cards; ianus' dto/accounts.py, arca's accounts/v1 and
// cards/v1): camelCase. A wallet is a balance; an account groups some of the user's wallets (a
// bank's EUR and USD, an address' stablecoins), and a wallet is one of its by its `accountUuid`.
// A bank connected or an on-chain address makes one; none is made by hand. A card is on the
// wallet it spends from, never with its number nor its CVC.

export interface Account {
  uuid: string;
  name: string;
  // The bank or issuer.
  institution: string | null;
  // Who holds it, as the bank writes it.
  holder: string | null;
  // The bank link that made it, while the link is there.
  bankLinkUuid: string | null;
  // The on-chain address that made it (models/Trading), while it is there.
  tradingAccountUuid: string | null;
  // Archived ones included, oldest first.
  walletUuids: string[];
  // What its wallets that aren't archived hold together, at today's rate in the user's reference
  // currency (`balanceCurrency`); null when it can't be told (a rate missing).
  balance: number | null;
  balanceCurrency: string | null;
  createdAt: string;
}

export type CardKind = "debit" | "credit" | "prepaid";

export type CardNetwork = "visa" | "mastercard" | "maestro" | "amex" | "diners" | "discover" | "jcb" | "unionpay" | "other";

export interface Card {
  uuid: string;
  walletUuid: string;
  name: string | null;
  kind: CardKind;
  network: CardNetwork;
  // The number's last four digits: nothing more of it.
  lastDigits: string;
  expiryMonth: number;
  expiryYear: number;
  // Past its expiry month.
  expired: boolean;
  // A credit card's, in its wallet's currency.
  creditLimit: number | null;
  createdAt: string;
}

// A credit card goes on a credit card's wallet, a debit or prepaid card on one that is neither a
// credit card's nor cash.
export interface CardCreateRequest {
  walletUuid: string;
  name?: string | null;
  kind: CardKind;
  network: CardNetwork;
  // Exactly 4 digits.
  lastDigits: string;
  expiryMonth: number;
  expiryYear: number;
  creditLimit?: number | string | null;
}

// Only the fields sent change; "" clears the name, 0 the limit. The wallet and kind don't change.
export type CardUpdateRequest = Partial<Omit<CardCreateRequest, "walletUuid" | "kind">>;
