// components/dashboard/DonutList.tsx
"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatCurrency } from "../../lib/format";

export interface DonutItem {
  key: string;
  label: string;
  sub?: string;
  // null: not known (yet).
  value: number | null;
  currency: string;
  // Counted in the donut and the shares: in the total's currency, and worth something.
  counted: boolean;
  color: string;
  onOpen?: () => void;
}

/**
 * DONUT LIST — the parts of a whole (All portfolios' portfolios, All wallets' wallets) on a donut
 * and in a list beside it, each with its value and share, a slice or a row opening that part's
 * page. Shares are of the counted parts' total, in `currency`; a part not counted (another
 * currency, a card in debt, a value not known yet) is listed, without a share.
 */
export function DonutList({ items, currency }: { items: DonutItem[]; currency: string }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) => Number(b.counted) - Number(a.counted) || (b.value ?? 0) - (a.value ?? 0));
  const slices = sorted.filter((i) => i.counted);
  const total = slices.reduce((s, i) => s + (i.value ?? 0), 0);
  const share = (i: DonutItem) => (i.counted && total > 0 ? ((i.value ?? 0) / total) * 100 : null);
  const focus = sorted.find((i) => i.key === hovered);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[210px_minmax(0,1fr)] gap-[26px] items-center">
      <div className="relative w-full max-w-[210px] aspect-square mx-auto">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 210, height: 210 }}>
          <PieChart>
            <Pie
              data={slices.length ? slices : [{ key: "none", label: "", value: 1, color: "#EEE9DD" }]}
              dataKey="value"
              nameKey="label"
              innerRadius="67%"
              outerRadius="98%"
              paddingAngle={slices.length > 1 ? 1.4 : 0}
              stroke="none"
              isAnimationActive={false}
              onMouseLeave={() => setHovered(null)}
            >
              {(slices.length ? slices : [{ key: "none", color: "#EEE9DD" } as DonutItem]).map((i) => (
                <Cell
                  key={i.key}
                  fill={i.color}
                  opacity={hovered && hovered !== i.key ? 0.25 : 1}
                  cursor={i.onOpen ? "pointer" : "default"}
                  onMouseEnter={() => i.key !== "none" && setHovered(i.key)}
                  onClick={i.onOpen}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-[22%] text-center">
          <span className="text-xl font-bold text-[#1c1917] tabular-nums">
            {focus && share(focus) !== null ? `${share(focus)!.toFixed(1)}%` : slices.length ? formatCurrency(total, currency, 0) : "—"}
          </span>
          <span className="text-[10.5px] text-[#78716c] truncate max-w-full">{focus ? focus.label : "total"}</span>
        </div>
      </div>
      <ul className="min-w-0">
        {sorted.map((i, index) => {
          const pct = share(i);
          const content = (
            <>
              <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: i.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[#1c1917]">{i.label}</span>
                {i.sub && <span className="block truncate text-[11.5px] font-medium text-[#78716c]">{i.sub}</span>}
              </span>
              <span className={`shrink-0 pl-4 text-right font-bold tabular-nums ${(i.value ?? 0) < 0 ? "text-rose-600" : "text-[#1c1917]"}`}>
                {i.value === null ? "—" : formatCurrency(i.value, i.currency, 0)}
              </span>
              <span className="hidden sm:block shrink-0 min-w-[92px] text-right text-xs text-[#78716c] tabular-nums">
                {pct === null ? "—" : `${pct.toFixed(1)}%`}
              </span>
              <span className="w-[18px] shrink-0">{i.onOpen && <ChevronRight className="h-4 w-4 text-[#a8a29e]" />}</span>
            </>
          );
          const row = `w-full flex items-center gap-3 px-2.5 py-[11px] rounded-[14px] text-left transition-colors ${index < sorted.length - 1 ? "border-b border-[#EEE9DD]" : ""} ${hovered === i.key ? "bg-[#F7F5EF]" : ""}`;
          return (
            <li key={i.key} onMouseEnter={() => setHovered(i.key)} onMouseLeave={() => setHovered(null)}>
              {i.onOpen ? (
                <button type="button" onClick={i.onOpen} className={`${row} hover:bg-[#F7F5EF] outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40`}>{content}</button>
              ) : (
                <div className={row}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
