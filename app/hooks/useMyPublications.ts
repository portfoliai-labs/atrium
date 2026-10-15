// app/hooks/useMyPublications.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { publicationService } from "../services/publicationService";
import { useUser } from "../context/UserContext";
import type { PublishedStrategy } from "../models/PublishedStrategy";

/**
 * An advisor's publications in the strategies catalog (GET /v1/advisor/publications), by the
 * backtest each one is: which of their strategies are in Explore. Empty for anyone else, who
 * can't publish. `reload` after publishing or withdrawing one.
 */
export function useMyPublications() {
  const { user } = useUser();
  const enabled = user?.role === "ADVISOR";
  const [byPortfolio, setByPortfolio] = useState<Map<string, PublishedStrategy> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    publicationService.listMine()
      .then((list) => { if (!cancelled) setByPortfolio(new Map(list.map((p) => [p.portfolioUuid, p]))); })
      .catch(() => { if (!cancelled) setByPortfolio(new Map()); });
    return () => { cancelled = true; };
  }, [enabled, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  // undefined while loading (and for anyone but an advisor, who has none).
  return { publications: enabled ? byPortfolio ?? undefined : new Map<string, PublishedStrategy>(), reload, canPublish: enabled };
}
