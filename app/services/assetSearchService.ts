// services/assetSearchService.ts
import type { AssetSearchResult } from "../models/AssetSearch";
import { apiFetch } from "./apiClient";

export const ASSET_SEARCH_MIN_LENGTH = 2;
const ASSET_SEARCH_MAX_LENGTH = 100;

export const assetSearchService = {
  // GET /v1/asset-search?q= — at most 10 securities the backend can price, matching an ISIN (all
  // its listings), a ticker with its suffix (VWCE.DE, AAPL, BTC-EUR), a bare ticker (VWCE: its
  // listings on every market) or a name. An empty list when nothing matches. A query shorter than
  // 2 characters is a 422, so it's answered here with no results instead of being sent.
  async search(query: string, signal?: AbortSignal): Promise<AssetSearchResult[]> {
    const q = query.trim().slice(0, ASSET_SEARCH_MAX_LENGTH);
    if (q.length < ASSET_SEARCH_MIN_LENGTH) return [];
    return apiFetch<AssetSearchResult[]>(`/v1/asset-search?q=${encodeURIComponent(q)}`, { signal });
  },
};
