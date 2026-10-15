// services/portfoliosService.ts
// The portfolio-IDENTITY endpoints (list/create/rename/delete a Portfolio itself), as opposed
// to portfolioService.ts, which reads the DASHBOARD DATA inside one already-known portfolio.
import type { Portfolio } from "../models/Portfolio";
import type { PortfolioComparisonEntry } from "../models/PortfolioData";
import type { StrategyPortfolioPayload, StrategyResponse } from "../models/Strategy";
import { apiFetch } from "./apiClient";

export const portfoliosService = {
  // GET /v1/portfolios — the caller's own portfolios, default one first.
  async list(): Promise<Portfolio[]> {
    return apiFetch<Portfolio[]>("/v1/portfolios");
  },

  // POST /v1/portfolios {name} — 201. name is trimmed, 1-80 chars; 409 if the caller already
  // has a portfolio with that name.
  async create(name: string): Promise<Portfolio> {
    return apiFetch<Portfolio>("/v1/portfolios", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  // POST /v1/portfolios/strategies {name, strategy} — 201 with a virtual portfolio, still empty:
  // its transactions are generated in the background (see models/Strategy). 422 when the
  // strategy doesn't add up or a security can't be resolved (InvalidFieldError, the target in the
  // detail), 409 if the name is taken; refused for a demo account.
  async createStrategy(payload: StrategyPortfolioPayload): Promise<Portfolio> {
    return apiFetch<Portfolio>("/v1/portfolios/strategies", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // GET /v1/portfolios/{p}/strategy — the strategy a backtest was made from, with the day it
  // started on once it has run; 404 for a portfolio that isn't one.
  async getStrategy(portfolioUuid: string): Promise<StrategyResponse> {
    return apiFetch<StrategyResponse>(`/v1/portfolios/${portfolioUuid}/strategy`);
  },

  // GET /v1/portfolios/comparison?portfolio=…&portfolio=… — side-by-side figures, one entry
  // per portfolio in the order given (without any, all of the caller's, aggregate first). 404
  // if one isn't the caller's. Lives here rather than in portfolioService since it spans
  // several portfolios.
  // With `clientUuid`, an advisor's view of that client's (GET
  // /v1/advisor/clients/{c}/portfolios/comparison, the same answer): the caller's own route only
  // knows the caller's portfolios.
  async compare(portfolioUuids: string[] = [], clientUuid?: string | null): Promise<PortfolioComparisonEntry[]> {
    const query = new URLSearchParams(portfolioUuids.map((uuid) => ["portfolio", uuid])).toString();
    const base = clientUuid ? `/v1/advisor/clients/${clientUuid}/portfolios/comparison` : "/v1/portfolios/comparison";
    return apiFetch<PortfolioComparisonEntry[]>(`${base}${query ? `?${query}` : ""}`);
  },

  // GET /v1/portfolios/{p} — same access rule as every portfolio-scoped route: the caller's
  // own, or one of a client's for their advisor.
  async get(portfolioUuid: string): Promise<Portfolio> {
    return apiFetch<Portfolio>(`/v1/portfolios/${portfolioUuid}`);
  },

  // PATCH /v1/portfolios/{p} {name} — rename.
  async rename(portfolioUuid: string, name: string): Promise<Portfolio> {
    return apiFetch<Portfolio>(`/v1/portfolios/${portfolioUuid}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
  },

  // DELETE /v1/portfolios/{p} — 204; deletes its transactions and all its data. 409 for the
  // default portfolio, which can never be deleted.
  async remove(portfolioUuid: string): Promise<void> {
    return apiFetch<void>(`/v1/portfolios/${portfolioUuid}`, { method: "DELETE" });
  },

  // GET /v1/advisor/clients/{client_uuid}/portfolios — a client's portfolios, default one
  // first. The advisor then reaches each through the same /v1/portfolios/{p}/... paths the
  // client would.
  async listForClient(clientUuid: string): Promise<Portfolio[]> {
    return apiFetch<Portfolio[]>(`/v1/advisor/clients/${clientUuid}/portfolios`);
  },

  // POST /v1/advisor/clients/{client_uuid}/portfolios {name} — a new, empty portfolio for
  // that client.
  async createForClient(clientUuid: string, name: string): Promise<Portfolio> {
    return apiFetch<Portfolio>(`/v1/advisor/clients/${clientUuid}/portfolios`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },
};
