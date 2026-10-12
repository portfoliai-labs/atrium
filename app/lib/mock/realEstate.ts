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
  Mortgage, MortgageSchedule, Property as ApiProperty, PropertyTransaction, PropertyTransactionFilters,
  PropertyUse, RealEstateMonth, RealEstateOverview, RealEstateSummary, Valuation,
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

// ── Reports and alerts ─────────────────────────────────────────────────────────────────────

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

export interface RealEstateAlert {
  id: string;
  title: string;
  detail: string;
  scope: string; // a property's name, or "Every property"
  enabled: boolean;
  triggered: boolean;
}

export const REAL_ESTATE_ALERTS: RealEstateAlert[] = [
  { id: "ra1", title: "Rent not received", detail: "No rent by the 10th of the month", scope: "Every rented property", enabled: true, triggered: false },
  { id: "ra2", title: "Zone prices falling", detail: "Price per m² in the neighbourhood drops more than 5% in a quarter", scope: "Every property", enabled: true, triggered: false },
  { id: "ra3", title: "Property tax due", detail: "IMU instalment due within 15 days (16 June, 16 December)", scope: "Every property", enabled: true, triggered: false },
  { id: "ra4", title: "Short-stay occupancy low", detail: "Occupancy under 55% over the last 30 days", scope: "Santo Stefano studio", enabled: true, triggered: true },
  { id: "ra5", title: "Rent below market", detail: "Rent collected more than 10% under the zone's market rent", scope: "Every rented property", enabled: false, triggered: false },
  { id: "ra6", title: "Mortgage rate reset", detail: "A variable-rate mortgage changes its rate", scope: "San Salvario two-bed", enabled: true, triggered: false },
  { id: "ra7", title: "Loan-to-value above 60%", detail: "Mortgage debt passes 60% of the estimated value", scope: "Every property", enabled: false, triggered: false },
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
  "san-salvario": { from: "2023-01", counterparty: "L. Conti" },
  "prati-garage": { from: "2020-12", counterparty: "M. De Santis" },
};

const DEMO_TRANSACTIONS: PropertyTransaction[] = (() => {
  const out: PropertyTransaction[] = [];
  let n = 0;
  const add = (p: Property, kind: PropertyTransaction["kind"], bookedOn: string, amount: number, extra: Partial<PropertyTransaction> = {}) => {
    if (bookedOn > DEMO_TODAY) return;
    out.push({
      uuid: `ret-${n++}`, propertyUuid: p.id, kind, bookedOn, amount: round(amount, 2), currency: "EUR",
      description: extra.description ?? TRANSACTION_KIND_LABELS[kind], counterparty: null, note: null, costKind: null, expenseKind: null,
      rentPeriod: null, taxYear: null, incentive: null, mortgageUuid: null, instalmentNumber: null, interest: null,
      prepaymentEffect: null, createdAt: `${bookedOn}T09:00:00Z`, ...extra,
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
          // The platform pays out what's left after its fee and the cleaning.
          const payout = shortTermAnalysis(p).monthly[mi].revenue * 0.65 * (0.85 + rand() * 0.3);
          add(p, "short_stay_payout", `${month}-05`, payout, { counterparty: letting.counterparty, description: "Airbnb payout" });
        } else {
          add(p, "rent", `${month}-05`, p.monthlyRent, { counterparty: letting.counterparty, rentPeriod: month });
        }
      }
      add(p, "expense", `${month}-10`, -p.monthlyCondo, { expenseKind: "condo_fees", counterparty: "Condo administrator", description: "Condo fees" });
      // IMU, half in June and half in December.
      if (mi === 5 || mi === 11) add(p, "property_tax", `${month}-16`, -p.yearlyPropertyTax / 2, { taxYear: Number(month.slice(0, 4)), description: "IMU" });
      // The odd repair.
      if (rand() > 0.9) add(p, "expense", `${month}-${pad(12 + Math.floor(rand() * 14))}`, -round(120 + rand() * 600), { expenseKind: "maintenance", description: "Repair" });
    }
    if (p.usage === "Short-term rental") {
      for (const year of [2022, 2023, 2024, 2025, 2026]) add(p, "expense", `${year}-03-20`, -540, { expenseKind: "insurance", counterparty: "Assicurazioni Demo", description: "Home insurance" });
    }
  }

  const byId = (id: string) => PROPERTIES.find((p) => p.id === id)!;
  add(byId("navigli"), "works", "2019-10-02", -18400, { description: "Bathroom and kitchen renovation", incentive: "Bonus ristrutturazione 50%" });
  add(byId("santo-stefano"), "expense", "2021-05-18", -9600, { expenseKind: "furnishing", description: "Furnishing for short stays" });
  add(byId("san-salvario"), "works", "2022-11-21", -7200, { description: "New windows", incentive: "Ecobonus 50%" });

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
  const expenses = -sum(["expense", "property_tax"]);
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
    use: USE_OF[p.usage],
    address: { country: "IT", street: p.address, locality: p.city, region: null, postalCode: null, neighbourhood: zoneById(p.zoneId).name, location: null },
    currency: "EUR",
    surfaceSqm: p.sqm,
    rooms: p.rooms || null,
    yearBuilt: p.yearBuilt,
    energyRating: p.energyClass === "—" ? null : p.energyClass,
    ownershipSharePct: 100,
    details: { italy: null },
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
};
