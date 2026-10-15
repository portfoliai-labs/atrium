// components/dashboard/PublishStrategyDialog.tsx
"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Telescope } from "lucide-react";
import { publicationService } from "../../services/publicationService";
import { ApiError } from "../../services/apiClient";
import { MAX_DESCRIPTION_LENGTH, type PublishedStrategy } from "../../models/PublishedStrategy";
import type { Portfolio } from "../../models/Portfolio";

/**
 * PUBLISH STRATEGY — an advisor's backtest into the strategies catalog (POST
 * /v1/advisor/publications), with a description of their own; published already, it changes the
 * description. Everyone reads it in Explore: its allocation, its rules, its costs and its
 * simulated figures, labelled so, under the catalog's disclaimer, never matched to anyone. The
 * backend refuses one whose backtest hasn't run yet (409).
 */
export function PublishStrategyDialog({ backtest, published, onClose, onPublished }: {
  backtest: Portfolio;
  published?: PublishedStrategy;
  onClose: () => void;
  onPublished: (publication: PublishedStrategy) => void;
}) {
  const [description, setDescription] = useState(published?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const trimmed = description.trim();
      onPublished(await publicationService.publish({ portfolioUuid: backtest.uuid, ...(trimmed ? { description: trimmed } : {}) }));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409
        ? "Its backtest is still running: publish it once its figures are in."
        : err instanceof Error ? err.message : "Unable to publish this strategy.");
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 md:p-8 space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-50 rounded-xl shrink-0"><Telescope className="h-5 w-5 text-sky-700" /></div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-900">{published ? "Edit the publication" : "Publish to Explore"}</h3>
            <p className="text-xs text-slate-500 truncate">{backtest.name}</p>
          </div>
        </div>
        <p className="text-[13px] text-slate-600 leading-relaxed">
          Everyone on PortfoliAI can read it in Explore, under your name: its allocation, its rebalancing, your trading costs
          and its simulated figures, labelled as simulated. It isn&apos;t matched to anyone, and nobody can copy or adopt it.
        </p>
        <label className="block">
          <span className="flex items-baseline justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Description
            <span className="normal-case tracking-normal font-semibold text-slate-400 tabular-nums">{description.length} / {MAX_DESCRIPTION_LENGTH}</span>
          </span>
          <textarea
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
            rows={5}
            placeholder="What it's built on and how it behaves. Describe the strategy, not who it's for."
            className="w-full px-3.5 py-3 rounded-xl bg-white text-sm text-slate-900 outline-none border border-slate-200 placeholder:text-slate-400 focus:border-sky-500/60 focus:ring-4 focus:ring-sky-500/10 resize-y"
          />
        </label>
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={busy} className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={publish}
            disabled={busy}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#1c1917] hover:bg-sky-700 transition-colors disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {published ? "Save" : "Publish"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
