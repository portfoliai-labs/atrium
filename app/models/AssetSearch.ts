// models/AssetSearch.ts
// Matches the items of GET /v1/asset-search: securities the backend can price, at most 10 per
// search. One ISIN can come back several times, once per listing (market + currency).

interface AssetSearchResult {
  // The identifier to send wherever a security is picked (e.g. a strategy's asset target),
  // together with the isin when there is one.
  ticker: string;
  isin: string | null;
  // ISO 10383 market code; null for listings without one (e.g. a crypto pair).
  exchangeMic: string | null;
  currency: string;
  // The same name the app shows everywhere else for this security.
  name: string;
  assetClass: string | null;
}

// Short names for the markets most listings come from; any other MIC is shown as is.
const EXCHANGE_NAMES: Record<string, string> = {
  XETR: "Xetra",
  XFRA: "Frankfurt",
  XMIL: "Borsa Italiana",
  ETFP: "Borsa Italiana ETFplus",
  XAMS: "Euronext Amsterdam",
  XPAR: "Euronext Paris",
  XBRU: "Euronext Brussels",
  XLIS: "Euronext Lisbon",
  XMAD: "Madrid",
  XSWX: "SIX Swiss",
  XLON: "London",
  XNAS: "Nasdaq",
  XNYS: "NYSE",
  ARCX: "NYSE Arca",
  XTSE: "Toronto",
  XTKS: "Tokyo",
  XHKG: "Hong Kong",
};

/** "Xetra (XETR)" for a known market, the bare MIC otherwise, null without one. */
function exchangeLabel(mic: string | null): string | null {
  if (!mic) return null;
  const name = EXCHANGE_NAMES[mic];
  return name ? `${name} (${mic})` : mic;
}

export type { AssetSearchResult };
export { exchangeLabel };
