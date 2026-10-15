// components/dashboard/RenamePortfolioDialog.tsx
"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Loader2 } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";
import type { Portfolio } from "../../models/Portfolio";

/**
 * RENAME PORTFOLIO DIALOG — a portfolio page's "Rename" (see WealthSection): the name in a small
 * dialog, in the same shell as NewPortfolioDialog. The backend trims it and takes 1-80 characters;
 * a name another of the user's portfolios has is a 409, shown under the field.
 */
export function RenamePortfolioDialog({ portfolio, onClose }: { portfolio: Portfolio; onClose: () => void }) {
  const { renamePortfolio } = usePortfolio();
  const [name, setName] = useState(portfolio.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();
  const unchanged = trimmed === portfolio.name;

  const handleSave = async () => {
    if (!trimmed || unchanged) return;
    setBusy(true);
    setError(null);
    try {
      await renamePortfolio(portfolio.uuid, trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rename this portfolio.");
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-md w-full p-6 md:p-8 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#C49A3C]/10 rounded-xl shrink-0">
            <Pencil className="h-5 w-5 text-[#C49A3C]" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">Rename portfolio</h3>
            <p className="text-xs text-slate-500">Its transactions, insights, reports and alerts stay as they are.</p>
          </div>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") onClose();
          }}
          maxLength={80}
          aria-label="Portfolio name"
          aria-invalid={error !== null}
          className={`w-full h-11 px-3.5 rounded-xl bg-white text-sm font-semibold text-slate-900 outline-none border placeholder:text-slate-400 ${
            error ? "border-rose-400" : "border-slate-200 focus:border-[#C49A3C]/60 focus:ring-4 focus:ring-[#C49A3C]/10"
          }`}
        />
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={busy} className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy || !trimmed || unchanged}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#1c1917] hover:bg-[#C49A3C] transition-colors disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
