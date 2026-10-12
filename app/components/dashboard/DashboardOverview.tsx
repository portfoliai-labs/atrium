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
import { openPortfolioPage, openWalletPage } from "../../lib/dashboardNav";
import { DailyArticleModule } from "./NewsSection";
import { usePortfoliosAlertRules } from "../../hooks/useAlertRules";
import { alertState, type AlertState, type AlertTone } from "../../lib/alerts";
import { useWalletsOverview, type WalletsOverview } from "../../hooks/useWalletsOverview";
import { useWallets } from "../../context/WalletsContext";
import { PreviewBadge } from "../preview/PreviewKit";

// One portfolio's GET /v1/portfolios/{p}/overview: null snapshot = no data yet (no transactions,
// or the aggregate's first build hasn't landed), `failed` = the request itself errored.
type SnapshotState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; snapshot: PortfolioSnapshot | null };

/**
 * DASHBOARD — the whole wealth at a glance, not tied to the selected portfolio: the net worth
 * on top (every portfolio's market value, from the aggregate "All portfolios" or the only
 * portfolio, plus the wallets' balance; a demo account's wallets are sample data, see
 * lib/mock/wallets), with the portfolios and the wallets under it, as totals and one by one; then every
 * portfolio's alerts and the article of the day. Headline figures only: the rest lives under
 * Manage, which the summaries open. The overview endpoint never mixes history
 * with fresh data (no isStale).
 */
export default function DashboardOverview({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
  const { portfolios, current, selectPortfolio } = usePortfolio();
  // The wallets, once there's at least one (not archived).
  const overview = useWalletsOverview();
  const wallets = overview && overview.wallets.length > 0 ? overview : null;
  const [snapshots, setSnapshots] = useState<Record<string, SnapshotState>>({});

  // Refetch only when the set of portfolios changes, not on every new array from the context
  // (a rename replaces the array but not the uuids). A portfolio with no entry yet reads as
  // loading; on a refetch the previous figures stay up until the new ones land.
  // The aggregate's (the headline) and each real portfolio's, never a backtest's.
  const uuidsKey = portfolios.filter((p) => p.isAggregate || !p.isVirtual).map((p) => p.uuid).join(",");
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
  // The real portfolios, each shown on its own under the total.
  const members = useMemo(() => portfolios.filter((p) => !p.isVirtual), [portfolios]);

  // "Manage alerts" (and the empty state's button) open the Alerts page of the selected portfolio
  // (a real one or All portfolios: the default while a backtest is selected).
  const openAlertSettings = () => {
    const target = current && !(current.isVirtual && !current.isAggregate) ? current : portfolios.find((p) => p.isDefault);
    if (onNavigate && target) openPortfolioPage(onNavigate, target.uuid, "alerts");
  };

  // A portfolio opens on its page in Wealth, or on its Transactions to add some.
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

  return (
    <div className="space-y-6 pb-12">

      {/* NET WORTH — a lone portfolio with no data yet gets the full-page "no data" window
          instead (unless there are wallets to add up), since there's nothing else on the page. */}
      {headlineState.status === "failed" ? (
        <ErrorBanner message="Failed to load portfolio data" />
      ) : noDataAtAll && !wallets ? (
        <NoDataEmptyState
          title="No portfolio data yet"
          message="Add or upload your transactions and this is where you'll see what your portfolio is worth today."
          onNavigate={onNavigate ? (section) => openPortfolio(headline.uuid, section) : undefined}
        />
      ) : (
        <NetWorthModule
          portfolio={headline}
          snapshot={headlineState.snapshot}
          members={members}
          snapshots={snapshots}
          wallets={wallets}
          onOpenPortfolios={onNavigate && investments ? () => openPortfolioPage(onNavigate, investments.uuid) : undefined}
          onOpenPortfolio={onNavigate ? (uuid) => openPortfolio(uuid, "performance") : undefined}
          onOpenWallets={onNavigate ? () => openWalletPage(onNavigate, "all") : undefined}
          onOpenWallet={onNavigate ? (id) => openWalletPage(onNavigate, id) : undefined}
        />
      )}

      {/* ALERTS — every portfolio's, aggregate included, as one list sorted by urgency. */}
      {!noDataAtAll && (
        <AlertsModule
          portfolios={portfolios}
          onManage={onNavigate ? openAlertSettings : undefined}
        />
      )}

      {/* ARTICLE OF THE DAY — the same pick for everyone; renders nothing on a day without one. */}
      <DailyArticleModule />
    </div>
  );
}

const chartDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const formatPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
// Unrealized P&L relative to what's invested; null when nothing is (a fully sold-out
// portfolio), where a percentage would be meaningless.
const unrealizedPct = (s: PortfolioSnapshot) =>
  s.totalInvestedCapital > 0 ? (s.totalUnrealizedPnl / s.totalInvestedCapital) * 100 : null;
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
 * today's market prices plus the wallets' balance. On top the total, with how the market moved the
 * portfolios today and this month, and one bar split into every portfolio and every wallet, each in
 * a shade of its group's colour (gold for investments, teal for wallets) so the bar reads both ways:
 * what each is, and how much of the whole each group is. Under it, one column per group: its total,
 * a line about it (the portfolios' unrealized P&L, the wallets' money in and out this month), then a
 * row for each portfolio or wallet — its share of the net worth, its value and how it's doing — in
 * the same shade as its piece of the bar. A column's head opens its page in Wealth (All portfolios, Wallets), a row that
 * portfolio's or wallet's page.
 *
 * The portfolios' total is the aggregate's (recomputed from every portfolio's transactions
 * combined) or the only portfolio's; each row is that portfolio's own overview. A strategy's
 * backtest is simulated money: never here. The wallets come added up in the user's reference
 * currency (see useWalletsOverview); if that isn't the portfolios' they're shown but not added in,
 * and a wallet in another currency than that has no piece of its own in the bar. A wallet in debt
 * (a credit card) takes no room in the bar.
 */
function NetWorthModule({
  portfolio, snapshot, members, snapshots, wallets,
  onOpenPortfolios, onOpenPortfolio, onOpenWallets, onOpenWallet,
}: {
  portfolio: Portfolio;
  // null: nothing computed yet (the aggregate's first build, or a portfolio with no data).
  snapshot: PortfolioSnapshot | null;
  // The real portfolios, each with its own overview.
  members: Portfolio[];
  snapshots: Record<string, SnapshotState>;
  wallets: WalletsOverview | null;
  onOpenPortfolios?: () => void;
  onOpenPortfolio?: (uuid: string) => void;
  onOpenWallets?: () => void;
  onOpenWallet?: (id: string) => void;
}) {
  const moves = useRecentMoves(portfolio.uuid);
  const { sample } = useWallets();
  const currency = snapshot?.currency ?? wallets?.currency ?? "EUR";
  const investments = snapshot?.totalMarketValue ?? 0;
  const walletsCounted = wallets && wallets.currency === currency ? wallets.balance ?? 0 : 0;
  const total = investments + walletsCounted;
  const shareOf = (value: number) => (total > 0 ? Math.max(0, (value / total) * 100) : 0);
  const pnlPct = snapshot ? unrealizedPct(snapshot) : null;

  const portfolioRows = members.map((p, i) => {
    const state = snapshots[p.uuid] ?? { status: "loading" as const };
    return { portfolio: p, state, own: state.status === "ready" ? state.snapshot : null, shade: shadeOf(GOLD_SHADES, i) };
  });
  const walletRows = (wallets?.wallets ?? []).map((w, i) => ({ wallet: w, shade: shadeOf(TEAL_SHADES, i) }));

  // The bar, piece by piece: each portfolio's own value while they're all in, else the group as
  // one piece; then each wallet with money in it.
  const allIn = portfolioRows.length > 0 && portfolioRows.every((r) => r.state.status === "ready");
  const segments = [
    ...(allIn
      ? portfolioRows.filter((r) => r.own && r.own.currency === currency).map((r) => ({ key: r.portfolio.uuid, label: r.portfolio.name, value: r.own!.totalMarketValue, color: r.shade }))
      : [{ key: "investments", label: "Investments", value: investments, color: GOLD }]),
    ...(walletsCounted !== 0
      ? walletRows.filter((r) => r.wallet.currency === currency).map((r) => ({ key: r.wallet.id, label: r.wallet.name, value: r.wallet.balance, color: r.shade }))
      : []),
  ].filter((s) => s.value > 0);

  return (
    <Module>
      <div className="p-6 md:p-7 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C]">Net worth · {currency}</p>
            <p className="text-4xl md:text-5xl font-black text-slate-900 tabular-nums mt-1.5" style={serif}>
              {formatCurrency(total, currency, 0)}
            </p>
            <p className="text-[13px] text-slate-500 mt-1.5">
              {snapshot ? `As of ${chartDateLabel(snapshot.snapshotAt)}, from daily market prices` : "Your portfolios at today's market prices"}
              {wallets && ", plus your wallets' balance"}.
            </p>
          </div>
          {snapshot && moves && (
            <dl className="flex gap-6">
              <Move label="Today" amount={moves.dayMarketEffect} pct={moves.previousDayValue !== 0 ? moves.dayMarketEffectPct : null} currency={moves.currency} />
              <Move label="This month" amount={moves.mtdMarketEffect} pct={moves.monthStartValue !== 0 ? moves.mtdMarketEffectPct : null} currency={moves.currency} />
            </dl>
          )}
        </div>

        {segments.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex h-3 gap-0.5 rounded-full overflow-hidden">
              {segments.map((s) => (
                <div key={s.key} title={`${s.label} · ${shareOf(s.value).toFixed(0)}%`} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${shareOf(s.value)}%`, background: s.color }} />
              ))}
            </div>
            {wallets && walletsCounted !== 0 && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold text-slate-600">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: GOLD }} />Investments {shareOf(investments).toFixed(0)}%</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: TEAL }} />Wallets {shareOf(walletsCounted).toFixed(0)}%</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`grid grid-cols-1 ${wallets ? "lg:grid-cols-2 lg:divide-x" : ""} divide-y lg:divide-y-0 divide-slate-100 border-t border-slate-100`}>
        <GroupColumn
          title="Investments"
          color={GOLD}
          value={snapshot ? formatCurrency(snapshot.totalMarketValue, snapshot.currency, 0) : null}
          pending={portfolio.isAggregate
            ? "The combined figures across your portfolios are being prepared. Check back in a few minutes."
            : "No transactions yet: add some to see what your portfolio is worth."}
          summary={snapshot && <><Delta amount={snapshot.totalUnrealizedPnl} pct={pnlPct} currency={snapshot.currency} /> unrealized</>}
          onOpen={onOpenPortfolios}
        >
          {portfolioRows.map(({ portfolio: p, state, own, shade }) => (
            <GroupRow
              key={p.uuid}
              color={shade}
              name={p.name}
              share={own && own.currency === currency ? shareOf(own.totalMarketValue) : null}
              value={own ? formatCurrency(own.totalMarketValue, own.currency, 0) : state.status === "loading" ? "…" : "—"}
              delta={own ? <Delta amount={null} pct={unrealizedPct(own)} currency={own.currency} /> : null}
              onOpen={onOpenPortfolio ? () => onOpenPortfolio(p.uuid) : undefined}
            />
          ))}
        </GroupColumn>
        {wallets && (
          <GroupColumn
            title="Wallets"
            color={TEAL}
            badge={sample ? <PreviewBadge label="Sample data" /> : undefined}
            value={wallets.balance === null ? "—" : formatCurrency(wallets.balance, wallets.currency, 0)}
            summary={
              <>
                <span className="text-emerald-600">+{formatCurrency(wallets.income, wallets.currency, 0)}</span> in
                <span className="text-slate-300"> · </span>
                <span className="text-rose-600">−{formatCurrency(wallets.expenses, wallets.currency, 0)}</span> out this month
              </>
            }
            onOpen={onOpenWallets}
          >
            {walletRows.map(({ wallet: w, shade }) => (
              <GroupRow
                key={w.id}
                color={shade}
                name={w.name}
                share={walletsCounted !== 0 && w.currency === currency ? shareOf(w.balance) : null}
                value={formatCurrency(w.balance, w.currency, 0)}
                negative={w.balance < 0}
                delta={<Delta amount={w.net} pct={null} currency={w.currency} />}
                onOpen={onOpenWallet ? () => onOpenWallet(w.id) : undefined}
              />
            ))}
          </GroupColumn>
        )}
      </div>
    </Module>
  );
}

// Each group's colour, and the shades its members take in order: light to dark, so neighbours
// in the bar stay apart.
const GOLD = "#C49A3C";
const TEAL = "#0f766e";
const GOLD_SHADES = ["#8A6A28", "#C49A3C", "#E0BE72", "#A8813A", "#EDD5A2", "#6B5220"];
const TEAL_SHADES = ["#0b5750", "#0f766e", "#2ea99b", "#79cbbf", "#134e4a"];
const shadeOf = (shades: string[], i: number) => shades[i % shades.length];
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
 * GROUP COLUMN — one kind of asset under the net worth: its head (name, total, a line about it,
 * opening its page in Wealth), then its rows. `value` null: nothing to show yet, `pending` says why.
 */
function GroupColumn({
  title, color, badge, value, pending, summary, onOpen, children,
}: {
  title: string;
  color: string;
  badge?: React.ReactNode;
  value: string | null;
  pending?: string;
  summary?: React.ReactNode;
  onOpen?: () => void;
  children: React.ReactNode;
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
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
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
      <ul className="px-3 md:px-4 pb-3 border-t border-slate-100 pt-1.5">{children}</ul>
    </div>
  );
}

/** One portfolio or wallet in its column: name, share of the net worth, value, how it's doing. */
function GroupRow({
  color, name, share, value, negative = false, delta, onOpen,
}: {
  color: string;
  name: string;
  // Its share of the whole net worth, in percent; null when it isn't counted in it.
  share: number | null;
  value: string;
  negative?: boolean;
  delta: React.ReactNode;
  onOpen?: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="w-full grid grid-cols-[minmax(0,1fr)_2.75rem_6.5rem_5.5rem] items-center gap-2 rounded-xl px-3 py-2.5 text-left enabled:hover:bg-slate-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: color }} />
          <span className="text-[13px] font-bold text-slate-800 truncate">{name}</span>
        </span>
        <span className="text-[11px] font-bold text-slate-400 tabular-nums text-right">{share === null ? "" : `${share.toFixed(0)}%`}</span>
        <span className={`text-[13px] font-black tabular-nums text-right ${negative ? "text-rose-600" : "text-slate-900"}`}>{value}</span>
        <span className="text-[11px] text-right truncate">{delta}</span>
      </button>
    </li>
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
 * dial until the user asks for all of them. With no rules it isn't shown at all.
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

  // Only there when there's something to show: no alerts (or none loaded yet, or a failed
  // request) means no module at all. They're set up on each portfolio's page (Portfolios).
  if (loading || error || sorted.length === 0) return null;

  return (
    <Module>
      <ModuleHead
        eyebrow="Alerts"
        title="Your alerts"
        desc="How close each alert is to its limit. Checked about every 5 minutes."
        right={onManage && (
          <button
            onClick={onManage}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 border border-slate-200 hover:border-[#C49A3C] hover:text-[#C49A3C] transition-colors"
          >
            Manage alerts
          </button>
        )}
      />
      <div className="p-6 md:p-7 space-y-5">
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-bold text-slate-600">
          {counts.map((g) => (
            <li key={g.tone} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${g.dot}`} />
              {g.count} {g.label}
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
    </Module>
  );
}

/**
 * MODULE — the card shell every group of related content lives in.
 */
function Module({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
      {children}
    </section>
  );
}

function ModuleHead({
  eyebrow, title, desc, right,
}: {
  eyebrow: string; title: string; desc?: string; right?: React.ReactNode;
}) {
  return (
    <div className="p-6 md:p-7 pb-5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-6">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">{eyebrow}</p>
        <h2
          className="text-lg md:text-xl font-black text-slate-900"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {title}
        </h2>
        {desc && <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">{desc}</p>}
      </div>
      {right}
    </div>
  );
}
