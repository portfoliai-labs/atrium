// services/publicationService.ts
import type { CatalogPage, CatalogQuery, PublishStrategyPayload, PublishedStrategy } from "../models/PublishedStrategy";
import { apiFetch } from "./apiClient";

// The strategies catalog (see models/PublishedStrategy). Its authors' routes are advisors only
// (403 AdvisorOnlyError for anyone else); everyone reads it. Errors come back as ApiError, with the
// backend's error_type as errorType.
export const publicationService = {
  // GET /v1/explore/strategies — a page of the catalog. A filter or a figure sort without a
  // horizon is a 422 (InvalidFieldError, `horizon`).
  async list(query: CatalogQuery = {}): Promise<CatalogPage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    return apiFetch<CatalogPage>(`/v1/explore/strategies${qs ? `?${qs}` : ""}`);
  },

  // GET /v1/explore/strategies/{id} — one; 404 PublicationNotFoundError.
  async get(publicationId: string): Promise<PublishedStrategy> {
    return apiFetch<PublishedStrategy>(`/v1/explore/strategies/${publicationId}`);
  },

  // POST /v1/advisor/publications — publishes one of the advisor's strategy portfolios, or sets
  // the description of one already published.
  async publish(payload: PublishStrategyPayload): Promise<PublishedStrategy> {
    return apiFetch<PublishedStrategy>("/v1/advisor/publications", { method: "POST", body: JSON.stringify(payload) });
  },

  // GET /v1/advisor/publications — the advisor's own, newest first.
  async listMine(): Promise<PublishedStrategy[]> {
    return apiFetch<PublishedStrategy[]>("/v1/advisor/publications");
  },

  // DELETE /v1/advisor/publications/{id} — withdraws one (deleting its portfolio does too).
  async withdraw(publicationId: string): Promise<void> {
    await apiFetch<{ status: string }>(`/v1/advisor/publications/${publicationId}`, { method: "DELETE" });
  },
};
