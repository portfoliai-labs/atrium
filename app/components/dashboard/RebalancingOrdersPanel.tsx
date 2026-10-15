// components/dashboard/RebalancingOrdersPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Loader2, Scale } from "lucide-react";
import { adoptionService } from "../../services/adoptionService";
import { ApiError } from "../../services/apiClient";
import { formatCurrency, formatQuantity } from "../../lib/format";
import { formatAlertPct } from "../../lib/alerts";
import { TAX_DISCLAIMER, categoryLabel } from "../../lib/taxes";
import { targetLabel } from "../../models/Strategy";
import type { RebalancingMode, RebalancingOrder, RebalancingOrders } from "../../models/Rebalancing";

const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;

const MODES: { mode: RebalancingMode; label: string; detail: string }[] = [
  { mode: "full", label: "Full", detail: "Sells what's above its target, then buys what's below" },
  { mode: "buy_only", label: "Buy only", detail: "Buys with the cash and the contribution, sells nothing" },
];

type Loaded = Record<RebalancingMode, RebalancingOrders>;

/**
 * REBALANCING ORDERS — under an adopted strategy (AdoptedStrategyView), the orders that would take
 * the portfolio back to it (GET .../adopted-strategy/rebalancing-orders), at its last tick's
 * prices: "Full" or "Buy only", with a contribution of new cash. Both modes are asked at once, so
 * the tax a full rebalance costs over buying only reads beside them. Suggestions: nothing is
 * recorded, and the tax figures are estimates (TAX_DISCLAIMER). A standard portfolio's only: on a
 * virtual one (the aggregate) the backend refuses it, and the panel says so.
 */
export function RebalancingOrdersPanel({ portfolioUuid }: { portfolioUuid: string }) {
  const [mode, setMode] = useState<RebalancingMode>("full");
  const [contributionText, setContributionText] = useState("");
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The contribution the shown orders were computed for: another one is on its way while they differ.
  const [answeredFor, setAnsweredFor] = useState<number | null>(null);

  const parsed = contributionText.trim() === "" ? 0 : Number(contributionText.replace(",", "."));
  const contributionProblem = !Number.isFinite(parsed) || parsed < 0 ? "Enter an amount of 0 or more." : null;
  const contribution = contributionProblem ? null : parsed;
  const loading = contribution !== null && answeredFor !== contribution;

  useEffect(() => {
    if (contribution === null) return;
    let cancelled = false;
    // Waits for the typing to stop before asking.
    const timer = setTimeout(async () => {
      try {
        const [full, buyOnly] = await Promise.all([
          adoptionService.rebalancingOrders(portfolioUuid, "full", contribution),
          adoptionService.rebalancingOrders(portfolioUuid, "buy_only", contribution),
        ]);
        if (cancelled) return;
        setData({ full, buy_only: buyOnly });
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError && err.status === 409 ? "Orders are computed on a single portfolio, not on a backtest or on all of them together."
            : err instanceof Error ? err.message : "Unable to compute the orders.",
        );
      } finally {
        if (!cancelled) setAnsweredFor(contribution);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [portfolioUuid, contribution]);

  const shown = data?.[mode];
  const money = (v: number) => formatCurrency(v, shown?.currency ?? "EUR");
  const sells = shown?.orders.filter((o) => o.side === "sell") ?? [];
  const buys = shown?.orders.filter((o) => o.side === "buy") ?? [];
  const fullTax = data?.full.taxes?.tax ?? null;
  const buyOnlyTax = data?.buy_only.taxes?.tax ?? 0;

  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 md:px-7 pt-5 pb-4 border-b border-slate-100 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-xl font-black text-slate-900 leading-tight" style={serif}>
            <Scale className="h-5 w-5 text-[#C49A3C]" /> Back to the strategy
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            The orders that would bring the portfolio to its targets
            {shown?.pricedAt && <>, at the prices of {new Date(shown.pricedAt).toLocaleString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</>}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">New cash to invest</span>
            <span className="relative block">
              <input
                type="text"
                inputMode="decimal"
                value={contributionText}
                placeholder="0"
                onChange={(e) => setContributionText(e.target.value)}
                aria-invalid={contributionProblem !== null}
                className={`w-40 h-10 px-3 pr-12 rounded-xl bg-white border text-sm font-semibold tabular-nums text-slate-900 outline-none placeholder:text-slate-300 focus:ring-4 focus:ring-[#C49A3C]/10 ${
                  contributionProblem ? "border-rose-300" : "border-slate-200 focus:border-[#C49A3C]/60"
                }`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">{shown?.currency ?? ""}</span>
            </span>
          </label>
          <span role="radiogroup" aria-label="Rebalancing mode" className="flex h-10 p-1 rounded-xl bg-slate-100">
            {MODES.map((m) => (
              <button
                key={m.mode}
                type="button"
                role="radio"
                aria-checked={mode === m.mode}
                title={m.detail}
                onClick={() => setMode(m.mode)}
                className={`px-3 rounded-lg text-xs font-bold transition-colors ${mode === m.mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {m.label}
              </button>
            ))}
          </span>
        </div>
      </div>

      {contributionProblem && <p className="px-6 md:px-7 pt-3 text-xs font-semibold text-rose-600">{contributionProblem}</p>}

      {error ? (
        <p className="px-6 md:px-7 py-6 text-sm font-semibold text-rose-600">{error}</p>
      ) : !shown ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" /></div>
      ) : !shown.pricedAt ? (
        <p className="px-6 md:px-7 py-6 text-sm text-slate-500">The portfolio isn&apos;t valued yet: the orders come once its prices are in.</p>
      ) : (
        <div className={`transition-opacity ${loading ? "opacity-50" : ""}`}>
          {shown.orders.length === 0 ? (
            <p className="px-6 md:px-7 py-6 text-sm text-slate-500">
              {mode === "buy_only" && shown.cashBefore + shown.contribution <= 0
                ? "Nothing to buy: there's no cash. Add new cash to invest, or rebalance in full."
                : "Nothing to trade: the portfolio is on its strategy."}
            </p>
          ) : (
            <>
              <OrderGroup title="Sell" orders={sells} money={money} taxCurrency={shown.taxes?.currency ?? shown.currency} />
              <OrderGroup title="Buy" orders={buys} money={money} taxCurrency={shown.currency} />
            </>
          )}

          <div className="px-6 md:px-7 py-4 border-t border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Weights after the orders</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {shown.allocations.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-[12px]">
                  <span className="min-w-0 truncate font-bold text-slate-700">{targetLabel(a.target)}</span>
                  <span className="shrink-0 flex items-center gap-1.5 tabular-nums">
                    <span className="text-slate-400">{formatAlertPct(a.currentPct)}</span>
                    <ArrowRight className="h-3 w-3 text-slate-300" />
                    <span className="font-black text-slate-900">{formatAlertPct(a.afterPct)}</span>
                    <span className="text-slate-400">/ {formatAlertPct(a.target.weightPct)}</span>
                    {!a.priced && <span title="No price to buy it at: its share stays in cash" className="text-amber-600"><AlertTriangle className="h-3 w-3" /></span>}
                  </span>
                </li>
              ))}
            </ul>
            {shown.untargetedAfterPct > 0 && (
              <p className="mt-2 text-[11px] text-slate-500">
                {formatAlertPct(shown.untargetedAfterPct)} stays in assets the strategy doesn&apos;t cover{mode === "buy_only" ? ": buying only sells nothing" : ""}.
              </p>
            )}
          </div>

          <dl className="px-6 md:px-7 py-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Fig label="Cash now" value={money(shown.cashBefore)} />
            <Fig label="New cash" value={money(shown.contribution)} />
            <Fig label="Cash after" value={money(shown.cashAfter)} />
            <Fig
              label="Tax this year"
              value={!shown.taxes ? "—" : shown.taxes.tax === null ? "No tax residence" : formatCurrency(shown.taxes.tax, shown.taxes.currency)}
              tone={shown.taxes?.tax != null && shown.taxes.tax < 0 ? "good" : undefined}
            />
          </dl>

          {fullTax !== null && fullTax !== buyOnlyTax && (
            <p className="px-6 md:px-7 pb-4 text-xs text-slate-600">
              {fullTax > buyOnlyTax
                ? <>A full rebalance adds <b className="tabular-nums">{formatCurrency(fullTax - buyOnlyTax, data!.full.taxes!.currency)}</b> of tax over buying only.</>
                : <>A full rebalance saves <b className="tabular-nums">{formatCurrency(buyOnlyTax - fullTax, data!.full.taxes!.currency)}</b> of tax: its sales at a loss offset gains.</>}
            </p>
          )}
        </div>
      )}

      <p className="px-6 md:px-7 py-4 border-t border-slate-100 text-[11px] text-slate-400 leading-relaxed">
        Suggestions from the strategy you adopted, at the last prices: nothing is recorded, and what rounding to whole units leaves stays in cash. {TAX_DISCLAIMER}
      </p>
    </section>
  );
}

function OrderGroup({ title, orders, money, taxCurrency }: { title: string; orders: RebalancingOrder[]; money: (v: number) => string; taxCurrency: string }) {
  if (orders.length === 0) return null;
  const sell = title === "Sell";
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <p className={`px-6 md:px-7 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest ${sell ? "text-rose-600" : "text-emerald-700"}`}>{title}</p>
      <ul className="divide-y divide-slate-100">
        {orders.map((o, i) => (
          <li key={`${o.assetId}:${i}`} className="px-6 md:px-7 py-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1">
            <span className="min-w-0">
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-black text-slate-900 truncate">{o.name}</span>
                {o.isProxy && <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-bold">Suggested ETF</span>}
              </span>
              <span className="block text-[11px] font-semibold text-slate-500 truncate">
                {[o.ticker ?? o.isin, o.assetCurrency, o.target ? targetLabel(o.target) : "Not in the strategy"].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="text-right">
              <span className="block text-[13px] font-black tabular-nums text-slate-900">{money(o.amount)}</span>
              <span className="block text-[11px] tabular-nums text-slate-500">{formatQuantity(o.quantity)} × {money(o.price)}</span>
            </span>
            {o.sale && <SaleLine sale={o.sale} currency={taxCurrency} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SaleLine({ sale, currency }: { sale: NonNullable<RebalancingOrder["sale"]>; currency: string }) {
  const parts = [
    `${sale.gain >= 0 ? "Gain" : "Loss"} ${formatCurrency(Math.abs(sale.gain), currency)}`,
    sale.taxCategory && categoryLabel(sale.taxCategory),
    sale.taxableShare != null && sale.taxableShare < 1 && `${formatAlertPct(sale.taxableShare * 100)} taxed`,
    sale.withheldTax != null && `broker withholds ${formatCurrency(sale.withheldTax, currency)}`,
  ].filter(Boolean);
  return (
    <span className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
      <span className={sale.gain >= 0 ? "text-slate-600" : "text-emerald-700"}>{parts.join(" · ")}</span>
      {sale.offsettable === false && sale.gain > 0 && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold" title="Taxed in full: your losses can't offset it">
          <AlertTriangle className="h-3 w-3" /> Doesn&apos;t offset losses
        </span>
      )}
    </span>
  );
}

function Fig({ label, value, tone }: { label: string; value: string; tone?: "good" }) {
  return (
    <div>
      <dt className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</dt>
      <dd className={`mt-0.5 text-sm font-black tabular-nums ${tone === "good" ? "text-emerald-700" : "text-slate-900"}`}>{value}</dd>
    </div>
  );
}
