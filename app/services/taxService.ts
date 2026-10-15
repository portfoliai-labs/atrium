// services/taxService.ts
// The user's taxes on their investments (see models/Tax). With `clientUuid`, an advisor's view of
// that client's (the same answers; 403 for someone who isn't their client).
import type { CostMethod, RealizedGains, TaxYear } from "../models/Tax";
import { apiFetch } from "./apiClient";

const base = (clientUuid?: string | null) => (clientUuid ? `/v1/advisor/clients/${clientUuid}/taxes` : "/v1/taxes");

export const taxService = {
  // GET /v1/taxes/realized-gains?year=&method= — the year's disposals. Without a method, the tax
  // regime's.
  async realizedGains(year: number, method?: CostMethod | null, clientUuid?: string | null): Promise<RealizedGains> {
    const query = new URLSearchParams({ year: String(year), ...(method ? { method } : {}) });
    return apiFetch<RealizedGains>(`${base(clientUuid)}/realized-gains?${query}`);
  },

  // GET /v1/taxes/years/{year} — 409 TaxRegimeUnavailableError without a tax residence or a
  // regime for it.
  async year(year: number, clientUuid?: string | null): Promise<TaxYear> {
    return apiFetch<TaxYear>(`${base(clientUuid)}/years/${year}`);
  },
};
