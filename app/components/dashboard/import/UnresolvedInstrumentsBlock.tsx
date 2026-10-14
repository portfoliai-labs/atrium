"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { InstrumentOverridePayload, UnresolvedInstrumentResponse } from "../../../models/Import";
import type { Listing } from "../../../models/Listing";
import { AssetPicker } from "../AssetPicker";

interface UnresolvedInstrumentsBlockProps {
  unresolved: UnresolvedInstrumentResponse[];
  onRecommit: (overrides: Record<string, InstrumentOverridePayload>) => void;
  submitting: boolean;
}

// The listing chosen for a raw identifier: one of its candidates, or one found with the search.
type Draft = { kind: "candidate"; index: number; listingId: string } | { kind: "search"; listing: Listing };

const REASON_TEXT: Record<UnresolvedInstrumentResponse["reason"], string> = {
  ambiguous: "Multiple listings match this ISIN — pick the market:",
  not_found: "Nothing matched it — search for the security:",
  not_priced: "No provider prices the listing found for it — search for another one:",
};

export function UnresolvedInstrumentsBlock({ unresolved, onRecommit, submitting }: UnresolvedInstrumentsBlockProps) {
  // Keyed by raw_identifier — carries over across recommits so a row the user already picked
  // (but didn't submit yet, or that's still unresolved for an unrelated reason) isn't lost.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const choose = (rawIdentifier: string, draft: Draft | null) =>
    setDrafts((prev) => {
      const next = { ...prev };
      if (draft) next[rawIdentifier] = draft;
      else delete next[rawIdentifier];
      return next;
    });

  const listingIdOf = (draft: Draft | undefined) => (draft?.kind === "candidate" ? draft.listingId : draft?.listing.listingId);
  const readyCount = unresolved.filter((u) => listingIdOf(drafts[u.raw_identifier])).length;

  const handleSubmit = () => {
    const overrides: Record<string, InstrumentOverridePayload> = {};
    for (const u of unresolved) {
      const listingId = listingIdOf(drafts[u.raw_identifier]);
      if (listingId) overrides[u.raw_identifier] = { listing_id: listingId };
    }
    if (Object.keys(overrides).length === 0) return;
    onRecommit(overrides);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
        <h4 className="text-xs font-bold text-slate-700">Unresolved instruments</h4>
      </div>
      <p className="text-xs text-slate-500">
        These raw identifiers couldn&apos;t be matched to an instrument. Resolve the ones you want to import, then reimport.
      </p>
      <div className="space-y-2.5">
        {unresolved.map((u) => {
          const draft = drafts[u.raw_identifier];
          // Only census' listings can be picked: a candidate without one is left out.
          const candidates = u.candidates.filter((c) => c.listing_id);
          return (
            <div key={u.raw_identifier} className="border border-amber-200 bg-amber-50/40 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-amber-800">{u.raw_identifier}</span>
                <span className="text-xs text-amber-600">
                  {u.row_indexes.length} row{u.row_indexes.length !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-amber-700">
                {candidates.length > 0 ? REASON_TEXT.ambiguous : REASON_TEXT[u.reason === "ambiguous" ? "not_found" : u.reason]}
              </p>

              {candidates.length > 0 && (
                <div className="space-y-1.5">
                  {candidates.map((c, i) => {
                    const selected = draft?.kind === "candidate" && draft.index === i;
                    return (
                      <label
                        key={c.listing_id}
                        className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                          selected ? "border-slate-900 bg-white" : "border-slate-200 bg-white/70 hover:border-slate-300"
                        } ${submitting ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="radio"
                            name={`candidate-${u.raw_identifier}`}
                            checked={selected}
                            onChange={() => choose(u.raw_identifier, { kind: "candidate", index: i, listingId: c.listing_id! })}
                            disabled={submitting}
                          />
                          <span className="font-mono font-semibold text-slate-700">{c.ticker}</span>
                          {c.name && <span className="text-slate-500 truncate">{c.name}</span>}
                        </span>
                        <span className="flex items-center gap-2 text-slate-500 shrink-0">
                          {c.exchange_name && <span>{c.exchange_name}</span>}
                          {c.exchange && <span className="font-mono">{c.exchange}</span>}
                          {c.currency && <span className="font-bold text-slate-600">{c.currency}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              <AssetPicker
                value={draft?.kind === "search" ? draft.listing : null}
                onChange={(listing) => choose(u.raw_identifier, listing ? { kind: "search", listing } : null)}
                label={candidates.length > 0 ? "Or search for another listing" : "Security"}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-end pt-1">
        <button
          onClick={handleSubmit}
          disabled={readyCount === 0 || submitting}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-colors ${
            readyCount === 0 || submitting ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-slate-900 hover:bg-blue-600"
          }`}
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {submitting ? "Reimporting…" : `Resolve ${readyCount || ""} and reimport`}
        </button>
      </div>
    </div>
  );
}
