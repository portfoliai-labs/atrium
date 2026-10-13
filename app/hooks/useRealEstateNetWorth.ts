// hooks/useRealEstateNetWorth.ts
"use client";

import { useMemo } from "react";
import { useRealEstate, useRealEstateOverview, useRealEstateSummary } from "../context/RealEstateContext";
import type { RealEstateOverview } from "../models/RealEstate";

export interface PropertyLine {
  id: string;
  name: string;
  // In the property's own currency: its value at the user's share less the mortgages.
  equity: number;
  currency: string;
  // The same in the user's reference currency, when there's a rate for today.
  reference: { equity: number; currency: string } | null;
  // The mortgages over the value at the user's share; null when it's worth nothing.
  loanToValuePct: number | null;
}

export interface RealEstateNetWorth {
  // Every non-archived property together, in the user's reference currency; null when they can't
  // be added up (an exchange rate missing).
  overview: RealEstateOverview | null;
  // This month's change in the equity (the value less the debt, at month end against the month
  // before's); null while it can't be told.
  monthChange: number | null;
  // Each non-archived property not sold, in list order.
  properties: PropertyLine[];
}

/**
 * REAL ESTATE NET WORTH — the properties as they count in the Dashboard's net worth: their equity
 * (the value at the user's share less the mortgages), added up and one by one, and how it moved this
 * month. null where the real estate can't be shown (an advisor, a backend without it); undefined
 * while loading. A demo account's are the sample data.
 */
export function useRealEstateNetWorth(): RealEstateNetWorth | null | undefined {
  const { properties, loading, available } = useRealEstate();
  const overview = useRealEstateOverview(available);
  const summary = useRealEstateSummary(null, undefined, undefined, available);
  const today = new Date().toISOString().slice(0, 10);

  return useMemo(() => {
    if (!available) return null;
    if (loading || overview === undefined) return undefined;
    const lines: PropertyLine[] = properties
      .filter((p) => !p.archived && !(p.soldOn && p.soldOn <= today))
      .map((p) => ({
        id: p.uuid, name: p.name, equity: p.figures.equity, currency: p.currency,
        reference: p.figures.reference ? { equity: p.figures.reference.equity, currency: p.figures.reference.currency } : null,
        loanToValuePct: p.figures.loanToValuePct,
      }));
    const [prev, last] = summary?.months.slice(-2) ?? [];
    const monthChange = prev && last ? (last.value - last.residualDebt) - (prev.value - prev.residualDebt) : null;
    return { overview, monthChange, properties: lines };
  }, [available, loading, overview, summary, properties, today]);
}
