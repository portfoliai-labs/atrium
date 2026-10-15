// lib/taxes.ts
//
// TAXES — what the taxes' pages (see components/dashboard/taxes) and the settings that feed them
// share: the disclaimer the backend leaves to us, how a regime's categories read, the countries
// a tax residence can be.

import type { CostMethod, IncomeKind, TaxCategory, TaxationMode } from "../models/Tax";

// Every taxes page says it: the figures are estimates on what's recorded, and what they leave out.
export const TAX_DISCLAIMER =
  "Estimates based on the transactions you recorded: check them with your tax advisor before filing. Not included: the credit for taxes withheld abroad, refunds under tax treaties, staking and airdrops.";

// Italy's categories (the only regime so far); another regime's read as sent.
const CATEGORY_LABELS: Record<string, { label: string; detail: string }> = {
  redditi_diversi: { label: "Capital gains", detail: "Redditi diversi" },
  redditi_diversi_titoli_pubblici: { label: "Government bonds", detail: "Redditi diversi · titoli di Stato" },
  redditi_di_capitale: { label: "ETFs and funds", detail: "Redditi di capitale" },
  cripto_attivita: { label: "Crypto-assets", detail: "Cripto-attività" },
  dividendi: { label: "Dividends", detail: "Dividendi" },
  proventi_oicr: { label: "ETF and fund income", detail: "Proventi OICR" },
  interessi: { label: "Interest", detail: "Interessi" },
  interessi_titoli_pubblici: { label: "Government bond interest", detail: "Interessi · titoli di Stato" },
};

export const INCOME_KIND_LABELS: Record<IncomeKind, string> = {
  dividend: "Dividend",
  coupon: "Coupon",
  accrued_interest: "Accrued interest on sale",
  cash_interest: "Cash interest",
};

export const categoryLabel = (category: TaxCategory | null | undefined) =>
  category ? CATEGORY_LABELS[category]?.label ?? category.replace(/_/g, " ") : "Not classified";

export const categoryDetail = (category: TaxCategory | null | undefined) =>
  category ? CATEGORY_LABELS[category]?.detail : undefined;

export const TAXATION_MODE_LABELS: Record<TaxationMode, { label: string; detail: string }> = {
  declared: { label: "Declared by you", detail: "You declare its gains in your tax return (regime dichiarativo)" },
  withheld: { label: "Withheld by the broker", detail: "Its broker withholds the taxes as they come (regime amministrato)" },
};

export const COST_METHOD_LABELS: Record<CostMethod, string> = {
  average_cost: "Average cost",
  fifo: "FIFO",
};

// The countries offered as a tax residence: Italy first (the only one whose taxes are computed for
// now), then its neighbours and where Italians most often live abroad.
const RESIDENCE_CODES = ["IT", "AT", "BE", "CH", "DE", "ES", "FR", "GB", "IE", "LU", "MC", "NL", "PT", "SM", "US"];
// The countries the backend has a tax regime for.
export const TAX_REGIME_COUNTRIES = ["IT"];

export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The residences to pick from, by name; one already set but not listed is kept among them. */
export function residenceOptions(current?: string | null) {
  const codes = current && !RESIDENCE_CODES.includes(current) ? [...RESIDENCE_CODES, current] : RESIDENCE_CODES;
  const [first, ...rest] = codes;
  return [first, ...rest.sort((a, b) => countryName(a).localeCompare(countryName(b)))].map((code) => ({ code, label: countryName(code) }));
}

// The calendar years a taxes page offers: this one back to 2015, the earliest a loss carried
// forward four years could still reach into today's.
export function taxYears(now = new Date()): number[] {
  const current = now.getFullYear();
  return Array.from({ length: current - 2015 + 1 }, (_, i) => current - i);
}

export const ratePct = (rate: number) => `${(rate * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
