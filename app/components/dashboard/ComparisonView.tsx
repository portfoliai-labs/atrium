// components/dashboard/ComparisonView.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowUpRight, ChevronLeft, ChevronRight, Info, Loader2, X } from "lucide-react";
import { portfoliosService } from "../../services/portfoliosService";
import { ApiError } from "../../services/apiClient";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { investmentsKey, usePortfolio } from "../../context/PortfolioContext";
import { CATEGORICAL_PALETTE, portfolioColorMap } from "../../lib/chartColors";
import { formatCurrency } from "../../lib/format";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { VirtualBadge } from "./BacktestMarks";
import { CompareMetrics } from "./CompareMetrics";
import { AllocationModule, CumulativeReturnsModule, ReturnsByWindowModule, RiskReturnModule } from "./CompareCharts";
import type { Portfolio } from "../../models/Portfolio";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";

// A strategy compared beside the user's portfolios: one of their backtests, a published strategy
// of the catalog (its portfolioUuid), or the backtest a strategy their advisor shared came from.
// The backend reads it like their own (GET /v1/portfolios/comparison takes any portfolio they can
// read); `name` is shown until the comparison names it.
export interface CompareStrategy {
  uuid: string;
  name: string;
}

// Same isStale contract as the rest of the dashboard (see useAnalytics in PerformanceSection).
const STALE_POLL_INTERVAL_MS = 15_000;
const STALE_TIMEOUT_MS = 5 * 60_000;

/**
 * COMPARISON VIEW — the investments' Compare (see PortfoliosCompare): every one of the user's
 * portfolios (`candidates`), nothing to pick, as a card on top (CompareCards) that says whose
 * colour is whose, and all of them side by side under them (GET /v1/portfolios/comparison):
 * the cumulative returns first, a module per subject (CompareMetrics), the returns window by window
 * beside risk against return, and how they did against the market beside the allocation
 * (CompareCharts).
 * Each portfolio keeps its colour (portfolioColorMap), the same as on the Compare module of its
 * page (CompareModule), in the portfolio list's order.
 *
 * Strategies (`strategies`: a backtest of the user's, one from the catalog, or the simulation a
 * strategy their advisor shared came from) are compared beside them, after the user's portfolios,
 * each a card with a cross to take it out and a colour past theirs. A strategy no longer readable
 * (withdrawn, no longer shared: 403, 404) is said, with the way to take it out.
 */
export function ComparisonView({
  candidates, trail, onOpen, strategies = [], onRemoveStrategy,
  emptyText = "A comparison needs two portfolios at least: add another one to compare them.",
}: {
  // The user's portfolios compared, in their order; all but the aggregate unless said.
  candidates?: Portfolio[];
  // The pages above Compare.
  trail: Crumb[];
  // Opens one portfolio's own Insights, from its column head.
  onOpen: (uuid: string) => void;
  // Strategies compared beside them (see CompareStrategy): always picked,
  // after the user's portfolios, until taken out.
  strategies?: CompareStrategy[];
  onRemoveStrategy?: (uuid: string) => void;
  // What to do with fewer than two compared.
  emptyText?: string;
}) {
  const { portfolios } = usePortfolio();
  // Never the aggregate, which is the sum of the others rather than a peer of theirs.
  const comparable = useMemo(() => (candidates ?? portfolios).filter((p) => !p.isAggregate), [candidates, portfolios]);
  // A strategy that's one of the portfolios compared is just that portfolio.
  const external = useMemo(() => strategies.filter((s) => !comparable.some((p) => p.uuid === s.uuid)), [strategies, comparable]);
  const portfolioColors = useMemo(() => portfolioColorMap(portfolios), [portfolios]);
  // The strategies take the palette's colours past the portfolios', so none repaints another.
  const colorOf = useMemo(() => (uuid: string) => {
    const i = external.findIndex((s) => s.uuid === uuid);
    return i < 0 ? portfolioColors(uuid) : CATEGORICAL_PALETTE[(comparable.length + i) % CATEGORICAL_PALETTE.length];
  }, [portfolioColors, external, comparable.length]);
  const ordered = useMemo(() => [...comparable.map((p) => p.uuid), ...external.map((s) => s.uuid)], [comparable, external]);
  const compared = ordered.length;
  const { entries, loading, failed, failedStatus, timedOut } = useComparison(ordered.join(","), compared >= 1);
  // The cards read their figures from the comparison.
  const figures = useMemo(() => (entries ? new Map(entries.map((e) => [e.portfolio.uuid, e])) : undefined), [entries]);
  // A stale column is hidden while its rebuild is expected any moment, then shown with a hint.
  const isUpdating = (e: PortfolioComparisonEntry) => e.isStale && !timedOut;
  const visible = useMemo(() => (entries ?? []).filter((e) => !(e.isStale && !timedOut)), [entries, timedOut]);

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="Compare" />
      <CompareCards
        portfolios={comparable}
        figures={figures}
        colorOf={colorOf}
        onOpen={onOpen}
        strategies={external.map((s) => ({ ...s, entry: figures?.get(s.uuid) }))}
        onRemoveStrategy={onRemoveStrategy}
      />
      {external.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-slate-500 max-w-3xl">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          A strategy&apos;s figures are its backtest&apos;s, simulated, as saved; net of trading costs, as in the catalog.
        </p>
      )}
      {failed && (failedStatus === 403 || failedStatus === 404) && external.length > 0 ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-wrap items-center gap-3 text-amber-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold flex-1 min-w-48">
            {external.length === 1 ? "This strategy can't" : "One of these strategies can't"} be compared any more: it was withdrawn from the catalog, or isn&apos;t shared with you now.
          </p>
          {onRemoveStrategy && (
            <button type="button" onClick={() => external.forEach((s) => onRemoveStrategy(s.uuid))} className="px-3 py-2 rounded-xl bg-white border border-amber-200 text-xs font-bold hover:bg-amber-100">
              Take {external.length === 1 ? "it" : "them"} out
            </button>
          )}
        </div>
      ) : compared < 2 ? (
        <div className="flex items-center justify-center text-center py-14 px-6 bg-white border border-slate-200 border-dashed rounded-4xl">
          <p className="text-slate-500 text-sm max-w-sm">{emptyText}</p>
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
          {/* How they grew first, then the figures side by side. */}
          <CumulativeReturnsModule entries={visible} colorOf={colorOf} />
          <CompareMetrics entries={entries} colorOf={colorOf} isUpdating={isUpdating} part="others" />
          {/* The same windows for everyone: what each earned over them, and for how much swing. */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ReturnsByWindowModule entries={visible} colorOf={colorOf} />
            <RiskReturnModule entries={visible} colorOf={colorOf} />
          </div>
          {/* How each did against the market, beside what each holds. */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
            <CompareMetrics entries={entries} colorOf={colorOf} isUpdating={isUpdating} part="benchmark" />
            <AllocationModule entries={visible} colorOf={colorOf} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * COMPARE CARDS — every portfolio compared as a white card in its colour, the key to the modules
 * under them, in one row that scrolls sideways (arrows above it move it too, when it doesn't all
 * fit): its name, its value and return since inception (`figures`: the comparison's; undefined
 * while loading). A click opens its Insights.
 */
function CompareCards({ portfolios, figures, colorOf, onOpen, strategies = [], onRemoveStrategy }: {
  portfolios: Portfolio[];
  figures: Map<string, PortfolioComparisonEntry> | undefined;
  colorOf: (uuid: string) => string;
  onOpen: (uuid: string) => void;
  // The strategies compared beside the portfolios, each with its column's figures once loaded.
  strategies?: (CompareStrategy & { entry?: PortfolioComparisonEntry })[];
  onRemoveStrategy?: (uuid: string) => void;
}) {
  const { ref, canLeft, canRight, scrollBy } = useSideScroll(portfolios.length + strategies.length);
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
          const entry = figures?.get(p.uuid);
          const value = entry?.value ?? null;
          const total = entry?.performance?.totalReturnPct ?? null;
          return (
            <div
              key={p.uuid}
              className="group relative w-60 shrink-0 snap-start rounded-2xl border-2 border-slate-200 bg-white overflow-hidden transition-all hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="h-1.5" style={{ backgroundColor: colorOf(p.uuid), opacity: p.isAggregate ? 0.6 : 1 }} />
              <button
                type="button"
                onClick={() => onOpen(p.uuid)}
                aria-label={`Open ${p.name}'s insights`}
                title="Open its insights"
                className="block w-full text-left p-4 pr-11 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C49A3C]/60"
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
              <ArrowUpRight className="absolute top-4 right-3 h-4 w-4 pointer-events-none text-slate-300 group-hover:text-[#C49A3C] transition-colors" />
            </div>
          );
        })}
        {strategies.map((s) => (
          <StrategyCard key={s.uuid} strategy={s} color={colorOf(s.uuid)} onRemove={onRemoveStrategy ? () => onRemoveStrategy(s.uuid) : undefined} />
        ))}
      </div>
      <div className={`pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-[#F7F5EF] to-transparent transition-opacity ${canLeft ? "opacity-100" : "opacity-0"}`} />
      <div className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-[#F7F5EF] to-transparent transition-opacity ${canRight ? "opacity-100" : "opacity-0"}`} />
      </div>
    </div>
  );
}

/**
 * A strategy's card, compared though it isn't the user's: its name and return from
 * its column (a simulation's, so no value of the user's), and a cross to take it out.
 */
function StrategyCard({ strategy, color, onRemove }: {
  strategy: CompareStrategy & { entry?: PortfolioComparisonEntry };
  color: string;
  onRemove?: () => void;
}) {
  const name = strategy.entry?.portfolio.name ?? strategy.name;
  const total = strategy.entry?.performance?.totalReturnPct ?? null;
  return (
    <div className="relative w-60 shrink-0 snap-start rounded-2xl border-2 border-slate-200 bg-white overflow-hidden">
      <div className="h-1.5" style={{ backgroundColor: color }} />
      <div className="p-4 pr-11">
        <span className="block text-base font-black text-slate-900 truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{name}</span>
        <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">Strategy · simulated</span>
        <span className="block mt-2 text-xs font-bold tabular-nums">
          {total === null
            ? <span className="text-slate-400 font-semibold">{strategy.entry ? "No return yet" : "…"}</span>
            : <><span className={total >= 0 ? "text-emerald-600" : "text-rose-600"}>{total >= 0 ? "+" : ""}{total.toFixed(2)}%</span><span className="text-slate-400 font-semibold"> since inception</span></>}
        </span>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Take ${name} out of the comparison`}
          title="Take it out"
          className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
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

/**
 * Reads the comparison for the given (comma-joined) uuids, once `enabled`, again every
 * STALE_POLL_INTERVAL_MS while any column is stale, for up to STALE_TIMEOUT_MS from the first
 * stale answer of this visit. `timedOut` means stale columns should now be drawn anyway, with a hint. Another
 * selection keeps the previous columns up while it loads, so the page doesn't flash.
 */
function useComparison(uuidsKey: string, enabled: boolean) {
  const { client } = usePortfolio();
  const clientUuid = client?.uuid ?? null;
  const queryClient = useQueryClient();
  const uuids = uuidsKey ? uuidsKey.split(",") : [];
  const queryKey = investmentsKey("comparison", clientUuid ?? "own", "compare", uuids);
  const read = useQuery({
    queryKey,
    queryFn: async (): Promise<Compared> => {
      const entries = await portfoliosService.compare(uuids, clientUuid);
      if (!entries.some((e) => e.isStale)) return { entries, staleSince: null, timedOut: false };
      // Stale since the answer before, if it was and it's the last tick's (not an earlier visit's).
      const before = queryClient.getQueryState<Compared>(queryKey);
      const polling = before?.data && Date.now() - before.dataUpdatedAt < 2 * STALE_POLL_INTERVAL_MS;
      const staleSince = (polling ? before.data?.staleSince : null) ?? Date.now();
      return { entries, staleSince, timedOut: Date.now() - staleSince >= STALE_TIMEOUT_MS };
    },
    enabled: enabled && uuids.length >= 1,
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.staleSince != null && !query.state.data.timedOut ? STALE_POLL_INTERVAL_MS : false),
  });

  // `failedStatus`: the refusal's HTTP status, when it was one (403, 404: a strategy not readable
  // any more).
  return {
    entries: read.isError ? null : read.data?.entries ?? null,
    loading: read.isPending || read.isPlaceholderData,
    failed: read.isError,
    failedStatus: read.error instanceof ApiError ? read.error.status : undefined,
    timedOut: !read.isError && !!read.data?.timedOut,
  };
}

/** The comparison as read, and since when some column has been stale (null: none is). */
interface Compared {
  entries: PortfolioComparisonEntry[];
  staleSince: number | null;
  timedOut: boolean;
}
