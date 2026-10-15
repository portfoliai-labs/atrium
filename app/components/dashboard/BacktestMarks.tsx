// components/dashboard/BacktestMarks.tsx
"use client";

import { useEffect, useState } from "react";
import { History, Layers } from "lucide-react";
import { portfoliosService } from "../../services/portfoliosService";
import { useUser } from "../../context/UserContext";
import { formatCurrency } from "../../lib/format";
import {
  simulatedPeriod,
  targetLabel,
  type StrategyFrequency, type StrategyParams, type StrategyRebalancing, type StrategyResponse,
} from "../../models/Strategy";

/**
 * VIRTUAL MARKS — how a virtual portfolio (one the backend puts together, see models/Portfolio)
 * reads as apart from the user's real portfolios wherever it shows up next to them: a pill by its
 * name (hub card, Compare) saying which kind it is — "Combined" for "All portfolios", "Backtest"
 * for a strategy's backtest (see models/Strategy) — and a dashed outline on its card. A backtest
 * also gets a strip at the top of its pages saying what it is and the strategy it plays. One colour
 * for all of it, apart from the gold of real portfolios and the violet of the previews on sample
 * data.
 */

export const VIRTUAL_COLOR = "#0284c7";

const BACKTEST_TITLE = "Virtual portfolio: a strategy backtested on historical prices. Read only, not part of your net worth.";
const COMBINED_TITLE = "Virtual portfolio: all your portfolios together, recomputed from every transaction. Read only.";

/** The pill by a virtual portfolio's name: "Combined" (the aggregate) or "Backtest". */
export function VirtualBadge({ portfolio, dark = false }: { portfolio: { isAggregate: boolean }; dark?: boolean }) {
  const Icon = portfolio.isAggregate ? Layers : History;
  return (
    <span
      title={portfolio.isAggregate ? COMBINED_TITLE : BACKTEST_TITLE}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider leading-none shrink-0 border ${
        dark ? "bg-sky-400/15 text-sky-200 border-sky-300/30" : "bg-sky-50 text-sky-700 border-sky-200"
      }`}
    >
      <Icon className="h-2.5 w-2.5" />
      {portfolio.isAggregate ? "Combined" : "Backtest"}
    </span>
  );
}

const FREQUENCY_LABELS: Record<StrategyFrequency, string> = {
  monthly: "every month",
  quarterly: "every quarter",
  semiannual: "every six months",
  annual: "every year",
};

/** A strategy's rebalancing rule in a few words: "Rebalanced every year and past ±5 pts". */
export function describeRebalancing({ mode, frequency, thresholdPct, relativeThresholdPct }: StrategyRebalancing): string {
  const bands = [
    thresholdPct != null ? `±${thresholdPct} pts` : null,
    relativeThresholdPct != null ? `±${relativeThresholdPct}% of the weight` : null,
  ].filter(Boolean).join(" or ");
  return mode === "none" ? "Never rebalanced"
    : mode === "calendar" ? `Rebalanced ${FREQUENCY_LABELS[frequency]}`
      : mode === "threshold" ? `Rebalanced past ${bands}`
        : `Rebalanced ${FREQUENCY_LABELS[frequency]} and past ${bands}`;
}

/**
 * The strategy in a few short lines: what it holds (a security by its ticker), what went in, over
 * when (once the backtest has run), and its rules.
 */
export function describeStrategy(s: StrategyParams & Partial<Pick<StrategyResponse, "startedOn">>, currency: string): string[] {
  const weights = s.targets
    .filter((t) => t.weightPct > 0)
    .map((t) => `${t.kind === "asset" ? t.asset.ticker : targetLabel(t)} ${t.weightPct}%`)
    .join(" · ");
  const period = simulatedPeriod(s.startedOn);
  const flow = (f: StrategyParams["contributions"] | StrategyParams["withdrawals"]) =>
    `${f.amountType === "percent_of_value" ? `${f.amount}% of the value` : formatCurrency(f.amount, currency, 0)} ${FREQUENCY_LABELS[f.frequency]}`;

  const rebalancing = describeRebalancing(s.rebalancing);

  const lines = [
    weights,
    `${formatCurrency(s.initialAmount, currency, 0)} invested at the start`,
    ...(period ? [period] : []),
    rebalancing,
  ];
  if (s.contributions.enabled) lines.push(`Adds ${flow(s.contributions)}`);
  if (s.withdrawals.enabled) {
    lines.push(`Takes out ${flow(s.withdrawals)}${s.withdrawals.startAfterYears > 0 ? `, after ${s.withdrawals.startAfterYears} ${s.withdrawals.startAfterYears === 1 ? "year" : "years"}` : ""}`);
  }
  return lines;
}

/**
 * The strip at the top of a backtest's pages: that it's simulated and read only, and, with
 * `showStrategy`, the strategy it was made from (GET /v1/portfolios/{p}/strategy).
 */
export function BacktestBanner({ portfolioUuid, showStrategy = false }: { portfolioUuid: string; showStrategy?: boolean }) {
  // A strategy's amounts are in its owner's reference currency: the user's own, unless it's
  // someone else's (shared, published).
  const userCurrency = useUser().user?.currency ?? "EUR";
  const [strategy, setStrategy] = useState<StrategyResponse | null>(null);

  useEffect(() => {
    if (!showStrategy) return;
    let cancelled = false;
    portfoliosService.getStrategy(portfolioUuid)
      .then((s) => { if (!cancelled) setStrategy(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [portfolioUuid, showStrategy]);

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-dashed border-sky-300 bg-sky-50/70 px-4 py-3.5">
      <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
        <History className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-black text-sky-950">Virtual portfolio — a backtest, not real money</p>
        <p className="text-xs text-sky-900/80 mt-0.5 leading-relaxed">
          Its transactions were generated by playing a strategy on historical prices, so they can&apos;t be edited, and it
          isn&apos;t counted in your net worth. Past returns don&apos;t predict future ones.
        </p>
        {strategy && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {describeStrategy(strategy, strategy.currency ?? userCurrency).map((line) => (
              <li key={line} className="px-2.5 py-1 rounded-full bg-white border border-sky-200 text-[11px] font-bold text-sky-900">{line}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
