// app/hooks/useTaxes.ts
"use client";

import { useQuery, type Query, type QueryClient } from "@tanstack/react-query";
import { investmentsKey, useInvestmentsQuery, usePortfolio } from "../context/PortfolioContext";
import { taxService } from "../services/taxService";
import { FIRST_TAX_YEAR } from "../lib/taxes";
import type { CostMethod, RealizedGains, TaxYear } from "../models/Tax";

/**
 * The investments' taxes, in the query cache under ["investments", "taxes", client, ...]: a year
 * read by the Taxes page, Profit & Loss's taxes by year and a portfolio's year is one request. The
 * user's own (`client` null), or an advisor's client's, whose pages these are.
 */
const taxesKey = (clientUuid: string | null, ...parts: unknown[]) => ["taxes", clientUuid ?? "own", ...parts];

const yearQuery = (clientUuid: string | null, year: number) => ({
  queryKey: investmentsKey(...taxesKey(clientUuid, "year", year)),
  queryFn: () => taxService.year(year, clientUuid),
});

/** A calendar year's estimated taxes (GET /v1/taxes/{year}). */
export function useTaxYear(year: number) {
  const clientUuid = usePortfolio().client?.uuid ?? null;
  return useInvestmentsQuery(taxesKey(clientUuid, "year", year), () => taxService.year(year, clientUuid));
}

/** A calendar year's dividends and interest, as taxed. */
export function useTaxIncome(year: number) {
  const clientUuid = usePortfolio().client?.uuid ?? null;
  return useInvestmentsQuery(taxesKey(clientUuid, "income", year), () => taxService.income(year, clientUuid));
}

/**
 * A calendar year's sales and what they made, by `method` (null: the regime's own). With
 * `keepPrevious`, another method's of the same year stay up while this one's load.
 */
export function useRealizedGains(year: number, method: CostMethod | null, { enabled = true, keepPrevious = false } = {}) {
  const clientUuid = usePortfolio().client?.uuid ?? null;
  const queryKey = investmentsKey(...taxesKey(clientUuid, "gains", year, method));
  return useQuery({
    queryKey,
    queryFn: () => taxService.realizedGains(year, method, clientUuid),
    enabled,
    placeholderData: keepPrevious
      ? (previous: RealizedGains | undefined, previousQuery?: Query<RealizedGains>) =>
        previousQuery?.queryKey[queryKey.length - 2] === year ? previous : undefined
      : undefined,
  });
}

/**
 * Every year's taxes since the first transaction (no earlier than the Taxes page's first year),
 * in one call; each also goes in the cache as its year's, for the Taxes page (see TaxesByYearPanel).
 */
export async function fetchTaxYears(queryClient: QueryClient, clientUuid: string | null): Promise<TaxYear[]> {
  const years = await taxService.years(FIRST_TAX_YEAR, clientUuid);
  for (const year of years) queryClient.setQueryData(yearQuery(clientUuid, year.year).queryKey, year);
  return years;
}

/** Profit & Loss's taxes by year's key (see TaxesByYearPanel). */
export const taxYearsKey = (clientUuid: string | null) => taxesKey(clientUuid, "years");
