// services/projectionService.ts
// A portfolio's Monte Carlo projection (see models/Projection): nothing recorded.
import type { Projection, ProjectionRequest } from "../models/Projection";
import { apiFetch } from "./apiClient";

export const projectionService = {
  // POST /v1/portfolios/{p}/projection — a goal, survival or safe withdrawal. 422 without exactly
  // one; PROJECTION_HISTORY_TOO_SHORT under 12 months of returns.
  async run(portfolioUuid: string, request: ProjectionRequest): Promise<Projection> {
    return apiFetch<Projection>(`/v1/portfolios/${portfolioUuid}/projection`, { method: "POST", body: JSON.stringify(request) });
  },
};
