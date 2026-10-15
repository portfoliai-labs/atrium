// components/dashboard/PortfolioHolder.tsx
"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Loader2, Plus } from "lucide-react";
import { AreaChart, Area, LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { formatCurrency } from "../../lib/format";
import { toChartPoints } from "../../lib/series";
import { VirtualBadge } from "./BacktestMarks";
import type { Portfolio } from "../../models/Portfolio";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";

// Geometry, in px: each card's edge showing above the next one, how far a card slides out (and
// so how much more of it shows), and the sleeve the cards sit in.
const STRIP = 44;
const LIFT = 104;
const SLEEVE = 132;

const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;
const formatPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;

/** One card in the holder: a portfolio, or anything shaped like one (the sample real estate). */
export interface HolderItem {
  key: string;
  name: string;
  color: string;
  // Next to the name: "Default", "Combined", "Preview"…
  badge?: React.ReactNode;
  // On its edge: its value; undefined while loading, null when there's none yet.
  value: string | null | undefined;
  // Counted in the sleeve's total when set (every counted card in one currency).
  amount?: { value: number; currency: string };
  // What pulling it out shows: a big figure and what it is, with a curve…
  headline: string | null;
  caption?: string;
  points: { value: number }[];
  // …or, without a headline, why there's none.
  empty: string;
  // The action it leads to, under the figures ("Open" by default).
  cta?: string;
  // A card that makes something rather than opening it (New portfolio): drawn as an empty slot.
  add?: boolean;
  onOpen: () => void;
}

/**
 * CARD HOLDER — cards gathered like in a card holder, on the Investments and Wallets hubs (beside
 * a FeaturedCard): the portfolios or wallets other than the largest, with at the front the card that
 * adds one, and what's made of them together (`tone: "virtual"`: the virtual portfolios, all wallets). Each is a card in its own colour, stacked with only its top edge (name and
 * value) showing above the next, all tucked into a white sleeve (white like every asset card,
 * apart from the tools' dark ones) with a band across it: the app's gold, or the virtual
 * portfolios' blue (BacktestMarks). Moving over a card (or focusing it with
 * the keyboard) slides it up out of the sleeve, the cards behind it following, into the room kept
 * above the stack, and the card shows what a hub card would (a return and the
 * curve behind it). A click opens it; on a touch screen the first tap pulls the
 * card out and the second opens it.
 */
export function PortfolioHolder({ items, label, tone = "real" }: { items: HolderItem[]; label: string; tone?: "real" | "virtual" }) {
  const [active, setActive] = useState<number | null>(null);
  const n = items.length;
  const height = LIFT + n * STRIP + SLEEVE;

  // The sleeve's total: every counted card's amount, when they're all in one currency.
  const total = useMemo(() => {
    const amounts = items.map((i) => i.amount).filter((a) => a !== undefined);
    if (amounts.length === 0 || new Set(amounts.map((a) => a.currency)).size !== 1) return null;
    return formatCurrency(amounts.reduce((s, a) => s + a.value, 0), amounts[0].currency, 0);
  }, [items]);

  return (
    <div
      className="relative mx-auto w-full max-w-md select-none"
      style={{ height }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") setActive(null); }}
    >
      {/* The cards, cut off just above the sleeve's bottom, so none shows under it. */}
      <div className="absolute inset-0" style={{ clipPath: "inset(-16px -16px 24px -16px)" }}>
        {items.map((item, i) => (
          <HolderCard
            key={item.key}
            item={item}
            index={i}
            height={height}
            // Slid out: this card and every card behind it go up together, so it shows in full.
            lifted={active !== null && i <= active}
            open={active === i}
            onHover={() => setActive(i)}
            onOpen={(touch) => {
              if (touch && active !== i) setActive(i);
              else item.onOpen();
            }}
          />
        ))}
      </div>

      {/* The sleeve, in front of every card: the band across it, as on the wallet it's modelled on. */}
      <div
        className="absolute inset-x-0 bottom-0 rounded-3xl bg-white border border-slate-200 shadow-[0_-6px_16px_rgba(28,25,23,0.10)] pointer-events-none"
        style={{ height: SLEEVE, zIndex: n + 10 }}
      >
        <div className="absolute inset-x-0 top-10 h-9 bg-[#F7F5EF] border-y border-slate-200 flex items-center justify-center">
          <span className={`px-4 h-full flex items-center text-[11px] font-black uppercase tracking-[0.14em] ${tone === "virtual" ? "bg-sky-500 text-white" : "bg-[#C49A3C] text-[#131210]"}`}>
            {label}
          </span>
        </div>
        <div className="absolute inset-x-5 bottom-4 flex items-end justify-between gap-3">
          <p className="text-[11px] font-semibold text-slate-400">Hover a card to pull it out</p>
          {total && <p className="text-lg font-black text-slate-900 tabular-nums" style={serif}>{total}</p>}
        </div>
      </div>
    </div>
  );
}

function HolderCard({
  item, index, height, lifted, open, onHover, onOpen,
}: {
  item: HolderItem;
  index: number;
  height: number;
  lifted: boolean;
  open: boolean;
  onHover: () => void;
  onOpen: (touch: boolean) => void;
}) {
  const [touch, setTouch] = useState(false);

  return (
    <button
      type="button"
      aria-label={`Open ${item.name}`}
      onPointerDown={(e) => setTouch(e.pointerType !== "mouse")}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") onHover(); }}
      onFocus={onHover}
      onClick={() => onOpen(touch)}
      className={`absolute inset-x-3 flex flex-col justify-start rounded-2xl text-left shadow-[0_-2px_8px_rgba(0,0,0,0.18)] outline-none focus-visible:ring-2 focus-visible:ring-white/70 motion-safe:transition-transform motion-safe:duration-300 ease-out ${
        item.add ? "bg-[#FBFAF6] border-2 border-dashed border-[#C49A3C]/60 text-[#a07a26]" : "text-white"
      }`}
      style={{
        top: LIFT + index * STRIP,
        height,
        zIndex: index + 1,
        transform: `translateY(${lifted ? -LIFT : 0}px)`,
        background: item.add ? undefined : `linear-gradient(135deg, ${item.color} 0%, color-mix(in srgb, ${item.color} 55%, #0b0a09) 100%)`,
      }}
    >
      <span className="flex items-center justify-between gap-3 px-4 w-full" style={{ height: STRIP }}>
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-[15px] font-black truncate" style={serif}>{item.name}</span>
          {item.badge}
        </span>
        <span className={`text-[13px] font-black tabular-nums shrink-0 ${item.add ? "" : "text-white/90"}`}>
          {item.add ? <Plus className="h-4 w-4" /> : item.value === undefined ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : item.value ?? "—"}
        </span>
      </span>

      {/* What pulling it out shows: the rest of a hub card. */}
      <span
        className={`flex items-end justify-between gap-4 px-4 pb-4 w-full motion-safe:transition-opacity motion-safe:duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        style={{ height: LIFT }}
        aria-hidden={!open}
      >
        <span className="min-w-0">
          {item.headline === null ? (
            <span className={`block text-[13px] font-semibold ${item.add ? "text-slate-500" : "text-white/70"}`}>{item.empty}</span>
          ) : (
            <>
              <span className="block text-2xl font-black tabular-nums" style={serif}>{item.headline}</span>
              {item.caption && <span className="block text-[11px] font-semibold text-white/60">{item.caption}</span>}
            </>
          )}
          <span className={`mt-2 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider ${item.add ? "" : "text-white/80"}`}>
            {item.cta ?? "Open"} <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </span>
        {item.points.length >= 2 && (
          <span className="block w-28 h-12 shrink-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 112, height: 48 }}>
              <LineChart data={item.points} margin={{ top: 4, right: 2, left: 2, bottom: 4 }}>
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Line type="monotone" dataKey="value" stroke="#ffffff" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </span>
        )}
      </span>
    </button>
  );
}

/** A portfolio as a holder card, from its column of GET /v1/portfolios/comparison (undefined: loading). */
export function portfolioHolderItem(
  portfolio: Portfolio, color: string, entry: PortfolioComparisonEntry | null | undefined, onOpen: () => void,
): HolderItem {
  const value = entry?.value ?? null;
  const totalReturn = entry?.performance?.totalReturnPct ?? null;
  const series = entry?.performance?.cumulativeReturnPct;
  return {
    key: portfolio.uuid,
    name: portfolio.name,
    color,
    badge: portfolio.isVirtual
      ? <VirtualBadge portfolio={portfolio} dark />
      : portfolio.isDefault
        ? <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-white/15 text-[9px] font-black uppercase tracking-wider">Default</span>
        : undefined,
    value: entry === undefined ? undefined : value ? formatCurrency(value.marketValue, value.currency, 0) : null,
    // Simulated or already a sum: only a real portfolio's value counts in the sleeve's total.
    amount: value && !portfolio.isVirtual ? { value: value.marketValue, currency: value.currency } : undefined,
    headline: value && totalReturn !== null ? formatPct(totalReturn) : null,
    caption: "since inception",
    points: series ? toChartPoints(series, 120) : [],
    empty: portfolio.isAggregate
      ? "The combined figures are being prepared — check back in a few minutes."
      : portfolio.isVirtual
        ? "Backtest running — its figures show up in a few minutes."
        : value
          ? "Not enough history for a return yet."
          : "No figures yet — add transactions to get started.",
    onOpen,
  };
}

/** One figure under a featured card's value. */
export interface FeaturedFigure {
  label: string;
  value: string;
  tone?: "gain" | "loss";
}

/**
 * FEATURED CARD — the first card of a hub row laid out around card holders (Investments,
 * Wallets): the largest of them on a big card, stretched to the row's height (the holders' included,
 * with the room above their stacks). Its value, a line about how it's doing, a couple of figures,
 * and its curve filling the rest. Opens it. `value` undefined while loading, null when there's
 * nothing yet (`empty` says why).
 */
export function FeaturedCard({
  eyebrow, name, badge, color, value, line, figures, points, empty, onOpen, className = "",
}: {
  eyebrow: string;
  name: string;
  badge?: React.ReactNode;
  color: string;
  value: string | null | undefined;
  line?: React.ReactNode;
  figures: FeaturedFigure[];
  points: { value: number }[];
  empty: string;
  onOpen: () => void;
  // Its place in the row (a wider span, when it stands alone).
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${className} group self-stretch min-h-80 w-full text-left bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden transition-all hover:border-[#C49A3C]/50 hover:shadow-md outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40`}
    >
      <span className="h-1.5 w-full shrink-0" style={{ background: color }} />
      {/* Little room under the curve: it runs close to the card's bottom edge. */}
      <span className="px-5 pt-5 pb-2 md:px-6 md:pt-6 md:pb-3 flex flex-col gap-5 flex-1 w-full">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1">{eyebrow}</span>
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-xl font-black text-slate-900 truncate" style={serif}>{name}</span>
              {badge}
            </span>
          </span>
          <span className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 text-slate-400 group-hover:bg-[#C49A3C] group-hover:text-white transition-colors shrink-0">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </span>

        {value === undefined ? (
          <span className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" /></span>
        ) : value === null ? (
          <span className="flex-1 flex items-end text-[13px] font-semibold text-slate-400">{empty}</span>
        ) : (
          <>
            <span>
              <span className="block text-3xl md:text-4xl font-black text-slate-900 tabular-nums" style={serif}>{value}</span>
              {line && <span className="block text-[13px] font-bold tabular-nums mt-1.5">{line}</span>}
            </span>
            {figures.length > 0 && (
              <span className="grid grid-cols-2 gap-3">
                {figures.map((f) => (
                  <span key={f.label} className="min-w-0">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{f.label}</span>
                    <span className={`block text-sm font-black tabular-nums mt-0.5 truncate ${f.tone === "gain" ? "text-emerald-600" : f.tone === "loss" ? "text-rose-600" : "text-slate-900"}`}>{f.value}</span>
                  </span>
                ))}
              </span>
            )}
            {points.length >= 2 && (
              <span className="block flex-1 min-h-32 -mx-2">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 160 }}>
                  <AreaChart data={points} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <YAxis hide domain={["auto", "auto"]} />
                    <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.1} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </span>
            )}
          </>
        )}
      </span>
    </button>
  );
}
