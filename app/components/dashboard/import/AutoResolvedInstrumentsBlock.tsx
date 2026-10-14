"use client";

import { useState } from "react";
import { ArrowRightLeft, Check, Loader2 } from "lucide-react";
import type { AutoResolvedInstrumentResponse, InstrumentCandidateDTO } from "../../../models/Import";
import type { Listing } from "../../../models/Listing";
import { AssetPicker } from "../AssetPicker";

/** "IUS5 · Xetra (XETR) · EUR": a candidate as the import names it. */
function candidateLine(c: InstrumentCandidateDTO): string {
  const market = c.exchange_name && c.exchange ? `${c.exchange_name} (${c.exchange})` : c.exchange_name ?? c.exchange;
  return [c.ticker, market, c.currency].filter(Boolean).join(" · ");
}

/**
 * AUTO-RESOLVED INSTRUMENTS — the securities the import put on a listing by itself, the only one
 * in the rows' currency among several: shown, so a purchase made on another market can be moved
 * to its listing (one of the candidates, or any found with the search). Moving updates the
 * transactions already recorded (`onMove`).
 */
export function AutoResolvedInstrumentsBlock({
  items, onMove,
}: {
  items: AutoResolvedInstrumentResponse[];
  onMove: (item: AutoResolvedInstrumentResponse, listing: InstrumentCandidateDTO) => Promise<void>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [choice, setChoice] = useState<InstrumentCandidateDTO | null>(null);
  const [searched, setSearched] = useState<Listing | null>(null);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = (key: string) => {
    setOpen(open === key ? null : key);
    setChoice(null);
    setSearched(null);
    setError(null);
  };

  const move = async (item: AutoResolvedInstrumentResponse) => {
    const target: InstrumentCandidateDTO | null = searched
      ? {
        listing_id: searched.listingId, instrument_id: searched.instrumentId, name: searched.name, ticker: searched.ticker,
        isin: searched.isin, exchange: searched.exchangeMic, exchange_name: searched.exchangeName, currency: searched.currency,
      }
      : choice;
    if (!target?.listing_id) return;
    setMoving(true);
    setError(null);
    try {
      await onMove(item, target);
      setOpen(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The transactions couldn't be moved.");
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
        <h4 className="text-xs font-bold text-slate-700">Listings picked for you</h4>
      </div>
      <p className="text-xs text-slate-500">
        These securities trade on several markets: each was recorded on its only listing in the file&apos;s currency. If you bought on another market, change it.
      </p>
      <div className="space-y-2.5">
        {items.map((item) => {
          const others = item.candidates.filter((c) => c.listing_id && c.listing_id !== item.listing.listing_id);
          const isOpen = open === item.raw_identifier;
          return (
            <div key={item.raw_identifier} className="border border-slate-200 bg-slate-50/60 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-mono font-semibold text-slate-700 truncate">{item.raw_identifier}</p>
                  <p className="text-[11px] font-semibold text-slate-500 truncate">
                    {item.listing.name ? `${item.listing.name} · ` : ""}{candidateLine(item.listing)} · {item.transaction_uuids.length} transaction{item.transaction_uuids.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => start(item.raw_identifier)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-white border border-slate-200 transition-colors"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" /> {isOpen ? "Keep it" : "Change"}
                </button>
              </div>

              {isOpen && (
                <div className="space-y-2">
                  {others.length > 0 && (
                    <div className="space-y-1.5">
                      {others.map((c) => (
                        <label
                          key={c.listing_id}
                          className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                            choice?.listing_id === c.listing_id && !searched ? "border-slate-900 bg-white" : "border-slate-200 bg-white/70 hover:border-slate-300"
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <input
                              type="radio"
                              name={`auto-${item.raw_identifier}`}
                              checked={choice?.listing_id === c.listing_id && !searched}
                              onChange={() => { setChoice(c); setSearched(null); }}
                            />
                            <span className="font-mono font-semibold text-slate-700">{c.ticker}</span>
                          </span>
                          <span className="text-slate-500 shrink-0">{candidateLine(c)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <AssetPicker
                    value={searched}
                    onChange={(listing) => { setSearched(listing); if (listing) setChoice(null); }}
                    label={others.length > 0 ? "Or search for another listing" : "Search for its listing"}
                    excludeListingIds={item.listing.listing_id ? [item.listing.listing_id] : []}
                  />
                  {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={moving || (!choice && !searched)}
                      onClick={() => { void move(item); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors ${
                        moving || (!choice && !searched) ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-slate-900 hover:bg-blue-600"
                      }`}
                    >
                      {moving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Move {item.transaction_uuids.length} transaction{item.transaction_uuids.length !== 1 ? "s" : ""}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
