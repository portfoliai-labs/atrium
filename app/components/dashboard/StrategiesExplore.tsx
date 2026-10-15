// components/dashboard/StrategiesExplore.tsx
"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ArrowUpRight, ChevronLeft, ChevronRight, Info, Loader2, Telescope } from "lucide-react";
import { publicationService } from "../../services/publicationService";
import { ApiError } from "../../services/apiClient";
import { STRATEGY_PROXIES, simulatedPeriod, targetLabel, type StrategyCosts, type StrategyParams, type StrategyResponse, type StrategyTarget } from "../../models/Strategy";
import { portfoliosService } from "../../services/portfoliosService";
import {
  CRISIS_LABELS, FILTER_HORIZONS, HORIZON_LABELS, SORT_LABELS, isFigureSort,
  type CatalogPage, type CatalogSort, type FilterHorizon, type HorizonFigures, type PublishedStrategy,
} from "../../models/PublishedStrategy";
import { exchangeLabel } from "../../models/AssetSearch";
import { formatCurrency } from "../../lib/format";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { describeRebalancing } from "./BacktestMarks";
import { ReadOnlySimulation } from "./ReadOnlySimulation";
import { CATEGORY_COLORS, SECURITY_COLORS } from "./StrategyBuilder";

const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;
const dateLabel = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

const PAGE_SIZE = 12;
// How long the figure filters wait for typing to stop before asking again.
const FILTER_DELAY_MS = 400;

const signedPct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
const plainPct = (v: number) => `${v.toFixed(1)}%`;
const fig = (v: number | null, format: (v: number) => string) => (v == null ? "—" : format(v));

/** The author's trading costs, in a line: shown next to the figures, which are gross of them. */
const costsLine = (c: StrategyCosts, currency: string) =>
  `${c.commissionPct}% commission · ${formatCurrency(c.fixedFee, currency, 2)} fixed fee per trade · ${c.spreadPct}% spread`;

const byline = (s: PublishedStrategy) => `By ${s.authorName ?? "an advisor"} · published ${dateLabel(s.publishedAt)}`;

// ── The disclaimer ────────────────────────────────────────────────────────────────────────

/** What every figure in the catalog is, and isn't: on Explore and on each strategy's page. */
function SimulationDisclaimer() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-dashed border-sky-300 bg-sky-50/70 px-4 py-3.5">
      <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
        <Info className="h-4 w-4" />
      </span>
      <p className="text-xs text-sky-900/80 leading-relaxed">
        <span className="block text-[13px] font-black text-sky-950">Every figure here is simulated</span>
        Each strategy is played on historical prices: none of it is a real result. The figures are gross of trading costs
        (the author&apos;s are shown next to them, not taken out) and aren&apos;t moved by money added or withdrawn. This is for
        educational and informational purposes only and isn&apos;t investment advice or a recommendation. Past and simulated
        performance doesn&apos;t predict future results.
      </p>
    </div>
  );
}

function SimulatedBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-[10px] font-black uppercase tracking-wider text-sky-800">
      Simulated, gross of trading costs
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

function FigureGrid({ figures }: { figures: HorizonFigures }) {
  const items = [
    { label: "Annualized return", value: fig(figures.annualizedReturnPct, signedPct), tone: figures.annualizedReturnPct },
    { label: "Volatility", value: fig(figures.volatilityPct, plainPct) },
    { label: "Max drawdown", value: fig(figures.maxDrawdownPct, signedPct) },
    { label: "Return / risk", value: fig(figures.returnPerRisk, (v) => v.toFixed(2)) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{i.label}</dt>
          <dd className={`text-[15px] font-black tabular-nums ${i.tone == null ? "text-slate-900" : i.tone >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ── Explore: the list ─────────────────────────────────────────────────────────────────────

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
 * STRATEGIES EXPLORE — the strategies catalog (GET /v1/explore/strategies): strategy portfolios
 * advisors published, for every user to read. Newest first by default, with no horizon; picking a
 * horizon (1, 3, 5 or 10 years) shows each strategy's figures over it and lets the user filter by
 * volatility and drawdown and sort by a figure, which the backend only does on a horizon, so the
 * filters stay off without one. Every figure is a simulation, gross of its author's costs (shown next
 * to them), labelled so,
 * under a disclaimer; nothing here is matched to the viewer, and nothing can be copied or adopted.
 * A strategy opens its page (StrategyDetail).
 */
export function StrategiesExplore({ trail, publicationId, onOpen, onNavigate }: {
  trail: Crumb[];
  // The strategy open, if any.
  publicationId?: string;
  onOpen: (publicationId: string | null) => void;
  onNavigate?: (section: string) => void;
}) {
  if (publicationId) {
    return <StrategyDetail publicationId={publicationId} trail={[...trail, { label: "Explore", onClick: () => onOpen(null) }]} onNavigate={onNavigate} />;
  }
  return <StrategiesList trail={trail} onOpen={onOpen} />;
}

function StrategiesList({ trail, onOpen }: { trail: Crumb[]; onOpen: (publicationId: string) => void }) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  // The figure filters as last sent: they follow the inputs once typing stops.
  const [applied, setApplied] = useState({ maxVolatilityPct: "", maxDrawdownPct: "" });
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<{ key: string; page: CatalogPage | null; error: string | null } | null>(null);

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
  const key = JSON.stringify(query);

  useEffect(() => {
    let cancelled = false;
    publicationService.list(JSON.parse(key))
      .then((p) => { if (!cancelled) setResult({ key, page: p, error: null }); })
      .catch((err) => {
        if (!cancelled) setResult({ key, page: null, error: err instanceof Error ? err.message : "Unable to load the strategies." });
      });
    return () => { cancelled = true; };
  }, [key]);

  const current = result?.key === key ? result : null;
  // While the next page loads, the last one stays, dimmed.
  const shown = current?.page ?? result?.page ?? null;
  const loading = current === null;

  const setHorizon = (horizon: FilterHorizon | null) => {
    // Back to no horizon: nothing it needed stays set.
    setFilters((f) => (horizon ? { ...f, horizon } : NO_FILTERS));
    if (!horizon) setApplied({ maxVolatilityPct: "", maxDrawdownPct: "" });
    setPage(0);
  };

  const total = shown?.total ?? 0;
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="Explore" />
      <p className="text-[13px] text-slate-500 leading-relaxed max-w-2xl">
        Strategies advisors have published, each simulated on historical prices. Browse them to see how different mixes and
        rules would have behaved; they&apos;re the same for everyone and aren&apos;t matched to you.
      </p>
      <SimulationDisclaimer />

      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6 space-y-4">
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
              {(Object.keys(SORT_LABELS) as CatalogSort[]).map((s) => (
                <option key={s} value={s} disabled={isFigureSort(s) && !filters.horizon}>{SORT_LABELS[s]}</option>
              ))}
            </select>
          </label>
        </div>
        {!filters.horizon && (
          <p className="text-[11px] text-slate-500">Pick a period to filter or sort by the figures: they&apos;re compared over the same years.</p>
        )}
      </section>

      {current?.error ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-rose-600"><AlertCircle className="h-4 w-4" /> {current.error}</p>
      ) : !shown ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" /></div>
      ) : shown.strategies.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 py-10 flex flex-col items-center text-center gap-2">
          <Telescope className="h-6 w-6 text-slate-400" />
          <p className="text-sm font-black text-slate-900">
            {filters.horizon ? "No strategy matches these filters" : "No strategies published yet"}
          </p>
          {filters.horizon && (
            <p className="text-xs text-slate-500 max-w-md">
              Only strategies whose history covers the whole period are listed. Try a shorter period or looser limits.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
            {shown.strategies.map((s) => (
              <StrategyCard key={s.publicationId} strategy={s} horizon={filters.horizon} onOpen={() => onOpen(s.publicationId)} />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-500 tabular-nums">{from}–{to} of {total}</span>
            <span className="flex items-center gap-2">
              <PageButton label="Previous page" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </PageButton>
              <PageButton label="Next page" disabled={to >= total || loading} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </PageButton>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function StrategyCard({ strategy: s, horizon, onOpen }: { strategy: PublishedStrategy; horizon: FilterHorizon | null; onOpen: () => void }) {
  const figures = cardFigures(s, horizon);
  return (
    <article className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 md:p-6 flex flex-col gap-4">
      <div className="min-w-0">
        <h3 className="text-lg font-black text-slate-900 truncate" style={serif}>{s.portfolioName}</h3>
        <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{byline(s)}</p>
        {s.description && <p className="text-[13px] text-slate-600 leading-relaxed mt-2 line-clamp-3">{s.description}</p>}
      </div>
      <AllocationBar targets={s.strategy.targets} />
      <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <SimulatedBadge />
          <span className="text-[11px] font-bold text-slate-500">{figures ? `Last ${HORIZON_LABELS[figures.horizon]}` : ""}</span>
        </div>
        {figures ? <FigureGrid figures={figures} /> : (
          <p className="text-xs text-slate-500">{s.figuresComputedAt ? "Its history is shorter than a year." : "Its figures are being computed."}</p>
        )}
        <p className="text-[10px] text-slate-400 leading-snug">Author&apos;s costs, not taken out of these figures: {costsLine(s.costs, s.currency)}</p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-auto self-start flex items-center gap-1.5 min-h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:border-slate-300 transition-colors"
      >
        See the strategy <ArrowUpRight className="h-3.5 w-3.5" />
      </button>
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
          className="w-full h-11 px-3.5 pr-12 rounded-xl bg-white border border-slate-200 text-sm font-semibold tabular-nums text-slate-900 outline-none placeholder:text-slate-300 focus:border-[#C49A3C]/60 disabled:bg-slate-50 disabled:cursor-not-allowed"
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
 * STRATEGY DETAIL — one strategy of the catalog (GET /v1/explore/strategies/{id}): what it holds,
 * how it rebalances, its author's costs (in their currency, the figures gross of them), the period
 * it's simulated over, every horizon's figures (the whole history's too; total return as on the
 * Insights, annualized as in the list) and how it went through the past crises its history covers, then its
 * portfolio's Insights (ReadOnlySimulation), all simulated. Read only: no way to copy or adopt it.
 */
function StrategyDetail({ publicationId, trail, onNavigate }: { publicationId: string; trail: Crumb[]; onNavigate?: (section: string) => void }) {
  const [result, setResult] = useState<{ id: string; strategy: PublishedStrategy | null; error: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    publicationService.get(publicationId)
      .then((s) => { if (!cancelled) setResult({ id: publicationId, strategy: s, error: null }); })
      .catch((err) => {
        if (cancelled) return;
        const error = err instanceof ApiError && err.status === 404
          ? "This strategy isn't in the catalog any more: its author withdrew it."
          : err instanceof Error ? err.message : "Unable to load this strategy.";
        setResult({ id: publicationId, strategy: null, error });
      });
    return () => { cancelled = true; };
  }, [publicationId]);

  // What the catalog leaves out of a strategy, from its backtest (GET /v1/portfolios/{p}/strategy,
  // readable while it's published): the amount it started with, and the money it added or took.
  const portfolioUuid = result?.id === publicationId ? result.strategy?.portfolioUuid ?? null : null;
  const [params, setParams] = useState<{ uuid: string; value: StrategyResponse | null } | null>(null);
  useEffect(() => {
    if (!portfolioUuid) return;
    let cancelled = false;
    portfoliosService.getStrategy(portfolioUuid)
      .then((v) => { if (!cancelled) setParams({ uuid: portfolioUuid, value: v }); })
      .catch(() => { if (!cancelled) setParams({ uuid: portfolioUuid, value: null }); });
    return () => { cancelled = true; };
  }, [portfolioUuid]);
  // undefined while loading, null when it couldn't be read.
  const flows = params?.uuid === portfolioUuid ? params.value : undefined;

  const current = result?.id === publicationId ? result : null;
  if (!current?.strategy) {
    return (
      <div className="space-y-6 pb-12">
        <Breadcrumb trail={trail} current="Published strategy" />
        {current?.error
          ? <p className="flex items-center gap-2 text-sm font-semibold text-rose-600"><AlertCircle className="h-4 w-4" /> {current.error}</p>
          : <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" /></div>}
      </div>
    );
  }

  const s = current.strategy;
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
    >
      <div className="space-y-6">
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-7 space-y-3">
          <p className="text-[11px] font-semibold text-slate-400">{byline(s)}</p>
          {s.description && <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-line">{s.description}</p>}
          <div className="max-w-xl"><AllocationBar targets={s.strategy.targets} /></div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <DetailPanel title="Allocation">
            <ul className="divide-y divide-slate-100">
              {s.strategy.targets.filter((t) => t.weightPct > 0).map((t) => (
                <li key={targetKey(t)} className="py-2.5 flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-slate-900 truncate">{targetLabel(t)}</span>
                    <span className="block text-[11px] text-slate-500 truncate">
                      {t.kind === "asset"
                        ? [t.asset.ticker, exchangeLabel(t.asset.exchangeMic ?? null), t.asset.currency, t.asset.isin].filter(Boolean).join(" · ")
                        : `Through ${STRATEGY_PROXIES[t.category]}`}
                    </span>
                  </span>
                  <span className="text-[13px] font-black tabular-nums text-slate-900">{t.weightPct}%</span>
                </li>
              ))}
            </ul>
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
          <DetailPanel title="Author's costs" note="The figures are gross of these: they aren't taken out of them.">
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
