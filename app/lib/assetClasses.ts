// lib/assetClasses.ts
// An asset class as ianus serves it (`assetClassCode`; `asset_class_code` on transactions): one
// closed vocabulary of stable codes (nucleo's). Anything shown reads the code through this file,
// never the code itself: a code out of the vocabulary, or missing, reads as unclassified.

export const ASSET_CLASS_CODES = [
  "EQUITY", "ETF", "ETC", "MUTUAL_FUND", "MONEY_MARKET", "CRYPTO", "BOND", "CERTIFICATE",
  "LEVERAGED_CERTIFICATE", "OPTION", "FUTURE", "INDEX", "CURRENCY",
  // Only on nucleo's documents (a portfolio's uninvested cash, a manually valued asset).
  "CASH", "MANUAL",
  "UNKNOWN",
] as const;

export type AssetClassCode = (typeof ASSET_CLASS_CODES)[number];

export const UNKNOWN_ASSET_CLASS: AssetClassCode = "UNKNOWN";

const KNOWN = new Set<string>(ASSET_CLASS_CODES);

// A group of assets of one class: a breakdown's slice, a chart's row, a table's column.
const PLURAL_LABELS: Record<AssetClassCode, string> = {
  EQUITY: "Stocks",
  ETF: "ETFs",
  ETC: "ETCs",
  MUTUAL_FUND: "Mutual funds",
  MONEY_MARKET: "Money market funds",
  CRYPTO: "Crypto-assets",
  BOND: "Bonds",
  CERTIFICATE: "Certificates",
  LEVERAGED_CERTIFICATE: "Leveraged certificates",
  OPTION: "Options",
  FUTURE: "Futures",
  INDEX: "Indices",
  CURRENCY: "Currencies",
  CASH: "Cash",
  MANUAL: "Manually valued assets",
  UNKNOWN: "Unclassified",
};

// One asset's class: the asset page, a holding's row.
const SINGULAR_LABELS: Record<AssetClassCode, string> = {
  EQUITY: "Stock",
  ETF: "ETF",
  ETC: "ETC",
  MUTUAL_FUND: "Mutual fund",
  MONEY_MARKET: "Money market fund",
  CRYPTO: "Crypto-asset",
  BOND: "Bond",
  CERTIFICATE: "Certificate",
  LEVERAGED_CERTIFICATE: "Leveraged certificate",
  OPTION: "Option",
  FUTURE: "Future",
  INDEX: "Index",
  CURRENCY: "Currency",
  CASH: "Cash",
  MANUAL: "Manually valued asset",
  UNKNOWN: "Unclassified",
};

/** A served code, closed to the vocabulary: anything else is unclassified. */
export const toAssetClassCode = (code: string | null | undefined): AssetClassCode =>
  code && KNOWN.has(code) ? (code as AssetClassCode) : UNKNOWN_ASSET_CLASS;

/** The code of a camelCase body (`assetClassCode`), closed to the vocabulary. */
export const assetClassCodeOf = (entry: { assetClassCode?: string | null }): AssetClassCode =>
  toAssetClassCode(entry.assetClassCode);

/** A class as a group of assets ("Bonds"). */
export const assetClassLabel = (code: AssetClassCode): string => PLURAL_LABELS[code];

/** A class as one asset's ("Bond"). */
export const assetClassSingularLabel = (code: AssetClassCode): string => SINGULAR_LABELS[code];
