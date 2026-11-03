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

// The space between slices, and between an account's wallets on the outer ring (shares of the
// circle): air, not a drawn edge.
const SLICE_GAP = 0.012;
const PART_GAP = 0.006;
// An account's wallets on the outer ring: its colour, each a step lighter, back to it past the last.
const PART_SHADES = [1, 0.7, 0.48, 0.32];
const TRACK = "#EEE9DD";

// A segment of a ring as drawn: a slice, a part, the air between them, or (on the outer ring) a
// slice's place where it has nothing to split.
type Segment = { key: string; drawn: number; color: string; opacity: number; label?: string; parent?: string; onOpen?: () => void; air?: true };

/**
 * DONUT LIST — the parts of a whole (All portfolios' portfolios, All wallets' wallets) on a donut
 * and in a list beside it, each with its value and share, a slice or a row opening that part's
 * page. Shares are of the counted parts' total, in `currency`; a part not counted (another
 * currency, a card in debt, a value not known yet) is listed, without a share. When a part splits
 * into parts of its own (an account into its wallets), a thin outer ring shows them just outside
 * its slice, in shades of its colour, hovered and opened as the slices are; nothing is drawn there
 * for a part that doesn't split. Slices start at the top, clockwise, the largest first, with air
 * between them and rounded ends; each is drawn at least MIN_DRAWN_SHARE wide (drawnShares).
 */
export function DonutList({ items, currency }: { items: DonutItem[]; currency: string }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) => Number(b.counted) - Number(a.counted) || (b.value ?? 0) - (a.value ?? 0));
  // A slice's width: its parts together when it has some.
  const width = (i: DonutItem) => (i.parts ? i.parts.reduce((s, p) => s + p.value, 0) : i.value ?? 0);
  const slices = sorted.filter((i) => i.counted && width(i) > 0).map((i) => ({ ...i, value: width(i) }));
  const total = slices.reduce((s, i) => s + i.value, 0);
  // Split: in two parts or more (one part is the slice itself).
  const split = (i: DonutItem) => (i.parts?.length ?? 0) > 1;
  const nested = slices.some(split);

  // The leaves, drawn at least the minimum share: a split slice's parts, or the slice itself.
  const leaves = slices.map((i) => (split(i) ? i.parts!.map((p) => p.value) : [i.value]));
  const gaps = slices.length > 1 ? slices.length * SLICE_GAP : 0;
  const partGaps = leaves.reduce((s, l) => s + (l.length - 1) * PART_GAP, 0);
  const drawn = drawnShares(leaves.flat()).map((d) => d * (1 - gaps - partGaps));
  const inner: Segment[] = [];
  const outer: Segment[] = [];
  let next = 0;
  slices.forEach((i, n) => {
    const own = drawn.slice(next, next + leaves[n].length);
    next += leaves[n].length;
    const wide = own.reduce((s, d) => s + d, 0) + (own.length - 1) * PART_GAP;
    inner.push({ key: i.key, drawn: wide, color: i.color, opacity: 1, label: i.label, onOpen: i.onOpen });
    if (split(i)) {
      i.parts!.forEach((p, k) => {
        if (k > 0) outer.push({ key: `${i.key}:air:${k}`, drawn: PART_GAP, color: "transparent", opacity: 0, air: true });
        outer.push({ key: p.key, drawn: own[k], color: i.color, opacity: PART_SHADES[k % PART_SHADES.length], label: p.label, parent: i.key, onOpen: p.onOpen });
      });
    } else {
      outer.push({ key: `${i.key}:place`, drawn: wide, color: "transparent", opacity: 0, air: true });
    }
    if (gaps) {
      inner.push({ key: `${i.key}:air`, drawn: SLICE_GAP, color: "transparent", opacity: 0, air: true });
      outer.push({ key: `${i.key}:air`, drawn: SLICE_GAP, color: "transparent", opacity: 0, air: true });
    }
  });

  const share = (i: DonutItem) => {
    const slice = slices.find((s) => s.key === i.key);
    return slice && total > 0 ? (slice.value / total) * 100 : null;
  };
  const partOf = (key: string | null) => slices.flatMap((i) => (split(i) ? i.parts!.map((p) => ({ ...p, parent: i.key })) : [])).find((p) => p.key === key);
  const part = partOf(hovered);
  const focus = part ?? sorted.find((i) => i.key === hovered);
  const focusShare = part ? (total > 0 ? (part.value / total) * 100 : null) : focus ? share(focus as DonutItem) : null;
  // A slice is lit with its parts, a part with its slice.
  const lit = (s: Segment) => !hovered || hovered === s.key || hovered === s.parent || part?.parent === s.key;
  const ring = (segments: Segment[]) => segments.map((s) => (
    <Cell
      key={s.key}
      fill={s.color}
      fillOpacity={s.air ? 0 : s.opacity * (lit(s) ? 1 : 0.28)}
      stroke="none"
      cursor={s.onOpen ? "pointer" : "default"}
      onMouseEnter={() => !s.air && setHovered(s.key)}
      onClick={s.onOpen}
    />
  ));
  // From the top, clockwise.
  const angles = { startAngle: 90, endAngle: -270 };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[210px_minmax(0,1fr)] gap-[26px] items-center">
      <div className="relative w-full max-w-[210px] aspect-square mx-auto">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 210, height: 210 }}>
          <PieChart>
            {slices.length === 0 ? (
              <Pie data={[{ key: "none", drawn: 1 }]} dataKey="drawn" innerRadius="72%" outerRadius="92%" stroke="none" isAnimationActive={false}>
                <Cell fill={TRACK} />
              </Pie>
            ) : (
              <Pie
                data={inner}
                dataKey="drawn"
                nameKey="label"
                {...angles}
                innerRadius={nested ? "70%" : "72%"}
                outerRadius={nested ? "86%" : "96%"}
                cornerRadius={slices.length > 1 ? 4 : 0}
                isAnimationActive={false}
                onMouseLeave={() => setHovered(null)}
              >
                {ring(inner)}
              </Pie>
            )}
            {nested && (
              <Pie
                data={outer}
                dataKey="drawn"
                nameKey="label"
                {...angles}
                innerRadius="90%"
                outerRadius="98%"
                cornerRadius={outer.length > 1 ? 3 : 0}
                isAnimationActive={false}
                onMouseLeave={() => setHovered(null)}
              >
                {ring(outer)}
              </Pie>
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-[24%] text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#857e78] truncate max-w-full">{focus ? focus.label : "Total"}</span>
          <span className="mt-0.5 text-lg font-bold text-[#1c1917] tabular-nums leading-tight">
            {focus && focusShare !== null ? `${focusShare.toFixed(1)}%` : slices.length ? formatCurrency(total, currency, 0) : "—"}
          </span>
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
