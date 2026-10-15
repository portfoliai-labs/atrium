// components/dashboard/NewPortfolioDialog.tsx
"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Loader2 } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";

/**
 * NEW PORTFOLIO DIALOG — the Investments hub's way to create a portfolio, opened from the "New
 * portfolio" card at the front of the real portfolios' card holder: a small dialog with the name,
 * in the same shell as ConfirmDialog. Creating one selects it (see PortfolioContext.createPortfolio)
 * and it joins the holder.
 */
export function NewPortfolioDialog({ onClose }: { onClose: () => void }) {
  const { createPortfolio } = usePortfolio();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await createPortfolio(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create this portfolio.");
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-md w-full p-6 md:p-8 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#C49A3C]/10 rounded-xl shrink-0">
            <Plus className="h-5 w-5 text-[#C49A3C]" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">New portfolio</h3>
            <p className="text-xs text-slate-500">Its own transactions, insights, reports and alerts.</p>
          </div>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
            if (e.key === "Escape") onClose();
          }}
          placeholder="Portfolio name"
          maxLength={80}
          aria-label="New portfolio name"
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
            onClick={handleCreate}
            disabled={busy || !name.trim()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#1c1917] hover:bg-[#C49A3C] transition-colors disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
