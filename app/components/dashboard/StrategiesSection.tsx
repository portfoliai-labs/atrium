// components/dashboard/StrategiesSection.tsx
"use client";

import { useState } from "react";
import { ArrowUpRight, History, Info, Plus, Target, Telescope, Trash2 } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";
import { useUser } from "../../context/UserContext";
import { useSectionView } from "../../lib/dashboardHistory";
import { STRATEGIES_SECTION, openClientPage, openCompareWith, openPortfolioPage } from "../../lib/dashboardNav";
import { useMyPublications } from "../../hooks/useMyPublications";
import { publicationService } from "../../services/publicationService";
import { PublishStrategyDialog } from "./PublishStrategyDialog";
import type { PublishedStrategy } from "../../models/PublishedStrategy";
import { PortfolioNode, type PortfolioPage } from "./InvestmentsSection";
import { investmentsOf, isBacktest, type Portfolio } from "../../models/Portfolio";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { StrategyBuilder } from "./StrategyBuilder";
import { StrategiesCatalog, PublishedStrategyPage } from "./StrategiesExplore";
import { ConfirmDialog } from "./ConfirmDialog";
import { AdoptStrategyDialog } from "./AdoptStrategyDialog";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";

// Strategies' pages: "home", the user's strategies (their backtests) and the catalog of the
// published ones; "builder", the form for a new backtest; "backtest", one backtest's page (`uuid`,
// on `sub`); "published", one strategy of the catalog (`publicationId`).
export type StrategiesPage = "home" | "builder" | "backtest" | "published";
// A backtest's pages: its own, its generated transactions, its Stress test and Projection.
export type BacktestPage = "overview" | "transactions" | "stress" | "projection";
export type StrategiesView = { page: StrategiesPage; uuid?: string; sub?: BacktestPage; publicationId?: string };

const BACKTEST_PAGES: BacktestPage[] = ["overview", "transactions", "stress", "projection"];

/**
 * The Strategies page a history entry's view is on, well formed: its own, or one of Plan's or the
 * old Explore's (Strategy, the catalog, the builder, a backtest), so old links still land.
 */
export function strategiesViewOf(raw: unknown): StrategiesView {
  const v = (typeof raw === "object" && raw !== null ? raw : {}) as { page?: unknown; uuid?: unknown; sub?: unknown; publicationId?: unknown };
  if (v.page === "builder") return { page: "builder" };
  if (v.page === "backtest" && typeof v.uuid === "string") {
    return { page: "backtest", uuid: v.uuid, sub: BACKTEST_PAGES.includes(v.sub as BacktestPage) ? (v.sub as BacktestPage) : "overview" };
  }
  if ((v.page === "published" || v.page === "explore") && typeof v.publicationId === "string") return { page: "published", publicationId: v.publicationId };
  return { page: "home" };
}

const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;
const createdLabel = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "";

/** Whether a view is one of Strategies' pages, or of the old Explore's (the catalog's). */
export const isStrategiesView = (raw: unknown) => {
  const v = (typeof raw === "object" && raw !== null ? raw : {}) as { page?: unknown; publicationId?: unknown };
  return ["home", "builder", "backtest", "published", "explore", "strategy"].includes(v.page as string) || typeof v.publicationId === "string";
};

/**
 * STRATEGIES SECTION — an advisor's Strategies, a section of its own (an investor's is
 * Investments', beside All portfolios, see InvestmentsSection): StrategiesNode's pages, each a
 * browser history entry (see lib/dashboardHistory).
 */
export function StrategiesSection({ onNavigate }: { onNavigate: (section: string) => void }) {
  const [view, open] = useSectionView(STRATEGIES_SECTION, strategiesViewOf);
  return <StrategiesNode view={view} trail={[]} onOpen={open} onNavigate={onNavigate} />;
}

/**
 * STRATEGIES NODE — the strategies: the user's own, each a backtest of how they would invest on
 * historical prices (StrategyBuilder makes a new one), and the ones advisors publish (the catalog,
 * read only). Each backtest opens its page, the same as a portfolio's in Investments without what a
 * simulation doesn't have (see PortfolioNode), and is adopted on a portfolio (AdoptStrategyDialog):
 * each of its targets becomes a range there, with an alert saying where the portfolio stands
 * against it. `trail`: the pages above Strategies. `onOpenPortfolio`: where a portfolio opens from
 * here (Investments', unless said).
 */
export function StrategiesNode({ view, trail, onOpen, onOpenPortfolio, onNavigate }: {
  view: StrategiesView;
  trail: Crumb[];
  onOpen: (view: StrategiesView) => void;
  onOpenPortfolio?: (uuid: string, page?: PortfolioPage) => void;
  onNavigate: (section: string) => void;
}) {
  const { portfolios } = usePortfolio();
  const openPortfolio = onOpenPortfolio ?? ((uuid: string, page?: PortfolioPage) => openPortfolioPage(onNavigate, uuid, page));
  const goHome = () => onOpen({ page: "home" });
  const openBacktest = (uuid: string, sub: BacktestPage = "overview") => onOpen({ page: "backtest", uuid, sub });
  const strategiesTrail: Crumb[] = [...trail, { label: "Strategies", onClick: goHome }];

  if (view.page === "builder") {
    return <StrategyBuilder trail={strategiesTrail} onCreated={(uuid) => openBacktest(uuid)} />;
  }
  if (view.page === "published" && view.publicationId) {
    return (
      <PublishedStrategyPage
        key={view.publicationId}
        publicationId={view.publicationId}
        trail={strategiesTrail}
        onCompare={(compareWith) => openCompareWith(onNavigate, compareWith)}
        onNavigate={onNavigate}
      />
    );
  }

  // Until a just created backtest is in the list, Strategies stands in for it.
  const backtest = view.page === "backtest" ? portfolios.find((p) => p.uuid === view.uuid && isBacktest(p)) : undefined;
  if (backtest) {
    return (
      <PortfolioNode
        key={backtest.uuid}
        portfolio={backtest}
        page={view.sub ?? "overview"}
        trail={strategiesTrail}
        isInvestments={false}
        onOpen={(uuid, next) =>
          uuid === backtest.uuid
            ? openBacktest(uuid, BACKTEST_PAGES.includes(next as BacktestPage) ? (next as BacktestPage) : "overview")
            : openPortfolio(uuid, next)}
        onBacktestGone={goHome}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <StrategiesHome
      trail={trail}
      onBuild={() => onOpen({ page: "builder" })}
      onOpenBacktest={openBacktest}
      onOpenPublished={(publicationId) => onOpen({ page: "published", publicationId })}
      onOpenPortfolio={openPortfolio}
      onNavigate={onNavigate}
    />
  );
}

/**
 * STRATEGIES HOME — one list (StrategiesCatalog) of the user's strategies, each to open (its
 * page), adopt or delete, and the published ones, to look at before making one's own; a filter
 * shows only the user's. New strategy (StrategyBuilder) is beside the title. Adopting puts the strategy on a portfolio the user picks (or a new one) and opens that
 * portfolio's Strategy page, where its ranges are. A demo account sees the backtests but can't
 * create, adopt or delete.
 *
 * An advisor adopts theirs on a client's portfolio (opening it in the client's investments, where it's
 * shared with the client or not), and publishes them to the catalog or withdraws them.
 */
function StrategiesHome({ trail, onBuild, onOpenBacktest, onOpenPublished, onOpenPortfolio, onNavigate }: {
  trail: Crumb[];
  onBuild: () => void;
  onOpenBacktest: (uuid: string) => void;
  onOpenPublished: (publicationId: string) => void;
  onOpenPortfolio: (uuid: string, page?: PortfolioPage) => void;
  onNavigate: (section: string) => void;
}) {
  const { portfolios, deletePortfolio } = usePortfolio();
  const { isDemo } = useUser();
  const { publications, reload: reloadPublications, canPublish } = useMyPublications();
  const [publishing, setPublishing] = useState<Portfolio | null>(null);
  const [withdrawing, setWithdrawing] = useState<PublishedStrategy | null>(null);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [adopting, setAdopting] = useState<Portfolio | null>(null);
  const [deleting, setDeleting] = useState<Portfolio | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const backtests = portfolios.filter(isBacktest);
  const demo = isDemo ? { disabled: true, title: DEMO_DISABLED_TITLE } : {};

  const withdraw = async () => {
    if (!withdrawing) return;
    setWithdrawBusy(true);
    setWithdrawError(null);
    try {
      await publicationService.withdraw(withdrawing.publicationId);
      setWithdrawing(null);
      reloadPublications();
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : "Unable to withdraw this strategy.");
    } finally {
      setWithdrawBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deletePortfolio(deleting.uuid);
      setDeleting(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Unable to delete this backtest.");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="Strategies" />
      {/* Titled as Projection and Stress test are, New strategy beside the title. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[30px] md:text-[40px] font-bold text-[#1c1917] leading-[1.05]" style={serif}>Strategies</h1>
          <button
            type="button"
            onClick={onBuild}
            {...demo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" /> New strategy
          </button>
        </div>
        <p className="flex items-start gap-2 text-[12.5px] text-[#78716c] max-w-3xl">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {canPublish
            ? "Yours and the ones advisors publish. Backtest a strategy on historical prices and adopt it on a client's portfolio: each of its targets becomes a range, and an alert tells you where the portfolio stands against it; share it to let the client read it. Or publish it, for everyone to read."
            : "Yours and the ones advisors publish. Backtest how you would invest on historical prices; when one of yours fits, adopt it on one of your portfolios: each of its targets becomes a range, and an alert says where the portfolio stands against it."}
        </p>
      </div>

      <StrategiesCatalog
        own={backtests.map((p) => ({
          key: p.uuid,
          card: (
            // As a published strategy's card, marked as the user's own, with what can be done with it.
            <article className="relative h-full bg-white rounded-[1.75rem] border border-[#C49A3C]/40 p-6 flex flex-col gap-5">
              <button
                type="button"
                onClick={() => { setDeleteError(null); setDeleting(p); }}
                disabled={isDemo}
                aria-label={`Delete ${p.name}`}
                title={isDemo ? DEMO_DISABLED_TITLE : "Delete this backtest"}
                className="absolute top-4 right-4 p-2 rounded-lg text-[#a8a29e] hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="min-w-0 pr-8">
                <p className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C]">
                  Yours · backtest
                  {publications?.has(p.uuid) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 tracking-wider">
                      <Telescope className="h-3 w-3" /> Published
                    </span>
                  )}
                </p>
                <h3 className="mt-1.5 text-xl font-bold text-[#1c1917] leading-tight line-clamp-2" style={serif}>{p.name}</h3>
                <p className="text-[11px] text-[#78716c] mt-1">Created {createdLabel(p.createdAt)}</p>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenBacktest(p.uuid)}
                  className="flex items-center gap-1.5 min-h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:border-slate-300 transition-colors"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" /> Open
                </button>
                <button
                  type="button"
                  onClick={() => setAdopting(p)}
                  disabled={isDemo}
                  title={isDemo ? DEMO_DISABLED_TITLE : "Keep one of your portfolios in this strategy's ranges"}
                  className="flex items-center gap-1.5 min-h-10 px-4 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Target className="h-3.5 w-3.5" /> {canPublish ? "Adopt on a client" : "Adopt"}
                </button>
                {canPublish && (
                  publications?.has(p.uuid) ? (
                    <button
                      type="button"
                      onClick={() => { setWithdrawError(null); setWithdrawing(publications.get(p.uuid)!); }}
                      className="flex items-center gap-1.5 min-h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:border-slate-300 transition-colors"
                    >
                      Withdraw
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPublishing(p)}
                      disabled={publications === undefined}
                      className="flex items-center gap-1.5 min-h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:border-slate-300 transition-colors disabled:opacity-50"
                    >
                      <Telescope className="h-3.5 w-3.5" /> Publish
                    </button>
                  )
                )}
              </div>
            </article>
          ),
        }))}
        ownUuids={backtests.map((p) => p.uuid)}
        emptyOwn={(
          <button
            type="button"
            onClick={onBuild}
            {...demo}
            className="min-h-36 w-full rounded-3xl border-2 border-dashed border-[#C49A3C]/40 bg-white flex flex-col items-center justify-center gap-2 px-6 text-center text-[#78716c] hover:border-[#C49A3C] transition-colors disabled:cursor-not-allowed"
          >
            <History className="h-6 w-6" />
            <span className="text-[13px] font-bold text-[#1c1917]">No strategies of yours yet</span>
            <span className="text-[11px] font-semibold">Set up a strategy and see how it would have done.</span>
          </button>
        )}
        onOpen={onOpenPublished}
      />

      {publishing && (
        <PublishStrategyDialog
          backtest={publishing}
          onClose={() => setPublishing(null)}
          onPublished={() => {
            setPublishing(null);
            reloadPublications();
          }}
        />
      )}
      {withdrawing && (
        <ConfirmDialog
          title={`Withdraw "${withdrawing.portfolioName}" from the catalog?`}
          description="It leaves the catalog: nobody can read it there any more. The backtest stays yours, to publish again."
          confirmLabel="Withdraw"
          confirming={withdrawBusy}
          error={withdrawError}
          onConfirm={withdraw}
          onClose={() => setWithdrawing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete "${deleting.name}"?`}
          description="The backtest and its generated transactions are deleted. This can't be undone."
          confirming={deleteBusy}
          error={deleteError}
          onConfirm={handleDelete}
          onClose={() => setDeleting(null)}
        />
      )}

      {adopting && (
        <AdoptStrategyDialog
          strategyUuid={adopting.uuid}
          strategyName={adopting.name}
          onClose={() => setAdopting(null)}
          onAdopted={(uuid, clientUuid) => {
            setAdopting(null);
            if (clientUuid) openClientPage(onNavigate, clientUuid, { kind: "portfolio", uuid, page: "strategy" });
            else onOpenPortfolio(uuid, "strategy");
          }}
          onOpenCategories={(clientUuid) => {
            setAdopting(null);
            // A client's: on their investments, whichever portfolio stands for them.
            if (clientUuid) return openClientPage(onNavigate, clientUuid, { kind: "portfolio", uuid: "", page: "categories" });
            const investments = investmentsOf(portfolios);
            if (investments) onOpenPortfolio(investments.uuid, "categories");
          }}
        />
      )}
    </div>
  );
}
