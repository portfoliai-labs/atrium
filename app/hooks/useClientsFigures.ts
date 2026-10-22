// app/hooks/useClientsFigures.ts
"use client";

import { useCallback } from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { investmentsKey } from "../context/PortfolioContext";
import { portfoliosService } from "../services/portfoliosService";
import type { Client } from "../models/Advisor";
import type { PortfolioComparisonEntry } from "../models/PortfolioData";

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
 * read, or who has none yet, is missing from the map. Each client's comparison is in the query
 * cache under ["investments", "comparison", client, "all"], read again with the investments'
 * `changed()` (a transaction on their portfolios), and shared by the Dashboard and the Clients list.
 */
export function useClientsFigures(clients: Client[]): Map<string, ClientFigures> | undefined {
  const key = clients.map((c) => c.uuid).join(",");
  const combine = useCallback((results: UseQueryResult<PortfolioComparisonEntry[]>[]) => {
    if (results.some((r) => r.isPending)) return undefined;
    const uuids = key ? key.split(",") : [];
    const byUuid = new Map<string, ClientFigures>();
    results.forEach((r, i) => {
      if (!r.data) return;
      const real = r.data.filter((e) => !e.portfolio.isVirtual);
      const investments = r.data.find((e) => e.portfolio.isAggregate) ?? real.find((e) => e.portfolio.isDefault) ?? real[0];
      if (!investments?.value) return;
      byUuid.set(uuids[i], {
        marketValue: investments.value.marketValue,
        currency: investments.value.currency,
        totalReturnPct: investments.performance?.totalReturnPct ?? null,
        portfolios: real.length,
      });
    });
    return byUuid;
  }, [key]);

  return useQueries({
    queries: clients.map((c) => ({
      queryKey: investmentsKey("comparison", c.uuid, "all"),
      queryFn: () => portfoliosService.compare([], c.uuid),
    })),
    combine,
  });
}

/** What the clients' investments add up to, one total per currency, largest first. */
export function totalsByCurrency(figures: Map<string, ClientFigures>): { currency: string; value: number }[] {
  const sums = new Map<string, number>();
  for (const f of figures.values()) sums.set(f.currency, (sums.get(f.currency) ?? 0) + f.marketValue);
  return [...sums.entries()].map(([currency, value]) => ({ currency, value })).sort((a, b) => b.value - a.value);
}
