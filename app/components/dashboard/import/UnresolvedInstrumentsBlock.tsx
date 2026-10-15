"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { InstrumentCandidateDTO, InstrumentOverridePayload, UnresolvedInstrumentResponse } from "../../../models/Import";

interface UnresolvedInstrumentsBlockProps {
  unresolved: UnresolvedInstrumentResponse[];
  onRecommit: (overrides: Record<string, InstrumentOverridePayload>) => void;
  submitting: boolean;
}

interface Draft {
  ticker: string;
  isin: string;
  exchange: string;
  selectedCandidateIndex: number | null;
}

const EMPTY_DRAFT: Draft = { ticker: "", isin: "", exchange: "", selectedCandidateIndex: null };

export function UnresolvedInstrumentsBlock({ unresolved, onRecommit, submitting }: UnresolvedInstrumentsBlockProps) {
  // Keyed by raw_identifier — carries over across recommits so a row the user already typed
  // into or picked (but didn't submit yet, or that's still unresolved for an unrelated reason)
  // isn't lost.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const setField = (rawIdentifier: string, field: "ticker" | "isin", value: string) => {
    setDrafts((prev) => {
      const current = prev[rawIdentifier] ?? EMPTY_DRAFT;
      return { ...prev, [rawIdentifier]: { ...current, [field]: value, selectedCandidateIndex: null } };
    });
  };

  const selectCandidate = (rawIdentifier: string, index: number, candidate: InstrumentCandidateDTO) => {
    setDrafts((prev) => ({
      ...prev,
      [rawIdentifier]: {
        ticker: candidate.ticker,
        isin: candidate.isin ?? "",
        exchange: candidate.exchange ?? "",
        selectedCandidateIndex: index,
      },
    }));
  };

  const readyCount = unresolved.filter((u) => (drafts[u.raw_identifier]?.ticker ?? "").trim().length > 0).length;

  const handleSubmit = () => {
    const overrides: Record<string, InstrumentOverridePayload> = {};
    for (const u of unresolved) {
      const draft = drafts[u.raw_identifier];
      const ticker = draft?.ticker.trim();
      if (!ticker) continue;
      overrides[u.raw_identifier] = { ticker, isin: draft?.isin.trim() || null, exchange: draft?.exchange.trim() || null };
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
          const draft = drafts[u.raw_identifier] ?? EMPTY_DRAFT;
          const isAmbiguous = u.reason === "ambiguous" && u.candidates.length > 0;
          return (
            <div key={u.raw_identifier} className="border border-amber-200 bg-amber-50/40 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-amber-800">{u.raw_identifier}</span>
                <span className="text-xs text-amber-600">
                  {u.row_indexes.length} row{u.row_indexes.length !== 1 ? "s" : ""}
                </span>
              </div>

              {isAmbiguous ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-amber-700">Multiple listings match this ISIN — pick the market:</p>
                  {u.candidates.map((c, i) => {
                    const selected = draft.selectedCandidateIndex === i;
                    return (
                      <label
                        key={`${c.ticker}-${c.exchange ?? i}`}
                        className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                          selected ? "border-slate-900 bg-white" : "border-slate-200 bg-white/70 hover:border-slate-300"
                        } ${submitting ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`candidate-${u.raw_identifier}`}
                            checked={selected}
                            onChange={() => selectCandidate(u.raw_identifier, i, c)}
                            disabled={submitting}
                          />
                          <span className="font-mono font-semibold text-slate-700">{c.ticker}</span>
                        </span>
                        <span className="flex items-center gap-2 text-slate-500">
                          {c.exchange_name && <span>{c.exchange_name}</span>}
                          {c.exchange && <span className="font-mono">{c.exchange}</span>}
                          {c.currency && <span className="font-bold text-slate-600">{c.currency}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={draft.ticker}
                    onChange={(e) => setField(u.raw_identifier, "ticker", e.target.value)}
                    placeholder="Ticker, e.g. AAPL"
                    disabled={submitting}
                    className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-semibold outline-none transition-all focus:ring-4 focus:ring-slate-50 focus:border-slate-300 w-32 disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={draft.isin}
                    onChange={(e) => setField(u.raw_identifier, "isin", e.target.value)}
                    placeholder="ISIN (optional)"
                    disabled={submitting}
                    className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-semibold outline-none transition-all focus:ring-4 focus:ring-slate-50 focus:border-slate-300 w-36 disabled:opacity-50"
                  />
                </div>
              )}
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
