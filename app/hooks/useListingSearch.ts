// hooks/useListingSearch.ts
import { useEffect, useRef, useState } from "react";
import type { Listing } from "../models/Listing";
import { LISTING_SEARCH_MIN_LENGTH, listingService } from "../services/listingService";

const SEARCH_DEBOUNCE_MS = 300;

export type ListingSearchStatus = "idle" | "loading" | "done" | "error";

/**
 * census' listings matching `query` (GET /v1/listings), searched once the typing pauses: what the
 * AssetPicker and the top bar's search list. A newer query cancels the pending search and drops
 * any answer still on its way; an answer is only ever shown for the query it was for.
 * `onResults` hears each answer as it lands (the picker highlights its first row with it).
 */
export function useListingSearch(query: string, onResults?: (found: Listing[]) => void) {
  const q = query.trim();
  const searchable = q.length >= LISTING_SEARCH_MIN_LENGTH;
  const [answer, setAnswer] = useState<{ forQuery: string; results: Listing[]; error: string | null } | null>(null);
  const onResultsRef = useRef(onResults);
  useEffect(() => {
    onResultsRef.current = onResults;
  }, [onResults]);

  useEffect(() => {
    if (!searchable) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const found = await listingService.search(q, controller.signal);
        if (controller.signal.aborted) return;
        setAnswer({ forQuery: q, results: found, error: null });
        onResultsRef.current?.(found);
      } catch (err) {
        if (controller.signal.aborted) return;
        setAnswer({ forQuery: q, results: [], error: err instanceof Error ? err.message : "Search failed." });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, searchable]);

  const current = searchable && answer?.forQuery === q ? answer : null;
  const status: ListingSearchStatus = !searchable ? "idle" : !current ? "loading" : current.error ? "error" : "done";
  return { searchable, status, results: current?.results ?? [], error: current?.error ?? null };
}
