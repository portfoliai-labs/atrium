// app/hooks/useAlertRules.ts
"use client";

import type { SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { investmentsKey, useInvestmentsQuery } from "../context/PortfolioContext";
import { alertService } from "../services/alertService";
import type { AlertRuleResponse, ClientAlertRuleResponse, OwnAlertRuleResponse } from "../models/Alert";

/**
 * A list of alert rules, in the query cache under ["investments", "alertRules", ...key] (shared
 * by the modules showing the same list). `rules` is null until the first load. With `pollMs` the
 * list is read again on that interval while the tab is visible, since the backend re-checks every
 * rule about every 5 minutes and a reading changes underneath the page; a failed read again keeps
 * the rules already shown. `setRules` lets callers apply the result of a create / update / delete
 * directly, without another round trip (the other lists of rules are read again).
 */
function useRuleList<T>(fetchRules: () => Promise<T[]>, key: unknown[], pollMs?: number) {
  const queryClient = useQueryClient();
  const queryKey = investmentsKey("alertRules", ...key);
  const query = useInvestmentsQuery(["alertRules", ...key], fetchRules, { pollMs });
  const hash = JSON.stringify(queryKey);

  const setRules = (next: SetStateAction<T[] | null>) => {
    queryClient.setQueryData<T[]>(queryKey, (prev) => (typeof next === "function" ? next(prev ?? null) : next) ?? undefined);
    void queryClient.invalidateQueries({ queryKey: investmentsKey("alertRules"), predicate: (q) => JSON.stringify(q.queryKey) !== hash });
  };
  const reload = () => { void queryClient.invalidateQueries({ queryKey: investmentsKey("alertRules") }); };
  // Loading too while a list that failed is asked for again.
  const loading = query.data === undefined && (query.isPending || query.isFetching);

  return {
    rules: query.data ?? null,
    setRules,
    loading,
    error: !loading && query.isError && query.data === undefined ? query.error.message || "Failed to load the alerts" : null,
    reload,
  };
}

/**
 * The rules on one portfolio — the caller's own, or (for an advisor) a client's. `portfolioUuid`
 * is required now that every portfolio-scoped route needs one explicitly (no more implicit
 * "self" via an omitted for_user_uuid).
 */
export function useAlertRules(portfolioUuid: string, pollMs?: number) {
  return useRuleList<AlertRuleResponse>(() => alertService.listRules(portfolioUuid), [portfolioUuid], pollMs);
}

/** Advisors only: every rule they put on any of their clients, each with its clientUuid. */
export function useClientAlertRules(pollMs?: number) {
  return useRuleList<ClientAlertRuleResponse>(() => alertService.listClientRules(), ["clients"], pollMs);
}

/** The caller's own rules on every portfolio they own, in one call (the investor's Dashboard). */
export function useOwnAlertRules(pollMs?: number) {
  return useRuleList<OwnAlertRuleResponse>(() => alertService.listOwnRules(), ["own"], pollMs);
}

/** A rule plus the portfolio it's on, for lists that span several portfolios. */
export type PortfolioAlertRule = AlertRuleResponse & { portfolioUuid: string };

/**
 * The rules on every one of the given portfolios (the investor's own, aggregate included),
 * backend order within each portfolio. One portfolio failing to load doesn't hide the others'
 * rules; only all of them failing counts as an error.
 */
export function usePortfoliosAlertRules(portfolioUuids: string[], pollMs?: number) {
  return useRuleList<PortfolioAlertRule>(async () => {
    const results = await Promise.allSettled(
      portfolioUuids.map(async (portfolioUuid) =>
        (await alertService.listRules(portfolioUuid)).map((rule) => ({ ...rule, portfolioUuid })),
      ),
    );
    const loaded = results.filter((r) => r.status === "fulfilled");
    if (loaded.length === 0 && results.length > 0) throw (results[0] as PromiseRejectedResult).reason;
    return loaded.flatMap((r) => r.value);
  }, ["portfolios", ...portfolioUuids], pollMs);
}
