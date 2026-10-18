// models/Banking.ts
//
// Open banking (ianus' /v1/banking, arca's banking/v1): read only. A link is one consent at one
// bank; its accounts come, one each, into a wallet of their currency.

export interface Bank {
  // What a link is started with, beside the country.
  name: string;
  country: string;
  logoUrl: string | null;
  maxConsentDays: number;
}

export type BankLinkStatus = "active" | "expired";

export interface BankAccount {
  uuid: string;
  linkUuid: string;
  name: string | null;
  // The IBAN's last four characters, when the bank gives one.
  ibanLast4: string | null;
  currency: string;
  // The wallet its movements come into; null while not linked.
  walletUuid: string | null;
  syncFrom: string | null;
  syncedThrough: string | null;
  // The balance the bank reported at the last read, beside the wallet's own.
  reportedBalance: number | null;
  reportedBalanceOn: string | null;
}

export interface BankLink {
  uuid: string;
  bankName: string;
  country: string;
  status: BankLinkStatus;
  validUntil: string | null;
  lastSyncedAt: string | null;
  accounts: BankAccount[];
  createdAt: string;
}

export interface StartedBankLink {
  uuid: string;
  // The bank's page the consent is given on.
  authorizationUrl: string;
}

export interface AccountSync {
  accountUuid: string;
  imported: number;
  duplicates: number;
  // In another currency than the wallet's, or before its opening date.
  skipped: number;
}

export interface BankLinkSync {
  link: BankLink;
  accounts: AccountSync[];
}
