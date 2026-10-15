"use client";

import { Fragment, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { ConfidenceLevel, TransactionTarget } from "../../../models/Import";
import { RawRow } from "../../../lib/import";

const CONFIDENCE_STYLES: Record<ConfidenceLevel, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-rose-100 text-rose-700",
};

const TARGET_OPTIONS: { value: TransactionTarget; label: string }[] = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "dividend", label: "Dividend" },
];

export interface ValueMappingRow {
  raw_value: string;
  target: TransactionTarget | null;
  confidence: ConfidenceLevel;
  count: number;
}

interface ValueMappingBlockProps {
  columnName: string;
  // Original file column order — the expanded example row is shown in this order so it
  // reads the same as the source spreadsheet.
  headers: string[];
  rows: ValueMappingRow[];
  // One full source row per raw value, every original column included (not a guessed
  // subset) — whichever column actually reveals buy vs. sell (a sign, a "Causale"/description
  // column, a separate credit/debit flag) varies by broker and can't be predicted, so the
  // user needs to see everything to recognize the real transaction.
  examples?: Record<string, RawRow>;
  onChange: (rawValue: string, target: TransactionTarget | null) => void;
}

export function ValueMappingBlock({ columnName, headers, rows, examples, onChange }: ValueMappingBlockProps) {
  const [expandedValue, setExpandedValue] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="text-xs text-slate-400 italic">Map the &quot;Type&quot; field in the Columns tab first — its values are confirmed here.</p>;
  }

  // Unresolved / low-confidence values first, so what needs a decision surfaces immediately.
  const sorted = [...rows].sort((a, b) => {
    const rank = (r: ValueMappingRow) => (r.target === null ? 0 : r.confidence === "low" ? 1 : 2);
    return rank(a) - rank(b);
  });
  const unresolvedCount = rows.filter((r) => r.target === null).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-bold text-slate-700">{columnName}</h4>
        {unresolvedCount > 0 && (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
            {unresolvedCount} to confirm
          </span>
        )}
      </div>
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Value</th>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Count</th>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Maps to</th>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((row) => {
              const needsAttention = row.target === null || row.confidence === "low";
              const example = examples?.[row.raw_value];
              const isExpanded = expandedValue === row.raw_value;
              return (
                <Fragment key={row.raw_value}>
                  <tr className={needsAttention ? "bg-rose-50/50" : "hover:bg-slate-50/50"}>
                    <td className="px-4 py-2.5 text-xs font-mono font-semibold text-slate-700">
                      <button
                        type="button"
                        onClick={() => setExpandedValue(isExpanded ? null : row.raw_value)}
                        disabled={!example}
                        className="flex items-center gap-1.5 disabled:cursor-default"
                        title={example ? "Show the full source row this value comes from" : undefined}
                      >
                        {example && (isExpanded ? <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" /> : <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />)}
                        {row.raw_value || <span className="text-slate-300 italic">(blank)</span>}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{row.count}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={row.target ?? ""}
                        onChange={(e) => onChange(row.raw_value, (e.target.value || null) as TransactionTarget | null)}
                        className={`text-xs bg-white border rounded-xl px-2.5 py-2 font-semibold outline-none transition-all focus:ring-4 min-w-36 ${
                          row.target === null ? "border-rose-300 focus:ring-rose-50" : "border-slate-200 focus:ring-slate-50 focus:border-slate-300"
                        }`}
                      >
                        <option value="">Ignore (not imported)</option>
                        {TARGET_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${CONFIDENCE_STYLES[row.confidence]}`}>
                        {row.target === null ? "unmapped" : row.confidence}
                      </span>
                    </td>
                  </tr>
                  {isExpanded && example && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={4} className="px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          One full row from your file with this value — every column, so you can recognize the actual transaction
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                          {headers.map((header) => (
                            <div key={header} className="text-xs min-w-0">
                              <span className="text-slate-400 font-semibold">{header}: </span>
                              <span className="text-slate-700 font-medium wrap-break-word">{example[header] || "—"}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 font-medium leading-relaxed">
          Rows whose value is left as &quot;Ignore&quot; are not imported, so they never silently distort your P/L.
        </p>
      </div>
    </div>
  );
}
