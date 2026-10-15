// components/dashboard/ComparisonView.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowUpRight, Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { portfoliosService } from "../../services/portfoliosService";
import { usePortfolio } from "../../context/PortfolioContext";
import { portfolioColorMap } from "../../lib/chartColors";
import { formatCurrency } from "../../lib/format";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { VirtualBadge } from "./BacktestMarks";
import { CompareMetrics, type CompareEntry } from "./CompareMetrics";
import { AllocationModule, CumulativeReturnsModule } from "./CompareCharts";
import { useRealEstate, useRealEstateOverview } from "../../context/RealEstateContext";
import { PreviewBadge } from "../preview/PreviewKit";
import type { Portfolio } from "../../models/Portfolio";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";
import type { RealEstateOverview } from "../../models/RealEstate";

// More columns than this stop fitting a comparison table a person can read across.
export const MAX_COMPARED = 4;

// The real estate's column: picked like a portfolio, by this id in the selection.
export const REAL_ESTATE_COLUMN = "real-estate";
// Wealth's real estate colour.
const REAL_ESTATE_COLOR = "#eb6834";

/** The real estate as a column of Compare: its value and what went into it, all of it real estate. */
function realEstateEntry(o: RealEstateOverview): CompareEntry {
  return {
    portfolio: { uuid: REAL_ESTATE_COLUMN, name: "Real estate", isAggregate: false, isVirtual: false } as Portfolio,
    isStale: false,
    value: {
      valuedAt: new Date().toISOString(), currency: o.currency, marketValue: o.value, investedCapital: o.invested,
      unrealizedPnl: o.value - o.invested, realizedPnl: 0, dividendIncome: 0, netContributed: o.invested, tradingCosts: 0,
    },
    performance: null,
    volatility: null,
    allocation: [{ assetClass: "REAL_ESTATE", weightPct: 100, marketValue: o.value }],
    dividends: null,
    tradingCosts: null,
    benchmark: null,
    realEstate: o,
  };
}

const SELECTION_KEY = "compare_selected_portfolio_uuids";
// Same isStale contract as the rest of the dashboard (see useAnalytics in PerformanceSection).
const STALE_POLL_INTERVAL_MS = 15_000;
const STALE_TIMEOUT_MS = 5 * 60_000;

const readSelection = (): string[] | null => {
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : null;
  } catch {
    return null;
  }
};

/** Remembers the compared portfolios in this browser, for the next time Compare is opened. */
export const rememberCompareSelection = (uuids: string[]) => {
  try {
    localStorage.setItem(SELECTION_KEY, JSON.stringify(uuids));
  } catch {
    // Private mode or blocked storage: the selection just isn't remembered.
  }
};

/**
 * What Compare starts from: the portfolio being looked at, then the ones remembered from last
 * time, then the other portfolios in list order until there are two. Never the aggregate ("All
 * portfolios"): it's the sum of the others, not a peer of theirs. Capped at MAX_COMPARED.
 */
export function initialCompareSelection(portfolios: Portfolio[], currentUuid: string | null): string[] {
  // The real estate is kept when remembered: Compare leaves it out where it isn't offered.
  const known = new Set([...portfolios.filter((p) => !p.isAggregate).map((p) => p.uuid), REAL_ESTATE_COLUMN]);
  const current = portfolios.find((p) => p.uuid === currentUuid && !p.isAggregate);
  const picked = [...(current ? [current.uuid] : []), ...(readSelection() ?? []).filter((u) => known.has(u))];
  const unique = [...new Set(picked)];
  for (const p of portfolios) {
    if (unique.length >= 2) break;
    if (!p.isAggregate && !unique.includes(p.uuid)) unique.push(p.uuid);
  }
  return unique.slice(0, MAX_COMPARED);
}

/**
 * COMPARISON VIEW — "All portfolios / Compare" (see WealthSection): every portfolio as a
 * card on top (CompareCards), picked or not with a click, up to MAX_COMPARED; the picked ones side
 * by side under them (GET /v1/portfolios/comparison): a module per subject (CompareMetrics), the cumulative
 * returns and the allocation (CompareCharts), all following the cards. Each portfolio keeps its colour
 * (portfolioColorMap), so changing the selection never repaints the others. Columns follow the
 * portfolio list's order, not the order they were picked in, so they don't shuffle.
 *
 * Where the investor's real estate is theirs to see (`onOpenRealEstate`), it's offered too, as a
 * last card and column (in Wealth's orange): filled where it means something (value, debt, equity,
 * rents, 100% real estate), "—" for returns, risk and the benchmark, and never a row's best.
 */
export function ComparisonView({
  selection, onToggle, trail, onOpen, onOpenRealEstate,
}: {
  selection: string[];
  // Adds a portfolio to the comparison, or takes it out.
  onToggle: (uuid: string) => void;
  // The pages above Compare ("Investments").
  trail: Crumb[];
  // Opens one portfolio's own Insights, from its column head.
  onOpen: (uuid: string) => void;
  // Opens the real estate; offers it as a column where given.
  onOpenRealEstate?: () => void;
}) {
  const { portfolios } = usePortfolio();
  const { available: realEstateAvailable, sample: realEstateSample } = useRealEstate();
  const realEstateShown = !!onOpenRealEstate && realEstateAvailable;
  const realEstate = useRealEstateOverview(realEstateShown);
  // Offered once there's a property; null: there is, but it can't be added up (a rate missing).
  const realEstateOffered = realEstateShown && realEstate !== undefined && (realEstate === null || realEstate.propertyCount > 0);
  const realEstatePicked = realEstateOffered && !!realEstate && selection.includes(REAL_ESTATE_COLUMN);
  const portfolioColors = useMemo(() => portfolioColorMap(portfolios), [portfolios]);
  const colorOf = useMemo(() => (uuid: string) => (uuid === REAL_ESTATE_COLUMN ? REAL_ESTATE_COLOR : portfolioColors(uuid)), [portfolioColors]);
  // Every portfolio but the aggregate, which is the sum of the others rather than a peer of theirs.
  const comparable = useMemo(() => portfolios.filter((p) => !p.isAggregate), [portfolios]);
  const ordered = useMemo(() => comparable.filter((p) => selection.includes(p.uuid)).map((p) => p.uuid), [comparable, selection]);
  const cardFigures = useAllFigures(portfolios.map((p) => p.uuid).join(","));
  const picked = ordered.length + (realEstatePicked ? 1 : 0);
  const { entries: portfolioEntries, loading, failed, timedOut } = useComparison(ordered.join(","), picked >= 2);
  // The real estate's column last, after the portfolios'.
  const entries = useMemo<CompareEntry[] | null>(
    () => (portfolioEntries ? [...portfolioEntries, ...(realEstatePicked && realEstate ? [realEstateEntry(realEstate)] : [])] : null),
    [portfolioEntries, realEstatePicked, realEstate],
  );
  // A stale column is hidden while its rebuild is expected any moment, then shown with a hint.
  const isUpdating = (e: PortfolioComparisonEntry) => e.isStale && !timedOut;
  const visible = useMemo(() => (entries ?? []).filter((e) => !(e.isStale && !timedOut)), [entries, timedOut]);

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="Compare" />
      <CompareCards
        portfolios={comparable}
        selection={ordered}
        picked={picked}
        figures={cardFigures}
        colorOf={colorOf}
        onToggle={onToggle}
        onOpen={onOpen}
        realEstate={realEstateOffered ? { overview: realEstate ?? null, picked: realEstatePicked, sample: realEstateSample, onOpen: onOpenRealEstate! } : undefined}
      />
      {picked < 2 ? (
        <div className="flex items-center justify-center text-center py-14 px-6 bg-white border border-slate-200 border-dashed rounded-4xl">
          <p className="text-slate-500 text-sm max-w-sm">
            {picked === 1
              ? `Pick one more ${realEstateOffered ? "card" : "portfolio"} above to compare them.`
              : `Pick at least two ${realEstateOffered ? "cards" : "portfolios"} above to compare them.`}
          </p>
        </div>
      ) : loading && entries === null ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" />
        </div>
      ) : failed || entries === null ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">Failed to load the comparison. Try again in a moment.</p>
        </div>
      ) : (
        // Dimmed while a new selection loads over the previous one.
        <div className={`space-y-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {timedOut && entries.some((e) => e.isStale) && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              <p className="text-xs font-bold">An update is taking longer than usual — some figures below may be out of date.</p>
            </div>
          )}
          <CompareMetrics entries={entries} colorOf={colorOf} isUpdating={isUpdating} />
          <CumulativeReturnsModule entries={visible} colorOf={colorOf} />
          <AllocationModule entries={visible} colorOf={colorOf} />
        </div>
      )}
    </div>
  );
}

/**
 * COMPARE CARDS — every portfolio as a white card in its colour, in one row that scrolls sideways
 * (arrows above it move it too, when it doesn't all fit): its name, its value and return
 * since inception (`figures`: every portfolio's, from one call; undefined while loading), and a
 * check when it's compared. A click picks it or takes it out (none left to pick past
 * MAX_COMPARED); the arrow opens its Insights. The real estate, where offered, is the last card:
 * its value and its equity, the arrow opening its page.
 */
function CompareCards({ portfolios, selection, picked, figures, colorOf, onToggle, onOpen, realEstate }: {
  portfolios: Portfolio[];
  selection: string[];
  // How many columns are picked, the real estate included.
  picked: number;
  figures: Map<string, PortfolioComparisonEntry> | undefined;
  colorOf: (uuid: string) => string;
  onToggle: (uuid: string) => void;
  onOpen: (uuid: string) => void;
  // overview null: it can't be added up (a rate missing), so it can't be picked.
  realEstate?: { overview: RealEstateOverview | null; picked: boolean; sample: boolean; onOpen: () => void };
}) {
  const full = picked >= MAX_COMPARED;
  const { ref, canLeft, canRight, scrollBy } = useSideScroll(portfolios.length + (realEstate ? 1 : 0));
  return (
    <div>
      {(canLeft || canRight) && (
        <div className="flex justify-end px-1 mb-3">
          <div className="flex items-center gap-1.5">
            {([["left", canLeft, ChevronLeft], ["right", canRight, ChevronRight]] as const).map(([side, enabled, Icon]) => (
              <button
                key={side}
                type="button"
                onClick={() => scrollBy(side === "left" ? -1 : 1)}
                disabled={!enabled}
                aria-label={side === "left" ? "Previous portfolios" : "More portfolios"}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 flex items-center justify-center shadow-sm hover:border-slate-300 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      )}
      {/* One row that scrolls sideways, faded at an edge while there's more past it. The padding
          keeps a card's lift and shadow on hover from being clipped by the scroll box. */}
      <div className="relative">
      <div ref={ref} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-1 px-1 pt-1 pb-3 -mx-1 [scrollbar-width:thin]">
        {portfolios.map((p) => {
          const picked = selection.includes(p.uuid);
          const blocked = !picked && full;
          const entry = figures?.get(p.uuid);
          const value = entry?.value ?? null;
          const total = entry?.performance?.totalReturnPct ?? null;
          return (
            <div
              key={p.uuid}
              className={`group relative w-60 shrink-0 snap-start rounded-2xl border-2 bg-white overflow-hidden transition-all ${
                picked ? "border-[#C49A3C] shadow-md" : "border-slate-200 hover:border-slate-300"
              } ${blocked ? "opacity-50" : "hover:-translate-y-0.5 hover:shadow-md"}`}
            >
              <div className="h-1.5" style={{ backgroundColor: colorOf(p.uuid), opacity: p.isAggregate ? 0.6 : 1 }} />
              <button
                type="button"
                onClick={() => onToggle(p.uuid)}
                disabled={blocked}
                aria-pressed={picked}
                title={blocked ? `Up to ${MAX_COMPARED} at once: take one out to pick another` : undefined}
                className="block w-full text-left p-4 pr-11 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C49A3C]/60 disabled:cursor-not-allowed"
              >
                <span className="block text-base font-black text-slate-900 truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{p.name}</span>
                {p.isVirtual && <span className="block mt-1"><VirtualBadge portfolio={p} /></span>}
                <span className="block mt-2 text-lg font-black text-slate-900 tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {figures === undefined ? "…" : value ? formatCurrency(value.marketValue, value.currency, 0) : "—"}
                </span>
                <span className="block text-xs font-bold tabular-nums">
                  {total === null
                    ? <span className="text-slate-400 font-semibold">{figures === undefined ? " " : "No return yet"}</span>
                    : <><span className={total >= 0 ? "text-emerald-600" : "text-rose-600"}>{total >= 0 ? "+" : ""}{total.toFixed(2)}%</span><span className="text-slate-400 font-semibold"> since inception</span></>}
                </span>
              </button>
              <span className={`absolute top-4 right-3 w-6 h-6 rounded-full flex items-center justify-center border-2 pointer-events-none transition-colors ${
                picked ? "bg-[#C49A3C] border-[#C49A3C] text-white" : "border-slate-300 text-transparent"
              }`}>
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <button
                type="button"
                onClick={() => onOpen(p.uuid)}
                aria-label={`Open ${p.name}'s insights`}
                title="Open its insights"
                className="absolute bottom-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-[#C49A3C] hover:bg-[#C49A3C]/10 transition-colors"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        {realEstate && <RealEstateCard {...realEstate} blocked={!realEstate.picked && full} onToggle={() => onToggle(REAL_ESTATE_COLUMN)} />}
      </div>
      <div className={`pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-[#F7F5EF] to-transparent transition-opacity ${canLeft ? "opacity-100" : "opacity-0"}`} />
      <div className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-[#F7F5EF] to-transparent transition-opacity ${canRight ? "opacity-100" : "opacity-0"}`} />
      </div>
    </div>
  );
}

/** The real estate's card, alike a portfolio's: its value, and its equity under it. */
function RealEstateCard({ overview, picked, sample, blocked, onToggle, onOpen }: {
  overview: RealEstateOverview | null;
  picked: boolean;
  sample: boolean;
  blocked: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const disabled = blocked || overview === null;
  return (
    <div
      className={`group relative w-60 shrink-0 snap-start rounded-2xl border-2 bg-white overflow-hidden transition-all ${
        picked ? "border-[#C49A3C] shadow-md" : "border-slate-200 hover:border-slate-300"
      } ${disabled ? "opacity-50" : "hover:-translate-y-0.5 hover:shadow-md"}`}
    >
      <div className="h-1.5" style={{ backgroundColor: REAL_ESTATE_COLOR }} />
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={picked}
        title={overview === null ? "Can't be added up right now: an exchange rate is missing" : blocked ? `Up to ${MAX_COMPARED} at once: take one out to pick another` : undefined}
        className="block w-full text-left p-4 pr-11 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C49A3C]/60 disabled:cursor-not-allowed"
      >
        <span className="block text-base font-black text-slate-900 truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Real estate</span>
        {sample && <span className="block mt-1"><PreviewBadge label="Sample data" /></span>}
        <span className="block mt-2 text-lg font-black text-slate-900 tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {overview ? formatCurrency(overview.value, overview.currency, 0) : "—"}
        </span>
        <span className="block text-xs font-semibold text-slate-400 tabular-nums">
          {overview
            ? <><span className={`font-bold ${overview.equity >= 0 ? "text-slate-600" : "text-rose-600"}`}>{formatCurrency(overview.equity, overview.currency, 0)}</span> equity</>
            : "An exchange rate is missing"}
        </span>
      </button>
      <span className={`absolute top-4 right-3 w-6 h-6 rounded-full flex items-center justify-center border-2 pointer-events-none transition-colors ${
        picked ? "bg-[#C49A3C] border-[#C49A3C] text-white" : "border-slate-300 text-transparent"
      }`}>
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open the real estate"
        title="Open the real estate"
        className="absolute bottom-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-[#C49A3C] hover:bg-[#C49A3C]/10 transition-colors"
      >
        <ArrowUpRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * A sideways-scrolling row: whether there's more to the left or right of what shows (kept up to
 * date on scroll and resize, and when the number of items changes), and a way to move it by
 * most of its width.
 */
function useSideScroll(itemCount: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ canLeft: false, canRight: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({
      canLeft: el.scrollLeft > 2,
      canRight: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [itemCount]);

  const scrollBy = (direction: -1 | 1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return { ref, ...edges, scrollBy };
}

/** Every portfolio's figures for the cards, from one call (GET /v1/portfolios/comparison, none listed). */
function useAllFigures(uuidsKey: string) {
  const { client } = usePortfolio();
  const clientUuid = client?.uuid ?? null;
  const [state, setState] = useState<{ key: string; byUuid: Map<string, PortfolioComparisonEntry> } | null>(null);
  useEffect(() => {
    let cancelled = false;
    portfoliosService.compare([], clientUuid)
      .then((list) => { if (!cancelled) setState({ key: uuidsKey, byUuid: new Map(list.map((e) => [e.portfolio.uuid, e])) }); })
      .catch(() => { if (!cancelled) setState({ key: uuidsKey, byUuid: new Map() }); });
    return () => { cancelled = true; };
  }, [uuidsKey, clientUuid]);
  // The previous figures stay up while a changed list of portfolios reloads.
  return state?.byUuid;
}

/**
 * Fetches the comparison for the given (comma-joined) uuids, once `enabled` (two columns picked,
 * the real estate's maybe one of them, so one portfolio may be enough), refetching every
 * STALE_POLL_INTERVAL_MS while any column is stale, for up to STALE_TIMEOUT_MS. `timedOut`
 * means stale columns should now be drawn anyway, with a hint.
 */
function useComparison(uuidsKey: string, enabled: boolean) {
  const { client } = usePortfolio();
  const clientUuid = client?.uuid ?? null;
  const [state, setState] = useState<{ entries: PortfolioComparisonEntry[] | null; loading: boolean; failed: boolean; timedOut: boolean }>({
    entries: null, loading: true, failed: false, timedOut: false,
  });

  useEffect(() => {
    const uuids = uuidsKey ? uuidsKey.split(",") : [];
    if (!enabled || uuids.length < 1) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();

    const tick = async (isFirst: boolean) => {
      // Keep the previous columns up while a new selection loads, so the page doesn't flash.
      if (isFirst) setState((prev) => ({ ...prev, loading: true, failed: false, timedOut: false }));
      try {
        const entries = await portfoliosService.compare(uuids, clientUuid);
        if (cancelled) return;
        const anyStale = entries.some((e) => e.isStale);
        const timedOut = anyStale && Date.now() - startedAt >= STALE_TIMEOUT_MS;
        setState({ entries, loading: false, failed: false, timedOut });
        if (anyStale && !timedOut) timer = setTimeout(() => tick(false), STALE_POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) setState({ entries: null, loading: false, failed: true, timedOut: false });
      }
    };
    tick(true);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [uuidsKey, clientUuid, enabled]);

  return state;
}
