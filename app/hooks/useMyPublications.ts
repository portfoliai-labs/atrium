// app/hooks/useMyPublications.ts
"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { publicationService } from "../services/publicationService";
import { useUser } from "../context/UserContext";
import { investmentsKey, useInvestmentsRead } from "../context/PortfolioContext";
import type { PublishedStrategy } from "../models/PublishedStrategy";

/**
 * An advisor's publications in the strategies catalog (GET /v1/advisor/publications), by the
 * backtest each one is: which of their strategies are in Explore. Empty for anyone else, who
 * can't publish. `reload` after publishing or withdrawing one: the catalog is read again too.
 */
export function useMyPublications() {
  const { user } = useUser();
  const enabled = user?.role === "ADVISOR";
  const queryClient = useQueryClient();
  const list = useInvestmentsRead(["publications", "mine"], () => publicationService.listMine(), enabled);
  const byPortfolio = useMemo(
    () => (list === undefined ? undefined : new Map((list ?? []).map((p) => [p.portfolioUuid, p]))),
    [list],
  );

  const reload = useCallback(() => { void queryClient.invalidateQueries({ queryKey: investmentsKey("publications") }); }, [queryClient]);
  // undefined while loading (and for anyone but an advisor, who has none).
  return { publications: enabled ? byPortfolio : NONE, reload, canPublish: enabled };
}

const NONE = new Map<string, PublishedStrategy>();
