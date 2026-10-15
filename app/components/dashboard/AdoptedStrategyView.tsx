// components/dashboard/AdoptedStrategyView.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowUpRight, Loader2, Target, X } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";
import { useUser } from "../../context/UserContext";
import { adoptionService } from "../../services/adoptionService";
import { alertService } from "../../services/alertService";
import { openBacktestPage, openPlanPage } from "../../lib/dashboardNav";
import { formatAlertPct, formatRange } from "../../lib/alerts";
import { exchangeLabel } from "../../models/AssetSearch";
import { targetLabel, type StrategyTarget } from "../../models/Strategy";
import { ruleForTarget, targetRange, type AdoptedStrategy, type SharedStrategy } from "../../models/AdoptedStrategy";
import type { AlertRuleResponse } from "../../models/Alert";
import type { Portfolio } from "../../models/Portfolio";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { ConfirmDialog } from "./ConfirmDialog";
import { SharedStrategyPanel } from "./SharedStrategyPanel";
import { ClientStrategySharing } from "./ClientStrategySharing";
import { AdoptStrategyDialog } from "./AdoptStrategyDialog";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";

const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

const targetKey = (t: StrategyTarget) => (t.kind === "asset" ? `asset:${t.asset.assetId ?? t.asset.ticker}` : t.category);

// The refine form: each target's weight (removed ones dropped), and the band.
interface Draft {
  weights: Record<string, number>;
  thresholdPct: number | null;
  relativeThresholdPct: number | null;
}

/**
 * ADOPTED STRATEGY — a portfolio's "Strategy" page in Wealth: the strategy adopted on it (GET
 * /v1/portfolios/{p}/adopted-strategy), the backtest it came from, and one row per target with its
 * weight, its range and where the portfolio stands against it, from the target's alert rule
 * (matched by selector, see models/AdoptedStrategy). It says where the portfolio is, never what to
 * buy or sell. "Refine ranges" changes the targets' weights, drops targets and sets the band (PUT),
 * previewing the ranges that come out; changed rules start again with no reading. "Remove" takes
 * the adoption away with its alerts (DELETE). Without one, the way to adopt one is Plan's Strategy.
 * Above it, read-only, the strategies the user's advisor shared for the portfolio
 * (SharedStrategyPanel); with one of those and no adoption of their own, the way to adopt is left
 * out. A demo account sees it but can't change it.
 *
 * On a client's portfolio (an advisor's, PortfolioContext's `client`) it's the advisor's adoption,
 * from one of their own backtests: adopted here from those (AdoptStrategyDialog), and shared with
 * the client or not (ClientStrategySharing).
 */
export function AdoptedStrategyView({ portfolio, trail, shared = [], onOpenSimulation, onOpenAlerts, onNavigate, onChanged }: {
  portfolio: Portfolio;
  trail: Crumb[];
  shared?: SharedStrategy[];
  onOpenSimulation?: (portfolioUuid: string) => void;
  onOpenAlerts: () => void;
  onNavigate: (section: string) => void;
  // After a change that may add or remove the adoption, so the page header follows.
  onChanged: () => void;
}) {
  const { ownPortfolios, client } = usePortfolio();
  const { isDemo } = useUser();
  const [adopting, setAdopting] = useState(false);
  const [adoption, setAdoption] = useState<AdoptedStrategy | null | undefined>(undefined);
  const [rules, setRules] = useState<AlertRuleResponse[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    try {
      const found = await adoptionService.get(portfolio.uuid);
      setRules(found ? await alertService.listRules(portfolio.uuid, found.source) : []);
      setAdoption(found);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unable to load the adopted strategy.");
    }
  }, [portfolio.uuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const breadcrumb = <Breadcrumb trail={trail} current="Strategy" />;
  const sharedPanels = shared.map((s) => (
    <SharedStrategyPanel
      key={s.adoptionId}
      shared={s}
      onOpenSimulation={(uuid) => onOpenSimulation?.(uuid)}
    />
  ));

  if (loadError) {
    return (
      <div className="space-y-6 pb-12">
        {breadcrumb}
        <p className="text-sm font-semibold text-rose-600">{loadError}</p>
      </div>
    );
  }
  if (adoption === undefined) {
    return (
      <div className="space-y-6 pb-12">
        {breadcrumb}
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" /></div>
      </div>
    );
  }
  // A client's portfolio adopts one of the advisor's backtests, picked here.
  const ownBacktests = client ? ownPortfolios.filter((p) => p.isVirtual && !p.isAggregate) : [];
  const adoptDialog = adopting && (
    <AdoptStrategyDialog
      destination={portfolio}
      onClose={() => setAdopting(false)}
      onAdopted={() => {
        setAdopting(false);
        void load();
        onChanged();
      }}
      onOpenCategories={() => setAdopting(false)}
    />
  );

  if (adoption === null) {
    return (
      <div className="space-y-6 pb-12">
        {breadcrumb}
        {sharedPanels}
        {shared.length === 0 && <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 py-10 flex flex-col items-center text-center gap-2">
          <Target className="h-6 w-6 text-slate-400" />
          <p className="text-sm font-black text-slate-900">No strategy adopted on {portfolio.name}</p>
          <p className="text-xs text-slate-500 max-w-md">
            {client
              ? `Adopt one of your backtests on ${client.name}'s ${portfolio.name}: each of its targets becomes a range, and an alert tells you where the portfolio stands against it. Share it to let ${client.name} read it.`
              : "Backtest a strategy in Plan, then adopt it here: each of its targets becomes a range, and an alert says where the portfolio stands against it."}
          </p>
          <span className="mt-2 flex flex-wrap justify-center gap-2">
            {client && ownBacktests.length > 0 && (
              <button
                type="button"
                onClick={() => setAdopting(true)}
                className="flex items-center gap-1.5 min-h-10 px-4 rounded-xl bg-sky-700 text-white text-xs font-bold hover:bg-sky-800 transition-colors"
              >
                <Target className="h-3.5 w-3.5" /> Adopt one of your strategies
              </button>
            )}
            <button
              type="button"
              onClick={() => openPlanPage(onNavigate, "strategy")}
              className={`flex items-center gap-1.5 min-h-10 px-4 rounded-xl text-xs font-bold transition-colors ${
                client && ownBacktests.length > 0 ? "border border-slate-200 text-slate-700 hover:border-slate-300" : "bg-[#1c1917] text-white hover:bg-[#C49A3C]"
              }`}
            >
              {client && ownBacktests.length === 0 ? "Backtest a strategy" : "Go to Strategy"} <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>}
        {adoptDialog}
      </div>
    );
  }

  const { strategy } = adoption;
  const held = strategy.targets.filter((t) => t.weightPct > 0);
  const origin = adoption.originPortfolioUuid ? ownPortfolios.find((p) => p.uuid === adoption.originPortfolioUuid) : undefined;
  const band = draft ?? strategy.rebalancing;

  const startRefine = () => {
    setSaveError(null);
    setDraft({
      weights: Object.fromEntries(held.map((t) => [targetKey(t), t.weightPct])),
      thresholdPct: strategy.rebalancing.thresholdPct,
      relativeThresholdPct: strategy.rebalancing.relativeThresholdPct,
    });
  };
  const draftTargets = draft ? held.filter((t) => targetKey(t) in draft.weights) : held;
  const draftSum = draft ? Object.values(draft.weights).reduce((s, w) => s + w, 0) : 100;
  const needsBand = strategy.rebalancing.mode === "threshold" || strategy.rebalancing.mode === "both";
  const draftProblem = !draft ? null
    : draftTargets.length === 0 ? "Keep at least one target."
      : Math.abs(draftSum - 100) > 1e-9 ? `The weights must add up to 100% (now ${Number(draftSum.toFixed(2))}%).`
        : needsBand && draft.thresholdPct == null && draft.relativeThresholdPct == null ? "This strategy rebalances on drift: it needs at least one band."
          : null;

  const saveRefine = async () => {
    if (!draft || draftProblem) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await adoptionService.refine(portfolio.uuid, {
        targets: draftTargets.map((t) => ({ ...t, weightPct: draft.weights[targetKey(t)] })),
        rebalancing: { ...strategy.rebalancing, thresholdPct: draft.thresholdPct, relativeThresholdPct: draft.relativeThresholdPct },
      });
      setRules(await alertService.listRules(portfolio.uuid, updated.source));
      setAdoption(updated);
      setDraft(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to save these ranges.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await adoptionService.remove(portfolio.uuid);
      setAdoption(null);
      setConfirmRemove(false);
      onChanged();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to remove this strategy.");
      setConfirmRemove(false);
    } finally {
      setRemoving(false);
    }
  };

  const bandText = [
    band.thresholdPct != null ? `±${formatAlertPct(band.thresholdPct).replace("%", "")} points` : null,
    band.relativeThresholdPct != null ? `±${formatAlertPct(band.relativeThresholdPct)} of the weight` : null,
  ].filter(Boolean).join(" or, if narrower, ") || "±5 points";
  const channels = [adoption.notifyInApp && "in-app", adoption.notifyEmail && "by email"].filter(Boolean).join(" and ") || "on the dashboard only";
  const demo = isDemo ? { disabled: true, title: DEMO_DISABLED_TITLE } : {};

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb
        trail={trail}
        current="Strategy"
        right={draft ? undefined : (
          <span className="flex items-center gap-2">
            <button type="button" onClick={startRefine} {...demo} className="px-4 py-2.5 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-[#1c1917]">
              Refine ranges
            </button>
            <button type="button" onClick={() => setConfirmRemove(true)} {...demo} className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Remove
            </button>
          </span>
        )}
      />

      {sharedPanels}
      {client && <ClientStrategySharing portfolioUuid={portfolio.uuid} adoption={adoption} clientName={client.name} onChange={setAdoption} />}

      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 md:px-7 pt-5 pb-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-black text-slate-900 leading-tight" style={serif}>
              {origin ? origin.name : "Adopted strategy"}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {origin ? (
                <button type="button" onClick={() => openBacktestPage(onNavigate, origin.uuid)} className="inline-flex items-center gap-0.5 font-bold text-sky-700 hover:text-sky-800">
                  Open its backtest <ArrowUpRight className="h-3 w-3" />
                </button>
              ) : "Its backtest has been deleted; the strategy stays."}
              {" "}· adopted {dateLabel(adoption.createdAt)}
              {adoption.updatedAt !== adoption.createdAt && `, refined ${dateLabel(adoption.updatedAt)}`}
            </p>
          </div>
        </div>

        {draft && (
          <div className="px-6 md:px-7 py-4 border-b border-slate-100 bg-slate-50/60 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:max-w-xl">
            <BandField label="Band" suffix="± points" value={draft.thresholdPct} onChange={(v) => setDraft({ ...draft, thresholdPct: v })} />
            <BandField label="Relative band" suffix="± % of weight" value={draft.relativeThresholdPct} onChange={(v) => setDraft({ ...draft, relativeThresholdPct: v })} />
          </div>
        )}

        <div className="hidden md:grid grid-cols-[minmax(0,1fr)_6rem_8rem_minmax(0,1.2fr)] gap-4 px-6 md:px-7 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <span>Target</span>
          <span className="text-right">Weight</span>
          <span className="text-right">Range</span>
          <span>Where it stands</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {draftTargets.map((t) => {
            const key = targetKey(t);
            const weight = draft ? draft.weights[key] : t.weightPct;
            const rule = ruleForTarget(t, rules);
            // A saved range is its rule's; a draft's is previewed the way the backend will set it.
            const range = draft || !rule || rule.params.type !== "weight"
              ? targetRange(weight, band)
              : { minPct: rule.params.minPct, maxPct: rule.params.maxPct };
            return (
              <li key={key} className="px-6 md:px-7 py-3.5 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_6rem_8rem_minmax(0,1.2fr)] items-center gap-x-4 gap-y-2">
                <span className="min-w-0">
                  <span className="block text-[13px] font-black text-slate-900 truncate">{targetLabel(t)}</span>
                  <span className="block text-[11px] font-semibold text-slate-500 truncate">
                    {t.kind === "asset" ? [t.asset.ticker, exchangeLabel(t.asset.exchangeMic ?? null)].filter(Boolean).join(" · ") : "Asset class"}
                  </span>
                </span>
                <span className="flex items-center justify-end gap-1">
                  {draft ? (
                    <>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={weight}
                        onChange={(e) => setDraft({ ...draft, weights: { ...draft.weights, [key]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } })}
                        aria-label={`${targetLabel(t)} weight`}
                        className="w-16 h-8 px-2 rounded-lg bg-white border border-slate-200 text-right text-sm font-black tabular-nums text-slate-900 outline-none focus:border-[#C49A3C]/60"
                      />
                      <span className="text-xs font-bold text-slate-400">%</span>
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, weights: Object.fromEntries(Object.entries(draft.weights).filter(([k]) => k !== key)) })}
                        aria-label={`Remove ${targetLabel(t)}`}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <span className="text-[13px] font-black tabular-nums text-slate-900">{formatAlertPct(weight)}</span>
                  )}
                </span>
                <span className="md:text-right text-[12px] font-bold tabular-nums text-slate-600">
                  {range ? formatRange(range.minPct, range.maxPct) || "Any" : "—"}
                </span>
                <span className="col-span-2 md:col-span-1">
                  {draft
                    ? <span className="text-[11px] text-slate-400">{rule ? "Starts again from the next check once saved, if it changes" : "Gets its alert once saved"}</span>
                    : <Standing rule={rule} range={range} />}
                </span>
              </li>
            );
          })}
        </ul>

        {draft ? (
          <div className="px-6 md:px-7 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <span className={`text-xs font-bold ${draftProblem ? "text-amber-700" : "text-emerald-700"}`}>
              {draftProblem ?? "Total 100% ✓"}
            </span>
            <span className="flex items-center gap-2">
              <button type="button" onClick={() => setDraft(null)} disabled={saving} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={saveRefine} disabled={saving || draftProblem !== null} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save ranges
              </button>
            </span>
          </div>
        ) : (
          <p className="px-6 md:px-7 py-4 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
            Each range is the target&apos;s weight {bandText}. You&apos;re told {channels} when the portfolio leaves one;{" "}
            <button type="button" onClick={onOpenAlerts} className="font-bold text-[#C49A3C] hover:text-[#a87f2f]">change how in Alerts</button>.
          </p>
        )}
      </section>

      {saveError && (
        <p className="flex items-center gap-2 text-sm font-semibold text-rose-600"><AlertCircle className="h-4 w-4" /> {saveError}</p>
      )}

      <p className="text-[11px] text-slate-400 max-w-2xl leading-relaxed">
        These ranges are the ones you chose. They show where the portfolio stands against them; they aren&apos;t advice to buy or sell.
      </p>

      {confirmRemove && (
        <ConfirmDialog
          title="Remove this strategy?"
          description={`${portfolio.name} stops following it, and its ${adoption.ruleIds.length} ${adoption.ruleIds.length === 1 ? "alert goes" : "alerts go"} with it. The backtest stays.`}
          confirming={removing}
          onConfirm={remove}
          onClose={() => setConfirmRemove(false)}
        />
      )}
    </div>
  );
}

/**
 * Where the portfolio stands against a target's range: a bar with the range shaded and the
 * current weight marked, and the words for it. Nothing to draw while its alert is off or waiting.
 */
function Standing({ rule, range }: { rule: AlertRuleResponse | undefined; range: { minPct: number | null; maxPct: number | null } | null }) {
  const reading = rule?.reading;
  const message = !rule ? "No alert for this target"
    : !rule.enabled ? "Its alert is off"
      : !reading ? "Waiting for the first check"
        : reading.status !== "ok" || reading.currentValue == null ? "Not measurable yet"
          : null;
  if (message || !range || reading?.currentValue == null) return <span className="text-[11px] font-semibold text-slate-400">{message}</span>;

  const now = reading.currentValue;
  const lo = range.minPct ?? 0;
  const hi = range.maxPct ?? 100;
  const below = range.minPct != null && now < range.minPct;
  const above = range.maxPct != null && now > range.maxPct;
  const words = below ? `${formatAlertPct(range.minPct! - now).replace("%", "")} points below your range`
    : above ? `${formatAlertPct(now - range.maxPct!).replace("%", "")} points above your range`
      : "Within your range";
  // The bar's window: the range with as much again either side, within 0–100.
  const span = Math.max(hi - lo, 1);
  const start = Math.max(0, lo - span);
  const end = Math.min(100, hi + span);
  const at = (v: number) => `${((Math.min(Math.max(v, start), end) - start) / (end - start)) * 100}%`;

  return (
    <span className="flex items-center gap-3 min-w-0">
      <span className="relative h-2 flex-1 min-w-16 rounded-full bg-slate-100">
        <span className="absolute inset-y-0 rounded-full bg-emerald-100" style={{ left: at(lo), right: `calc(100% - ${at(hi)})` }} />
        <span
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-white ${below || above ? "bg-amber-500" : "bg-emerald-600"}`}
          style={{ left: at(now) }}
        />
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[13px] font-black tabular-nums text-slate-900">{formatAlertPct(now)}</span>
        <span className={`block text-[10px] font-bold ${below || above ? "text-amber-700" : "text-emerald-700"}`}>{words}</span>
      </span>
    </span>
  );
}

function BandField({ label, suffix, value, onChange }: { label: string; suffix: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</span>
      <span className="relative block">
        <input
          type="number"
          value={value ?? ""}
          step={0.5}
          min={0}
          placeholder="Off"
          onChange={(e) => onChange(e.target.value === "" ? null : Math.max(0.1, Number(e.target.value)))}
          className="w-full h-10 px-3 pr-28 rounded-xl bg-white border border-slate-200 text-sm font-semibold tabular-nums text-slate-900 outline-none placeholder:text-slate-300 focus:border-[#C49A3C]/60 focus:ring-4 focus:ring-[#C49A3C]/10"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">{suffix}</span>
      </span>
    </label>
  );
}
