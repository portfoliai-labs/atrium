// components/dashboard/InvestmentsSection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { History, LineChart, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { investmentsKey, useInvestmentsRead, usePortfolio } from "../../context/PortfolioContext";
import { useUser } from "../../context/UserContext";
import { portfoliosService } from "../../services/portfoliosService";
import { transactionService } from "../../services/transactionService";
import { usePortfoliosAlertRules } from "../../hooks/useAlertRules";
import { portfolioColorMap } from "../../lib/chartColors";
import { formatCurrency } from "../../lib/format";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";
import { INVESTMENTS_SECTION, openClientPage, openProfilePreferences, openStrategiesPage } from "../../lib/dashboardNav";
import { useMyPublications } from "../../hooks/useMyPublications";
import { publicationService } from "../../services/publicationService";
import { PublishStrategyDialog } from "./PublishStrategyDialog";
import { investmentsOf, isBacktest, type Portfolio } from "../../models/Portfolio";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";
import { PerformanceSection } from "./PerformanceSection";
import { ToolsModule, type Tool } from "./ToolsModule";
import { PageHeader, type PageAction, type PageCounter, type PageFigure } from "./PageHeader";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { FileUploader } from "./FileUploader";
import { AlertsSettings } from "./AlertsSettings";
import { PortfoliosCompare } from "./PortfoliosCompare";
import type { CompareStrategy } from "./ComparisonView";
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
import { TaxesPage } from "./taxes/TaxesPage";
import { StressTestPage } from "./stress/StressTestPage";
import { ProjectionPage } from "./projection/ProjectionPage";
import { ManualAssetsEditor } from "./ManualAssetsEditor";
import { openAssetSettings } from "./SettingsSection";
import { StrategiesNode, strategiesViewOf, type BacktestPage, type StrategiesView } from "./StrategiesSection";

// A portfolio's pages: its own (overview), and those its header leads to.
// "taxes": the investments' (All portfolios', or the only portfolio's), the owner's taxes on them all.
// "stress": how a past crisis, or shocks picked, would hit it as it is today (a backtest's too).
// "projection": a Monte Carlo of where it could go as it is: a goal, withdrawals, the safe withdrawal.
// "manualAssets": the investments with no market price, valued by hand (the investments'). Both it and
// "categories" are reached from links (an old history entry, adopting on a client): their buttons are
// in Settings (the user's) and Client settings (a client's).
export type PortfolioPage = "overview" | "transactions" | "alerts" | "compare" | "portfolios" | "categories" | "strategy" | "taxes" | "stress" | "projection" | "manualAssets";

export type InvestmentsView =
  // A portfolio, "All portfolios" (the investments) included. A strategy's backtest is Strategies'.
  // `simulation`: on its Strategy page, the advisor's strategy portfolio a shared strategy came
  // from, opened read-only. `compareWith`: on Compare, strategies that aren't the user's compared
  // beside their portfolios (one from the catalog, one an advisor shared). `taxYear`: on Taxes,
  // the year it opens on (a year of the Realized P&L's), this one without.
  | { kind: "portfolio"; uuid: string; page: PortfolioPage; simulation?: string; compareWith?: CompareStrategy[]; taxYear?: number }
  // Strategies, beside All portfolios: the user's strategies (backtests) and the published ones.
  // An investor's own, not a client's (an advisor's Strategies is a section of its own).
  | ({ kind: "strategies" } & StrategiesView);

const NO_SCOPE: Record<string, string> = {};
const NO_TRAIL: Crumb[] = [];
const PORTFOLIO_PAGES: PortfolioPage[] = ["overview", "transactions", "alerts", "compare", "portfolios", "categories", "strategy", "taxes", "stress", "projection", "manualAssets"];
const PAGE_LABELS: Record<Exclude<PortfolioPage, "overview">, string> = {
  transactions: "Transactions",
  alerts: "Alerts",
  compare: "Compare",
  portfolios: "Manage portfolios",
  categories: "Asset categories",
  strategy: "Strategy",
  taxes: "Taxes",
  stress: "Stress test",
  projection: "Projection",
  manualAssets: "Manual assets",
};

// The fields every view of one client's investments carries, beside its own: `{ client }`.
type InvestmentsScope = Record<string, string>;

const inScope = (view: unknown, scope: InvestmentsScope) =>
  typeof view === "object" && view !== null && Object.entries(scope).every(([k, v]) => (view as Record<string, unknown>)[k] === v);

// The strategies a history entry compares, those well formed.
const compareStrategiesOf = (raw: unknown): CompareStrategy[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const list = raw.filter((s): s is CompareStrategy => typeof s?.uuid === "string" && typeof s?.name === "string");
  return list.length > 0 ? list : undefined;
};

/**
 * The page the current history entry was on, read for this account (and this scope).
 * `hasStrategies`: Strategies, the investor's own.
 */
function viewFromHistory(hasStrategies: boolean, portfolios: Portfolio[], section: string, scope: InvestmentsScope): InvestmentsView {
  const entry = readDashboardEntry();
  const raw = entry?.section === section && inScope(entry.view, scope) ? entry.view : undefined;
  // A scope's own fields alone (a client opened on no page) are no page.
  const view = (raw && "kind" in (raw as object) ? raw : undefined) as (InvestmentsView | { kind: string; [k: string]: unknown }) | undefined;
  const investments = investmentsOf(portfolios);
  const top: InvestmentsView = { kind: "portfolio", uuid: investments?.uuid ?? "", page: "overview" };
  if (!view) return top;
  switch (view.kind) {
    case "portfolio": {
      const v = view as { uuid?: string; page?: string; simulation?: unknown; compareWith?: unknown; taxYear?: unknown };
      // A portfolio had tabs (`tab`), then Insights as its first page, before its own page.
      const page = PORTFOLIO_PAGES.includes(v.page as PortfolioPage) ? (v.page as PortfolioPage) : "overview";
      const compareWith = page === "compare" ? compareStrategiesOf(v.compareWith) : undefined;
      const compare = compareWith ? { compareWith } : {};
      const taxYear = page === "taxes" && typeof v.taxYear === "number" ? { taxYear: v.taxYear } : {};
      // No portfolio named (""): the investments, on that page (a link from outside, which
      // doesn't know which portfolio stands for them).
      if (v.uuid === "" && investments) return { kind: "portfolio", uuid: investments.uuid, page, ...compare, ...taxYear };
      const found = portfolios.find((p) => p.uuid === v.uuid);
      if (!found) return top;
      // A backtest is Strategies' (a link to one from before it was).
      if (isBacktest(found)) {
        return hasStrategies ? { kind: "strategies", ...strategiesViewOf({ page: "backtest", uuid: found.uuid, sub: page }) } : top;
      }
      // The taxes are all the investments'.
      if (page === "taxes" && investments && v.uuid !== investments.uuid) return { kind: "portfolio", uuid: investments.uuid, page, ...taxYear };
      return page === "strategy" && typeof v.simulation === "string"
        ? { kind: "portfolio", uuid: v.uuid!, page, simulation: v.simulation }
        : { kind: "portfolio", uuid: v.uuid!, page, ...compare, ...taxYear };
    }
    // The investments' own pages before they were the investments' (Manage / Investments / Alerts…).
    case "investments":
    case "transactions":
    case "reports":
    case "alerts":
    case "compare":
    case "portfolios": {
      if (!investments) return top;
      // Reports are gone for now: their old entries land on the investments' own page.
      const page = view.kind === "investments" || view.kind === "reports" ? "overview" : (view.kind as PortfolioPage);
      return { kind: "portfolio", uuid: investments.uuid, page };
    }
    // Strategies, and its name when it was Explore.
    case "strategies":
    case "explore":
      return hasStrategies ? { kind: "strategies", ...strategiesViewOf(view) } : top;
    default:
      // Wealth's own page (it was this section's), Manage's hub, anything older. (The wallets' and the real estate's land on
      // their sections first, see the dashboard page.)
      return top;
  }
}

/**
 * INVESTMENTS SECTION (investor; "performance" in the sidebar's ids) — the user's portfolios, as
 * pages to go down through, each one the place to act on what it shows. It opens on the
 * investments: "All portfolios" while there are two or more, otherwise the only portfolio.
 *
 * A portfolio's page (PortfolioNode) is its header (value, activity, actions, key figures) over
 * its Insights (PerformanceSection), whose Composition leads down to each portfolio (from All
 * portfolios) or holding. Its activity and its actions open pages of its own, always on that
 * portfolio, so none of them asks which one: Transactions, Alerts and Reports, and on All
 * portfolios Compare and Manage portfolios, and on each its Stress test and Projection; the
 * investments' Taxes from the Realized P&L of their Insights. Beside All portfolios, Strategies (StrategiesNode): the user's
 * strategies, each a backtest opening the same page as a portfolio's, and the ones advisors publish.
 *
 * Every page is a browser history entry, so back and forward move between them (see
 * lib/dashboardHistory). Opening a portfolio also makes it the selected one (PortfolioContext).
 *
 * An advisor's client's investments are the same pages (see ClientsSection): in the Clients
 * section, each view carrying the client (`scope`), under the client's crumbs (`rootTrail`), on
 * that client's portfolios (a PortfolioProvider of theirs), with no Strategies (the advisor's own).
 */
export function InvestmentsSection({ onNavigate, section = INVESTMENTS_SECTION, scope = NO_SCOPE, rootTrail = NO_TRAIL, extraActions, onOpenTaxSettings, onOpenAssetSettings }: {
  onNavigate: (section: string) => void;
  section?: string;
  scope?: InvestmentsScope;
  rootTrail?: Crumb[];
  // Added to the investments' actions: a client's own (their settings).
  extraActions?: PageAction[];
  // Where the Taxes page sets the tax residence: the user's Profile unless said (a client's settings).
  onOpenTaxSettings?: () => void;
  // Where the asset categories and manual assets are: the user's Settings unless said (a client's settings).
  onOpenAssetSettings?: () => void;
}) {
  const { portfolios, selectPortfolio, client } = usePortfolio();
  const hasStrategies = !client;
  const [view, setView] = useState<InvestmentsView>(() => viewFromHistory(hasStrategies, portfolios, section, scope));

  useEffect(() => {
    // Record the page it opened on, so the Sidebar marks it.
    const entry = readDashboardEntry();
    if (entry?.section === section && !(entry.view && "kind" in (entry.view as object))) pushDashboardEntry({ section, view: { ...scope, ...view } }, true);
    const onPopState = () => {
      const current = readDashboardEntry();
      if (current?.section !== section || !inScope(current.view ?? {}, scope)) return;
      const next = viewFromHistory(hasStrategies, portfolios, section, scope);
      setView((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // Once: a new list of portfolios is read on the next back / forward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (next: InvestmentsView) => {
    if (next.kind === "portfolio") selectPortfolio(next.uuid);
    pushDashboardEntry({ section, view: { ...scope, ...next } });
    setView(next);
    window.scrollTo({ top: 0 });
  };
  const openPortfolio = (uuid: string, page: PortfolioPage = "overview") => go({ kind: "portfolio", uuid, page });

  const investments = investmentsOf(portfolios);
  const openStrategies = (next: StrategiesView) => go({ kind: "strategies", ...next });
  // Strategies are opened from Plan, on the investments' pages: they sit under the investments.
  const strategiesTrail: Crumb[] = investments
    ? [...rootTrail, { label: investments.name, onClick: () => openPortfolio(investments.uuid) }]
    : rootTrail;
  if (view.kind === "strategies" && hasStrategies) {
    return <StrategiesNode view={strategiesViewOf(view)} trail={strategiesTrail} onOpen={openStrategies} onOpenPortfolio={openPortfolio} onNavigate={onNavigate} />;
  }

  const portfolio = (view.kind === "portfolio" && portfolios.find((p) => p.uuid === view.uuid)) || investments;
  if (!portfolio) return null;
  const page = view.kind === "portfolio" && view.uuid === portfolio.uuid ? view.page : "overview";
  const simulation = view.kind === "portfolio" && view.uuid === portfolio.uuid ? view.simulation : undefined;
  const compareWith = view.kind === "portfolio" && view.uuid === portfolio.uuid ? view.compareWith : undefined;
  const taxYear = view.kind === "portfolio" && view.uuid === portfolio.uuid ? view.taxYear : undefined;
  // A backtest is a simulation, not something owned: it's Strategies' (a client's have none).
  if (isBacktest(portfolio)) {
    if (!hasStrategies) return null;
    const sub: BacktestPage = page === "transactions" || page === "stress" || page === "projection" ? page : "overview";
    return <StrategiesNode view={{ page: "backtest", uuid: portfolio.uuid, sub }} trail={strategiesTrail} onOpen={openStrategies} onOpenPortfolio={openPortfolio} onNavigate={onNavigate} />;
  }

  // The pages above it: a portfolio sits under Investments (All portfolios' page).
  const aggregate = portfolios.find((p) => p.isAggregate);
  const trail: Crumb[] = portfolio.uuid === investments?.uuid || !aggregate
    ? rootTrail
    : [...rootTrail, { label: "Investments", onClick: () => openPortfolio(aggregate.uuid) }];

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
      compareWith={compareWith}
      taxYear={taxYear}
      onOpenTaxes={investments ? (year) => go({ kind: "portfolio", uuid: investments.uuid, page: "taxes", ...(year ? { taxYear: year } : {}) }) : undefined}
      onCompareWith={investments ? (strategy) => go({ kind: "portfolio", uuid: investments.uuid, page: "compare", compareWith: [strategy] }) : undefined}
      onOpenSimulation={(uuid) => go({ kind: "portfolio", uuid: portfolio.uuid, page: "strategy", simulation: uuid })}
      onOpenTaxSettings={onOpenTaxSettings ?? (() => openProfilePreferences(onNavigate))}
      onOpenAssetSettings={onOpenAssetSettings}
      onOpenStrategies={hasStrategies ? () => openStrategies({ page: "home" }) : undefined}
      onNavigate={onNavigate}
    />
  );
}

// ── A portfolio's page ────────────────────────────────────────────────────────────────────

const pct = (v: number, digits = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
const toneOf = (v: number | null | undefined): "gain" | "loss" | undefined => (v == null || v === 0 ? undefined : v > 0 ? "gain" : "loss");

/** One portfolio's side-by-side figures (GET /v1/portfolios/comparison), for its header. */
export function useComparisonEntry(uuid: string) {
  const { client } = usePortfolio();
  const clientUuid = client?.uuid ?? null;
  // undefined while loading, null when it couldn't be read.
  return useInvestmentsRead<PortfolioComparisonEntry | null>(
    ["comparison", clientUuid ?? "own", uuid], async () => (await portfoliosService.compare([uuid], clientUuid))[0] ?? null,
  );
}

/**
 * Whether a strategy is adopted on the portfolio (GET .../adopted-strategy), and the strategies the
 * user's advisor shared for it (GET .../shared-strategies: All portfolios' are its own, as it adopts its own),
 * for its header's way to its Strategy page: undefined while loading or for a backtest, which can't
 * adopt one. `reload` after a change.
 */
function useHasAdoption(portfolio: Portfolio) {
  const backtest = isBacktest(portfolio);
  const queryClient = useQueryClient();
  const key = ["adoption", portfolio.uuid];
  const state = useInvestmentsRead(key, async () => {
    const [adoption, shared] = await Promise.all([
      adoptionService.get(portfolio.uuid).catch(() => null),
      adoptionService.listShared(portfolio.uuid).catch(() => [] as SharedStrategy[]),
    ]);
    return { has: adoption !== null, shared };
  }, !backtest);
  const reload = () => { void queryClient.invalidateQueries({ queryKey: investmentsKey(...key) }); };
  return { hasAdoption: state?.has, shared: state?.shared ?? [], reload };
}

/**
 * How much activity a portfolio has, for its header's counters: its transactions (All portfolios'
 * read every portfolio's) and its alert rules and theirs (All portfolios' own, then every
 * portfolio's).
 */
function useActivityCounts(portfolio: Portfolio, real: Portfolio[]) {
  const backtest = isBacktest(portfolio);
  const ruleScope = backtest ? [] : portfolio.isAggregate ? [portfolio.uuid, ...real.map((p) => p.uuid)] : [portfolio.uuid];
  const { rules } = usePortfoliosAlertRules(ruleScope);
  const transactions = useInvestmentsRead(
    ["transactions", portfolio.uuid, "count"], async () => (await transactionService.getUserTransactions(portfolio.uuid, 1, 0)).total,
  );

  return {
    transactions: transactions ?? null,
    rules: rules === null ? null : rules.length,
    triggered: rules === null ? 0 : rules.filter((r) => r.enabled && r.isTriggered).length,
  };
}

/**
 * PORTFOLIO NODE — a portfolio's page in Investments (a backtest's under Strategies), or one of
 * the pages its header leads to. Its header says what it's worth and how it moved, counts its
 * activity (each count opens its page) and holds what can be done with it:
 * - All portfolios: Manage portfolios (a new one is made there), Alerts, Compare. It's read only: its transactions
 *   list every portfolio's, and a new one says which it goes in.
 * - a portfolio: its Transactions, Alerts and Reports, rename, delete (not the default one).
 * - a backtest: adopt its strategy, delete. Its figures are a simulation's (returns and risk over
 *   its run), its transactions generated and read only, and its Insights leave out what a
 *   simulation doesn't have (see PerformanceSection's `backtest`).
 * Under the header, what to plan with it (PlanningTools: its Stress test and Projection; a
 * backtest's are its actions), then its Insights (PerformanceSection), whose Composition opens
 * each portfolio of All portfolios and whose Realized P&L the investments' Taxes. A demo account sees everything but can't change anything. An advisor on a
 * client's (PortfolioContext's `client`) can't rename or delete it; its alerts are the advisor's,
 * its asset categories the client's, and its Strategy page says whether the client sees it.
 */
export function PortfolioNode({ portfolio, page, trail, isInvestments, extraActions = [], onOpen, simulation, compareWith, onCompareWith, taxYear, onOpenTaxes, onOpenSimulation, onOpenTaxSettings, onOpenAssetSettings, onOpenStrategies, onBacktestGone, onNavigate }: {
  portfolio: Portfolio;
  page: PortfolioPage;
  trail: Crumb[];
  // It stands for all the investments ("All portfolios", or the only portfolio).
  isInvestments: boolean;
  // Added to its actions, last.
  extraActions?: PageAction[];
  onOpen: (uuid: string, page?: PortfolioPage) => void;
  // On Compare: strategies that aren't the user's, compared beside their portfolios.
  compareWith?: CompareStrategy[];
  // Opens Compare with a strategy that isn't the user's beside their portfolios.
  onCompareWith?: (strategy: CompareStrategy) => void;
  // On Taxes: the year it opens on. And the way there, on a year, from the Realized P&L.
  taxYear?: number;
  onOpenTaxes?: (year?: number) => void;
  // On its Strategy page: the advisor's simulation a shared strategy came from, open read-only,
  // and the way to open one.
  simulation?: string;
  onOpenSimulation?: (uuid: string) => void;
  // The investments' Taxes page: where the tax residence is set.
  onOpenTaxSettings?: () => void;
  onOpenAssetSettings?: () => void;
  // Strategies, from Plan (the user's own investments; a client's have none).
  onOpenStrategies?: () => void;
  // A backtest's page (Strategies'): where to go once it's deleted. Strategies by default.
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
  // In the user's Settings (Assets), or where it's opened from says (a client's settings).
  const openCategories = onOpenAssetSettings ?? (() => openAssetSettings(onNavigate));
  const [dialog, setDialog] = useState<"new" | "rename" | "delete" | "adopt" | "publish" | "withdraw" | null>(null);
  // An advisor's backtest: whether it's in the catalog.
  const { publications, reload: reloadPublications, canPublish } = useMyPublications();
  const publication = backtest ? publications?.get(portfolio.uuid) : undefined;
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Bumped to start the page over (back at the top, any detail closed) from its own crumb.
  const [visit, setVisit] = useState(0);

  const open = (next: PortfolioPage) => onOpen(portfolio.uuid, next);
  const nodeCrumb: Crumb = {
    // All portfolios is the investments' own page: "Investments" above its pages.
    label: portfolio.isAggregate ? "Investments" : portfolio.name,
    onClick: () => {
      if (page !== "overview") open("overview");
      else {
        setVisit((n) => n + 1);
        window.scrollTo({ top: 0 });
      }
    },
  };
  const demo = isDemo ? { disabled: true, title: DEMO_DISABLED_TITLE } : {};
  // New portfolios are added on the investments' page.
  const addsPortfolios = isInvestments;

  // ── What can be done with it ──
  const actions: PageAction[] = backtest
    ? [
        { label: canPublish ? "Adopt on a client" : "Adopt this strategy", primary: true, onClick: () => setDialog("adopt"), ...demo },
        ...(canPublish ? publication
          ? [
              { label: "Edit the publication", onClick: () => setDialog("publish") },
              { label: "Withdraw from the catalog", onClick: () => { setWithdrawError(null); setDialog("withdraw"); } },
            ]
          : [{ label: "Publish to the catalog", onClick: () => setDialog("publish"), ...(publications === undefined ? { disabled: true } : {}) }]
          : []),
        { label: "Stress test", onClick: () => open("stress") },
        { label: "Projection", onClick: () => open("projection") },
        { label: "Delete backtest", danger: true, onClick: () => setDialog("delete"), ...demo },
      ]
    : portfolio.isAggregate
      ? [
          // Manage portfolios is also where a new one is made.
          { label: "Manage portfolios", primary: true, onClick: () => open("portfolios") },
          ...strategyAction,
          ...extraActions,
        ]
      : [
          // Its activity pages: what's there, and where to add to it.
          { label: "Transactions", primary: true, plus: false, onClick: () => open("transactions") },
          ...strategyAction,
          // The only portfolio stands for the investments: the way to a second one is here.
          ...(addsPortfolios ? [{ label: "New portfolio", onClick: () => setDialog("new") }] : []),
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
    // All portfolios' only counts them: its transactions are each portfolio's, on its own page.
    { key: "transactions", label: "transactions", count: counts.transactions, onClick: portfolio.isAggregate ? undefined : () => open("transactions") },
    ...(backtest ? [] : [
      { key: "alerts", label: "alerts", count: counts.rules, attention: { count: counts.triggered, label: "triggered" }, onClick: () => open("alerts") },
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


  const header = (
    <PageHeader
      eyebrow={`${client ? `${client.name} · ` : ""}${backtest ? "Backtest" : portfolio.isAggregate || isInvestments ? "Investments" : "Portfolio"}`}
      // The pages above it in place of the eyebrow (Investments › the portfolio), where there are some.
      crumbs={trail}
      notice={backtest ? <BacktestBanner portfolioUuid={portfolio.uuid} /> : undefined}
      title={portfolio.name}
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
      if (backtest) (onBacktestGone ?? (() => openStrategiesPage(onNavigate)))();
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
          title={`Withdraw "${portfolio.name}" from the catalog?`}
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
          // Its step above a month or a detail: All portfolios' is "Investments", as in its pages' trails.
          pageLabel={portfolio.isAggregate ? "Investments" : portfolio.name}
          trailInTop
          top={backtest ? header : (
            <>
              {header}
              <PlanningTools onOpen={open} onOpenStrategies={onOpenStrategies} />
            </>
          )}
          // All portfolios (with two or more): how they did next to each other, its Compare module.
          onCompare={!backtest && real.length > 1 && portfolio.isAggregate ? () => open("compare") : undefined}
          onOpenTaxes={backtest ? undefined : onOpenTaxes}
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
      <PortfoliosCompare
        // Opened again with other strategies: starts over on them.
        key={JSON.stringify(compareWith ?? null)}
        trail={pageTrail}
        compareWith={compareWith}
        onOpen={(uuid) => onOpen(uuid)}
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
        extraActions={onCompareWith ? [{ label: "Compare with my portfolios", onClick: () => onCompareWith({ uuid: simulation, name: "Your advisor's strategy" }) }] : []}
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
        onCompareWith={onCompareWith}
        onOpenAlerts={() => open("alerts")}
        onNavigate={onNavigate}
        onChanged={reloadAdoption}
      />
    );
  }
  // The owner's taxes on every portfolio: the investments' page (a link to another portfolio's
  // lands on theirs, see viewFromHistory).
  if (page === "taxes") {
    const investments = investmentsOf(portfolios);
    return (
      <TaxesPage
        key={`${client?.uuid ?? "own"}:${taxYear ?? ""}`}
        trail={pageTrail}
        initialYear={taxYear}
        onOpenSettings={onOpenTaxSettings}
        // Manage portfolios, where each one's taxation mode is set (the only portfolio's list too).
        onOpenPortfolios={() => investments && onOpen(investments.uuid, "portfolios")}
      />
    );
  }
  // A simulation on the portfolio it's opened from: its name (All portfolios' too, rather than
  // "Investments"; a client's with the client's) is the trail's last step, nothing above the title.
  const toolTrail = [...trail, { ...nodeCrumb, label: `${client ? `${client.name} · ` : ""}${portfolio.name}` }];
  if (page === "stress") {
    return <StressTestPage key={portfolio.uuid} portfolioUuid={portfolio.uuid} trail={toolTrail} />;
  }
  if (page === "projection") {
    return <ProjectionPage key={portfolio.uuid} portfolioUuid={portfolio.uuid} trail={toolTrail} />;
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

  // The user's, whichever portfolio it's opened from.
  if (page === "manualAssets") {
    return (
      <div className="space-y-6 pb-12">
        <Breadcrumb trail={pageTrail} current={PAGE_LABELS.manualAssets} />
        <p className="text-[13px] text-slate-500 leading-relaxed max-w-3xl">
          {client
            ? `${client.name}'s investments with no market price — unlisted shares, private equity, a loan, physical gold — valued by hand. Each one is picked in a transaction like a security, and counts in the portfolios that hold it by its valuations.`
            : "Your investments with no market price — unlisted shares, private equity, a loan, physical gold — valued by hand. Each one is picked in a transaction like a security, and counts in the portfolios that hold it by its valuations."}
        </p>
        <ManualAssetsEditor clientUuid={client?.uuid} />
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
    </div>
  );
}

/**
 * PLANNING TOOLS — what a portfolio's page plans with, under its header: its Stress test and
 * Projection, each its own page, and
 * Strategies (the user's backtests and the published ones; not on a client's). Its Alerts and
 * Reports are reached from the header's counters.
 */
function PlanningTools({ onOpen, onOpenStrategies }: { onOpen: (page: PortfolioPage) => void; onOpenStrategies?: () => void }) {
  const tools: Tool[] = [
    { key: "stress", onClick: () => onOpen("stress"), icon: ShieldAlert, title: "Stress test", text: "How a past crisis, or the shocks picked, would hit it as it is today." },
    { key: "projection", onClick: () => onOpen("projection"), icon: LineChart, title: "Projection", text: "Where it could go from here: a goal, withdrawals, the safe withdrawal." },
    ...(onOpenStrategies ? [{ key: "strategies", onClick: onOpenStrategies, icon: History, title: "Strategies", text: "Your strategies tested on the past, and the ones advisors publish." }] : []),
  ];
  return <ToolsModule title="Plan" tools={tools} />;
}

function ReadOnlyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-[#C49A3C]/30 bg-[#C49A3C]/10 px-4 py-3 text-[13px] font-semibold text-[#8A6A28]">
      {children}
    </p>
  );
}
