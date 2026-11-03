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
  // What it is made of, on an outer ring under its slice (an account's wallets): each in the
  // donut's currency, positive. With parts, its slice is as wide as they are together.
  parts?: DonutPart[];
}

export interface DonutPart {
  key: string;
  label: string;
  value: number;
  color: string;
  onOpen?: () => void;
}

// The least share of the circle a slice (or an outer part) is drawn with, however small its value:
// a 15 beside a million is still seen. Only the drawing; shares and totals stay the values'.
const MIN_DRAWN_SHARE = 0.025;

/**
 * How wide each value is drawn, as shares of the circle: its own, but at least the minimum (less
 * when there are so many that the minima would fill half the circle), the others shrunk in
 * proportion to make room, again until none of them falls under it.
 */
export function drawnShares(values: number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0 || values.length < 2) return values.map(() => (total > 0 ? 1 : 0));
  const min = Math.min(MIN_DRAWN_SHARE, 0.5 / values.length);
  const raised = new Set<number>();
  for (;;) {
    const rest = 1 - raised.size * min;
    const free = values.reduce((s, v, i) => (raised.has(i) ? s : s + v), 0);
    const next = values.findIndex((v, i) => !raised.has(i) && (v / free) * rest < min);
    if (next < 0) return values.map((v, i) => (raised.has(i) ? min : (v / free) * rest));
    raised.add(next);
  }
}

// The rings' edges, white as the module they're on: slices and parts meet, so the outer ring
// lines up with the inner one.
const EDGE = { stroke: "#fff", strokeWidth: 1.5 };

/**
 * DONUT LIST — the parts of a whole (All portfolios' portfolios, All wallets' wallets) on a donut
 * and in a list beside it, each with its value and share, a slice or a row opening that part's
 * page. Shares are of the counted parts' total, in `currency`; a part not counted (another
 * currency, a card in debt, a value not known yet) is listed, without a share. When some parts
 * have parts of their own (an account's wallets), a thinner outer ring shows them under their
 * part's slice, hovered and opened as the slices are; a part without any is drawn whole there too.
 */
export function DonutList({ items, currency }: { items: DonutItem[]; currency: string }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) => Number(b.counted) - Number(a.counted) || (b.value ?? 0) - (a.value ?? 0));
  // A slice's width: its parts together when it has some.
  const width = (i: DonutItem) => (i.parts ? i.parts.reduce((s, p) => s + p.value, 0) : i.value ?? 0);
  const slices = sorted.filter((i) => i.counted && width(i) > 0).map((i) => ({ ...i, value: width(i) }));
  const total = slices.reduce((s, i) => s + i.value, 0);
  const nested = slices.some((i) => i.parts?.length);
  // The outer ring, slice by slice in the same order: a slice without parts is one part.
  const outer = nested
    ? slices.flatMap((i) => (i.parts?.length ? i.parts : [{ key: i.key, label: i.label, value: i.value, color: i.color, onOpen: i.onOpen }])
      .map((p) => ({ ...p, parent: i.key })))
    : [];
  // As drawn: each leaf (an outer part, or a slice without parts) at least the minimum share, a
  // slice as wide as its parts drawn together, so the rings still line up.
  const drawn = drawnShares(nested ? outer.map((p) => p.value) : slices.map((i) => i.value));
  const drawnOuter = nested ? outer.map((p, n) => ({ ...p, drawn: drawn[n] })) : [];
  const drawnSlices = slices.map((i, n) => ({
    ...i, drawn: nested ? drawnOuter.filter((p) => p.parent === i.key).reduce((s, p) => s + p.drawn, 0) : drawn[n],
  }));
  const share = (i: DonutItem) => {
    const slice = slices.find((s) => s.key === i.key);
    return slice && total > 0 ? (slice.value / total) * 100 : null;
  };
  const part = outer.find((p) => p.key === hovered && p.parent !== p.key);
  const focus = part ?? sorted.find((i) => i.key === hovered);
  const focusShare = part ? (total > 0 ? (part.value / total) * 100 : null) : focus ? share(focus as DonutItem) : null;
  // A slice is lit with its parts, a part with its slice.
  const lit = (key: string, parent?: string) => !hovered || hovered === key || hovered === parent || outer.some((p) => p.key === hovered && p.parent === key);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[210px_minmax(0,1fr)] gap-[26px] items-center">
      <div className="relative w-full max-w-[210px] aspect-square mx-auto">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 210, height: 210 }}>
          <PieChart>
            <Pie
              data={drawnSlices.length ? drawnSlices : [{ key: "none", label: "", drawn: 1, color: "#EEE9DD" }]}
              dataKey="drawn"
              nameKey="label"
              innerRadius={nested ? "56%" : "67%"}
              outerRadius={nested ? "80%" : "98%"}
              paddingAngle={!nested && slices.length > 1 ? 1.4 : 0}
              {...(nested ? EDGE : { stroke: "none" })}
              isAnimationActive={false}
              onMouseLeave={() => setHovered(null)}
            >
              {(slices.length ? slices : [{ key: "none", color: "#EEE9DD" } as DonutItem]).map((i) => (
                <Cell
                  key={i.key}
                  fill={i.color}
                  opacity={lit(i.key) ? 1 : 0.25}
                  cursor={i.onOpen ? "pointer" : "default"}
                  onMouseEnter={() => i.key !== "none" && setHovered(i.key)}
                  onClick={i.onOpen}
                />
              ))}
            </Pie>
            {nested && (
              <Pie
                data={drawnOuter}
                dataKey="drawn"
                nameKey="label"
                innerRadius="83%"
                outerRadius="98%"
                {...EDGE}
                isAnimationActive={false}
                onMouseLeave={() => setHovered(null)}
              >
                {drawnOuter.map((p) => (
                  <Cell
                    key={`${p.parent}:${p.key}`}
                    fill={p.color}
                    opacity={lit(p.key, p.parent) ? 1 : 0.25}
                    cursor={p.onOpen ? "pointer" : "default"}
                    onMouseEnter={() => setHovered(p.key)}
                    onClick={p.onOpen}
                  />
                ))}
              </Pie>
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-[22%] text-center">
          <span className="text-xl font-bold text-[#1c1917] tabular-nums">
            {focus && focusShare !== null ? `${focusShare.toFixed(1)}%` : slices.length ? formatCurrency(total, currency, 0) : "—"}
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
              <span className="w-[18px] shrink-0">{i.onOpen && <ChevronRight className="h-4 w-4 text-[#857e78]" />}</span>
            </>
          );
          const row = `w-full flex items-center gap-3 px-2.5 py-[11px] rounded-[14px] text-left transition-colors ${index < sorted.length - 1 ? "border-b border-[#EEE9DD]" : ""} ${hovered === i.key || part?.parent === i.key ? "bg-[#F7F5EF]" : ""}`;
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
