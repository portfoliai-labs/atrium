// lib/rates.ts
// Which market rates (see models/Rates) go with a bond or a mortgage, and how they read.
import type { RateIndex } from "../models/RealEstate";
import type { BenchmarkCode, YieldHistory } from "../models/Rates";

// The holdings' assetClass of a single bond (a bond fund is an ETF or a MUTUALFUND, and isn't one).
export const isBondClass = (assetClass: string) => assetClass.toUpperCase() === "BOND";

// The curve a corporate bond is read against: its currency's. EUR → the euro area's AAA curve; a
// currency of one country → that country's.
const CURRENCY_AREA: Record<string, string> = {
  EUR: "XM", USD: "US", GBP: "GB", JPY: "JP",
  CHF: "CH", CAD: "CA", AUD: "AU", NZD: "NZ", NOK: "NO", KRW: "KR", MXN: "MX", ZAR: "ZA", ILS: "IL", CLP: "CL",
  SEK: "SE", DKK: "DK", PLN: "PL", CZK: "CZ", HUF: "HU", RON: "RO", BGN: "BG",
};

/** The area of a currency's curve: EUR → XM, USD → US… null for one without a curve. */
export const currencyArea = (currency: string) => CURRENCY_AREA[currency.toUpperCase()] ?? null;

// The areas with a full daily curve; every other one is a single 10-year point, a monthly average.
const DAILY_CURVE_AREAS = new Set(["US", "XM", "DE", "GB", "JP"]);
export const hasDailyCurve = (area: string) => DAILY_CURVE_AREAS.has(area);

const EURO_AREA = new Set(["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"]);

// What a government bond's name tends to say. The holdings carry no issuer type, so this is a guess:
// the module lets the user switch to the other curve when it's wrong.
const GOVERNMENT_NAME = /\b(BTP|BOT|CCT|CTZ|BUONI|TESORO|REPUBBLICA|REPUBLIC|REPUBLIQUE|KINGDOM|TREASURY|T-BILL|T-NOTE|T-BOND|GILT|BUND|BUNDESREP|BUNDESANLEIHE|BUNDESOBLIGATION|OAT|BONOS|OBLIGACIONES|ESTADO|STAAT|GOVERNMENT|GOVT|SOVEREIGN|JGB)\b/i;

/**
 * The curves to read a bond against, the likelier first: a government bond's by its ISIN's country
 * (IT0005… → IT), a corporate's by its currency (EUR → XM). The other one second, when there is one
 * and it differs, for the user to switch to.
 */
export function bondCurveAreas(bond: { isin: string | null; name: string; currency: string }): string[] {
  const country = bond.isin && /^[A-Z]{2}/.test(bond.isin) && !["XS", "EU", "XC"].includes(bond.isin.slice(0, 2)) ? bond.isin.slice(0, 2) : null;
  const byCurrency = currencyArea(bond.currency);
  const government = country !== null && GOVERNMENT_NAME.test(bond.name);
  const areas = government ? [country, byCurrency] : [byCurrency, country];
  return [...new Set(areas.filter((a): a is string => a !== null))];
}

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

/** "IT" → "Italy", "XM" → "Euro area (AAA)". */
export function areaLabel(area: string) {
  if (area === "XM") return "Euro area (AAA)";
  try {
    return regionNames?.of(area) ?? area;
  } catch {
    return area;
  }
}

/** 3 → "3M", 120 → "10Y", 18 → "18M". */
export const tenorLabel = (months: number) => (months % 12 === 0 ? `${months / 12}Y` : `${months}M`);

/** A rate in percent: "3.21%". */
export const ratePct = (v: number) => `${v.toFixed(2)}%`;

/** Whether an area's yields are read as a spread over the Bund: a euro area country but Germany. */
export const hasBundSpread = (area: string) => area !== "DE" && EURO_AREA.has(area);

/**
 * The 10-year spread of a euro area country over the Bund, in basis points: its yield against
 * Germany's on the same month. The country's yields are monthly averages while Germany's are daily,
 * so it's its last month against the average of Germany's days in that month. null for Germany
 * itself, outside the euro area, or without both.
 */
export function bundSpread(area: string, histories: YieldHistory[]): { bp: number; month: string } | null {
  if (!hasBundSpread(area)) return null;
  const own = histories.find((h) => h.area === area)?.yields;
  const de = histories.find((h) => h.area === "DE")?.yields;
  if (!own?.dates.length || !de?.dates.length) return null;
  // The last month both have.
  for (let i = own.dates.length - 1; i >= 0; i--) {
    const month = own.dates[i].slice(0, 7);
    const days = de.values.filter((_, j) => de.dates[j].startsWith(month));
    if (days.length === 0) continue;
    const bund = days.reduce((s, v) => s + v, 0) / days.length;
    return { bp: Math.round((own.values[i] - bund) * 100), month };
  }
  return null;
}

/** "2026-09" → "September 2026". */
export function longMonthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** The benchmark a variable mortgage's index can be read against: only SOFR is served (Euribor needs an EMMI licence). */
export function mortgageBenchmark(index: RateIndex): BenchmarkCode | null {
  return index === "sofr" ? "SOFR" : null;
}

export const isEuribor = (index: RateIndex) => index.startsWith("euribor");
