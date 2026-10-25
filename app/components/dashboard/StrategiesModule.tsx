// components/dashboard/StrategiesModule.tsx
"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { investmentsKey, useInvestmentsRead, usePortfolio } from "../../context/PortfolioContext";
import { usePortfoliosAlertRules, type PortfolioAlertRule } from "../../hooks/useAlertRules";
import { adoptionService } from "../../services/adoptionService";
import { portfoliosService } from "../../services/portfoliosService";
import { publicationService } from "../../services/publicationService";
import { alertState } from "../../lib/alerts";
import { openBacktestPage, openStrategiesPage } from "../../lib/dashboardNav";
import { isBacktest } from "../../models/Portfolio";
import type { SharedStrategy } from "../../models/AdoptedStrategy";
import type { PublishedStrategy } from "../../models/PublishedStrategy";
import { MODULE_BODY, Module, ModuleHead } from "./PerformanceSection";
import { formatPct } from "./CompareCharts";

const DESC = "The strategies your portfolios follow and where each one stands against its ranges; without one, your backtests by their yearly return; without those, the newest strategies advisors published.";

// The backtests listed when no portfolio follows a strategy.
const BACKTESTS_SHOWN = 3;
// The catalog's, without either: its newest (its own order, no pick by figures).
const CATALOG_QUERY = { limit: 2 };

type Tone = "danger" | "ok" | "muted";
const TONE_CLASS: Record<Tone, string> = { danger: "text-[#e11d48]", ok: "text-[#047857]", muted: "text-[#857e78]" };

// One strategy a portfolio follows: the user's own adoption (its rules) or one their advisor shared (its standings).
interface Followed {
  key: string;
  portfolioUuid: string;
  portfolioName: string;
  // What it came from: its backtest, or the advisor who shared it.
  sub: string;
  status: string;
  tone: Tone;
}

/** Where an adoption stands, from its rules: the targets outside their range, else whether they're all within. */
function adoptionStatus(rules: PortfolioAlertRule[]): { status: string; tone: Tone } {
  const states = rules.map(alertState);
  const live = states.filter((s) => s.kind !== "off" && s.kind !== "pending" && s.kind !== "unavailable");
  const out = live.filter((s) => s.breached).length;
  if (out > 0) return { status: `${out} of ${rules.length} ${rules.length === 1 ? "target" : "targets"} outside the range`, tone: "danger" };
  if (states.every((s) => s.kind === "off")) return { status: "Its alerts are off", tone: "muted" };
  if (live.length === 0) return { status: "Waiting for the first check", tone: "muted" };
  return { status: live.length === rules.length ? "Every target within its range" : `${live.length} of ${rules.length} targets within the range`, tone: "ok" };
}

/** A shared strategy's standings in the same words; null readings are those not checked yet. */
function sharedStatus(s: SharedStrategy): { status: string; tone: Tone } {
  const checked = s.standings.filter((t) => t.outOfBand !== null);
  const out = checked.filter((t) => t.outOfBand).length;
  if (out > 0) return { status: `${out} of ${s.standings.length} ${s.standings.length === 1 ? "target" : "targets"} outside the range`, tone: "danger" };
  if (checked.length === 0) return { status: "Waiting for the first check", tone: "muted" };
  return { status: "Every target within its range", tone: "ok" };
}

/** A published strategy's whole history, the figures the catalog shows together: never the return alone. */
const sinceStart = (s: PublishedStrategy) => s.horizons.find((h) => h.horizon === "inception") ?? null;

/**
 * STRATEGIES — the investments' preview of Strategies, beside Compare on All portfolios (across the
 * page on the only portfolio). The strategies the portfolios follow, a line each: the user's own
 * adoptions, read from the alert rules they keep (`source` "adoption:<id>", the list the page's
 * header already reads, so nothing more is asked but each adoption's backtest, for its name), and
 * those their advisor shared (GET /v1/portfolios/shared-strategies, with their standings); each
 * says how many targets are outside their range and opens its portfolio's Strategy page
 * (`onOpenStrategy`). Without any, the user's backtests by their annualized return (GET
 * /v1/portfolios/comparison), beside the investments' own, each opening its backtest. Without
 * backtests either, the catalog's two newest (GET /v1/explore/strategies, Strategies' own read),
 * each with its yearly return, volatility and worst drop since its start, as the catalog always
 * shows them, opening its page; and the way to build one. The module opens Strategies (`onNavigate`). The
 * investor's own: not on an advisor's view of a client.
 */
export function StrategiesModule({ investmentsUuid, onOpenStrategy, onNavigate }: {
  investmentsUuid: string;
  onOpenStrategy: (portfolioUuid: string) => void;
  onNavigate: (section: string) => void;
}) {
  const { portfolios } = usePortfolio();
  const name = (uuid: string | null) => (uuid ? portfolios.find((p) => p.uuid === uuid)?.name : undefined);
  const scope = useMemo(() => portfolios.filter((p) => !isBacktest(p)).map((p) => p.uuid), [portfolios]);
  const backtests = useMemo(() => portfolios.filter(isBacktest), [portfolios]);

  // The adoptions' rules, by adoption.
  const { rules } = usePortfoliosAlertRules(scope);
  const adoptions = useMemo(() => {
    const bySource = new Map<string, PortfolioAlertRule[]>();
    for (const r of rules ?? []) {
      if (r.source?.startsWith("adoption:")) bySource.set(r.source, [...(bySource.get(r.source) ?? []), r]);
    }
    return [...bySource.entries()].map(([source, kept]) => ({ source, portfolioUuid: kept[0].portfolioUuid, rules: kept }));
  }, [rules]);
  // Each adoption itself, for the backtest it came from: the Strategy page's read (AdoptedStrategyView).
  const adopted = useQueries({
    queries: adoptions.map((a) => ({
      queryKey: investmentsKey("adoption", a.portfolioUuid, "current"),
      queryFn: () => adoptionService.get(a.portfolioUuid),
    })),
  });
  const shared = useInvestmentsRead(["adoption", "shared"], () => adoptionService.listShared());

  const followed: Followed[] = [
    ...adoptions.map((a, i) => {
      const origin = adopted[i]?.data?.originPortfolioUuid ?? null;
      return {
        key: a.source,
        portfolioUuid: a.portfolioUuid,
        portfolioName: name(a.portfolioUuid) ?? "Portfolio",
        sub: name(origin) ?? (adopted[i]?.data ? "Its backtest was deleted" : "Adopted strategy"),
        ...adoptionStatus(a.rules),
      };
    }),
    ...(shared ?? []).map((s) => ({
      key: s.adoptionId,
      portfolioUuid: s.portfolioUuid,
      portfolioName: s.portfolioName,
      sub: s.advisorName ? `Shared by ${s.advisorName}` : "Shared by your advisor",
      ...sharedStatus(s),
    })),
  ];
  // Out of range first.
  followed.sort((a, b) => Number(b.tone === "danger") - Number(a.tone === "danger"));

  const loading = rules === null || shared === undefined;
  const ranking = !loading && followed.length === 0 && backtests.length > 0;
  const uuids = [investmentsUuid, ...backtests.map((p) => p.uuid)];
  const entries = useInvestmentsRead(["comparison", "own", "strategies", uuids], () => portfoliosService.compare(uuids), ranking);
  const yearly = (uuid: string) => entries?.find((e) => e.portfolio.uuid === uuid)?.performance?.annualizedReturnPct ?? null;
  const ranked = [...backtests].sort((a, b) => (yearly(b.uuid) ?? -Infinity) - (yearly(a.uuid) ?? -Infinity)).slice(0, BACKTESTS_SHOWN);
  const own = yearly(investmentsUuid);
  const browsing = !loading && followed.length === 0 && backtests.length === 0;
  const catalog = useInvestmentsRead(["publications", "catalog", CATALOG_QUERY], () => publicationService.list(CATALOG_QUERY), browsing);
  const published = catalog?.strategies ?? [];

  const openStrategies = () => openStrategiesPage(onNavigate, { page: followed.length === 0 && backtests.length > 0 ? "mine" : "home" });

  return (
    <Module className="@container">
      <ModuleHead title="Strategies" desc={DESC} onExplore={openStrategies} />
      <div className={MODULE_BODY}>
        {loading || (ranking && entries === undefined) || (browsing && catalog === undefined) ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 text-slate-300 animate-spin" /></div>
        ) : followed.length > 0 ? (
          <ul className="grid grid-cols-1 @3xl:grid-cols-2 gap-x-6 gap-y-1">
            {followed.map((f) => (
              <li key={f.key}>
                <Row title={f.portfolioName} sub={f.sub} onClick={() => onOpenStrategy(f.portfolioUuid)}>
                  <span className={`block text-[11.5px] font-bold text-right ${TONE_CLASS[f.tone]}`}>{f.status}</span>
                </Row>
              </li>
            ))}
          </ul>
        ) : backtests.length > 0 ? (
          <div className="space-y-2">
            <ul className="grid grid-cols-1 @3xl:grid-cols-3 gap-x-6 gap-y-1">
              {ranked.map((p) => {
                const r = yearly(p.uuid);
                return (
                  <li key={p.uuid}>
                    <Row title={p.name} sub="Your backtest" onClick={() => openBacktestPage(onNavigate, p.uuid)}>
                      <span className={`block text-[13px] font-black tabular-nums text-right ${r === null ? "text-[#857e78]" : r >= 0 ? "text-[#047857]" : "text-[#e11d48]"}`}>
                        {r === null ? "—" : formatPct(r)}
                      </span>
                      <span className="block text-[11px] text-[#857e78] text-right">a year</span>
                    </Row>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11.5px] text-[#78716c]">
              {own !== null ? `Your investments: ${formatPct(own)} a year. ` : ""}
              None is followed yet: adopt one on a portfolio to keep it to its ranges.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {published.length > 0 && (
              <>
                <ul className="grid grid-cols-1 @3xl:grid-cols-2 gap-x-6 gap-y-1">
                  {published.map((s) => {
                    const f = sinceStart(s);
                    return (
                      <li key={s.publicationId}>
                        <Row
                          title={s.portfolioName}
                          sub={s.authorName ? `By ${s.authorName}` : "Published by an advisor"}
                          onClick={() => openStrategiesPage(onNavigate, { page: "published", publicationId: s.publicationId })}
                        >
                          <span className={`block text-[13px] font-black tabular-nums text-right ${f?.annualizedReturnPct == null ? "text-[#857e78]" : f.annualizedReturnPct >= 0 ? "text-[#047857]" : "text-[#e11d48]"}`}>
                            {f?.annualizedReturnPct == null ? "—" : `${formatPct(f.annualizedReturnPct)} a year`}
                          </span>
                          <span className="block text-[11px] tabular-nums text-[#857e78] text-right truncate">
                            {f ? `Volatility ${f.volatilityPct == null ? "—" : `${f.volatilityPct.toFixed(1)}%`} · worst ${f.maxDrawdownPct == null ? "—" : `${f.maxDrawdownPct.toFixed(1)}%`}` : "Figures not computed yet"}
                          </span>
                        </Row>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[11px] text-[#857e78]">Simulated on historical prices since each one&apos;s start, net of its trading costs; not advice.</p>
              </>
            )}
            <p className="text-[12.5px] text-[#78716c] max-w-md">
              {published.length > 0
                ? "Or backtest how you would invest, then adopt it on a portfolio: each target becomes a range, and an alert says where the portfolio stands against it."
                : "Backtest how you would invest on historical prices, then adopt the strategy on a portfolio: each target becomes a range, and an alert says where the portfolio stands against it."}
            </p>
            <button
              type="button"
              onClick={() => openStrategiesPage(onNavigate, { page: "builder" })}
              className="inline-flex items-center gap-1 text-[12px] font-bold text-[#C49A3C] hover:text-[#1c1917]"
            >
              Backtest a strategy <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </Module>
  );
}

/** A line of the module: what it is on the left, how it stands on the right; it opens its own page. */
function Row({ title, sub, onClick, children }: { title: string; sub: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 text-left rounded-lg -mx-2 px-2 py-1.5 hover:bg-[#FBFAF6]"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-[#1c1917] truncate">{title}</span>
        <span className="block text-[11px] text-[#857e78] truncate">{sub}</span>
      </span>
      <span className="min-w-0 max-w-[14rem]">{children}</span>
    </button>
  );
}
