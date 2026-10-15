// services/listingService.ts
import type { Listing } from "../models/Listing";
import { apiFetch } from "./apiClient";

export const LISTING_SEARCH_MIN_LENGTH = 2;
const LISTING_SEARCH_MAX_LENGTH = 100;

export const listingService = {
  // GET /v1/listings?q= — at most 10 of census' listings matching an ISIN (all its listings), a
  // listing's ticker (VWCE: its listings on every market) or a name. An empty list when nothing
  // matches. A query shorter than 2 characters is a 422, so it's answered here with no results
  // instead of being sent. Listings no provider prices are left out: nothing could be done with them.
  async search(query: string, signal?: AbortSignal): Promise<Listing[]> {
    const q = query.trim().slice(0, LISTING_SEARCH_MAX_LENGTH);
    if (q.length < LISTING_SEARCH_MIN_LENGTH) return [];
    const found = await apiFetch<Listing[]>(`/v1/listings?q=${encodeURIComponent(q)}`, { signal });
    return found.filter((l) => l.priced !== false);
  },
};
