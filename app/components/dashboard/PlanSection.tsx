// components/dashboard/PlanSection.tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronRight, History, Plus, Target, Telescope, Trash2, Wrench, X } from "lucide-react";
import { createPortal } from "react-dom";
import { usePortfolio } from "../../context/PortfolioContext";
import { useUser } from "../../context/UserContext";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";
import { PLAN_SECTION, openClientPage, openPortfolioPage } from "../../lib/dashboardNav";
import { useMyPublications } from "../../hooks/useMyPublications";
import { publicationService } from "../../services/publicationService";
import { PublishStrategyDialog } from "./PublishStrategyDialog";
import type { PublishedStrategy } from "../../models/PublishedStrategy";
import { PortfolioNode } from "./WealthSection";
import { investmentsOf, isBacktest, type Portfolio } from "../../models/Portfolio";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { StrategyBuilder } from "./StrategyBuilder";
import { StrategiesExplore } from "./StrategiesExplore";
import { ConfirmDialog } from "./ConfirmDialog";
import { AdoptStrategyDialog } from "./AdoptStrategyDialog";
import { VirtualBadge } from "./BacktestMarks";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";
import { Panel, PreviewBanner } from "../preview/PreviewKit";

// Under Strategy: "builder", the form for a new backtest; "backtest", one backtest's page;
// "explore", the strategies catalog (StrategiesExplore), to look at before making one's own.
export type PlanPage = "profile" | "goals" | "retirement" | "strategy" | "builder" | "backtest" | "explore";
// A backtest's pages: its own, and its generated transactions.
export type BacktestPage = "overview" | "transactions";

// Explore adds the open strategy's publication.
type PlanView = { page: PlanPage; uuid?: string; sub?: BacktestPage; publicationId?: string };

const SECTION = PLAN_SECTION;

// The pages a demo account sees only: previews, with nothing behind them yet.
const PREVIEW_PAGES: PlanPage[] = ["profile", "goals", "retirement"];

type ListedPlanPage = Exclude<PlanPage, "builder" | "backtest" | "explore">;

export const PLAN_PAGE_LABELS: Record<ListedPlanPage, string> = {
  profile: "Investor profile",
  goals: "Goals",
  retirement: "Retirement",
  strategy: "Strategy",
};

/** The pages listed under Plan for this account, in order. */
export const planPages = (isDemo: boolean): ListedPlanPage[] =>
  isDemo ? ["profile", "goals", "retirement", "strategy"] : ["strategy"];

const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;
const createdLabel = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "";

/**
 * PLAN SECTION — where the user is heading, and how they mean to invest to get there: their
 * investor profile (the start of an investor policy statement), their goals and a retirement
 * simulation, all previews for a demo account for now, and Strategy, which backtests a strategy
 * into a virtual portfolio (StrategyBuilder), or first looks at the ones advisors publish
 * (Explore, read only), and adopts one on a portfolio in Wealth
 * (AdoptStrategyDialog): each of its targets a range there, with an alert saying where the
 * portfolio stands against it. For a demo account a strip at the top of each page shows how they chain together. Every
 * page is a browser history entry (see lib/dashboardHistory).
 */
export function PlanSection({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { isDemo } = useUser();
  const { portfolios } = usePortfolio();
  const fallback: PlanPage = isDemo ? "profile" : "strategy";

  // The page the current history entry was on, if this account has it.
  const viewFromHistory = (): PlanView => {
    const entry = readDashboardEntry();
    const view = entry?.section === SECTION ? (entry.view as PlanView | undefined) : undefined;
    const page = view?.page;
    if (!page || (!isDemo && PREVIEW_PAGES.includes(page))) return { page: fallback };
    if (page === "backtest") {
      return view.uuid ? { page, uuid: view.uuid, sub: view.sub === "transactions" ? "transactions" : "overview" } : { page: "strategy" };
    }
    if (page === "explore" && typeof view.publicationId === "string") return { page, publicationId: view.publicationId };
    return { page };
  };
  const [view, setView] = useState<PlanView>(viewFromHistory);
  const page = view.page;

  useEffect(() => {
    // Record the page it opened on, so the Sidebar marks it.
    const entry = readDashboardEntry();
    if (entry?.section === SECTION && !(entry.view as PlanView | undefined)?.page) {
      pushDashboardEntry({ section: SECTION, view }, true);
    }
    const onPopState = () => {
      if (readDashboardEntry()?.section === SECTION) setView(viewFromHistory());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // Once: pageFromHistory only reads isDemo, fixed for the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goView = (next: PlanView) => {
    pushDashboardEntry({ section: SECTION, view: next });
    setView(next);
    window.scrollTo({ top: 0 });
  };
  const go = (next: PlanPage) => goView({ page: next });
  const openBacktest = (uuid: string, sub: BacktestPage = "overview") => goView({ page: "backtest", uuid, sub });
  const strategyTrail: Crumb[] = [{ label: "Strategy", onClick: () => go("strategy") }];

  if (page === "builder") {
    return <StrategyBuilder trail={strategyTrail} onCreated={(uuid) => openBacktest(uuid)} />;
  }
  if (page === "explore") {
    return (
      <StrategiesExplore
        trail={strategyTrail}
        publicationId={view.publicationId}
        onOpen={(publicationId) => goView(publicationId ? { page: "explore", publicationId } : { page: "explore" })}
        onNavigate={onNavigate}
      />
    );
  }

  // A backtest's page: the same as a portfolio's in Wealth, without what a simulation doesn't
  // have (see PortfolioNode). Adopting it opens the new, real portfolio in Wealth. Until a just
  // created backtest is in the list, Strategy stands in for it.
  const backtest = page === "backtest" ? portfolios.find((p) => p.uuid === view.uuid && isBacktest(p)) : undefined;
  if (backtest) {
    return (
      <PortfolioNode
        key={backtest.uuid}
        portfolio={backtest}
        page={view.sub ?? "overview"}
        trail={strategyTrail}
        isInvestments={false}
        onOpen={(uuid, next) =>
          uuid === backtest.uuid
            ? openBacktest(uuid, next === "transactions" ? "transactions" : "overview")
            : openPortfolioPage(onNavigate, uuid, next)}
        onBacktestGone={() => go("strategy")}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {isDemo && <PlanFlow page={page} onGo={go} />}
      {page === "profile" && <ProfilePreview />}
      {page === "goals" && <GoalsPreview />}
      {page === "retirement" && <RetirementPreview />}
      {(page === "strategy" || page === "backtest") && <StrategyPage onBuild={() => go("builder")} onExplore={() => go("explore")} onOpen={openBacktest} onNavigate={onNavigate} />}
    </div>
  );
}

/** How Plan's pages chain together, the current one marked: a way between them too. */
function PlanFlow({ page, onGo }: { page: PlanPage; onGo: (page: PlanPage) => void }) {
  const steps: { id: PlanPage; label: string }[] = [
    { id: "profile", label: "Investor profile" },
    { id: "goals", label: "Goals" },
    { id: "retirement", label: "Retirement" },
    { id: "strategy", label: "Strategy" },
  ];
  return (
    <nav aria-label="Plan steps" className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-slate-200">
      {steps.map((s, i) => (
        <span key={s.id} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onGo(s.id)}
            aria-current={s.id === page ? "step" : undefined}
            className={`min-h-9 px-3.5 rounded-full text-[13px] font-bold transition-colors ${
              s.id === page ? "bg-[#1c1917] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s.label}
          </button>
          {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300" />}
        </span>
      ))}
      <ChevronRight className="h-4 w-4 text-slate-300" />
      <span className="text-[13px] font-semibold text-slate-400">Adopt into a portfolio, kept in range by its alerts</span>
    </nav>
  );
}

function PreviewPage({ title, feature, intro, panels }: { title: string; feature: string; intro: string; panels: { title: string; text: string }[] }) {
  return (
    <>
      <Breadcrumb trail={[]} current={title} />
      <PreviewBanner feature={feature}>{intro}</PreviewBanner>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {panels.map((p) => (
          <Panel key={p.title} title={p.title}>
            <p className="px-6 md:px-7 py-5 text-[13px] text-slate-500 leading-relaxed">{p.text}</p>
          </Panel>
        ))}
      </div>
    </>
  );
}

function ProfilePreview() {
  return (
    <PreviewPage
      title="Investor profile"
      feature="Investor profile"
      intro="Who you are as an investor: the start of your investor policy statement, which Goals, Retirement and Strategy build on. Nothing is asked or saved yet."
      panels={[
        { title: "Objectives and horizon", text: "What you invest for, and for how long." },
        { title: "Risk tolerance", text: "A short questionnaire, and the profile it gives." },
        { title: "Constraints", text: "Liquidity you need, taxes, what you won't hold." },
        { title: "Investor policy statement", text: "The document it all adds up to, to read and download, and the ranges your portfolios are kept in." },
      ]}
    />
  );
}

function GoalsPreview() {
  return (
    <PreviewPage
      title="Goals"
      feature="Goals"
      intro="What the money is for: each goal with an amount, a date and the portfolios funding it, and how far along it is."
      panels={[
        { title: "Your goals", text: "A house, education, an emergency fund: each one's target and date." },
        { title: "Progress", text: "How far each goal is, from the portfolios you assign to it." },
      ]}
    />
  );
}

function RetirementPreview() {
  return (
    <PreviewPage
      title="Retirement"
      feature="Retirement"
      intro="When you could retire, and what it would take: a simulation on your profile and portfolios."
      panels={[
        { title: "Inputs", text: "Your age, what you add each month and what you'd spend in retirement." },
        { title: "Simulation", text: "The range of outcomes over the years, not a single number." },
      ]}
    />
  );
}

/**
 * STRATEGY — the backtests the user made, each to open (its page, under Strategy), adopt or
 * delete, and New strategy: build one's own (StrategyBuilder), or first explore the ones advisors
 * publish (Explore, read only). Adopting puts the strategy on a portfolio the user picks (or a new
 * one) and opens that portfolio's Strategy page, where its ranges are. A demo account sees the
 * backtests but can't create, adopt or delete.
 *
 * An advisor adopts theirs on a client's portfolio (opening it in the client's Wealth, where it's
 * shared with the client or not), and publishes them to Explore or withdraws them.
 */
function StrategyPage({ onBuild, onExplore, onOpen, onNavigate }: {
  onBuild: () => void;
  onExplore: () => void;
  onOpen: (uuid: string) => void;
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
  const [choosing, setChoosing] = useState(false);
  const [deleting, setDeleting] = useState<Portfolio | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const backtests = portfolios.filter(isBacktest);

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
    <>
      <Breadcrumb
        trail={[]}
        current="Strategy"
        right={
          <button
            type="button"
            onClick={() => setChoosing(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> New strategy
          </button>
        }
      />
      <p className="text-[13px] text-slate-500 leading-relaxed max-w-2xl">
        {canPublish
          ? "Backtest a strategy on historical prices. Adopt it on a client's portfolio: each of its targets becomes a range, and an alert tells you where the portfolio stands against it; share it to let the client read it. Or publish it to Explore, for everyone to read."
          : "Backtest how you would invest on historical prices, or first explore the strategies advisors publish. When one of yours fits, adopt it on one of your portfolios: each of its targets becomes a range, and an alert says where the portfolio stands against it."}
      </p>

      {backtests.length === 0 ? (
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="min-h-44 w-full rounded-3xl border-2 border-dashed border-sky-300 bg-sky-50/40 flex flex-col items-center justify-center gap-2 px-6 text-center text-sky-700 hover:border-sky-500 transition-colors"
        >
          <History className="h-6 w-6" />
          <span className="text-[13px] font-bold">No backtests yet</span>
          <span className="text-[11px] font-semibold text-sky-700/70">Set up a strategy and see how it would have done.</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {backtests.map((p) => (
            <article key={p.uuid} className="rounded-3xl border-2 border-dashed border-sky-300 bg-white p-5 md:p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <VirtualBadge portfolio={p} />
                    {publications?.has(p.uuid) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                        <Telescope className="h-3 w-3" /> In Explore
                      </span>
                    )}
                  </span>
                  <h3 className="mt-2 text-lg font-black text-slate-900 truncate" style={serif}>{p.name}</h3>
                  <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Created {createdLabel(p.createdAt)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setDeleteError(null); setDeleting(p); }}
                  disabled={isDemo}
                  aria-label={`Delete ${p.name}`}
                  title={isDemo ? DEMO_DISABLED_TITLE : "Delete this backtest"}
                  className="p-2 -mr-1 -mt-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpen(p.uuid)}
                  className="flex items-center gap-1.5 min-h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:border-slate-300 transition-colors"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" /> Open
                </button>
                <button
                  type="button"
                  onClick={() => setAdopting(p)}
                  disabled={isDemo}
                  title={isDemo ? DEMO_DISABLED_TITLE : "Keep one of your portfolios in this strategy's ranges"}
                  className="flex items-center gap-1.5 min-h-10 px-4 rounded-xl bg-sky-700 text-white text-xs font-bold hover:bg-sky-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Target className="h-3.5 w-3.5" /> {canPublish ? "Adopt on a client" : "Adopt this strategy"}
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
          ))}
        </div>
      )}

      {choosing && (
        <NewStrategyDialog
          onBuild={() => { setChoosing(false); onBuild(); }}
          onExplore={() => { setChoosing(false); onExplore(); }}
          onClose={() => setChoosing(false)}
        />
      )}

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
          title={`Withdraw "${withdrawing.portfolioName}" from Explore?`}
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
            else openPortfolioPage(onNavigate, uuid, "strategy");
          }}
          onOpenCategories={(clientUuid) => {
            setAdopting(null);
            // A client's: on their investments, whichever portfolio stands for them.
            if (clientUuid) return openClientPage(onNavigate, clientUuid, { kind: "portfolio", uuid: "", page: "categories" });
            const investments = investmentsOf(portfolios);
            if (investments) openPortfolioPage(onNavigate, investments.uuid, "categories");
          }}
        />
      )}
    </>
  );
}

/**
 * NEW STRATEGY — where a new strategy starts: from scratch (StrategyBuilder's backtest), or from
 * the catalog, to see how other mixes and rules would have behaved first. In ConfirmDialog's shell.
 */
function NewStrategyDialog({ onBuild, onExplore, onClose }: {
  onBuild: () => void;
  onExplore: () => void;
  onClose: () => void;
}) {
  const options = [
    {
      key: "build",
      icon: Wrench,
      title: "Build your own",
      text: "Pick the securities or asset classes, their weights and how it rebalances, and backtest it on historical prices.",
      onClick: onBuild,
    },
    {
      key: "explore",
      icon: Telescope,
      title: "Explore published strategies",
      text: "Browse the strategies advisors have published, each simulated, to see how different mixes would have behaved.",
      onClick: onExplore,
    },
  ];
  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-strategy-title"
        className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 md:p-8 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#C49A3C]/10 rounded-xl shrink-0">
              <Plus className="h-5 w-5 text-[#C49A3C]" />
            </div>
            <div>
              <h3 id="new-strategy-title" className="text-lg font-black text-slate-900">New strategy</h3>
              <p className="text-xs text-slate-500">Start from scratch, or look around first.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3">
          {options.map((o, i) => (
            <button
              key={o.key}
              type="button"
              autoFocus={i === 0}
              onClick={o.onClick}
              className="group flex items-start gap-4 p-4 rounded-2xl border border-slate-200 text-left hover:border-[#C49A3C]/60 hover:bg-[#F7F5EF] transition-colors"
            >
              <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-[#C49A3C]/15 group-hover:text-[#C49A3C] transition-colors">
                <o.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-black text-slate-900">{o.title}</span>
                <span className="block mt-0.5 text-xs text-slate-500 leading-relaxed">{o.text}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300 mt-3 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
