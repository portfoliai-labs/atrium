// services/adoptionService.ts
import type { AdoptStrategyPayload, AdoptedStrategy, SharedStrategy, StrategyAllocation } from "../models/AdoptedStrategy";
import { ApiError, apiFetch } from "./apiClient";

const path = (portfolioUuid: string) => `/v1/portfolios/${portfolioUuid}/adopted-strategy`;

// A strategy adopted on a portfolio (see models/AdoptedStrategy), `portfolioUuid` being the one
// that adopts it. Errors come back as ApiError, with the backend's error_type as errorType.
export const adoptionService = {
  // POST — adopts a backtest's strategy, replacing the adoption already there. 404
  // BacktestNotFoundError when the origin isn't a backtest; 409 VirtualPortfolioOperationError
  // when the portfolio is one; 422 InvalidFieldError (`strategy.targets.<i>`) when, inCategories,
  // a security has no category.
  async adopt(portfolioUuid: string, payload: AdoptStrategyPayload): Promise<AdoptedStrategy> {
    return apiFetch<AdoptedStrategy>(path(portfolioUuid), { method: "POST", body: JSON.stringify(payload) });
  },

  // GET — the portfolio's adoption, or null when there's none (404 AdoptionNotFoundError).
  async get(portfolioUuid: string): Promise<AdoptedStrategy | null> {
    try {
      return await apiFetch<AdoptedStrategy>(path(portfolioUuid));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },

  // PUT — refines its targets and rebalancing band; its rules follow. A security target is sent as
  // its ticker and isin, as when the strategy was made.
  async refine(portfolioUuid: string, allocation: StrategyAllocation): Promise<AdoptedStrategy> {
    const targets = allocation.targets.map((t) =>
      t.kind === "asset" ? { ...t, asset: { ticker: t.asset.ticker, isin: t.asset.isin } } : t);
    return apiFetch<AdoptedStrategy>(path(portfolioUuid), {
      method: "PUT",
      body: JSON.stringify({ targets, rebalancing: allocation.rebalancing }),
    });
  },

  // DELETE — the adoption, with its rules.
  async remove(portfolioUuid: string): Promise<void> {
    await apiFetch<{ status: string }>(path(portfolioUuid), { method: "DELETE" });
  },

  // PUT .../sharing — an advisor shares their adoption on a client's portfolio with the client, or
  // stops; the client is notified (STRATEGY_SHARED) each time it starts being shared. 409
  // AdoptionNotShareableError on the owner's own, 404 AdoptionNotFoundError without one.
  async setShared(portfolioUuid: string, shared: boolean): Promise<AdoptedStrategy> {
    return apiFetch<AdoptedStrategy>(`${path(portfolioUuid)}/sharing`, { method: "PUT", body: JSON.stringify({ shared }) });
  },

  // GET /v1/portfolios/shared-strategies, or /v1/portfolios/{p}/shared-strategies for one
  // portfolio — what the caller's advisors shared with them, newest shared first.
  async listShared(portfolioUuid?: string): Promise<SharedStrategy[]> {
    return apiFetch<SharedStrategy[]>(portfolioUuid ? `/v1/portfolios/${portfolioUuid}/shared-strategies` : "/v1/portfolios/shared-strategies");
  },
};
