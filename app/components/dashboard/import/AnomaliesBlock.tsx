"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AnomalyKind, PreviewRow } from "../../../lib/import";

const ANOMALY_LABELS: Record<AnomalyKind, string> = {
  "unparsed-date": "Date couldn't be parsed",
  "unparsed-number": "Number couldn't be parsed",
  "unmapped-type": "Value not mapped to a type",
  "date-out-of-range": "Date outside plausible range",
  "unexpected-negative": "Unexpected negative quantity/price",
  duplicate: "Exact duplicate row",
  "amount-mismatch": "Amount doesn't match quantity × price",
  "missing-instrument": "No ticker or ISIN",
};

interface AnomaliesBlockProps {
  headers: string[];
  rows: PreviewRow[];
  onGoToValuesTab?: () => void;
}

export function AnomaliesBlock({ headers, rows, onGoToValuesTab }: AnomaliesBlockProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const anomalyRows = rows.filter((r) => r.anomalies.length > 0);
  const readyCount = rows.length - anomalyRows.length;

  const toggle = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-700">
          {readyCount} row{readyCount !== 1 ? "s" : ""} ready
          {anomalyRows.length > 0 && <span className="text-amber-600"> · {anomalyRows.length} to verify</span>}
        </p>
      </div>

      {anomalyRows.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No anomalies detected in this file.</p>
      ) : (
        <div className="space-y-2">
          {anomalyRows.map((row) => {
            const isOpen = expanded.has(row.index);
            const hasUnmappedType = row.anomalies.includes("unmapped-type");
            const hasMissingInstrument = row.anomalies.includes("missing-instrument");
            return (
              <div key={row.index} className="border border-amber-200 bg-amber-50/40 rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggle(row.index)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                    <span className="text-xs font-bold text-slate-600">Row {row.index + 1}</span>
                    {row.anomalies.map((a) => (
                      <span key={a} className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        {ANOMALY_LABELS[a]}
                      </span>
                    ))}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {headers.map((h) => (
                        <div key={h} className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{h}</div>
                          <div className="text-xs font-semibold text-slate-700 truncate">{row.raw[h] || "—"}</div>
                        </div>
                      ))}
                    </div>
                    {hasUnmappedType && onGoToValuesTab && (
                      <button
                        onClick={onGoToValuesTab}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        Fix in the Values tab →
                      </button>
                    )}
                    {hasMissingInstrument ? (
                      <p className="text-[11px] text-amber-700 font-medium">
                        This row has no ticker and no ISIN, so it can&apos;t be matched to an instrument. Fix the source file or the column mapping so at least one resolves for this row.
                      </p>
                    ) : hasUnmappedType ? (
                      <p className="text-[11px] text-amber-700 font-medium">
                        Left unresolved, this row is imported as <span className="font-mono font-bold">ignore</span>.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
