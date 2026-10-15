"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { CommitImportResponse } from "../../../models/Import";

const WARNING_LABELS: Record<string, string> = {
  sold_never_bought: "Sold a position never bought",
  negative_cumulative_quantity: "Negative cumulative quantity",
  dividend_without_holding: "Dividend without a matching holding",
  amount_price_mismatch: "Amount doesn't match quantity × price",
  duplicate_row: "Exact duplicate rows",
};

export function CommitSummary({ summary }: { summary: CommitImportResponse }) {
  const hasIssues = summary.issues.length > 0 || summary.integrity_warnings.length > 0 || summary.unresolved_instruments.length > 0;

  return (
    <div className="space-y-5 py-2">
      <div className="text-center space-y-3">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-900">Import complete</h3>
          <p className="text-xs text-slate-500 mt-1">
            {summary.imported_count} transaction{summary.imported_count !== 1 ? "s" : ""} imported.
          </p>
        </div>
      </div>

      {summary.integrity_warnings.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <h4 className="text-xs font-bold text-slate-700">Integrity warnings</h4>
          </div>
          <div className="space-y-1.5">
            {summary.integrity_warnings.map((w, i) => (
              <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
                <span className="font-bold">{WARNING_LABELS[w.type] ?? w.type}</span> — {w.message} ({w.row_indexes.length} row{w.row_indexes.length !== 1 ? "s" : ""})
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.issues.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
            <h4 className="text-xs font-bold text-slate-700">Rows not imported ({summary.issues.length})</h4>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
            {summary.issues.map((issue) => (
              <div key={issue.row_index} className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-xs">
                <span className="font-bold text-rose-700">Row {issue.row_index + 1}</span>
                <span className="text-rose-600">{issue.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasIssues && <p className="text-xs text-slate-400 text-center italic">No issues to review.</p>}
    </div>
  );
}
