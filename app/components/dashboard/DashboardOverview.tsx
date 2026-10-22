// app/components/dashboard/DashboardOverview.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { portfolioService } from "../../services/portfolioService";
import type { Portfolio, PortfolioSnapshot, TodayDashboard } from "../../models/Portfolio";
import { formatCurrency } from "../../lib/format";
import { NoDataEmptyState } from "./NoDataEmptyState";
import { usePortfolio } from "../../context/PortfolioContext";
import { AlertGaugeCard } from "./AlertGauge";
import { openPortfolioPage, openRealEstatePage, openWalletPage } from "../../lib/dashboardNav";
import { BudgetsSummaryModule, UpcomingPaymentsModule } from "./DashboardSummaries";
import { DailyArticleModule } from "./NewsSection";
import { usePortfoliosAlertRules } from "../../hooks/useAlertRules";
import { alertState, type AlertState, type AlertTone } from "../../lib/alerts";
import { useWalletsOverview, type WalletsOverview } from "../../hooks/useWalletsOverview";
import { useWallets } from "../../context/WalletsContext";
import { useRealEstateNetWorth, type RealEstateNetWorth } from "../../hooks/useRealEstateNetWorth";
import { useRealEstate } from "../../context/RealEstateContext";
import { PreviewBadge } from "../preview/PreviewKit";
import { WealthBreakdown } from "./WealthBreakdown";
import { MODULE_BODY, ModuleHead, Module as SummaryModule } from "./PerformanceSection";

// One portfolio's GET /v1/portfolios/{p}/overview: null snapshot = no data yet (no transactions,
// or the aggregate's first build hasn't landed), `failed` = the request itself errored.
type SnapshotState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; snapshot: PortfolioSnapshot | null };

/**
 * DASHBOARD — the whole wealth at a glance, not tied to the selected portfolio: the net worth
 * on top (every portfolio's market value, from the aggregate "All portfolios" or the only
 * portfolio, plus the wallets' balance and the real estate's equity; a demo account's wallets and
 * properties are sample data, see lib/mock), with the portfolios, the wallets and the properties
 * under it as totals, and beside it on a wide enough page the wallets' cash flow (WealthBreakdown);
 * then two by two: the wallets' cash flow and the payments coming up, every portfolio's alerts
 * and the month's budgets; then the article of the day. Headline figures
 * only: the rest lives in Investments, Wallets and Real estate, which the summaries open. The overview endpoint never mixes history
 * with fresh data (no isStale).
 */
export default function DashboardOverview({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
  const { portfolios, current, selectPortfolio } = usePortfolio();
  // The wallets, once there's at least one (not archived).
  const overview = useWalletsOverview();
  const wallets = overview && overview.wallets.length > 0 ? overview : null;
  // The real estate, likewise once there's a property (not archived, not sold).
  const realEstateNetWorth = useRealEstateNetWorth();
  const realEstate = realEstateNetWorth && realEstateNetWorth.properties.length > 0 ? realEstateNetWorth : null;
  const [snapshots, setSnapshots] = useState<Record<string, SnapshotState>>({});

  // Refetch only when the set of portfolios changes, not on every new array from the context
  // (a rename replaces the array but not the uuids). A portfolio with no entry yet reads as
  // loading; on a refetch the previous figures stay up until the new ones land.
  // The headline's only: the aggregate, or the only real portfolio (never a backtest).
  const uuidsKey = (portfolios.find((p) => p.isAggregate) ?? portfolios.find((p) => !p.isVirtual))?.uuid ?? "";
  useEffect(() => {
    const uuids = uuidsKey ? uuidsKey.split(",") : [];
    let cancelled = false;
    uuids.forEach(async (uuid) => {
      let next: SnapshotState;
      try {
        next = { status: "ready", snapshot: await portfolioService.getPortfolioOverview(uuid) };
      } catch (err) {
        console.error(`Failed to fetch overview for portfolio ${uuid}:`, err);
        next = { status: "failed" };
      }
      if (!cancelled) setSnapshots((prev) => ({ ...prev, [uuid]: next }));
    });
    return () => { cancelled = true; };
  }, [uuidsKey]);

  // Every portfolio together: the aggregate when there is one, otherwise the only real portfolio.
  // A strategy's backtest is simulated money: never the net worth, and not in the aggregate.
  const aggregate = portfolios.find((p) => p.isAggregate);
  const headline = aggregate ?? portfolios.find((p) => !p.isVirtual);

  // "Manage alerts" (and the empty state's button) open the Alerts page of the selected portfolio
  // (a real one or All portfolios: the default while a backtest is selected).
  const openAlertSettings = () => {
    const target = current && !(current.isVirtual && !current.isAggregate) ? current : portfolios.find((p) => p.isDefault);
    if (onNavigate && target) openPortfolioPage(onNavigate, target.uuid, "alerts");
  };

  // A portfolio opens on its page in Investments, or on its Transactions to add some.
  const openPortfolio = (uuid: string, section: string) => {
    selectPortfolio(uuid);
    if (!onNavigate) return;
    if (section === "performance") openPortfolioPage(onNavigate, uuid);
    else if (section === "upload") openPortfolioPage(onNavigate, uuid, "transactions");
    else onNavigate(section);
  };
  // The investments: All portfolios, or the only portfolio.
  const investments = portfolios.find((p) => p.isAggregate) ?? portfolios.find((p) => p.isDefault);

  if (!headline) return null;
  const headlineState = snapshots[headline.uuid] ?? { status: "loading" };
  // A lone portfolio with no data gets the full-page "no data" window and nothing else: an
  // alert with no portfolio to watch has nothing to measure.
  const noDataAtAll = headlineState.status === "ready" && headlineState.snapshot === null && !aggregate;

  if (headlineState.status === "loading") {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" />
      </div>
    );
  }

  // Two modules side by side once there's room (56rem), one under the other otherwise; one alone
  // (the other has nothing to say) takes the row, and with neither the row isn't there.
  // A grid rather than a flex row, so the two stretch to the same height (their cards are h-full).
  const pair = "grid grid-cols-1 @[56rem]:grid-flow-col @[56rem]:auto-cols-fr gap-6 *:min-w-0 empty:hidden";

  return (
    // Sized by the room the page has (the Sidebar collapsed gives it more), not the window's.
    <div className="@container space-y-6 pb-12">
      {/* NET WORTH — a lone portfolio with no data yet gets the full-page "no data" window
          instead (unless there are wallets or properties to add up), since there's nothing else on the page. */}
      {headlineState.status === "failed" ? (
        <ErrorBanner message="Failed to load portfolio data" />
      ) : noDataAtAll && !wallets && !realEstate ? (
        <NoDataEmptyState
          title="No portfolio data yet"
          message="Add or upload your transactions and this is where you'll see what your portfolio is worth today."
          onNavigate={onNavigate ? (section) => openPortfolio(headline.uuid, section) : undefined}
        />
      ) : (
        <NetWorthModule
          portfolio={headline}
          snapshot={headlineState.snapshot}
          wallets={wallets}
          realEstate={realEstate}
          onOpenPortfolios={onNavigate && investments ? () => openPortfolioPage(onNavigate, investments.uuid) : undefined}
          onOpenWallets={onNavigate ? () => openWalletPage(onNavigate, "all") : undefined}
          onOpenRealEstate={onNavigate ? () => openRealEstatePage(onNavigate) : undefined}
        />
      )}

      {/* CASH FLOW — the wallets' last months; beside it, the payments coming up. */}
      <div className={pair}>
        {!noDataAtAll && headlineState.status === "ready" && <WealthBreakdown />}
        <UpcomingPaymentsModule onOpen={onNavigate ? () => openWalletPage(onNavigate, "all") : undefined} />
      </div>

      {/* ALERTS — every portfolio's, aggregate included, as one list sorted by urgency; beside
          them, the month's budgets. */}
      <div className={pair}>
        {!noDataAtAll && (
          <AlertsModule
            portfolios={portfolios}
            onManage={onNavigate ? openAlertSettings : undefined}
          />
        )}
        <BudgetsSummaryModule onOpen={onNavigate ? () => openWalletPage(onNavigate, "all", "budgets") : undefined} />
      </div>

      {/* ARTICLE OF THE DAY — the same pick for everyone; renders nothing on a day without one. */}
      <DailyArticleModule />
    </div>
  );
}

const formatPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
const signedCurrency = (value: number, currency: string) => `${value >= 0 ? "+" : ""}${formatCurrency(value, currency, 0)}`;

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <p className="text-sm font-bold">{message}</p>
    </div>
  );
}

/**
 * NET WORTH MODULE — everything the user owns, in their reference currency: every portfolio at
 * today's market prices plus the wallets' balance and the real estate's equity. On top the total, with
 * how the market moved the portfolios today and this month, and one bar split into its groups,
 * each in its colour (gold for investments, teal for wallets, orange for real estate), the same as
 * its column's below, which is its legend. Under it, one column per group: its total (and for
 * the real estate a line about it: its debt and how its equity moved this month), opening its section (Investments' All portfolios, Wallets, Real estate), where each portfolio,
 * wallet and property is. The bar's pieces say what each is worth on hovering.
 *
 * The portfolios' total is the aggregate's (recomputed from every portfolio's transactions
 * combined) or the only portfolio's. A strategy's backtest is simulated money: never here. The
 * wallets come added up in the user's reference currency (see useWalletsOverview); if that isn't
 * the portfolios' they're shown but not added in. A group below zero takes no room in the bar.
 *
 * The real estate counts by its equity only (an instalment then counts once: cash out of a wallet,
 * debt down); its gross value and debt are in its column's line. Same currency rule as the wallets.
 */
function NetWorthModule({
  portfolio, snapshot, wallets, realEstate,
  onOpenPortfolios, onOpenWallets, onOpenRealEstate,
}: {
  portfolio: Portfolio;
  // null: nothing computed yet (the aggregate's first build, or a portfolio with no data).
  snapshot: PortfolioSnapshot | null;
  wallets: WalletsOverview | null;
  realEstate: RealEstateNetWorth | null;
  onOpenPortfolios?: () => void;
  onOpenWallets?: () => void;
  onOpenRealEstate?: () => void;
}) {
  const moves = useRecentMoves(portfolio.uuid);
  // The bar's piece under the pointer: its name, kind, value and share over it.
  const [hovered, setHovered] = useState<string | null>(null);
  const { sample } = useWallets();
  const { sample: realEstateSample } = useRealEstate();
  const currency = snapshot?.currency ?? wallets?.currency ?? realEstate?.overview?.currency ?? "EUR";
  const investments = snapshot?.totalMarketValue ?? 0;
  const walletsCounted = wallets && wallets.currency === currency ? wallets.balance ?? 0 : 0;
  const reOverview = realEstate?.overview ?? null;
  const realEstateCounted = reOverview && reOverview.currency === currency ? reOverview.equity : 0;
  const total = investments + walletsCounted + realEstateCounted;
  const shareOf = (value: number) => (total > 0 ? Math.max(0, (value / total) * 100) : 0);

  // The bar, one piece per group counted in the total, in its colour (the same as its column's).
  const groups = [
    { key: "investments", label: "Investments", value: investments, color: GOLD },
    ...(walletsCounted !== 0 ? [{ key: "wallets", label: "Wallets", value: walletsCounted, color: TEAL }] : []),
    ...(realEstateCounted !== 0 ? [{ key: "realEstate", label: "Real estate", value: realEstateCounted, color: ORANGE }] : []),
  ].filter((g) => g.value > 0);
  // Where each piece starts and ends along the bar, in percent: the hovered one's label sits over its middle.
  let start = 0;
  const pieces = groups.map((g) => {
    const width = shareOf(g.value);
    const piece = { ...g, width, center: start + width / 2 };
    start += width;
    return piece;
  });
  const focus = pieces.find((p) => p.key === hovered) ?? null;
  const columns = 1 + (wallets ? 1 : 0) + (realEstate ? 1 : 0);

  return (
    <Module>
      <div className="p-6 md:p-7 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C]">Net worth · {currency}</p>
            <p className="text-4xl md:text-5xl font-black text-slate-900 tabular-nums mt-1.5" style={serif}>
              {formatCurrency(total, currency, 0)}
            </p>
          </div>
          {snapshot && moves && (
            <dl className="flex gap-6">
              <Move label="Today" amount={moves.dayMarketEffect} pct={moves.previousDayValue !== 0 ? moves.dayMarketEffectPct : null} currency={moves.currency} />
              <Move label="This month" amount={moves.mtdMarketEffect} pct={moves.monthStartValue !== 0 ? moves.mtdMarketEffectPct : null} currency={moves.currency} />
            </dl>
          )}
        </div>

        {pieces.length > 0 && (
            <div className="relative">
              {focus && (
                <div
                  role="tooltip"
                  className="absolute bottom-full mb-2.5 -translate-x-1/2 z-10 pointer-events-none whitespace-nowrap rounded-xl bg-[#1c1917] px-3 py-2 text-white shadow-lg"
                  // Kept inside the card near either end.
                  style={{ left: `clamp(5rem, ${focus.center}%, calc(100% - 5rem))` }}
                >
                  <p className="flex items-center gap-1.5 text-[12.5px] font-bold">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: focus.color }} />
                    {focus.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-stone-400 tabular-nums">
                    {formatCurrency(focus.value, currency, 0)} · {focus.width.toFixed(1)}%
                  </p>
                </div>
              )}
              {/* A taller strip than the bar takes the pointer, so a thin piece is easy to land on. */}
              <div className="flex h-5 items-center gap-0.5" onMouseLeave={() => setHovered(null)}>
                {pieces.map((p, i) => (
                  <div
                    key={p.key}
                    onMouseEnter={() => setHovered(p.key)}
                    className="h-full flex items-center cursor-default"
                    style={{ width: `${p.width}%` }}
                  >
                    <div
                      className={`w-full rounded-[3px] transition-all ${i === 0 ? "rounded-l-full" : ""} ${i === pieces.length - 1 ? "rounded-r-full" : ""} ${hovered === p.key ? "h-4" : "h-3"} ${hovered && hovered !== p.key ? "opacity-35" : ""}`}
                      style={{ background: p.color }}
                    />
                  </div>
                ))}
              </div>
            </div>
        )}
      </div>

      <div className={`grid grid-cols-1 ${columns === 3 ? "lg:grid-cols-3 lg:divide-x" : columns === 2 ? "lg:grid-cols-2 lg:divide-x" : ""} divide-y lg:divide-y-0 divide-slate-100 border-t border-slate-100`}>
        <GroupColumn
          title="Investments"
          color={GOLD}
          value={snapshot ? formatCurrency(snapshot.totalMarketValue, snapshot.currency, 0) : null}
          pending={portfolio.isAggregate
            ? "The combined figures across your portfolios are being prepared. Check back in a few minutes."
            : "No transactions yet: add some to see what your portfolio is worth."}
          onOpen={onOpenPortfolios}
        />
        {wallets && (
          <GroupColumn
            title="Wallets"
            color={TEAL}
            badge={sample ? <PreviewBadge label="Sample data" /> : undefined}
            value={wallets.balance === null ? "—" : formatCurrency(wallets.balance, wallets.currency, 0)}
            onOpen={onOpenWallets}
          />
        )}
        {realEstate && (
          <GroupColumn
            title="Real estate"
            color={ORANGE}
            badge={realEstateSample ? <PreviewBadge label="Sample data" /> : undefined}
            value={reOverview ? formatCurrency(reOverview.equity, reOverview.currency, 0) : "—"}
            summary={reOverview ? (
              <>
                {formatCurrency(reOverview.residualDebt, reOverview.currency, 0)} debt
                {realEstate.monthChange !== null && <><span className="text-slate-300"> · </span><Delta amount={realEstate.monthChange} pct={null} currency={reOverview.currency} /> this month</>}
                {realEstateCounted === 0 && reOverview.equity !== 0 && <><span className="text-slate-300"> · </span>not added in</>}
              </>
            ) : "Can't be added up right now: an exchange rate is missing"}
            onOpen={onOpenRealEstate}
          />
        )}
      </div>
    </Module>
  );
}

// Each group's colour: the investments', the wallets', the real estate's.
const GOLD = "#C49A3C";
const TEAL = "#0f766e";
const ORANGE = "#eb6834";
const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;

/** One of the headline's market moves: "Today · +1,240 EUR · +0.84%". */
function Move({ label, amount, pct, currency }: { label: string; amount: number; pct: number | null; currency: string }) {
  const gain = amount >= 0;
  const Icon = gain ? TrendingUp : TrendingDown;
  return (
    <div>
      <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className={`flex items-center gap-1.5 text-[15px] font-black tabular-nums mt-1 ${gain ? "text-emerald-600" : "text-rose-600"}`}>
        <Icon className="h-4 w-4 shrink-0" />
        {signedCurrency(amount, currency)}
        {pct !== null && <span className="text-xs font-bold opacity-80">{formatPct(pct)}</span>}
      </dd>
    </div>
  );
}

/** A signed change in its gain/loss colour: an amount, a percentage, or both. */
function Delta({ amount, pct, currency }: { amount: number | null; pct: number | null; currency: string }) {
  const sign = amount ?? pct ?? 0;
  return (
    <span className={`font-bold tabular-nums ${sign >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
      {amount !== null && signedCurrency(amount, currency)}
      {amount !== null && pct !== null && " · "}
      {pct !== null && formatPct(pct)}
    </span>
  );
}

/**
 * GROUP COLUMN — one kind of asset under the net worth: its name, total and a line about it,
 * opening its section. `value` null: nothing to show yet, `pending` says why.
 */
function GroupColumn({
  title, color, badge, value, pending, summary, onOpen,
}: {
  title: string;
  color: string;
  badge?: React.ReactNode;
  value: string | null;
  pending?: string;
  summary?: React.ReactNode;
  onOpen?: () => void;
}) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="group text-left px-6 md:px-7 pt-5 pb-4 enabled:hover:bg-slate-50/70 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C49A3C]/40"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
            {title}
            {badge}
          </p>
          {onOpen && <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#C49A3C] transition-colors" />}
        </div>
        {value === null ? (
          <p className="text-sm text-slate-500 mt-2">{pending}</p>
        ) : (
          <>
            <p className="font-black text-slate-900 text-2xl tabular-nums mt-1.5" style={serif}>{value}</p>
            {summary && <p className="text-xs font-semibold text-slate-400 mt-1">{summary}</p>}
          </>
        )}
      </button>
    </div>
  );
}

/**
 * Today's and this month's market moves for the headline (GET /v1/portfolios/{p}/today, net of
 * money added or withdrawn), shown under its market value; the day-by-day detail is in its
 * Insights ("This month"). Null while there's nothing yet, or while the document is stale (it
 * can mix two versions of the portfolio then).
 */
function useRecentMoves(portfolioUuid: string) {
  const [today, setToday] = useState<TodayDashboard | null>(null);
  useEffect(() => {
    let cancelled = false;
    portfolioService.getTodayDashboard(portfolioUuid)
      .then((data) => { if (!cancelled) setToday(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [portfolioUuid]);
  return today && !today.isStale ? today : null;
}

// Most urgent first: a triggered alert leads, a switched-off one comes last. Rules of the same
// state keep the backend's order (portfolio by portfolio, oldest first).
const ALERT_ORDER: Record<AlertState["kind"], number> = {
  triggered: 0, reached: 1, approaching: 2, ok: 3, pending: 4, unavailable: 5, off: 6,
};

// A user can have up to 20 alerts per portfolio, far too many dials to show at once. The most
// urgent get a dial each; the rest sit behind "Show all".
const ALERTS_SHOWN_COLLAPSED = 6;

// How the states roll up into the one-line summary above the dials.
const SUMMARY_GROUPS: { tone: AlertTone; label: string; dot: string }[] = [
  { tone: "danger", label: "triggered", dot: "bg-red-500" },
  { tone: "warn", label: "approaching", dot: "bg-amber-500" },
  { tone: "ok", label: "within range", dot: "bg-emerald-500" },
  { tone: "muted", label: "not active", dot: "bg-slate-400" },
];

/**
 * ALERTS MODULE — the rules on all of the user's portfolios as dials, refreshed every minute
 * (the backend re-checks every rule about every 5 minutes, so a reading changes while the page
 * is open). With more than one portfolio each dial is labelled with the portfolio it watches.
 * A one-line summary counts them by state; only the ALERTS_SHOWN_COLLAPSED most urgent get a
 * dial until the user asks for all of them. With no rules, the way to set one. Its head opens
 * the alerts' page (`onManage`), as the Budgets beside it opens theirs.
 */
function AlertsModule({ portfolios, onManage }: { portfolios: Portfolio[]; onManage?: () => void }) {
  const uuids = useMemo(() => portfolios.map((p) => p.uuid), [portfolios]);
  const { rules, loading, error } = usePortfoliosAlertRules(uuids, 60_000);
  const [showAll, setShowAll] = useState(false);

  const nameOf = (uuid: string) => portfolios.find((p) => p.uuid === uuid)?.name ?? "";
  const sorted = rules === null
    ? []
    : [...rules].sort((a, b) => ALERT_ORDER[alertState(a).kind] - ALERT_ORDER[alertState(b).kind]);
  const visible = showAll ? sorted : sorted.slice(0, ALERTS_SHOWN_COLLAPSED);
  const counts = SUMMARY_GROUPS
    .map((g) => ({ ...g, count: sorted.filter((r) => alertState(r).tone === g.tone).length }))
    .filter((g) => g.count > 0);

  // A failed request means no module at all. Without any alert yet, the way to set one (on each
  // portfolio's page, see Portfolios).
  if (error) return null;

  return (
    <SummaryModule>
      <ModuleHead
        title="Alerts"
        desc="How close each alert is to its limit. Checked about every 5 minutes."
        onExplore={onManage}
      />
      {loading && rules === null ? (
        <p className={`${MODULE_BODY} text-[12.5px] text-[#857e78]`}>Loading…</p>
      ) : sorted.length === 0 ? (
        <div className={`${MODULE_BODY} space-y-2`}>
          <p className="text-[12.5px] text-[#857e78]">No alerts yet: an alert tells you when a portfolio or a holding crosses a limit you set.</p>
          {onManage && <button type="button" onClick={onManage} className="text-xs font-bold text-[#8A6A28] hover:text-[#C49A3C]">Set an alert →</button>}
        </div>
      ) : (
      // Its own container: the dials go two or three to a row by the module's width, beside Budgets or not.
      <div className={`@container ${MODULE_BODY} space-y-4`}>
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-bold text-slate-600">
          {counts.map((g) => (
            <li key={g.tone} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${g.dot}`} />
              {g.count} {g.label}
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 @sm:grid-cols-2 @4xl:grid-cols-3 gap-4">
          {visible.map((rule) => (
            <div key={`${rule.portfolioUuid}:${rule.ruleId}`} className="flex flex-col gap-1.5">
              {portfolios.length > 1 && (
                <p className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">
                  {nameOf(rule.portfolioUuid)}
                </p>
              )}
              <AlertGaugeCard rule={rule} />
            </div>
          ))}
        </div>
        {sorted.length > ALERTS_SHOWN_COLLAPSED && (
          <div className="flex justify-center">
            <button
              onClick={() => setShowAll((v) => !v)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 hover:border-[#C49A3C] hover:text-[#C49A3C] transition-colors"
            >
              {showAll ? "Show fewer" : `Show all ${sorted.length}`}
            </button>
          </div>
        )}
      </div>
      )}
    </SummaryModule>
  );
}

/**
 * MODULE — the card shell every group of related content lives in.
 */
function Module({ children }: { children: React.ReactNode }) {
  return (
    <section className="h-full bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
      {children}
    </section>
  );
}

