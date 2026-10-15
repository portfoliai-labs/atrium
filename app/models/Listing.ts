// models/Listing.ts
// Matches the items of GET /v1/listings: census' listings, at most 10 per search. A listing is
// where an instrument trades (a country's line, a market, or a crypto asset quoted in a
// currency); one ISIN can come back several times, once per listing.

interface Listing {
  // What a transaction, a strategy's asset, an article and the asset page name it by.
  listingId: string;
  // Shared by the instrument's listings.
  instrumentId: string;
  kind: "security" | "crypto";
  // The listing's own (VWCE, BTC), not a market-data provider's.
  ticker: string;
  name: string;
  isin: string | null;
  // Null for a crypto asset, as exchangeMic.
  country: string | null;
  // ISO 10383 market code.
  exchangeMic: string | null;
  exchangeName: string | null;
  // Presumed from the market until a price provider confirmed it (currencyConfirmed).
  currency: string;
  currencyConfirmed: boolean;
  // Whether a provider prices it; null until someone picked it.
  priced: boolean | null;
}

// A security as something that names one gives it back (a saved transaction: its ticker, name
// and ISIN, and its listingId unless it was recorded by a market-data ticker), the rest only when
// it came from the search.
type ListingRef = Pick<Listing, "ticker" | "name" | "isin"> & Partial<Omit<Listing, "ticker" | "name" | "isin">>;

// Short names for the markets most listings come from; any other MIC is shown as is. For what
// names a market by its MIC alone (a strategy's saved targets).
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
function exchangeLabel(mic: string | null, name: string | null = null): string | null {
  if (!mic) return name;
  const known = name ?? EXCHANGE_NAMES[mic];
  return known ? `${known} (${mic})` : mic;
}

/** "VWCE · Xetra (XETR) · EUR", "BTC · EUR · Crypto": what tells apart the listings of one ISIN. */
function listingLine(listing: ListingRef): string {
  return [
    listing.ticker,
    exchangeLabel(listing.exchangeMic ?? null, listing.exchangeName ?? null),
    listing.currency,
    listing.kind === "crypto" ? "Crypto" : null,
  ].filter(Boolean).join(" · ");
}

export type { Listing, ListingRef };
export { exchangeLabel, listingLine };
