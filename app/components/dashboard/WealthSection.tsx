// components/dashboard/WealthSection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePortfolio } from "../../context/PortfolioContext";
import { useUser } from "../../context/UserContext";
import { portfoliosService } from "../../services/portfoliosService";
import { transactionService } from "../../services/transactionService";
import { reportService } from "../../services/reportService";
import { usePortfoliosAlertRules } from "../../hooks/useAlertRules";
import { CATEGORICAL_PALETTE, portfolioColorMap } from "../../lib/chartColors";
import { formatCompact, formatCurrency } from "../../lib/format";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";
import { PLAN_SECTION, WEALTH_SECTION, openClientPage, openPlanPage } from "../../lib/dashboardNav";
import { useMyPublications } from "../../hooks/useMyPublications";
import { publicationService } from "../../services/publicationService";
import { PublishStrategyDialog } from "./PublishStrategyDialog";
import { investmentsOf, isBacktest, type Portfolio } from "../../models/Portfolio";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";
import { PerformanceSection, Module, ModuleHead, MODULE_BODY, Figs, Fig, HBars } from "./PerformanceSection";
import { PageHeader, type PageAction, type PageCounter, type PageFigure } from "./PageHeader";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { FileUploader } from "./FileUploader";
import { AlertsSettings } from "./AlertsSettings";
import { ReportsBrowser } from "./ReportsBrowser";
import { ComparisonView, initialCompareSelection, rememberCompareSelection, MAX_COMPARED } from "./ComparisonView";
import { ManagePortfolios } from "./ManagePortfolios";
import { AssetCategoriesEditor } from "./AssetCategoriesEditor";
import { NewPortfolioDialog } from "./NewPortfolioDialog";
import { RenamePortfolioDialog } from "./RenamePortfolioDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { AdoptStrategyDialog } from "./AdoptStrategyDialog";
import { AdoptedStrategyView } from "./AdoptedStrategyView";
import { adoptionService } from "../../services/adoptionService";
import { BacktestBanner } from "./BacktestMarks";
import { ReadOnlySimulation } from "./ReadOnlySimulation";
import type { SharedStrategy } from "../../models/AdoptedStrategy";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";
import { PreviewBadge } from "../preview/PreviewKit";
import { useWallets } from "../../context/WalletsContext";
import { useWalletsOverview } from "../../hooks/useWalletsOverview";
import { ALL_WALLETS, monthLabel, savingsRate as walletsSavingsRate } from "../../lib/wallets";
import { WalletNode, type WalletPage } from "./wallets/WalletNode";
import { WalletFormDialog } from "./wallets/WalletDialogs";
import { useRealEstate, useRealEstateOverview } from "../../context/RealEstateContext";
import { RealEstateNode, type RealEstatePage } from "./realEstate/RealEstateNode";
import { RealEstateTransactionDialog } from "./realEstate/RealEstateTransactionForm";

// A portfolio's pages: its own (overview), and those its header leads to.
export type PortfolioPage = "overview" | "transactions" | "alerts" | "reports" | "compare" | "portfolios" | "categories" | "strategy";

export type WealthView =
  // Everything the user owns: investments and wallets. Where there are no wallets to have (a
  // client's Wealth, a backend without them), Wealth opens straight on the investments.
  | { kind: "root" }
  // A portfolio, "All portfolios" (the investments) included. A strategy's backtest is Plan's.
  // `simulation`: on its Strategy page, the advisor's strategy portfolio a shared strategy came
  // from, opened read-only.
  | { kind: "portfolio"; uuid: string; page: PortfolioPage; simulation?: string }
  // A wallet, or every wallet together (ALL_WALLETS). A demo account's are sample data.
  | { kind: "wallet"; id: string; page: WalletPage }
  // The real estate: every property together, or one (`property`, its page or its transactions).
  // A demo account's are sample data.
  | { kind: "realEstate"; page: RealEstatePage; property?: string };

const NO_SCOPE: Record<string, string> = {};
const NO_TRAIL: Crumb[] = [];
const PORTFOLIO_PAGES: PortfolioPage[] = ["overview", "transactions", "alerts", "reports", "compare", "portfolios", "categories", "strategy"];
const PAGE_LABELS: Record<Exclude<PortfolioPage, "overview">, string> = {
  transactions: "Transactions",
  alerts: "Alerts",
  reports: "Reports",
  compare: "Compare",
  portfolios: "Manage portfolios",
  categories: "Asset categories",
  strategy: "Strategy",
};

// The fields every view of one Wealth carries, beside its own: a client's (`{ client }`).
type WealthScope = Record<string, string>;

const inScope = (view: unknown, scope: WealthScope) =>
  typeof view === "object" && view !== null && Object.entries(scope).every(([k, v]) => (view as Record<string, unknown>)[k] === v);

/**
 * The page the current history entry was on, read for this account (and this scope). `hasRoot`:
 * Wealth itself is a page, with the wallets under it; `hasRealEstate`: the real estate too.
 */
function viewFromHistory(hasRealEstate: boolean, hasRoot: boolean, portfolios: Portfolio[], section: string, scope: WealthScope): WealthView {
  const entry = readDashboardEntry();
  const raw = entry?.section === section && inScope(entry.view, scope) ? entry.view : undefined;
  // A scope's own fields alone (a client opened on no page) are no page.
  const view = (raw && "kind" in (raw as object) ? raw : undefined) as (WealthView | { kind: string; [k: string]: unknown }) | undefined;
  const investments = investmentsOf(portfolios);
  const top: WealthView = hasRoot ? { kind: "root" } : { kind: "portfolio", uuid: investments?.uuid ?? "", page: "overview" };
  if (!view) return top;
  switch (view.kind) {
    case "root":
      return top;
    case "portfolio": {
      const v = view as { uuid?: string; page?: string; simulation?: unknown };
      // A portfolio had tabs (`tab`), then Insights as its first page, before its own page.
      const page = PORTFOLIO_PAGES.includes(v.page as PortfolioPage) ? (v.page as PortfolioPage) : "overview";
      // No portfolio named (""): the investments, on that page (a link from outside, which
      // doesn't know which portfolio stands for them).
      if (v.uuid === "" && investments) return { kind: "portfolio", uuid: investments.uuid, page };
      if (!portfolios.some((p) => p.uuid === v.uuid)) return top;
      return page === "strategy" && typeof v.simulation === "string"
        ? { kind: "portfolio", uuid: v.uuid!, page, simulation: v.simulation }
        : { kind: "portfolio", uuid: v.uuid!, page };
    }
    // Investments' own pages before they were the investments' (Manage / Investments / Alerts…).
    case "investments":
    case "transactions":
    case "reports":
    case "alerts":
    case "compare":
    case "portfolios": {
      if (!investments) return top;
      const page = view.kind === "investments" ? "overview" : (view.kind as PortfolioPage);
      return { kind: "portfolio", uuid: investments.uuid, page };
    }
    case "wallets":
      return hasRoot ? { kind: "wallet", id: ALL_WALLETS, page: "insights" } : top;
    case "wallet": {
      // A wallet that's gone opens every wallet (see WalletNode).
      const v = view as { id?: string; page?: WalletPage };
      return hasRoot && typeof v.id === "string" ? { kind: "wallet", id: v.id, page: v.page ?? "insights" } : top;
    }
    case "realEstate": {
      // A property that's gone opens the real estate's own page (see RealEstateNode).
      const v = view as { page?: RealEstatePage; property?: unknown };
      if (!hasRealEstate) return top;
      return typeof v.property === "string"
        ? { kind: "realEstate", page: v.page ?? "home", property: v.property }
        : { kind: "realEstate", page: v.page ?? "home" };
    }
    default:
      // Manage's hub, Strategy and Explore (now Plan's), anything older.
      return top;
  }
}

/**
 * WEALTH SECTION (investor; "performance" in the sidebar's ids) — everything the user owns, as
 * pages to go down through, each one the place to act on what it shows. It opens on Wealth itself
 * (WealthRoot: investments and wallets together); a client's Wealth, which has no wallets, on the
 * investments, which are "All portfolios" while they have two or more, otherwise their only portfolio.
 *
 * A portfolio's page (PortfolioNode) is its header (value, activity, actions, key figures) over
 * its Insights (PerformanceSection), whose Composition leads down to each portfolio (from All
 * portfolios) or holding. Its activity and its actions open pages of its own, always on that
 * portfolio, so none of them asks which one: Transactions, Alerts and Reports, and on All
 * portfolios Compare and Manage portfolios. A strategy's backtest opens the same page in Plan, under
 * Strategy (a link to one here goes there). The wallets are WalletNode's pages, the real estate
 * RealEstateNode's; a demo account's are sample data.
 *
 * Every page is a browser history entry, so back and forward move between them (see
 * lib/dashboardHistory). Opening a portfolio also makes it the selected one (PortfolioContext).
 *
 * An advisor's client's Wealth is the same pages (see ClientsSection): in the Clients section, each
 * view carrying the client (`scope`), under the client's crumbs (`rootTrail`), on that client's
 * portfolios (a PortfolioProvider of theirs), with no previews.
 */
export function WealthSection({ onNavigate, section = WEALTH_SECTION, scope = NO_SCOPE, rootTrail: outerTrail = NO_TRAIL, extraActions }: {
  onNavigate: (section: string) => void;
  section?: string;
  scope?: WealthScope;
  rootTrail?: Crumb[];
  // Added to the investments' actions: a client's own (their settings).
  extraActions?: PageAction[];
}) {
  const { portfolios, selectPortfolio, client } = usePortfolio();
  const { isDemo: demoAccount } = useUser();
  const { available: walletsAvailable } = useWallets();
  const { available: realEstateAvailable } = useRealEstate();
  // Wealth itself, the wallets and the real estate are any investor's own, not a client's.
  const hasRoot = !client && (demoAccount || walletsAvailable);
  const hasRealEstate = hasRoot && realEstateAvailable;
  const [view, setView] = useState<WealthView>(() => viewFromHistory(hasRealEstate, hasRoot, portfolios, section, scope));

  useEffect(() => {
    // Record the page it opened on, so the Sidebar marks it.
    const entry = readDashboardEntry();
    if (entry?.section === section && !(entry.view && "kind" in (entry.view as object))) pushDashboardEntry({ section, view: { ...scope, ...view } }, true);
    const onPopState = () => {
      const current = readDashboardEntry();
      if (current?.section !== section || !inScope(current.view ?? {}, scope)) return;
      const next = viewFromHistory(hasRealEstate, hasRoot, portfolios, section, scope);
      setView((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // Once: a new list of portfolios is read on the next back / forward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (next: WealthView) => {
    if (next.kind === "portfolio") selectPortfolio(next.uuid);
    pushDashboardEntry({ section, view: { ...scope, ...next } });
    setView(next);
    window.scrollTo({ top: 0 });
  };
  const openPortfolio = (uuid: string, page: PortfolioPage = "overview") => go({ kind: "portfolio", uuid, page });

  const investments = investmentsOf(portfolios);
  // Wealth itself is a page only where there's more than the investments (the wallets).
  const rootTrail: Crumb[] = hasRoot ? [{ label: "Wealth", onClick: () => go({ kind: "root" }) }] : outerTrail;

  if (view.kind === "root" && hasRoot) {
    return <WealthRoot investments={investments} onOpen={go} />;
  }

  if (view.kind === "wallet" && hasRoot) {
    return <WalletNode key={view.id} id={view.id} page={view.page} rootTrail={rootTrail} onOpen={(id, page) => go({ kind: "wallet", id, page })} />;
  }

  if (view.kind === "realEstate" && hasRealEstate) {
    return (
      <RealEstateNode
        page={view.page}
        property={view.property}
        rootTrail={rootTrail}
        onOpen={(page, property) => go(property ? { kind: "realEstate", page, property } : { kind: "realEstate", page })}
      />
    );
  }

  const portfolio = (view.kind === "portfolio" && portfolios.find((p) => p.uuid === view.uuid)) || investments;
  if (!portfolio) return null;
  const page = view.kind === "portfolio" && view.uuid === portfolio.uuid ? view.page : "overview";
  const simulation = view.kind === "portfolio" && view.uuid === portfolio.uuid ? view.simulation : undefined;
  // A backtest is a simulation, not something owned: it's Plan's (see BacktestRedirect).
  if (isBacktest(portfolio)) {
    return <BacktestRedirect uuid={portfolio.uuid} transactions={page === "transactions"} onNavigate={onNavigate} />;
  }

  // The pages above it: a portfolio sits under All portfolios.
  const aggregate = portfolios.find((p) => p.isAggregate);
  const trail: Crumb[] = portfolio.uuid === investments?.uuid || !aggregate
    ? rootTrail
    : [...rootTrail, { label: aggregate.name, onClick: () => openPortfolio(aggregate.uuid) }];

  return (
    <PortfolioNode
      key={portfolio.uuid}
      portfolio={portfolio}
      page={page}
      trail={trail}
      isInvestments={portfolio.uuid === investments?.uuid}
      extraActions={portfolio.uuid === investments?.uuid ? extraActions : undefined}
      onOpen={openPortfolio}
      simulation={simulation}
      onOpenSimulation={(uuid) => go({ kind: "portfolio", uuid: portfolio.uuid, page: "strategy", simulation: uuid })}
      onOpenRealEstate={hasRealEstate ? () => go({ kind: "realEstate", page: "home" }) : undefined}
      onNavigate={onNavigate}
    />
  );
}

/**
 * A link to a backtest in Wealth (from before it moved, from history, from the Dashboard's
 * selected portfolio): opens it in Plan instead, in place of this entry, so back doesn't land
 * here again only to be sent back to Plan.
 */
function BacktestRedirect({ uuid, transactions, onNavigate }: { uuid: string; transactions: boolean; onNavigate: (section: string) => void }) {
  useEffect(() => {
    pushDashboardEntry({ section: PLAN_SECTION, view: { page: "backtest", uuid, sub: transactions ? "transactions" : "overview" } }, true);
    onNavigate(PLAN_SECTION);
  }, [uuid, transactions, onNavigate]);
  return null;
}

// ── A portfolio's page ────────────────────────────────────────────────────────────────────

const pct = (v: number, digits = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
const toneOf = (v: number | null | undefined): "gain" | "loss" | undefined => (v == null || v === 0 ? undefined : v > 0 ? "gain" : "loss");

/** One portfolio's side-by-side figures (GET /v1/portfolios/comparison), for its header. */
function useComparisonEntry(uuid: string) {
  const { client } = usePortfolio();
  const clientUuid = client?.uuid ?? null;
  const [entry, setEntry] = useState<{ uuid: string; value: PortfolioComparisonEntry | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    portfoliosService.compare([uuid], clientUuid)
      .then((list) => { if (!cancelled) setEntry({ uuid, value: list[0] ?? null }); })
      .catch(() => { if (!cancelled) setEntry({ uuid, value: null }); });
    return () => { cancelled = true; };
  }, [uuid, clientUuid]);
  // undefined while loading, null when it couldn't be read.
  return entry?.uuid === uuid ? entry.value : undefined;
}

/**
 * Whether a strategy is adopted on the portfolio (GET .../adopted-strategy), and the strategies the
 * user's advisor shared for it (GET .../shared-strategies: All portfolios' are its own, as it adopts its own),
 * for its header's way to its Strategy page: undefined while loading or for a backtest, which can't
 * adopt one. `reload` after a change.
 */
function useHasAdoption(portfolio: Portfolio) {
  const backtest = isBacktest(portfolio);
  const [state, setState] = useState<{ uuid: string; has: boolean; shared: SharedStrategy[] } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (backtest) return;
    let cancelled = false;
    Promise.all([
      adoptionService.get(portfolio.uuid).catch(() => null),
      adoptionService.listShared(portfolio.uuid).catch(() => [] as SharedStrategy[]),
    ]).then(([adoption, shared]) => {
      if (!cancelled) setState({ uuid: portfolio.uuid, has: adoption !== null, shared });
    });
    return () => { cancelled = true; };
  }, [portfolio.uuid, backtest, reloadKey]);
  const current = state?.uuid === portfolio.uuid ? state : undefined;
  return { hasAdoption: current?.has, shared: current?.shared ?? [], reload: () => setReloadKey((k) => k + 1) };
}

/**
 * How much activity a portfolio has, for its header's counters: its transactions (All portfolios'
 * read every portfolio's), its alert rules and theirs (All portfolios' own, then every
 * portfolio's) and its reports (every real portfolio's on All portfolios, which takes none).
 */
function useActivityCounts(portfolio: Portfolio, real: Portfolio[]) {
  const backtest = isBacktest(portfolio);
  const ruleScope = backtest ? [] : portfolio.isAggregate ? [portfolio.uuid, ...real.map((p) => p.uuid)] : [portfolio.uuid];
  const reportScope = backtest ? [] : portfolio.isAggregate ? real.map((p) => p.uuid) : [portfolio.uuid];
  const reportKey = reportScope.join(",");
  const { rules } = usePortfoliosAlertRules(ruleScope);
  const [transactions, setTransactions] = useState<{ uuid: string; total: number | null } | null>(null);
  const [reports, setReports] = useState<{ key: string; total: number | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    transactionService.getUserTransactions(portfolio.uuid, 1, 0)
      .then((r) => { if (!cancelled) setTransactions({ uuid: portfolio.uuid, total: r.total }); })
      .catch(() => { if (!cancelled) setTransactions({ uuid: portfolio.uuid, total: null }); });
    return () => { cancelled = true; };
  }, [portfolio.uuid]);

  useEffect(() => {
    if (!reportKey) return;
    let cancelled = false;
    Promise.allSettled(reportKey.split(",").map((u) => reportService.getAllDocuments(u))).then((results) => {
      if (cancelled) return;
      const loaded = results.filter((r) => r.status === "fulfilled");
      setReports({ key: reportKey, total: loaded.length ? loaded.reduce((sum, r) => sum + r.value.length, 0) : null });
    });
    return () => { cancelled = true; };
  }, [reportKey]);

  return {
    transactions: transactions?.uuid === portfolio.uuid ? transactions.total : null,
    rules: rules === null ? null : rules.length,
    triggered: rules === null ? 0 : rules.filter((r) => r.enabled && r.isTriggered).length,
    reports: reports?.key === reportKey ? reports.total : null,
  };
}

/**
 * PORTFOLIO NODE — a portfolio's page in Wealth (a backtest's in Plan, under Strategy), or one of
 * the pages its header leads to. Its header says what it's worth and how it moved, counts its
 * activity (each count opens its page) and holds what can be done with it:
 * - All portfolios: Manage portfolios, Compare, and a new portfolio while it's Wealth's first page
 *   (with a Wealth page above it, that's where one is added). It's read only: its transactions
 *   list every portfolio's, and a new one says which it goes in.
 * - a portfolio: its Transactions, Alerts and Reports, rename, delete (not the default one).
 * - a backtest: adopt its strategy, delete. Its figures are a simulation's (returns and risk over
 *   its run), its transactions generated and read only, and its Insights leave out what a
 *   simulation doesn't have (see PerformanceSection's `backtest`).
 * Under the header, its Insights (PerformanceSection), whose Composition opens each portfolio of
 * All portfolios. A demo account sees everything but can't change anything. An advisor on a
 * client's (PortfolioContext's `client`) can't rename or delete it; its alerts are the advisor's,
 * its asset categories the client's, and its Strategy page says whether the client sees it.
 */
export function PortfolioNode({ portfolio, page, trail, isInvestments, extraActions = [], onOpen, simulation, onOpenSimulation, onOpenRealEstate, onBacktestGone, onNavigate }: {
  portfolio: Portfolio;
  page: PortfolioPage;
  trail: Crumb[];
  // It stands for all the investments ("All portfolios", or the only portfolio).
  isInvestments: boolean;
  // Added to its actions, last.
  extraActions?: PageAction[];
  onOpen: (uuid: string, page?: PortfolioPage) => void;
  // On its Strategy page: the advisor's simulation a shared strategy came from, open read-only,
  // and the way to open one.
  simulation?: string;
  onOpenSimulation?: (uuid: string) => void;
  // The investor's real estate, where it's theirs to see: Compare then offers it as a column.
  onOpenRealEstate?: () => void;
  // A backtest's page (Plan's): where to go once it's deleted. Strategy by default.
  onBacktestGone?: () => void;
  onNavigate: (section: string) => void;
}) {
  const { portfolios, deletePortfolio, client, canManage } = usePortfolio();
  const { isDemo } = useUser();
  const colorOf = useMemo(() => portfolioColorMap(portfolios), [portfolios]);
  const real = useMemo(() => portfolios.filter((p) => !p.isVirtual).sort((a, b) => Number(b.isDefault) - Number(a.isDefault)), [portfolios]);
  const backtest = isBacktest(portfolio);
  const entry = useComparisonEntry(portfolio.uuid);
  const counts = useActivityCounts(portfolio, real);
  const { hasAdoption, shared, reload: reloadAdoption } = useHasAdoption(portfolio);
  // An advisor reaches a client's portfolio's Strategy page with or without one: it's where theirs is adopted.
  const strategyAction: PageAction[] = hasAdoption || shared.length > 0 || client ? [{ label: "Strategy", onClick: () => open("strategy") }] : [];
  const openCategories = () => {
    const investments = investmentsOf(portfolios);
    if (investments) onOpen(investments.uuid, "categories");
  };
  const [dialog, setDialog] = useState<"new" | "rename" | "delete" | "adopt" | "publish" | "withdraw" | null>(null);
  // An advisor's backtest: whether it's in Explore.
  const { publications, reload: reloadPublications, canPublish } = useMyPublications();
  const publication = backtest ? publications?.get(portfolio.uuid) : undefined;
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>(() => initialCompareSelection(portfolios, null));
  // Bumped to start the page over (back at the top, any detail closed) from its own crumb.
  const [visit, setVisit] = useState(0);

  const open = (next: PortfolioPage) => onOpen(portfolio.uuid, next);
  const nodeCrumb: Crumb = {
    label: portfolio.name,
    onClick: () => {
      if (page !== "overview") open("overview");
      else {
        setVisit((n) => n + 1);
        window.scrollTo({ top: 0 });
      }
    },
  };
  const demo = isDemo ? { disabled: true, title: DEMO_DISABLED_TITLE } : {};
  // New portfolios (and wallets) are added on Wealth's first page: Wealth itself where it's a page
  // (an investor's own, with wallets), otherwise the investments.
  const { available: walletsAvailable } = useWallets();
  const addsPortfolios = isInvestments && !(!client && (isDemo || walletsAvailable));

  // ── What can be done with it ──
  const actions: PageAction[] = backtest
    ? [
        { label: canPublish ? "Adopt on a client" : "Adopt this strategy", primary: true, onClick: () => setDialog("adopt"), ...demo },
        ...(canPublish ? publication
          ? [
              { label: "Edit the publication", onClick: () => setDialog("publish") },
              { label: "Withdraw from Explore", onClick: () => { setWithdrawError(null); setDialog("withdraw"); } },
            ]
          : [{ label: "Publish to Explore", onClick: () => setDialog("publish"), ...(publications === undefined ? { disabled: true } : {}) }]
          : []),
        { label: "Delete backtest", danger: true, onClick: () => setDialog("delete"), ...demo },
      ]
    : portfolio.isAggregate
      ? [
          { label: "Manage portfolios", primary: true, onClick: () => open("portfolios") },
          ...(addsPortfolios ? [{ label: "New portfolio", onClick: () => setDialog("new") }] : []),
          ...(real.length > 1 ? [{ label: "Compare", onClick: () => open("compare") }] : []),
          ...strategyAction,
          { label: "Asset categories", onClick: () => open("categories") },
          ...extraActions,
        ]
      : [
          // Its activity pages: what's there, and where to add to it.
          { label: "Transactions", primary: true, plus: false, onClick: () => open("transactions") },
          { label: "Alerts", onClick: () => open("alerts") },
          ...strategyAction,
          { label: "Reports", onClick: () => open("reports") },
          // The only portfolio stands for the investments: the way to a second one is here, and to
          // the categories of everything held.
          ...(addsPortfolios ? [{ label: "New portfolio", onClick: () => setDialog("new") }] : []),
          ...(isInvestments ? [{ label: "Asset categories", onClick: () => open("categories") }] : []),
          ...extraActions,
          ...(canManage ? [
            { label: "Rename", onClick: () => setDialog("rename"), ...demo },
            {
              label: "Delete portfolio",
              danger: true,
              onClick: () => setDialog("delete"),
              ...(portfolio.isDefault ? { disabled: true, title: "The default portfolio can't be deleted" } : demo),
            },
          ] : []),
        ];

  // ── Its activity ──
  const counters: PageCounter[] = [
    { key: "transactions", label: "transactions", count: counts.transactions, onClick: () => open("transactions") },
    ...(backtest ? [] : [
      { key: "alerts", label: "alerts", count: counts.rules, attention: { count: counts.triggered, label: "triggered" }, onClick: () => open("alerts") },
      { key: "reports", label: "reports", count: counts.reports, onClick: () => open("reports") },
    ]),
  ];

  // ── Its key figures, from the comparison ──
  const currency = entry?.value?.currency ?? "EUR";
  const money = (v: number | null | undefined) => (v == null ? "—" : formatCurrency(v, currency, 0));
  // Each figure is shown once on the page: the header holds what no module below does — what it's
  // worth, what went in, what the holdings still owned have gained, and what it has made in all —
  // and the modules hold the rest (returns, risk, realized P&L, costs).
  const value = entry?.value ?? null;
  // Everything made, sold or not: the value now, less what was put in (buys less sale proceeds),
  // plus the dividends paid out along the way, against what was put in.
  const roi = value && value.netContributed > 0
    ? ((value.marketValue - value.netContributed + value.dividendIncome) / value.netContributed) * 100
    : null;
  const unrealized = value?.unrealizedPnl ?? null;
  // A backtest's value and unrealized P&L are a simulation's end point, not anything held: its
  // header keeps what went in and what that made.
  // How long the simulation runs, back from its last valuation: what gives its return a scale.
  const days = entry?.performance?.lifespanDays ?? null;
  const period: PageFigure | null = backtest && days !== null && days > 0 ? {
    label: "Period",
    value: days >= 365 ? `${(days / 365.25).toFixed(1)} years` : `${Math.round(days / 30.44)} months`,
  } : null;
  const figures: PageFigure[] = entry === undefined ? [] : [
    ...(period ? [period] : []),
    ...(backtest ? [] : [{ label: "Value", value: money(value?.marketValue) }]),
    { label: "Invested", value: money(value?.netContributed) },
    ...(backtest ? [] : [{
      label: "Unrealized P&L",
      value: unrealized === null ? "—" : `${unrealized >= 0 ? "+" : ""}${money(unrealized)}`,
      tone: toneOf(unrealized),
    }]),
    { label: "ROI", value: roi === null ? "—" : pct(roi), tone: toneOf(roi) },
  ];

  const note = portfolio.isAggregate ? `${real.length} portfolios` : undefined;

  const header = (
    <PageHeader
      eyebrow={`${client ? `${client.name} · ` : ""}${backtest ? "Backtest" : portfolio.isAggregate || isInvestments ? "Investments" : "Portfolio"}`}
      notice={backtest ? <BacktestBanner portfolioUuid={portfolio.uuid} /> : undefined}
      title={portfolio.name}
      note={note}
      counters={counters}
      actions={actions}
      figures={figures}
    />
  );

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const left = await deletePortfolio(portfolio.uuid);
      setDialog(null);
      if (backtest) (onBacktestGone ?? (() => openPlanPage(onNavigate, "strategy")))();
      else {
        // From the list as it is now: deleting the second-to-last portfolio takes All portfolios
        // with it, and opening that would select a portfolio that's gone (a blank page).
        const next = investmentsOf(left);
        if (next) onOpen(next.uuid);
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : `Unable to delete this ${backtest ? "backtest" : "portfolio"}.`);
    } finally {
      setDeleting(false);
    }
  };

  const dialogs = (
    <>
      {dialog === "new" && <NewPortfolioDialog onClose={() => setDialog(null)} />}
      {dialog === "rename" && <RenamePortfolioDialog portfolio={portfolio} onClose={() => setDialog(null)} />}
      {dialog === "adopt" && (
        <AdoptStrategyDialog
          strategyUuid={portfolio.uuid}
          strategyName={portfolio.name}
          onClose={() => setDialog(null)}
          onAdopted={(uuid, clientUuid) => {
            setDialog(null);
            if (clientUuid) openClientPage(onNavigate, clientUuid, { kind: "portfolio", uuid, page: "strategy" });
            else onOpen(uuid, "strategy");
          }}
          onOpenCategories={(clientUuid) => {
            setDialog(null);
            if (clientUuid) openClientPage(onNavigate, clientUuid, { kind: "portfolio", uuid: "", page: "categories" });
            else openCategories();
          }}
        />
      )}
      {dialog === "publish" && (
        <PublishStrategyDialog
          backtest={portfolio}
          published={publication}
          onClose={() => setDialog(null)}
          onPublished={() => {
            setDialog(null);
            reloadPublications();
          }}
        />
      )}
      {dialog === "withdraw" && publication && (
        <ConfirmDialog
          title={`Withdraw "${portfolio.name}" from Explore?`}
          description="It leaves the catalog: nobody can read it there any more. The backtest stays yours, to publish again."
          confirmLabel="Withdraw"
          confirming={deleting}
          error={withdrawError}
          onConfirm={async () => {
            setDeleting(true);
            setWithdrawError(null);
            try {
              await publicationService.withdraw(publication.publicationId);
              setDialog(null);
              reloadPublications();
            } catch (err) {
              setWithdrawError(err instanceof Error ? err.message : "Unable to withdraw this strategy.");
            } finally {
              setDeleting(false);
            }
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          title={`Delete "${portfolio.name}"?`}
          description={backtest
            ? "The backtest and its generated transactions are deleted. This can't be undone."
            : "Its transactions, insights, reports and alerts are deleted with it. This can't be undone."}
          confirming={deleting}
          error={deleteError}
          onConfirm={handleDelete}
          onClose={() => { setDialog(null); setDeleteError(null); }}
        />
      )}
    </>
  );

  if (page === "overview") {
    return (
      <>
        <PerformanceSection
          key={`${portfolio.uuid}:${visit}`}
          portfolioUuid={portfolio.uuid}
          isAggregate={portfolio.isAggregate}
          backtest={backtest}
          trail={trail}
          pageLabel={portfolio.name}
          top={header}
          onOpenPortfolio={(uuid) => onOpen(uuid)}
          onNavigate={onNavigate}
          comparison={entry ?? null}
        />
        {dialogs}
      </>
    );
  }

  const pageTrail = [...trail, nodeCrumb];
  if (page === "compare") {
    return (
      <ComparisonView
        selection={selection}
        onToggle={(uuid) => setSelection((prev) => {
          const next = prev.includes(uuid) ? prev.filter((u) => u !== uuid) : prev.length >= MAX_COMPARED ? prev : [...prev, uuid];
          rememberCompareSelection(next);
          return next;
        })}
        trail={pageTrail}
        onOpen={(uuid) => onOpen(uuid)}
        onOpenRealEstate={onOpenRealEstate}
      />
    );
  }
  if (page === "portfolios") {
    return <ManagePortfolios trail={pageTrail} onOpenPortfolio={(uuid) => onOpen(uuid)} onOpenAlerts={(uuid) => onOpen(uuid, "alerts")} />;
  }
  if (page === "strategy" && simulation) {
    return (
      <ReadOnlySimulation
        portfolioUuid={simulation}
        trail={[...pageTrail, { label: PAGE_LABELS.strategy, onClick: () => open("strategy") }]}
        eyebrow="Your advisor's simulation"
        notice={(
          <ReadOnlyNote>
            The simulation your advisor made this strategy from, shared with you to read. It can&apos;t be changed or copied.
          </ReadOnlyNote>
        )}
        onNavigate={onNavigate}
      />
    );
  }
  if (page === "strategy") {
    return (
      <AdoptedStrategyView
        key={portfolio.uuid}
        portfolio={portfolio}
        trail={pageTrail}
        shared={shared}
        onOpenSimulation={(uuid) => onOpenSimulation?.(uuid)}
        onOpenAlerts={() => open("alerts")}
        onNavigate={onNavigate}
        onChanged={reloadAdoption}
      />
    );
  }
  // The user's, whichever portfolio it's opened from: a correction holds in all of them.
  if (page === "categories") {
    return (
      <div className="space-y-6 pb-12">
        <Breadcrumb trail={pageTrail} current={PAGE_LABELS.categories} />
        <p className="text-[13px] text-slate-500 leading-relaxed max-w-3xl">
          {client
            ? `The category each of ${client.name}'s securities counts in, across all their portfolios: alerts on a category, and adopting a strategy by category, weigh a portfolio by it. A category you pick is ${client.name}'s too, everywhere, until it's restored.`
            : "The category each of your securities counts in, across all your portfolios: alerts on a category, and adopting a strategy by category, weigh a portfolio by it. Each one comes with a suggestion; a category you pick replaces it everywhere, until you restore it."}
        </p>
        <AssetCategoriesEditor clientUuid={client?.uuid} />
      </div>
    );
  }

  // Transactions, Alerts, Reports: on this portfolio. The way between them is the header's,
  // one level up.
  const alertPortfolios = (portfolio.isAggregate ? [portfolio, ...real] : [portfolio])
    .map((p) => ({ uuid: p.uuid, name: p.name, color: colorOf(p.uuid) }));
  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={pageTrail} current={PAGE_LABELS[page]} />
      {portfolio.isAggregate && page === "transactions" && (
        <ReadOnlyNote>
          {portfolio.name} reads every portfolio&apos;s transactions. A new one goes in the portfolio you pick for it; to change one, open its portfolio.
        </ReadOnlyNote>
      )}
      {portfolio.isAggregate && page === "reports" && (
        <ReadOnlyNote>Reports are made for one portfolio at a time: pick which when you generate one.</ReadOnlyNote>
      )}
      {page === "transactions" && (
        portfolio.isAggregate
          ? <FileUploader key="all" />
          : <FileUploader key={portfolio.uuid} portfolioUuid={portfolio.uuid} readOnly={backtest} />
      )}
      {page === "alerts" && (
        <AlertsSettings
          key={portfolio.uuid}
          portfolios={alertPortfolios}
          clientName={client?.name}
          grouped={portfolio.isAggregate ? true : undefined}
          onOpenCategories={openCategories}
          onOpenAdoption={(uuid) => onOpen(uuid, "strategy")}
        />
      )}
      {page === "reports" && (
        portfolio.isAggregate ? <ReportsBrowser key="all" /> : <ReportsBrowser key={portfolio.uuid} portfolioUuid={portfolio.uuid} />
      )}
    </div>
  );
}

function ReadOnlyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-[#C49A3C]/30 bg-[#C49A3C]/10 px-4 py-3 text-[13px] font-semibold text-[#8A6A28]">
      {children}
    </p>
  );
}

// ── Wealth itself ────────────────────────────────────────────────────────────────────────────

const WALLETS_COLOR = "#0f766e";
const INVESTMENTS_COLOR = "#C49A3C";
const REAL_ESTATE_COLOR = "#eb6834";

/**
 * WEALTH ROOT — everything an investor owns, the top of Wealth: the net worth, the investments
 * (All portfolios), the wallets and the real estate side by side, each opening its page, the
 * wallets' cash flow and what it's all in. New portfolios, wallets and properties are added here, at
 * the top of Wealth (a demo account, read only, can add none). The wallets and the real estate (its equity:
 * the value at the user's share less the mortgages) are added up in the user's reference currency;
 * when that isn't the investments' they're shown but not added to the net worth.
 */
function WealthRoot({ investments, onOpen }: { investments: Portfolio | undefined; onOpen: (view: WealthView) => void }) {
  const { isDemo } = useUser();
  const { sample, changed, wallets: allWallets } = useWallets();
  const { available: realEstateShown } = useRealEstate();
  const realEstate = useRealEstateOverview(realEstateShown);
  const entry = useComparisonEntry(investments?.uuid ?? "");
  const [dialog, setDialog] = useState<"portfolio" | "wallet" | "property" | null>(null);
  const overview = useWalletsOverview();
  const [hovered, setHovered] = useState<string | null>(null);
  const invested = entry?.value?.marketValue ?? null;
  const currency = entry?.value?.currency ?? overview?.currency ?? "EUR";
  const walletCount = overview?.wallets.length ?? 0;
  const walletsBalance = overview?.balance ?? 0;
  // The wallets count in the net worth when they're in its currency.
  const walletsCounted = overview && overview.currency === currency ? walletsBalance : 0;
  // The real estate's equity, likewise.
  const realEstateEquity = realEstate?.equity ?? 0;
  const realEstateCounted = realEstate && realEstate.currency === currency ? realEstateEquity : 0;
  const total = (invested ?? 0) + walletsCounted + realEstateCounted;

  const months = overview?.months ?? [];
  const recent = months.slice(-6);
  const avgSpending = recent.reduce((sum, m) => sum + m.spending, 0) / Math.max(recent.length, 1);
  const saved = walletsSavingsRate(months.slice(-1));
  const [breakdown, setBreakdown] = useState<"nav" | "class">("nav");
  const sampleNote = sample ? " · sample data" : "";
  const walletsCurrency = overview?.currency ?? currency;

  // Investments & wallets, each opening its page; or what it's all in, by asset class (the
  // investments' allocation, the wallets as cash), to read only.
  const navParts: RootPart[] = [
    ...(investments ? [{
      key: "investments",
      label: investments.isAggregate ? investments.name : "Investments",
      sub: investments.isAggregate ? "Every portfolio together" : investments.name,
      value: invested ?? 0,
      color: INVESTMENTS_COLOR,
      onOpen: () => onOpen({ kind: "portfolio", uuid: investments.uuid, page: "overview" }),
    }] : []),
    {
      key: "wallets",
      label: "All wallets",
      sub: walletCount === 0
        ? "No wallets yet: add your accounts, cards and cash"
        : `${walletCount} ${walletCount === 1 ? "wallet" : "wallets"}${walletsCounted === 0 && walletsBalance !== 0 ? ` · ${formatCurrency(walletsBalance, walletsCurrency, 0)}, not added in` : ""}${sampleNote}`,
      value: walletsCounted,
      color: WALLETS_COLOR,
      onOpen: () => onOpen({ kind: "wallet", id: ALL_WALLETS, page: "insights" }),
    },
    ...(realEstateShown ? [{
      key: "realEstate",
      label: "Real estate",
      sub: !realEstate || realEstate.propertyCount === 0
        ? realEstate === null ? "Can't be added up right now: an exchange rate is missing" : "No properties yet"
        : `${realEstate.propertyCount} ${realEstate.propertyCount === 1 ? "property" : "properties"}, equity${realEstateCounted === 0 && realEstateEquity !== 0 ? ` · ${formatCurrency(realEstateEquity, realEstate.currency, 0)}, not added in` : ""}${sampleNote}`,
      value: realEstateCounted,
      color: REAL_ESTATE_COLOR,
      onOpen: () => onOpen({ kind: "realEstate", page: "home" }),
    }] : []),
  ];
  const classParts: RootPart[] = [
    ...(entry?.allocation ?? []).map((a, i) => ({
      key: `class:${a.assetClass}`,
      label: a.assetClass,
      value: a.marketValue,
      color: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length],
    })),
    ...(walletsCounted > 0 ? [{ key: "class:cash", label: "Cash", sub: `In your wallets${sampleNote}`, value: walletsCounted, color: WALLETS_COLOR }] : []),
    ...(realEstateCounted > 0 ? [{ key: "class:realEstate", label: "Real estate", sub: `Equity in your properties${sampleNote}`, value: realEstateCounted, color: REAL_ESTATE_COLOR }] : []),
  ].sort((a, b) => b.value - a.value);
  // The largest few slices (ROOT_TOP); any others as one "N more" (named in it, to read only).
  const allParts = breakdown === "nav" ? navParts : classParts;
  const rest = allParts.slice(ROOT_TOP);
  const parts: RootPart[] = rest.length > 0
    ? [
        ...allParts.slice(0, ROOT_TOP),
        { key: "more", label: `${rest.length} more`, sub: rest.map((p) => p.label).join(", "), value: rest.reduce((sum, p) => sum + p.value, 0), color: "#d6d3d1" },
      ]
    : allParts;
  // The donut draws what's worth something (a card in debt takes no room); the list shows it all.
  const slices = parts.filter((p) => p.value > 0);
  const partsTotal = slices.reduce((sum, p) => sum + p.value, 0);
  const share = (v: number) => (partsTotal > 0 ? Math.max(0, (v / partsTotal) * 100) : 0);
  const focus = parts.find((p) => p.key === hovered);

  return (
    <div className="space-y-[22px] pb-12">
      <PageHeader
        eyebrow="Wealth"
        badge={sample ? <PreviewBadge label="Sample data" /> : undefined}
        title="Wealth"
        value={invested === null && entry === undefined ? null : formatCurrency(total, currency, 0)}
        note={realEstateShown ? "Your investments, wallets and real estate" : "Your investments and your wallets"}
        actions={[
          { label: "Add portfolio", primary: true, onClick: () => setDialog("portfolio"), ...(isDemo ? { disabled: true, title: DEMO_DISABLED_TITLE } : {}) },
          { label: "Add wallet", onClick: () => setDialog("wallet"), ...(isDemo ? { disabled: true, title: DEMO_DISABLED_TITLE } : {}) },
          ...(realEstateShown ? [{ label: "Add property", onClick: () => setDialog("property"), ...(isDemo ? { disabled: true, title: DEMO_DISABLED_TITLE } : {}) }] : []),
        ]}
        figures={[
          { label: "Net worth", value: formatCurrency(total, currency, 0) },
          { label: "Invested", value: total > 0 ? `${(((invested ?? 0) / total) * 100).toFixed(0)}%` : "—", sub: invested !== null ? `${formatCurrency(invested, currency, 0)} in portfolios` : undefined },
          {
            label: "Liquidity",
            value: overview?.balance == null ? "—" : formatCurrency(overview.balance, walletsCurrency, 0),
            sub: avgSpending > 0 && walletsBalance > 0 ? `${(walletsBalance / avgSpending).toFixed(1)} months of spending` : "In your wallets",
          },
          { label: "Saved this month", value: saved !== null ? `${saved.toFixed(0)}%` : "—", tone: toneOf(saved) },
        ]}
      />

      <Module>
        <ModuleHead
          title="Composition"
          desc="Open a slice or a row to go down a level."
          right={
            <div role="group" aria-label="Breakdown" className="flex flex-wrap gap-1.5">
              {(["nav", "class"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={b === breakdown}
                  onClick={() => { setBreakdown(b); setHovered(null); }}
                  className={`px-2.5 py-1 rounded-full border text-[11.5px] font-semibold transition-colors ${
                    b === breakdown ? "bg-[#1c1917] border-[#1c1917] text-white" : "border-[#E0DACC] text-[#78716c] hover:text-[#1c1917]"
                  }`}
                >
                  {b === "nav" ? "Investments & wallets" : "By asset class"}
                </button>
              ))}
            </div>
          }
        />
        <div className={`${MODULE_BODY} space-y-3`}>
          <div className="grid grid-cols-1 md:grid-cols-[210px_minmax(0,1fr)] gap-[26px] items-center">
            <div className="relative w-full max-w-[210px] aspect-square mx-auto">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 210, height: 210 }}>
                <PieChart>
                  <Pie data={slices.length ? slices : [{ key: "none", label: "", value: 1, color: "#EEE9DD" }]} dataKey="value" nameKey="label" innerRadius="67%" outerRadius="98%" paddingAngle={slices.length > 1 ? 1.4 : 0} stroke="none" isAnimationActive={false} onMouseLeave={() => setHovered(null)}>
                    {(slices.length ? slices : [{ key: "none", color: "#EEE9DD" } as RootPart]).map((p) => (
                      <Cell key={p.key} fill={p.color} opacity={hovered && hovered !== p.key ? 0.25 : 1} cursor={p.onOpen ? "pointer" : "default"} onMouseEnter={() => p.key !== "none" && setHovered(p.key)} onClick={p.onOpen} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-[22%] text-center">
                <span className="text-xl font-bold text-[#1c1917] tabular-nums">
                  {focus ? `${share(focus.value).toFixed(1)}%` : formatCurrency(partsTotal, currency, 0)}
                </span>
                <span className="text-[10.5px] text-[#78716c] truncate max-w-full">{focus ? focus.label : "total"}</span>
              </div>
            </div>
            <ul className="min-w-0">
              {parts.map((p, i) => {
                const content = (
                  <>
                    <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: p.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-semibold text-[#1c1917] truncate">{p.label}</span>
                      {p.sub && <span className="block truncate text-[11.5px] font-medium text-[#78716c]">{p.sub}</span>}
                    </span>
                    <span className="shrink-0 font-bold text-[#1c1917] tabular-nums">{formatCurrency(p.value, currency, 0)}</span>
                    <span className="hidden sm:block shrink-0 min-w-[92px] text-right text-xs text-[#78716c] tabular-nums">{share(p.value).toFixed(1)}%</span>
                    <span className="w-[18px] shrink-0">{p.onOpen && <ChevronRight className="h-4 w-4 text-[#a8a29e]" />}</span>
                  </>
                );
                const row = `w-full flex items-center gap-3 px-2.5 py-[11px] rounded-[14px] text-left transition-colors ${i < parts.length - 1 ? "border-b border-[#EEE9DD]" : ""} ${hovered === p.key ? "bg-[#F7F5EF]" : ""}`;
                return (
                  <li key={p.key} onMouseEnter={() => setHovered(p.key)} onMouseLeave={() => setHovered(null)}>
                    {p.onOpen ? (
                      <button type="button" onClick={p.onOpen} className={`${row} hover:bg-[#F7F5EF]`}>{content}</button>
                    ) : (
                      <div className={row}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Module>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[22px]">
        <Module>
          <ModuleHead
            title="Cash Flow"
            desc={`What came into your wallets and what went out, month by month, transfers between them left out.${sample ? " Sample data." : ""}`}
          />
          <div className={`${MODULE_BODY} space-y-4`}>
            {recent.length === 0 ? (
              <p className="text-[12.5px] text-[#a8a29e]">
                {overview === undefined ? "Loading…" : walletCount === 0 ? "Add a wallet to see what comes in and goes out." : "Can't be added up right now: an exchange rate is missing."}
              </p>
            ) : (
              <>
                <Figs>
                  <Fig label="In · 6 months" value={formatCurrency(recent.reduce((sum, m) => sum + m.income, 0), walletsCurrency, 0)} tone="gain" strong />
                  <Fig label="Out · 6 months" value={formatCurrency(recent.reduce((sum, m) => sum + m.spending, 0), walletsCurrency, 0)} />
                  <Fig label="Savings rate" value={rateText(walletsSavingsRate(recent))} />
                </Figs>
                <div className="h-[150px]">
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 150 }}>
                    <BarChart data={recent.map((m) => ({ label: monthLabel(m.month), income: m.income, expenses: -m.spending }))} stackOffset="sign" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip formatter={(v, name) => [formatCurrency(Math.abs(Number(v)), walletsCurrency, 0), name === "income" ? "In" : "Out"]} contentStyle={{ borderRadius: 12, border: "1px solid #E0DACC", fontSize: 12 }} />
                      <ReferenceLine y={0} stroke="#a8a29e" />
                      <Bar dataKey="income" stackId="flow" fill="#1baf7a" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="expenses" stackId="flow" fill="#e11d48" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        </Module>
        <Module>
          <ModuleHead title="Asset Classes" desc="What your wealth is in, across every portfolio, wallet and property." />
          <div className={`${MODULE_BODY} space-y-3`}>
            {entry === undefined ? (
              <p className="text-[12.5px] text-[#a8a29e]">Loading…</p>
            ) : classParts.length === 0 ? (
              <p className="text-[12.5px] text-[#a8a29e]">Nothing held yet.</p>
            ) : (
              <HBars
                max={100}
                rows={classParts.map((p) => {
                  const pctOfAll = classTotal(classParts) > 0 ? (p.value / classTotal(classParts)) * 100 : 0;
                  return { key: p.key, label: p.label, value: pctOfAll, figure: `${pctOfAll.toFixed(0)}%`, color: p.color };
                })}
              />
            )}
          </div>
        </Module>
      </div>
      {dialog === "portfolio" && <NewPortfolioDialog onClose={() => setDialog(null)} />}
      {dialog === "property" && (
        <RealEstateTransactionDialog
          initialKind="purchase"
          onClose={() => setDialog(null)}
          onSaved={(uuid) => { setDialog(null); onOpen({ kind: "realEstate", page: "property", property: uuid }); }}
        />
      )}
      {dialog === "wallet" && (
        <WalletFormDialog
          takenColors={allWallets.map((w) => w.color ?? "")}
          onClose={() => setDialog(null)}
          onSaved={(created) => {
            setDialog(null);
            changed();
            onOpen({ kind: "wallet", id: created.uuid, page: "insights" });
          }}
        />
      )}
    </div>
  );
}

interface RootPart {
  key: string;
  label: string;
  sub?: string;
  value: number;
  color: string;
  onOpen?: () => void;
}

// Slices on Wealth's donut before the rest are one "N more".
const ROOT_TOP = 3;

const classTotal = (parts: RootPart[]) => parts.reduce((sum, p) => sum + p.value, 0);

const rateText = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate)}%`);
