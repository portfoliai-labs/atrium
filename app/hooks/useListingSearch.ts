// hooks/useListingSearch.ts
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { investmentsKey } from "../context/PortfolioContext";
import type { Listing } from "../models/Listing";
import { LISTING_SEARCH_MIN_LENGTH, listingService } from "../services/listingService";

const SEARCH_DEBOUNCE_MS = 300;

export type ListingSearchStatus = "idle" | "loading" | "done" | "error";

/**
 * census' listings matching `query` (GET /v1/listings), searched once the typing pauses: what the
 * AssetPicker and the top bar's search list. A newer query cancels the pending search; an answer
 * is only ever shown for the query it was for.
 * `onResults` hears each answer as it lands (the picker highlights its first row with it).
 */
export function useListingSearch(query: string, onResults?: (found: Listing[]) => void) {
  const q = query.trim();
  const searchable = q.length >= LISTING_SEARCH_MIN_LENGTH;
  // The query once the typing pauses.
  const [settled, setSettled] = useState(q);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);
  // Through the query cache (the same text searched again is answered at once); a search no longer
  // asked for is cancelled.
  const answer = useQuery({
    queryKey: investmentsKey("listings", settled),
    queryFn: ({ signal }) => listingService.search(settled, signal),
    enabled: searchable && settled === q,
  });

  const onResultsRef = useRef(onResults);
  useEffect(() => {
    onResultsRef.current = onResults;
  }, [onResults]);
  const found = searchable && settled === q ? answer.data : undefined;
  useEffect(() => {
    if (found) onResultsRef.current?.(found);
  }, [found]);

  const current = searchable && settled === q && !answer.isPending;
  const error = current && answer.isError ? (answer.error instanceof Error ? answer.error.message : "Search failed.") : null;
  const status: ListingSearchStatus = !searchable ? "idle" : !current ? "loading" : error ? "error" : "done";
  return { searchable, status, results: current && !error ? answer.data ?? [] : [], error };
}
