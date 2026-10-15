"use client";

import { useState } from "react";
import { ArrowDownLeft, Loader2, RefreshCw } from "lucide-react";
import type { PreviewRow } from "../../../lib/import";

interface TransferCostsBlockProps {
  // The rows the commit left out: transfers in with no cost.
  rowIndexes: number[];
  // What the file says of each row, to recognize it.
  previewRows: PreviewRow[];
  onSubmit: (costs: Record<string, string>) => void;
  submitting: boolean;
}

/**
 * TRANSFER COSTS — the transfers in a commit didn't record, having no cost (commit's
 * transfers_without_cost): each one's total cost, typed here, records them with a second commit of
 * just those rows (only_row_indexes, transfer_costs). Rows left blank stay out.
 */
export function TransferCostsBlock({ rowIndexes, previewRows, onSubmit, submitting }: TransferCostsBlockProps) {
  const [costs, setCosts] = useState<Record<string, string>>({});
  const valid = (s: string | undefined) => {
    const n = Number((s ?? "").replace(",", "."));
    return (s ?? "").trim() !== "" && Number.isFinite(n) && n > 0;
  };
  const ready = rowIndexes.filter((i) => valid(costs[String(i)]));
  const invalid = rowIndexes.some((i) => (costs[String(i)] ?? "").trim() !== "" && !valid(costs[String(i)]));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ArrowDownLeft className="h-4 w-4 text-teal-600 shrink-0" />
        <h4 className="text-xs font-bold text-slate-700">Transfers in without a cost ({rowIndexes.length}) — not imported</h4>
      </div>
      <p className="text-xs text-slate-500">
        Units brought in from elsewhere need what they cost you in all, to work out gains when they&apos;re sold. Give each one&apos;s total cost to import it.
      </p>
      <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-64 overflow-y-auto custom-scrollbar">
        {rowIndexes.map((i) => {
          const parsed = previewRows[i]?.parsed;
          const what = [parsed?.ticker ?? parsed?.isin ?? parsed?.name, parsed?.quantity != null && `${parsed.quantity} units`, parsed?.date].filter(Boolean).join(" · ");
          const value = costs[String(i)] ?? "";
          return (
            <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0 text-xs">
                <span className="font-bold text-slate-700">Row {i + 1}</span>
                {what && <span className="text-slate-500"> · {what}</span>}
              </span>
              <span className="relative shrink-0">
                <input
                  type="text"
                  inputMode="decimal"
                  value={value}
                  placeholder="Total cost"
                  aria-label={`Row ${i + 1} total cost`}
                  onChange={(e) => setCosts((prev) => ({ ...prev, [String(i)]: e.target.value }))}
                  className={`w-36 h-9 pl-3 pr-12 rounded-lg bg-white border text-right text-xs font-bold tabular-nums text-slate-900 outline-none ${
                    value.trim() === "" || valid(value) ? "border-slate-200 focus:border-slate-300" : "border-rose-300"
                  }`}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">{parsed?.currency ?? ""}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-amber-700">{invalid ? "Each cost is an amount above 0." : ""}</span>
        <button
          type="button"
          disabled={ready.length === 0 || invalid || submitting}
          onClick={() => onSubmit(Object.fromEntries(ready.map((i) => [String(i), costs[String(i)].replace(",", ".").trim()])))}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Import {ready.length || ""} {ready.length === 1 ? "transfer" : "transfers"}
        </button>
      </div>
    </div>
  );
}
