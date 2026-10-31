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

// The legacy strings (`assetClass` / `asset_class`, the metadata provider's quoteType) that
// differ from their code; any other known string is its own code. Goes with step 3 of the
// InstrumentType migration, when ianus stops serving the legacy fields: until then a response
// from an older ianus, without the code, still reads right.
const LEGACY_CODES: Record<string, AssetClassCode> = {
  MUTUALFUND: "MUTUAL_FUND",
  CRYPTOCURRENCY: "CRYPTO",
  MONEYMARKET: "MONEY_MARKET",
  CASH: "CASH",
  UNKNOWN: "UNKNOWN",
};

/** A served code, closed to the vocabulary: anything else is unclassified. */
export const toAssetClassCode = (code: string | null | undefined): AssetClassCode =>
  code && KNOWN.has(code) ? (code as AssetClassCode) : UNKNOWN_ASSET_CLASS;

/**
 * The code of a camelCase body (`assetClassCode`), or — from an older ianus without it — the one
 * its legacy `assetClass` string stands for (fallback goes with step 3).
 */
export function assetClassCodeOf(entry: { assetClassCode?: string | null; assetClass?: string | null }): AssetClassCode {
  if (entry.assetClassCode) return toAssetClassCode(entry.assetClassCode);
  return fromLegacy(entry.assetClass);
}

function fromLegacy(legacy: string | null | undefined): AssetClassCode {
  if (!legacy) return UNKNOWN_ASSET_CLASS;
  const upper = legacy.toUpperCase();
  return LEGACY_CODES[upper] ?? toAssetClassCode(upper);
}

/** A class as a group of assets ("Bonds"). */
export const assetClassLabel = (code: AssetClassCode): string => PLURAL_LABELS[code];

/** A class as one asset's ("Bond"). */
export const assetClassSingularLabel = (code: AssetClassCode): string => SINGULAR_LABELS[code];
