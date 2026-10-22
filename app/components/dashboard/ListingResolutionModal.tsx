"use client";

import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { investmentsKey } from "../../context/PortfolioContext";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { listingLine, type Listing } from "../../models/Listing";
import { listingService } from "../../services/listingService";
import { AssetPicker } from "./AssetPicker";

/** One identifier a file's rows name (an ISIN, else a ticker), with what tells its listing apart. */
export interface UnlistedInstrument {
  key: string;
  ticker: string | null;
  isin: string | null;
  // The currencies its rows are in: a single candidate in one of them is proposed.
  currencies: string[];
  rows: number;
}

/** What census is searched by: the ISIN, else the ticker without a market suffix (VWCE.MI → VWCE). */
function queryOf(instrument: UnlistedInstrument): string {
  if (instrument.isin) return instrument.isin;
  const ticker = instrument.ticker ?? "";
  return ticker.includes(".") ? ticker.slice(0, ticker.lastIndexOf(".")) : ticker;
}

/** The candidate proposed: the only one, or the only one in the rows' currency. */
function proposed(candidates: Listing[], currencies: string[]): Listing | null {
  if (candidates.length === 1) return candidates[0];
  const inCurrency = candidates.filter((c) => currencies.includes(c.currency));
  return inCurrency.length === 1 ? inCurrency[0] : null;
}

/**
 * LISTING RESOLUTION — before a file's rows mapped by hand are saved, each instrument they name
 * becomes one of census' listings (a transaction is saved on a listing): its candidates as census'
 * search finds them by the ISIN or the ticker, the only one (or the only one in the rows'
 * currency) picked already, or any other found with the search. Saving waits for every one.
 */
export function ListingResolutionModal({
  instruments, onResolved, onClose,
}: {
  instruments: UnlistedInstrument[];
  onResolved: (listings: Record<string, Listing>) => void;
  onClose: () => void;
}) {
  // Each security's search, through the cache (the same as the asset picker's for that text).
  const answers = useQueries({
    queries: instruments.map((instrument) => ({
      queryKey: investmentsKey("listings", queryOf(instrument)),
      queryFn: ({ signal }: { signal: AbortSignal }) => listingService.search(queryOf(instrument), signal),
    })),
  });
  const candidates: Record<string, Listing[] | "error"> = {};
  instruments.forEach((instrument, i) => {
    const answer = answers[i];
    if (answer.isError) candidates[instrument.key] = "error";
    else if (answer.data) candidates[instrument.key] = answer.data;
  });
  // What the user picked or cleared, over what the search proposes (see `proposed`).
  const [choices, setChoices] = useState<Record<string, Listing | null>>({});
  const picked: Record<string, Listing> = {};
  for (const instrument of instruments) {
    const found = candidates[instrument.key];
    const choice = instrument.key in choices ? choices[instrument.key]
      : found && found !== "error" ? proposed(found, instrument.currencies) : null;
    if (choice) picked[instrument.key] = choice;
  }

  const pick = (key: string, listing: Listing | null) => setChoices((prev) => ({ ...prev, [key]: listing }));

  const searching = instruments.some((i) => candidates[i.key] === undefined);
  const missing = instruments.filter((i) => !picked[i.key]).length;

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 md:p-8 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">Pick each security&apos;s listing</h3>
            <p className="text-xs text-slate-500 mt-1">
              A transaction is saved on a listing: the market and currency the security trades in. Pick one for each security the file names.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {instruments.map((instrument) => {
            const found = candidates[instrument.key];
            const chosen = picked[instrument.key];
            const listed = found && found !== "error" ? found : [];
            const fromSearch = chosen && !listed.some((c) => c.listingId === chosen.listingId);
            return (
              <div key={instrument.key} className="border border-amber-200 bg-amber-50/40 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-mono font-semibold text-amber-800">
                    {[instrument.ticker, instrument.isin].filter(Boolean).join(" · ")}
                  </span>
                  <span className="text-xs text-amber-600">{instrument.rows} row{instrument.rows !== 1 ? "s" : ""}</span>
                </div>

                {found === undefined ? (
                  <p className="flex items-center gap-2 text-[11px] font-semibold text-amber-700">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking for its listings…
                  </p>
                ) : found === "error" ? (
                  <p className="flex items-center gap-2 text-[11px] font-semibold text-rose-600">
                    <AlertTriangle className="h-3.5 w-3.5" /> The search failed: look for it below.
                  </p>
                ) : listed.length === 0 ? (
                  <p className="text-[11px] font-semibold text-amber-700">No listing found for it: search for the security below.</p>
                ) : (
                  <div className="space-y-1.5">
                    {listed.map((c) => (
                      <label
                        key={c.listingId}
                        className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                          chosen?.listingId === c.listingId ? "border-slate-900 bg-white" : "border-slate-200 bg-white/70 hover:border-slate-300"
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="radio"
                            name={`listing-${instrument.key}`}
                            checked={chosen?.listingId === c.listingId}
                            onChange={() => pick(instrument.key, c)}
                          />
                          <span className="font-semibold text-slate-700 truncate">{c.name}</span>
                        </span>
                        <span className="text-slate-500 shrink-0">{listingLine(c)}</span>
                      </label>
                    ))}
                  </div>
                )}

                <AssetPicker
                  value={fromSearch ? chosen : null}
                  onChange={(listing) => pick(instrument.key, listing)}
                  label={listed.length > 0 ? "Or search for another listing" : "Security"}
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            disabled={searching || missing > 0}
            onClick={() => onResolved(picked)}
            className={`px-5 py-3 rounded-xl text-sm font-bold text-white transition-colors ${
              searching || missing > 0 ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-slate-900 hover:bg-blue-600"
            }`}
          >
            {missing > 0 ? `${missing} left to pick` : "Save the transactions"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
