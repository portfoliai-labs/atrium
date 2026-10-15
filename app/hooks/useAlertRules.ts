// app/hooks/useAlertRules.ts
"use client";

import { useEffect, useState } from "react";
import { alertService } from "../services/alertService";
import type { AlertRuleResponse, ClientAlertRuleResponse } from "../models/Alert";

/**
 * A list of alert rules. `rules` is null until the first load. With `pollMs` the list is
 * refetched on that interval while the tab is visible, since the backend re-checks every rule
 * about every 5 minutes and a reading changes underneath the page; a failed refetch keeps the
 * rules already shown. `setRules` lets callers apply the result of a create / update / delete
 * directly, without another round trip.
 */
function useRuleList<T>(fetchRules: () => Promise<T[]>, key: string, pollMs?: number) {
  const [rules, setRules] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async (initial: boolean) => {
      try {
        const data = await fetchRules();
        if (!cancelled) {
          setRules(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled && initial) setError(err instanceof Error ? err.message : "Failed to load the alerts");
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    };

    load(true);
    const id = pollMs ? setInterval(() => { if (!document.hidden) load(false); }, pollMs) : undefined;
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
    // `key` stands for fetchRules, which callers create on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs, reloadKey, key]);

  const reload = () => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  };

  return { rules, setRules, loading, error, reload };
}

/**
 * The rules on one portfolio — the caller's own, or (for an advisor) a client's. `portfolioUuid`
 * is required now that every portfolio-scoped route needs one explicitly (no more implicit
 * "self" via an omitted for_user_uuid).
 */
export function useAlertRules(portfolioUuid: string, pollMs?: number) {
  return useRuleList<AlertRuleResponse>(() => alertService.listRules(portfolioUuid), portfolioUuid, pollMs);
}

/** Advisors only: every rule they put on any of their clients, each with its clientUuid. */
export function useClientAlertRules(pollMs?: number) {
  return useRuleList<ClientAlertRuleResponse>(() => alertService.listClientRules(), "clients", pollMs);
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
  }, portfolioUuids.join(","), pollMs);
}
