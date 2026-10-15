"use client";

import { AlertTriangle } from "lucide-react";
import { PreviewRow } from "../../../lib/import";

const TYPE_STYLES: Record<string, string> = {
  buy: "bg-emerald-100 text-emerald-700",
  sell: "bg-blue-100 text-blue-700",
  dividend: "bg-violet-100 text-violet-700",
  ignore: "bg-slate-100 text-slate-500",
};

function fmtNum(n: number | undefined): string {
  return n === undefined ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

interface PreviewBlockProps {
  rows: PreviewRow[];
}

export function PreviewBlock({ rows }: PreviewBlockProps) {
  const preview = rows.slice(0, 5);

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        First {preview.length} rows transformed with the current mapping — updates live as you change it above.
      </p>
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-200">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["Date", "Type", "Ticker/ISIN", "Name", "Qty", "Price", "Amount", "Fees", "Currency", "Broker"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview.map((row) => {
                const p = row.parsed;
                const hasAnomaly = row.anomalies.length > 0;
                return (
                  <tr key={row.index} className={hasAnomaly ? "bg-amber-50/50" : "hover:bg-slate-50/50"}>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {p?.date || <span className="text-rose-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />unparsed</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase ${TYPE_STYLES[p?.type ?? "ignore"]}`}>
                        {p?.type ?? "ignore"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-600 whitespace-nowrap">{p?.ticker || p?.isin || "—"}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-600 max-w-40 truncate">{p?.name || "—"}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-600 whitespace-nowrap">{fmtNum(p?.quantity)}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-600 whitespace-nowrap">{fmtNum(p?.price)}</td>
                    <td className="px-3 py-2.5 text-xs font-bold text-slate-700 whitespace-nowrap">{fmtNum(p?.amount)}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-600 whitespace-nowrap">{fmtNum(p?.fees)}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-600 whitespace-nowrap">{p?.currency || "—"}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-600 whitespace-nowrap">{p?.broker || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
