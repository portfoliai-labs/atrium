// models/InstrumentProfile.ts
// Matches the `profile` of GET /v1/assets/{listingId}: census' profile of the listing's
// instrument, field by field, each value from its most trusted source. A field is null when no
// source gives it; `sources` has an entry for each field set, by its name as here (terPct,
// distribution, ..., index).
import type { StrategyCategory } from "./Strategy";

// issuer_kid: the issuer's key information document (PRIIPs); index_methodology: the index
// provider's rules; esma_firds: ESMA's FIRDS, whose reuse is authorised with the source
// acknowledged; isin: the fund's ISIN (its domicile); price_provider: the market-data provider;
// registry: a crypto asset is one; users_votes: the users' consensus on the category; curation:
// a curator's decision, above every source. "unknown" for one this page doesn't know yet.
type ProfileSource =
  | "issuer_kid" | "index_methodology" | "esma_firds" | "isin" | "price_provider" | "registry" | "users_votes" | "curation"
  | "unknown";

interface ProfileSourceRef {
  source: ProfileSource;
  // The document it was read from (a KID, a methodology), to link it.
  url: string | null;
  // The day its source dates it (a KID's date), ISO.
  asOf: string | null;
  // 0 to 1: how far it is trusted.
  confidence: number;
  // Read from the document by an AI model: shown as such.
  ai: boolean;
  // Its sources disagree, or it is little trusted: provisional until the curation looks at it.
  inReview: boolean;
}

type Distribution = "accumulating" | "distributing" | "mixed";
type ProfileAssetClass = "equity" | "debt" | "real_estate" | "commodities" | "mixed" | "other";
// physical: physical, its document saying neither full nor sampled.
type Replication = "physical_full" | "physical_sampling" | "synthetic" | "physical";
type Factor = "value" | "momentum" | "quality" | "min_volatility" | "size" | "dividend" | "multi_factor";
type Weighting = "market_cap" | "equal" | "factor" | "fundamental" | "other";
// single_country: one country other than those named.
type Region =
  | "global" | "developed" | "emerging" | "europe" | "eurozone" | "north_america" | "united_states" | "japan"
  | "asia_pacific" | "single_country" | "other";
type IndexSize = "large" | "large_mid" | "mid" | "small" | "all_cap";
type Rebalancing = "monthly" | "quarterly" | "semi_annual" | "annual" | "other";

// The index a fund tracks, shared by the funds tracking it; `sources` by field (factors,
// weighting, region, size, rebalancing).
interface IndexProfile {
  indexId: string;
  // As the funds' documents name it (FTSE All-World).
  name: string;
  // Empty with sources.factors: an index weighted by market capitalisation alone; empty without
  // it: unknown.
  factors: Factor[];
  weighting: Weighting | null;
  region: Region | null;
  size: IndexSize | null;
  rebalancing: Rebalancing | null;
  sources: Partial<Record<"factors" | "weighting" | "region" | "size" | "rebalancing", ProfileSourceRef>>;
}

interface InstrumentProfile {
  // What it is exposed to: any instrument's, a share's or a crypto asset's too.
  category: StrategyCategory | null;
  // A fund's ongoing costs a year, in percent.
  terPct: number | null;
  distribution: Distribution | null;
  assetClass: ProfileAssetClass | null;
  // ISO 3166-1 alpha-2.
  domicile: string | null;
  replication: Replication | null;
  currencyHedged: boolean | null;
  // The KID's summary risk indicator, 1 to 7.
  riskIndicator: number | null;
  index: IndexProfile | null;
  sources: Partial<Record<
    "category" | "terPct" | "distribution" | "assetClass" | "domicile" | "replication" | "currencyHedged" | "riskIndicator" | "index",
    ProfileSourceRef
  >>;
}

const PROFILE_SOURCE_LABELS: Record<ProfileSource, string> = {
  issuer_kid: "Issuer's KID",
  index_methodology: "Index methodology",
  esma_firds: "ESMA FIRDS",
  isin: "ISIN",
  price_provider: "Market data",
  registry: "Crypto registry",
  users_votes: "Users' consensus",
  curation: "Reviewed by Atrium",
  unknown: "Other source",
};

const DISTRIBUTION_LABELS: Record<Distribution, string> = {
  accumulating: "Accumulating", distributing: "Distributing", mixed: "Mixed",
};
const PROFILE_ASSET_CLASS_LABELS: Record<ProfileAssetClass, string> = {
  equity: "Equity", debt: "Bonds", real_estate: "Real estate", commodities: "Commodities", mixed: "Mixed", other: "Other",
};
const REPLICATION_LABELS: Record<Replication, string> = {
  physical_full: "Physical, full", physical_sampling: "Physical, sampled", synthetic: "Synthetic (swap)", physical: "Physical",
};
const FACTOR_LABELS: Record<Factor, string> = {
  value: "Value", momentum: "Momentum", quality: "Quality", min_volatility: "Minimum volatility", size: "Size",
  dividend: "Dividend", multi_factor: "Multi-factor",
};
const WEIGHTING_LABELS: Record<Weighting, string> = {
  market_cap: "Market cap", equal: "Equal", factor: "By factor", fundamental: "Fundamental", other: "Other",
};
const REGION_LABELS: Record<Region, string> = {
  global: "Global", developed: "Developed markets", emerging: "Emerging markets", europe: "Europe", eurozone: "Eurozone",
  north_america: "North America", united_states: "United States", japan: "Japan", asia_pacific: "Asia Pacific",
  single_country: "Single country", other: "Other",
};
const INDEX_SIZE_LABELS: Record<IndexSize, string> = {
  large: "Large cap", large_mid: "Large & mid cap", mid: "Mid cap", small: "Small cap", all_cap: "All cap",
};
const REBALANCING_LABELS: Record<Rebalancing, string> = {
  monthly: "Monthly", quarterly: "Quarterly", semi_annual: "Twice a year", annual: "Yearly", other: "Other",
};

/** A label from `labels`, or the value as the API wrote it for one this page doesn't know yet. */
function labelOf<T extends string>(labels: Record<T, string>, value: T): string {
  return labels[value] ?? value.replaceAll("_", " ");
}

export type {
  InstrumentProfile, IndexProfile, ProfileSource, ProfileSourceRef,
  Distribution, ProfileAssetClass, Replication, Factor, Weighting, Region, IndexSize, Rebalancing,
};
export {
  PROFILE_SOURCE_LABELS, DISTRIBUTION_LABELS, PROFILE_ASSET_CLASS_LABELS, REPLICATION_LABELS, FACTOR_LABELS,
  WEIGHTING_LABELS, REGION_LABELS, INDEX_SIZE_LABELS, REBALANCING_LABELS, labelOf,
};
