// app/hooks/useMyPublications.ts
"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { publicationService } from "../services/publicationService";
import { useUser } from "../context/UserContext";
import { investmentsKey, useInvestmentsRead, usePortfolio } from "../context/PortfolioContext";
import type { PublishedStrategy } from "../models/PublishedStrategy";

/**
 * The user's publications in the strategies catalog (GET /v1/publications), by the backtest each
 * one is: which of their strategies are published, and where each stands on the network
 * (`networkState`). Anyone publishes their own; nobody publishes from a client's pages (an
 * advisor reading them), where this is empty. `reload` after publishing or withdrawing one: the
 * catalog is read again too. `isAdvisor`: an advisor adopts their strategies on a client.
 */
export function useMyPublications() {
  const { user } = useUser();
  const { client } = usePortfolio();
  const enabled = !!user && !client;
  const queryClient = useQueryClient();
  const list = useInvestmentsRead(["publications", "mine"], () => publicationService.listMine(), enabled);
  const byPortfolio = useMemo(
    () => (list === undefined
      ? undefined
      : new Map((list ?? []).flatMap((p) => (p.portfolioUuid ? [[p.portfolioUuid, p] as const] : [])))),
    [list],
  );

  const reload = useCallback(() => { void queryClient.invalidateQueries({ queryKey: investmentsKey("publications") }); }, [queryClient]);
  // undefined while loading (and empty where nothing can be published).
  return { publications: enabled ? byPortfolio : NONE, reload, canPublish: enabled, isAdvisor: user?.role === "ADVISOR" };
}

const NONE = new Map<string, PublishedStrategy>();
