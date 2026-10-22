// app/hooks/useClientPortfolios.ts
"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { investmentsKey, useInvestmentsQuery } from "../context/PortfolioContext";
import { portfoliosService } from "../services/portfoliosService";
import { isBacktest, type Portfolio } from "../models/Portfolio";

const NO_PORTFOLIOS: Portfolio[] = [];

/**
 * A client's portfolios, for an advisor (GET /v1/advisor/clients/{c}/portfolios): All portfolios
 * first, then the default, then the others, without the client's own backtests. Empty for no
 * client. For pages that only list them (the Sidebar's rows, adopting a strategy); a client's own
 * pages get them from a PortfolioProvider of theirs, which reads the same list under the same key
 * (["investments", "portfolios", client]): one request for both.
 */
export function useClientPortfolios(clientUuid: string | null) {
  const queryClient = useQueryClient();
  const list = useInvestmentsQuery(
    ["portfolios", clientUuid],
    async () => (await portfoliosService.listForClient(clientUuid!)).filter((p) => !isBacktest(p)),
    { enabled: Boolean(clientUuid) },
  );

  const reload = useCallback(() => {
    if (clientUuid) void queryClient.invalidateQueries({ queryKey: investmentsKey("portfolios", clientUuid) });
  }, [queryClient, clientUuid]);
  return {
    portfolios: clientUuid ? list.data ?? NO_PORTFOLIOS : NO_PORTFOLIOS,
    loading: Boolean(clientUuid) && list.isPending,
    error: list.error ? list.error.message || "Unable to load this client's portfolios." : null,
    reload,
  };
}
