// services/portfolioService.ts
import type { PortfolioOverview } from "../models/Portfolio";
import { apiFetch } from "./apiClient";

export const portfolioService = {
  // GET /v1/portfolio/ — advisors pass for_user_uuid to fetch a client's portfolio.
  // date_from/date_to default server-side to the last 90 days and scope only the snapshots
  // returned, not the transaction-derived summary (which always covers full history).
  async getPortfolioOverview(forUserUuid?: string | null): Promise<PortfolioOverview> {
    const query = forUserUuid ? `?for_user_uuid=${encodeURIComponent(forUserUuid)}` : '';
    return apiFetch<PortfolioOverview>(`/v1/portfolio/${query}`);
  },
};
