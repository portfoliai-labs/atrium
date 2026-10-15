// services/stressTestService.ts
// A portfolio's stress test (see models/StressTest): a simulation, nothing recorded.
import type { StressTest, StressTestRequest } from "../models/StressTest";
import { apiFetch } from "./apiClient";

export const stressTestService = {
  // POST /v1/portfolios/{p}/stress-test — a crisis or custom shocks. 422 without exactly one; 400
  // INVALID_FIELD for a shock to the reference currency, or one given twice.
  async run(portfolioUuid: string, request: StressTestRequest): Promise<StressTest> {
    return apiFetch<StressTest>(`/v1/portfolios/${portfolioUuid}/stress-test`, { method: "POST", body: JSON.stringify(request) });
  },
};
