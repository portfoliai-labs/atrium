// services/assetCategoryService.ts
import type { AssetCategoryCorrection, AssetCategoryEntry } from "../models/AssetCategory";
import { apiFetch } from "./apiClient";

// The user's own, or with a clientUuid an advisor's client's (403 for someone who isn't their
// client): the corrections an advisor makes are still the client's.
const base = (clientUuid?: string) =>
  clientUuid ? `/v1/advisor/clients/${encodeURIComponent(clientUuid)}/asset-categories` : "/v1/asset-categories";

export const assetCategoryService = {
  // GET — the securities held in the user's portfolios (not the backtests), each once, then the
  // corrected ones no longer held.
  async list(clientUuid?: string): Promise<AssetCategoryEntry[]> {
    return apiFetch<AssetCategoryEntry[]>(base(clientUuid));
  },

  // PUT {corrections} — each replaces the asset's correction; answers with the updated list. 422
  // for an asset given twice.
  async correct(corrections: AssetCategoryCorrection[], clientUuid?: string): Promise<AssetCategoryEntry[]> {
    return apiFetch<AssetCategoryEntry[]>(base(clientUuid), {
      method: "PUT",
      body: JSON.stringify({ corrections }),
    });
  },

  // DELETE ?assetId=…&assetId=… — removes the corrections, so the proposal counts again; answers
  // with the updated list. An asset without a correction is skipped.
  async restore(assetIds: string[], clientUuid?: string): Promise<AssetCategoryEntry[]> {
    const query = new URLSearchParams(assetIds.map((id) => ["assetId", id])).toString();
    return apiFetch<AssetCategoryEntry[]>(`${base(clientUuid)}?${query}`, { method: "DELETE" });
  },
};
