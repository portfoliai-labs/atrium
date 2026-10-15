// services/manualAssetService.ts
// The user's manual assets (see models/ManualAsset). Listing and creating take a clientUuid for an
// advisor's client's (403 NotYourClientError for someone who isn't theirs); everything else goes
// by the asset's uuid alone (404 ManualAssetNotFoundError for one that isn't there).
import type { ManualAsset, ManualAssetCreate, ManualAssetUpdate, ManualValuation } from "../models/ManualAsset";
import { apiFetch } from "./apiClient";

const collection = (clientUuid?: string | null) =>
  clientUuid ? `/v1/advisor/clients/${encodeURIComponent(clientUuid)}/manual-assets` : "/v1/manual-assets";
const one = (uuid: string) => `/v1/manual-assets/${encodeURIComponent(uuid)}`;

export const manualAssetService = {
  async list(clientUuid?: string | null): Promise<ManualAsset[]> {
    return apiFetch<ManualAsset[]>(collection(clientUuid));
  },

  async create(payload: ManualAssetCreate, clientUuid?: string | null): Promise<ManualAsset> {
    return apiFetch<ManualAsset>(collection(clientUuid), { method: "POST", body: JSON.stringify(payload) });
  },

  // The currency can't change.
  async update(uuid: string, payload: ManualAssetUpdate): Promise<ManualAsset> {
    return apiFetch<ManualAsset>(one(uuid), { method: "PATCH", body: JSON.stringify(payload) });
  },

  // 409 ManualAssetInUseError while a transaction is on it.
  async remove(uuid: string): Promise<void> {
    await apiFetch<{ status: string }>(one(uuid), { method: "DELETE" });
  },

  // By day, oldest first.
  async valuations(uuid: string): Promise<ManualValuation[]> {
    return apiFetch<ManualValuation[]>(`${one(uuid)}/valuations`);
  },

  // Sets these days' valuations (at most 1000; no day twice, none in the future: 422), answering
  // with the whole list. The portfolios holding it are computed again.
  async setValuations(uuid: string, valuations: { valuedOn: string; price: number | string }[]): Promise<ManualValuation[]> {
    return apiFetch<ManualValuation[]>(`${one(uuid)}/valuations`, { method: "PUT", body: JSON.stringify({ valuations }) });
  },

  async removeValuations(uuid: string, days: string[]): Promise<ManualValuation[]> {
    const query = new URLSearchParams(days.map((d) => ["day", d])).toString();
    return apiFetch<ManualValuation[]>(`${one(uuid)}/valuations?${query}`, { method: "DELETE" });
  },
};
