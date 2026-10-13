// lib/mock/realEstate.ts
//
// SAMPLE DATA for a demo account's Real estate: a made-up portfolio of four Italian properties, the
// market of the neighbourhoods they sit in, and what each would earn as a short-term rental. The
// properties, their transactions, mortgages and valuations are also served in the API's shapes
// (models/RealEstate) by demoRealEstateSource, as the API would; the market and short-stay figures
// are what the API doesn't have yet, shown as previews (components/preview/RealEstatePortfolio).
// None of it comes from the backend or a market source.

import { hashSeed, normal, round, seeded } from "./random";
import { TRANSACTION_KIND_LABELS, type RealEstateSource } from "../realEstate";
import type {
  ItalianDetails, Mortgage, MortgageSchedule, Municipality, Property as ApiProperty, PropertyTax, PropertyTransaction, SaleSimulationRequest,
  PropertyTransactionFilters, PropertyUse, RealEstateMonth, RealEstateOverview, RealEstateSummary, RentalContract, TaxInstalment,
  TaxList, TaxPeriod, TaxpayerYear, UsePeriod, Valuation, RealEstateAlertFinding, RealEstateAlertParams, RealEstateAlertRule,
  Instalment, ScheduleOutlook, MarketQuotation, MarketTrend, MarketZone, PropertyMarket, PrepaymentSimulationRequest, RefinancingSimulationRequest, PrepaymentSimulation, RefinancingSimulation,
} from "../../models/RealEstate";

export type PropertyType = "Apartment" | "House" | "Commercial" | "Garage" | "Land";
export type PropertyUsage = "Long-term rental" | "Short-term rental" | "Primary residence" | "Vacant";

export interface Zone {
  id: string;
  name: string;
  city: string;
  pricePerSqm2019: number;
  annualGrowth: number; // average yearly price change since 2019, as a fraction
  rentPerSqm: number; // monthly long-term rent, per m²
  vacancyPct: number;
  daysOnMarket: number;
  stListings: number; // short-term listings in the neighbourhood
  stOccupancyPct: number;
  stAdr: number; // short-term average daily rate
}

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  address: string;
  city: string;
  zoneId: string;
  sqm: number;
  rooms: number;
  yearBuilt: number;
  energyClass: string;
  purchaseDate: string;
  purchasePrice: number;
  purchaseCosts: number; // notary, agency, registration tax
  mortgage: { principal: number; ratePct: number; years: number } | null;
  usage: PropertyUsage;
  monthlyRent: number; // long-term rent actually collected (0 when not rented that way)
  monthlyCondo: number;
  yearlyPropertyTax: number;
}

export const ZONES: Zone[] = [
  { id: "mi-navigli", name: "Navigli", city: "Milan", pricePerSqm2019: 4550, annualGrowth: 0.042, rentPerSqm: 22.5, vacancyPct: 2.1, daysOnMarket: 48, stListings: 1840, stOccupancyPct: 78, stAdr: 142 },
  { id: "mi-porta-romana", name: "Porta Romana", city: "Milan", pricePerSqm2019: 5200, annualGrowth: 0.051, rentPerSqm: 24.1, vacancyPct: 1.8, daysOnMarket: 41, stListings: 1210, stOccupancyPct: 74, stAdr: 155 },
  { id: "mi-isola", name: "Isola", city: "Milan", pricePerSqm2019: 5600, annualGrowth: 0.047, rentPerSqm: 25.3, vacancyPct: 2.4, daysOnMarket: 52, stListings: 990, stOccupancyPct: 76, stAdr: 160 },
  { id: "mi-citta-studi", name: "Città Studi", city: "Milan", pricePerSqm2019: 3900, annualGrowth: 0.033, rentPerSqm: 20.2, vacancyPct: 1.5, daysOnMarket: 44, stListings: 620, stOccupancyPct: 69, stAdr: 108 },
  { id: "mi-lorenteggio", name: "Lorenteggio", city: "Milan", pricePerSqm2019: 2900, annualGrowth: 0.028, rentPerSqm: 16.8, vacancyPct: 3.2, daysOnMarket: 71, stListings: 310, stOccupancyPct: 58, stAdr: 86 },

  { id: "bo-santo-stefano", name: "Santo Stefano", city: "Bologna", pricePerSqm2019: 3650, annualGrowth: 0.039, rentPerSqm: 16.9, vacancyPct: 1.2, daysOnMarket: 39, stListings: 1120, stOccupancyPct: 79, stAdr: 98 },
  { id: "bo-bolognina", name: "Bolognina", city: "Bologna", pricePerSqm2019: 2450, annualGrowth: 0.035, rentPerSqm: 13.4, vacancyPct: 2.0, daysOnMarket: 55, stListings: 480, stOccupancyPct: 66, stAdr: 82 },
  { id: "bo-saragozza", name: "Saragozza", city: "Bologna", pricePerSqm2019: 3400, annualGrowth: 0.031, rentPerSqm: 15.8, vacancyPct: 1.4, daysOnMarket: 47, stListings: 540, stOccupancyPct: 72, stAdr: 104 },
  { id: "bo-san-donato", name: "San Donato", city: "Bologna", pricePerSqm2019: 2250, annualGrowth: 0.029, rentPerSqm: 12.6, vacancyPct: 2.6, daysOnMarket: 63, stListings: 190, stOccupancyPct: 57, stAdr: 71 },

  { id: "to-san-salvario", name: "San Salvario", city: "Turin", pricePerSqm2019: 2050, annualGrowth: 0.026, rentPerSqm: 10.9, vacancyPct: 3.1, daysOnMarket: 74, stListings: 640, stOccupancyPct: 64, stAdr: 79 },
  { id: "to-crocetta", name: "Crocetta", city: "Turin", pricePerSqm2019: 2650, annualGrowth: 0.021, rentPerSqm: 11.6, vacancyPct: 2.5, daysOnMarket: 68, stListings: 210, stOccupancyPct: 59, stAdr: 88 },
  { id: "to-vanchiglia", name: "Vanchiglia", city: "Turin", pricePerSqm2019: 2250, annualGrowth: 0.032, rentPerSqm: 11.2, vacancyPct: 2.8, daysOnMarket: 66, stListings: 380, stOccupancyPct: 63, stAdr: 81 },
  { id: "to-barriera", name: "Barriera di Milano", city: "Turin", pricePerSqm2019: 1150, annualGrowth: 0.009, rentPerSqm: 7.4, vacancyPct: 5.6, daysOnMarket: 112, stListings: 90, stOccupancyPct: 44, stAdr: 52 },

  { id: "rm-prati", name: "Prati", city: "Rome", pricePerSqm2019: 5900, annualGrowth: 0.018, rentPerSqm: 21.4, vacancyPct: 1.9, daysOnMarket: 58, stListings: 2150, stOccupancyPct: 79, stAdr: 168 },
  { id: "rm-trastevere", name: "Trastevere", city: "Rome", pricePerSqm2019: 6200, annualGrowth: 0.022, rentPerSqm: 23.0, vacancyPct: 1.4, daysOnMarket: 49, stListings: 3120, stOccupancyPct: 84, stAdr: 182 },
  { id: "rm-monteverde", name: "Monteverde", city: "Rome", pricePerSqm2019: 4100, annualGrowth: 0.012, rentPerSqm: 15.9, vacancyPct: 2.3, daysOnMarket: 77, stListings: 540, stOccupancyPct: 65, stAdr: 104 },
  { id: "rm-pigneto", name: "Pigneto", city: "Rome", pricePerSqm2019: 3300, annualGrowth: 0.027, rentPerSqm: 14.2, vacancyPct: 2.7, daysOnMarket: 69, stListings: 720, stOccupancyPct: 68, stAdr: 91 },
];

export const PROPERTIES: Property[] = [
  {
    id: "navigli", name: "Navigli loft", type: "Apartment", address: "Via Vigevano 18", city: "Milan", zoneId: "mi-navigli",
    sqm: 68, rooms: 3, yearBuilt: 1962, energyClass: "D", purchaseDate: "2019-06-14", purchasePrice: 305000, purchaseCosts: 24400,
    mortgage: { principal: 220000, ratePct: 1.6, years: 25 }, usage: "Long-term rental", monthlyRent: 1480, monthlyCondo: 185, yearlyPropertyTax: 1650,
  },
  {
    id: "santo-stefano", name: "Santo Stefano studio", type: "Apartment", address: "Strada Maggiore 41", city: "Bologna", zoneId: "bo-santo-stefano",
    sqm: 52, rooms: 2, yearBuilt: 1930, energyClass: "E", purchaseDate: "2021-03-22", purchasePrice: 196000, purchaseCosts: 17900,
    mortgage: { principal: 120000, ratePct: 1.2, years: 20 }, usage: "Short-term rental", monthlyRent: 0, monthlyCondo: 120, yearlyPropertyTax: 1180,
  },
  {
    id: "san-salvario", name: "San Salvario two-bed", type: "Apartment", address: "Via Nizza 102", city: "Turin", zoneId: "to-san-salvario",
    sqm: 84, rooms: 4, yearBuilt: 1958, energyClass: "F", purchaseDate: "2022-09-05", purchasePrice: 178000, purchaseCosts: 14200,
    mortgage: { principal: 140000, ratePct: 3.4, years: 25 }, usage: "Long-term rental", monthlyRent: 860, monthlyCondo: 140, yearlyPropertyTax: 980,
  },
  {
    id: "prati-garage", name: "Prati garage", type: "Garage", address: "Via Cola di Rienzo 212", city: "Rome", zoneId: "rm-prati",
    sqm: 16, rooms: 0, yearBuilt: 1975, energyClass: "—", purchaseDate: "2020-11-10", purchasePrice: 48000, purchaseCosts: 3900,
    mortgage: null, usage: "Long-term rental", monthlyRent: 190, monthlyCondo: 25, yearlyPropertyTax: 210,
  },
];

export const zoneById = (id: string) => ZONES.find((z) => z.id === id)!;

// ── Market series ──────────────────────────────────────────────────────────────────────────

// Quarterly, from Q1 2019 to the current quarter (Q3 2026).
export const QUARTERS: string[] = (() => {
  const out: string[] = [];
  for (let y = 2019; y <= 2026; y++) for (let q = 1; q <= 4; q++) if (y < 2026 || q <= 3) out.push(`${y} Q${q}`);
  return out;
})();

const quarterIndexOf = (isoDate: string) => {
  const [y, m] = isoDate.split("-").map(Number);
  return (y - 2019) * 4 + Math.floor((m - 1) / 3);
};

const zoneSeriesCache = new Map<string, number[]>();

/** Asking price per m² in the zone, one value per QUARTERS entry. */
export function zonePriceSeries(zone: Zone): number[] {
  const cached = zoneSeriesCache.get(zone.id);
  if (cached) return cached;
  const rand = seeded(hashSeed(zone.id));
  let drift = 0;
  const series = QUARTERS.map((_, i) => {
    drift = drift * 0.6 + normal(rand) * 0.012;
    // 2020's lockdown dip, then the 2021–22 rebound, on top of the zone's own trend.
    const covid = i >= 5 && i <= 7 ? -0.025 : 0;
    return round(zone.pricePerSqm2019 * (1 + zone.annualGrowth) ** (i / 4) * (1 + drift + covid));
  });
  zoneSeriesCache.set(zone.id, series);
  return series;
}

/** The zone's series next to its city's average, for the market-trend chart. */
export function zoneMarketTrend(zone: Zone) {
  const cityZones = ZONES.filter((z) => z.city === zone.city);
  const series = zonePriceSeries(zone);
  const citySeries = cityZones.map(zonePriceSeries);
  return QUARTERS.map((quarter, i) => ({
    quarter,
    zone: series[i],
    city: round(citySeries.reduce((sum, s) => sum + s[i], 0) / citySeries.length),
  }));
}

export const zoneNow = (zone: Zone) => zonePriceSeries(zone).at(-1)!;
export const zoneYoY = (zone: Zone) => {
  const s = zonePriceSeries(zone);
  return (s.at(-1)! / s.at(-5)! - 1) * 100;
};
export const zoneGrossYield = (zone: Zone) => ((zone.rentPerSqm * 12) / zoneNow(zone)) * 100;

// ── Property figures ───────────────────────────────────────────────────────────────────────

/** Estimated value each quarter since purchase, following its zone's price index. */
export function propertyValueAt(p: Property, quarterIndex: number): number | null {
  const start = quarterIndexOf(p.purchaseDate);
  if (quarterIndex < start) return null;
  const s = zonePriceSeries(zoneById(p.zoneId));
  return round((p.purchasePrice * s[quarterIndex]) / s[start], -2);
}

export const propertyValue = (p: Property) => propertyValueAt(p, QUARTERS.length - 1)!;

function monthsSince(isoDate: string) {
  const [y, m] = isoDate.split("-").map(Number);
  return (2026 - y) * 12 + (9 - m);
}

export function mortgagePayment(p: Property) {
  if (!p.mortgage) return 0;
  const r = p.mortgage.ratePct / 100 / 12;
  const n = p.mortgage.years * 12;
  return (p.mortgage.principal * r) / (1 - (1 + r) ** -n);
}

export function mortgageBalance(p: Property) {
  if (!p.mortgage) return 0;
  const r = p.mortgage.ratePct / 100 / 12;
  const k = Math.min(monthsSince(p.purchaseDate), p.mortgage.years * 12);
  const pay = mortgagePayment(p);
  return Math.max(0, p.mortgage.principal * (1 + r) ** k - (pay * ((1 + r) ** k - 1)) / r);
}

// ── Short-term rental (Airbnb-style) analysis ──────────────────────────────────────────────

// How each city's rules and calendar weigh on short stays (0–100, higher is better).
const CITY_REGULATION: Record<string, { score: number; note: string }> = {
  Milan: { score: 68, note: "CIN code required, no night cap" },
  Bologna: { score: 42, note: "New licences restricted in the historic centre" },
  Turin: { score: 80, note: "CIN code required, light local rules" },
  Rome: { score: 55, note: "Tourist tax €6/night, centre under review" },
};
// Share of a year's nights booked, month by month, relative to the average.
const CITY_SEASONALITY: Record<string, number[]> = {
  Milan: [0.8, 0.95, 1.05, 1.1, 1.05, 1.1, 0.95, 0.7, 1.2, 1.15, 1.0, 0.95],
  Bologna: [0.75, 0.9, 1.0, 1.1, 1.15, 1.05, 0.9, 0.8, 1.1, 1.2, 1.05, 0.95],
  Turin: [0.7, 0.85, 0.95, 1.05, 1.15, 1.05, 0.95, 0.8, 1.1, 1.2, 1.1, 1.05],
  Rome: [0.7, 0.8, 1.0, 1.2, 1.25, 1.2, 1.1, 1.0, 1.15, 1.1, 0.8, 0.75],
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface ShortTermAnalysis {
  eligible: boolean;
  score: number;
  verdict: string;
  factors: { label: string; score: number; note: string }[];
  adr: number;
  occupancyPct: number;
  grossYearly: number;
  netYearly: number; // after platform fees, cleaning/management, utilities and 26% tax
  longTermNetYearly: number; // after 5% vacancy and 21% flat tax (cedolare secca)
  monthly: { month: string; occupancyPct: number; revenue: number }[];
  breakEvenOccupancyPct: number;
}

export function shortTermAnalysis(p: Property): ShortTermAnalysis {
  const zone = zoneById(p.zoneId);
  const reg = CITY_REGULATION[p.city];
  const season = CITY_SEASONALITY[p.city];
  const eligible = p.type === "Apartment" || p.type === "House";

  // Bigger flats host more guests: +6% on the zone's rate per room past the second.
  const adr = round(zone.stAdr * (1 + Math.max(0, p.rooms - 2) * 0.06));
  const occupancyPct = zone.stOccupancyPct;
  const grossYearly = adr * 365 * (occupancyPct / 100);
  const variableCosts = grossYearly * (0.15 + 0.2); // platform fee + cleaning & management
  const utilities = 2600;
  const netYearly = (grossYearly - variableCosts - utilities) * (1 - 0.26);
  const marketRent = p.monthlyRent || zone.rentPerSqm * p.sqm;
  const longTermNetYearly = marketRent * 12 * 0.95 * (1 - 0.21);
  // Occupancy at which a short stay nets as much as a long-term lease.
  const perNight = adr * (1 - 0.35) * (1 - 0.26);
  const breakEvenOccupancyPct = ((longTermNetYearly + utilities * (1 - 0.26)) / (perNight * 365)) * 100;

  const premium = netYearly / longTermNetYearly;
  const listingsPerK = zone.stListings / 100;
  const factors = [
    { label: "Demand", score: Math.min(100, round((occupancyPct / 85) * 100)), note: `${occupancyPct}% average occupancy in ${zone.name}` },
    { label: "Income vs long-term", score: Math.max(0, Math.min(100, round((premium - 0.8) * 110))), note: `${premium.toFixed(2)}× the net of a long-term lease` },
    { label: "Regulation", score: reg.score, note: reg.note },
    { label: "Seasonality", score: round(100 - (Math.max(...season) - Math.min(...season)) * 90), note: `Peak ${MONTHS[season.indexOf(Math.max(...season))]}, low ${MONTHS[season.indexOf(Math.min(...season))]}` },
    { label: "Competition", score: Math.max(10, round(100 - listingsPerK * 2.6)), note: `${zone.stListings.toLocaleString("en-US")} active listings nearby` },
    { label: "Property fit", score: Math.min(100, 45 + p.rooms * 9 + (["A", "B", "C", "D"].includes(p.energyClass) ? 12 : 0)), note: `${p.rooms} rooms · ${p.sqm} m² · class ${p.energyClass}` },
  ];
  const weights = [0.24, 0.24, 0.18, 0.1, 0.12, 0.12];
  const score = eligible ? round(factors.reduce((sum, f, i) => sum + f.score * weights[i], 0)) : 6;
  const verdict = !eligible
    ? "Not suited to short stays"
    : score >= 70 ? "Strong candidate" : score >= 55 ? "Worth considering" : score >= 40 ? "Marginal" : "Weak candidate";

  return {
    eligible, score, verdict, factors, adr, occupancyPct, grossYearly, netYearly, longTermNetYearly, breakEvenOccupancyPct,
    monthly: MONTHS.map((month, i) => {
      const occ = Math.min(98, occupancyPct * season[i]);
      return { month, occupancyPct: round(occ), revenue: round(adr * (occ / 100) * 30.4) };
    }),
  };
}

/** Yearly gross rent over value, for a rented property (short stays use their net estimate). */
export function propertyGrossYield(p: Property) {
  const yearly = p.usage === "Short-term rental" ? shortTermAnalysis(p).grossYearly : p.monthlyRent * 12;
  return (yearly / propertyValue(p)) * 100;
}

export const monthlyIncome = (p: Property) => (p.usage === "Short-term rental" ? shortTermAnalysis(p).grossYearly / 12 : p.monthlyRent);

// ── Portfolio-level series ─────────────────────────────────────────────────────────────────

export function portfolioValueSeries() {
  return QUARTERS.map((quarter, i) => {
    let value = 0;
    let invested = 0;
    for (const p of PROPERTIES) {
      const v = propertyValueAt(p, i);
      if (v !== null) {
        value += v;
        invested += p.purchasePrice + p.purchaseCosts;
      }
    }
    return { quarter, value, invested };
  }).filter((row) => row.value > 0);
}

/** The last 12 months of cash in and out across the portfolio. */
export function monthlyCashFlow() {
  const rand = seeded(42);
  const labels = ["Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26", "Sep 26"];
  const seasonIndex = [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8];
  return labels.map((month, i) => {
    let rent = 0;
    let costs = 0;
    for (const p of PROPERTIES) {
      if (p.usage === "Short-term rental") {
        const st = shortTermAnalysis(p);
        rent += st.monthly[seasonIndex[i]].revenue * 0.65;
      } else rent += p.monthlyRent;
      costs += mortgagePayment(p) + p.monthlyCondo;
      // Property tax (IMU) falls in June and December.
      if (seasonIndex[i] === 5 || seasonIndex[i] === 11) costs += p.yearlyPropertyTax / 2;
    }
    // The odd repair.
    if (rand() > 0.75) costs += round(250 + rand() * 900);
    return { month, income: round(rent), costs: round(costs), net: round(rent - costs) };
  });
}

export interface RealEstateTransaction {
  id: string;
  date: string;
  propertyId: string;
  kind: "Purchase" | "Purchase costs" | "Renovation" | "Furnishing" | "Rent received" | "Short-stay payout" | "Mortgage payment" | "Property tax" | "Condo fees";
  amount: number; // signed: money in positive
}

export const REAL_ESTATE_TRANSACTIONS: RealEstateTransaction[] = (() => {
  const out: RealEstateTransaction[] = [];
  let n = 0;
  const add = (date: string, propertyId: string, kind: RealEstateTransaction["kind"], amount: number) =>
    out.push({ id: `re-${n++}`, date, propertyId, kind, amount: round(amount) });

  for (const p of PROPERTIES) {
    add(p.purchaseDate, p.id, "Purchase", -p.purchasePrice);
    add(p.purchaseDate, p.id, "Purchase costs", -p.purchaseCosts);
  }
  add("2019-10-02", "navigli", "Renovation", -18400);
  add("2021-05-18", "santo-stefano", "Furnishing", -9600);
  add("2022-11-21", "san-salvario", "Renovation", -7200);

  for (const [month, day] of [["2026-07", "05"], ["2026-08", "05"], ["2026-09", "05"]]) {
    for (const p of PROPERTIES) {
      if (p.usage === "Short-term rental") add(`${month}-${day}`, p.id, "Short-stay payout", shortTermAnalysis(p).grossYearly / 12 * 0.65);
      else add(`${month}-${day}`, p.id, "Rent received", p.monthlyRent);
      if (p.mortgage) add(`${month}-01`, p.id, "Mortgage payment", -mortgagePayment(p));
      add(`${month}-10`, p.id, "Condo fees", -p.monthlyCondo);
    }
  }
  for (const p of PROPERTIES) add("2026-06-16", p.id, "Property tax", -p.yearlyPropertyTax / 2);
  return out.sort((a, b) => b.date.localeCompare(a.date));
})();

// ── Reports ─────────────────────────────────────────────────────────────────────

export interface RealEstateReport {
  id: string;
  title: string;
  detail: string;
  date: string;
  kind: "Quarterly" | "Tax" | "Valuation" | "Short-term";
}

export const REAL_ESTATE_REPORTS: RealEstateReport[] = [
  { id: "r1", title: "Q3 2026 portfolio report", detail: "Values against their zones, rents collected, mortgage balances", date: "2026-09-30", kind: "Quarterly" },
  { id: "r2", title: "Santo Stefano studio — short-stay review", detail: "Occupancy, nightly rates and payouts against the long-lease alternative", date: "2026-09-15", kind: "Short-term" },
  { id: "r3", title: "Q2 2026 portfolio report", detail: "Values against their zones, rents collected, mortgage balances", date: "2026-06-30", kind: "Quarterly" },
  { id: "r4", title: "IMU 2026 — first instalment", detail: "Property tax due per property, with the cadastral values used", date: "2026-06-10", kind: "Tax" },
  { id: "r5", title: "2025 rental income summary", detail: "Rents by property, flat tax (cedolare secca) and deductible costs, for the tax return", date: "2026-04-20", kind: "Tax" },
  { id: "r6", title: "Q1 2026 portfolio report", detail: "Values against their zones, rents collected, mortgage balances", date: "2026-03-31", kind: "Quarterly" },
  { id: "r7", title: "Annual valuation 2025", detail: "Each property's estimated value from its zone index and comparable sales", date: "2026-01-15", kind: "Valuation" },
];

// ── The same portfolio in the API's shapes (demoRealEstateSource) ───────────────────────────

// The sample's today: the wallets' sample runs to the same day (lib/mock/wallets).
const DEMO_TODAY = "2026-09-28";
const DEMO_MONTH = DEMO_TODAY.slice(0, 7);

const USE_OF: Record<PropertyUsage, PropertyUse> = {
  "Long-term rental": "long_term_rental",
  "Short-term rental": "short_term_rental",
  "Primary residence": "primary_residence",
  Vacant: "vacant",
};

const pad = (n: number) => String(n).padStart(2, "0");
/** The day `months` months after `day`, kept on the same day of the month (28th at most). */
function addMonths(day: string, months: number) {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1 + months, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(Math.min(d, 28))}`;
}
const monthEnd = (month: string) => `${month}-31`;
/** Every month from `from` to `to`, both included. */
function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  for (let month = from; month <= to; month = addMonths(`${month}-01`, 1).slice(0, 7)) out.push(month);
  return out;
}

// San Salvario's mortgage is variable (Euribor 3M + 1.1%): these are its resets after the first rate.
const RATE_RESETS: Record<string, { index: "euribor_3m"; spreadPct: number; changes: { effectiveOn: string; ratePct: number }[] }> = {
  "san-salvario": {
    index: "euribor_3m",
    spreadPct: 1.1,
    changes: [
      { effectiveOn: "2023-07-01", ratePct: 4.6 },
      { effectiveOn: "2024-07-01", ratePct: 4.8 },
      { effectiveOn: "2025-07-01", ratePct: 3.2 },
      { effectiveOn: "2026-01-01", ratePct: 3.1 },
    ],
  },
};

interface DemoMortgageDef {
  uuid: string;
  property: Property;
  firstInstalmentOn: string;
  termMonths: number;
  // Oldest first; the first is the initial rate.
  rateChanges: { effectiveOn: string; ratePct: number }[];
}

const MORTGAGE_DEFS: DemoMortgageDef[] = PROPERTIES.filter((p) => p.mortgage).map((p) => ({
  uuid: `${p.id}-mortgage`,
  property: p,
  firstInstalmentOn: addMonths(p.purchaseDate, 1),
  termMonths: p.mortgage!.years * 12,
  rateChanges: [{ effectiveOn: p.purchaseDate, ratePct: p.mortgage!.ratePct }, ...(RATE_RESETS[p.id]?.changes ?? [])],
}));

const annuity = (debt: number, ratePct: number, instalments: number) => {
  const r = ratePct / 1200;
  return r === 0 ? debt / instalments : (debt * r) / (1 - (1 + r) ** -instalments);
};

/** The French schedule, the instalment recomputed on what's owed at every rate change. */
function scheduleRows(def: DemoMortgageDef) {
  const rows: Omit<MortgageSchedule["instalments"][number], "transactionUuid">[] = [];
  let debt = def.property.mortgage!.principal;
  let rate = def.rateChanges[0].ratePct;
  let payment = annuity(debt, rate, def.termMonths);
  for (let number = 1; number <= def.termMonths; number++) {
    const dueOn = addMonths(def.firstInstalmentOn, number - 1);
    const now = def.rateChanges.filter((c) => c.effectiveOn <= dueOn).at(-1)!.ratePct;
    if (now !== rate) {
      rate = now;
      payment = annuity(debt, rate, def.termMonths - number + 1);
    }
    const interest = (debt * rate) / 1200;
    const principal = number === def.termMonths ? debt : payment - interest;
    debt = Math.max(0, debt - principal);
    rows.push({
      number, dueOn, payment: round(principal + interest, 2), principal: round(principal, 2), interest: round(interest, 2),
      residualDebt: round(debt, 2), ratePct: rate,
    });
  }
  return rows;
}

const SCHEDULES = new Map(MORTGAGE_DEFS.map((def) => [def.uuid, scheduleRows(def)]));

const LENDERS: Record<string, string> = { navigli: "Banca Esempio", "santo-stefano": "Credito Demo", "san-salvario": "Banca Esempio" };
const lenderOf = (p: Property) => LENDERS[p.id] ?? null;

// Each property's tenant (or platform), and when it was first let.
const LETTING: Record<string, { from: string; counterparty: string }> = {
  navigli: { from: "2020-01", counterparty: "G. Ferraris" },
  "santo-stefano": { from: "2021-06", counterparty: "Airbnb" },
  "san-salvario": { from: "2023-03", counterparty: "L. Conti" },
  "prati-garage": { from: "2020-12", counterparty: "M. De Santis" },
};

// The leases: Navigli's at a free rent under the cedolare; San Salvario's at an agreed rent in Turin
// (housing there is tight: the cedolare at 10%, IMU at 75%); the garage's, a commercial lease taxed
// with IRPEF.
const DEMO_LEASES: RentalContract[] = [
  { uuid: "navigli-lease", propertyUuid: "navigli", kind: "residential", startsOn: "2020-01-01", endsOn: null, monthlyRent: 1480, currency: "EUR", taxRegime: "flat_rate", highTensionMunicipality: false, tenant: "G. Ferraris", note: null, createdAt: "2019-12-20T09:00:00Z" },
  { uuid: "san-salvario-lease", propertyUuid: "san-salvario", kind: "agreed", startsOn: "2023-03-01", endsOn: "2028-02-29", monthlyRent: 860, currency: "EUR", taxRegime: "flat_rate", highTensionMunicipality: true, tenant: "L. Conti", note: "3+2, canone concordato", createdAt: "2023-02-20T09:00:00Z" },
  { uuid: "prati-garage-lease", propertyUuid: "prati-garage", kind: "commercial", startsOn: "2020-12-01", endsOn: null, monthlyRent: 190, currency: "EUR", taxRegime: "ordinary", highTensionMunicipality: false, tenant: "M. De Santis", note: null, createdAt: "2020-11-25T09:00:00Z" },
];
const AGREED = ["agreed", "transitional", "student"];
const leasesOf = (p: Property) => DEMO_LEASES.filter((l) => l.propertyUuid === p.id);
/** The lease running on a day. */
const leaseOn = (p: Property, day: string) => leasesOf(p).find((l) => l.startsOn <= day && (!l.endsOn || l.endsOn >= day));

// ── Italy's IMU, worked out as the API does (a simplified copy: no deductions) ──

// Each property's land registry entry.
const DEMO_ITALY: Record<string, ItalianDetails> = {
  navigli: { municipalityCode: "F205", cadastralSheet: "512", cadastralParcel: "88", cadastralSubunit: "14", cadastralCategory: "A/2", cadastralIncome: 1032.91, historic: false, freeLoanToRelative: false },
  "santo-stefano": { municipalityCode: "A944", cadastralSheet: "203", cadastralParcel: "41", cadastralSubunit: "7", cadastralCategory: "A/3", cadastralIncome: 640.41, historic: false, freeLoanToRelative: false },
  "san-salvario": { municipalityCode: "L219", cadastralSheet: "1287", cadastralParcel: "102", cadastralSubunit: "21", cadastralCategory: "A/2", cadastralIncome: 723.04, historic: false, freeLoanToRelative: false },
  "prati-garage": { municipalityCode: "H501", cadastralSheet: "376", cadastralParcel: "212", cadastralSubunit: "503", cadastralCategory: "C/6", cadastralIncome: 185.92, historic: false, freeLoanToRelative: false },
};

// The market's zones (made up, OMI-like): each city's code, the semester quoted, and the
// properties whose zone the user picked (the others' is found from the address's location).
const CITY_CODES: Record<string, string> = { Milan: "F205", Bologna: "A944", Turin: "L219", Rome: "H501" };
const SEMESTER = { year: 2026, half: 1 as const };
const PICKED_ZONE = new Set(["navigli"]);

// The uses over time: San Salvario stood empty until it was let.
const DEMO_USES: Record<string, UsePeriod[]> = {
  "san-salvario": [{ effectiveOn: null, use: "vacant" }, { effectiveOn: "2023-03-01", use: "long_term_rental" }],
};
const usesOf = (p: Property): UsePeriod[] => DEMO_USES[p.id] ?? [{ effectiveOn: null, use: USE_OF[p.usage] }];
const propertyUseOn = (p: Property, day: string) => usesOf(p).filter((u) => !u.effectiveOn || u.effectiveOn <= day).at(-1)!.use;

// The cadastral multiplier by category.
function multiplier(category: string) {
  if (category === "A/10" || category === "D/5") return 80;
  if (category.startsWith("A") || ["C/2", "C/6", "C/7"].includes(category)) return 160;
  if (category.startsWith("B") || ["C/3", "C/4", "C/5"].includes(category)) return 140;
  if (category === "C/1") return 55;
  return 65;
}

// The municipalities' rate for other buildings, by year; Turin hasn't published 2026's yet.
const MUNICIPAL_RATES: Record<string, Record<number, number>> = {
  F205: { 2020: 1.06, 2021: 1.06, 2022: 1.06, 2023: 1.06, 2024: 1.14, 2025: 1.14, 2026: 1.14 },
  A944: { 2020: 1.06, 2021: 1.06, 2022: 1.06, 2023: 1.06, 2024: 1.06, 2025: 1.06, 2026: 1.06 },
  L219: { 2020: 1.06, 2021: 1.06, 2022: 1.06, 2023: 1.06, 2024: 1.06, 2025: 1.06 },
  H501: { 2020: 1.06, 2021: 1.06, 2022: 1.06, 2023: 1.06, 2024: 1.06, 2025: 1.06, 2026: 1.06 },
};

/** A day, moved past a weekend to the Monday. */
function workingDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const shift = date.getDay() === 6 ? 2 : date.getDay() === 0 ? 1 : 0;
  date.setDate(date.getDate() + shift);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A property's IMU for a year, before what was paid (see demoTaxes). */
function computeImu(p: Property, year: number): PropertyTax {
  const italy = DEMO_ITALY[p.id];
  const base: PropertyTax = {
    propertyUuid: p.id, kind: "property_tax", name: "IMU", country: "IT", year, currency: "EUR", status: "computed", notComputed: null,
    missingFields: [], amount: 0, paidAmount: 0, withheldAmount: 0, instalments: [], periods: [], capitalGain: null,
    provisional: year > 2026 || (year === 2026 && DEMO_TODAY < "2026-10-28"),
  };
  if (year < 2020) return { ...base, status: "not_computed", notComputed: "unsupported_year" };
  const [py, pm, pd] = p.purchaseDate.split("-").map(Number);
  // A month counts when owned for most of it (the 15th: the purchase month counts if bought by then).
  const firstMonth = py < year ? 1 : pd <= 15 ? pm : pm + 1;
  const rates = MUNICIPAL_RATES[italy.municipalityCode!];
  const rateYear = rates[year] !== undefined ? year : Math.max(...Object.keys(rates).map(Number).filter((y) => y < year));
  const ratePct = rates[rateYear];
  const taxableBase = round(italy.cadastralIncome! * 1.05 * multiplier(italy.cadastralCategory!), 2);
  const periods: TaxPeriod[] = [];
  for (let month = firstMonth; month <= 12; month++) {
    const day = `${year}-${pad(month)}-15`;
    const use = propertyUseOn(p, day);
    // Under a lease at an agreed rent: IMU at 75%.
    const agreed = AGREED.includes(leaseOn(p, day)?.kind ?? "");
    const last = periods.at(-1);
    if (last && last.use === use && last.lastMonth === month - 1 && last.reductions.includes("agreed_rent") === agreed) {
      last.lastMonth = month;
      last.months += 1;
    } else {
      periods.push({
        firstMonth: month, lastMonth: month, months: 1, use, rateClass: use === "primary_residence" ? "primary_residence" : "other_buildings",
        taxableBase, reductions: agreed ? ["agreed_rent"] : [], ratePct, rateSource: rateYear === year ? "municipality" : "municipality_earlier_year",
        rateYear: rateYear === year ? null : rateYear, deduction: 0, amount: 0, regime: null, income: 0, alternativeAmount: null, rentalContractUuid: null,
      });
    }
  }
  for (const period of periods) {
    period.amount = round((taxableBase * ratePct / 100) * period.months / 12 * (period.reductions.includes("agreed_rent") ? 0.75 : 1), 2);
  }
  const total = Math.round(periods.reduce((s, x) => s + x.amount, 0));
  if (total === 0) return { ...base, status: "exempt", periods };
  const first = Math.round(total / 2);
  return {
    ...base,
    amount: total,
    periods,
    instalments: [
      { number: 1, dueOn: workingDay(`${year}-06-16`), amount: first, paid: false, transactionUuids: [] },
      { number: 2, dueOn: workingDay(`${year}-12-16`), amount: total - first, paid: false, transactionUuids: [] },
    ],
  };
}

// Every transaction but the payments of the rents' tax (worked out from these: see DEMO_TRANSACTIONS).
const BASE_TRANSACTIONS: PropertyTransaction[] = (() => {
  const out: PropertyTransaction[] = [];
  let n = 0;
  const add = (p: Property, kind: PropertyTransaction["kind"], bookedOn: string, amount: number, extra: Partial<PropertyTransaction> = {}) => {
    if (bookedOn > DEMO_TODAY) return;
    out.push({
      uuid: `ret-${n++}`, propertyUuid: p.id, kind, bookedOn, amount: round(amount, 2), currency: "EUR",
      description: extra.description ?? TRANSACTION_KIND_LABELS[kind], counterparty: null, note: null, costKind: null, expenseKind: null,
      rentPeriod: null, taxYear: null, incentive: null, mortgageUuid: null, instalmentNumber: null, interest: null,
      prepaymentEffect: null, createdAt: `${bookedOn}T09:00:00Z`, platformFee: null, taxWithheld: null, incentiveKind: null,
      worksCompletedOn: null, taxRegime: null, movementUuid: null, movementState: null, movement: null, ...extra,
    });
  };

  for (const p of PROPERTIES) {
    // The purchase and its costs: registration taxes, the agency, the notary.
    add(p, "purchase", p.purchaseDate, -p.purchasePrice);
    add(p, "purchase_cost", p.purchaseDate, -p.purchaseCosts * 0.5, { costKind: "taxes", description: "Registration & taxes" });
    add(p, "purchase_cost", p.purchaseDate, -p.purchaseCosts * 0.35, { costKind: "agency", description: "Agency fee" });
    add(p, "purchase_cost", p.purchaseDate, -p.purchaseCosts * 0.15, { costKind: "notary", description: "Notary" });

    const rand = seeded(hashSeed(`re-${p.id}`));
    const letting = LETTING[p.id];
    for (const month of monthsBetween(addMonths(p.purchaseDate, 1).slice(0, 7), DEMO_MONTH)) {
      const mi = Number(month.slice(5)) - 1;
      if (letting && month >= letting.from) {
        if (p.usage === "Short-term rental") {
          // What the guests paid; the platform keeps its fee and, from 2024, withholds the 21%.
          const gross = round(shortTermAnalysis(p).monthly[mi].revenue * 0.8 * (0.85 + rand() * 0.3), 2);
          const platformFee = round(gross * 0.15, 2);
          const taxWithheld = month >= "2024-01" ? round(gross * 0.21, 2) : null;
          add(p, "short_stay_payout", `${month}-05`, gross - platformFee - (taxWithheld ?? 0), {
            counterparty: letting.counterparty, description: "Airbnb payout", platformFee, taxWithheld,
          });
        } else if (!(p.id === "prati-garage" && month === DEMO_MONTH)) {
          // The garage's rent for this month hasn't come in: the alerts' sample finds it.
          add(p, "rent", `${month}-05`, p.monthlyRent, { counterparty: letting.counterparty, rentPeriod: month });
        }
      }
      add(p, "expense", `${month}-10`, -p.monthlyCondo, { expenseKind: "condo_fees", counterparty: "Condo administrator", description: "Condo fees" });
      // IMU, its first instalment in June and the balance in December, as worked out (before 2020, a
      // flat sum).
      if (mi === 5 || mi === 11) {
        const taxYear = Number(month.slice(0, 4));
        const instalment = taxYear >= 2020 ? computeImu(p, taxYear).instalments[mi === 5 ? 0 : 1] : undefined;
        if (taxYear < 2020) add(p, "property_tax", `${month}-16`, -p.yearlyPropertyTax / 2, { taxYear, description: "IMU" });
        else if (instalment) add(p, "property_tax", instalment.dueOn, -instalment.amount, { taxYear, description: `IMU ${taxYear} — ${mi === 5 ? "first instalment" : "balance"}` });
      }
      // The odd repair.
      if (rand() > 0.9) add(p, "expense", `${month}-${pad(12 + Math.floor(rand() * 14))}`, -round(120 + rand() * 600), { expenseKind: "maintenance", description: "Repair" });
    }
    if (p.usage === "Short-term rental") {
      for (const year of [2022, 2023, 2024, 2025, 2026]) add(p, "expense", `${year}-03-20`, -540, { expenseKind: "insurance", counterparty: "Assicurazioni Demo", description: "Home insurance" });
    }
  }

  const byId = (id: string) => PROPERTIES.find((p) => p.id === id)!;
  add(byId("navigli"), "works", "2019-10-02", -18400, {
    description: "Bathroom and kitchen renovation", incentive: "Bonus ristrutturazione 50%", incentiveKind: "other", worksCompletedOn: "2019-12-20",
  });
  add(byId("santo-stefano"), "expense", "2021-05-18", -9600, { expenseKind: "furnishing", description: "Furnishing for short stays" });
  add(byId("san-salvario"), "works", "2022-11-21", -7200, {
    description: "New windows", incentive: "Ecobonus 50%", incentiveKind: "other", worksCompletedOn: "2022-12-15",
  });

  for (const def of MORTGAGE_DEFS) {
    for (const row of SCHEDULES.get(def.uuid)!) {
      add(def.property, "mortgage_instalment", row.dueOn, -row.payment, {
        mortgageUuid: def.uuid, instalmentNumber: row.number, interest: row.interest, counterparty: lenderOf(def.property),
      });
    }
  }
  // Newest first, as the API lists them.
  return out.sort((a, b) => b.bookedOn.localeCompare(a.bookedOn) || b.uuid.localeCompare(a.uuid, undefined, { numeric: true }));
})();

// ── The tax on rents: Italy's cedolare secca or IRPEF, worked out as the API does (simplified) ──

// The taxpayer's other income and surcharges, year by year: what IRPEF needs.
const DEMO_TAXPAYERS: TaxpayerYear[] = [2024, 2025, 2026].map((year, i) => ({
  year, holderName: null, otherIncome: [38000, 40000, 42000][i], surchargesPct: [2.33, 2.33, 2.53][i], reducedRatePropertyUuid: null, shortStayRegime: null,
}));

/** IRPEF on an income (2024's brackets: 23% to 28,000, 35% to 50,000, 43% above). */
function irpef(income: number) {
  return Math.min(income, 28000) * 0.23 + Math.max(0, Math.min(income, 50000) - 28000) * 0.35 + Math.max(0, income - 50000) * 0.43;
}

/** What IRPEF (with the surcharges) adds on a rent's taxable base, on top of the other income. */
function irpefOn(base: number, taxpayer: TaxpayerYear | undefined) {
  if (!taxpayer || taxpayer.otherIncome === null) return null;
  const other = taxpayer.otherIncome;
  return round(irpef(other + base) - irpef(other) + base * ((taxpayer.surchargesPct ?? 0) / 100), 2);
}

const ACCONTO_MIN = 51.65;
const ACCONTO_SPLIT = 257.52;

/** A property's rents' tax for a year, before what was paid: undefined with no rents that year. */
function computeRentalTax(p: Property, year: number): PropertyTax | undefined {
  const leases = leasesOf(p).filter((l) => l.startsOn <= `${year}-12-31` && (!l.endsOn || l.endsOn >= `${year}-01-01`));
  const payouts = BASE_TRANSACTIONS.filter((t) => t.propertyUuid === p.id && t.kind === "short_stay_payout" && t.bookedOn.startsWith(`${year}-`));
  if (leases.length === 0 && payouts.length === 0) return undefined;
  const base: PropertyTax = {
    propertyUuid: p.id, kind: "rental_income_tax", name: "Cedolare secca", country: "IT", year, currency: "EUR", status: "computed",
    notComputed: null, missingFields: [], amount: 0, paidAmount: 0, withheldAmount: 0, instalments: [], periods: [], provisional: year >= 2026,
    capitalGain: null,
  };
  if (year < 2024) return { ...base, status: "not_computed", notComputed: "unsupported_year" };
  const taxpayer = DEMO_TAXPAYERS.find((t) => t.year === year);
  const periods: TaxPeriod[] = [];
  for (const l of leases) {
    const firstMonth = l.startsOn < `${year}-01-01` ? 1 : Number(l.startsOn.slice(5, 7));
    const lastMonth = !l.endsOn || l.endsOn > `${year}-12-31` ? 12 : Number(l.endsOn.slice(5, 7));
    const months = lastMonth - firstMonth + 1;
    const income = round(l.monthlyRent * months, 2);
    const agreedTight = AGREED.includes(l.kind) && l.highTensionMunicipality;
    // IRPEF's base: the rent less the 5% flat deduction, and on 70% at an agreed rent where housing is tight.
    const irpefBase = round(income * 0.95 * (agreedTight ? 0.7 : 1), 2);
    const flat = round(income * (agreedTight ? 0.1 : 0.21), 2);
    const ordinary = irpefOn(irpefBase, taxpayer);
    const isFlat = l.taxRegime === "flat_rate";
    periods.push({
      firstMonth, lastMonth, months, use: propertyUseOn(p, `${year}-${pad(firstMonth)}-15`),
      rateClass: isFlat ? (agreedTight ? "flat_rate_agreed" : "flat_rate") : "ordinary",
      taxableBase: isFlat ? income : irpefBase, reductions: agreedTight ? ["agreed_rent"] : [],
      ratePct: isFlat ? (agreedTight ? 10 : 21) : ordinary === null ? 0 : round((ordinary / irpefBase) * 100, 2),
      rateSource: "legal", rateYear: null, deduction: 0, amount: isFlat ? flat : ordinary ?? 0,
      regime: l.taxRegime, income, alternativeAmount: isFlat ? ordinary : l.kind === "commercial" ? null : flat, rentalContractUuid: l.uuid,
    });
  }
  if (payouts.length > 0) {
    const months = payouts.map((t) => Number(t.bookedOn.slice(5, 7)));
    const gross = round(payouts.reduce((s, t) => s + t.amount + (t.platformFee ?? 0) + (t.taxWithheld ?? 0), 0), 2);
    periods.push({
      firstMonth: Math.min(...months), lastMonth: Math.max(...months), months: new Set(months).size, use: "short_term_rental",
      rateClass: "flat_rate_short_stay", taxableBase: gross, reductions: [], ratePct: 21, rateSource: "legal", rateYear: null, deduction: 0,
      amount: round(gross * 0.21, 2), regime: "flat_rate", income: gross, alternativeAmount: irpefOn(round(gross * 0.95, 2), taxpayer), rentalContractUuid: null,
    });
    base.withheldAmount = round(payouts.reduce((s, t) => s + (t.taxWithheld ?? 0), 0), 2);
  }
  const regimes = new Set(periods.map((x) => x.regime));
  const name = regimes.size > 1 ? "Cedolare secca e IRPEF" : regimes.has("ordinary") ? "IRPEF" : "Cedolare secca";
  if (regimes.has("ordinary") && (!taxpayer || taxpayer.otherIncome === null)) {
    return { ...base, name, status: "not_computed", notComputed: "missing_details", missingFields: ["taxpayer.otherIncome"], withheldAmount: base.withheldAmount };
  }
  const exact = periods.reduce((s, x) => s + x.amount, 0);
  const amount = Math.round(exact);
  // The cedolare's payments on account come from last year's net: 40% by 30 June and 60% by 30
  // November (only November when small, none when tiny); the balance with the return, by 30 June
  // of the next year.
  const previous = year > 2024 ? computeRentalTax(p, year - 1) : undefined;
  const previousNet = previous && previous.status === "computed"
    ? previous.periods.filter((x) => x.regime === "flat_rate").reduce((s, x) => s + x.amount, 0) - previous.withheldAmount
    : 0;
  const onAccount = previousNet > ACCONTO_SPLIT
    ? [{ dueOn: workingDay(`${year}-06-30`), amount: Math.round(previousNet * 0.4) }, { dueOn: workingDay(`${year}-11-30`), amount: Math.round(previousNet * 0.6) }]
    : previousNet > ACCONTO_MIN ? [{ dueOn: workingDay(`${year}-11-30`), amount: Math.round(previousNet) }] : [];
  const paidOnAccount = onAccount.reduce((s, x) => s + x.amount, 0);
  const balance = Math.max(0, Math.round(exact - base.withheldAmount - paidOnAccount));
  const instalments: TaxInstalment[] = [...onAccount, { dueOn: workingDay(`${year + 1}-06-30`), amount: balance }]
    .map((x, i) => ({ number: i + 1, ...x, paid: false, transactionUuids: [] }));
  return { ...base, name, amount, periods, instalments };
}

// The payments of the rents' tax, as each instalment fell due (to the sample's today).
const DEMO_TRANSACTIONS: PropertyTransaction[] = (() => {
  const payments: PropertyTransaction[] = [];
  for (const p of PROPERTIES) {
    for (const year of [2024, 2025, 2026]) {
      const tax = computeRentalTax(p, year);
      if (!tax || tax.status !== "computed") continue;
      tax.instalments.forEach((i, index) => {
        if (i.amount <= 0 || i.dueOn > DEMO_TODAY) return;
        const last = index === tax.instalments.length - 1;
        payments.push({
          uuid: `ret-tax-${p.id}-${year}-${i.number}`, propertyUuid: p.id, kind: "income_tax", bookedOn: i.dueOn, amount: -i.amount, currency: "EUR",
          description: `${tax.name} ${year} — ${last ? "balance" : "payment on account"}`, counterparty: "Agenzia delle Entrate", note: null,
          costKind: null, expenseKind: null, rentPeriod: null, taxYear: year, incentive: null, mortgageUuid: null, instalmentNumber: null,
          interest: null, prepaymentEffect: null, createdAt: `${i.dueOn}T09:00:00Z`, platformFee: null, taxWithheld: null,
          incentiveKind: null, worksCompletedOn: null, taxRegime: null, movementUuid: null, movementState: null, movement: null,
        });
      });
    }
  }
  return [...BASE_TRANSACTIONS, ...payments].sort((a, b) => b.bookedOn.localeCompare(a.bookedOn) || b.uuid.localeCompare(a.uuid, undefined, { numeric: true }));
})();

const transactionsOf = (propertyUuid: string | null) =>
  propertyUuid ? DEMO_TRANSACTIONS.filter((t) => t.propertyUuid === propertyUuid) : DEMO_TRANSACTIONS;

// A yearly estimate every January since the purchase, then this month's appraisal at the zone's
// current price.
const DEMO_VALUATIONS: Valuation[] = PROPERTIES.flatMap((p) => {
  const years = monthsBetween(p.purchaseDate.slice(0, 7), DEMO_MONTH).filter((m) => m.endsWith("-01") && m > p.purchaseDate.slice(0, 7));
  const estimates = years.map((month) => ({ valuedOn: `${month}-15`, value: propertyValueAt(p, (Number(month.slice(0, 4)) - 2019) * 4)!, source: "user_estimate" as const }));
  return [...estimates, { valuedOn: "2026-09-15", value: propertyValue(p), source: "appraisal" as const }].map((v, i) => ({
    uuid: `${p.id}-valuation-${i}`, propertyUuid: p.id, currency: "EUR", note: null, createdAt: `${v.valuedOn}T09:00:00Z`, ...v,
  }));
}).sort((a, b) => b.valuedOn.localeCompare(a.valuedOn));

/** The whole property's value on a day: its latest valuation, else its purchase price. */
function valueOn(p: Property, day: string) {
  if (day < p.purchaseDate) return 0;
  return DEMO_VALUATIONS.find((v) => v.propertyUuid === p.id && v.valuedOn <= day)?.value ?? p.purchasePrice;
}

function debtOn(p: Property, day: string) {
  const def = MORTGAGE_DEFS.find((d) => d.property === p);
  if (!def || day < p.purchaseDate) return 0;
  return SCHEDULES.get(def.uuid)!.filter((row) => row.dueOn <= day).at(-1)?.residualDebt ?? p.mortgage!.principal;
}

const INVESTED_KINDS = new Set(["purchase", "purchase_cost", "works"]);
const investedOn = (p: Property, day: string) =>
  -transactionsOf(p.id).filter((t) => INVESTED_KINDS.has(t.kind) && t.bookedOn <= day).reduce((s, t) => s + t.amount, 0);

function propertyMonth(p: Property, month: string): RealEstateMonth {
  const inMonth = transactionsOf(p.id).filter((t) => t.bookedOn.startsWith(month));
  const sum = (kinds: string[]) => inMonth.filter((t) => kinds.includes(t.kind)).reduce((s, t) => s + t.amount, 0);
  const income = sum(["rent", "short_stay_payout"]);
  const expenses = -sum(["expense", "property_tax", "income_tax"]);
  const mortgagePayments = -sum(["mortgage_instalment", "mortgage_prepayment"]);
  const mortgageInterest = inMonth.reduce((s, t) => s + (t.interest ?? 0), 0);
  // The month's end, or today for this one.
  const day = month === DEMO_MONTH ? DEMO_TODAY : monthEnd(month);
  return {
    month, income: round(income, 2), expenses: round(expenses, 2), mortgagePayments: round(mortgagePayments, 2),
    mortgageInterest: round(mortgageInterest, 2), netCashFlow: round(income - expenses - mortgagePayments, 2),
    value: valueOn(p, day), residualDebt: debtOn(p, day), invested: round(investedOn(p, day), 2),
  };
}

function demoSummary(propertyUuid: string | null, from?: string, to?: string): RealEstateSummary {
  const last = to ?? DEMO_MONTH;
  const first = from ?? addMonths(`${last}-01`, -11).slice(0, 7);
  const properties = propertyUuid ? PROPERTIES.filter((p) => p.id === propertyUuid) : PROPERTIES;
  const months = monthsBetween(first, last).map((month) => {
    const rows = properties.map((p) => propertyMonth(p, month));
    const total = (key: Exclude<keyof RealEstateMonth, "month">) => round(rows.reduce((s, r) => s + r[key], 0), 2);
    return {
      month, income: total("income"), expenses: total("expenses"), mortgagePayments: total("mortgagePayments"),
      mortgageInterest: total("mortgageInterest"), netCashFlow: total("netCashFlow"), value: total("value"),
      residualDebt: total("residualDebt"), invested: total("invested"),
    };
  });
  return { currency: "EUR", months };
}

export const DEMO_PROPERTIES: ApiProperty[] = PROPERTIES.map((p) => {
  const value = valueOn(p, DEMO_TODAY);
  const latest = DEMO_VALUATIONS.find((v) => v.propertyUuid === p.id);
  const residualDebt = debtOn(p, DEMO_TODAY);
  const year = demoSummary(p.id).months;
  const yearlyIncome = round(year.reduce((s, m) => s + m.income, 0), 2);
  return {
    uuid: p.id,
    name: p.name,
    kind: p.type.toLowerCase() as ApiProperty["kind"],
    use: propertyUseOn(p, DEMO_TODAY),
    uses: usesOf(p),
    holder: { kind: "person", name: null },
    appurtenantToUuid: null,
    acquisition: { kind: "purchase", acquiredOn: null, donorPurchasedOn: null, donorCost: null },
    address: { country: "IT", street: p.address, locality: p.city, region: null, postalCode: null, neighbourhood: zoneById(p.zoneId).name, location: null },
    currency: "EUR",
    surfaceSqm: p.sqm,
    rooms: p.rooms || null,
    yearBuilt: p.yearBuilt,
    energyRating: p.energyClass === "—" ? null : p.energyClass,
    ownershipSharePct: 100,
    details: { italy: { ...DEMO_ITALY[p.id], omiZone: PICKED_ZONE.has(p.id) ? demoZonesOf(p.city).find((z) => z.zone.id === p.zoneId)!.code : null } },
    note: null,
    purchasedOn: p.purchaseDate,
    soldOn: null,
    archived: false,
    figures: {
      value,
      valueSource: latest?.source ?? "purchase_price",
      valuedOn: latest?.valuedOn ?? p.purchaseDate,
      valueAtShare: value,
      residualDebt,
      equity: round(value - residualDebt, 2),
      invested: round(investedOn(p, DEMO_TODAY), 2),
      yearlyIncome,
      yearlyNetCashFlow: round(year.reduce((s, m) => s + m.netCashFlow, 0), 2),
      loanToValuePct: value > 0 ? (residualDebt / value) * 100 : null,
      grossYieldPct: value > 0 ? (yearlyIncome / value) * 100 : null,
      reference: { currency: "EUR", valueAtShare: value, residualDebt, equity: round(value - residualDebt, 2) },
    },
    createdAt: `${p.purchaseDate}T09:00:00Z`,
  };
});

const DEMO_MORTGAGES: Mortgage[] = MORTGAGE_DEFS.map((def) => {
  const rows = SCHEDULES.get(def.uuid)!;
  const next = rows.find((row) => row.dueOn > DEMO_TODAY);
  const reset = RATE_RESETS[def.property.id];
  const initial = def.rateChanges[0].ratePct;
  return {
    uuid: def.uuid,
    propertyUuid: def.property.id,
    principal: def.property.mortgage!.principal,
    currency: "EUR",
    firstInstalmentOn: def.firstInstalmentOn,
    termMonths: def.termMonths,
    frequency: "monthly",
    rate: reset
      ? { fixedPct: null, variable: { index: reset.index, spreadPct: reset.spreadPct, initialPct: initial } }
      : { fixedPct: initial, variable: null },
    rateChanges: def.rateChanges,
    lender: lenderOf(def.property),
    note: null,
    closedOn: null,
    residualDebt: debtOn(def.property, DEMO_TODAY),
    currentRatePct: def.rateChanges.filter((c) => c.effectiveOn <= DEMO_TODAY).at(-1)!.ratePct,
    currentInstalment: next?.payment ?? 0,
    lastInstalmentOn: rows.at(-1)!.dueOn,
    createdAt: `${def.property.purchaseDate}T09:00:00Z`,
  };
});

function demoOverview(): RealEstateOverview {
  const sum = (pick: (p: ApiProperty) => number) => round(DEMO_PROPERTIES.reduce((s, p) => s + pick(p), 0), 2);
  const value = sum((p) => p.figures.valueAtShare);
  const residualDebt = sum((p) => p.figures.residualDebt);
  const yearlyIncome = sum((p) => p.figures.yearlyIncome);
  return {
    currency: "EUR",
    propertyCount: DEMO_PROPERTIES.length,
    value,
    residualDebt,
    equity: round(value - residualDebt, 2),
    invested: sum((p) => p.figures.invested),
    yearlyIncome,
    yearlyNetCashFlow: sum((p) => p.figures.yearlyNetCashFlow),
    loanToValuePct: value > 0 ? (residualDebt / value) * 100 : null,
    grossYieldPct: value > 0 ? (yearlyIncome / value) * 100 : null,
  };
}

function matches(t: PropertyTransaction, f: PropertyTransactionFilters) {
  if (f.bookedFrom && t.bookedOn < f.bookedFrom) return false;
  if (f.bookedTo && t.bookedOn > f.bookedTo) return false;
  if (f.kinds?.length && !f.kinds.includes(t.kind)) return false;
  if (f.mortgageUuid && t.mortgageUuid !== f.mortgageUuid) return false;
  const text = f.text?.trim().toLowerCase();
  if (text && ![t.description, t.counterparty ?? "", t.note ?? ""].some((s) => s.toLowerCase().includes(text))) return false;
  return true;
}

/**
 * A tax with what its transactions of that tax year paid (property_tax for IMU, income_tax for the
 * rents'): money out counts, a refund is taken off, never below 0; it fills the instalments in order.
 */
function withPayments(tax: PropertyTax, kind: "property_tax" | "income_tax"): PropertyTax {
  const payments = DEMO_TRANSACTIONS.filter((t) => t.propertyUuid === tax.propertyUuid && t.kind === kind && t.taxYear === tax.year)
    .sort((a, b) => a.bookedOn.localeCompare(b.bookedOn));
  const paidAmount = Math.max(0, round(-payments.reduce((s, t) => s + t.amount, 0), 2));
  // Each payment's share of the running total, refunds left out of it.
  let running = 0;
  const shares = payments.filter((t) => t.amount < 0).map((t) => {
    const from = running;
    running += -t.amount;
    return { uuid: t.uuid, from, to: running };
  });
  // An instalment is paid once what was paid covers it and those before it; it lists the payments
  // whose share reaches it.
  let start = 0;
  const instalments = tax.instalments.map((i) => {
    const end = start + i.amount;
    const listed = shares.filter((x) => x.from < end && x.to > start).map((x) => x.uuid);
    start = end;
    return { ...i, paid: paidAmount >= end, transactionUuids: listed };
  });
  return { ...tax, instalments, paidAmount };
}

/** The year's taxes of each property owned in it: its IMU, then its rents' tax when it had rents. */
function demoTaxes(propertyUuid: string | null, year: number): TaxList {
  const taxes = PROPERTIES
    .filter((p) => (!propertyUuid || p.id === propertyUuid) && Number(p.purchaseDate.slice(0, 4)) <= year)
    .flatMap((p) => {
      const rental = computeRentalTax(p, year);
      return [withPayments(computeImu(p, year), "property_tax"), ...(rental ? [withPayments(rental, "income_tax")] : [])];
    });
  const amount = taxes.filter((t) => t.status === "computed").reduce((s, t) => s + t.amount, 0);
  return { taxes, totals: amount > 0 ? [{ currency: "EUR", amount }] : [] };
}

// A few municipalities to search, as the API's list has them (Italy's, by codice catastale).
const MUNICIPALITIES: Municipality[] = [
  { code: "F205", name: "Milano", province: "MI", region: "Lombardia" },
  { code: "A944", name: "Bologna", province: "BO", region: "Emilia-Romagna" },
  { code: "L219", name: "Torino", province: "TO", region: "Piemonte" },
  { code: "H501", name: "Roma", province: "RM", region: "Lazio" },
  { code: "F839", name: "Napoli", province: "NA", region: "Campania" },
  { code: "D612", name: "Firenze", province: "FI", region: "Toscana" },
  { code: "L736", name: "Venezia", province: "VE", region: "Veneto" },
  { code: "D969", name: "Genova", province: "GE", region: "Liguria" },
  { code: "G273", name: "Palermo", province: "PA", region: "Sicilia" },
  { code: "A662", name: "Bari", province: "BA", region: "Puglia" },
  { code: "H223", name: "Reggio di Calabria", province: "RC", region: "Calabria" },
  { code: "H224", name: "Reggio nell'Emilia", province: "RE", region: "Emilia-Romagna" },
  { code: "A074", name: "Agliè", province: "TO", region: "Piemonte" },
  { code: "B157", name: "Brescia", province: "BS", region: "Lombardia" },
  { code: "A794", name: "Bergamo", province: "BG", region: "Lombardia" },
].map((m) => ({ country: "IT", ...m }));

const plain = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** By name (exact, then starting with it, then containing it) or by code, as the API answers. */
function demoMunicipalities({ search, codes }: { search?: string; codes?: string[] }) {
  if (codes?.length) return codes.map((c) => MUNICIPALITIES.find((m) => m.code === c.toUpperCase())).filter((m): m is Municipality => !!m);
  const q = plain(search ?? "");
  if (q.length < 2) return [];
  const rank = (m: Municipality) => (plain(m.name) === q ? 0 : plain(m.name).startsWith(q) ? 1 : 2);
  return MUNICIPALITIES.filter((m) => plain(m.name).includes(q)).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, 20);
}

/**
 * A sale's tax were the property sold so (a simplified copy of the API's): the gain over the
 * purchase, its costs and the works, taxed when sold within 5 years of the purchase (none of the
 * sample's works are Superbonus); 26% at the deed, or IRPEF with the return, each with the other's
 * cost; the user's primary residence isn't taxed.
 */
function demoSaleTax(p: Property, request: SaleSimulationRequest): PropertyTax {
  const soldOn = request.soldOn;
  const year = Number(soldOn.slice(0, 4));
  const price = Number(request.price);
  const saleCosts = (request.costs ?? []).reduce((s, c) => s + Number(c.amount), 0);
  const works = -transactionsOf(p.id).filter((t) => t.kind === "works" && t.bookedOn <= soldOn).reduce((s, t) => s + t.amount, 0);
  const [y, m, d] = p.purchaseDate.split("-").map(Number);
  const end = new Date(y + 5, m - 1, d - 1);
  const taxedUntil = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
  const gain = round(price - saleCosts - p.purchasePrice - p.purchaseCosts - works, 2);
  const capitalGain = {
    soldOn, salePrice: price, saleCosts, acquisitionCost: p.purchasePrice, acquisitionCosts: p.purchaseCosts, works, worksExcluded: 0,
    gain, rule: soldOn <= taxedUntil ? ("within_five_years" as const) : null, taxedUntil,
    // No Superbonus works in the sample: nothing to revalue.
    costRevaluationDue: false, costRevaluation: null,
  };
  const ordinary = request.regime === "ordinary";
  const taxed = soldOn <= taxedUntil && propertyUseOn(p, soldOn) !== "primary_residence";
  const base = Math.max(0, gain);
  const flat = round(base * 0.26, 2);
  const irpefCost = irpefOn(base, DEMO_TAXPAYERS.find((t) => t.year === year));
  const amount = !taxed ? 0 : Math.round(ordinary ? irpefCost ?? 0 : flat);
  const period: TaxPeriod = {
    firstMonth: Number(soldOn.slice(5, 7)), lastMonth: Number(soldOn.slice(5, 7)), months: 1, use: propertyUseOn(p, soldOn),
    rateClass: !taxed ? (soldOn > taxedUntil ? "outside_window" : "primary_residence") : ordinary ? "ordinary" : "substitute_tax",
    taxableBase: taxed ? base : 0, reductions: [], ratePct: !taxed ? 0 : ordinary ? (base > 0 && irpefCost ? round((irpefCost / base) * 100, 2) : 0) : 26,
    rateSource: taxed ? "legal" : "exempt", rateYear: null, deduction: 0, amount, regime: ordinary ? "ordinary" : "flat_rate",
    income: price, alternativeAmount: !taxed ? null : ordinary ? flat : irpefCost, rentalContractUuid: null,
  };
  return {
    propertyUuid: p.id, kind: "capital_gains_tax", name: ordinary ? "IRPEF sulla plusvalenza" : "Imposta sostitutiva sulla plusvalenza",
    country: "IT", year, currency: "EUR", status: taxed ? "computed" : "exempt", notComputed: null, missingFields: [], amount,
    instalments: taxed && amount > 0 ? [{ number: 1, dueOn: ordinary ? workingDay(`${year + 1}-06-30`) : soldOn, amount, paid: false, transactionUuids: [] }] : [],
    periods: [period], provisional: false, paidAmount: 0, withheldAmount: 0, capitalGain,
  };
}

// ── Alerts: a few rules, and what each finds on the sample's today ──

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type DemoRuleDef = Pick<RealEstateAlertRule, "uuid" | "propertyUuid" | "params" | "notifyEmail" | "notifyInApp" | "enabled" | "createdAt">;
const DEMO_RULES: DemoRuleDef[] = [
  { uuid: "rule-rent", propertyUuid: null, params: { type: "rent_unpaid", dayOfMonth: 10 }, notifyEmail: true, notifyInApp: true, enabled: true, createdAt: "2026-01-10T09:00:00Z" },
  { uuid: "rule-tax", propertyUuid: null, params: { type: "tax_due", daysBefore: 90 }, notifyEmail: true, notifyInApp: true, enabled: true, createdAt: "2026-01-10T09:05:00Z" },
  { uuid: "rule-mortgage", propertyUuid: null, params: { type: "mortgage_instalment_unpaid", daysAfter: 5 }, notifyEmail: false, notifyInApp: true, enabled: true, createdAt: "2026-01-10T09:10:00Z" },
  { uuid: "rule-lease", propertyUuid: "san-salvario", params: { type: "lease_ending", daysBefore: 180 }, notifyEmail: true, notifyInApp: true, enabled: true, createdAt: "2026-02-02T18:00:00Z" },
  { uuid: "rule-ltv", propertyUuid: null, params: { type: "loan_to_value", thresholdPct: 60 }, notifyEmail: true, notifyInApp: true, enabled: false, createdAt: "2026-03-15T08:30:00Z" },
  { uuid: "rule-zone", propertyUuid: null, params: { type: "zone_price_drop", thresholdPct: 5 }, notifyEmail: true, notifyInApp: true, enabled: true, createdAt: "2026-10-01T08:30:00Z" },
  { uuid: "rule-rent-market", propertyUuid: null, params: { type: "rent_below_market", tolerancePct: 0 }, notifyEmail: false, notifyInApp: true, enabled: true, createdAt: "2026-10-01T08:35:00Z" },
];

const NO_FINDING = {
  dueOn: null, amount: null, rentalContractUuid: null, tenant: null, rentPeriod: null, mortgageUuid: null, instalmentNumber: null,
  lender: null, taxKind: null, taxName: null, taxYear: null, loanToValuePct: null, residualDebt: null, valueAtShare: null,
};

/** What a rule finds on the sample's today, as the API's check would (simplified). */
function demoFindings(rule: DemoRuleDef): RealEstateAlertFinding[] {
  if (!rule.enabled) return [];
  const params: RealEstateAlertParams = rule.params;
  const scoped = PROPERTIES.filter((p) => !rule.propertyUuid || p.id === rule.propertyUuid);
  const base = (p: Property, key: string) => ({ ...NO_FINDING, key, kind: params.type, propertyUuid: p.id, propertyName: p.name, currency: "EUR" });
  const out: RealEstateAlertFinding[] = scoped.flatMap((p): RealEstateAlertFinding[] => {
    switch (params.type) {
      case "rent_unpaid":
        return leasesOf(p).flatMap((l) => [0, -1, -2].flatMap((shift) => {
          const month = addMonths(`${DEMO_MONTH}-01`, shift).slice(0, 7);
          if (l.startsOn > monthEnd(month) || (l.endsOn && l.endsOn < `${month}-01`)) return [];
          const dueOn = [`${month}-${pad(params.dayOfMonth)}`, l.startsOn].sort().at(-1)!;
          const paid = DEMO_TRANSACTIONS.some((t) => t.propertyUuid === p.id && t.kind === "rent" && (t.rentPeriod ?? t.bookedOn.slice(0, 7)) === month);
          return dueOn > DEMO_TODAY || paid ? [] : [{ ...base(p, `${l.uuid}:${month}`), dueOn, amount: l.monthlyRent, rentalContractUuid: l.uuid, tenant: l.tenant, rentPeriod: month }];
        }));
      case "tax_due": {
        const year = Number(DEMO_TODAY.slice(0, 4));
        return [year - 1, year].flatMap((y) => demoTaxes(p.id, y).taxes).flatMap((t) => t.instalments
          .filter((i) => !i.paid && i.amount > 0 && i.dueOn <= addDays(DEMO_TODAY, params.daysBefore))
          .map((i) => ({ ...base(p, `${p.id}:${t.kind}:${t.year}:${i.number}`), dueOn: i.dueOn, amount: i.amount, taxKind: t.kind, taxName: t.name, taxYear: t.year })));
      }
      case "mortgage_instalment_unpaid":
        return MORTGAGE_DEFS.filter((def) => def.property.id === p.id).flatMap((def) => SCHEDULES.get(def.uuid)!
          .filter((row) => addDays(row.dueOn, params.daysAfter) <= DEMO_TODAY && addDays(row.dueOn, 90) >= DEMO_TODAY)
          .filter((row) => !DEMO_TRANSACTIONS.some((t) => t.mortgageUuid === def.uuid && t.instalmentNumber === row.number))
          .map((row) => ({ ...base(p, `${def.uuid}:${row.number}`), dueOn: row.dueOn, amount: row.payment, mortgageUuid: def.uuid, instalmentNumber: row.number, lender: lenderOf(p) })));
      case "lease_ending":
        return leasesOf(p)
          .filter((l) => l.endsOn && l.endsOn >= DEMO_TODAY && l.endsOn <= addDays(DEMO_TODAY, params.daysBefore))
          .map((l) => ({ ...base(p, l.uuid), dueOn: l.endsOn, amount: l.monthlyRent, rentalContractUuid: l.uuid, tenant: l.tenant }));
      case "loan_to_value": {
        const f = DEMO_PROPERTIES.find((x) => x.uuid === p.id)!.figures;
        return f.loanToValuePct !== null && f.loanToValuePct > Number(params.thresholdPct)
          ? [{ ...base(p, p.id), loanToValuePct: round(f.loanToValuePct, 2), residualDebt: f.residualDebt, valueAtShare: f.valueAtShare }]
          : [];
      }
      case "zone_price_drop": {
        const m = demoMarket(p.id);
        const t = m.trend;
        if (!t || t.saleChangeYearPct === null || t.saleChangeYearPct > -Number(params.thresholdPct)) return [];
        const last = t.points.at(-1)!;
        const before = t.points.find((x) => x.semester.year === last.semester.year - 1 && x.semester.half === last.semester.half)!;
        return [{
          ...base(p, `${m.zone!.code}:${last.semester.year}-${last.semester.half}`), zone: m.zone, semester: last.semester,
          changePct: t.saleChangeYearPct, perSqm: last.saleMid, referencePerSqm: before.saleMid,
        }];
      }
      case "rent_below_market": {
        const m = demoMarket(p.id);
        if (!m.rent || !m.quotation?.rentMin) return [];
        const changePct = round((m.rent.monthlyRentPerSqm / m.quotation.rentMin - 1) * 100, 2);
        if (changePct >= 0 || -changePct < Number(params.tolerancePct)) return [];
        const lease = leaseOn(p, DEMO_TODAY)!;
        return [{
          ...base(p, `${lease.uuid}:${SEMESTER.year}-${SEMESTER.half}`), zone: m.zone, semester: SEMESTER, changePct,
          perSqm: m.rent.monthlyRentPerSqm, referencePerSqm: m.quotation.rentMin, amount: lease.monthlyRent, rentalContractUuid: lease.uuid, tenant: lease.tenant,
        }];
      }
    }
  });
  return out.sort((a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? "") || a.propertyName.localeCompare(b.propertyName));
}

// Worked out on first read: the market's findings need the sample market, defined further down.
let demoAlertRules: RealEstateAlertRule[] | null = null;
const DEMO_ALERT_RULES = () => demoAlertRules ??= DEMO_RULES.map((rule) => {
  const findings = demoFindings(rule);
  return {
    ...rule,
    findings,
    lastCheckedAt: `${DEMO_TODAY}T05:00:00Z`,
    lastTriggeredAt: findings.length ? `${DEMO_TODAY}T05:00:00Z` : null,
    updatedAt: rule.createdAt,
  };
});

// ── Mortgage simulations: a prepayment, a refinancing (simplified copies of the API's) ──

const PERIOD_MONTHS = { monthly: 1, quarterly: 3, semiannual: 6 } as const;

/**
 * Equal instalments on `debt` at `ratePct`: `count` of them, or `payment` each until it's repaid;
 * due on `dueOn(i)`, numbered from `first`.
 */
function amortise(debt: number, ratePct: number, periodMonths: number, dueOn: (i: number) => string, first: number, plan: { count: number } | { payment: number }): Instalment[] {
  const r = (ratePct / 100) * (periodMonths / 12);
  const payment = "payment" in plan ? plan.payment : r === 0 ? debt / plan.count : (debt * r) / (1 - (1 + r) ** -plan.count);
  const rows: Instalment[] = [];
  for (let i = 0; debt > 0.005 && i < 1200; i++) {
    const interest = debt * r;
    const last = "count" in plan ? i === plan.count - 1 : payment - interest >= debt;
    const principal = last ? debt : Math.min(debt, payment - interest);
    debt = Math.max(0, debt - principal);
    rows.push({
      number: first + i, dueOn: dueOn(i), payment: round(principal + interest, 2), principal: round(principal, 2),
      interest: round(interest, 2), residualDebt: round(debt, 2), ratePct, transactionUuid: null,
    });
  }
  return rows;
}

function outlook(debt: number, ratePct: number, instalments: Instalment[]): ScheduleOutlook {
  return {
    residualDebt: round(debt, 2),
    instalments,
    instalmentCount: instalments.length,
    nextPayment: instalments[0]?.payment ?? 0,
    ratePct,
    lastInstalmentOn: instalments.at(-1)?.dueOn ?? null,
    interest: round(instalments.reduce((s, i) => s + i.interest, 0), 2),
    totalPaid: round(instalments.reduce((s, i) => s + i.payment, 0), 2),
  };
}

/** The schedule from `day` on, as it stands; refused before the sample's today or once repaid. */
function currentOutlook(mortgageUuid: string, day: string) {
  const def = MORTGAGE_DEFS.find((d) => d.uuid === mortgageUuid);
  if (!def) throw new Error("Mortgage not found.");
  const rows = SCHEDULES.get(def.uuid)!;
  const done = rows.filter((row) => row.dueOn <= day);
  const debt = done.length ? done.at(-1)!.residualDebt : def.property.mortgage!.principal;
  const left = rows.filter((row) => row.dueOn > day).map((row) => ({ ...row, transactionUuid: null }));
  if (day < DEMO_TODAY || debt <= 0) throw new Error("The day must be today or later, while something is still owed.");
  return { def, debt, left, current: outlook(debt, left[0]?.ratePct ?? def.rateChanges.at(-1)!.ratePct, left) };
}

function demoPrepayment(mortgageUuid: string, request: PrepaymentSimulationRequest): PrepaymentSimulation {
  const { debt, left, current } = currentOutlook(mortgageUuid, request.prepaidOn);
  const prepaid = round(Math.min(Number(request.amount), debt), 2);
  const after = debt - prepaid;
  const dueOn = (i: number) => left[i]?.dueOn ?? addMonths(left.at(-1)!.dueOn, i - left.length + 1);
  const rows = after <= 0 ? [] : amortise(after, current.ratePct, 1, dueOn, left[0].number,
    request.effect === "shorten_term" ? { payment: current.nextPayment } : { count: left.length });
  const simulated = outlook(after, current.ratePct, rows);
  const costs = Number(request.costs ?? 0);
  const interestSaved = round(current.interest - simulated.interest, 2);
  return { currency: "EUR", prepaid, current, simulated, interestSaved, costs, netSaving: round(interestSaved - costs, 2) };
}

function demoRefinancing(mortgageUuid: string, request: RefinancingSimulationRequest): RefinancingSimulation {
  const { debt, left, current } = currentOutlook(mortgageUuid, request.refinancedOn);
  const period = PERIOD_MONTHS[request.frequency ?? "monthly"];
  const termMonths = request.termMonths ?? Math.ceil(left.length / period) * period;
  const ratePct = Number(request.rate.fixedPct ?? request.rate.variable!.initialPct);
  const rows = amortise(debt, ratePct, period, (i) => addMonths(request.refinancedOn, (i + 1) * period), 1, { count: termMonths / period });
  const refinanced = outlook(debt, ratePct, rows);
  const costs = Number(request.costs ?? 0);
  const interestSaved = round(current.interest - refinanced.interest, 2);
  // The first new instalment by which the interest saved since the day covers the costs.
  let breakEven: Instalment | null = null;
  if (costs > 0) {
    for (const row of rows) {
      const before = current.instalments.filter((i) => i.dueOn <= row.dueOn).reduce((s, i) => s + i.interest, 0);
      const now = rows.filter((i) => i.number <= row.number).reduce((s, i) => s + i.interest, 0);
      if (before - now >= costs) { breakEven = row; break; }
    }
  }
  return {
    currency: "EUR", principal: round(debt, 2), termMonths, current, refinanced, interestSaved, costs, netSaving: round(interestSaved - costs, 2),
    breakEvenInstalment: breakEven?.number ?? null, breakEvenOn: breakEven?.dueOn ?? null,
  };
}

// ── The market: OMI-like zones and quotations, made up from the sample's neighbourhoods ──

const step = (v: number, by: number) => Math.round(v / by) * by;

/** A city's zones, as OMI codes them: the dearest central (B), then semi-central (C), then outlying (D). */
function demoZonesOf(city: string): (MarketZone & { zone: Zone })[] {
  const zones = ZONES.filter((z) => z.city === city).sort((a, b) => zoneNow(b) - zoneNow(a));
  const counts: Record<string, number> = {};
  return zones.map((z, i) => {
    const letter = i === 0 ? "B" : i < zones.length - 1 ? "C" : "D";
    counts[letter] = (counts[letter] ?? 0) + 1;
    return {
      country: "IT", municipalityCode: CITY_CODES[city], code: `${letter}${counts[letter]}`,
      band: letter === "B" ? "Centrale" : letter === "C" ? "Semicentrale" : "Periferica",
      description: z.name.toUpperCase(), semester: SEMESTER, zone: z,
    };
  }).sort((a, b) => a.code.localeCompare(b.code));
}

const BUILDING_TYPES = [
  { code: "20", name: "Abitazioni civili", sale: 1, rent: 1 },
  { code: "21", name: "Abitazioni signorili", sale: 1.3, rent: 1.25 },
  { code: "6", name: "Box", sale: 0.42, rent: 0.62 },
  { code: "5", name: "Negozi", sale: 1.1, rent: 1.35 },
];

function demoQuotations(z: Zone): MarketQuotation[] {
  const now = zoneNow(z);
  return BUILDING_TYPES.map((t) => ({
    semester: SEMESTER, buildingTypeCode: t.code, buildingType: t.name, state: "Normale",
    saleMin: step(now * t.sale * 0.88, 50), saleMax: step(now * t.sale * 1.12, 50), saleSurface: "gross" as const,
    rentMin: round(z.rentPerSqm * t.rent * 0.85, 1), rentMax: round(z.rentPerSqm * t.rent * 1.15, 1), rentSurface: "gross" as const,
  }));
}

/**
 * The zone's middle prices over the last semesters, following its price series (H1 at its second
 * quarter, H2 at its fourth), up to the semester quoted.
 */
function demoTrend(z: Zone, q: MarketQuotation): MarketTrend {
  const series = zonePriceSeries(z);
  const indexOf = (year: number, half: 1 | 2) => (year - 2019) * 4 + (half === 1 ? 1 : 3);
  const latest = indexOf(SEMESTER.year, SEMESTER.half);
  const saleMid = (q.saleMin + q.saleMax) / 2;
  const rentMid = q.rentMin !== null && q.rentMax !== null ? (q.rentMin + q.rentMax) / 2 : null;
  const points: MarketTrend["points"] = [];
  for (let year = 2022; year <= SEMESTER.year; year++) {
    for (const half of [1, 2] as const) {
      const i = indexOf(year, half);
      if (i > latest) continue;
      const ratio = series[i] / series[latest];
      points.push({ semester: { year, half }, saleMid: step(saleMid * ratio, 10), rentMid: rentMid === null ? null : round(rentMid * ratio ** 0.7, 1) });
    }
  }
  const change = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null ? null : round((a / b - 1) * 100, 2));
  const [last, prev, yearAgo] = [points.at(-1), points.at(-2), points.at(-3)];
  return {
    buildingTypeCode: q.buildingTypeCode, buildingType: q.buildingType, state: q.state, points,
    saleChangeSemesterPct: change(last?.saleMid, prev?.saleMid), saleChangeYearPct: change(last?.saleMid, yearAgo?.saleMid),
    rentChangeSemesterPct: change(last?.rentMid, prev?.rentMid), rentChangeYearPct: change(last?.rentMid, yearAgo?.rentMid),
  };
}

function demoMarket(propertyUuid: string): PropertyMarket {
  const p = PROPERTIES.find((x) => x.id === propertyUuid);
  if (!p) throw new Error("Property not found.");
  const zone = demoZonesOf(p.city).find((z) => z.zone.id === p.zoneId)!;
  const zoneQuotations = demoQuotations(zone.zone);
  const quotation = zoneQuotations.find((q) => q.buildingType === (p.type === "Garage" ? "Box" : "Abitazioni civili"))!;
  const lease = leaseOn(p, DEMO_TODAY);
  const perSqm = lease ? round(lease.monthlyRent / p.sqm, 2) : null;
  const { zone: _omit, ...publicZone } = zone;
  void _omit;
  return {
    propertyUuid, status: "available", missingFields: [], zone: publicZone, match: PICKED_ZONE.has(p.id) ? "user" : "location",
    quotation, zoneQuotations,
    value: { low: round(p.sqm * quotation.saleMin, 0), mid: round(p.sqm * (quotation.saleMin + quotation.saleMax) / 2, 0), high: round(p.sqm * quotation.saleMax, 0) },
    rent: lease && perSqm !== null ? {
      monthlyRent: lease.monthlyRent, monthlyRentPerSqm: perSqm,
      position: perSqm < quotation.rentMin! ? "below" : perSqm > quotation.rentMax! ? "above" : "within",
    } : null,
    trend: demoTrend(zone.zone, quotation),
    // Made-up figures: not the OMI's, so not credited to it.
    attribution: null,
  };
}

/** A demo account's real estate, read as the API would serve it. */
export const demoRealEstateSource: RealEstateSource = {
  overview: async () => demoOverview(),
  summary: async (propertyUuid, from, to) => demoSummary(propertyUuid, from, to),
  transactions: async (propertyUuid, filters = {}) => {
    const all = transactionsOf(propertyUuid).filter((t) => matches(t, filters));
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const amount = round(all.reduce((s, t) => s + t.amount, 0), 2);
    return { items: all.slice(offset, offset + limit), total: all.length, limit, offset, totals: all.length ? [{ currency: "EUR", amount }] : [] };
  },
  mortgages: async (propertyUuid) => DEMO_MORTGAGES.filter((m) => !propertyUuid || m.propertyUuid === propertyUuid),
  schedule: async (mortgageUuid) => {
    const rows = SCHEDULES.get(mortgageUuid) ?? [];
    const paid = new Map(DEMO_TRANSACTIONS.filter((t) => t.mortgageUuid === mortgageUuid).map((t) => [t.instalmentNumber, t.uuid]));
    return {
      currency: "EUR",
      instalments: rows.map((row) => ({ ...row, transactionUuid: paid.get(row.number) ?? null })),
      prepayments: [],
      totalInterest: round(rows.reduce((s, row) => s + row.interest, 0), 2),
    };
  },
  valuations: async (propertyUuid) => DEMO_VALUATIONS.filter((v) => v.propertyUuid === propertyUuid),
  taxes: async (propertyUuid, year) => demoTaxes(propertyUuid, year ?? Number(DEMO_TODAY.slice(0, 4))),
  municipalities: async (query) => demoMunicipalities(query),
  rentalContracts: async (propertyUuid) => DEMO_LEASES.filter((l) => !propertyUuid || l.propertyUuid === propertyUuid),
  taxpayerYears: async (year) => DEMO_TAXPAYERS.filter((t) => year === undefined || t.year === year),
  simulateSale: async (propertyUuid, request) => {
    const p = PROPERTIES.find((x) => x.id === propertyUuid);
    return p ? demoSaleTax(p, request) : null;
  },
  // The sample wallets and properties aren't linked: nothing to propose.
  movementLinkProposals: async () => [],
  simulatePrepayment: async (mortgageUuid, request) => demoPrepayment(mortgageUuid, request),
  simulateRefinancing: async (mortgageUuid, request) => demoRefinancing(mortgageUuid, request),
  marketZones: async (code) => {
    const city = Object.keys(CITY_CODES).find((c) => CITY_CODES[c] === code.toUpperCase());
    return city ? demoZonesOf(city).map(({ zone: _omit, ...z }) => { void _omit; return z; }) : [];
  },
  market: async (propertyUuid) => demoMarket(propertyUuid),
  alertRules: async (propertyUuid) => DEMO_ALERT_RULES().filter((r) => !propertyUuid || !r.propertyUuid || r.propertyUuid === propertyUuid),
};
