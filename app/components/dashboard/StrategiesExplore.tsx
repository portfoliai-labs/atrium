// components/dashboard/StrategiesExplore.tsx
"use client";

import { Fragment, useEffect, useState } from "react";
import { AlertCircle, ArrowUpRight, ChevronLeft, ChevronRight, Info, Loader2, Telescope } from "lucide-react";
import { publicationService } from "../../services/publicationService";
import { useInvestmentsQuery, useInvestmentsRead } from "../../context/PortfolioContext";
import { ApiError } from "../../services/apiClient";
import { STRATEGY_PROXIES, simulatedPeriod, targetLabel, type StrategyCosts, type StrategyParams, type StrategyResponse, type StrategyTarget } from "../../models/Strategy";
import { portfoliosService } from "../../services/portfoliosService";
import {
  CRISIS_LABELS, FILTER_HORIZONS, HORIZON_LABELS, SORT_LABELS, isFigureSort,
  type CatalogSort, type FilterHorizon, type HorizonFigures, type PublishedStrategy,
} from "../../models/PublishedStrategy";
import { exchangeLabel } from "../../models/Listing";
import { formatCurrency } from "../../lib/format";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { describeRebalancing } from "./BacktestMarks";
import { ReadOnlySimulation } from "./ReadOnlySimulation";
import type { CompareStrategy } from "./ComparisonView";
import { CATEGORY_COLORS, SECURITY_COLORS } from "./StrategyBuilder";
import { ProfileSummary } from "./StrategyProfile";

const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;
const dateLabel = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

const PAGE_SIZE = 12;
// How long the figure filters wait for typing to stop before asking again.
const FILTER_DELAY_MS = 400;

const signedPct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
const plainPct = (v: number) => `${v.toFixed(1)}%`;
const fig = (v: number | null, format: (v: number) => string) => (v == null ? "—" : format(v));

/** The author's trading costs, in a line: shown next to the figures, which are net of them. */
const costsLine = (c: StrategyCosts, currency: string) =>
  `${c.commissionPct}% commission · ${formatCurrency(c.fixedFee, currency, 2)} fixed fee per trade · ${c.spreadPct}% spread`;

const byline = (s: PublishedStrategy) => `By ${s.authorName ?? "an advisor"} · published ${dateLabel(s.publishedAt)}`;

// ── The disclaimer ────────────────────────────────────────────────────────────────────────

/** What every figure in the catalog is, and isn't: on Strategies and on each strategy's page. */
function SimulationDisclaimer() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-dashed border-sky-300 bg-sky-50/70 px-4 py-3.5">
      <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
        <Info className="h-4 w-4" />
      </span>
      <p className="text-xs text-sky-900/80 leading-relaxed">
        <span className="block text-[13px] font-black text-sky-950">Every figure here is simulated</span>
        Each strategy is played on historical prices: none of it is a real result. The figures are net of trading costs
        (the author&apos;s, shown next to them, are taken out) and aren&apos;t moved by money added or withdrawn. This is for
        educational and informational purposes only and isn&apos;t investment advice or a recommendation. Past and simulated
        performance doesn&apos;t predict future results.
      </p>
    </div>
  );
}

function SimulatedBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-[10px] font-black uppercase tracking-wider text-sky-800">
      Simulated, net of trading costs
    </span>
  );
}

// ── The allocation ────────────────────────────────────────────────────────────────────────

const targetKey = (t: StrategyTarget) => (t.kind === "asset" ? `asset:${t.asset.assetId ?? t.asset.ticker}` : t.category);

/** Each held target with its colour: an asset class's own, the securities' in their order. */
function allocationOf(targets: StrategyTarget[]) {
  let security = 0;
  return targets.filter((t) => t.weightPct > 0).map((t) => ({
    key: targetKey(t),
    label: t.kind === "asset" ? t.asset.ticker : targetLabel(t),
    pct: t.weightPct,
    color: t.kind === "category" ? CATEGORY_COLORS[t.category] : SECURITY_COLORS[security++ % SECURITY_COLORS.length],
  }));
}

function AllocationBar({ targets }: { targets: StrategyTarget[] }) {
  const slices = allocationOf(targets);
  return (
    <span className="flex flex-col gap-1.5">
      <span className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
        {slices.map((s) => <span key={s.key} style={{ width: `${Math.min(s.pct, 100)}%`, background: s.color }} />)}
      </span>
      <span className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] font-bold text-slate-500 tabular-nums">
        {slices.map((s) => (
          <span key={s.key} className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
            {s.label} {s.pct}%
          </span>
        ))}
      </span>
    </span>
  );
}

// ── The figures ───────────────────────────────────────────────────────────────────────────

/**
 * One horizon's figures, return always next to its volatility and drawdown: the selected
 * horizon's, or without one the longest computed (never `inception` here, a detail page's only).
 */
function cardFigures(s: PublishedStrategy, horizon: FilterHorizon | null): HorizonFigures | null {
  if (horizon) return s.horizons.find((h) => h.horizon === horizon) ?? null;
  for (const h of [...FILTER_HORIZONS].reverse()) {
    const found = s.horizons.find((x) => x.horizon === h);
    if (found) return found;
  }
  return null;
}

// ── The catalog: the list ─────────────────────────────────────────────────────────────────

interface Filters {
  horizon: FilterHorizon | null;
  maxVolatilityPct: string;
  maxDrawdownPct: string;
  sort: CatalogSort;
}

const NO_FILTERS: Filters = { horizon: null, maxVolatilityPct: "", maxDrawdownPct: "", sort: "newest" };

const positive = (v: string) => {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : undefined;
};

/**
 * STRATEGIES CATALOG — Strategies' list (see StrategiesSection): the user's own strategies (`own`,
 * their backtests, as cards made by the page) and the catalog (GET /v1/explore/strategies),
 * strategy portfolios advisors published, for every user to read, in one grid. "All" lists the
 * user's first, then the published ones (an advisor's own published ones are theirs, not listed
 * again: `ownUuids`); "Yours" only theirs (`emptyOwn` when there are none).
 * The published ones are newest first by default, with no horizon; picking a
 * horizon (1, 3, 5 or 10 years) shows each strategy's figures over it and lets the user filter by
 * volatility and drawdown and sort by a figure, which the backend only does on a horizon, so the
 * filters stay off without one. Every figure is a simulation, net of its author's costs (shown next
 * to them), labelled so,
 * under a disclaimer; nothing here is matched to the viewer, and nothing can be copied or adopted.
 * A strategy opens its page (PublishedStrategyPage).
 */
export function StrategiesCatalog({ own, ownUuids, emptyOwn, onOpen }: {
  own: { key: string; card: React.ReactNode }[];
  ownUuids: string[];
  emptyOwn: React.ReactNode;
  onOpen: (publicationId: string) => void;
}) {
  const [show, setShow] = useState<"all" | "own">("all");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  // The figure filters as last sent: they follow the inputs once typing stops.
  const [applied, setApplied] = useState({ maxVolatilityPct: "", maxDrawdownPct: "" });
  const [page, setPage] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => {
      setApplied({ maxVolatilityPct: filters.maxVolatilityPct, maxDrawdownPct: filters.maxDrawdownPct });
      setPage(0);
    }, FILTER_DELAY_MS);
    return () => clearTimeout(id);
  }, [filters.maxVolatilityPct, filters.maxDrawdownPct]);

  // Without a horizon the backend takes no filter and no figure sort (422): none is sent.
  const query = filters.horizon
    ? {
        horizon: filters.horizon,
        maxVolatilityPct: positive(applied.maxVolatilityPct),
        maxDrawdownPct: positive(applied.maxDrawdownPct),
        sort: filters.sort,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }
    : { limit: PAGE_SIZE, offset: page * PAGE_SIZE };

  // While the next page loads, the last one stays, dimmed.
  const read = useInvestmentsQuery(["publications", "catalog", query], () => publicationService.list(query), { keepPrevious: true });
  const loading = read.isPending || read.isPlaceholderData;
  const error = !loading && read.isError ? (read.error instanceof Error ? read.error.message : "Unable to load the strategies.") : null;
  const shown = read.data ?? null;

  const setHorizon = (horizon: FilterHorizon | null) => {
    // Back to no horizon: nothing it needed stays set.
    setFilters((f) => (horizon ? { ...f, horizon } : NO_FILTERS));
    if (!horizon) setApplied({ maxVolatilityPct: "", maxDrawdownPct: "" });
    setPage(0);
  };

  const total = shown?.total ?? 0;
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  const published = (shown?.strategies ?? []).filter((x) => !ownUuids.includes(x.portfolioUuid));
  // The user's own lead the first page of All.
  const leading = show === "own" || page === 0 ? own : [];
  const ownCard = (o: (typeof own)[number]) => <Fragment key={o.key}>{o.card}</Fragment>;
  const cards = show === "own" ? own.map(ownCard) : [
    ...leading.map(ownCard),
    ...published.map((x) => <StrategyCard key={x.publicationId} strategy={x} horizon={filters.horizon} onOpen={() => onOpen(x.publicationId)} />),
  ];

  return (
    <div className="space-y-6">
      <SimulationDisclaimer />

      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6 space-y-4">
        <div>
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Show</span>
          <div className="flex flex-wrap gap-2">
            {([["all", "All strategies"], ["own", `Yours · ${own.length}`]] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setShow(id)}
                aria-pressed={show === id}
                className={`min-h-9 px-3.5 rounded-full text-[13px] font-bold transition-colors ${
                  show === id ? "bg-[#1c1917] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {show === "all" && (
          <>
            <div>
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Figures over</span>
              <div className="flex flex-wrap gap-2">
                {[null, ...FILTER_HORIZONS].map((h) => (
                  <button
                    key={h ?? "any"}
                    type="button"
                    onClick={() => setHorizon(h)}
                    aria-pressed={filters.horizon === h}
                    className={`min-h-9 px-3.5 rounded-full text-[13px] font-bold transition-colors ${
                      filters.horizon === h ? "bg-[#1c1917] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {h ? `Last ${HORIZON_LABELS[h]}` : "Any period"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FilterField
                label="Volatility at most"
                suffix="%"
                value={filters.maxVolatilityPct}
                disabled={!filters.horizon}
                onChange={(v) => setFilters((f) => ({ ...f, maxVolatilityPct: v }))}
              />
              <FilterField
                label="Worst drop no deeper than"
                suffix="−%"
                value={filters.maxDrawdownPct}
                disabled={!filters.horizon}
                onChange={(v) => setFilters((f) => ({ ...f, maxDrawdownPct: v }))}
              />
              <label className="block">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sort by</span>
                <select
                  value={filters.horizon ? filters.sort : "newest"}
                  onChange={(e) => { setFilters((f) => ({ ...f, sort: e.target.value as CatalogSort })); setPage(0); }}
                  className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold outline-none focus:border-[#C49A3C]/60"
                >
                  {(Object.keys(SORT_LABELS) as CatalogSort[]).map((x) => (
                    <option key={x} value={x} disabled={isFigureSort(x) && !filters.horizon}>{SORT_LABELS[x]}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              {filters.horizon
                ? own.length > 0 ? "The figures filter and sort the published strategies; yours stay first." : null
                : "Pick a period to filter or sort by the figures: they're compared over the same years."}
            </p>
          </>
        )}
      </section>

      {show === "all" && error && (
        <p className="flex items-center gap-2 text-sm font-semibold text-rose-600"><AlertCircle className="h-4 w-4" /> {error}</p>
      )}
      {show === "own" && own.length === 0 ? (
        emptyOwn
      ) : show === "all" && !shown && !error ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" /></div>
      ) : cards.length === 0 ? (
        error ? null : (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 py-10 flex flex-col items-center text-center gap-2">
            <Telescope className="h-6 w-6 text-slate-400" />
            <p className="text-sm font-black text-slate-900">
              {filters.horizon ? "No strategy matches these filters" : "No strategies yet"}
            </p>
            {filters.horizon && (
              <p className="text-xs text-slate-500 max-w-md">
                Only strategies whose history covers the whole period are listed. Try a shorter period or looser limits.
              </p>
            )}
          </div>
        )
      ) : (
        <>
          <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 transition-opacity ${show === "all" && loading ? "opacity-60" : ""}`}>
            {cards}
          </div>
          {show === "all" && total > PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-500 tabular-nums">Published: {from}–{to} of {total}</span>
              <span className="flex items-center gap-2">
                <PageButton label="Previous page" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </PageButton>
                <PageButton label="Next page" disabled={to >= total || loading} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </PageButton>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * A strategy of the catalog as a card, the whole of it opening its page (as a module of a
 * portfolio's Insights opens its detail, the arrow in its corner turning gold as it's hovered):
 * its name and author, what it's for, one horizon's figures with the annualized return first, what
 * it holds (its targets, then its profile: category, region, index factors), and the author's
 * costs the figures are net of.
 */
function StrategyCard({ strategy: s, horizon, onOpen }: { strategy: PublishedStrategy; horizon: FilterHorizon | null; onOpen: () => void }) {
  const figures = cardFigures(s, horizon);
  const r = figures?.annualizedReturnPct ?? null;
  return (
    <article
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      aria-label={`Open ${s.portfolioName}`}
      className="group/card relative h-full bg-white rounded-[1.75rem] border border-[#EEE9DD] p-6 flex flex-col gap-5 cursor-pointer transition-colors hover:border-[#C49A3C]/60 hover:bg-[#FBFAF6] outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40"
    >
      <span aria-hidden className="absolute top-5 right-5 h-6 w-6 rounded-full flex items-center justify-center text-[#857e78] transition-colors group-hover/card:text-[#C49A3C]">
        <ArrowUpRight className="h-4 w-4" />
      </span>

      <div className="min-w-0 pr-8">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">
          Simulated{figures ? ` · last ${HORIZON_LABELS[figures.horizon]}` : ""}
        </p>
        <h3 className="mt-1.5 text-xl font-bold text-[#1c1917] leading-tight line-clamp-2" style={serif}>{s.portfolioName}</h3>
        <p className="text-[11px] text-[#78716c] mt-1">{byline(s)}</p>
        {s.description && <p className="text-[12.5px] text-[#57534e] leading-relaxed mt-3 line-clamp-2">{s.description}</p>}
      </div>

      {figures ? (
        <div className="space-y-3">
          <p className="flex items-baseline gap-2">
            <span className={`text-[30px] font-bold leading-none tabular-nums ${r == null ? "text-[#1c1917]" : r >= 0 ? "text-[#047857]" : "text-[#e11d48]"}`} style={serif}>
              {fig(r, signedPct)}
            </span>
            <span className="text-[11px] text-[#78716c]">a year</span>
          </p>
          <dl className="grid grid-cols-3 gap-3 border-t border-[#EEE9DD] pt-3">
            {[
              { label: "Volatility", value: fig(figures.volatilityPct, plainPct) },
              { label: "Worst drop", value: fig(figures.maxDrawdownPct, signedPct) },
              { label: "Return / risk", value: fig(figures.returnPerRisk, (v) => v.toFixed(2)) },
            ].map((i) => (
              <div key={i.label} className="min-w-0">
                <dt className="text-[10.5px] text-[#78716c] truncate">{i.label}</dt>
                <dd className="text-[14px] font-bold tabular-nums text-[#1c1917]">{i.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="text-xs text-[#78716c]">{s.figuresComputedAt ? "Its history is shorter than a year." : "Its figures are being computed."}</p>
      )}

      <div className="mt-auto space-y-3">
        <AllocationBar targets={s.strategy.targets} />
        <ProfileSummary profile={s.profile} />
        <p className="text-[10px] text-[#857e78] leading-snug">Net of the author&apos;s costs: {costsLine(s.costs, s.currency)}</p>
      </div>
    </article>
  );
}

function FilterField({ label, suffix, value, disabled, onChange }: { label: string; suffix: string; value: string; disabled: boolean; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</span>
      <span className="relative block">
        <input
          type="number"
          min={0}
          step={1}
          value={value}
          disabled={disabled}
          placeholder="Any"
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-11 px-3.5 pr-12 rounded-xl bg-white border border-slate-200 text-sm font-semibold tabular-nums text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#C49A3C]/60 disabled:bg-slate-50 disabled:cursor-not-allowed"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">{suffix}</span>
      </span>
    </label>
  );
}

function PageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => { onClick(); window.scrollTo({ top: 0 }); }}
      className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

// ── A strategy's page ─────────────────────────────────────────────────────────────────────

const HORIZON_ORDER = [...FILTER_HORIZONS, "inception"] as const;

/**
 * PUBLISHED STRATEGY PAGE — one strategy of the catalog (GET /v1/explore/strategies/{id}): what it holds,
 * how it rebalances, its author's costs (in their currency, the figures net of them), the period
 * it's simulated over, every horizon's figures (the whole history's too; total return as on the
 * Insights, annualized as in the list) and how it went through the past crises its history covers, then its
 * portfolio's Insights (ReadOnlySimulation), all simulated. Read only: no way to copy or adopt it.
 */
export function PublishedStrategyPage({ publicationId, trail, onCompare, onNavigate }: {
  publicationId: string;
  trail: Crumb[];
  onCompare?: (strategies: CompareStrategy[]) => void;
  onNavigate?: (section: string) => void;
}) {
  const read = useInvestmentsQuery(["publications", publicationId], () => publicationService.get(publicationId));
  const error = !read.isError ? null
    : read.error instanceof ApiError && read.error.status === 404 ? "This strategy isn't in the catalog any more: its author withdrew it."
    : read.error instanceof Error ? read.error.message : "Unable to load this strategy.";

  // What the catalog leaves out of a strategy, from its backtest (GET /v1/portfolios/{p}/strategy,
  // readable while it's published): the amount it started with, and the money it added or took.
  // undefined while loading, null when it couldn't be read.
  const portfolioUuid = read.data?.portfolioUuid ?? null;
  const flows = useInvestmentsRead<StrategyResponse>(
    ["strategy", portfolioUuid], () => portfoliosService.getStrategy(portfolioUuid!), portfolioUuid !== null,
  );

  if (!read.data) {
    return (
      <div className="space-y-6 pb-12">
        <Breadcrumb trail={trail} current="Published strategy" />
        {error
          ? <p className="flex items-center gap-2 text-sm font-semibold text-rose-600"><AlertCircle className="h-4 w-4" /> {error}</p>
          : <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" /></div>}
      </div>
    );
  }

  const s = read.data;
  const horizons = HORIZON_ORDER.flatMap((h) => s.horizons.filter((x) => x.horizon === h));
  const period = simulatedPeriod(s.startedOn);

  return (
    <ReadOnlySimulation
      portfolioUuid={s.portfolioUuid}
      trail={trail}
      eyebrow="Published strategy"
      title={s.portfolioName}
      banner={false}
      strategyShown
      notice={<SimulationDisclaimer />}
      onNavigate={onNavigate}
      extraActions={onCompare ? [{ label: "Compare", onClick: () => onCompare([{ uuid: s.portfolioUuid, name: s.portfolioName }]) }] : []}
    >
      <div className="space-y-6">
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-7 space-y-3">
          <p className="text-[11px] font-semibold text-slate-400">{byline(s)}</p>
          {s.description && <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-line">{s.description}</p>}
          <div className="max-w-xl"><AllocationBar targets={s.strategy.targets} /></div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <DetailPanel
            title="Allocation"
            note={s.profile ? `Now: as of ${dateLabel(s.profile.computedAt)}. Region, sector and factors are in Composition below.` : "Region, sector and factors are in Composition below."}
          >
            <AllocationRows strategy={s} />
          </DetailPanel>
          <DetailPanel title="Rules">
            <DetailRows rows={[
              { label: "Period", value: period ?? "Not simulated yet" },
              { label: "Initial amount", value: flows ? formatCurrency(flows.initialAmount, flows.currency ?? s.currency, 0) : flows === null ? "—" : "…" },
              { label: "Contributions", value: flows ? describeFlow(flows.contributions, flows.currency ?? s.currency) : flows === null ? "—" : "…" },
              { label: "Withdrawals", value: flows ? describeFlow(flows.withdrawals, flows.currency ?? s.currency) : flows === null ? "—" : "…" },
              { label: "Rebalancing", value: describeRebalancing(s.strategy.rebalancing) },
            ]} />
          </DetailPanel>
          <DetailPanel title="Author's costs" note="The figures are net of these: each trade's costs come off its day's return.">
            <DetailRows rows={[
              { label: "Commission", value: `${s.costs.commissionPct}% per trade` },
              { label: "Fixed fee", value: `${formatCurrency(s.costs.fixedFee, s.currency, 2)} per trade` },
              { label: "Bid-ask spread", value: `${s.costs.spreadPct}%` },
            ]} />
          </DetailPanel>
        </div>

        <DetailPanel title="Figures by period" badge={<SimulatedBadge />} note={s.figuresComputedAt ? `Computed ${dateLabel(s.figuresComputedAt)}.` : undefined}>
          {horizons.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">Its figures are being computed.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[13px] tabular-nums">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                    <th className="text-left font-black py-2 px-1">Period</th>
                    <th className="font-black py-2 px-1">Total return</th>
                    <th className="font-black py-2 px-1">Annualized return</th>
                    <th className="font-black py-2 px-1">Volatility</th>
                    <th className="font-black py-2 px-1">Max drawdown</th>
                    <th className="font-black py-2 px-1">Return / risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {horizons.map((h) => (
                    <tr key={h.horizon} className="text-right">
                      <td className="text-left font-bold text-slate-900 py-2.5 px-1 whitespace-nowrap">
                        {h.horizon === "inception" ? HORIZON_LABELS.inception : `Last ${HORIZON_LABELS[h.horizon]}`}
                      </td>
                      <td className="py-2.5 px-1 font-bold text-slate-900">{fig(h.totalReturnPct, signedPct)}</td>
                      <td className="py-2.5 px-1 font-bold text-slate-900">{fig(h.annualizedReturnPct, signedPct)}</td>
                      <td className="py-2.5 px-1 text-slate-700">{fig(h.volatilityPct, plainPct)}</td>
                      <td className="py-2.5 px-1 text-slate-700">{fig(h.maxDrawdownPct, signedPct)}</td>
                      <td className="py-2.5 px-1 text-slate-700">{fig(h.returnPerRisk, (v) => v.toFixed(2))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DetailPanel>

        <DetailPanel title="Through past crises" badge={<SimulatedBadge />} note="How the simulation went from each crisis's start to its end.">
          {s.crises.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">Its history covers none of the crises tracked.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {s.crises.map((c) => (
                <li key={c.crisis} className="py-2.5 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-5">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-slate-900">{CRISIS_LABELS[c.crisis]}</span>
                    <span className="block text-[11px] text-slate-500">{dateLabel(c.start)} – {dateLabel(c.end)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Return</span>
                    <span className="block text-[13px] font-black tabular-nums text-slate-900">{fig(c.returnPct, signedPct)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Max drawdown</span>
                    <span className="block text-[13px] font-black tabular-nums text-slate-900">{fig(c.maxDrawdownPct, signedPct)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DetailPanel>
      </div>
    </ReadOnlySimulation>
  );
}

const FLOW_EVERY: Record<StrategyParams["contributions"]["frequency"], string> = {
  monthly: "month",
  quarterly: "quarter",
  semiannual: "6 months",
  annual: "year",
};

/** "€500 / month", "4% of value / year", or None; a withdrawal's start when it isn't the first year. */
function describeFlow(f: StrategyParams["contributions"] | StrategyParams["withdrawals"], currency: string) {
  if (!f.enabled) return "None";
  const amount = f.amountType === "percent_of_value" ? `${f.amount}% of value` : formatCurrency(f.amount, currency, 0);
  const from = "startAfterYears" in f && f.startAfterYears > 0 ? `, from year ${f.startAfterYears + 1}` : "";
  return `${amount} / ${FLOW_EVERY[f.frequency]}${from}`;
}

/**
 * ALLOCATION ROWS — the strategy's rules beside what it holds now: each target with the instrument
 * it buys (a category through its proxy), its target weight and, once its holdings are computed,
 * its weight now as a bar against a mark at the target, and the drift between them. A target at 0
 * that isn't held is left out.
 */
function AllocationRows({ strategy: s }: { strategy: PublishedStrategy }) {
  const now = s.profile?.targetWeightsPct;
  const rows = s.strategy.targets
    .map((t, i) => ({ target: t, nowPct: now && now.length === s.strategy.targets.length ? now[i] : null }))
    .filter((r) => r.target.weightPct > 0 || (r.nowPct ?? 0) > 0);
  const top = Math.max(...rows.map((r) => Math.max(r.target.weightPct, r.nowPct ?? 0)), 1);
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map(({ target: t, nowPct }) => {
        const drift = nowPct === null ? null : nowPct - t.weightPct;
        return (
          <li key={targetKey(t)} className="py-3 space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-slate-900 truncate">{targetLabel(t)}</span>
                <span className="block text-[11px] text-slate-500 truncate">
                  {t.kind === "asset"
                    ? [t.asset.ticker, exchangeLabel(t.asset.exchangeMic ?? null), t.asset.currency, t.asset.isin].filter(Boolean).join(" · ")
                    : `Through ${STRATEGY_PROXIES[t.category]}`}
                </span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block text-[13px] font-black text-slate-900">{nowPct === null ? `${t.weightPct}%` : `${nowPct.toFixed(1)}%`}</span>
                <span className="block text-[10.5px] text-slate-500">
                  {nowPct === null ? "target" : `target ${t.weightPct}%${drift !== null && Math.abs(drift) >= 0.05 ? ` · ${drift > 0 ? "+" : "−"}${Math.abs(drift).toFixed(1)}` : ""}`}
                </span>
              </span>
            </div>
            {nowPct !== null && (
              <span className="relative block h-1.5 rounded-full bg-slate-100" aria-hidden>
                <span className="absolute inset-y-0 left-0 rounded-full bg-[#C49A3C]" style={{ width: `${Math.min(100, (nowPct / top) * 100)}%` }} />
                <span className="absolute -inset-y-[3px] w-0.5 bg-slate-900" style={{ left: `${Math.min(99.5, (t.weightPct / top) * 100)}%` }} title={`Target ${t.weightPct}%`} />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DetailPanel({ title, badge, note, children }: { title: string; badge?: React.ReactNode; note?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm px-5 md:px-6 py-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">{title}</h4>
        {badge}
      </div>
      {children}
      {note && <p className="text-[11px] text-slate-400 mt-2">{note}</p>}
    </section>
  );
}

function DetailRows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {rows.map((r) => (
        <div key={r.label} className="py-2.5 flex items-start justify-between gap-4">
          <dt className="text-[13px] font-semibold text-slate-500">{r.label}</dt>
          <dd className="text-[13px] font-bold text-slate-900 text-right">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
