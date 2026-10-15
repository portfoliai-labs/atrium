"use client";

import { ChevronDown } from "lucide-react";
import type { Portfolio } from "../../models/Portfolio";

/**
 * PORTFOLIO SELECT — picks which portfolio new transactions go into, inside the places they're
 * added from (the add-transaction modal, the import wizard, the manual column mapper). Only
 * the user's own portfolios, never the aggregate, which can't hold transactions of its own.
 * `value` "" means none picked yet: it then asks for one (a file's rows need it before they're
 * imported, see FileMappingModal and ImportWizard).
 */
export function PortfolioSelect({
  portfolios, value, onChange, disabled = false, label = "Add to portfolio",
}: { portfolios: Portfolio[]; value: string; onChange: (uuid: string) => void; disabled?: boolean; label?: string }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required
          className={`w-full h-11 pl-3.5 pr-9 rounded-xl bg-white border text-sm font-semibold outline-none focus:ring-4 focus:ring-slate-50 transition-all appearance-none disabled:bg-slate-50 disabled:text-slate-500 ${
            value ? "border-slate-200 text-slate-900 focus:border-slate-300" : "border-amber-300 bg-amber-50/40 text-slate-400 focus:border-amber-400"
          }`}
        >
          {!value && <option value="" disabled>Choose a portfolio…</option>}
          {portfolios.map((p) => <option key={p.uuid} value={p.uuid} className="text-slate-900">{p.name}</option>)}
        </select>
        <ChevronDown className="h-4 w-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </span>
    </label>
  );
}
