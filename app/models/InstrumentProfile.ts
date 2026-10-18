// models/InstrumentProfile.ts
// Matches the `profile` of GET /v1/assets/{listingId}: census' profile of the listing's
// instrument, field by field, each value from its most trusted source. A field is null when no
// source gives it; `sources` has an entry for each field set, by its name as here (terPct,
// distribution, ..., index).
import type { StrategyCategory } from "./Strategy";

// issuer_kid: the issuer's key information document (PRIIPs); index_methodology: the index
// provider's rules; esma_firds: ESMA's FIRDS, whose reuse is authorised with the source
// acknowledged; isin: the fund's ISIN (its domicile); price_provider: the market-data provider;
// registry: a crypto asset is one; users_votes: the users' consensus on the category; sec_filing:
// a company's annual report on the SEC's EDGAR (a 10-K, a foreign company's 20-F), to be cited;
// wikipedia: a company's English Wikipedia article (its revision linked), CC BY-SA 4.0, to be
// attributed with its licence; curation: a curator's decision, above every source. "unknown" for
// one this page doesn't know yet.
type ProfileSource =
  | "issuer_kid" | "index_methodology" | "esma_firds" | "isin" | "price_provider" | "registry" | "users_votes"
  | "sec_filing" | "wikipedia" | "curation" | "unknown";

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
// A company's GICS sector (11) and industry (74, the 2023 structure).
type Sector =
  | "energy" | "materials" | "industrials" | "consumer_discretionary" | "consumer_staples" | "health_care"
  | "financials" | "information_technology" | "communication_services" | "utilities" | "real_estate";
type Industry =
  | "energy_equipment_services" | "oil_gas_consumable_fuels" | "chemicals" | "construction_materials"
  | "containers_packaging" | "metals_mining" | "paper_forest_products" | "aerospace_defense"
  | "building_products" | "construction_engineering" | "electrical_equipment" | "industrial_conglomerates"
  | "machinery" | "trading_companies_distributors" | "commercial_services_supplies"
  | "professional_services" | "air_freight_logistics" | "passenger_airlines" | "marine_transportation"
  | "ground_transportation" | "transportation_infrastructure" | "automobile_components" | "automobiles"
  | "household_durables" | "leisure_products" | "textiles_apparel_luxury_goods"
  | "hotels_restaurants_leisure" | "diversified_consumer_services" | "distributors" | "broadline_retail"
  | "specialty_retail" | "consumer_staples_distribution_retail" | "beverages" | "food_products" | "tobacco"
  | "household_products" | "personal_care_products" | "health_care_equipment_supplies"
  | "health_care_providers_services" | "health_care_technology" | "biotechnology" | "pharmaceuticals"
  | "life_sciences_tools_services" | "banks" | "financial_services" | "consumer_finance" | "capital_markets"
  | "mortgage_real_estate_investment_trusts_reits" | "insurance" | "it_services" | "software"
  | "communications_equipment" | "technology_hardware_storage_peripherals"
  | "electronic_equipment_instruments_components" | "semiconductors_semiconductor_equipment"
  | "diversified_telecommunication_services" | "wireless_telecommunication_services" | "media"
  | "entertainment" | "interactive_media_services" | "electric_utilities" | "gas_utilities"
  | "multi_utilities" | "water_utilities" | "independent_power_and_renewable_electricity_producers"
  | "diversified_reits" | "industrial_reits" | "hotel_resort_reits" | "office_reits" | "health_care_reits"
  | "residential_reits" | "retail_reits" | "specialized_reits" | "real_estate_management_development";

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
  // A company's (a share's): its GICS sector and industry, its head office (ISO 3166-1 alpha-2,
  // and the city), its full-time employees, its website.
  sector: Sector | null;
  industry: Industry | null;
  headquarters: string | null;
  headquartersCity: string | null;
  employees: number | null;
  website: string | null;
  // A company's: what it does, in English. A paragraph an AI model summarised from its latest
  // annual report filed with the SEC (sources.description: sec_filing, the report linked), else its
  // Wikipedia article's lead as written, paragraphs separated by blank lines (wikipedia).
  description: string | null;
  sources: Partial<Record<
    | "category" | "terPct" | "distribution" | "assetClass" | "domicile" | "replication" | "currencyHedged" | "riskIndicator" | "index"
    | "sector" | "industry" | "headquarters" | "headquartersCity" | "employees" | "website" | "description",
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
  sec_filing: "Annual report (SEC)",
  wikipedia: "Wikipedia",
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
const SECTOR_LABELS: Record<Sector, string> = {
  energy: "Energy",
  materials: "Materials",
  industrials: "Industrials",
  consumer_discretionary: "Consumer Discretionary",
  consumer_staples: "Consumer Staples",
  health_care: "Health Care",
  financials: "Financials",
  information_technology: "Information Technology",
  communication_services: "Communication Services",
  utilities: "Utilities",
  real_estate: "Real Estate",
};
const INDUSTRY_LABELS: Record<Industry, string> = {
  energy_equipment_services: "Energy Equipment & Services",
  oil_gas_consumable_fuels: "Oil, Gas & Consumable Fuels",
  chemicals: "Chemicals",
  construction_materials: "Construction Materials",
  containers_packaging: "Containers & Packaging",
  metals_mining: "Metals & Mining",
  paper_forest_products: "Paper & Forest Products",
  aerospace_defense: "Aerospace & Defense",
  building_products: "Building Products",
  construction_engineering: "Construction & Engineering",
  electrical_equipment: "Electrical Equipment",
  industrial_conglomerates: "Industrial Conglomerates",
  machinery: "Machinery",
  trading_companies_distributors: "Trading Companies & Distributors",
  commercial_services_supplies: "Commercial Services & Supplies",
  professional_services: "Professional Services",
  air_freight_logistics: "Air Freight & Logistics",
  passenger_airlines: "Passenger Airlines",
  marine_transportation: "Marine Transportation",
  ground_transportation: "Ground Transportation",
  transportation_infrastructure: "Transportation Infrastructure",
  automobile_components: "Automobile Components",
  automobiles: "Automobiles",
  household_durables: "Household Durables",
  leisure_products: "Leisure Products",
  textiles_apparel_luxury_goods: "Textiles, Apparel & Luxury Goods",
  hotels_restaurants_leisure: "Hotels, Restaurants & Leisure",
  diversified_consumer_services: "Diversified Consumer Services",
  distributors: "Distributors",
  broadline_retail: "Broadline Retail",
  specialty_retail: "Specialty Retail",
  consumer_staples_distribution_retail: "Consumer Staples Distribution & Retail",
  beverages: "Beverages",
  food_products: "Food Products",
  tobacco: "Tobacco",
  household_products: "Household Products",
  personal_care_products: "Personal Care Products",
  health_care_equipment_supplies: "Health Care Equipment & Supplies",
  health_care_providers_services: "Health Care Providers & Services",
  health_care_technology: "Health Care Technology",
  biotechnology: "Biotechnology",
  pharmaceuticals: "Pharmaceuticals",
  life_sciences_tools_services: "Life Sciences Tools & Services",
  banks: "Banks",
  financial_services: "Financial Services",
  consumer_finance: "Consumer Finance",
  capital_markets: "Capital Markets",
  mortgage_real_estate_investment_trusts_reits: "Mortgage Real Estate Investment Trusts (REITs)",
  insurance: "Insurance",
  it_services: "IT Services",
  software: "Software",
  communications_equipment: "Communications Equipment",
  technology_hardware_storage_peripherals: "Technology Hardware, Storage & Peripherals",
  electronic_equipment_instruments_components: "Electronic Equipment, Instruments & Components",
  semiconductors_semiconductor_equipment: "Semiconductors & Semiconductor Equipment",
  diversified_telecommunication_services: "Diversified Telecommunication Services",
  wireless_telecommunication_services: "Wireless Telecommunication Services",
  media: "Media",
  entertainment: "Entertainment",
  interactive_media_services: "Interactive Media & Services",
  electric_utilities: "Electric Utilities",
  gas_utilities: "Gas Utilities",
  multi_utilities: "Multi-Utilities",
  water_utilities: "Water Utilities",
  independent_power_and_renewable_electricity_producers: "Independent Power and Renewable Electricity Producers",
  diversified_reits: "Diversified REITs",
  industrial_reits: "Industrial REITs",
  hotel_resort_reits: "Hotel & Resort REITs",
  office_reits: "Office REITs",
  health_care_reits: "Health Care REITs",
  residential_reits: "Residential REITs",
  retail_reits: "Retail REITs",
  specialized_reits: "Specialized REITs",
  real_estate_management_development: "Real Estate Management & Development",
};

/** A label from `labels`, or the value as the API wrote it for one this page doesn't know yet. */
function labelOf<T extends string>(labels: Record<T, string>, value: T): string {
  return labels[value] ?? value.replaceAll("_", " ");
}

export type {
  InstrumentProfile, IndexProfile, ProfileSource, ProfileSourceRef,
  Distribution, ProfileAssetClass, Replication, Factor, Weighting, Region, IndexSize, Rebalancing, Sector, Industry,
};
export {
  PROFILE_SOURCE_LABELS, DISTRIBUTION_LABELS, PROFILE_ASSET_CLASS_LABELS, REPLICATION_LABELS, FACTOR_LABELS,
  WEIGHTING_LABELS, REGION_LABELS, INDEX_SIZE_LABELS, REBALANCING_LABELS, SECTOR_LABELS, INDUSTRY_LABELS, labelOf,
};
