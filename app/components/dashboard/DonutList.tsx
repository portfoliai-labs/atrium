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
  // Counted in the donut and the shares: in the total's currency (or with `inTotal`), and worth
  // something.
  counted: boolean;
  // Its value in the donut's currency, when it is listed in another (converted): its slice and share.
  inTotal?: number;
  color: string;
  onOpen?: () => void;
  // What it is one of (a wallet's account): on a thin outer ring, an arc over its group's slices,
  // which sit together.
  group?: DonutGroup;
}

export interface DonutGroup {
  key: string;
  label: string;
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

// The space between slices (more between groups than within one), as shares of the circle: air,
// not a drawn edge.
const SLICE_GAP = 0.012;
const GROUP_GAP = 0.022;
// The groups' arcs: one quiet tone for all, a bracket over their slices rather than a series.
const GROUP_COLOR = "#A8A29E";
const TRACK = "#EEE9DD";

// A segment of a ring as drawn: a slice, a group's arc, the air between them, or (on the outer
// ring) the place of slices in no group.
type Segment = { key: string; drawn: number; color: string; label?: string; group?: string; onOpen?: () => void; air?: true };

/**
 * DONUT LIST — the parts of a whole (All portfolios' portfolios, Liquidity's wallets) on a donut and
 * in a list beside it, each with its value and share, a slice or a row opening that part's page.
 * Shares are of the counted parts' total, in `currency`; a part not counted (another currency
 * with no `inTotal`, a card in debt, a value not known yet) is listed, without a share. Parts of a
 * group (a bank's wallets) sit together, the groups largest first, and a thin outer ring draws an
 * arc over each group's slices, hovered as they are (its share, its name). Slices start at the
 * top, clockwise, with air between them and rounded ends; each is drawn at least
 * MIN_DRAWN_SHARE wide (drawnShares).
 */
export function DonutList({ items, currency }: { items: DonutItem[]; currency: string }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const amount = (i: DonutItem) => (i.counted ? i.inTotal ?? i.value ?? 0 : 0);
  const counted = (i: DonutItem) => amount(i) > 0;
  const groupKey = (i: DonutItem) => i.group?.key ?? `item:${i.key}`;
  const groupTotals = new Map<string, number>();
  for (const i of items) groupTotals.set(groupKey(i), (groupTotals.get(groupKey(i)) ?? 0) + (counted(i) ? amount(i) : 0));
  // The counted first; a group's together, the largest group first, then by value within it.
  const sorted = [...items].sort((a, b) =>
    Number(counted(b)) - Number(counted(a))
    || groupTotals.get(groupKey(b))! - groupTotals.get(groupKey(a))!
    || groupKey(a).localeCompare(groupKey(b))
    || amount(b) - amount(a) || (b.value ?? 0) - (a.value ?? 0));
  const slices = sorted.filter(counted);
  const total = slices.reduce((s, i) => s + amount(i), 0);
  const grouped = slices.some((i) => i.group);

  // Air after each slice: more where the next is another group's.
  const after: number[] = slices.map((i, n) => (slices.length < 2 ? 0 : groupKey(slices[(n + 1) % slices.length]) === groupKey(i) ? SLICE_GAP : GROUP_GAP));
  const air = after.reduce((s, g) => s + g, 0);
  const drawn = drawnShares(slices.map(amount)).map((d) => d * (1 - air));
  const inner: Segment[] = [];
  const outer: Segment[] = [];
  slices.forEach((i, n) => {
    inner.push({ key: i.key, drawn: drawn[n], color: i.color, label: i.label, group: i.group?.key, onOpen: i.onOpen });
    if (after[n]) inner.push({ key: `${i.key}:air`, drawn: after[n], color: "transparent", air: true });
    const first = n === 0 || groupKey(slices[n - 1]) !== groupKey(i);
    if (!first) return;
    // The group's arc, from its first slice to its last (n to last): them and the air between.
    let last = n;
    while (last + 1 < slices.length && groupKey(slices[last + 1]) === groupKey(i)) last++;
    let wide = 0;
    for (let k = n; k <= last; k++) wide += drawn[k] + (k < last ? after[k] : 0);
    outer.push(i.group
      ? { key: `group:${i.group.key}`, drawn: wide, color: GROUP_COLOR, label: i.group.label, group: i.group.key }
      : { key: `${i.key}:place`, drawn: wide, color: "transparent", air: true });
    if (after[last]) outer.push({ key: `${i.key}:group-air`, drawn: after[last], color: "transparent", air: true });
  });

  const hoveredGroup = hovered?.startsWith("group:") ? hovered.slice("group:".length) : null;
  const share = (i: DonutItem) => (counted(i) && total > 0 ? (amount(i) / total) * 100 : null);
  const focusGroup = hoveredGroup ? slices.find((i) => i.group?.key === hoveredGroup)?.group : undefined;
  const focus = sorted.find((i) => i.key === hovered);
  const focusShare = focusGroup
    ? (total > 0 ? ((groupTotals.get(focusGroup.key) ?? 0) / total) * 100 : null)
    : focus ? share(focus) : null;
  const hoveredItemGroup = focus?.group?.key;
  // A slice is lit with its group's arc, an arc with its slices.
  const lit = (s: Segment) => !hovered || hovered === s.key || (!!hoveredGroup && s.group === hoveredGroup) || (s.key.startsWith("group:") && s.group === hoveredItemGroup);
  const ring = (segments: Segment[]) => segments.map((s) => (
    <Cell
      key={s.key}
      fill={s.color}
      fillOpacity={s.air ? 0 : lit(s) ? 1 : 0.28}
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
                innerRadius={grouped ? "68%" : "72%"}
                outerRadius={grouped ? "90%" : "96%"}
                cornerRadius={slices.length > 1 ? 4 : 0}
                isAnimationActive={false}
                onMouseLeave={() => setHovered(null)}
              >
                {ring(inner)}
              </Pie>
            )}
            {grouped && (
              <Pie
                data={outer}
                dataKey="drawn"
                nameKey="label"
                {...angles}
                innerRadius="94%"
                outerRadius="98%"
                cornerRadius={2}
                isAnimationActive={false}
                onMouseLeave={() => setHovered(null)}
              >
                {ring(outer)}
              </Pie>
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-[24%] text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#857e78] truncate max-w-full">{focusGroup?.label ?? focus?.label ?? "Total"}</span>
          <span className="mt-0.5 text-lg font-bold text-[#1c1917] tabular-nums leading-tight">
            {(focusGroup || focus) && focusShare !== null ? `${focusShare.toFixed(1)}%` : slices.length ? formatCurrency(total, currency, 0) : "—"}
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
          const row = `w-full flex items-center gap-3 px-2.5 py-[11px] rounded-[14px] text-left transition-colors ${index < sorted.length - 1 ? "border-b border-[#EEE9DD]" : ""} ${hovered === i.key || (!!hoveredGroup && i.group?.key === hoveredGroup) ? "bg-[#F7F5EF]" : ""}`;
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
