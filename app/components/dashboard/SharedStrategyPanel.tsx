// components/dashboard/SharedStrategyPanel.tsx
"use client";

import { ArrowUpRight, UserRound } from "lucide-react";
import { formatAlertPct, formatRange } from "../../lib/alerts";
import { exchangeLabel } from "../../models/AssetSearch";
import { targetLabel, type StrategyTarget } from "../../models/Strategy";
import type { SharedStrategy, TargetStanding } from "../../models/AdoptedStrategy";
import { describeRebalancing } from "./BacktestMarks";

const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

const targetKey = (t: StrategyTarget) => (t.kind === "asset" ? `asset:${t.asset.assetId ?? t.asset.ticker}` : t.category);

/**
 * STRATEGY FROM YOUR ADVISOR — a strategy the client's advisor shared for one of their portfolios
 * (GET .../shared-strategies), read-only: each held target with its band, the portfolio's weight in
 * it as of the last check, the drift from the target and whether it's within the band; the
 * rebalancing rule, when it was shared, and the way to the advisor's simulation (their strategy
 * portfolio, readable while it's shared). No edit controls: the advisor keeps it. It says where the
 * portfolio stands, never what to buy or sell.
 */
export function SharedStrategyPanel({ shared, showPortfolio = false, onOpenSimulation }: {
  shared: SharedStrategy;
  // Where it's listed apart from its portfolio's page (GET /v1/portfolios/shared-strategies):
  // say which portfolio it's for.
  showPortfolio?: boolean;
  onOpenSimulation: (portfolioUuid: string) => void;
}) {
  // Every held target, with its standing when there's one.
  const rows: (Partial<TargetStanding> & { target: StrategyTarget })[] = shared.standings.length > 0
    ? shared.standings
    : shared.strategy.targets.filter((t) => t.weightPct > 0).map((target) => ({ target }));
  const checkedAt = shared.standings.map((s) => s.evaluatedAt).filter((d): d is string => !!d).sort().at(-1);

  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 md:px-7 pt-5 pb-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#C49A3C]/10 text-[10px] font-black uppercase tracking-wider text-[#8A6A28]">
            <UserRound className="h-3 w-3" /> Shared by {shared.advisorName ?? "your advisor"}
          </span>
          <h3 className="mt-2 text-xl font-black text-slate-900 leading-tight" style={serif}>
            Strategy from {shared.advisorName ?? "your advisor"}{showPortfolio ? ` · ${shared.portfolioName}` : ""}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Shared on {dateLabel(shared.sharedAt)}
            {shared.updatedAt !== shared.sharedAt && `, updated ${dateLabel(shared.updatedAt)}`}
            {" "}· {describeRebalancing(shared.strategy.rebalancing)}
          </p>
        </div>
        {shared.originPortfolioUuid ? (
          <button
            type="button"
            onClick={() => onOpenSimulation(shared.originPortfolioUuid!)}
            className="flex items-center gap-1.5 min-h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:border-slate-300 transition-colors"
          >
            Open the simulation <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="text-[11px] font-semibold text-slate-400">Its simulation has been deleted; the strategy stays.</span>
        )}
      </div>

      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_5rem_7rem_5rem_5.5rem_7.5rem] gap-4 px-6 md:px-7 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <span>Target</span>
        <span className="text-right">Weight</span>
        <span className="text-right">Band</span>
        <span className="text-right">Now</span>
        <span className="text-right">Drift</span>
        <span className="text-right">Status</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => {
          const t = row.target;
          const now = row.currentPct ?? null;
          const drift = now != null ? now - t.weightPct : null;
          return (
            <li
              key={targetKey(t)}
              className="px-6 md:px-7 py-3.5 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_5rem_7rem_5rem_5.5rem_7.5rem] items-center gap-x-4 gap-y-1.5"
            >
              <span className="min-w-0">
                <span className="block text-[13px] font-black text-slate-900 truncate">{targetLabel(t)}</span>
                <span className="block text-[11px] font-semibold text-slate-500 truncate">
                  {t.kind === "asset" ? [t.asset.ticker, exchangeLabel(t.asset.exchangeMic ?? null)].filter(Boolean).join(" · ") : "Asset class"}
                </span>
              </span>
              <Cell label="Weight">{formatAlertPct(t.weightPct)}</Cell>
              <Cell label="Band">{row.minPct != null || row.maxPct != null ? formatRange(row.minPct, row.maxPct) : "—"}</Cell>
              <Cell label="Now">{now != null ? formatAlertPct(now) : "—"}</Cell>
              <Cell label="Drift">{drift != null ? `${drift > 0 ? "+" : drift < 0 ? "−" : ""}${Number(Math.abs(drift).toFixed(2))} pts` : "—"}</Cell>
              <span className="col-span-2 md:col-span-1 md:text-right">
                <BandStatus outOfBand={row.outOfBand ?? null} />
              </span>
            </li>
          );
        })}
      </ul>

      <p className="px-6 md:px-7 py-4 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
        {checkedAt ? `Weights as of ${dateLabel(checkedAt)}. ` : "Weights show up after the first check. "}
        {shared.advisorName ?? "Your advisor"} set these ranges and keeps them; they show where the portfolio stands against them, they aren&apos;t
        an instruction to buy or sell.
      </p>
    </section>
  );
}

/** One figure of a row: in its column on wide screens, labelled inline on narrow ones. */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="md:text-right text-[12px] font-bold tabular-nums text-slate-700 col-span-2 md:col-span-1 flex md:block justify-between">
      <span className="md:hidden text-[11px] font-semibold text-slate-400">{label}</span>
      {children}
    </span>
  );
}

function BandStatus({ outOfBand }: { outOfBand: boolean | null }) {
  if (outOfBand == null) return <span className="text-[11px] font-semibold text-slate-400">Waiting for the first check</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${outOfBand ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${outOfBand ? "bg-amber-500" : "bg-emerald-600"}`} />
      {outOfBand ? "Outside its band" : "Within its band"}
    </span>
  );
}
