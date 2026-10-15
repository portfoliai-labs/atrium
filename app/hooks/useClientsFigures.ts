// app/hooks/useClientsFigures.ts
"use client";

import { useEffect, useState } from "react";
import { portfoliosService } from "../services/portfoliosService";
import type { Client } from "../models/Advisor";

/** A client's investments at a glance: what they're worth, in what, and how they've done. */
export interface ClientFigures {
  marketValue: number;
  currency: string;
  // Since the start, as on their Insights; null until computed.
  totalReturnPct: number | null;
  portfolios: number;
}

/**
 * Each client's investments' figures, from their side-by-side comparison (GET
 * /v1/advisor/clients/{c}/portfolios/comparison): All portfolios' while they have two or more,
 * otherwise their only portfolio's. undefined while loading; a client whose figures couldn't be
 * read, or who has none yet, is missing from the map.
 */
export function useClientsFigures(clients: Client[]): Map<string, ClientFigures> | undefined {
  const key = clients.map((c) => c.uuid).join(",");
  const [state, setState] = useState<{ key: string; byUuid: Map<string, ClientFigures> } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const uuids = key.split(",");
    Promise.allSettled(uuids.map((uuid) => portfoliosService.compare([], uuid))).then((results) => {
      if (cancelled) return;
      const byUuid = new Map<string, ClientFigures>();
      results.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const real = r.value.filter((e) => !e.portfolio.isVirtual);
        const investments = r.value.find((e) => e.portfolio.isAggregate) ?? real.find((e) => e.portfolio.isDefault) ?? real[0];
        if (!investments?.value) return;
        byUuid.set(uuids[i], {
          marketValue: investments.value.marketValue,
          currency: investments.value.currency,
          totalReturnPct: investments.performance?.totalReturnPct ?? null,
          portfolios: real.length,
        });
      });
      setState({ key, byUuid });
    });
    return () => { cancelled = true; };
  }, [key]);

  if (!key) return new Map();
  return state?.key === key ? state.byUuid : undefined;
}

/** What the clients' investments add up to, one total per currency, largest first. */
export function totalsByCurrency(figures: Map<string, ClientFigures>): { currency: string; value: number }[] {
  const sums = new Map<string, number>();
  for (const f of figures.values()) sums.set(f.currency, (sums.get(f.currency) ?? 0) + f.marketValue);
  return [...sums.entries()].map(([currency, value]) => ({ currency, value })).sort((a, b) => b.value - a.value);
}
