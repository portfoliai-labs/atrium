// services/publicationService.ts
import type {
  CatalogPage, CatalogQuery, PublishStrategyPayload, PublishedStrategy, StrategyReportPayload,
} from "../models/PublishedStrategy";
import type { Report } from "../models/Journal";
import { apiFetch } from "./apiClient";

// The strategies catalog (see models/PublishedStrategy): anyone publishes their strategy
// portfolios (/v1/publications, sent to the network too), everyone reads it and moderates it for
// themselves (hide, report; the author muted at the Journal's /mutes). Errors come back as
// ApiError, with the backend's error_type as errorType.
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

  // GET /v1/explore/strategies/{id} — one, the reader's hidden ones too; 404
  // PublicationNotFoundError. Opening a network strategy nobody here follows starts its
  // recomputation (`recompute` on_open, then running).
  async get(publicationId: string): Promise<PublishedStrategy> {
    return apiFetch<PublishedStrategy>(`/v1/explore/strategies/${publicationId}`);
  },

  // POST /v1/publications — publishes one of the caller's strategy portfolios (thesis required),
  // or sets the thesis of one already published; sent to the network either way.
  async publish(payload: PublishStrategyPayload): Promise<PublishedStrategy> {
    return apiFetch<PublishedStrategy>("/v1/publications", { method: "POST", body: JSON.stringify(payload) });
  },

  // GET /v1/publications — the caller's own, newest first, each with its `networkState`.
  async listMine(): Promise<PublishedStrategy[]> {
    return apiFetch<PublishedStrategy[]>("/v1/publications");
  },

  // DELETE /v1/publications/{id} — withdraws one and asks the network to delete it (deleting its
  // portfolio does too).
  async withdraw(publicationId: string): Promise<void> {
    await apiFetch<{ status: string }>(`/v1/publications/${publicationId}`, { method: "DELETE" });
  },

  // ── The reader's moderation, theirs only. 409 StrategyWithoutAuthorKeyError for a strategy
  // whose author has no key. ──

  // PUT /v1/explore/strategies/{id}/hidden — out of the reader's catalog (its page still opens).
  async hide(publicationId: string): Promise<{ hiddenAt: string }> {
    return apiFetch<{ hiddenAt: string }>(`/v1/explore/strategies/${publicationId}/hidden`, { method: "PUT" });
  },

  // DELETE /v1/explore/strategies/{id}/hidden — back in it; one hidden by followed reports is shown anyway.
  async unhide(publicationId: string): Promise<void> {
    await apiFetch(`/v1/explore/strategies/${publicationId}/hidden`, { method: "DELETE" });
  },

  // POST /v1/explore/strategies/{id}/reports — hidden for the reader at once, and sent to the
  // network as their public report (NIP-56). 422 InvalidFieldError on one's own (`target`).
  async report(publicationId: string, payload: StrategyReportPayload): Promise<Report> {
    return apiFetch<Report>(`/v1/explore/strategies/${publicationId}/reports`, { method: "POST", body: JSON.stringify(payload) });
  },
};
