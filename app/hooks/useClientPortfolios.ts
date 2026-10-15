// app/hooks/useClientPortfolios.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { portfoliosService } from "../services/portfoliosService";
import { isBacktest, type Portfolio } from "../models/Portfolio";

/**
 * A client's portfolios, for an advisor (GET /v1/advisor/clients/{c}/portfolios): All portfolios
 * first, then the default, then the others, without the client's own backtests. Empty for no
 * client. For pages that only list them (the Sidebar's rows, adopting a strategy); a client's own
 * pages get them from a PortfolioProvider of theirs.
 */
export function useClientPortfolios(clientUuid: string | null) {
  const [state, setState] = useState<{ uuid: string; portfolios: Portfolio[]; error: string | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!clientUuid) return;
    let cancelled = false;
    portfoliosService.listForClient(clientUuid)
      .then((list) => { if (!cancelled) setState({ uuid: clientUuid, portfolios: list.filter((p) => !isBacktest(p)), error: null }); })
      .catch((err) => {
        if (!cancelled) setState({ uuid: clientUuid, portfolios: [], error: err instanceof Error ? err.message : "Unable to load this client's portfolios." });
      });
    return () => { cancelled = true; };
  }, [clientUuid, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const current = clientUuid && state?.uuid === clientUuid ? state : null;
  return {
    portfolios: current?.portfolios ?? [],
    loading: Boolean(clientUuid) && current === null,
    error: current?.error ?? null,
    reload,
  };
}
