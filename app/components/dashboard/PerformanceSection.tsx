// components/dashboard/PerformanceSection.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Wallet, CircleDollarSign, Activity,
  Loader2, AlertCircle, FileText, ExternalLink,
  ArrowUpRight, ChevronLeft, ChevronRight, Info,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ReferenceDot, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Treemap,
  type TreemapNode,
} from "recharts";
import { portfolioService } from "../../services/portfolioService";
import { portfoliosService } from "../../services/portfoliosService";
import { STRATEGY_PROXIES, simulatedPeriod, targetLabel, type StrategyFrequency, type StrategyParams, type StrategyResponse } from "../../models/Strategy";
import { exchangeLabel } from "../../models/AssetSearch";
import { ApiError } from "../../services/apiClient";
import { formatCompact, formatCurrency, formatQuantity } from "../../lib/format";
import { toChartPoints } from "../../lib/series";
import { CATEGORICAL_PALETTE, portfolioColorMap } from "../../lib/chartColors";
import { usePortfolio } from "../../context/PortfolioContext";
import { useDetail, useInsights, type Insights, type SectionState } from "../../hooks/useInsights";
import { pushDashboardEntry, readDashboardEntry, type DashboardOverlay } from "../../lib/dashboardHistory";
import { NoDataEmptyState } from "./NoDataEmptyState";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { PageHeader } from "./PageHeader";
import { ExploreView, ExploreHostContext, ExplorePanel, DataTable, type DataColumn, type ExploreHeader } from "./ExploreView";
import type {
  ExposureEntryResponse, RiskModelResponse, RiskPointResponse, RiskPortfolioEntry, RiskModelUnavailableReason, WeightGapEntry,
  BenchmarkResponse, BenchmarkComponentEntry, TimeSeries, HorizonEntry, DividendsResponse, TradingCostsResponse,
  AssetDetailResponse, AssetChartRange, PeriodDashboard, MonthlyMarketEffectEntry, ValuePoint, PortfolioHoldingResponse,
  RealizedPnlResponse, RiskEventEntry, ReturnsResponse, VolatilityDetailResponse,
  PositionResponse, InsightsHoldingsModule, InsightsExposureModule, InsightsPortfoliosModule, InsightsComovementModule,
  InsightsTradingCostsModule, InsightsRealizedPnlModule, InsightsThisMonthModule,
  InsightsValueModule, InsightsVolatilityModule, InsightsFrontierModule, InsightsPerformanceResponse, PortfolioComparisonEntry,
} from "../../models/PortfolioData";

const chartDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fullDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

// Portfolio-vs-benchmark colours, shared by the chart lines, the Total Return card's markers
// and the composition bars so one colour always means the same series. The benchmark grey is
// deliberately dark enough (slate-500) to stay visible on the white card and against the
// slate-100 bar tracks.
const PORTFOLIO_COLOR = "#C49A3C";
const BENCHMARK_COLOR = "#64748b";

// Axis tick labels (months, dates, values) on every chart in this file — slate-500, since the
// lighter slate-400 they used to have washed out against the white card.
const AXIS_TICK_COLOR = "#57534e";

// Shared recharts tooltip box. The text colour is set explicitly: recharts leaves the date
// label uncoloured, so it inherits the page's text colour — near-white in dark mode (see
// globals.css) — on the tooltip's white background, making it unreadable.
const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12, color: "#334155",
};

/**
 * INSIGHTS SECTION — one portfolio's lifetime figures: a page with one module per question
 * (HistoryPage: Holdings, Profit & Loss, Costs, Performance, Risk), each opening a detail view
 * with everything else about it, and a month opening from Performance's one level further down.
 * The data comes in four calls (see useInsights), and each detail view fetches its own documents
 * when it opens. The page waits for the
 * Performance section, whose `value` says whether there's any history at all; the others fill
 * in as they arrive. Stale modules are followed through /insights/status (see useInsights).
 */
export function PerformanceSection({
  portfolioUuid, isAggregate = false, backtest = false, strategyShown = false, onNavigate, trail, pageLabel = "Insights", top, onOpenPortfolio, comparison = null,
}: {
  portfolioUuid: string; isAggregate?: boolean; onNavigate?: (section: string) => void;
  // A strategy's backtest (a virtual portfolio): its header carries BacktestBanner, and before
  // its job has run it says so rather than asking for transactions.
  backtest?: boolean;
  // A backtest whose page already says what its strategy is (a published strategy's): its
  // Insights then leave out the strategy's own modules (StrategyModules).
  strategyShown?: boolean;
  // The pages above this one in the investor's Portfolios ("Portfolios / Main portfolio"), where
  // this page is "Insights" and a month or a detail one level deeper, published to the Sidebar
  // (see Breadcrumb). Without it (an advisor's view of a client, which has its own header) the
  // trail starts at "Insights".
  trail?: Crumb[];
  // This page's own step in the trail: the portfolio's name on its page in Wealth.
  pageLabel?: string;
  // Drawn above the modules (the portfolio page's header, see WealthSection), and hidden with
  // them while a detail view or a month is open.
  top?: React.ReactNode;
  // Opens one of the aggregate's portfolios, from its Composition.
  onOpenPortfolio?: (uuid: string) => void;
  // The portfolio's side-by-side figures (GET /v1/portfolios/comparison), which the page's header
  // already loads: the returns, the drawdown and the benchmark's excess the modules show next to
  // their own. null while loading or without one; those figures are then left out.
  comparison?: PortfolioComparisonEntry | null;
}) {
  const insights = useInsights(portfolioUuid);
  const performance = insights.performance;

  // The month opened from the heatmap. Its detail lives here rather than in HistoryPage below,
  // even though only HistoryPage's content depends on it: while a month is open, its trail
  // (with the month's report link) takes the header's place, and that's rendered here. Fetched
  // again when the Performance section is (its figures come from the same stored values).
  const [selected, setSelected] = useState<{ year: number; month: number } | null>(null);
  const month = useDetail(
    selected ? () => portfolioService.getMonth(portfolioUuid, selected.year, selected.month) : null,
    selected ? `${selected.year}-${selected.month}` : "",
    performance.revision,
  );

  // A module's detail view (see ExploreView): the module draws it into `exploreSlot` and
  // reports it here, so the page can hide everything else and publish its trail instead of the
  // header's. The scroll position is kept for the way back, like the page itself.
  const [explore, setExplore] = useState<ExploreHeader | null>(null);
  const [exploreSlot, setExploreSlot] = useState<HTMLDivElement | null>(null);
  const scrollBeforeExplore = useRef(0);
  const exploreHost = useMemo(() => ({
    slot: exploreSlot,
    show: (header: ExploreHeader | null) => {
      setExplore((current) => {
        if (header && !current) scrollBeforeExplore.current = window.scrollY;
        return header;
      });
    },
  }), [exploreSlot]);
  const exploring = explore !== null;

  useEffect(() => {
    if (exploring) {
      window.scrollTo({ top: 0 });
      return;
    }
    // After the page has been shown again, so there's something to scroll back down.
    const frame = requestAnimationFrame(() => window.scrollTo({ top: scrollBeforeExplore.current }));
    return () => cancelAnimationFrame(frame);
  }, [exploring]);

  // A month opens from Performance's detail, one level further down, over it: the detail stays
  // mounted underneath (hidden), and the scroll position is kept for the way back to it.
  const scrollBeforeMonth = useRef(0);
  const openMonth = (year: number, m: number) => {
    scrollBeforeMonth.current = window.scrollY;
    setSelected({ year, month: m });
    window.scrollTo({ top: 0 });
  };
  const monthOpen = selected !== null;
  const firstMonthRun = useRef(true);
  useEffect(() => {
    if (firstMonthRun.current) {
      firstMonthRun.current = false;
      return;
    }
    if (monthOpen) return;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: scrollBeforeMonth.current }));
    return () => cancelAnimationFrame(frame);
  }, [monthOpen]);

  // The browser's back button closes a month, then a detail view: opening either adds a history
  // entry (see lib/dashboardHistory), and landing on an entry below it closes it. Closed from the
  // page (Esc, the Sidebar), it goes back past its entry, so the next back goes further up.
  const overlay: DashboardOverlay | null = selected ? "month" : explore ? "explore" : null;
  const exploreRef = useRef(explore);
  useEffect(() => {
    exploreRef.current = explore;
  }, [explore]);
  const firstOverlayRun = useRef(true);
  useEffect(() => {
    const entry = readDashboardEntry();
    if (firstOverlayRun.current) {
      firstOverlayRun.current = false;
      // An entry for a detail that can't be shown again (reached with forward, or a reload).
      if (!overlay && entry?.overlay) pushDashboardEntry({ ...entry, overlay: undefined }, true);
      return;
    }
    const depth = OVERLAY_DEPTH[overlay ?? "none"];
    const entryDepth = OVERLAY_DEPTH[entry?.overlay ?? "none"];
    if (entry && depth > entryDepth) pushDashboardEntry({ ...entry, overlay: overlay ?? undefined });
    else if (depth < entryDepth) window.history.back();
  }, [overlay]);
  useEffect(() => {
    const onPopState = () => {
      const landed = readDashboardEntry()?.overlay;
      if (landed !== "month") setSelected(null);
      if (landed !== "explore") exploreRef.current?.onClose();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const above = trail ?? [];
  const insightsCrumb = (back: () => void): Crumb => ({ label: pageLabel, onClick: back });
  const monthTitle = selected
    ? new Date(Date.UTC(selected.year, selected.month - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    : "";

  return (
    <div className="space-y-[22px] pb-12">
      {selected ? (
        <Breadcrumb
          trail={[...above, insightsCrumb(() => setSelected(null)), ...(explore ? [{ label: explore.title, onClick: () => setSelected(null) }] : [])]}
          current={monthTitle}
          right={<ViewReportLink portfolioUuid={portfolioUuid} documentId={month.data?.reportDocumentId ?? null} />}
        />
      ) : explore ? (
        <Breadcrumb trail={[...above, insightsCrumb(explore.onClose)]} current={explore.title} />
      ) : trail ? (
        <Breadcrumb trail={trail} current={pageLabel} />
      ) : null}
      {!selected && !explore && top}

      {performance.failed ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">Failed to load portfolio data</p>
        </div>
      ) : performance.data === null ? (
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" />
        </div>
      ) : performance.data.value === null ? (
        backtest ? (
          <NoDataEmptyState
            title="The backtest is running"
            message="Its trades are being generated on historical prices, then its history is built like any portfolio's. Come back in a few minutes."
          />
        ) : (
          <NoDataEmptyState
            title="No performance data yet"
            message="Add or upload your transactions and this is where you'll track how your portfolio moves over time."
            onNavigate={onNavigate}
          />
        )
      ) : (
        <>
        {selected && (
          <MonthPage
            month={month}
            historyUpdating={performance.data.historyIsStale && !insights.timedOut}
            thisMonth={slotOf(performance, insights.timedOut, (d) => d.thisMonth, (_, d) => d.historyIsStale)}
            currency={performance.data.currency}
          />
        )}
        {/* Under an open month, the page and its detail stay mounted but hidden, the same way
            the page stays under a detail (see below). */}
        <div className={selected ? "invisible h-0 overflow-hidden" : "space-y-6"} aria-hidden={selected ? true : undefined} inert={selected ? true : undefined}>
        <ExploreHostContext.Provider value={exploreHost}>
          {/* Never display:none: the detail's charts are drawn here on its very first render,
              before `explore` is set, and a chart measured in a hidden box comes out 0×0. */}
          <div ref={setExploreSlot} className="space-y-6 empty:hidden" />
          {/* Hidden rather than unmounted while a detail is open: the detail lives in its
              module's state, and the page keeps its place for the way back. Collapsed and
              invisible rather than display:none, for the same reason as above: its charts keep
              their width and height, so they don't re-measure as 0×0. */}
          <div className={exploring ? "invisible h-0 overflow-hidden" : undefined} aria-hidden={exploring || undefined} inert={exploring || undefined}>
            <HistoryPage
              key={portfolioUuid}
              insights={insights}
              performance={performance.data}
              value={performance.data.value}
              portfolioUuid={portfolioUuid}
              onSelectMonth={openMonth}
              isAggregate={isAggregate}
              onOpenPortfolio={onOpenPortfolio}
              comparison={comparison}
              backtest={backtest}
              strategyShown={strategyShown}
            />
          </div>
        </ExploreHostContext.Provider>
        </div>
        </>
      )}
    </div>
  );
}

/**
 * MODULE — the card shell every page's content lives in, matching the Dashboard
 * Overview's visual language (rounded-4xl white card, Playfair headers, gold eyebrow).
 */
export function Module({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`group/module relative h-full bg-white rounded-[1.75rem] border border-[#EEE9DD] overflow-hidden transition-colors has-[[data-explore]]:hover:border-[#C49A3C]/60 has-[[data-explore]]:hover:bg-[#FBFAF6] ${className}`}>
      {children}
    </section>
  );
}

// A module's content under its ModuleHead: the card's own padding, the header's gap above it.
export const MODULE_BODY = "px-6 pb-[22px]";

// Figures read as good or bad news.
const TONE_CLASS = { gain: "text-[#047857]", loss: "text-[#e11d48]" } as const;
const toneClass = (tone?: "gain" | "loss") => (tone ? TONE_CLASS[tone] : "text-[#1c1917]");
const toneOfValue = (v: number | null | undefined): "gain" | "loss" | undefined => (v == null || v === 0 ? undefined : v > 0 ? "gain" : "loss");

/**
 * FIGS — a module's figures, as a grid of label-over-value cells with a hairline above each (as
 * many to a row as fit, 120px at least). `strong` is the headline one, a size up; `sub` a faint
 * line under the value; `info`, a tooltip on the label.
 */
export function Figs({ children, className = "", pairs = false }: { children: React.ReactNode; className?: string; pairs?: boolean }) {
  // `pairs`: two to a row whatever the width, for a half-width module that lines up with its neighbour.
  return <div className={`grid ${pairs ? "grid-cols-2" : "grid-cols-[repeat(auto-fit,minmax(120px,1fr))]"} gap-x-5 gap-y-3.5 ${className}`}>{children}</div>;
}

export function Fig({ label, value, sub, tone, strong = false, info, badge }: {
  label: string;
  value: string;
  sub?: string;
  tone?: "gain" | "loss";
  strong?: boolean;
  info?: string;
  badge?: React.ReactNode;
}) {
  return (
    <span className="flex flex-col gap-[3px] min-w-0 border-t border-[#EEE9DD] pt-2.5 text-left">
      <span className="flex items-center gap-1 min-w-0 text-[11px] text-[#78716c]">
        <span className="truncate">{label}</span>
        {info && (
          <InfoTip text={info}>
            <Info className="h-3 w-3 shrink-0 text-[#a8a29e] hover:text-[#78716c] cursor-help transition-colors" />
          </InfoTip>
        )}
      </span>
      <span className="flex items-center gap-2 min-w-0">
        <span className={`font-bold tabular-nums truncate tracking-[-0.01em] ${strong ? "text-[22px]" : "text-[17px]"} ${toneClass(tone)}`}>{value}</span>
        {badge}
      </span>
      {sub && <span className="text-[11px] text-[#a8a29e] truncate">{sub}</span>}
    </span>
  );
}

/**
 * FIG ROWS — a handful of figures as a list, a row each: the name on the left, the figure on the
 * right, all one size. For a narrow module whose figures would otherwise stack in a grid.
 */
export function FigRows({ rows }: {
  rows: ({ key: string; label: string; value: string; tone?: "gain" | "loss"; info?: string } | false | null)[];
}) {
  return (
    <dl>
      {rows.filter((r) => !!r).map((r) => (
        <div key={r.key} className="flex items-baseline justify-between gap-3 py-3 border-b border-[#EEE9DD] last:border-b-0 first:pt-0">
          <dt className="flex items-center gap-1 min-w-0 text-[13px] text-[#78716c]">
            <span className="truncate">{r.label}</span>
            {r.info && (
              <InfoTip text={r.info}>
                <Info className="h-3 w-3 shrink-0 text-[#a8a29e] hover:text-[#78716c] cursor-help transition-colors" />
              </InfoTip>
            )}
          </dt>
          <dd className={`shrink-0 text-[15px] font-bold tabular-nums ${r.tone ? toneClass(r.tone) : "text-[#1c1917]"}`}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * H BARS — a short ranking as horizontal bars: a label, a track with the bar (scaled to `max`,
 * the largest row by default) and, with `mark`, a thin line at a second value on the same
 * scale, then the figure. With `onSelect` each row opens something.
 */
export function HBars({ rows, max, onSelect }: {
  rows: { key: string; label: string; value: number; figure: string; color?: string; mark?: number | null; tone?: "gain" | "loss"; title?: string }[];
  max?: number;
  onSelect?: (key: string) => void;
}) {
  const top = max ?? Math.max(...rows.map((r) => Math.max(r.value, r.mark ?? 0)), 0.01);
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => {
        const body = (
          <>
            <span className="truncate font-semibold text-[#1c1917]" title={r.title ?? r.label}>{r.label}</span>
            <span className="relative h-2 rounded-full bg-[#F7F5EF] overflow-hidden">
              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(0, Math.min(100, (r.value / top) * 100))}%`, background: r.color ?? "#C49A3C" }} />
              {r.mark != null && (
                <span className="absolute -inset-y-[3px] w-0.5 bg-[#1c1917]" style={{ left: `${Math.max(0, Math.min(99, (r.mark / top) * 100))}%` }} />
              )}
            </span>
            <span className={`text-right font-bold tabular-nums ${toneClass(r.tone)}`}>{r.figure}</span>
          </>
        );
        const grid = "grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_minmax(3.6rem,auto)] gap-2.5 items-center text-[12.5px]";
        return onSelect ? (
          <button key={r.key} type="button" onClick={() => onSelect(r.key)} className={`${grid} text-left -mx-1.5 px-1.5 py-0.5 rounded-lg hover:bg-[#F7F5EF] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40`}>
            {body}
          </button>
        ) : (
          <div key={r.key} className={grid}>{body}</div>
        );
      })}
    </div>
  );
}

// A line of small print under a module's figures.
export function NoteS({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs text-[#78716c] leading-normal ${className}`}>{children}</p>;
}

const TILE_SPAN = {
  full: "col-span-2 lg:col-span-12",
  half: "col-span-2 lg:col-span-6",
  wide: "col-span-2 lg:col-span-8",
  narrow: "col-span-2 lg:col-span-4",
} as const;

/**
 * TILE — one cell of the page's mosaic (see HistoryPage): a 12-column grid on wide
 * screens, so a big chart can sit beside a narrow card and two related modules side by side,
 * instead of every module stacked at full width. Below lg everything is full width. A
 * container, so what's inside lays itself out by the tile's width (@md:, @3xl:…) rather than
 * the viewport's. Collapses when its module renders nothing.
 */
// `id`: an anchor the page's header figures scroll to (see moduleAnchor).
function Tile({ span = "full", id, children }: { span?: keyof typeof TILE_SPAN; id?: string; children: React.ReactNode }) {
  return <div id={id} className={`@container min-w-0 empty:hidden scroll-mt-24 ${TILE_SPAN[span]}`}>{children}</div>;
}

/** The anchor of one of a portfolio page's modules, for a figure above it to scroll down to. */
export type ModuleAnchor = "composition" | "value" | "volatility" | "realized" | "costs" | "risk";
export const moduleAnchor = (m: ModuleAnchor) => `module-${m}`;

// The heading every module shares, as small as a label so the figures lead: its title in small
// capitals, with `right` (a toggle, a headline figure) on the right. With `onExplore`, the module
// has a detail view (ExploreView): the header opens it, and so does an arrow pinned
// to the card's top right corner (ExpandButton), always in the same place whatever the header
// holds; the whole card lights up on hover. Clicks on `right` stay its own (a breakdown's chips
// switch the breakdown, they don't open the detail). `desc` says what the module shows, on hovering
// the title.
// (`eyebrow` was a gold line above the title; it's no longer drawn.)
export function ModuleHead({
  title, desc, right, icon, onExplore,
}: { eyebrow?: string; title: string; desc?: string; right?: React.ReactNode; icon?: React.ReactNode; onExplore?: () => void }) {
  return (
    <>
      <div
        onClick={onExplore}
        className={`px-6 pt-[22px] pb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 ${onExplore ? "cursor-pointer pr-14" : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h2 title={desc} className="text-[10px] font-black uppercase tracking-[0.14em] text-[#78716c]">{title}</h2>
        </div>
        {right && (onExplore ? <div onClick={(e) => e.stopPropagation()} className="cursor-auto">{right}</div> : right)}
      </div>
      {onExplore && <ExpandButton title={title} onClick={onExplore} />}
    </>
  );
}

// The way into a module's detail view: a quiet arrow in the card's top right corner, the same
// on every card, that turns gold as the card is hovered (the card's border and ground warm up
// with it, see Module) so the figures keep the eye until the pointer is on the card.
function ExpandButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-explore
      onClick={onClick}
      aria-label={`Open ${title} in detail`}
      title="Open in detail"
      className="absolute top-4 right-4 md:top-[18px] md:right-[18px] h-6 w-6 rounded-full flex items-center justify-center text-[#a8a29e] transition-colors group-hover/module:text-[#C49A3C] hover:bg-[#C49A3C]/10 outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40"
    >
      <ArrowUpRight className="h-4 w-4" />
    </button>
  );
}

interface StatProps {
  title: string;
  // A string for a single figure, or richer content (see SeriesValue) for a figure that
  // needs more than one line.
  value: React.ReactNode;
  icon: React.ReactNode;
  color: "blue" | "emerald" | "red" | "gold" | "slate";
  // Plain-language explanation of what the figure means, shown in a tooltip when the user
  // hovers (or focuses) the icon — never as a caption under the value, which would crowd
  // the strip.
  info?: string;
}

const STAT_COLOR_MAP: Record<StatProps["color"], string> = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  red: "bg-red-50 text-red-600 border-red-100",
  gold: "bg-[#C49A3C]/10 text-[#C49A3C] border-[#C49A3C]/20",
  slate: "bg-slate-50 text-slate-600 border-slate-100",
};

const INFO_TIP_WIDTH = 256;

/**
 * INFO TIP — wraps an element (a stat's icon) and shows a short explanation while it's hovered
 * or focused. Rendered in a portal with fixed positioning rather than as an absolutely
 * positioned child: the stat strips sit inside cards that clip their overflow, which would cut
 * the tip off. It opens below the anchor, flips above when the viewport has no room below, and
 * is clamped horizontally so it never runs off-screen.
 */
export function InfoTip({ text, children }: { text: string; children: React.ReactNode }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [tip, setTip] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  const show = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const left = Math.min(
      Math.max(margin, rect.left + rect.width / 2 - INFO_TIP_WIDTH / 2),
      window.innerWidth - INFO_TIP_WIDTH - margin,
    );
    const roomBelow = window.innerHeight - rect.bottom > 160;
    setTip(roomBelow ? { left, top: rect.bottom + margin } : { left, bottom: window.innerHeight - rect.top + margin });
  };

  // A fixed-position tip doesn't follow its anchor, so drop it if anything scrolls under it.
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [tip]);

  return (
    <span
      ref={anchorRef}
      tabIndex={0}
      aria-label={text}
      onMouseEnter={show}
      onMouseLeave={() => setTip(null)}
      onFocus={show}
      onBlur={() => setTip(null)}
      className="self-start inline-flex rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40"
    >
      {children}
      {tip && createPortal(
        <div
          role="tooltip"
          style={{ position: "fixed", left: tip.left, top: tip.top, bottom: tip.bottom, width: INFO_TIP_WIDTH }}
          className="z-120 pointer-events-none rounded-xl bg-slate-900 px-3.5 py-3 text-xs font-medium leading-relaxed text-white shadow-xl"
        >
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}

/**
 * STAT CONTENT — the icon/title/value block, with no card shell of its own: either one cell
 * of a strip sharing a card with its siblings (divided by internal borders), or a small card
 * of its own in a section's mosaic.
 */
function StatContent({ title, value, icon, color, info }: StatProps) {
  const iconBox = (
    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${STAT_COLOR_MAP[color]} ${info ? "cursor-help" : ""}`}>
      {icon}
    </div>
  );

  return (
    <div className="p-5 md:p-6 flex flex-col gap-2.5">
      {info ? <InfoTip text={info}>{iconBox}</InfoTip> : iconBox}
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      <div className="font-black text-slate-900 text-xl md:text-2xl" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        {value}
      </div>
    </div>
  );
}

/**
 * SNAPSHOT CHART — just totalMarketValue over time, rendered inside its own ChartCard
 * Module (see below). The stat cards in the page's other Module already carry the deltas
 * and breakdowns, so this stays a plain, uncluttered trend line.
 */
function SnapshotChart({ chart, currency, className = "h-64" }: { chart: ValuePoint[]; currency: string; className?: string }) {
  // A single point has nothing to draw a line/area between — recharts still plots its dot,
  // which reads as a broken/empty chart rather than "not enough history yet".
  if (chart.length < 2) {
    return <p className="text-[12.5px] text-[#a8a29e]">Not enough history yet to chart.</p>;
  }

  const sorted = [...chart].sort((a, b) => new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime());
  const data = sorted.map(s => ({ date: s.snapshotAt, value: s.totalMarketValue }));

  return (
    <div className={className}>
      {/* initialDimension seeds a real size before the first ResizeObserver callback fires —
          without it, ResponsiveContainer's first render measures width/height as -1 and logs
          a "should be greater than 0" warning even though the chart renders fine a moment later. */}
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 256 }}>
        {/* top: 16 leaves room for the topmost Y-axis tick label — its text is vertically
            centered on the tick, so with no top margin the upper half of that top label
            renders past the chart's edge and gets clipped. */}
        <AreaChart data={data} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="performanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#C49A3C" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#C49A3C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={monthShortYearLabel}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            minTickGap={30}
            padding={{ left: 12 }}
          />
          <YAxis
            tickFormatter={formatCompact}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={66}
          />
          <Tooltip
            labelFormatter={(label) => fullDateLabel(label as string)}
            formatter={(value) => [formatCurrency(Number(value), currency, 0), "Market value"]}
            contentStyle={TOOLTIP_STYLE}
          />
          <Area type="monotone" dataKey="value" stroke="#C49A3C" strokeWidth={2} fill="url(#performanceFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ViewReportLink({ portfolioUuid, documentId }: { portfolioUuid: string; documentId: string | null }) {
  if (!documentId) return null;
  return (
    <a
      href={`/reports/${portfolioUuid}/${documentId}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-blue-600 transition-colors shrink-0"
    >
      <FileText className="h-3.5 w-3.5" /> View report <ExternalLink className="h-3 w-3" />
    </a>
  );
}

/**
 * EMPTY PERIOD STATE — swapped in for a page's stat cards (and its chart) when every
 * figure the backend returned for that period is zero, i.e. there's nothing recorded
 * yet to show. A wall of "0.00 EUR" cards would read as broken data rather than "no
 * activity", so this is dropped in favor of the same dashed-border empty-state card
 * used elsewhere in the dashboard (e.g. "No reports found").
 */
function EmptyPeriodState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-white border border-slate-200 border-dashed rounded-4xl">
      <div className="p-4 bg-slate-50 rounded-2xl mb-3">
        <Wallet className="h-6 w-6 text-slate-300" />
      </div>
      <p className="text-slate-600 font-semibold">Nothing to show yet</p>
      <p className="text-slate-400 text-sm mt-1 max-w-sm">{message}</p>
    </div>
  );
}

/**
 * UPDATING NOTE — shown once a document has been `isStale: true` for the full
 * STALE_TIMEOUT_MS polling window (see useAnalytics): the rebuild triggered by a transaction
 * edit is taking longer than the usual few minutes, so polling has stopped and the (possibly
 * still-mixed) numbers are drawn anyway with this heads-up rather than blocking on it forever.
 * The normal case — still within the window — hides the numbers instead (StaleUpdatingState),
 * so reaching this note at all is the unusual path.
 */
function UpdatingNote() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700">
      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
      <p className="text-xs font-bold">Update is taking longer than usual — the figures below may be out of date.</p>
    </div>
  );
}

/**
 * STALE UPDATING STATE — replaces a module's numbers/charts entirely while its document is
 * `isStale: true` and still within the polling window (see useAnalytics): after an edit, the
 * old numbers and the new ones would describe two different portfolios, so nothing here is
 * safe to draw until the rebuild lands. The page keeps refetching in the background; this just
 * says so instead of showing a plain empty module.
 */
function StaleUpdatingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-14 px-6 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" />
      <p className="text-slate-600 font-semibold">Updating after a recent change</p>
      <p className="text-slate-400 text-sm max-w-sm">
        This usually takes a few minutes — it&apos;ll refresh here on its own once it&apos;s ready.
      </p>
    </div>
  );
}

/** Placeholder line for a module whose analytics can't be drawn (yet). */
function ModuleMessage({ children }: { children: React.ReactNode }) {
  return <p className={`text-[12.5px] text-[#a8a29e] ${MODULE_BODY}`}>{children}</p>;
}

const isPeriodEmpty = (data: PeriodDashboard) =>
  data.t0Value === 0 && data.t1Value === 0 && data.deltaValue === 0 && data.marketEffect === 0 &&
  data.netCapitalContributed === 0 && data.tradingCostsInPeriod === 0 && data.dividendsInPeriod === 0;

// A portfolio's very first tracked period has no prior value to diff against — the backend
// signals this with t0Value === 0 rather than a real baseline, and deltaValuePct /
// marketEffectPct both come back as exactly 0 for that one entry (its own division-by-zero
// guard), even though the euro amounts (deltaValue / marketEffect) are still meaningful. A
// literal "0%" there would read as "flat", not "no baseline to compare against" — so every
// percentage display checks this first and falls back to "—".
const hasPeriodBaseline = (data: PeriodDashboard) => data.t0Value !== 0;
const formatPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
const formatSignedCurrency = (amount: number, currency: string) =>
  `${amount >= 0 ? "+" : ""}${formatCurrency(amount, currency, 0)}`;

/**
 * AMOUNT WITH DELTA — an absolute change and its percentage, stacked instead of squeezed into
 * one "€X (+Y%)" string: the amount stays the primary figure, the percentage gets its own
 * colored, directional line underneath so it reads as its own figure rather than an annotation
 * in parentheses. `hasBaseline` covers the one case where the euro amount is meaningful but the
 * percentage isn't (see hasPeriodBaseline above) — the delta line falls back to "—" instead of
 * a misleading 0%.
 */
function AmountWithDelta({ amount, pct, hasBaseline = true }: { amount: string; pct: number; hasBaseline?: boolean }) {
  const isGain = pct >= 0;
  const Icon = isGain ? TrendingUp : TrendingDown;
  return (
    <>
      {amount}
      <div className={`flex items-center gap-1 font-sans text-sm font-bold mt-1 ${
        !hasBaseline ? "text-slate-400" : isGain ? "text-emerald-600" : "text-rose-600"
      }`}>
        {hasBaseline ? (
          <>
            <Icon className="h-3.5 w-3.5" />
            {formatPct(pct)}
          </>
        ) : (
          "—"
        )}
      </div>
    </>
  );
}

const isHistoryEmpty = (value: InsightsValueModule) =>
  value.currentValue === 0 && value.chart.length === 0;


// "Unknown" collects assets with no known breakdown — a data gap, not a real sector/region —
// so it gets a neutral bar instead of taking a slot in the gold palette.
const UNKNOWN_EXPOSURE_COLOR = "#cbd5e1";

// Correlation cells share the returns heatmap's emerald/rose scheme (positive/negative) but
// scale intensity linearly over [-1, 1] rather than a capped magnitude — correlation is
// already bounded, unlike a percentage return.
function correlationCellStyle(value: number): React.CSSProperties {
  const intensity = Math.min(Math.abs(value), 1);
  const [r, g, b] = value >= 0 ? [16, 185, 129] : [244, 63, 94]; // emerald-500 / rose-500
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${(0.08 + intensity * 0.72).toFixed(3)})`,
    color: intensity > 0.55 ? "#ffffff" : value >= 0 ? "#047857" : "#be123c",
  };
}

/**
 * CORRELATION MATRIX MODULE — how the held assets' returns moved together over the history
 * they share (from /insights/risk-model, see RiskModelTab). Drawn whenever the document carries
 * a matrix of at least two assets, whatever its status; without one, a message stands in for
 * the table. Individual cells can be null and render as a dash.
 */
function CorrelationMatrixModule({ riskModel }: { riskModel: RiskModelResponse }) {
  const correlation = riskModel.correlation;
  const usable = correlation !== null && correlation.tickers.length >= 2;

  return (
    <Module>
      <ModuleHead
        eyebrow="Risk"
        title="Correlation Matrix"
        desc="How your holdings moved together, based on past returns."
      />
      {!usable ? (
        <ModuleMessage>Needs at least two assets with a shared price history to compare.</ModuleMessage>
      ) : (
        <div className="p-6 md:p-7 overflow-x-auto custom-scrollbar">
          <table className="border-collapse min-w-150 w-full table-fixed">
            <thead>
              <tr>
                <th className="w-20" />
                {correlation.tickers.map((t, j) => (
                  <th key={`${t}-${j}`} className="text-[10px] font-black uppercase tracking-wider text-slate-400 pb-2 text-center">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {correlation.tickers.map((rowTicker, i) => (
                <tr key={`${rowTicker}-${i}`}>
                  <td className="text-xs font-bold text-slate-900 pr-3 py-1 whitespace-nowrap">{rowTicker}</td>
                  {correlation.tickers.map((colTicker, j) => {
                    const value = correlation.matrix[i]?.[j] ?? null;
                    return (
                      <td key={`${colTicker}-${j}`} className="p-1">
                        <div
                          title={`${rowTicker} vs ${colTicker}: ${value === null ? "n/a" : value.toFixed(2)}`}
                          style={value === null ? undefined : correlationCellStyle(value)}
                          className={`w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold tabular-nums ${
                            value === null ? "bg-slate-50 text-slate-300" : ""
                          }`}
                        >
                          {value === null ? "—" : value.toFixed(1)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Module>
  );
}

const plainPctOrDash = (pct: number | null) => (pct === null ? "—" : `${pct.toFixed(2)}%`);
const ratioOrDash = (value: number | null) => (value === null ? "—" : value.toFixed(2));

// One colour per mix in the risk-model views, so a mix reads the same on the frontier chart,
// in the comparison table and in the legend. The current allocation keeps the portfolio gold.
const MIX_COLORS = { current: PORTFOLIO_COLOR, maxSharpe: "#0f766e", minVolatility: "#1d4ed8" } as const;

const RISK_UNAVAILABLE_MESSAGES: Record<RiskModelUnavailableReason, string> = {
  too_few_assets: "The risk model needs at least two holdings that share 30 days or more of price history. Yours don't yet, so it will appear once they do.",
  no_positive_returns: "Every one of your holdings has an average past return at or below zero, so the model has no best-return mix to compare against.",
  solver_failed: "The model couldn't work out an allocation from your holdings' data this time. Check back after the next update.",
};

// Fallback for an unavailable model with no reason: a document stored before the backend sent
// unavailableReason keeps null there until it is recomputed, so it lists every possible cause.
const RISK_UNAVAILABLE_GENERIC =
  "The risk model can't be built for your portfolio right now. That happens when fewer than two holdings share at least 30 days of price history, when every holding's average past return is zero or negative, or when no allocation could be worked out from the data.";

/** The one explanation shown in place of the model's modules when it isn't "ok". */
function riskModelUnavailableMessage(model: { status: RiskModelResponse["status"]; unavailableReason: RiskModelUnavailableReason | null }): string {
  if (model.status === "insufficient_history") {
    return "The risk model needs at least a year of history. It will appear once your portfolio has one.";
  }
  return (model.unavailableReason && RISK_UNAVAILABLE_MESSAGES[model.unavailableReason]) || RISK_UNAVAILABLE_GENERIC;
}

/**
 * RISK DETAIL — everything behind the volatility: the rolling volatility, the turbulent periods
 * and the drawdowns (/insights/volatility, which also follows the returns document) and, on the
 * aggregate, how the portfolios move together. The risk model has its own (RiskModelModule).
 */
function RiskDetail({
  portfolioUuid, revision, returnsRevision, aggregate,
}: { portfolioUuid: string; revision: number; returnsRevision: number; aggregate: AggregateSlots | null }) {
  return (
    <>
      <VolatilityExplore portfolioUuid={portfolioUuid} revision={revision + returnsRevision} />
      {aggregate && <PortfolioCorrelationModule slot={aggregate.comovement} members={aggregate.portfolios.module?.members ?? []} />}
    </>
  );
}

/**
 * RISK MODEL MODULE — the risk model on the page: the efficient frontier, from the Risk section
 * (the frontier and the three mixes on it, without their weights). Its detail
 * (RiskModelExplore, /insights/risk-model) holds the rest. When the frontier can't be drawn (fewer
 * than two plottable points) or the model wasn't built, a message stands in for it, and the
 * detail still opens on what there is (a model that isn't built can still carry correlations).
 */
function RiskModelModule({ slot, portfolioUuid }: { slot: ModuleSlot<InsightsFrontierModule>; portfolioUuid: string }) {
  const [exploring, setExploring] = useState(false);
  const data = slot.module;
  const built = data?.status === "ok";
  const plot = useMemo(
    () => (data ? frontierPlot(data.frontier, data.current, data.maxSharpe, data.minVolatility) : null),
    [data],
  );
  const hasFrontier = plot !== null && plot.curve.length >= 2;
  const explore = ready(slot) ? () => setExploring(true) : undefined;
  const mixes = data ? [
    { label: "Yours", color: MIX_COLORS.current, entry: data.current },
    { label: "Max Sharpe", color: MIX_COLORS.maxSharpe, entry: data.maxSharpe },
    { label: "Min volatility", color: MIX_COLORS.minVolatility, entry: data.minVolatility },
  ] : [];

  return (
    <Module>
      <ModuleHead title="Risk Model" desc="How your holdings have behaved together, based on past returns." onExplore={explore} />
      {SlotPlaceholder({ slot }) ?? (ready(slot) && built && hasFrontier ? (
        <div className={`${MODULE_BODY} space-y-4`}>
          {slot.lagging && <UpdatingNote />}
          <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-[22px] items-stretch">
            <FrontierChart curve={plot.curve} dots={plot.dots} className="h-[240px]" compact />
            {/* As tall as the chart beside it, its rows spread over that height. */}
            <div className="min-w-0 flex flex-col">
              <div className="flex-1 overflow-x-auto">
                {/* Coloured explicitly, like DataTable's: a cell left to inherit takes the page's text colour. */}
                {/* Separate borders, none drawn: the highlighted row's cells can round their corners. */}
                <table className="w-full h-full border-separate border-spacing-0 text-[14px] text-[#1c1917]">
                  <thead>
                    <tr className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#78716c]">
                      <th className="text-left font-extrabold py-2 px-3" />
                      <th className="text-right font-extrabold py-2 px-3 whitespace-nowrap">Avg. return</th>
                      <th className="text-right font-extrabold py-2 px-3">Volatility</th>
                      <th className="text-right font-extrabold py-2 px-3">Sharpe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mixes.map((m, index) => {
                      // The user's own allocation, set off from the two mixes it's measured against.
                      const cell = index === 0 ? "bg-[#C49A3C]/[0.09] first:rounded-l-xl last:rounded-r-xl" : "";
                      return (
                        <tr key={m.label} className="font-semibold">
                          <td className={`py-3 pl-3 pr-3 whitespace-nowrap ${cell}`}><span className="mr-1.5" style={{ color: m.color }}>●</span>{m.label}</td>
                          <td className={`py-3 px-3 text-right tabular-nums font-bold ${cell}`}>{formatPctOrDash(m.entry?.expectedReturnPct ?? null)}</td>
                          <td className={`py-3 px-3 text-right tabular-nums font-bold ${cell}`}>{plainPctOrDash(m.entry?.volatilityPct ?? null)}</td>
                          <td className={`py-3 px-3 text-right tabular-nums font-bold ${cell}`}>{ratioOrDash(m.entry?.sharpeRatio ?? null)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ModuleMessage>
          {built
            ? "The efficient frontier can't be drawn for these holdings. Open it for the mixes and how your holdings move together."
            : riskModelUnavailableMessage(slot.module!)}
        </ModuleMessage>
      ))}
      {ready(slot) && exploring && (
        <ExploreView title="Risk Model" onClose={() => setExploring(false)}>
          <RiskModelExplore portfolioUuid={portfolioUuid} revision={slot.revision} />
        </ExploreView>
      )}
    </Module>
  );
}

/**
 * RISK MODEL EXPLORE — the risk model's detail: either it was built for the whole
 * portfolio or none of it was. Built: the efficient frontier (when it has two plottable points),
 * the three mixes side by side with their weights, how far each holding sits from the max-Sharpe
 * mix and the per-asset inputs; not built: a single explanation, worded by unavailableReason.
 * The correlation matrix follows whenever the backend sent one (it does for no_positive_returns
 * and solver_failed too, since correlations need only returns). Everything here is built from
 * past returns, so it says so and avoids recommendation wording.
 */
function RiskModelExplore({ portfolioUuid, revision }: { portfolioUuid: string; revision: number }) {
  const detail = useDetail(() => portfolioService.getRiskModel(portfolioUuid), portfolioUuid, revision);
  return (
    <DetailBody detail={detail}>
      {(data) => {
        const built = data.status === "ok";
        return (
          <>
            {built ? (
              <>
                <FrontierModule frontier={data.frontier} current={data.current} maxSharpe={data.maxSharpe} minVolatility={data.minVolatility} />
                <MixComparisonModule current={data.current} maxSharpe={data.maxSharpe} minVolatility={data.minVolatility} />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="@container min-w-0">
                    <WeightGapsModule gaps={data.weightGaps} />
                  </div>
                  <div className="@container min-w-0">
                    <RiskAssetsModule assets={data.assets} />
                  </div>
                </div>
              </>
            ) : (
              <Module><ModuleMessage>{riskModelUnavailableMessage(data)}</ModuleMessage></Module>
            )}
            {(built || data.correlation !== null) && <CorrelationMatrixModule riskModel={data} />}
          </>
        );
      }}
    </DetailBody>
  );
}

/**
 * MIX COMPARISON — the three allocations the model evaluates on the same past returns: what
 * you hold now, the long-only mix with the best past return per unit of risk (max Sharpe) and
 * the one with the lowest volatility. One card each, with its three figures and its weights as
 * a single segmented bar, so the mixes can be compared at a glance. Every ticker keeps the same
 * colour across the three bars. An entry can be null.
 */
function MixComparisonModule({
  current, maxSharpe, minVolatility,
}: { current: RiskPortfolioEntry | null; maxSharpe: RiskPortfolioEntry | null; minVolatility: RiskPortfolioEntry | null }) {
  const mixes = [
    { label: "Your allocation", hint: "As you hold it today", color: MIX_COLORS.current, entry: current },
    { label: "Max Sharpe", hint: "Best past return per unit of risk", color: MIX_COLORS.maxSharpe, entry: maxSharpe },
    { label: "Min volatility", hint: "Smallest past swings", color: MIX_COLORS.minVolatility, entry: minVolatility },
  ];
  // Colours follow first appearance across the cards (your own holdings first), so a ticker is
  // the same colour in all three bars.
  const tickers = [...new Set(mixes.flatMap((m) => m.entry?.weights.map((w) => w.ticker) ?? []))];
  const colorOf = (ticker: string) => CATEGORICAL_PALETTE[tickers.indexOf(ticker) % CATEGORICAL_PALETTE.length];
  // The holding being pointed at (hovered, or tapped on a touch screen), shared by the three
  // bars so the same holding lights up in all of them.
  const [activeTicker, setActiveTicker] = useState<string | null>(null);

  return (
    <Module>
      <ModuleHead
        eyebrow="Risk Model"
        title="Your Allocation vs. Two Historical Mixes"
        desc="The same holdings, weighted three ways and measured on the same past returns."
      />
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y divide-slate-100 md:divide-y-0 md:divide-x">
        {mixes.map((m) => (
          <div key={m.label} className="p-6 md:p-7 flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                <h3 className="text-sm font-black text-slate-900">{m.label}</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">{m.hint}</p>
            </div>
            {m.entry === null ? (
              <p className="text-sm text-slate-500">Not available.</p>
            ) : (
              <>
                <dl className="space-y-2">
                  <MixFigure label="Avg. return" value={formatPctOrDash(m.entry.expectedReturnPct)} strong />
                  <MixFigure label="Volatility" value={plainPctOrDash(m.entry.volatilityPct)} />
                  <MixFigure label="Sharpe ratio" value={ratioOrDash(m.entry.sharpeRatio)} />
                </dl>
                <MixWeights weights={m.entry.weights} colorOf={colorOf} active={activeTicker} onActive={setActiveTicker} />
              </>
            )}
          </div>
        ))}
      </div>
    </Module>
  );
}

function MixFigure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs font-bold text-slate-500">{label}</dt>
      <dd className={`tabular-nums ${strong ? "text-lg font-black text-slate-900" : "text-sm font-bold text-slate-700"}`}>{value}</dd>
    </div>
  );
}

/**
 * One segmented bar for a mix's weights. No legend under it: pointing at a segment (hover, or a
 * tap on a touch screen, tapping it again to let go) names that holding and its weight in the
 * line below, and lights the same holding up in the other two bars (`active` is shared), where
 * the line shows its weight in that mix — 0% when the mix leaves it out.
 */
function MixWeights({
  weights, colorOf, active, onActive,
}: {
  weights: RiskPortfolioEntry["weights"];
  colorOf: (ticker: string) => string;
  active: string | null;
  onActive: (ticker: string | null) => void;
}) {
  const shown = weights.filter((w) => w.weightPct >= 0.05);
  if (shown.length === 0) return null;
  const activeEntry = active === null ? null : weights.find((w) => w.ticker === active) ?? null;

  return (
    <div onMouseLeave={() => onActive(null)}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {shown.map((w) => (
          <button
            key={w.ticker}
            type="button"
            aria-label={`${w.ticker}: ${w.weightPct.toFixed(1)}%`}
            onMouseEnter={() => onActive(w.ticker)}
            onFocus={() => onActive(w.ticker)}
            onClick={() => onActive(active === w.ticker ? null : w.ticker)}
            className="h-full transition-opacity outline-none"
            style={{ width: `${w.weightPct}%`, background: colorOf(w.ticker), opacity: active === null || active === w.ticker ? 1 : 0.25 }}
          />
        ))}
      </div>
      <p className="mt-2.5 h-4 flex items-center gap-1.5 text-[11px] font-bold text-slate-600 min-w-0">
        {active !== null && (
          <>
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: colorOf(active) }} />
            <span className="shrink-0">{active}</span>
            {activeEntry && <span className="truncate font-semibold text-slate-400">{activeEntry.name}</span>}
            <span className="ml-auto tabular-nums text-slate-900 shrink-0">{(activeEntry?.weightPct ?? 0).toFixed(1)}%</span>
          </>
        )}
      </p>
    </div>
  );
}

/**
 * FRONTIER MODULE — the efficient frontier: for each level of volatility, the highest past
 * return any long-only mix of your holdings would have had. The three mixes from
 * MixComparisonModule are marked on it (the current allocation normally sits below the curve).
 * Points with a null coordinate are skipped; the dots extend the axes if they fall outside the
 * curve's own range.
 */
type PlottedPoint = RiskPointResponse & { volatilityPct: number; expectedReturnPct: number };

function frontierPlot(
  frontier: { volatilityPct: number | null; expectedReturnPct: number | null }[],
  current: RiskPointResponse | null,
  maxSharpe: RiskPointResponse | null,
  minVolatility: RiskPointResponse | null,
) {
  const curve = frontier
    .filter((f): f is { volatilityPct: number; expectedReturnPct: number } => f.volatilityPct !== null && f.expectedReturnPct !== null)
    .sort((a, b) => a.volatilityPct - b.volatilityPct);
  const dots = [
    { label: "Your allocation", color: MIX_COLORS.current, entry: current },
    { label: "Max Sharpe", color: MIX_COLORS.maxSharpe, entry: maxSharpe },
    { label: "Min volatility", color: MIX_COLORS.minVolatility, entry: minVolatility },
  ].filter((d): d is typeof d & { entry: PlottedPoint } => d.entry?.volatilityPct != null && d.entry?.expectedReturnPct != null);
  return { curve, dots };
}

/**
 * The efficient frontier's chart, for FrontierModule and the Risk Model module. `compact` (the
 * module on the page) leaves out the legend under it and the axes' names, the table beside it
 * naming the dots.
 */
function FrontierChart({ curve, dots, className, compact = false }: {
  curve: ReturnType<typeof frontierPlot>["curve"];
  dots: ReturnType<typeof frontierPlot>["dots"];
  className: string;
  compact?: boolean;
}) {
  // Axes fitted to the curve and the dots, a little room around them, rather than rounded out by
  // the chart: the three mixes spread over the whole plot instead of bunching in a corner. The
  // values don't move; a tick shows a decimal when the range is too narrow for whole percents.
  const xs = [...curve.map((p) => p.volatilityPct), ...dots.map((d) => d.entry.volatilityPct)];
  const ys = [...curve.map((p) => p.expectedReturnPct), ...dots.map((d) => d.entry.expectedReturnPct)];
  const fit = (values: number[]): [number, number] => {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.08;
    return [lo - pad, hi + pad];
  };
  const xDomain = fit(xs);
  const yDomain = fit(ys);
  const tickLabel = (domain: [number, number]) => (v: number) => `${Number(v).toFixed(domain[1] - domain[0] < 4 ? 1 : 0)}%`;

  return (
    <div>
      <div className={className}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 320 }}>
          <LineChart data={curve} margin={{ top: 16, right: 16, left: 0, bottom: compact ? 4 : 20 }}>
            <XAxis
              type="number"
              dataKey="volatilityPct"
              domain={xDomain}
              tickCount={5}
              tickFormatter={tickLabel(xDomain)}
              tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
              axisLine={false}
              tickLine={false}
              tickMargin={6}
              // Keeps the first tick clear of the Y axis' lowest one, in the corner they share.
              padding={{ left: 14, right: 6 }}
              label={compact ? undefined : { value: "Volatility", position: "insideBottom", offset: -12, fontSize: 11, fill: AXIS_TICK_COLOR }}
            />
            <YAxis
              type="number"
              domain={yDomain}
              tickCount={5}
              tickFormatter={tickLabel(yDomain)}
              tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
              axisLine={false}
              tickLine={false}
              tickMargin={6}
              // Lifts the lowest tick off the X axis' labels.
              padding={{ bottom: 12, top: 6 }}
              width={compact ? 44 : 64}
              label={compact ? undefined : { value: "Avg. annual return (past)", angle: -90, position: "insideLeft", offset: 4, fontSize: 11, fill: AXIS_TICK_COLOR }}
            />
            <Tooltip
              labelFormatter={(label) => `Volatility ${Number(label).toFixed(2)}%`}
              formatter={(value) => [`${Number(value).toFixed(2)}%`, "Avg. annual return (past)"]}
              contentStyle={TOOLTIP_STYLE}
            />
            <Line type="monotone" dataKey="expectedReturnPct" stroke={BENCHMARK_COLOR} strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            {dots.map((d) => (
              <ReferenceDot
                key={d.label}
                x={d.entry.volatilityPct}
                y={d.entry.expectedReturnPct}
                r={6}
                fill={d.color}
                stroke="#ffffff"
                strokeWidth={2}
                ifOverflow="extendDomain"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {!compact && <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 pt-2 text-[11.5px] text-[#78716c]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t-2 border-dashed" style={{ borderColor: BENCHMARK_COLOR }} /> Efficient frontier
        </span>
        {dots.map((d) => (
          <span key={d.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: d.color }} /> {d.label}
          </span>
        ))}
      </div>}
    </div>
  );
}

/**
 * FRONTIER MODULE — the efficient frontier, in the Risk Model's detail: for each level of
 * volatility, the highest past return any long-only mix of your holdings would have had. The
 * three mixes from MixComparisonModule are marked on it (the current allocation normally sits
 * below the curve). Points with a null coordinate are skipped; the dots extend the axes if they
 * fall outside the curve's own range.
 */
function FrontierModule({
  frontier, current, maxSharpe, minVolatility,
}: {
  frontier: { volatilityPct: number | null; expectedReturnPct: number | null }[];
  current: RiskPointResponse | null;
  maxSharpe: RiskPointResponse | null;
  minVolatility: RiskPointResponse | null;
}) {
  const { curve, dots } = useMemo(() => frontierPlot(frontier, current, maxSharpe, minVolatility), [frontier, current, maxSharpe, minVolatility]);
  if (curve.length < 2) return null;

  return (
    <Module>
      <ModuleHead
        title="Efficient Frontier"
        desc="The highest past return available at each level of volatility, using your current holdings."
      />
      <div className={MODULE_BODY}>
        <FrontierChart curve={curve} dots={dots} className="h-80" />
      </div>
    </Module>
  );
}

// The gap is worded against the max-Sharpe mix as a description of the distance, not as advice
// — "above / below" rather than "reduce / add" — and coloured neutrally (amber / blue), not
// red / green, so neither side reads as the good one.
const GAP_COLORS: Record<WeightGapEntry["direction"], string> = {
  overweight: "#d97706",
  underweight: "#2563eb",
  in_line: BENCHMARK_COLOR,
};

const GAP_GRID = "grid grid-cols-[6.5rem_minmax(0,1fr)_4rem] sm:grid-cols-[10rem_minmax(0,1fr)_4.5rem] items-center gap-3";

/**
 * WEIGHT GAPS — for each holding, how far its weight sits from its weight in the max-Sharpe
 * mix, as one bar growing from a centre line: to the right when held above that mix, to the
 * left when below (delta = current − target, in percentage points; the backend has already
 * resolved the direction, so nothing is subtracted here). Bars share one scale. Under each
 * ticker, its weight now → in that mix. Shown to see how far the portfolio sits from that
 * historical mix, not as a suggestion to move towards it.
 */
function WeightGapsModule({ gaps }: { gaps: WeightGapEntry[] }) {
  if (gaps.length === 0) return null;

  const maxAbs = Math.max(...gaps.map((g) => Math.abs(g.deltaPct)), 1);

  return (
    <Module>
      <ModuleHead
        eyebrow="Risk Model"
        title="Weights vs. the Max-Sharpe Mix"
        desc="How far each holding's weight sits from the mix that had the best past return per unit of risk. Under each ticker: its weight now → in that mix."
      />
      <div className="p-6 md:p-7 space-y-3.5">
        <div className={GAP_GRID}>
          <span />
          <div className="flex justify-between text-[11px] font-bold text-slate-500">
            <span>◀ Below the mix</span>
            <span>Above the mix ▶</span>
          </div>
          <span />
        </div>
        {gaps.map((g) => {
          const above = g.deltaPct >= 0;
          return (
            <div key={g.ticker} className={GAP_GRID} title={g.name}>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-900 truncate">{g.ticker}</p>
                <p className="text-[11px] text-slate-500 tabular-nums truncate">
                  {g.currentWeightPct.toFixed(1)}% → {g.targetWeightPct.toFixed(1)}%
                </p>
              </div>
              <div className="relative h-5 rounded bg-slate-50">
                <span className="absolute inset-y-0 left-1/2 w-px bg-slate-300" />
                <span
                  className="absolute inset-y-1 rounded-sm"
                  style={{
                    [above ? "left" : "right"]: "50%",
                    width: `${(Math.abs(g.deltaPct) / maxAbs) * 50}%`,
                    background: GAP_COLORS[g.direction] ?? GAP_COLORS.in_line,
                  }}
                />
              </div>
              <span className="text-right text-[13px] font-bold tabular-nums text-slate-600">
                {above ? "+" : ""}{g.deltaPct.toFixed(1)} pp
              </span>
            </div>
          );
        })}
      </div>
    </Module>
  );
}

/**
 * RISK ASSETS — the per-asset inputs the model works from: each holding's average annual return
 * over the history the holdings share (a historical mean, not a forecast) and its volatility.
 * Only holdings with enough history to be estimated appear.
 */
function RiskAssetsModule({ assets }: { assets: RiskModelResponse["assets"] }) {
  if (assets.length === 0) return null;

  return (
    <Module>
      <ModuleHead
        eyebrow="Risk Model"
        title="Holdings Behind the Model"
        desc="Each holding's average annual return and volatility over the history they share."
      />
      <div className="grid grid-cols-1 @xl:grid-cols-2 gap-3 p-6 md:p-7">
        {assets.map((a) => (
          <div key={a.ticker} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{a.ticker}</p>
              <p className="text-xs text-slate-500 truncate">{a.name}</p>
            </div>
            <div className="flex gap-5 shrink-0 text-right">
              <div>
                <p className="text-sm font-black text-slate-900 tabular-nums">{formatPctOrDash(a.expectedReturnPct)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Avg. return</p>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 tabular-nums">{plainPctOrDash(a.volatilityPct)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Volatility</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Module>
  );
}

type Breakdown = "holding" | "portfolio" | "class" | "sector" | "region";
const BREAKDOWN_LABELS: Record<Breakdown, string> = {
  holding: "By holding", portfolio: "By portfolio", class: "By asset class", sector: "By sector", region: "By region",
};
// Slices on the card: the largest few, then the rest as one "N more" slice that opens the
// composition's detail (CompositionExplore), where everything is.
const COMPOSITION_TOP = 3;
const COMPOSITION_OTHER = "\u0000more";
const COMPOSITION_OTHER_COLOR = "#d6d3d1";

interface CompositionItem {
  key: string;
  label: string;
  // A line under the label: the holding's name, the portfolio's P&L.
  sub?: string;
  value: number;
  // Of the whole, 0-100.
  weightPct: number;
  color: string;
  // Opens it: a holding's page, a portfolio. Without it, a breakdown to read only.
  onOpen?: () => void;
}

/**
 * COMPOSITION — the Holdings module, at the top of a portfolio's page: what it's made of, as a
 * donut beside a list of rows, the largest COMPOSITION_TOP and the rest as one "N more", and the
 * way down a level. By holding (by portfolio on "All portfolios"), where a slice or a row opens
 * that holding's page (AssetExplore) or that portfolio; and, to read only, by asset class, sector
 * and region (the look-through exposure). The breakdowns are a carousel that turns every 5
 * seconds: under the body, on one line, the one shown and a dot for each between the steps to
 * the previous and next; on touch the body swipes. The module, and its "N more", open the whole of it
 * (CompositionExplore).
 */
function HoldingsExplorer({
  slot, sector, region, aggregate, currency, portfolioUuid, onOpenPortfolio,
}: {
  slot: ModuleSlot<InsightsHoldingsModule>;
  sector: InsightsExposureModule | null;
  region: InsightsExposureModule | null;
  // "All portfolios" only.
  aggregate: AggregateSlots | null;
  currency: string;
  portfolioUuid: string;
  // Opens one of the aggregate's portfolios, from its slice or row.
  onOpenPortfolio?: (uuid: string) => void;
}) {
  const holdings = useMemo(() => slot.module?.holdings ?? [], [slot.module]);
  const { portfolios } = usePortfolio();
  const colorOf = useMemo(() => portfolioColorMap(portfolios), [portfolios]);
  const membersModule = aggregate?.portfolios.module;
  const members = useMemo(() => membersModule?.members ?? [], [membersModule]);
  const breakdowns: Breakdown[] = [
    ...(aggregate && members.length > 0 ? ["portfolio" as const] : []),
    "holding", "class",
    ...(sector && sector.entries.length > 0 ? ["sector" as const] : []),
    ...(region && region.entries.length > 0 ? ["region" as const] : []),
  ];
  const [picked, setPicked] = useState<Breakdown | null>(null);
  const breakdown = picked && breakdowns.includes(picked) ? picked : breakdowns[0];
  // Which way the last step went (1 forward, -1 back), for the body to slide in from that side.
  const [direction, setDirection] = useState(1);
  const breakdownIndex = breakdowns.indexOf(breakdown);
  const pick = (b: Breakdown) => {
    setDirection(breakdowns.indexOf(b) >= breakdownIndex ? 1 : -1);
    setPicked(b);
    setHovered(null);
  };
  // Steps around the breakdowns, wrapping at either end.
  const step = (by: 1 | -1) => {
    setDirection(by);
    setPicked(breakdowns[(breakdownIndex + by + breakdowns.length) % breakdowns.length]);
    setHovered(null);
  };
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [exploring, setExploring] = useState(false);
  // The holding whose detail view (AssetExplore) is open. Rows without a ticker can't open one:
  // the market-data endpoint is keyed by it.
  const [exploringAsset, setExploringAsset] = useState<PortfolioHoldingResponse | null>(null);

  const items = useMemo((): CompositionItem[] => {
    const total = holdings.reduce((sum, h) => sum + h.marketValue, 0);
    const palette = (i: number) => CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length];
    if (breakdown === "portfolio") {
      return [...members].sort((a, b) => b.marketValue - a.marketValue).map((m) => ({
        key: m.portfolioUuid,
        label: m.name,
        sub: `${formatSignedCurrency(m.totalPnl, currency)} P&L`,
        value: m.marketValue,
        weightPct: m.weightPct,
        color: colorOf(m.portfolioUuid),
        onOpen: onOpenPortfolio ? () => onOpenPortfolio(m.portfolioUuid) : undefined,
      }));
    }
    if (breakdown === "holding") {
      return holdings.map((h, i) => ({
        key: h.assetId,
        label: h.name,
        value: h.marketValue,
        weightPct: h.weightPct,
        color: palette(i),
        onOpen: h.ticker ? () => setExploringAsset(h) : undefined,
      }));
    }
    if (breakdown === "class") {
      const byClass = new Map<string, number>();
      for (const h of holdings) byClass.set(h.assetClass, (byClass.get(h.assetClass) ?? 0) + h.marketValue);
      return [...byClass.entries()].sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({
        key: label, label, value, weightPct: total > 0 ? (value / total) * 100 : 0, color: palette(i),
      }));
    }
    const exposure = breakdown === "sector" ? sector : region;
    let colorIndex = 0;
    return [...(exposure?.entries ?? [])].sort((a, b) => b.weightPct - a.weightPct).map((e) => ({
      key: e.label,
      label: e.label,
      value: (e.weightPct / 100) * total,
      weightPct: e.weightPct,
      color: e.label === "Unknown" ? UNKNOWN_EXPOSURE_COLOR : palette(colorIndex++),
    }));
  }, [breakdown, holdings, members, sector, region, currency, colorOf, onOpenPortfolio]);

  const total = items.reduce((sum, i) => sum + i.value, 0);
  const hidden = items.slice(COMPOSITION_TOP);
  const shown: CompositionItem[] = hidden.length > 0
    ? [
        ...items.slice(0, COMPOSITION_TOP),
        {
          key: COMPOSITION_OTHER,
          label: `${hidden.length} more`,
          value: hidden.reduce((sum, i) => sum + i.value, 0),
          weightPct: hidden.reduce((sum, i) => sum + i.weightPct, 0),
          color: COMPOSITION_OTHER_COLOR,
          onOpen: () => setExploring(true),
        },
      ]
    : items;
  const focus = shown.find((i) => i.key === hovered) ?? null;
  const navigable = items.some((i) => i.onOpen);
  const isLast = (item: CompositionItem) => item === shown[shown.length - 1];

  const carousel = holdings.length > 0 && breakdowns.length > 1;
  const stepButton = "h-6 w-6 rounded-full flex items-center justify-center text-[#a8a29e] transition-colors hover:text-[#1c1917] hover:bg-[#F7F5EF] outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40";
  // Under the body, on one line: the breakdown shown and a dot for each, between the steps to
  // the previous and next one. The active dot fills up over 5 seconds (composition-autoplay, in globals.css),
  // and when it's full the carousel steps on (onAnimationEnd), so the timer and what it draws
  // can't drift apart. It holds while the card is hovered or has the keyboard's focus (a click on
  // a dot or an arrow leaves focus there, and mustn't stop it for good), or its detail is open, and
  // never runs with reduced motion.
  const paused = exploring || exploringAsset !== null;
  const controls = carousel && (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label="Breakdown"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
        if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      }}
      className="flex items-center justify-center gap-1"
    >
      <button type="button" onClick={() => step(-1)} aria-label="Previous breakdown" className={stepButton}>
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-center gap-3 px-1">
        <span className="min-w-[88px] text-right text-[11.5px] font-semibold text-[#1c1917]">{BREAKDOWN_LABELS[breakdown]}</span>
        <div className="flex items-center gap-1.5">
          {breakdowns.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => pick(b)}
              aria-label={BREAKDOWN_LABELS[b]}
              aria-current={b === breakdown}
              title={BREAKDOWN_LABELS[b]}
              className="h-3 flex items-center outline-none group/dot"
            >
              <span
                className={`relative block h-1.5 rounded-full overflow-hidden transition-all duration-300 group-focus-visible/dot:ring-2 group-focus-visible/dot:ring-[#C49A3C]/40 ${
                  b === breakdown ? "w-6 bg-[#EEE9DD]" : "w-1.5 bg-[#E0DACC] group-hover/dot:bg-[#a8a29e]"
                }`}
              >
                {b === breakdown && (
                  <span
                    key={b}
                    onAnimationEnd={() => step(1)}
                    className={`absolute inset-0 origin-left bg-[#C49A3C] motion-safe:animate-composition-autoplay group-hover/module:[animation-play-state:paused] group-has-[:focus-visible]/module:[animation-play-state:paused] ${
                      paused ? "[animation-play-state:paused]" : ""
                    }`}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
      <button type="button" onClick={() => step(1)} aria-label="Next breakdown" className={stepButton}>
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <Module className="flex flex-col">
      <ModuleHead
        title="Composition"
        desc={navigable ? "Open a slice or a row to go down a level. Open the module for everything it's made of." : "A breakdown to read: the holdings and portfolios open from the first view. Open the module for everything it's made of."}
        onExplore={holdings.length > 0 ? () => setExploring(true) : undefined}
      />
      {SlotPlaceholder({ slot, preparingMessage: PREPARING_TICK }) ?? (holdings.length === 0 ? (
        <div className="py-14 flex flex-col items-center justify-center text-center px-6">
          <div className="p-4 bg-slate-50 rounded-2xl mb-3">
            <Wallet className="h-6 w-6 text-slate-300" />
          </div>
          <p className="text-slate-600 font-semibold">No holdings yet</p>
          <p className="text-slate-400 text-sm mt-1">Upload or add transactions to see your holdings here.</p>
        </div>
      ) : (
        <div
          className={`flex-1 flex flex-col justify-center gap-3 overflow-hidden ${MODULE_BODY}`}
          // On touch, a sideways swipe over the body steps the carousel.
          onTouchStart={carousel ? (e) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; } : undefined}
          onTouchEnd={carousel ? (e) => {
            const start = touchStart.current;
            touchStart.current = null;
            if (!start) return;
            const dx = e.changedTouches[0].clientX - start.x;
            const dy = e.changedTouches[0].clientY - start.y;
            if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
          } : undefined}
        >
          <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={breakdown}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: d * 24, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -24, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="grid grid-cols-1 @md:grid-cols-[minmax(0,170px)_minmax(0,1fr)] @2xl:grid-cols-[210px_minmax(0,1fr)] gap-5 @2xl:gap-[26px] items-center">
            <div className="relative w-full max-w-[210px] aspect-square mx-auto">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 210, height: 210 }}>
                <PieChart>
                  <Pie
                    data={shown}
                    dataKey="value"
                    nameKey="label"
                    innerRadius="67%"
                    outerRadius="98%"
                    paddingAngle={items.length > 1 ? 1.4 : 0}
                    stroke="none"
                    isAnimationActive={false}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {shown.map((item) => (
                      <Cell
                        key={item.key}
                        fill={item.color}
                        opacity={hovered && hovered !== item.key ? 0.25 : 1}
                        cursor={item.onOpen ? "pointer" : "default"}
                        onMouseEnter={() => setHovered(item.key)}
                        onClick={item.onOpen}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-[22%] text-center">
                <span className="text-xl font-bold text-[#1c1917] tabular-nums">
                  {focus ? `${focus.weightPct.toFixed(1)}%` : formatCurrency(total, currency, 0)}
                </span>
                <span className="text-[10.5px] text-[#78716c] truncate max-w-full">{focus ? focus.label : "total"}</span>
              </div>
            </div>
            <ul className="min-w-0">
              {shown.map((item) => {
                const content = (
                  <>
                    <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: item.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[#1c1917]">{item.label}</span>
                      {item.sub && <span className="block truncate text-[11.5px] font-medium text-[#78716c]">{item.sub}</span>}
                    </span>
                    <span className="shrink-0 pl-4 @2xl:pl-8 text-right tabular-nums">
                      <span className="block font-bold text-[#1c1917]">{formatCurrency(item.value, currency, 0)}</span>
                      {/* On a narrow card the weight goes under the value, leaving the name room. */}
                      <span className="block @2xl:hidden text-[11.5px] text-[#78716c]">{item.weightPct.toFixed(1)}%</span>
                    </span>
                    <span className="hidden @2xl:block shrink-0 min-w-[92px] text-right text-xs text-[#78716c] tabular-nums">
                      {item.weightPct.toFixed(1)}%
                    </span>
                    <span className="w-4 @2xl:w-[18px] shrink-0">{item.onOpen && <ChevronRight className="h-4 w-4 text-[#a8a29e]" />}</span>
                  </>
                );
                const rowClass = `w-full flex items-center gap-3 px-2 @2xl:px-2.5 py-[9px] @2xl:py-[11px] rounded-[14px] text-left transition-colors ${isLast(item) ? "" : "border-b border-[#EEE9DD]"} ${hovered === item.key ? "bg-[#F7F5EF]" : ""}`;
                return (
                  <li key={item.key} onMouseEnter={() => setHovered(item.key)} onMouseLeave={() => setHovered(null)}>
                    {item.onOpen ? (
                      <button type="button" onClick={item.onOpen} className={`${rowClass} hover:bg-[#F7F5EF] outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40`}>
                        {content}
                      </button>
                    ) : (
                      <div className={rowClass}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </motion.div>
          </AnimatePresence>
          {controls}
        </div>
      ))}

      {exploring && (
        <ExploreView title="Composition" onClose={() => setExploring(false)}>
          <CompositionExplore
            holdings={holdings}
            sector={sector?.entries ?? []}
            region={region?.entries ?? []}
            members={aggregate ? members : []}
            overlapping={aggregate?.comovement.module?.overlappingAssets ?? []}
            currency={currency}
            colorOfPortfolio={colorOf}
            onOpenAsset={(h) => { setExploring(false); setExploringAsset(h); }}
            onOpenPortfolio={onOpenPortfolio}
          />
        </ExploreView>
      )}
      {exploringAsset?.ticker && (
        <ExploreView title={exploringAsset.ticker} onClose={() => setExploringAsset(null)}>
          <AssetExplore ticker={exploringAsset.ticker} assetId={exploringAsset.assetId} portfolioUuid={portfolioUuid} revision={slot.revision} />
        </ExploreView>
      )}
    </Module>
  );
}

/**
 * COMPOSITION EXPLORE — everything the Composition card sums up, beyond its largest few: how
 * concentrated the portfolio is, every holding as a map (area by value, colour by asset class)
 * and as a table to sort, and each look-through breakdown (asset class, sector, region, and on
 * "All portfolios" each portfolio and the assets held in more than one) in full, as bars. A
 * holding opens its page (AssetExplore), a portfolio its own.
 */
function CompositionExplore({
  holdings, sector, region, members, overlapping, currency, colorOfPortfolio, onOpenAsset, onOpenPortfolio,
}: {
  holdings: PortfolioHoldingResponse[];
  sector: ExposureEntryResponse[];
  region: ExposureEntryResponse[];
  members: InsightsPortfoliosModule["members"];
  overlapping: InsightsComovementModule["overlappingAssets"];
  currency: string;
  colorOfPortfolio: (uuid: string) => string;
  onOpenAsset: (holding: PortfolioHoldingResponse) => void;
  onOpenPortfolio?: (uuid: string) => void;
}) {
  const total = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const weightOf = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  const byValue = useMemo(() => [...holdings].sort((a, b) => b.marketValue - a.marketValue), [holdings]);

  // Asset classes, largest first, each with its colour (the map's and the bars').
  const classes = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of holdings) map.set(h.assetClass, (map.get(h.assetClass) ?? 0) + h.marketValue);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({
      label, value, color: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length],
    }));
  }, [holdings]);
  const classColor = (assetClass: string) => classes.find((c) => c.label === assetClass)?.color ?? COMPOSITION_OTHER_COLOR;

  // Concentration: the largest holding, the largest five, and the effective number of holdings
  // (1 / Σw², the count of equal-sized holdings that would be as concentrated).
  const weights = byValue.map((h) => weightOf(h.marketValue) / 100);
  const top5 = weights.slice(0, 5).reduce((sum, w) => sum + w, 0) * 100;
  const herfindahl = weights.reduce((sum, w) => sum + w * w, 0);
  const effective = herfindahl > 0 ? 1 / herfindahl : null;
  const largest = byValue[0];

  const exposureBars = (entries: ExposureEntryResponse[]) => {
    let colorIndex = 0;
    return [...entries].sort((a, b) => b.weightPct - a.weightPct).map((e) => ({
      key: e.label,
      label: e.label,
      value: e.weightPct,
      figure: `${e.weightPct.toFixed(1)}%`,
      color: e.label === "Unknown" ? UNKNOWN_EXPOSURE_COLOR : CATEGORICAL_PALETTE[colorIndex++ % CATEGORICAL_PALETTE.length],
    }));
  };

  const map = byValue.filter((h) => h.marketValue > 0).map((h) => ({
    name: h.ticker ?? h.isin ?? h.name,
    size: h.marketValue,
    fullName: h.name,
    weightPct: weightOf(h.marketValue),
    color: classColor(h.assetClass),
    assetId: h.assetId,
  }));

  const columns: DataColumn<PortfolioHoldingResponse>[] = [
    {
      key: "asset",
      label: "Asset",
      sortValue: (h) => h.name,
      render: (h) => h.ticker ? (
        <button type="button" onClick={() => onOpenAsset(h)} className="text-left hover:text-[#8A6A28] transition-colors">
          <AssetCell ticker={h.ticker} name={h.name} />
        </button>
      ) : <AssetCell ticker={h.isin} name={h.name} />,
    },
    {
      key: "class",
      label: "Class",
      sortValue: (h) => h.assetClass,
      render: (h) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[#78716c]">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: classColor(h.assetClass) }} />{h.assetClass}
        </span>
      ),
    },
    { key: "value", label: "Value", align: "right", sortValue: (h) => h.marketValue, render: (h) => <span className="font-bold">{formatCurrency(h.marketValue, currency, 0)}</span> },
    { key: "weight", label: "Weight", align: "right", sortValue: (h) => h.marketValue, render: (h) => `${weightOf(h.marketValue).toFixed(1)}%` },
    { key: "cost", label: "Invested", align: "right", sortValue: (h) => h.costBasis, render: (h) => formatCurrency(h.costBasis, currency, 0) },
    { key: "pnl", label: "Unrealized", align: "right", sortValue: (h) => h.unrealizedPnl, render: (h) => <SignedAmount amount={h.unrealizedPnl} currency={currency} /> },
    { key: "roi", label: "Return", align: "right", sortValue: (h) => h.roiPct, render: (h) => <SignedPct pct={h.roiPct} /> },
  ];

  return (
    <>
      <ExplorePanel title="Concentration" desc="How much of the value sits in a few holdings.">
        <Figs className={MODULE_BODY}>
          <Fig label="Holdings" value={String(holdings.length)} sub={`${classes.length} asset ${classes.length === 1 ? "class" : "classes"}`} strong />
          {largest && <Fig label="Largest" value={`${weightOf(largest.marketValue).toFixed(1)}%`} sub={largest.ticker ?? largest.name} />}
          <Fig label="Largest five" value={`${top5.toFixed(1)}%`} sub="Of the value" />
          <Fig
            label="Effective holdings"
            value={effective === null ? "—" : effective.toFixed(1)}
            sub={effective === null ? undefined : effective < 5 ? "Concentrated" : effective < 15 ? "Moderately spread" : "Well spread"}
            info="How many equally sized holdings would be as concentrated as yours (1 over the sum of the squared weights). Far below the number of holdings means a few of them carry most of the value."
          />
        </Figs>
      </ExplorePanel>

      {map.length > 1 && (
        <ExplorePanel title="Holdings Map" desc="Every holding, its area its value, its colour its asset class. Open one for its page.">
          <div className={MODULE_BODY}>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 800, height: 340 }}>
                <Treemap
                  data={map}
                  dataKey="size"
                  nameKey="name"
                  isAnimationActive={false}
                  content={(node) => <HoldingsMapCell node={node} onOpen={(assetId) => { const h = holdings.find((x) => x.assetId === assetId); if (h?.ticker) onOpenAsset(h); }} />}
                />
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 pt-3 text-[11.5px] text-[#78716c]">
              {classes.map((c) => (
                <span key={c.label} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />{c.label} · {weightOf(c.value).toFixed(0)}%
                </span>
              ))}
            </div>
          </div>
        </ExplorePanel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[22px]">
        {members.length > 0 && (
          <ExplorePanel title="By Portfolio" desc="Each portfolio's share of the value. Open one for its page.">
            <div className={MODULE_BODY}>
              <HBars
                rows={[...members].sort((a, b) => b.weightPct - a.weightPct).map((m) => ({
                  key: m.portfolioUuid,
                  label: m.name,
                  value: m.weightPct,
                  figure: `${m.weightPct.toFixed(1)}%`,
                  color: colorOfPortfolio(m.portfolioUuid),
                  title: `${m.name} · ${formatCurrency(m.marketValue, currency, 0)}`,
                }))}
                onSelect={onOpenPortfolio}
              />
            </div>
          </ExplorePanel>
        )}
        <ExplorePanel title="By Asset Class" desc="What kind of assets the value is in.">
          <div className={MODULE_BODY}>
            <HBars rows={classes.map((c) => ({ key: c.label, label: c.label, value: weightOf(c.value), figure: `${weightOf(c.value).toFixed(1)}%`, color: c.color, title: `${c.label} · ${formatCurrency(c.value, currency, 0)}` }))} />
          </div>
        </ExplorePanel>
        {sector.length > 0 && (
          <ExplorePanel title="By Sector" desc="Looking through funds to the companies they hold, by weight.">
            <div className={MODULE_BODY}><HBars rows={exposureBars(sector)} /></div>
          </ExplorePanel>
        )}
        {region.length > 0 && (
          <ExplorePanel title="By Region" desc="Looking through funds to where their companies are, by weight.">
            <div className={MODULE_BODY}><HBars rows={exposureBars(region)} /></div>
          </ExplorePanel>
        )}
      </div>

      <ExplorePanel title="Every Holding" desc="Sort by any column. Open a holding for its page.">
        <DataTable columns={columns} rows={byValue} rowKey={(h) => h.assetId} initialSort={{ key: "value", desc: true }} />
      </ExplorePanel>

      {overlapping.length > 0 && (
        <ExplorePanel title="Held in More Than One Portfolio" desc="Your combined position in these is bigger than any single portfolio shows.">
          <div className={MODULE_BODY}>
            {overlapping.map((a) => (
              <div key={a.assetId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-2.5 border-b border-[#EEE9DD] last:border-b-0">
                <span className="truncate text-[13px] font-semibold text-[#1c1917]">
                  {a.ticker ?? a.name}{a.ticker && <span className="ml-2 font-medium text-[11.5px] text-[#78716c]">{a.name}</span>}
                </span>
                <span className="text-right text-[13px] font-bold tabular-nums">
                  {formatCurrency(a.marketValue, currency, 0)}
                  <span className="ml-2 text-xs font-medium text-[#78716c]">{a.weightPct.toFixed(1)}%</span>
                </span>
                <span className="col-span-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] text-[#78716c]">
                  {a.holdings.map((h) => (
                    <span key={h.portfolioUuid} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: colorOfPortfolio(h.portfolioUuid) }} />
                      {members.find((m) => m.portfolioUuid === h.portfolioUuid)?.name ?? "—"} <span className="tabular-nums">{formatCurrency(h.marketValue, currency, 0)}</span>
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </ExplorePanel>
      )}
    </>
  );
}

// One holding's tile on the Holdings Map: its colour, and its ticker and weight when it has room.
function HoldingsMapCell({ node, onOpen }: { node: TreemapNode; onOpen: (assetId: string) => void }) {
  const { x, y, width, height, depth } = node;
  if (depth !== 1) return <g />;
  const name = String(node.name ?? "");
  const color = String(node.color ?? COMPOSITION_OTHER_COLOR);
  const weightPct = Number(node.weightPct ?? 0);
  const roomy = width > 56 && height > 34;
  return (
    <g className="cursor-pointer" onClick={() => onOpen(String(node.assetId))}>
      <title>{`${String(node.fullName ?? name)} · ${weightPct.toFixed(1)}%`}</title>
      <rect x={x + 1} y={y + 1} width={Math.max(0, width - 2)} height={Math.max(0, height - 2)} rx={6} fill={color} className="transition-opacity hover:opacity-85" />
      {roomy && (
        <>
          <text x={x + 9} y={y + 19} fill="#ffffff" fontSize={12} fontWeight={700}>{name.length > width / 8 ? `${name.slice(0, Math.max(1, Math.floor(width / 8) - 1))}…` : name}</text>
          {height > 46 && <text x={x + 9} y={y + 34} fill="#ffffff" fillOpacity={0.85} fontSize={11}>{weightPct.toFixed(1)}%</text>}
        </>
      )}
    </g>
  );
}

const ASSET_RANGES: AssetChartRange[] = ["1M", "6M", "1Y", "5Y", "MAX"];
const ASSET_RANGE_LABELS: Record<AssetChartRange, string> = { "1M": "1 month", "6M": "6 months", "1Y": "1 year", "5Y": "5 years", MAX: "all time" };

/**
 * ASSET EXPLORE — one holding's own page, opened from a row of HoldingsExplorer: its price
 * over a chosen range (GET /v1/assets/{ticker}), what the asset is (identifiers, class,
 * sector or TER…), what it's made of when it's a fund, and the user's own position in it
 * (GET /positions/{assetId}, fetched alongside: the asset endpoint knows nothing about
 * portfolios).
 *
 * Prices default to the user's reference currency, the one the rest of Insights is in; when
 * the asset is quoted in another one, a toggle switches to its own quote prices. Changing
 * range keeps the previous chart on screen (dimmed) until the new one arrives, since a ticker
 * nobody else holds can take a few seconds.
 */
function AssetExplore({ ticker, assetId, portfolioUuid, revision }: { ticker: string; assetId: string; portfolioUuid: string; revision: number }) {
  const position = useDetail(() => portfolioService.getPosition(portfolioUuid, assetId), assetId, revision);
  const [range, setRange] = useState<AssetChartRange>("1Y");
  const [inQuoteCurrency, setInQuoteCurrency] = useState(false);
  // `forRange`: the range the last answer (data or error) was for — loading while it isn't the
  // one selected. `data` is kept across a range change so the old chart stays up meanwhile.
  const [state, setState] = useState<{ data: AssetDetailResponse | null; error: string | null; forRange: AssetChartRange | null }>({
    data: null, error: null, forRange: null,
  });

  useEffect(() => {
    let cancelled = false;
    portfolioService.getAssetDetail(ticker, range)
      .then((data) => { if (!cancelled) setState({ data, error: null, forRange: range }); })
      .catch((err) => {
        if (cancelled) return;
        const error = err instanceof ApiError && err.status === 404
          ? "No market data is available for this asset."
          : "Unable to load this right now. Try again in a moment.";
        setState((prev) => ({ ...prev, error, forRange: range }));
      });
    return () => { cancelled = true; };
  }, [ticker, range]);

  const loading = state.forRange !== range;
  const error = loading ? null : state.error;
  const { data } = state;
  const hasQuoteToggle = data !== null && data.quoteCurrency !== data.currency;
  const showQuote = hasQuoteToggle && inQuoteCurrency;
  const series = data ? (showQuote ? data.quotePrices : data.prices) : null;
  const unit = data ? (showQuote ? data.quoteCurrency : data.currency) : "";
  const points = useMemo(() => (series ? toChartPoints(series) : []), [series]);

  if (data === null) {
    return loading ? (
      <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" /></div>
    ) : (
      <Module><ModuleMessage>{error}</ModuleMessage></Module>
    );
  }

  const first = series?.values[0];
  const last = series?.values[series.values.length - 1];
  const changePct = first && last !== undefined ? (last / first - 1) * 100 : null;
  const rising = (changePct ?? 0) >= 0;
  const lineColor = changePct === null ? PORTFOLIO_COLOR : rising ? "#10b981" : "#f43f5e";

  const facts: { label: string; value: string }[] = [
    { label: "Ticker", value: data.ticker },
    ...(data.isin ? [{ label: "ISIN", value: data.isin }] : []),
    { label: "Asset class", value: data.assetClass },
    ...(data.sector ? [{ label: "Sector", value: data.sector }] : []),
    ...(data.industry ? [{ label: "Industry", value: data.industry }] : []),
    ...(data.country ? [{ label: "Country", value: data.country }] : []),
    ...(data.terPct !== null ? [{ label: "TER", value: `${data.terPct.toFixed(2)}%` }] : []),
    { label: "Quoted in", value: data.quoteCurrency },
  ];
  const held = position.data?.holding ?? null;
  const posCurrency = position.data?.currency ?? data.currency;
  const weights = (entries: ExposureEntryResponse[]) =>
    entries.slice(0, 6).map((e, i) => ({
      key: e.label,
      label: e.label,
      value: e.weightPct,
      figure: `${e.weightPct.toFixed(0)}%`,
      color: e.label === "Unknown" ? UNKNOWN_EXPOSURE_COLOR : CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length],
    }));
  const chip = (on: boolean) =>
    `px-2.5 py-1 rounded-full border text-[11.5px] font-semibold transition-colors ${on ? "bg-[#1c1917] border-[#1c1917] text-white" : "border-[#E0DACC] text-[#78716c] hover:text-[#1c1917]"}`;

  return (
    <>
      <PageHeader
        eyebrow={`Holding · ${data.assetClass}`}
        title={data.name}
        value={held ? formatCurrency(held.marketValue, posCurrency, 0) : last !== undefined ? formatCurrency(last, unit, 2) : undefined}
        change={held ? { text: `${formatPct(held.roiPct)} since first buy`, tone: toneOfValue(held.roiPct) } : null}
        note={data.ticker}
        figures={held ? [
          { label: "Position", value: formatCurrency(held.marketValue, posCurrency, 0), sub: `${formatQuantity(held.quantity)} ${data.assetClass === "Crypto" ? data.ticker : "shares"}` },
          { label: "Return", value: formatPct(held.roiPct), sub: "Since first buy", tone: toneOfValue(held.roiPct) },
          { label: "In portfolio", value: `${held.weightPct.toFixed(1)}%`, sub: "Of its value" },
          { label: "Unrealized P&L", value: formatSignedCurrency(held.unrealizedPnl, posCurrency), sub: `On ${formatCurrency(held.costBasis, posCurrency, 0)} invested`, tone: toneOfValue(held.unrealizedPnl) },
        ] : []}
      />

      <Module>
        <ModuleHead
          title="Price"
          desc="Adjusted closes over the range picked."
          right={
            <div className="flex flex-wrap items-center gap-1.5">
              {ASSET_RANGES.map((r) => (
                <button key={r} type="button" aria-pressed={r === range} onClick={() => setRange(r)} className={chip(r === range)}>{r}</button>
              ))}
              {hasQuoteToggle && [data.currency, data.quoteCurrency].map((c) => (
                <button key={c} type="button" aria-pressed={c === unit} onClick={() => setInQuoteCurrency(c === data.quoteCurrency)} className={chip(c === unit)}>{c}</button>
              ))}
              {changePct !== null && (
                <span className={`ml-1.5 text-[13px] font-bold tabular-nums ${toneClass(toneOfValue(changePct))}`} title={`Over ${ASSET_RANGE_LABELS[data.range]}`}>
                  {formatPct(changePct)}
                </span>
              )}
            </div>
          }
        />
        <div className={MODULE_BODY}>
          {error && <p className="pb-3 text-sm font-semibold text-[#e11d48]">{error}</p>}
          {points.length < 2 ? (
            <p className="text-[12.5px] text-[#a8a29e]">No prices in this range.</p>
          ) : (
            <div className={`h-[220px] transition-opacity ${loading ? "opacity-40" : ""}`}>
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 220 }}>
                <AreaChart data={points} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={data.frequency === "daily" && data.range === "1M" ? chartDateLabel : monthShortYearLabel}
                    tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={40}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => formatCompact(Number(v))}
                    tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    labelFormatter={(label) => fullDateLabel(label as string)}
                    formatter={(value) => [formatCurrency(Number(value), unit, 2), "Close"]}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Area type="monotone" dataKey="value" stroke={lineColor} strokeWidth={2} fill={lineColor} fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {data.pricesAsOf && <NoteS className="pt-2">Last close on {fullDateLabel(data.pricesAsOf)}, {formatCurrency(last ?? 0, unit, 2)}.</NoteS>}
        </div>
      </Module>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[22px]">
        {position.data && <PositionPanel position={position.data} />}
        <Module>
          <ModuleHead title="Profile" desc="What the asset is and where it trades." />
          <Figs className={MODULE_BODY}>
            {facts.map((f) => <Fig key={f.label} label={f.label} value={f.value} />)}
          </Figs>
        </Module>
        {data.sectorWeightings.length > 1 && (
          <Module>
            <ModuleHead title="By Sector" desc="Where the fund's companies operate, by weight." />
            <div className={MODULE_BODY}><HBars rows={weights(data.sectorWeightings)} /></div>
          </Module>
        )}
        {data.regionWeightings.length > 1 && (
          <Module>
            <ModuleHead title="By Region" desc="The fund's geographic exposure, by weight." />
            <div className={MODULE_BODY}><HBars rows={weights(data.regionWeightings)} /></div>
          </Module>
        )}
        {data.topHoldings.length > 0 && (
          <Module>
            <ModuleHead title="Largest Holdings" desc="The fund's largest positions, by weight." />
            <div className={MODULE_BODY}><HBars rows={weights(data.topHoldings)} /></div>
          </Module>
        )}
        {position.data?.dividends && position.data.dividends.lifetimeIncome > 0 && (
          <Module>
            <ModuleHead title="Dividends" desc="What it has paid you." />
            <Figs className={MODULE_BODY}>
              <Fig label="Received" value={formatCurrency(position.data.dividends.lifetimeIncome, posCurrency, 0)} sub="Since first buy" tone="gain" strong />
              <Fig label="Last 12 months" value={formatCurrency(position.data.dividends.trailing12MIncome, posCurrency, 0)} />
              <Fig label="Yield" value={plainPctOrDash(position.data.dividends.yieldPct)} />
              <Fig label="Yield on cost" value={plainPctOrDash(position.data.dividends.yieldOnCostPct)} />
            </Figs>
          </Module>
        )}
      </div>
    </>
  );
}

/**
 * POSITION PANEL — the user's own position in an asset, in the reference currency: what's held
 * now and what it's worth, then what selling it has realized and what trading it has cost on each
 * broker, each only when it applies. Its dividends are a module of their own.
 */
function PositionPanel({ position }: { position: PositionResponse }) {
  const { currency, holding, realized, costs } = position;
  const sold = realized !== null && realized.realizedTradingPnl !== 0;
  if (!holding && !sold && costs.length === 0) return null;

  return (
    <Module>
      <ModuleHead
        title={holding ? "Position" : "Past Position"}
        desc="What you hold of it, what selling it has realized and what trading it has cost."
      />
      <Figs className={MODULE_BODY}>
        {holding && (
          <>
            <Fig label="Market value" value={formatCurrency(holding.marketValue, currency, 0)} strong />
            <Fig label="Unrealized P&L" value={formatSignedCurrency(holding.unrealizedPnl, currency)} tone={toneOfValue(holding.unrealizedPnl)} />
            <Fig label="Quantity" value={formatQuantity(holding.quantity)} />
            <Fig label="Avg. cost" value={formatCurrency(holding.avgCost, currency, 2)} />
            <Fig label="Price" value={formatCurrency(holding.currentPrice, holding.currency, 2)} />
            <Fig label="Invested" value={formatCurrency(holding.costBasis, currency, 0)} />
          </>
        )}
        {sold && <Fig label="Realized from sales" value={formatSignedCurrency(realized.realizedTradingPnl, currency)} tone={toneOfValue(realized.realizedTradingPnl)} />}
        {costs.map((c) => (
          <Fig key={c.broker} label={costs.length > 1 ? `Trading costs · ${c.broker}` : "Trading costs"} value={formatCurrency(c.totalCosts, currency, 2)} />
        ))}
      </Figs>
    </Module>
  );
}


/**
 * PERIOD HERO — the headline figure atop a month's Performance card: End Value large and
 * prominent, with Total Change as a colored badge beside it, rather than folded in as one
 * more equal-weight tile among Start Value / Market Effect / Dividends below. Gives the
 * card a clear focal point instead of reading as a flat wall of same-size stats.
 */
function PeriodHero({
  currency, endValue, deltaValue, deltaValuePct, isGain, hasBaseline, label = "End Value",
}: {
  currency: string; endValue: number; deltaValue: number; deltaValuePct: number; isGain: boolean; hasBaseline: boolean;
  label?: string;
}) {
  const DeltaIcon = isGain ? TrendingUp : TrendingDown;
  return (
    <div className="p-6 md:p-7 pb-5 border-b border-slate-100">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</p>
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="text-3xl md:text-4xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {formatCurrency(endValue, currency, 0)}
        </p>
        <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${isGain ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
          {isGain ? "+" : ""}{formatCurrency(deltaValue, currency, 0)}
        </span>
      </div>
      {/* The percentage gets its own colored, directional line rather than sitting in
          parentheses next to the amount above — it's a distinct figure, not an annotation. */}
      <div className={`flex items-center gap-1 text-sm font-bold mt-2 ${!hasBaseline ? "text-slate-400" : isGain ? "text-emerald-600" : "text-rose-600"}`}>
        {hasBaseline ? (
          <>
            <DeltaIcon className="h-3.5 w-3.5" />
            {formatPct(deltaValuePct)}
          </>
        ) : (
          "—"
        )}
      </div>
      <p className="text-[13px] text-slate-500 mt-1.5">Total change for the month, including capital added or withdrawn</p>
    </div>
  );
}

/**
 * MONTH DETAIL — a single month's full breakdown, opened by clicking a cell in the returns
 * heatmap: a Performance card led by End Value as the headline figure (Total Change as a
 * badge next to it) with Start Value / Return / Market Effect / Dividends (when there were any) as supporting figures, plus
 * a separate Risk card for Volatility / Max Drawdown — kept apart from Performance since
 * these are risk figures, not performance, and mixing them read as one undifferentiated wall
 * of tiles (see the Monthly/Annual detail view this replaces). The month in progress is
 * valued as of today, and has no volatility or drawdown until it closes.
 */
// `withSummary` false for the month in progress, whose summary is This Month's (MonthToDateModule).
function MonthDetail({ period, withSummary = true }: { period: PeriodDashboard; withSummary?: boolean }) {
  const isGain = period.deltaValue >= 0;
  const marketIsGain = period.marketEffect >= 0;
  const hasBaseline = hasPeriodBaseline(period);
  const twr = period.timeWeightedReturnPct;
  // A month without dividends leaves their tile out.
  const hasDividends = period.dividendsInPeriod !== 0;

  return (
    <div className="space-y-6">
      {isPeriodEmpty(period) && withSummary ? (
        <EmptyPeriodState message="No portfolio activity recorded for this month yet." />
      ) : (
        <>
          {withSummary && <Module>
            <ModuleHead
              eyebrow={period.currency}
              title="The Month"
              desc={period.inProgress ? "From the value at the end of last month to today's." : "From the value at the end of the previous month to its own."}
            />
            <PeriodHero
              currency={period.currency}
              endValue={period.t1Value}
              deltaValue={period.deltaValue}
              deltaValuePct={period.deltaValuePct}
              isGain={isGain}
              hasBaseline={hasBaseline}
              label={period.inProgress ? "Value Today" : undefined}
            />
            <div className={`grid grid-cols-2 ${hasDividends ? "sm:grid-cols-4" : "sm:grid-cols-3"} divide-y divide-slate-100 sm:divide-y-0 sm:divide-x`}>
              <StatContent
                title="Start Value"
                value={formatCurrency(period.t0Value, period.currency, 0)}
                icon={<Wallet className="h-4 w-4 text-slate-500" />}
                info="Market value at the close of the previous month."
                color="slate"
              />
              <StatContent
                title="Return"
                value={twr !== null ? formatPct(twr) : "—"}
                icon={twr === null || twr >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
                info={twr !== null ? "Time-weighted, unaffected by money added or withdrawn." : "Not available yet for this month."}
                color={twr === null ? "slate" : twr >= 0 ? "emerald" : "red"}
              />
              <StatContent
                title="Market Effect"
                value={<AmountWithDelta amount={`${marketIsGain ? "+" : ""}${formatCurrency(period.marketEffect, period.currency, 0)}`} pct={period.marketEffectPct} hasBaseline={hasBaseline} />}
                icon={marketIsGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
                info="Price movement alone, capital flows excluded."
                color={marketIsGain ? "emerald" : "red"}
              />
              {hasDividends && (
                <StatContent
                  title="Dividends"
                  value={formatCurrency(period.dividendsInPeriod, period.currency, 0)}
                  icon={<CircleDollarSign className="h-4 w-4 text-blue-600" />}
                  info={period.inProgress ? "Received so far this month." : "Received this month."}
                  color="blue"
                />
              )}
            </div>
          </Module>}
          <Module>
            <ModuleHead
              eyebrow="Risk"
              title="Volatility & Drawdown"
              desc="How choppy this month was, independent of direction."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y divide-slate-100 sm:divide-y-0 sm:divide-x">
              <StatContent
                title="Volatility"
                value={period.volatilityPct !== null ? `${period.volatilityPct.toFixed(2)}%` : "—"}
                icon={<Activity className="h-4 w-4 text-slate-500" />}
                info={period.inProgress ? "Available once the month closes." : "Annualized, from daily returns."}
                color="slate"
              />
              <StatContent
                title="Max Drawdown"
                value={period.maxDrawdownPct !== null ? `${period.maxDrawdownPct.toFixed(2)}%` : "—"}
                icon={<TrendingDown className="h-4 w-4 text-slate-500" />}
                info={period.inProgress ? "Available once the month closes." : "Largest peak-to-trough decline."}
                color="slate"
              />
            </div>
          </Module>
        </>
      )}
    </div>
  );
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Monthly market-effect swings beyond this magnitude paint at full color intensity — chosen
// so a typical +/-1-3% month still reads clearly rather than everything looking pale.
const HEATMAP_INTENSITY_CAP = 8;

function heatmapCellStyle(pct: number): React.CSSProperties {
  const intensity = Math.min(Math.abs(pct) / HEATMAP_INTENSITY_CAP, 1);
  const [r, g, b] = pct >= 0 ? [16, 185, 129] : [244, 63, 94]; // emerald-500 / rose-500
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${(0.12 + intensity * 0.68).toFixed(3)})`,
    color: intensity > 0.5 ? "#ffffff" : pct >= 0 ? "#047857" : "#be123c",
  };
}

/**
 * MONTHLY RETURNS HEATMAP — one row per calendar year (most recent first), one column per
 * calendar month, each cell shaded by that month's time-weighted return, same figure as
 * /performance (green = gain, rose = loss,
 * intensity scaled by magnitude) and clickable to open MonthDetail. Replaces the old
 * Monthly/Annual tabs' bar chart + card picker: a single grid makes the whole history
 * scannable at once instead of one time horizon at a time. Backed by
 * FullHistoryDashboard.monthlyMarketEffect, a single lightweight all-years fetch — a
 * (year, month) pair simply absent (before inception) renders as an empty, non-clickable
 * cell rather than a false zero. A month without a TWR yet (e.g. under a year of history)
 * falls back to its market effect ÷ opening value, marked as such in the cell's tooltip. The
 * month in progress is included, valued as of today, and drawn with a dashed outline.
 */
function MonthlyReturnsHeatmap({
  entries, onSelectMonth,
}: {
  entries: MonthlyMarketEffectEntry[]; onSelectMonth: (year: number, month: number) => void;
}) {
  const byYear = useMemo(() => {
    const map = new Map<number, Map<number, { pct: number; isTwr: boolean }>>();
    for (const e of entries) {
      if (!map.has(e.year)) map.set(e.year, new Map());
      map.get(e.year)!.set(e.month, e.timeWeightedReturnPct !== null
        ? { pct: e.timeWeightedReturnPct, isTwr: true }
        : { pct: e.marketEffectPct, isTwr: false });
    }
    return map;
  }, [entries]);
  const now = new Date();

  const years = useMemo(() => [...byYear.keys()].sort((a, b) => b - a), [byYear]);

  if (years.length === 0) {
    return <p className="text-sm text-slate-400 p-6 md:p-7">Not enough history yet to chart.</p>;
  }

  return (
    <div className="p-6 md:p-7 overflow-x-auto">
      <table className="border-collapse min-w-150 w-full table-fixed">
        <thead>
          <tr>
            <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 pb-3 pr-3 w-16">Year</th>
            {MONTH_LABELS.map((m) => (
              <th key={m} className="text-[10px] font-black uppercase tracking-widest text-slate-400 pb-3 text-center">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year}>
              <td className="text-sm font-bold text-slate-900 pr-3 py-1 tabular-nums">{year}</td>
              {MONTH_LABELS.map((_, i) => {
                const month = i + 1;
                const cell = byYear.get(year)?.get(month);
                if (cell === undefined) {
                  return (
                    <td key={month} className="p-1">
                      <div className="w-full aspect-square rounded-lg bg-slate-50" />
                    </td>
                  );
                }
                const { pct, isTwr } = cell;
                const inProgress = year === now.getFullYear() && month === now.getMonth() + 1;
                return (
                  <td key={month} className="p-1">
                    <button
                      onClick={() => onSelectMonth(year, month)}
                      title={`${MONTH_LABELS[i]} ${year}${inProgress ? " (to date)" : ""}: ${formatPct(pct)}${isTwr ? "" : " market effect"}`}
                      style={heatmapCellStyle(pct)}
                      className={`w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold tabular-nums hover:ring-2 hover:ring-offset-1 hover:ring-[#C49A3C] transition-all cursor-pointer ${inProgress ? "outline-2 outline-dashed outline-offset-1 outline-slate-400" : ""}`}
                    >
                      {Math.round(pct)}%
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// One of the realized P&L module's headline figures: a label with its explanation, the figure,
// and a line under it.
function RealizedFigure({ label, info, value, note, tone, emphasis = false }: {
  label: string; info: string; value: string; note: string; tone?: "gain" | "loss"; emphasis?: boolean;
}) {
  return (
    <div className="px-6 md:px-7 py-5">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
        {label}
        <InfoTip text={info}>
          <Info className="h-3.5 w-3.5 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
        </InfoTip>
      </p>
      <p
        className={`font-black tabular-nums mt-1.5 ${emphasis ? "text-3xl" : "text-xl"} ${
          tone === "gain" ? "text-emerald-600" : tone === "loss" ? "text-rose-600" : "text-slate-900"
        }`}
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {value}
      </p>
      <p className="text-[11px] font-semibold text-slate-400 mt-1">{note}</p>
    </div>
  );
}

/**
 * REALIZED P&L MODULE — the Income & Costs section's realized P&L: what selling has locked in
 * since inception and the dividends received (just the one from sales when no dividend ever
 * was), in the reference currency, each sale converted at its own date. Its detail is Profit &
 * Loss's (ProfitLossExplore): every realized and dividend figure, then every asset in one table.
 */
function RealizedPnlModule({ slot, currency, portfolioUuid }: {
  slot: ModuleSlot<InsightsRealizedPnlModule>;
  currency: string;
  portfolioUuid: string;
}) {
  const [exploring, setExploring] = useState(false);
  const data = slot.module;
  const hasAny = data !== null && (data.topAssets.length > 0 || data.totalRealizedPnl !== 0);
  const canExplore = hasAny && !slot.updating;
  // No dividend ever: the total is the sales', so that's the one figure.
  const hasDividends = data !== null && data.totalDividendIncome !== 0;

  return (
    <Module>
      <ModuleHead
        title="Realized P&L"
        desc={hasDividends || data === null ? "What selling has locked in since inception, plus the dividends received." : "What selling has locked in since inception."}
        onExplore={canExplore ? () => setExploring(true) : undefined}
      />
      <SlotPlaceholder slot={slot} preparingMessage={PREPARING_TICK} />
      {data !== null && !slot.updating && (
        <div className={`${MODULE_BODY} space-y-3.5`}>
          {slot.lagging && <UpdatingNote />}
          {!hasAny ? (
            <p className="text-[12.5px] text-[#a8a29e]">No closed positions yet.</p>
          ) : (
            <FigRows
              rows={[
                hasDividends && { key: "total", label: "Total realized", value: formatSignedCurrency(data.totalRealizedPnl, currency), tone: toneOfValue(data.totalRealizedPnl) },
                { key: "sales", label: "From sales", value: formatSignedCurrency(data.totalRealizedTradingPnl, currency), tone: toneOfValue(data.totalRealizedTradingPnl), info: "Sale proceeds minus what those units cost, each sale converted at its own date." },
                hasDividends && { key: "dividends", label: "From dividends", value: formatCurrency(data.totalDividendIncome, currency, 0), tone: toneOfValue(data.totalDividendIncome), info: "Dividends received since inception, from the holdings you still have and the ones you sold." },
              ]}
            />
          )}
        </div>
      )}
      {canExplore && exploring && (
        <ExploreView title="Profit & Loss" onClose={() => setExploring(false)}>
          <ProfitLossExplore portfolioUuid={portfolioUuid} revision={slot.revision} />
        </ExploreView>
      )}
    </Module>
  );
}

/**
 * PROFIT & LOSS EXPLORE — the Realized P&L module's detail: what selling has locked in
 * (/insights/realized-pnl) and every dividend figure (/insights/dividends), then every asset in one
 * table (AssetPnlTable). The two load on their own, and the table shows as soon as either has.
 * Without any dividend ever received, the dividends' panel and columns are left out.
 */
function ProfitLossExplore({ portfolioUuid, revision }: { portfolioUuid: string; revision: number }) {
  const realized = useDetail(() => portfolioService.getRealizedPnl(portfolioUuid), portfolioUuid, revision);
  const dividends = useDetail(() => portfolioService.getDividends(portfolioUuid), portfolioUuid, revision);
  const loading = realized.loading || dividends.loading;
  // No dividend ever received: nothing about them, here or in the table.
  const noDividends = dividends.data !== null && dividends.data.totalLifetimeIncome === 0 && !dividends.data.byAsset.some((a) => a.lifetimeIncome > 0);
  return (
    <>
      <DetailBody detail={realized}>{(data) => <RealizedPnlFigures data={data} />}</DetailBody>
      {!noDividends && <DetailBody detail={dividends}>{(data) => <DividendsFigures data={data} />}</DetailBody>}
      {!loading && (realized.data || dividends.data) && (
        <AssetPnlTable realized={realized.data} dividends={dividends.data} withDividends={!noDividends} />
      )}
    </>
  );
}

function RealizedPnlFigures({ data }: { data: RealizedPnlResponse }) {
  const { currency } = data;
  const hasDividends = data.totalDividendIncome !== 0;
  return (
      <ExplorePanel
        eyebrow={currency}
        title="Realized P&L"
        desc={`What selling has locked in since inception, each sale converted at its own date${hasDividends ? ", plus the dividends received" : ""}.`}
      >
        {/* The same band of figures as the module on the page. */}
        <div className="@container">
          <div className={`grid grid-cols-1 ${hasDividends ? "@xl:grid-cols-3" : ""} divide-y @xl:divide-y-0 @xl:divide-x divide-slate-100`}>
            {hasDividends && <RealizedFigure label="Total" info="From sales plus dividends, since inception." value={formatSignedCurrency(data.totalRealizedPnl, currency)} note="Sales and dividends together" tone={data.totalRealizedPnl >= 0 ? "gain" : "loss"} emphasis />}
            <RealizedFigure label="From sales" info="Sale proceeds minus what those units cost, each sale converted at its own date." value={formatSignedCurrency(data.totalRealizedTradingPnl, currency)} note="Proceeds minus what the units cost" tone={data.totalRealizedTradingPnl >= 0 ? "gain" : "loss"} emphasis={!hasDividends} />
            {hasDividends && <RealizedFigure label="From dividends" info="Dividends received since inception, from the holdings you still have and the ones you sold." value={formatCurrency(data.totalDividendIncome, currency, 0)} note="Received, held or sold since" />}
          </div>
        </div>
      </ExplorePanel>
  );
}

// One asset's row in Profit & Loss's table: its realized P&L and its dividends, joined on the
// asset. null where the asset has no such figure (never sold, or never paid), or its half of the
// data didn't load.
interface AssetPnlRow {
  assetId: string;
  ticker: string | null;
  name: string;
  isHeld: boolean | null;
  fromSales: number | null;
  dividends: number | null;
  total: number | null;
  trailing12M: number | null;
  prior12M: number | null;
  growthYoyPct: number | null;
  yieldPct: number | null;
  yieldOnCostPct: number | null;
}

/**
 * Every asset sold or that has paid: the realized P&L's rows in their order (largest gains and
 * losses from sales first, dividend-only assets last), each with its dividend figures, then any
 * payer the realized P&L doesn't list. An asset's lifetime dividends are the realized P&L's (so
 * they add up to its total), or the dividends' when it isn't there.
 */
function joinAssetPnl(realized: RealizedPnlResponse | null, dividends: DividendsResponse | null): AssetPnlRow[] {
  const payers = new Map((dividends?.byAsset ?? []).filter((a) => a.lifetimeIncome > 0).map((a) => [a.assetId, a]));
  const fromDividends = (d: DividendsResponse["byAsset"][number] | undefined) => ({
    trailing12M: d?.trailing12MIncome ?? null,
    prior12M: d?.prior12MIncome ?? null,
    growthYoyPct: d?.growthYoyPct ?? null,
    yieldPct: d?.yieldPct ?? null,
    yieldOnCostPct: d?.yieldOnCostPct ?? null,
  });
  const rows: AssetPnlRow[] = (realized?.byAsset ?? []).map((r) => ({
    assetId: r.assetId,
    ticker: r.ticker,
    name: r.name,
    isHeld: r.isHeld,
    fromSales: r.realizedTradingPnl,
    dividends: r.dividendIncome,
    total: r.realizedPnl,
    ...fromDividends(payers.get(r.assetId)),
  }));
  const listed = new Set(rows.map((r) => r.assetId));
  for (const d of payers.values()) {
    if (listed.has(d.assetId)) continue;
    rows.push({
      assetId: d.assetId, ticker: d.ticker, name: d.name, isHeld: null,
      fromSales: null, dividends: d.lifetimeIncome, total: null,
      ...fromDividends(d),
    });
  }
  return rows;
}

/**
 * ASSET P&L TABLE — Profit & Loss's every asset, in one table instead of one for the realized P&L
 * and one for the dividends (which repeated each asset's lifetime dividends): what selling it
 * locked in, what it has paid, the total, then its dividends over the last two years and its
 * yields. Every column sorts; it scrolls sideways when it doesn't fit.
 */
function AssetPnlTable({ realized, dividends, withDividends }: {
  realized: RealizedPnlResponse | null;
  dividends: DividendsResponse | null;
  // false: no dividend was ever received, so the table is just what selling locked in.
  withDividends: boolean;
}) {
  const currency = realized?.currency ?? dividends?.currency ?? "EUR";
  const rows = useMemo(() => joinAssetPnl(realized, dividends), [realized, dividends]);
  const money = (v: number | null) => (v === null ? <span className="text-slate-300">—</span> : formatCurrency(v, currency, 0));
  const signed = (v: number | null) => (v === null ? <span className="text-slate-300">—</span> : <SignedAmount amount={v} currency={currency} />);
  const columns = useMemo((): DataColumn<AssetPnlRow>[] => [
    { key: "asset", label: "Asset", sortValue: (a) => a.ticker ?? a.name, render: (a) => <AssetCell ticker={a.ticker} name={a.name} sub={a.isHeld === null ? undefined : a.isHeld ? "Still partly held" : "Closed"} /> },
    { key: "sales", label: "From sales", align: "right", sortValue: (a) => a.fromSales, render: (a) => signed(a.fromSales) },
    ...(withDividends ? ([
      { key: "dividends", label: "Dividends", align: "right", sortValue: (a) => a.dividends, render: (a) => money(a.dividends) },
      { key: "total", label: "Total", align: "right", sortValue: (a) => a.total, render: (a) => signed(a.total) },
      { key: "t12m", label: "Div. last 12m", align: "right", sortValue: (a) => a.trailing12M, render: (a) => money(a.trailing12M) },
      { key: "p12m", label: "Div. prior 12m", align: "right", sortValue: (a) => a.prior12M, render: (a) => money(a.prior12M) },
      { key: "yoy", label: "Change", align: "right", sortValue: (a) => a.growthYoyPct, render: (a) => <SignedPct pct={a.growthYoyPct} /> },
      { key: "yield", label: "Yield", align: "right", sortValue: (a) => a.yieldPct, render: (a) => plainPctOrDash(a.yieldPct) },
      { key: "yoc", label: "On cost", align: "right", sortValue: (a) => a.yieldOnCostPct, render: (a) => plainPctOrDash(a.yieldOnCostPct) },
    ] satisfies DataColumn<AssetPnlRow>[]) : []),
  // money and signed only read currency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [currency, withDividends]);

  return (
    <ExplorePanel
      eyebrow={currency}
      title="By Asset"
      desc={withDividends
        ? "Every asset sold or that has paid dividends: what selling it locked in, what it has paid, and its dividends over the last two years. The largest gains and losses from sales first."
        : "Every asset sold: what selling it locked in. The largest gains and losses first."}
    >
      <DataTable columns={columns} rows={rows} rowKey={(a) => a.assetId} />
    </ExplorePanel>
  );
}

// A signed amount in a table cell, green or red by its sign.
function SignedAmount({ amount, currency }: { amount: number; currency: string }) {
  return <span className={`font-bold ${amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatSignedCurrency(amount, currency)}</span>;
}

const monthShortYearLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

const formatPctOrDash = (pct: number | null) => (pct === null ? "—" : formatPct(pct));

/**
 * MODULE SLOT — what a module on the page is drawn from: its own object in its section's
 * response (null until its document is first computed), and the state of the section's request
 * around it. A stale module (the user edited transactions, the rebuild hasn't landed) is
 * `updating` while useInsights is still waiting for it — the caller hides its figures behind
 * StaleUpdatingState, since old and new numbers would describe two different portfolios — and
 * `lagging` once it has stopped waiting: the figures are drawn with an UpdatingNote.
 * `revision` goes up with each fetch of the section, so an open detail view fetches again too.
 */
interface ModuleSlot<M> {
  module: M | null;
  loading: boolean;
  failed: boolean;
  updating: boolean;
  lagging: boolean;
  revision: number;
}

function slotOf<S, M>(
  section: SectionState<S>, timedOut: boolean, pick: (data: S) => M | null, staleOf: (module: M, data: S) => boolean,
): ModuleSlot<M> {
  const data = section.data;
  const picked = data === null ? null : pick(data);
  const stale = data !== null && picked !== null && staleOf(picked, data);
  return {
    module: picked,
    loading: data === null && !section.failed,
    failed: data === null && section.failed,
    updating: stale && !timedOut,
    lagging: stale && timedOut,
    revision: section.revision,
  };
}

// Most modules carry their own isStale; value, this month and the heatmap go by the Performance
// section's historyIsStale instead (see HistoryPage).
const ownStale = (module: { isStale: boolean }) => module.isStale;

// How deep each overlay sits over the page: a month opens from a detail view.
const OVERLAY_DEPTH: Record<DashboardOverlay | "none", number> = { none: 0, explore: 1, month: 2 };

const PREPARING_ANALYTICS = "Being prepared — this shows up after the overnight analysis of your portfolio has run.";
const PREPARING_TICK = "Being prepared — this shows up shortly after your first transactions are processed.";

/**
 * Shared loading / failed / null / updating placeholder for a module; null when there's a module
 * to draw normally. `updating` takes priority over drawing the module's own content but comes
 * after the other states, which all mean there's nothing to be stale about.
 */
function SlotPlaceholder({ slot, preparingMessage = PREPARING_ANALYTICS }: { slot: ModuleSlot<unknown>; preparingMessage?: string }) {
  if (slot.loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin h-6 w-6 text-[#C49A3C]" />
      </div>
    );
  }
  if (slot.failed) return <ModuleMessage>Unable to load this right now. Try again in a moment.</ModuleMessage>;
  if (slot.module === null) return <ModuleMessage>{preparingMessage}</ModuleMessage>;
  if (slot.updating) return <StaleUpdatingState />;
  return null;
}

// The module's figures can be drawn: loaded, computed, and not waiting on a rebuild.
const ready = <M,>(slot: ModuleSlot<M>): slot is ModuleSlot<M> & { module: M } => slot.module !== null && !slot.updating;

/**
 * A detail view's document (see useDetail): a spinner while it loads, a message when it failed or
 * isn't computed yet, otherwise `children` with it. A document that's stale inside its detail is
 * drawn with an UpdatingNote on top: the module that opened it was fresh a moment ago, and the
 * page fetches it again once the rebuild lands.
 */
function DetailBody<T extends { isStale: boolean }>({
  detail, children,
}: { detail: { data: T | null; error: unknown; loading: boolean }; children: (data: T) => React.ReactNode }) {
  if (detail.loading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" /></div>;
  }
  if (detail.data === null) {
    return (
      <Module>
        <ModuleMessage>{detail.error ? "Unable to load this right now. Try again in a moment." : PREPARING_ANALYTICS}</ModuleMessage>
      </Module>
    );
  }
  return (
    <>
      {detail.data.isStale && <UpdatingNote />}
      {children(detail.data)}
    </>
  );
}

/**
 * ROLLING VOLATILITY CHART — annualized volatility over a rolling window, one point per day
 * from the backend, thinned by toChartPoints before drawing.
 */
function RollingVolatilityChart({ series, className = "h-64" }: { series: TimeSeries; className?: string }) {
  const points = useMemo(() => toChartPoints(series), [series]);

  if (points.length < 2) {
    return <p className="text-[12.5px] text-[#a8a29e]">Not enough data yet to chart.</p>;
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 256 }}>
        <LineChart data={points} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={monthShortYearLabel}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            labelFormatter={(label) => fullDateLabel(label as string)}
            formatter={(value) => [`${Number(value).toFixed(2)}%`, "Volatility"]}
            contentStyle={TOOLTIP_STYLE}
          />
          <Line type="monotone" dataKey="value" name="Volatility" stroke="#C49A3C" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * VOLATILITY MODULE — the Risk section's volatility: the portfolio's annualized volatility as a
 * headline, and the rolling series behind it. Null until the first analytics run, and
 * "insufficient_history" (nothing to show but a message) under a year of history. Risk on the
 * page: its detail (RiskDetail) holds the rest of it.
 */
function VolatilityModule({
  slot, portfolioUuid, returnsRevision, aggregate, maxDrawdownPct,
}: {
  slot: ModuleSlot<InsightsVolatilityModule>;
  portfolioUuid: string;
  returnsRevision: number;
  aggregate: AggregateSlots | null;
  // Since inception, from the comparison; null to leave it out.
  maxDrawdownPct: number | null;
}) {
  const data = slot.module;
  const [exploring, setExploring] = useState(false);

  return (
    <Module>
      <ModuleHead
        onExplore={ready(slot) ? () => setExploring(true) : undefined}
        title="Volatility"
        desc={`${data?.rollingWindowDays ? `The chart uses a rolling ${data.rollingWindowDays}-day window.` : "How much your portfolio's value moves around."} Open it for its turbulent periods and drawdowns.`}
      />
      <SlotPlaceholder slot={slot} />
      {ready(slot) && (
        <div className={`${MODULE_BODY} space-y-4`}>
          {slot.lagging && <UpdatingNote />}
          {slot.module.status === "insufficient_history" ? (
            <p className="text-[12.5px] text-[#a8a29e]">Volatility needs at least a year of history — it will appear once your portfolio has one.</p>
          ) : (
            // The figures in a column beside the chart, as in the Performance module.
            <div className="grid grid-cols-1 @2xl:grid-cols-[auto_minmax(0,1fr)] gap-[22px] @2xl:gap-8 items-center">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] @2xl:grid-cols-1 gap-x-5 gap-y-5 @2xl:min-w-[150px]">
                <Fig
                  label="Volatility"
                  value={plainPctOrDash(slot.module.annualizedVolatilityPct)}
                  info="How widely your portfolio's daily returns swing, scaled to a year (the standard deviation of daily returns, annualized). A higher figure means bigger ups and downs along the way."
                  strong
                />
                {maxDrawdownPct !== null && <Fig label="Max drawdown" value={formatPct(maxDrawdownPct)} tone={toneOfValue(maxDrawdownPct)} strong />}
              </div>
              {slot.module.rollingVolatilityPct && <RollingVolatilityChart series={slot.module.rollingVolatilityPct} className="h-[170px]" />}
            </div>
          )}
        </div>
      )}
      {ready(slot) && exploring && (
        <ExploreView title="Risk" onClose={() => setExploring(false)}>
          <RiskDetail portfolioUuid={portfolioUuid} revision={slot.revision} returnsRevision={returnsRevision} aggregate={aggregate} />
        </ExploreView>
      )}
    </Module>
  );
}

const shortDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const rangeLabel = (start: string, end: string) => `${shortDateLabel(start)} – ${shortDateLabel(end)}`;
const daysBetween = (start: string, end: string) => Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000);

/**
 * VOLATILITY EXPLORE — the detail view behind VolatilityModule, /insights/volatility: the
 * rolling chart, then the turbulent stretches the backend picked out of it (riskEvents), most
 * recent first, with what the portfolio did through each and what it held at the time; then the
 * drawdown (DrawdownSection): how far below its previous high it fell, and its deepest falls.
 * `revision` follows both documents it's built from (volatility and returns).
 */
function VolatilityExplore({ portfolioUuid, revision }: { portfolioUuid: string; revision: number }) {
  const detail = useDetail(() => portfolioService.getVolatility(portfolioUuid), portfolioUuid, revision);
  return <DetailBody detail={detail}>{(data) => <VolatilityDetail data={data} />}</DetailBody>;
}

function VolatilityDetail({ data }: { data: VolatilityDetailResponse }) {
  if (data.status === "insufficient_history") {
    return <Module><ModuleMessage>Volatility needs at least a year of history — it will appear once your portfolio has one.</ModuleMessage></Module>;
  }
  return <VolatilityPanels data={data} />;
}

function VolatilityPanels({ data }: { data: VolatilityDetailResponse }) {
  const events = useMemo(() => [...data.riskEvents].sort((a, b) => b.startDate.localeCompare(a.startDate)), [data]);
  const eventColumns: DataColumn<RiskEventEntry>[] = [
    {
      key: "period", label: "Period", sortValue: (e) => e.startDate,
      render: (e) => <span className="font-bold text-[#1c1917] whitespace-nowrap">{rangeLabel(e.startDate, e.endDate)}</span>,
    },
    { key: "days", label: "Days", align: "right", sortValue: (e) => daysBetween(e.startDate, e.endDate), render: (e) => daysBetween(e.startDate, e.endDate) + 1 },
    { key: "vol", label: "Volatility", align: "right", sortValue: (e) => e.annualizedVolatilityPct, render: (e) => <span className="font-bold">{plainPctOrDash(e.annualizedVolatilityPct)}</span> },
    { key: "return", label: "Return", align: "right", sortValue: (e) => e.cumulativeReturnPct, render: (e) => <SignedPct pct={e.cumulativeReturnPct} /> },
    { key: "held", label: "Held", grow: true, render: (e) => <HeldNames names={e.assetNames} /> },
  ];

  return (
    <>
      <ExplorePanel
        eyebrow="Risk"
        title="Rolling Volatility"
        desc={`Annualized volatility${data.rollingWindowDays ? ` over a rolling ${data.rollingWindowDays}-day window` : ""}, day by day.`}
        right={
          <span className="text-sm font-black tabular-nums text-slate-900">
            {plainPctOrDash(data.annualizedVolatilityPct)} <span className="text-xs font-bold text-slate-400">overall</span>
          </span>
        }
      >
        {data.rollingVolatilityPct ? <RollingVolatilityChart series={data.rollingVolatilityPct} className={`${MODULE_BODY} h-64`} /> : <ModuleMessage>Not enough data yet to chart.</ModuleMessage>}
      </ExplorePanel>
      <DrawdownSection data={data} part="chart" />
      <ExplorePanel
        eyebrow="Risk"
        title="Turbulent Periods"
        desc="Stretches of at least five trading days when the portfolio's 20-day volatility stayed in its top 10%, with what it held then. Hover what it held for the full list."
      >
        {events.length === 0 ? (
          <ModuleMessage>No stretch of unusual turbulence so far.</ModuleMessage>
        ) : (
          <DataTable columns={eventColumns} rows={events} rowKey={(e) => `${e.startDate}-${e.endDate}`} />
        )}
      </ExplorePanel>
      <DrawdownSection data={data} part="falls" />
    </>
  );
}

// How many of a turbulent period's holdings are named in its row; the rest are a "+N" with the
// full list on hovering it.
const HELD_NAMES_SHOWN = 2;

function HeldNames({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-[#a8a29e]">—</span>;
  const shown = names.slice(0, HELD_NAMES_SHOWN);
  const more = names.length - shown.length;
  return (
    <span className="flex items-center gap-1.5 min-w-0" title={names.join(", ")}>
      <span className="truncate text-[#78716c]">{shown.join(", ")}</span>
      {more > 0 && (
        <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-[#F7F5EF] text-[10.5px] font-bold text-[#78716c] cursor-help">+{more}</span>
      )}
    </span>
  );
}

/**
 * CUMULATIVE RETURN CHART — portfolio vs. benchmark, both in percent with base 0 at the start
 * (not a growth multiple). The backend says both curves share the same dates, but the
 * benchmark is still looked up by date rather than zipped by index so a gap on either side
 * can't misalign the lines.
 */
function CumulativeReturnChart({ portfolio, benchmark }: { portfolio: TimeSeries; benchmark: TimeSeries }) {
  const data = useMemo(() => {
    const benchmarkByDate = new Map(benchmark.dates.map((d, i) => [d, benchmark.values[i]]));
    return toChartPoints(portfolio).map((p) => ({ date: p.date, portfolio: p.value, benchmark: benchmarkByDate.get(p.date) }));
  }, [portfolio, benchmark]);

  if (data.length < 2) {
    return <ModuleMessage>Not enough history yet to chart.</ModuleMessage>;
  }

  return (
    <div className="p-6 md:p-7 h-64">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 256 }}>
        <LineChart data={data} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={monthShortYearLabel}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            labelFormatter={(label) => fullDateLabel(label as string)}
            formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name]}
            contentStyle={TOOLTIP_STYLE}
          />
          <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke={PORTFOLIO_COLOR} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="benchmark" name="Benchmark" stroke={BENCHMARK_COLOR} strokeWidth={2} dot={false} strokeDasharray="4 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

type BasketEntry = BenchmarkComponentEntry & { weightPct: number };

// The benchmark's current basket, largest first. The backend also lists proxies of closed
// positions at weight 0; those are dropped so only today's basket is shown.
const benchmarkBasket = (components: BenchmarkComponentEntry[]): BasketEntry[] =>
  components.filter((c): c is BasketEntry => (c.weightPct ?? 0) > 0).sort((a, b) => b.weightPct - a.weightPct);

/**
 * BENCHMARK BASKET LIST — what the dashed benchmark line is made of: the proxy ETFs it holds,
 * with their weights, bars in the benchmark's grey so they read as that line's explanation.
 */
function BenchmarkBasketList({ basket }: { basket: BasketEntry[] }) {
  const max = Math.max(...basket.map((c) => c.weightPct), 0.01);
  return (
    <div className="grid grid-cols-1 @xl:grid-cols-2 gap-x-8 gap-y-3">
      {basket.map((c, i) => (
        <div key={`${c.ticker ?? c.name}-${i}`}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="min-w-0 truncate">
              <span className="text-[13px] font-bold text-slate-900">{c.ticker ?? c.name}</span>
              {c.ticker && <span className="text-xs text-slate-400 ml-2">{c.name}</span>}
            </span>
            <span className="text-[13px] font-bold text-slate-500 tabular-nums shrink-0">{c.weightPct.toFixed(1)}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(c.weightPct / max) * 100}%`, background: BENCHMARK_COLOR }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const BENCHMARK_BASKET_INFO =
  "Each of your holdings is matched to a proxy ETF. The benchmark holds them at today's weights and receives the same deposits and withdrawals as your portfolio.";

const benchmarkCoverage = (yearsCovered: number | null) =>
  yearsCovered !== null ? `Over the ${yearsCovered.toFixed(1)} years you share with the benchmark` : "Since inception";

// A difference in percentage points, green when it's the better side for the portfolio.
// `higherIsBetter` false for volatility; drawdowns are negative, so a higher one is milder.
function PointsDiff({ diff, higherIsBetter = true }: { diff: number | null; higherIsBetter?: boolean }) {
  if (diff === null) return <span className="text-slate-400">—</span>;
  const good = higherIsBetter ? diff >= 0 : diff <= 0;
  return <span className={`font-bold ${good ? "text-emerald-600" : "text-rose-600"}`}>{diff >= 0 ? "+" : ""}{diff.toFixed(2)} pp</span>;
}

const diffOrNull = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);

interface BenchmarkPairRow {
  key: string;
  label: string;
  portfolio: number | null;
  benchmark: number | null;
  diff: number | null;
  higherIsBetter: boolean;
  signed: boolean;
}

/**
 * BENCHMARK EXPLORE — the detail view behind BenchmarkTile, /insights/benchmark: the chart
 * again, the portfolio and the benchmark figure by figure (return and risk side by side), the
 * relative statistics, and the whole basket.
 */
function BenchmarkExplore({ portfolioUuid, revision }: { portfolioUuid: string; revision: number }) {
  const detail = useDetail(() => portfolioService.getBenchmark(portfolioUuid), portfolioUuid, revision);
  return <DetailBody detail={detail}>{(data) => <BenchmarkDetail data={data} />}</DetailBody>;
}

function BenchmarkDetail({ data }: { data: BenchmarkResponse }) {
  if (data.status !== "ok") {
    return <Module><ModuleMessage>Not enough overlapping history with the benchmark yet to compare.</ModuleMessage></Module>;
  }
  return <BenchmarkPanels data={data} />;
}

function BenchmarkPanels({ data }: { data: BenchmarkResponse }) {
  const basket = useMemo(() => benchmarkBasket(data.components), [data]);
  const coverage = benchmarkCoverage(data.yearsCovered);
  const pairs: BenchmarkPairRow[] = [
    { key: "total", label: "Total return", portfolio: data.portfolioTotalReturnPct, benchmark: data.benchmarkTotalReturnPct, diff: diffOrNull(data.portfolioTotalReturnPct, data.benchmarkTotalReturnPct), higherIsBetter: true, signed: true },
    { key: "annual", label: "Per year", portfolio: data.portfolioAnnualizedReturnPct, benchmark: data.benchmarkAnnualizedReturnPct, diff: data.excessReturnPct, higherIsBetter: true, signed: true },
    { key: "vol", label: "Volatility", portfolio: data.portfolioVolatilityPct, benchmark: data.benchmarkVolatilityPct, diff: diffOrNull(data.portfolioVolatilityPct, data.benchmarkVolatilityPct), higherIsBetter: false, signed: false },
    { key: "dd", label: "Deepest fall", portfolio: data.portfolioMaxDrawdownPct, benchmark: data.benchmarkMaxDrawdownPct, diff: diffOrNull(data.portfolioMaxDrawdownPct, data.benchmarkMaxDrawdownPct), higherIsBetter: true, signed: false },
  ];
  const cell = (row: BenchmarkPairRow, value: number | null) =>
    row.signed ? formatPctOrDash(value) : plainPctOrDash(value);
  const pairColumns: DataColumn<BenchmarkPairRow>[] = [
    { key: "label", label: "", render: (r) => <span className="font-bold text-slate-900 whitespace-nowrap">{r.label}</span> },
    { key: "portfolio", label: "Portfolio", align: "right", render: (r) => <span className="font-bold text-slate-900">{cell(r, r.portfolio)}</span> },
    { key: "benchmark", label: "Benchmark", align: "right", render: (r) => <span className="text-slate-500">{cell(r, r.benchmark)}</span> },
    { key: "diff", label: "Difference", align: "right", render: (r) => <PointsDiff diff={r.diff} higherIsBetter={r.higherIsBetter} /> },
  ];

  return (
    <>
      {data.portfolioCumulativeReturnPct && data.benchmarkCumulativeReturnPct && (
        <ExplorePanel eyebrow="Benchmark" title="Portfolio vs. Benchmark" desc={`Cumulative return. ${coverage}.`}>
          <CumulativeReturnChart portfolio={data.portfolioCumulativeReturnPct} benchmark={data.benchmarkCumulativeReturnPct} />
        </ExplorePanel>
      )}
      <ExplorePanel eyebrow="Benchmark" title="Side by Side" desc="The return and risk of each, over the same period.">
        <DataTable columns={pairColumns} rows={pairs} rowKey={(r) => r.key} />
      </ExplorePanel>
      <ExplorePanel
        eyebrow="Benchmark"
        title="Relative Figures"
        desc={`How the portfolio's returns relate to the benchmark's${data.tradingDays !== null ? `, over ${data.tradingDays.toLocaleString("en-US")} trading days both have a price` : ""}. Hover a figure for what it means.`}
      >
        <RelativeFigures data={data} />
      </ExplorePanel>
      {basket.length > 0 && (
        <ExplorePanel eyebrow="Benchmark" title="What the Benchmark Is Made Of" desc={BENCHMARK_BASKET_INFO}>
          <div className="p-6 md:p-7">
            <BenchmarkBasketList basket={basket} />
          </div>
        </ExplorePanel>
      )}
    </>
  );
}


type RelativeRow = { label: string; info: string; value: string; reading: string | null; tone?: "gain" | "loss" };

/**
 * RELATIVE FIGURES — the benchmark comparison's ratios, grouped by the question each answers
 * (did it earn more, does it follow the benchmark, how often was it ahead), one per row: the
 * figure on the right, and under its name what that value means in words. A null figure reads "—"
 * with no words under it.
 */
function RelativeFigures({ data }: { data: BenchmarkResponse }) {
  const signedRatio = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}`);
  const groups: { title: string; rows: RelativeRow[] }[] = [
    {
      title: "Did it earn more?",
      rows: [
        {
          label: "Alpha",
          info: "The part of your annualized return that your exposure to the benchmark (beta) doesn't explain. Positive means the portfolio earned more than its market exposure alone would suggest.",
          value: formatPctOrDash(data.alphaPct),
          reading: data.alphaPct === null ? null : data.alphaPct >= 0 ? "A year above what its market exposure explains" : "A year below what its market exposure explains",
          tone: toneOfValue(data.alphaPct),
        },
        {
          label: "Sharpe ratio difference",
          info: "The portfolio's return per unit of volatility minus the benchmark's. Positive means better risk-adjusted returns.",
          value: signedRatio(data.sharpeRatioDiff),
          reading: data.sharpeRatioDiff === null ? null : data.sharpeRatioDiff >= 0 ? "More return for each unit of risk" : "Less return for each unit of risk",
          tone: toneOfValue(data.sharpeRatioDiff),
        },
        {
          label: "Information ratio",
          info: "The excess return per unit of tracking error: how consistently the portfolio beat the benchmark, rather than by how much.",
          value: ratioOrDash(data.informationRatio),
          reading: data.informationRatio === null ? null
            : data.informationRatio >= 0.5 ? "Ahead of it, consistently"
            : data.informationRatio >= 0 ? "Ahead of it, but unevenly"
            : "Behind it, on balance",
          tone: toneOfValue(data.informationRatio),
        },
      ],
    },
    {
      title: "Does it follow the benchmark?",
      rows: [
        {
          label: "Beta",
          info: "How much your portfolio tends to move when the benchmark moves. 1.0 moves in step with it, 0.5 about half as much, and above 1.0 amplifies its moves.",
          value: ratioOrDash(data.beta),
          reading: data.beta === null ? null
            : data.beta > 1.1 ? "Amplifies the benchmark's moves"
            : data.beta < 0.9 ? "Moves less than the benchmark"
            : "Moves in step with the benchmark",
        },
        {
          label: "Tracking error",
          info: "How much the gap between your portfolio's and the benchmark's daily returns swings, annualized. Low means the portfolio follows the benchmark closely.",
          value: plainPctOrDash(data.trackingErrorPct),
          reading: data.trackingErrorPct === null ? null
            : data.trackingErrorPct < 2 ? "Follows it closely"
            : data.trackingErrorPct < 6 ? "Strays from it now and then"
            : "Goes its own way",
        },
      ],
    },
    {
      title: "How often was it ahead?",
      rows: [
        {
          label: "Days ahead",
          info: "The share of trading days on which the portfolio's return beat the benchmark's.",
          value: plainPctOrDash(data.winRatePct),
          reading: data.winRatePct === null ? null : "Of the trading days, it did better",
        },
        {
          label: "Time in the lead",
          info: "The share of the shared period during which the portfolio's growth since the start was above the benchmark's.",
          value: plainPctOrDash(data.timeOutperformingPct),
          reading: data.timeOutperformingPct === null ? null : "Of the period, it was ahead since the start",
        },
        {
          label: "Recovery ratio",
          info: "The portfolio's total return over its deepest fall: how much it earned for the worst drop it went through.",
          value: ratioOrDash(data.recoveryRatio),
          reading: data.recoveryRatio === null ? null : "Its total return over its deepest fall",
        },
      ],
    },
  ];

  return (
    <div className={`${MODULE_BODY} grid grid-cols-1 @3xl:grid-cols-3 gap-x-8 gap-y-5`}>
      {groups.map((g) => (
        <div key={g.title} className="min-w-0">
          <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#78716c] pb-1">{g.title}</h3>
          <dl>
            {g.rows.map((r) => (
              <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 py-2.5 border-b border-[#EEE9DD] last:border-b-0">
                <dt className="flex items-center gap-1 min-w-0 text-[13px] font-semibold text-[#1c1917]">
                  <span className="truncate">{r.label}</span>
                  <InfoTip text={r.info}>
                    <Info className="h-3 w-3 shrink-0 text-[#a8a29e] hover:text-[#78716c] cursor-help transition-colors" />
                  </InfoTip>
                </dt>
                <dd className={`row-span-2 self-center text-[15px] font-bold tabular-nums ${toneClass(r.tone)}`}>{r.value}</dd>
                {r.reading && <dd className="text-[11.5px] text-[#78716c] truncate">{r.reading}</dd>}
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

const monthYearLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const horizonLabel = (period: string) => (period === "Inception" ? "Since inception" : `Last ${period.toLowerCase()}`);

/**
 * RETURNS EXPLORE — the detail view behind ReturnsModule, /insights/returns: the growth curve the
 * headline figure is the end of, the return of each calendar year, every horizon with the risk
 * taken to earn it, and the best and worst month.
 */
function ReturnsExplore({ portfolioUuid, revision }: { portfolioUuid: string; revision: number }) {
  const detail = useDetail(() => portfolioService.getReturns(portfolioUuid), portfolioUuid, revision);
  return <DetailBody detail={detail}>{(data) => <ReturnsDetail data={data} />}</DetailBody>;
}

function ReturnsDetail({ data }: { data: ReturnsResponse }) {
  if (data.status === "insufficient_history") {
    return <Module><ModuleMessage>Not enough history yet to measure returns — they&apos;ll show up here soon.</ModuleMessage></Module>;
  }
  return <ReturnsPanels data={data} />;
}

function ReturnsPanels({ data }: { data: ReturnsResponse }) {
  const cumulative = useMemo(() => (data.cumulativeReturnPct ? toChartPoints(data.cumulativeReturnPct) : []), [data]);
  const annual = useMemo(
    () => data.annual.filter((a): a is { year: number; returnPct: number } => a.returnPct !== null).map((a) => ({ year: String(a.year), value: a.returnPct })),
    [data],
  );

  const horizonColumns: DataColumn<HorizonEntry>[] = [
    { key: "period", label: "Period", render: (h) => <span className="font-bold text-slate-900 whitespace-nowrap">{horizonLabel(h.period)}</span> },
    { key: "return", label: "Return", align: "right", render: (h) => <SignedPct pct={h.totalReturnPct} /> },
    { key: "vol", label: "Volatility", align: "right", render: (h) => plainPctOrDash(h.volatilityPct) },
    { key: "dd", label: "Deepest fall", align: "right", render: (h) => plainPctOrDash(h.maxDrawdownPct) },
    { key: "rar", label: "Return / risk", align: "right", render: (h) => ratioOrDash(h.riskAdjustedReturn) },
  ];

  return (
    <>
      {cumulative.length >= 2 && (
        <ExplorePanel
          eyebrow="Returns"
          title="Since Inception"
          desc="Time-weighted: money you add or withdraw doesn't count as a gain or a loss."
          right={
            <span className="text-sm tabular-nums">
              <SignedPct pct={data.totalReturnPct} />
              {data.annualizedReturnPct !== null && <span className="text-xs font-bold text-slate-400"> · <SignedPct pct={data.annualizedReturnPct} /> per year</span>}
            </span>
          }
        >
          <div className="p-6 md:p-7 h-64">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 256 }}>
              <AreaChart data={cumulative} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tickFormatter={monthShortYearLabel} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} minTickGap={40} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  labelFormatter={(label) => fullDateLabel(label as string)}
                  formatter={(value) => [formatPct(Number(value)), "Return to date"]}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Area type="monotone" dataKey="value" stroke={PORTFOLIO_COLOR} strokeWidth={2} fill={PORTFOLIO_COLOR} fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ExplorePanel>
      )}
      {(annual.length > 0 || data.bestMonth || data.worstMonth) && (
        <div className={`grid grid-cols-1 gap-[22px] ${annual.length > 0 && (data.bestMonth || data.worstMonth) ? "lg:grid-cols-2" : ""}`}>
          {annual.length > 0 && (
            <ExplorePanel eyebrow="Returns" title="By Calendar Year" desc="The time-weighted return of each calendar year.">
              <div className={`${MODULE_BODY} h-[220px]`}>
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 224 }}>
                  <BarChart data={annual} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} width={56} />
                    <Tooltip formatter={(value) => [formatPct(Number(value)), "Return"]} contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f1f5f9" }} />
                    <Bar dataKey="value" radius={[6, 6, 6, 6]} maxBarSize={48}>
                      {annual.map((a) => <Cell key={a.year} fill={a.value >= 0 ? "#10b981" : "#f43f5e"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ExplorePanel>
          )}
          {(data.bestMonth || data.worstMonth) && (
            <ExplorePanel eyebrow="Returns" title="Best and Worst Months" desc="The extremes of the monthly returns, and the deepest fall since inception.">
              <dl className={MODULE_BODY}>
                {[
                  data.bestMonth && { key: "best", label: monthYearLabel(data.bestMonth.month), sub: "Best month", value: formatPct(data.bestMonth.returnPct), tone: toneOfValue(data.bestMonth.returnPct) },
                  data.worstMonth && { key: "worst", label: monthYearLabel(data.worstMonth.month), sub: "Worst month", value: formatPct(data.worstMonth.returnPct), tone: toneOfValue(data.worstMonth.returnPct) },
                  data.maxDrawdownPct !== null && { key: "fall", label: "Deepest fall", sub: "From a high to a later low, since inception", value: formatPct(-Math.abs(data.maxDrawdownPct)), tone: "loss" as const },
                ].filter((r) => !!r).map((r) => (
                  <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 py-2.5 border-b border-[#EEE9DD] last:border-b-0">
                    <dt className="text-[13px] font-bold text-[#1c1917] truncate">{r.label}</dt>
                    <dd className={`row-span-2 self-center text-[15px] font-bold tabular-nums ${toneClass(r.tone)}`}>{r.value}</dd>
                    <dd className="text-[11.5px] text-[#78716c] truncate">{r.sub}</dd>
                  </div>
                ))}
              </dl>
            </ExplorePanel>
          )}
        </div>
      )}
      {data.horizons.length > 0 && (
        <ExplorePanel
          eyebrow="Returns"
          title="By Horizon"
          desc="Each trailing period with the risk taken to earn it. Return / risk is the return divided by the volatility: how much it earned for each unit of swing."
        >
          <DataTable columns={horizonColumns} rows={data.horizons} rowKey={(h) => h.period} />
        </ExplorePanel>
      )}
    </>
  );
}

/**
 * DRAWDOWN SECTION — part of Volatility's detail view (VolatilityExplore): the drawdown series,
 * how far below its previous high the portfolio stood on each day (0 at a new high, always ≤0),
 * charted and then broken into its deepest falls (DrawdownExplore). It comes from the returns
 * document, so it can be missing while the volatility is there.
 */
function DrawdownSection({ data, part }: { data: VolatilityDetailResponse; part: "chart" | "falls" }) {
  const points = useMemo(() => (data.drawdownPct ? toChartPoints(data.drawdownPct) : []), [data]);

  if (!data.drawdownPct || points.length < 2) {
    // Said once, where the chart would be.
    if (part === "falls") return null;
    return (
      <ExplorePanel eyebrow="Risk" title="Drawdown" desc="How far below its previous high the portfolio stood, day by day.">
        <ModuleMessage>Not enough history yet to chart the drawdown.</ModuleMessage>
      </ExplorePanel>
    );
  }
  return <DrawdownExplore series={data.drawdownPct} points={points} maxDrawdownPct={data.maxDrawdownPct} part={part} />;
}

function DrawdownChart({ points }: { points: { date: string; value: number }[] }) {
  return (
    <div className={`${MODULE_BODY} h-64`}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 256 }}>
        <AreaChart data={points} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={monthShortYearLabel}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            labelFormatter={(label) => fullDateLabel(label as string)}
            formatter={(value) => [`${Number(value).toFixed(2)}%`, "Below previous high"]}
            contentStyle={TOOLTIP_STYLE}
          />
          <Area type="monotone" dataKey="value" stroke="#f43f5e" strokeWidth={2} fill="#f43f5e" fillOpacity={0.12} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DrawdownEpisode {
  peak: string;
  trough: string;
  depthPct: number;
  recovered: string | null;
}

// Values at or above this count as "back at the high": the series is exactly 0 on a new high,
// but leave room for float noise.
const DRAWDOWN_AT_HIGH = -1e-6;

/**
 * Splits the daily drawdown series into episodes: each starts on the last day at a high (the
 * peak), bottoms out at its deepest day (the trough) and ends on the first day back at a high
 * (recovered), or is still open. Deepest first.
 */
function drawdownEpisodes(series: TimeSeries): DrawdownEpisode[] {
  const episodes: DrawdownEpisode[] = [];
  let current: DrawdownEpisode | null = null;
  let lastHigh = series.dates[0];
  series.values.forEach((value, i) => {
    const date = series.dates[i];
    if (value >= DRAWDOWN_AT_HIGH) {
      if (current) {
        current.recovered = date;
        episodes.push(current);
        current = null;
      }
      lastHigh = date;
    } else if (!current) {
      current = { peak: lastHigh, trough: date, depthPct: value, recovered: null };
    } else if (value < current.depthPct) {
      current.trough = date;
      current.depthPct = value;
    }
  });
  if (current) episodes.push(current);
  return episodes.sort((a, b) => a.depthPct - b.depthPct);
}

const DRAWDOWN_EPISODE_ROWS = 10;

/**
 * DRAWDOWN EXPLORE — the drawdown panels of Volatility's detail view, each drawn where the view
 * puts it (`part`): the chart, under the volatility's, and the portfolio's deepest falls one by
 * one, with how long each took to hit bottom and to climb back.
 */
function DrawdownExplore({
  series, points, maxDrawdownPct, part,
}: { series: TimeSeries; points: { date: string; value: number }[]; maxDrawdownPct: number | null; part: "chart" | "falls" }) {
  const episodes = useMemo(() => drawdownEpisodes(series).slice(0, DRAWDOWN_EPISODE_ROWS), [series]);
  const today = series.dates[series.dates.length - 1];

  const columns: DataColumn<DrawdownEpisode>[] = [
    { key: "peak", label: "From the high of", sortValue: (e) => e.peak, render: (e) => <span className="font-bold text-slate-900 whitespace-nowrap">{shortDateLabel(e.peak)}</span> },
    { key: "depth", label: "Fall", align: "right", sortValue: (e) => -e.depthPct, render: (e) => <span className="font-bold text-rose-600">{e.depthPct.toFixed(2)}%</span> },
    { key: "trough", label: "Bottom", align: "right", sortValue: (e) => e.trough, render: (e) => shortDateLabel(e.trough) },
    { key: "down", label: "To bottom", align: "right", sortValue: (e) => daysBetween(e.peak, e.trough), render: (e) => `${daysBetween(e.peak, e.trough)} d` },
    {
      key: "recovery", label: "Recovered", align: "right",
      sortValue: (e) => daysBetween(e.peak, e.recovered ?? today),
      render: (e) => e.recovered
        ? `${daysBetween(e.peak, e.recovered)} d later`
        : <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider">Not yet</span>,
    },
  ];

  if (part === "chart") {
    return (
      <ExplorePanel
        eyebrow="Risk"
        title="Drawdown"
        desc="How far below its previous high the portfolio stood, day by day."
        right={<span className="text-sm font-black tabular-nums text-rose-600">{plainPctOrDash(maxDrawdownPct)} <span className="text-xs font-bold text-slate-400">deepest</span></span>}
      >
        <DrawdownChart points={points} />
      </ExplorePanel>
    );
  }

  return (
    <>
      <ExplorePanel eyebrow="Risk" title="Deepest Falls" desc="The portfolio's deepest falls, how long each took to hit bottom and to climb back.">
        {episodes.length === 0 ? (
          <ModuleMessage>The portfolio hasn&apos;t fallen below a previous high yet.</ModuleMessage>
        ) : (
          <DataTable columns={columns} rows={episodes} rowKey={(e) => e.peak} initialSort={{ key: "depth", desc: true }} />
        )}
      </ExplorePanel>
    </>
  );
}

// How many rows the per-asset / per-platform lists below show before the rest would just be
// noise on a summary tab.
// Every dividend figure, in Profit & Loss's detail.
function DividendsFigures({ data }: { data: DividendsResponse }) {
  return (
      <ExplorePanel eyebrow={data.currency} title="Dividends" desc="Cash paid out by your holdings.">
        <FigureList>
          <FigureRow label="Since inception" info="All the dividends you've received, since your first transaction." value={formatCurrency(data.totalLifetimeIncome, data.currency, 0)} emphasis />
          <FigureRow label="Last 12 months" info="The dividends received over the last 12 months." value={formatCurrency(data.totalTrailing12MIncome, data.currency, 0)} />
          <FigureRow label="Previous 12 months" info="The dividends received in the 12 months before that." value={formatCurrency(data.totalPrior12MIncome, data.currency, 0)} />
          <FigureRow
            label="vs previous year"
            info="How the last 12 months' dividends compare with the 12 months before."
            value={formatPctOrDash(data.portfolioGrowthYoyPct)}
            tone={data.portfolioGrowthYoyPct === null ? undefined : data.portfolioGrowthYoyPct >= 0 ? "gain" : "loss"}
          />
          <FigureRow label="Yield" info="The last 12 months' dividends over what the whole portfolio is worth today." value={plainPctOrDash(data.wholePortfolioYieldPct)} />
          <FigureRow label="Yield of paying holdings" info="The same, counting only the holdings that pay dividends." value={plainPctOrDash(data.portfolioYieldPct)} />
          <FigureRow label="Paying holdings" info="How much of the portfolio's value is in holdings that paid a dividend over the last 12 months." value={plainPctOrDash(data.payersShareOfPortfolioPct)} />
          <FigureRow label="Yield on cost" info="The last 12 months' dividends over what you paid for the holdings that pay them." value={plainPctOrDash(data.portfolioYieldOnCostPct)} />
        </FigureList>
      </ExplorePanel>
  );
}

// An asset's cell in a DataTable: its ticker in bold with the full name under it (or just the
// name when there's no ticker), plus an optional third line.
function AssetCell({ ticker, name, sub }: { ticker: string | null; name: string; sub?: string }) {
  return (
    <div className="min-w-[9rem] max-w-[16rem]">
      <p className="font-bold text-slate-900 truncate">{ticker ?? name}</p>
      {ticker && <p className="text-xs text-slate-400 truncate">{name}</p>}
      {sub && <p className="text-xs text-slate-400 truncate">{sub}</p>}
    </div>
  );
}

// A signed percentage in a table cell, green or red by its sign.
function SignedPct({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-400">—</span>;
  return <span className={`font-bold ${pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatPct(pct)}</span>;
}

/**
 * FIGURE LIST — a module's figures as a grid of small tiles rather than one row each across the
 * whole module, which left the space between label and value empty and made a half-width module
 * as tall as a list. The `emphasis` figure (the headline) spans the grid, larger, on a gold tint;
 * the others take two columns, three or four as the module widens (it's its own container, so it
 * follows the module's width, not the screen's). Each tile is lean — a label, its explanation
 * behind the info icon, the value — so two still fit a half-width tile.
 */
function FigureList({ children }: { children: React.ReactNode }) {
  return <Figs className={MODULE_BODY}>{children}</Figs>;
}

// `emphasis` for the headline figure of the list, a size up. `tone` colours a value that reads
// as good or bad news (a change, say).
function FigureRow({
  label, info, value, badge, emphasis = false, tone,
}: { label: string; info: string; value: string; badge?: React.ReactNode; emphasis?: boolean; tone?: "gain" | "loss" }) {
  return <Fig label={label} info={info} value={value} badge={badge} strong={emphasis} tone={tone} />;
}

/**
 * TRADING COSTS MODULE — the Income & Costs section's trading costs: what trading has cost
 * (commissions plus spread) as the headline, how heavy that is relative to what was traded and
 * to the portfolio's return, and which platforms it went to (the section sends the top
 * TOP_ROWS). Its detail (TradingCostsExplore) is /insights/trading-costs.
 */
function TradingCostsModule({ slot, currency, portfolioUuid }: { slot: ModuleSlot<InsightsTradingCostsModule>; currency: string; portfolioUuid: string }) {
  const data = slot.module;
  const [exploring, setExploring] = useState(false);
  const canExplore = data !== null && !slot.updating && data.totalTransactions > 0;

  return (
    <Module>
      <ModuleHead
        title="Trading Costs"
        desc="Commissions plus the spread paid when buying and selling."
        onExplore={canExplore ? () => setExploring(true) : undefined}
      />
      <SlotPlaceholder slot={slot} />
      {data !== null && !slot.updating && (
        <div className={`${MODULE_BODY} space-y-4`}>
          {slot.lagging && <UpdatingNote />}
          {data.totalTransactions === 0 ? (
            <p className="text-[12.5px] text-[#a8a29e]">No trades recorded yet.</p>
          ) : (
            <Figs pairs>
                <Fig label="Fees paid" value={formatCurrency(data.totalCosts, currency, 0)} strong info="Commissions plus the spread paid on every buy and sell, since your first transaction." />
                <Fig
                  label="Cost drag"
                  value={plainPctOrDash(data.annualizedCostDragPct)}
                  strong
                  tone={data.annualizedCostDragPct !== null && data.annualizedCostDragPct > 0.5 ? "loss" : undefined}
                  info="How much costs take off the portfolio's return each year. Under 0.10% is negligible, over 0.50% is material."
                />
                <Fig
                  label="Per trade"
                  value={data.avgCostPerTrade === null ? "—" : formatCurrency(data.avgCostPerTrade, currency, 2)}
                  info="The average cost of one buy or sell."
                />
                <Fig
                  label="Of traded volume"
                  value={data.costRatioPct === null ? "—" : `${data.costRatioPct.toFixed(2)}%`}
                  info="Costs over the total amount bought and sold."
                />
              </Figs>
          )}
        </div>
      )}
      {canExplore && exploring && (
        <ExploreView title="Trading Costs" onClose={() => setExploring(false)}>
          <TradingCostsExplore portfolioUuid={portfolioUuid} revision={slot.revision} focus={null} />
        </ExploreView>
      )}
    </Module>
  );
}

const bpsOrDash = (bps: number | null) => (bps === null ? "—" : `${bps.toFixed(1)} bps`);

/**
 * TRADING COSTS EXPLORE — the detail view behind TradingCostsModule, /insights/trading-costs:
 * how the total splits into commissions and spread, how it built up over time, and where it
 * went, by platform and by asset.
 */
function TradingCostsExplore({ portfolioUuid, revision, focus }: { portfolioUuid: string; revision: number; focus: string | null }) {
  const detail = useDetail(() => portfolioService.getTradingCosts(portfolioUuid), portfolioUuid, revision);
  return <DetailBody detail={detail}>{(data) => <TradingCostsDetail data={data} focus={focus} />}</DetailBody>;
}

function TradingCostsDetail({ data, focus }: { data: TradingCostsResponse; focus: string | null }) {
  const cumulative = useMemo(() => (data.cumulativeCosts ? toChartPoints(data.cumulativeCosts) : []), [data]);
  const commissionShare = data.totalCosts > 0 ? (data.explicitFees / data.totalCosts) * 100 : 0;

  const platformColumns = useMemo((): DataColumn<TradingCostsResponse["byPlatform"][number]>[] => [
    { key: "platform", label: "Platform", sortValue: (p) => p.platform, render: (p) => <span className="font-bold text-slate-900">{p.platform}</span> },
    { key: "trades", label: "Trades", align: "right", sortValue: (p) => p.transactionCount, render: (p) => p.transactionCount },
    { key: "volume", label: "Volume", align: "right", sortValue: (p) => p.tradedVolume, render: (p) => formatCurrency(p.tradedVolume, data.currency, 0) },
    { key: "fees", label: "Commissions", align: "right", sortValue: (p) => p.explicitFees, render: (p) => formatCurrency(p.explicitFees, data.currency, 2) },
    { key: "spread", label: "Spread", align: "right", sortValue: (p) => p.implicitCosts, render: (p) => formatCurrency(p.implicitCosts, data.currency, 2) },
    { key: "total", label: "Total", align: "right", sortValue: (p) => p.totalCosts, render: (p) => <span className="font-bold text-slate-900">{formatCurrency(p.totalCosts, data.currency, 2)}</span> },
    { key: "bps", label: "Of volume", align: "right", sortValue: (p) => p.costBps, render: (p) => bpsOrDash(p.costBps) },
    { key: "share", label: "Share", align: "right", sortValue: (p) => p.shareOfTotalPct, render: (p) => plainPctOrDash(p.shareOfTotalPct) },
  ], [data.currency]);

  const assetColumns = useMemo((): DataColumn<TradingCostsResponse["byAsset"][number]>[] => [
    { key: "asset", label: "Asset", sortValue: (a) => a.ticker ?? a.name, render: (a) => <AssetCell ticker={a.ticker} name={a.name} sub={a.broker} /> },
    { key: "trades", label: "Trades", align: "right", sortValue: (a) => a.transactionCount, render: (a) => a.transactionCount },
    { key: "volume", label: "Volume", align: "right", sortValue: (a) => a.tradedVolume, render: (a) => formatCurrency(a.tradedVolume, data.currency, 0) },
    { key: "total", label: "Total", align: "right", sortValue: (a) => a.totalCosts, render: (a) => <span className="font-bold text-slate-900">{formatCurrency(a.totalCosts, data.currency, 2)}</span> },
    { key: "bps", label: "Of volume", align: "right", sortValue: (a) => a.costBps, render: (a) => bpsOrDash(a.costBps) },
  ], [data.currency]);

  return (
    <>
      <ExplorePanel eyebrow={data.currency} title="Where the Costs Come From" desc="Commissions your brokers charged, and the spread lost between buying and selling prices.">
        <div className="px-6 md:px-7 pt-5">
          <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
            <div className="h-full bg-[#C49A3C]" style={{ width: `${commissionShare}%` }} />
            <div className="h-full bg-[#E8C97A]" style={{ width: `${100 - commissionShare}%` }} />
          </div>
        </div>
        <FigureList>
          <FigureRow label="Total costs" info="Commissions plus the spread paid on every buy and sell, since your first transaction." value={formatCurrency(data.totalCosts, data.currency, 2)} emphasis />
          <FigureRow
            label="Commissions"
            info="The fees your brokers charged, as recorded on your transactions."
            value={formatCurrency(data.explicitFees, data.currency, 2)}
            badge={<span className="w-2.5 h-2.5 rounded-full bg-[#C49A3C]" />}
          />
          <FigureRow
            label="Spread"
            info={`What was lost to the gap between buying and selling prices${data.implicitCostWeightPct === null ? "" : ` — ${data.implicitCostWeightPct.toFixed(0)}% of the total`}.`}
            value={formatCurrency(data.implicitCosts, data.currency, 2)}
            badge={<span className="w-2.5 h-2.5 rounded-full bg-[#E8C97A]" />}
          />
          <FigureRow label="Traded volume" info={`The total amount bought and sold, over ${data.totalTransactions} ${data.totalTransactions === 1 ? "trade" : "trades"}.`} value={formatCurrency(data.totalVolume, data.currency, 0)} />
          <FigureRow label="Of traded volume" info="Costs over the total amount you bought and sold." value={data.costRatioBps === null ? "—" : `${bpsOrDash(data.costRatioBps)} · ${plainPctOrDash(data.costRatioPct)}`} />
          <FigureRow label="Of portfolio value" info="Costs over what the portfolio is worth today." value={plainPctOrDash(data.costToEquityPct)} />
        </FigureList>
      </ExplorePanel>
      {cumulative.length >= 2 && (
        <ExplorePanel eyebrow={data.currency} title="Costs over Time" desc="Trading costs added up since your first transaction.">
          <div className="p-6 md:p-7 h-64">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 256 }}>
              <AreaChart data={cumulative} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tickFormatter={monthShortYearLabel} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} minTickGap={40} />
                <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  labelFormatter={(label) => fullDateLabel(label as string)}
                  formatter={(value) => [formatCurrency(Number(value), data.currency, 2), "Costs to date"]}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Area type="stepAfter" dataKey="value" stroke={PORTFOLIO_COLOR} strokeWidth={2} fill={PORTFOLIO_COLOR} fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ExplorePanel>
      )}
      {data.byPlatform.length > 0 && (
        <ExplorePanel eyebrow={data.currency} title="By Platform" desc="What trading cost on each platform.">
          <DataTable columns={platformColumns} rows={data.byPlatform} rowKey={(p) => p.platform} initialSort={{ key: "total", desc: true }} highlight={focus} />
        </ExplorePanel>
      )}
      {data.byAsset.length > 0 && (
        <ExplorePanel eyebrow={data.currency} title="By Asset" desc="What trading each asset cost, on each broker.">
          <DataTable columns={assetColumns} rows={data.byAsset} rowKey={(a) => `${a.assetId}-${a.broker}`} initialSort={{ key: "total", desc: true }} />
        </ExplorePanel>
      )}
    </>
  );
}

// The aggregate's own two modules, from the Composition section.
interface AggregateSlots {
  portfolios: ModuleSlot<InsightsPortfoliosModule>;
  comovement: ModuleSlot<InsightsComovementModule>;
}

const PREPARING_AGGREGATE = "Being prepared — this shows up after the overnight analysis of your portfolios has run.";

/**
 * PORTFOLIOS MIX MODULE — the aggregate's `portfolios` module, Composition side: each
 * portfolio's share of the value as a bar, with its share of the risk as a line on the same
 * scale, then the assets held in more than one (from `comovement`, the same document). Risk
 * share next to weight is the point: a portfolio carrying more risk than its size, or one
 * offsetting the rest. Colours match the Compare page (portfolioColorMap).
 */
function PortfoliosMixModule({
  slot, comovement, currency,
}: { slot: ModuleSlot<InsightsPortfoliosModule>; comovement: InsightsComovementModule | null; currency: string }) {
  const data = slot.module;
  const { portfolios } = usePortfolio();
  const colorOf = useMemo(() => portfolioColorMap(portfolios), [portfolios]);
  const overlapping = comovement?.overlappingAssets ?? [];
  const members = data?.members ?? [];
  const top = Math.max(...members.map((m) => Math.max(m.weightPct, m.riskContributionPct ?? 0)), 1) * 1.1;

  return (
    <Module>
      <ModuleHead title="Portfolios Mix" desc="How each portfolio makes up the whole: its share of the value and of the risk." />
      <SlotPlaceholder slot={slot} preparingMessage={PREPARING_AGGREGATE} />
      {data !== null && !slot.updating && (
        <div className={`${MODULE_BODY} space-y-4`}>
          {slot.lagging && <UpdatingNote />}
          <HBars
            max={top}
            rows={members.map((m) => ({
              key: m.portfolioUuid,
              label: m.name,
              value: m.weightPct,
              mark: m.riskContributionPct,
              color: colorOf(m.portfolioUuid),
              figure: `${m.weightPct.toFixed(0)}%`,
              title: `${m.name} · ${formatCurrency(m.marketValue, currency, 0)} · ${m.riskContributionPct === null ? "risk share not available" : `${m.riskContributionPct.toFixed(1)}% of the risk`}`,
            }))}
          />
          {overlapping.length > 0 && (
            <div className="pt-1">
              <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#78716c] pb-1">Held in more than one</h3>
              <ul>
                {overlapping.slice(0, 5).map((a) => (
                  <li key={a.assetId} className="flex items-center gap-3 py-2 border-b border-[#EEE9DD] last:border-b-0 text-[13px]">
                    <span className="min-w-0 flex-1 truncate font-semibold text-[#1c1917]" title={a.name}>{a.ticker ?? a.name}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {a.holdings.map((h) => <span key={h.portfolioUuid} className="h-2 w-2 rounded-full" style={{ background: colorOf(h.portfolioUuid) }} />)}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">{formatCurrency(a.marketValue, currency, 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Module>
  );
}

/**
 * PORTFOLIO CORRELATION MODULE — the aggregate's `comovement` module, Risk side (it arrives
 * with the Composition section): how the portfolios' daily returns move together. Near 1 they
 * rise and fall together (little diversification between them), near 0 independently, below 0
 * opposite. Null under "insufficient_history".
 */
function PortfolioCorrelationModule({ slot, members }: { slot: ModuleSlot<InsightsComovementModule>; members: InsightsPortfoliosModule["members"] }) {
  const data = slot.module;
  const { portfolios } = usePortfolio();
  const nameOf = (uuid: string) => members.find((m) => m.portfolioUuid === uuid)?.name ?? portfolios.find((p) => p.uuid === uuid)?.name ?? "—";
  const corr = data?.correlation ?? null;

  return (
    <Module>
      <ModuleHead
        title="How the Portfolios Move Together"
        desc={corr ? `Correlation of daily returns, over ${corr.observations} shared trading days.` : "Correlation of their daily returns."}
      />
      <SlotPlaceholder slot={slot} preparingMessage={PREPARING_AGGREGATE} />
      {data !== null && !slot.updating && (
        <>
          {slot.lagging && <div className="px-6 pb-3"><UpdatingNote /></div>}
          {corr === null ? (
            <ModuleMessage>Needs at least 60 trading days shared by your portfolios — it will appear once there are.</ModuleMessage>
          ) : (
            <div className={`${MODULE_BODY} overflow-x-auto`}>
              <table className="border-separate border-spacing-[3px] text-[11px]">
                <thead>
                  <tr>
                    <th />
                    {corr.portfolioUuids.map((u) => (
                      <th key={u} scope="col" className="px-1.5 py-0.5 font-bold text-[#78716c] text-center max-w-24 truncate">{nameOf(u)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {corr.portfolioUuids.map((rowUuid, i) => (
                    <tr key={rowUuid}>
                      <th scope="row" className="pr-1.5 text-left font-bold text-[#78716c] max-w-28 truncate">{nameOf(rowUuid)}</th>
                      {corr.portfolioUuids.map((colUuid, j) => {
                        const v = corr.matrix[i]?.[j] ?? null;
                        return (
                          <td key={colUuid} className="p-0">
                            {i === j || v === null ? (
                              <div className="w-[52px] h-[34px] rounded-md bg-[#F7F5EF] flex items-center justify-center text-[#a8a29e]">—</div>
                            ) : (
                              <div
                                className="w-[52px] h-[34px] rounded-md flex items-center justify-center font-semibold tabular-nums"
                                style={correlationCellStyle(v)}
                                title={`${nameOf(rowUuid)} and ${nameOf(colUuid)}: ${v.toFixed(2)}`}
                              >
                                {v.toFixed(2)}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center gap-3 mt-3.5 text-[11px] text-[#78716c]">
                <span>Move opposite</span>
                {/* Same scale as the holdings' correlation matrix (correlationCellStyle). */}
                <span className="h-2 w-28 rounded-full" style={{ background: "linear-gradient(to right, rgb(244,63,94), #f8fafc, rgb(16,185,129))" }} />
                <span>Move together</span>
              </div>
            </div>
          )}
        </>
      )}
    </Module>
  );
}

/**
 * MONTH TO DATE MODULE — how the market moved the portfolio this month: its value at last
 * month's close, today's and the month-to-date market effect, and a bar per day of that day's
 * market effect. Market effect, not raw value change: a purchase isn't a gain, so money added or
 * withdrawn is kept out of the figures and only mentioned alongside the month-to-date one.
 * Deltas, not raw values: a stable portfolio's value line is visually flat at this timescale.
 * In Insights' Performance section, right under the portfolio's value: the short term, before
 * the rest of the history.
 */
function MonthToDateModule({ slot, currency, returnPct }: {
  slot: ModuleSlot<InsightsThisMonthModule>;
  currency: string;
  // The month's time-weighted return so far (the month's own document); null when there's none yet.
  returnPct: number | null;
}) {
  return (
    <Module>
      <ModuleHead
        eyebrow={currency}
        title="This month"
        desc="How the market moved your portfolio, day by day and month to date. Money you added or withdrew is left out."
      />
      {SlotPlaceholder({ slot, preparingMessage: "Not enough history yet to show this month's moves." })
        ?? (slot.module && <MonthToDateBody data={slot.module} currency={currency} lagging={slot.lagging} returnPct={returnPct} />)}
    </Module>
  );
}

// Holdings listed on each side of GainsLossesCard.
const GAINS_LOSSES_ROWS = 3;

/**
 * GAINS & LOSSES CARD — between Realized P&L and Trading Costs: how what the portfolio holds is doing, from the
 * same holdings. The unrealized P&L of the open positions (market value against what they cost),
 * then the holdings gaining and losing the most of it. Closed positions are Realized P&L's.
 */
function GainsLossesCard({ slot, currency }: { slot: ModuleSlot<InsightsHoldingsModule>; currency: string }) {
  const holdings = slot.module?.holdings ?? [];
  const gaining = holdings.filter((h) => h.unrealizedPnl > 0).sort((a, b) => b.unrealizedPnl - a.unrealizedPnl).slice(0, GAINS_LOSSES_ROWS);
  const losing = holdings.filter((h) => h.unrealizedPnl < 0).sort((a, b) => a.unrealizedPnl - b.unrealizedPnl).slice(0, GAINS_LOSSES_ROWS);

  return (
    // No title of its own: the two lists' headings say what it is.
    <Module className="pt-[22px]">
      {SlotPlaceholder({ slot, preparingMessage: PREPARING_TICK }) ?? (holdings.length === 0 ? (
        <ModuleMessage>Nothing held yet.</ModuleMessage>
      ) : (
        <div className={`${MODULE_BODY} space-y-4`}>
          <GainsLossesList title="Gaining most" holdings={gaining} currency={currency} />
          <GainsLossesList title="Losing most" holdings={losing} currency={currency} />
        </div>
      ))}
    </Module>
  );
}

function GainsLossesList({ title, holdings, currency }: { title: string; holdings: PortfolioHoldingResponse[]; currency: string }) {
  if (holdings.length === 0) return null;
  return (
    <div>
      <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#78716c] pb-1">{title}</h3>
      <ul>
        {holdings.map((h) => (
          <li key={h.assetId} className="flex items-baseline gap-3 py-2 border-b border-[#EEE9DD] last:border-b-0">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#1c1917]" title={h.name}>{h.ticker ?? h.isin ?? h.name}</span>
            <span className={`shrink-0 text-[13px] font-bold tabular-nums ${toneClass(toneOfValue(h.unrealizedPnl))}`}>
              {formatSignedCurrency(h.unrealizedPnl, currency)}
            </span>
            <span className={`shrink-0 w-14 text-right text-xs tabular-nums ${toneClass(toneOfValue(h.roiPct))}`}>
              {formatPct(h.roiPct)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STRATEGY_EVERY: Record<StrategyFrequency, string> = {
  monthly: "month",
  quarterly: "quarter",
  semiannual: "6 months",
  annual: "year",
};

const STRATEGY_REBALANCE_EVERY: Record<StrategyFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semiannual: "Every 6 months",
  annual: "Yearly",
};

/**
 * STRATEGY MODULES — on a backtest's page, the strategy it was made from (GET
 * /v1/portfolios/{p}/strategy), as three modules side by side: the target mix, the rules it played
 * and the costs set for it. The only place they can be read again once the backtest is made.
 * Returns the three tiles, for the page's grid.
 */
function StrategyModules({ portfolioUuid, currency: viewCurrency }: { portfolioUuid: string; currency: string }) {
  const detail = useDetail(() => portfoliosService.getStrategy(portfolioUuid), portfolioUuid, 0);
  const s: StrategyResponse | null = detail.data;
  // Its amounts and fixed fee are in its owner's currency.
  const currency = s?.currency ?? viewCurrency;

  const flow = (f: StrategyParams["contributions"] | StrategyParams["withdrawals"]) =>
    `${f.amountType === "percent_of_value" ? `${f.amount}% of value` : formatCurrency(f.amount, currency, 0)} / ${STRATEGY_EVERY[f.frequency]}`;
  const rebalancing = (r: StrategyParams["rebalancing"]) => {
    const band = [r.thresholdPct != null ? `±${r.thresholdPct} pts` : null, r.relativeThresholdPct != null ? `±${r.relativeThresholdPct}%` : null].filter(Boolean).join(" or ");
    return r.mode === "none" ? "Never"
      : r.mode === "calendar" ? STRATEGY_REBALANCE_EVERY[r.frequency]
        : r.mode === "threshold" ? `Past ${band}`
          : `${STRATEGY_REBALANCE_EVERY[r.frequency]} or past ${band}`;
  };
  // While it loads, or if it can't, the one module that says so.
  const body = (rows: (s: StrategyResponse) => React.ComponentProps<typeof FigRows>["rows"]) =>
    detail.loading ? <ModuleMessage>Loading the strategy…</ModuleMessage>
      : !s ? <ModuleMessage>The strategy couldn&apos;t be loaded.</ModuleMessage>
        : <div className={MODULE_BODY}><FigRows rows={rows(s)} /></div>;

  return (
    <>
      <Tile span="narrow">
        <Module>
          <ModuleHead title="Target Mix" desc="The weights the backtest aimed for, by asset class and security." />
          {body((s) => s.targets.filter((t) => t.weightPct > 0).map((t) => ({
            key: t.kind === "asset" ? `asset:${t.asset.assetId ?? t.asset.ticker}` : t.category,
            label: targetLabel(t),
            value: `${t.weightPct}%`,
            info: t.kind === "asset"
              ? [t.asset.ticker, exchangeLabel(t.asset.exchangeMic ?? null), t.asset.currency, t.asset.isin].filter(Boolean).join(" · ")
              : `Bought through ${STRATEGY_PROXIES[t.category]}.`,
          })))}
        </Module>
      </Tile>
      <Tile span="narrow">
        <Module>
          <ModuleHead title="Rules" desc="When it started, what went in and out, and when it rebalanced." />
          {body((s) => [
            {
              key: "start",
              label: "Period",
              value: simulatedPeriod(s.startedOn) ?? "Not run yet",
              info: "From the first month everything it holds has prices (at most 40 years back), up to today.",
            },
            { key: "initial", label: "Initial amount", value: formatCurrency(s.initialAmount, currency, 0) },
            { key: "add", label: "Contributions", value: s.contributions.enabled ? flow(s.contributions) : "None" },
            {
              key: "take",
              label: "Withdrawals",
              value: s.withdrawals.enabled ? flow(s.withdrawals) : "None",
              info: s.withdrawals.enabled && s.withdrawals.startAfterYears > 0 ? `From year ${s.withdrawals.startAfterYears + 1} of the run.` : undefined,
            },
            { key: "rebalance", label: "Rebalancing", value: rebalancing(s.rebalancing) },
          ])}
        </Module>
      </Tile>
      <Tile span="narrow">
        <Module>
          <ModuleHead title="Cost Settings" desc="The costs set for the backtest's trades; what they came to is under Trading Costs." />
          {body((s) => [
            { key: "commission", label: "Commission", value: `${s.costs.commissionPct}%` },
            { key: "fee", label: "Fixed fee", value: formatCurrency(s.costs.fixedFee, currency, 2) },
            { key: "spread", label: "Spread", value: `${s.costs.spreadPct}%` },
          ])}
        </Module>
      </Tile>
    </>
  );
}

/**
 * THIS MONTH CARD — the month so far, beside the Value chart near the top of a portfolio's page:
 * how the market moved the portfolio since last month's close, in percent and in money, the
 * money added or withdrawn, and the value it started from. Only the figures: the whole card opens
 * the month's own page (MonthPage, with the day-by-day chart), the same the heatmap opens.
 */
function ThisMonthCard({ slot, currency, onOpen }: {
  slot: ModuleSlot<InsightsThisMonthModule>;
  currency: string;
  onOpen: (year: number, month: number) => void;
}) {
  const data = slot.module;
  // The month of the latest daily value (the months run on UTC dates); today's before there's one.
  const latest = data?.chart.reduce<string | null>((max, s) => (max === null || s.snapshotAt > max ? s.snapshotAt : max), null);
  const at = latest ? new Date(latest) : new Date();
  const year = at.getUTCFullYear();
  const month = at.getUTCMonth() + 1;
  const monthName = at.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const open = ready(slot) ? () => onOpen(year, month) : undefined;

  return (
    <Module>
      <ModuleHead title={`${monthName} so far`} desc="How the market moved the portfolio this month, without the money you added or withdrew. Open the month for its days." onExplore={open} />
      {SlotPlaceholder({ slot, preparingMessage: "Not enough history yet to show this month." }) ?? (data && (
        <>
        {slot.lagging && <div className="px-6 pb-3"><UpdatingNote /></div>}
        <button
          type="button"
          onClick={open}
          className={`w-full ${MODULE_BODY} text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C49A3C]/40`}
        >
          <FigRows
            rows={[
              data.monthStartValue !== 0 && { key: "pct", label: "Market effect", value: formatPct(data.mtdMarketEffectPct), tone: toneOfValue(data.mtdMarketEffect) },
              { key: "money", label: data.monthStartValue !== 0 ? `Market effect, ${currency}` : "Market effect", value: formatSignedCurrency(data.mtdMarketEffect, currency), tone: toneOfValue(data.mtdMarketEffect) },
              { key: "added", label: data.mtdNetCapitalContributed < 0 ? "Money withdrawn" : "Money added", value: formatCurrency(Math.abs(data.mtdNetCapitalContributed), currency, 0) },
              { key: "start", label: "Start value", value: formatCurrency(data.monthStartValue, currency, 0) },
              {
                key: "today",
                label: "Today",
                value: data.previousDayValue !== 0 ? formatPct(data.dayMarketEffectPct) : formatSignedCurrency(data.dayMarketEffect, currency),
                tone: toneOfValue(data.dayMarketEffect),
              },
            ]}
          />
        </button>
        </>
      ))}
    </Module>
  );
}

function MonthToDateBody({ data, currency, lagging, returnPct }: { data: InsightsThisMonthModule; currency: string; lagging: boolean; returnPct: number | null }) {
  const isDayGain = data.dayMarketEffect >= 0;
  const isMtdGain = data.mtdMarketEffect >= 0;
  // A day or month with no opening value has no percentage to show (see hasPeriodBaseline).
  const points = [...data.chart]
    .sort((a, b) => new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime())
    .map((s) => ({
      date: s.snapshotAt, marketEffect: s.marketEffect, marketEffectPct: s.marketEffectPct,
      hasBaseline: s.previousValue !== 0,
    }));
  const mtdFlowsNote = data.mtdNetCapitalContributed !== 0
    ? `Value change ${formatSignedCurrency(data.deltaMtdValue, currency)}, with ${formatCurrency(Math.abs(data.mtdNetCapitalContributed), currency, 0)} ${data.mtdNetCapitalContributed > 0 ? "added" : "withdrawn"} by you`
    : undefined;

  return (
    <>
      {lagging && <div className="px-6 md:px-7 pt-6"><UpdatingNote /></div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y divide-slate-100 sm:divide-y-0 lg:divide-x">
        <StatContent
          title="Month Start Value"
          value={formatCurrency(data.monthStartValue, currency, 0)}
          icon={<Wallet className="h-4 w-4 text-blue-600" />}
          info="Market value at the close of last month."
          color="blue"
        />
        <StatContent
          title="Return"
          value={returnPct !== null ? formatPct(returnPct) : "—"}
          icon={returnPct === null || returnPct >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
          info={returnPct !== null ? "Time-weighted, month to date: unaffected by money added or withdrawn." : "Not available yet for this month."}
          color={returnPct === null ? "slate" : returnPct >= 0 ? "emerald" : "red"}
        />
        <StatContent
          title="Market Move Today"
          value={<AmountWithDelta amount={formatSignedCurrency(data.dayMarketEffect, currency)} pct={data.dayMarketEffectPct} hasBaseline={data.previousDayValue !== 0} />}
          icon={isDayGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
          info="How much prices moved the portfolio since the previous day, excluding buys, sells, costs and dividends."
          color={isDayGain ? "emerald" : "red"}
        />
        <StatContent
          title="Market Move This Month"
          value={<AmountWithDelta amount={formatSignedCurrency(data.mtdMarketEffect, currency)} pct={data.mtdMarketEffectPct} hasBaseline={data.monthStartValue !== 0} />}
          icon={isMtdGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
          info={`How much prices moved the portfolio since the close of last month, excluding buys, sells, costs and dividends.${mtdFlowsNote ? ` ${mtdFlowsNote}.` : ""}`}
          color={isMtdGain ? "emerald" : "red"}
        />
      </div>
      {points.length === 0 ? (
        <p className="text-sm text-slate-400 p-6 md:p-7 border-t border-slate-100">Not enough history yet to chart.</p>
      ) : (
        <div className="p-6 md:p-7 h-64 border-t border-slate-100">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 256 }}>
            <BarChart data={points} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tickFormatter={chartDateLabel}
                tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
                axisLine={false}
                tickLine={false}
                minTickGap={30}
              />
              <YAxis
                tickFormatter={formatCompact}
                tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                width={56}
              />
              <Tooltip
                labelFormatter={(label) => fullDateLabel(label as string)}
                formatter={(value, name, props) => [
                  `${formatCurrency(Number(value), currency, 0)}${props.payload.hasBaseline ? ` (${formatPct(props.payload.marketEffectPct)})` : ""}`,
                  "Market move",
                ]}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="marketEffect" radius={[4, 4, 4, 4]}>
                {points.map((d) => (
                  <Cell key={d.date} fill={d.marketEffect >= 0 ? "#10b981" : "#f43f5e"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

/**
 * MONTH PAGE — a month opened from the returns heatmap, in place of the whole page; the month in
 * progress opens on how the market moved it day by day (MonthToDateModule) instead (the way back
 * is the browser's back button): /insights/monthly/{YYYY-MM}, fetched by PerformanceSection so
 * its report link can sit at the top of the page. Its figures come from the same stored values as the
 * Performance section's history, so they're hidden while that's being rebuilt.
 */
function MonthPage({
  month, historyUpdating, thisMonth, currency,
}: {
  month: { data: PeriodDashboard | null; error: unknown; loading: boolean };
  historyUpdating: boolean;
  // How the market moved the portfolio day by day, for the month in progress.
  thisMonth: ModuleSlot<InsightsThisMonthModule>;
  currency: string;
}) {
  if (month.loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" />
      </div>
    );
  }
  if (month.data === null) {
    return month.error instanceof ApiError && month.error.status === 404 ? (
      <EmptyPeriodState message="No detail available for this month." />
    ) : (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-sm font-bold">Failed to load that month&apos;s detail</p>
      </div>
    );
  }
  if (historyUpdating && month.data.isStale) return <Module><StaleUpdatingState /></Module>;
  return (
    <div className="space-y-6">
      {month.data.isStale && <UpdatingNote />}
      {/* The month in progress opens on This Month, which says what its summary would, plus its
          return; a closed month on its own summary. */}
      {month.data.inProgress && <MonthToDateModule slot={thisMonth} currency={currency} returnPct={month.data.timeWeightedReturnPct} />}
      <MonthDetail period={month.data} withSummary={!month.data.inProgress} />
    </div>
  );
}

/**
 * HISTORY PAGE — the Insights page itself (see PerformanceSection above): one module per
 * question, each opening a detail view with everything else about it. Holdings (what it holds),
 * Profit & Loss (what selling locked in, and what the holdings paid, the latter not opening
 * anything of its own), Costs (what trading cost), Performance (the value over time: returns,
 * the monthly returns and the benchmark behind it), Risk (the volatility: its turbulent periods
 * and drawdowns) and the Risk Model (the efficient frontier: the mixes, the weight gaps and the
 * correlations behind it). A month opens from Performance's detail (see PerformanceSection).
 */
function HistoryPage({
  insights, performance, value, portfolioUuid, onSelectMonth, isAggregate, onOpenPortfolio, comparison, backtest, strategyShown,
}: {
  insights: Insights;
  // The Performance section, already loaded, and its value (PerformanceSection checks both).
  performance: InsightsPerformanceResponse;
  value: InsightsValueModule;
  portfolioUuid: string;
  onSelectMonth: (year: number, month: number) => void;
  // "All portfolios": Holdings and Risk then also show how the portfolios make it up.
  isAggregate: boolean;
  // Opens one of the aggregate's portfolios (from the Composition).
  onOpenPortfolio?: (uuid: string) => void;
  comparison: PortfolioComparisonEntry | null;
  // A strategy's backtest: a simulation, so only what it says about the strategy — its returns
  // against the benchmark, its mix, what trading cost it at the costs set for it, its risk. Its
  // gains, its month in progress, what it realized or was paid are simulated bookkeeping, left out.
  backtest: boolean;
  strategyShown: boolean;
}) {
  const { composition, incomeCosts, risk, timedOut } = insights;
  const currency = performance.currency;
  const own = <S, M extends { isStale: boolean }>(section: SectionState<S>, pick: (data: S) => M | null) =>
    slotOf(section, timedOut, pick, ownStale);

  if (isHistoryEmpty(value)) {
    return (
      <div className="space-y-6">
        <EmptyPeriodState message="Add or upload transactions to build your full portfolio history." />
      </div>
    );
  }

  // The value, this month and the monthly returns come from the stored daily and month-end
  // values, so one historyIsStale covers them: hidden behind a StaleUpdatingState while it's
  // being rebuilt, with a hint once useInsights stops waiting.
  const historyUpdating = performance.historyIsStale && !timedOut;
  const aggregate = isAggregate
    ? { portfolios: own(composition, (d) => d.portfolios), comovement: own(composition, (d) => d.comovement) }
    : null;

  const performanceDetail = (
    <PerformanceDetail
      heatmap={performance.heatmap?.entries ?? []}
      historyUpdating={historyUpdating}
      currency={currency}
      portfolioUuid={portfolioUuid}
      revision={insights.performance.revision}
      onSelectMonth={onSelectMonth}
    />
  );

  const compositionModule = (
    <HoldingsExplorer
      slot={own(composition, (d) => d.holdings)}
      sector={composition.data?.sectorExposure ?? null}
      region={composition.data?.regionExposure ?? null}
      aggregate={aggregate}
      currency={currency}
      portfolioUuid={portfolioUuid}
      onOpenPortfolio={onOpenPortfolio}
    />
  );
  const valueModule = historyUpdating ? <Module><StaleUpdatingState /></Module> : (
    <ValueModule value={value} currency={currency} comparison={comparison}>{performanceDetail}</ValueModule>
  );
  const volatilityModule = (
    <VolatilityModule
      slot={own(risk, (d) => d.volatility)}
      portfolioUuid={portfolioUuid}
      returnsRevision={insights.performance.revision}
      aggregate={aggregate}
      maxDrawdownPct={comparison?.performance?.maxDrawdownPct ?? null}
    />
  );
  const updatingNote = !historyUpdating && performance.historyIsStale && <Tile><UpdatingNote /></Tile>;
  const riskModel = <Tile id={moduleAnchor("risk")}><RiskModelModule slot={own(risk, (d) => d.frontier)} portfolioUuid={portfolioUuid} /></Tile>;

  const tradingCosts = <TradingCostsModule slot={own(incomeCosts, (d) => d.tradingCosts)} currency={currency} portfolioUuid={portfolioUuid} />;

  // A backtest leads with the strategy itself (what it was set to do, which nothing else on the
  // page says), then how it did, then its mix beside what trading cost it (the costs the
  // user set for it, totted up over the run), then its risk.
  if (backtest) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-12 gap-[22px]">
        {updatingNote}
        {!strategyShown && <StrategyModules portfolioUuid={portfolioUuid} currency={currency} />}
        <Tile id={moduleAnchor("value")}>{valueModule}</Tile>
        <Tile span="wide" id={moduleAnchor("composition")}>{compositionModule}</Tile>
        <Tile span="narrow" id={moduleAnchor("costs")}>{tradingCosts}</Tile>
        <Tile id={moduleAnchor("volatility")}>{volatilityModule}</Tile>
        {riskModel}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-12 gap-[22px]">
      {updatingNote}
      <Tile id={moduleAnchor("value")}>{valueModule}</Tile>
      <Tile span="wide" id={moduleAnchor("composition")}>{compositionModule}</Tile>
      <Tile span="narrow">
        {historyUpdating ? <Module><StaleUpdatingState /></Module> : (
          <ThisMonthCard slot={slotOf(insights.performance, timedOut, (d) => d.thisMonth, (_, d) => d.historyIsStale)} currency={currency} onOpen={onSelectMonth} />
        )}
      </Tile>
      {aggregate && (
        <>
          <Tile span="half"><PortfoliosMixModule slot={aggregate.portfolios} comovement={aggregate.comovement.module} currency={currency} /></Tile>
          <Tile span="half"><PortfolioCorrelationModule slot={aggregate.comovement} members={aggregate.portfolios.module?.members ?? []} /></Tile>
        </>
      )}
      {/* What was made, sold (realized, dividends) and still held (gains & losses), beside what
          trading cost; then the risk. */}
      <Tile span="narrow" id={moduleAnchor("realized")}>
        <RealizedPnlModule
          slot={own(incomeCosts, (d) => d.realizedPnl)}
          currency={currency}
          portfolioUuid={portfolioUuid}
        />
      </Tile>
      <Tile span="narrow">
        <GainsLossesCard slot={own(composition, (d) => d.holdings)} currency={currency} />
      </Tile>
      <Tile span="narrow" id={moduleAnchor("costs")}>{tradingCosts}</Tile>
      <Tile id={moduleAnchor("volatility")}>{volatilityModule}</Tile>
      {riskModel}
    </div>
  );
}

/**
 * PERFORMANCE MODULE — the portfolio's value over time, next to its returns: since inception
 * (time-weighted), over the last 12 months and against its benchmark, from the comparison the
 * header loads, and its value today. Opens the returns, the months and the benchmark.
 */
function ValueModule({ value, currency, comparison, children }: {
  value: InsightsValueModule;
  currency: string;
  comparison: PortfolioComparisonEntry | null;
  children: React.ReactNode;
}) {
  const [exploring, setExploring] = useState(false);
  const inception = comparison?.performance?.totalReturnPct ?? null;
  const year = comparison?.performance?.horizons.find((h) => h.period === "1 Year")?.totalReturnPct ?? null;
  const annualized = comparison?.performance?.annualizedReturnPct ?? null;
  return (
    <Module>
      <ModuleHead
        title="Performance"
        desc="Market value at each month end since inception, and today. Open it for the returns, the months and the benchmark."
        onExplore={() => setExploring(true)}
      />
      <div className={`${MODULE_BODY} grid grid-cols-1 @2xl:grid-cols-[auto_minmax(0,1fr)] gap-[22px] @2xl:gap-8 items-center`}>
        {/* One column beside the chart on a wide card, side by side above it on a narrow one. */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] @2xl:grid-cols-1 gap-x-5 gap-y-5 @2xl:min-w-[150px]">
          {inception !== null && (
            <Fig
              label="TWR since inception"
              value={formatPct(inception)}
              tone={toneOfValue(inception)}
              strong
              info="Time-weighted return: how much one euro invested on the first day would have grown, compounding each period's return. Money you added or withdrew doesn't change it, and sales and dividends are included, so it measures the strategy, not the size of your deposits. That's the figure to compare with a benchmark."
            />
          )}
          {year !== null && <Fig label="Last 12 months" value={formatPct(year)} tone={toneOfValue(year)} strong />}
          {annualized !== null && (
            <Fig
              label="Per year"
              value={formatPct(annualized)}
              tone={toneOfValue(annualized)}
              strong
              info="Annualized time-weighted return: the steady yearly rate that would have compounded into the return since inception."
            />
          )}
        </div>
        <SnapshotChart chart={value.chart} currency={currency} className="h-[240px]" />
      </div>
      {exploring && (
        <ExploreView title="Performance" onClose={() => setExploring(false)}>
          {children}
        </ExploreView>
      )}
    </Module>
  );
}

/**
 * PERFORMANCE DETAIL — everything behind the value: the time-weighted returns
 * (/insights/returns), the monthly returns (a month opens one level further down, the month in
 * progress with how the market moved it day by day) and the benchmark comparison
 * (/insights/benchmark).
 */
function PerformanceDetail({
  heatmap, historyUpdating, currency, portfolioUuid, revision, onSelectMonth,
}: {
  heatmap: MonthlyMarketEffectEntry[];
  historyUpdating: boolean;
  currency: string;
  portfolioUuid: string;
  revision: number;
  onSelectMonth: (year: number, month: number) => void;
}) {
  return (
    <>
      <ReturnsExplore portfolioUuid={portfolioUuid} revision={revision} />
      <Module>
        <ModuleHead
          eyebrow={currency}
          title="Monthly Returns"
          desc="Time-weighted return by month, since inception. Click a month for its full detail."
        />
        {historyUpdating ? <StaleUpdatingState /> : <MonthlyReturnsHeatmap entries={heatmap} onSelectMonth={onSelectMonth} />}
      </Module>
      <BenchmarkExplore portfolioUuid={portfolioUuid} revision={revision} />
    </>
  );
}
