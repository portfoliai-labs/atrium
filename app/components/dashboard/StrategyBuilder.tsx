// components/dashboard/StrategyBuilder.tsx
"use client";

import { useState } from "react";
import { ArrowDownToLine, ChevronDown, Coins, History, Loader2, Minus, PiggyBank, Play, Plus, Repeat, SlidersHorizontal, X } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { Toggle } from "./Toggle";
import { AssetPicker, assetListingLine } from "./AssetPicker";
import { usePortfolio } from "../../context/PortfolioContext";
import { useUser } from "../../context/UserContext";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";
import { ApiError } from "../../services/apiClient";
import type { AssetSearchResult } from "../../models/AssetSearch";
import {
  MAX_STRATEGY_TARGETS, STRATEGY_CATEGORIES, STRATEGY_CATEGORY_LABELS, STRATEGY_PROXIES,
  type CashFlowAmountType, type RebalanceMode, type StrategyCategory, type StrategyFrequency, type StrategyParams,
  type StrategyTarget,
} from "../../models/Strategy";

const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;

export const CATEGORY_COLORS: Record<StrategyCategory, string> = {
  equity: "#2a78d6",
  bonds: "#1baf7a",
  real_estate: "#eb6834",
  commodities: "#eda100",
  cash: "#94a3b8",
  crypto: "#4a3aa7",
};

// The securities in a mix, in the order they were added, apart from the asset classes' colours.
export const SECURITY_COLORS = ["#C49A3C", "#0e7490", "#be185d", "#4d7c0f", "#7c3aed", "#9a3412", "#334155"];

type Weights = Record<StrategyCategory, number>;

// A security in the mix, bought as it is, and how much of it.
interface SecurityPick {
  asset: AssetSearchResult;
  weight: number;
}

// Ready-made mixes, the first thing a strategy is: most people pick one and go.
const PRESETS: { name: string; text: string; weights: Partial<Weights> }[] = [
  { name: "Conservative", text: "Mostly bonds and cash: small swings, slower growth.", weights: { equity: 25, bonds: 60, cash: 15 } },
  { name: "Balanced 60/40", text: "The classic mix of stocks and bonds.", weights: { equity: 60, bonds: 40 } },
  { name: "Growth", text: "Mostly stocks: bigger swings, more growth over time.", weights: { equity: 80, bonds: 10, real_estate: 10 } },
  { name: "All-weather", text: "Spread to hold up in most markets.", weights: { equity: 30, bonds: 55, commodities: 15 } },
  { name: "Core + crypto", text: "Stocks at the core, with a slice of Bitcoin.", weights: { equity: 75, bonds: 10, crypto: 10, cash: 5 } },
];

const presetWeights = (preset: (typeof PRESETS)[number]) =>
  Object.fromEntries(STRATEGY_CATEGORIES.map((c) => [c, preset.weights[c] ?? 0])) as Weights;
const presetOf = (weights: Weights) =>
  PRESETS.find((p) => STRATEGY_CATEGORIES.every((c) => (p.weights[c] ?? 0) === weights[c])) ?? null;

// The form: the API's StrategyParams, its targets split into every category's weight (0 = not
// held) and the securities picked.
interface StrategyForm extends Omit<StrategyParams, "targets"> {
  name: string;
  weights: Weights;
  securities: SecurityPick[];
}

const securityKey = (asset: Pick<AssetSearchResult, "ticker">) => `asset:${asset.ticker}`;

/** The targets the form sends, each with the key of the row it comes from. */
function targetsOf(f: StrategyForm): { key: string; target: StrategyTarget }[] {
  return [
    ...STRATEGY_CATEGORIES.filter((c) => f.weights[c] > 0).map((c) => ({
      key: c as string,
      target: { kind: "category", category: c, weightPct: f.weights[c] } as StrategyTarget,
    })),
    ...f.securities.filter((s) => s.weight > 0).map((s) => ({
      key: securityKey(s.asset),
      target: { kind: "asset", asset: { ticker: s.asset.ticker, isin: s.asset.isin }, weightPct: s.weight } as StrategyTarget,
    })),
  ];
}

// A plain start: a classic mix, a lump sum plus a monthly amount, never rebalanced, with only the
// bid-ask spread as a cost. Everything past that is an advanced setting.
const DEFAULT_FORM: StrategyForm = {
  name: "",
  weights: presetWeights(PRESETS[1]),
  securities: [],
  initialAmount: 10000,
  rebalancing: { mode: "none", frequency: "annual", thresholdPct: 5, relativeThresholdPct: 25 },
  contributions: { enabled: true, amount: 200, amountType: "fixed", frequency: "monthly", allocation: "target" },
  withdrawals: { enabled: false, amount: 4, amountType: "percent_of_value", frequency: "annual", startAfterYears: 10 },
  costs: { commissionPct: 0, fixedFee: 0, spreadPct: 0.1 },
};

const FREQUENCY_OPTIONS: { value: StrategyFrequency; label: string }[] = [
  { value: "monthly", label: "Every month" },
  { value: "quarterly", label: "Every quarter" },
  { value: "semiannual", label: "Every six months" },
  { value: "annual", label: "Every year" },
];

// The three rebalancing choices of the simple view, and the rules each one stands for.
type SimpleRebalance = "never" | "yearly" | "drift";
const SIMPLE_REBALANCE: { value: SimpleRebalance; title: string; text: string; rules: Partial<StrategyForm["rebalancing"]> }[] = [
  { value: "never", title: "Never", text: "Buy and hold: the mix drifts as prices move.", rules: { mode: "none" } },
  { value: "yearly", title: "Once a year", text: "Back to your mix every January.", rules: { mode: "calendar", frequency: "annual" } },
  { value: "drift", title: "When it drifts", text: "Only when a weight strays too far (the 5/25 rule).", rules: { mode: "threshold", thresholdPct: 5, relativeThresholdPct: 25 } },
];
// Which simple choice the rules are, if any (advanced settings can make them something else).
function simpleRebalanceOf(r: StrategyForm["rebalancing"]): SimpleRebalance | null {
  if (r.mode === "none") return "never";
  if (r.mode === "calendar" && r.frequency === "annual") return "yearly";
  if (r.mode === "threshold" && r.thresholdPct === 5 && r.relativeThresholdPct === 25) return "drift";
  return null;
}

/**
 * STRATEGY — build a portfolio strategy and backtest it, opened from Investments. The page asks
 * three plain questions first: what to hold (a ready-made mix, or weights of one's own, by asset
 * class and for securities picked from the search), how much (a lump sum and an amount every
 * month) and whether to rebalance (never, once a year, or when a weight drifts). Everything else —
 * the rebalancing rules in detail, how contributions are made, withdrawals and trading costs — is
 * under Advanced settings, closed until asked for, with a line saying what they're set to. The
 * name fills itself from the mix until it's typed over. The period isn't asked: the backend runs it
 * from the first month everything it holds is priced (at most 40 years back) to today.
 *
 * "Run backtest" sends it to POST /v1/portfolios/strategies, which plays it on real prices (an
 * asset class through its ETF, a security as it is, see models/Strategy) into a virtual
 * portfolio: read only, kept apart from the real ones and out of the net worth (see
 * BacktestMarks). The page then opens that portfolio, whose figures come in once the backend's
 * job has generated its trades. A demo account can look but not run one.
 */
export function StrategyBuilder({ trail, onCreated }: { trail: Crumb[]; onCreated: (portfolioUuid: string) => void }) {
  const { createStrategyPortfolio } = usePortfolio();
  const { user, isDemo } = useUser();
  const currency = user?.currency ?? "EUR";
  const [form, setForm] = useState<StrategyForm>(DEFAULT_FORM);
  // How the mix is made: a ready-made one, or weights of one's own.
  const [mixMode, setMixMode] = useState<"preset" | "custom">("preset");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The row of the target the backend refused (a security it can't price), until it changes.
  const [invalidKey, setInvalidKey] = useState<string | null>(null);

  const patch = <K extends keyof StrategyForm>(key: K, value: Partial<StrategyForm[K]> | StrategyForm[K]) =>
    setForm((f) => ({ ...f, [key]: typeof value === "object" && !Array.isArray(value) ? { ...(f[key] as object), ...value } : value }));
  const setWeights = (weights: Weights) => setForm((f) => ({ ...f, weights }));
  const setSecurities = (securities: SecurityPick[]) => {
    setForm((f) => ({ ...f, securities }));
    setInvalidKey(null);
  };

  // A ready-made mix holds asset classes only.
  const preset = form.securities.length === 0 ? presetOf(form.weights) : null;
  // Own weights: opened by Custom, or when the weights match no ready-made mix.
  const showWeights = mixMode === "custom" || preset === null;
  const sum = STRATEGY_CATEGORIES.reduce((s, c) => s + form.weights[c], 0) + form.securities.reduce((s, p) => s + p.weight, 0);
  // What counts towards the limit: every asset class held, and every security picked.
  const targetCount = STRATEGY_CATEGORIES.filter((c) => form.weights[c] > 0).length + form.securities.length;
  const segments = segmentsOf(form.weights, form.securities);
  const { mode, thresholdPct, relativeThresholdPct } = form.rebalancing;
  const needsBand = mode === "threshold" || mode === "both";
  const simpleRebalance = simpleRebalanceOf(form.rebalancing);
  // The simple view's monthly amount: a fixed sum every month. Anything else is set in Advanced.
  const simpleContribution = form.contributions.amountType === "fixed" && form.contributions.frequency === "monthly";
  // Until it's typed over, the name says what it is.
  const mixName = preset && mixMode === "preset" ? preset.name : "Custom mix";
  const autoName = mixName;
  const name = form.name.trim() || autoName;

  const addSecurity = (asset: AssetSearchResult | null) => {
    // A new security takes what's left of the 100%.
    if (asset) setSecurities([...form.securities, { asset, weight: Math.max(0, 100 - sum) }]);
  };

  const scaleTo100 = () => {
    const scaled = normalize([...STRATEGY_CATEGORIES.map((c) => form.weights[c]), ...form.securities.map((s) => s.weight)]);
    setForm((f) => ({
      ...f,
      weights: Object.fromEntries(STRATEGY_CATEGORIES.map((c, i) => [c, scaled[i]])) as Weights,
      securities: f.securities.map((s, i) => ({ ...s, weight: scaled[STRATEGY_CATEGORIES.length + i] })),
    }));
  };

  const problems = [
    sum !== 100 && "The weights must add up to 100%.",
    targetCount > MAX_STRATEGY_TARGETS && `A strategy holds at most ${MAX_STRATEGY_TARGETS} asset classes and securities.`,
    !(form.initialAmount > 0) && "The starting amount must be more than 0.",
    needsBand && thresholdPct == null && relativeThresholdPct == null && "Rebalancing on drift needs at least one band.",
    form.contributions.enabled && form.contributions.amountType === "percent_of_value" && form.contributions.amount > 100 && "A contribution can't be more than 100% of the value.",
    form.withdrawals.enabled && form.withdrawals.amountType === "percent_of_value" && form.withdrawals.amount > 100 && "A withdrawal can't be more than 100% of the value.",
  ].filter((p): p is string => typeof p === "string");
  const valid = problems.length === 0;

  const run = async () => {
    if (!valid || isDemo) return;
    setSubmitting(true);
    setError(null);
    setInvalidKey(null);
    const sent = targetsOf(form);
    try {
      const { initialAmount, rebalancing, contributions, withdrawals, costs } = form;
      const strategy: StrategyParams = {
        targets: sent.map((s) => s.target),
        initialAmount,
        rebalancing,
        contributions,
        withdrawals,
        costs,
      };
      const created = await createStrategyPortfolio({ name, strategy });
      onCreated(created.uuid);
    } catch (err) {
      // A security the backend can't resolve comes back as the target it was sent as.
      const index = err instanceof ApiError && err.errorType === "InvalidFieldError"
        ? Number(err.message.match(/strategy\.targets\.(\d+)/)?.[1])
        : NaN;
      const refused = Number.isInteger(index) ? sent[index] : undefined;
      if (refused?.target.kind === "asset") {
        setInvalidKey(refused.key);
        setError(`${refused.target.asset.ticker} can't be priced for a backtest: remove it or pick another listing.`);
      } else {
        setError(err instanceof Error ? err.message : "Unable to run this backtest.");
      }
      setSubmitting(false);
    }
  };

  const recap = [
    { label: "Mix", value: mixName },
    {
      label: "Invested",
      value: form.contributions.enabled
        ? `${formatCurrency(form.initialAmount, currency, 0)} + ${simpleContribution ? `${formatCurrency(form.contributions.amount, currency, 0)} a month` : "contributions"}`
        : formatCurrency(form.initialAmount, currency, 0),
    },
    { label: "Period", value: "All its price history – today" },
    { label: "Rebalancing", value: SIMPLE_REBALANCE.find((o) => o.value === simpleRebalance)?.title ?? "Custom rules" },
  ];

  const advancedSummary = [
    simpleRebalance === null ? "custom rebalancing" : null,
    !simpleContribution && form.contributions.enabled ? "custom contributions" : null,
    form.withdrawals.enabled ? "withdrawals on" : "no withdrawals",
    `costs ${form.costs.commissionPct}% + ${formatCurrency(form.costs.fixedFee, currency, 0)} a trade, ${form.costs.spreadPct}% spread`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="New strategy" />

      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-sky-300 bg-sky-50/70 px-4 py-3.5">
        <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
          <History className="h-4 w-4" />
        </span>
        <p className="text-xs text-sky-900/80 leading-relaxed">
          <span className="block text-[13px] font-black text-sky-950">See how a plan would have done</span>
          Pick a mix and an amount: we play it on real past prices, from as far back as everything in it has them up to
          today, and show you the result as a virtual portfolio.
          It&apos;s read only, kept apart from your real portfolios and never counted in your net worth.
        </p>
      </div>

      <div className="space-y-4">
        <Question n={1} title="What do you want to invest in?" text="Pick a ready-made mix, or set your own.">
          <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 gap-3">
            {PRESETS.map((p) => (
              <ChoiceCard
                key={p.name}
                selected={mixMode === "preset" && preset?.name === p.name}
                title={p.name}
                text={p.text}
                onClick={() => { setForm((f) => ({ ...f, weights: presetWeights(p), securities: [] })); setInvalidKey(null); setMixMode("preset"); }}
              >
                <WeightsBar segments={segmentsOf(presetWeights(p))} />
                <WeightsLegend segments={segmentsOf(presetWeights(p))} />
              </ChoiceCard>
            ))}
            <ChoiceCard
              selected={showWeights}
              title="Custom"
              text="Your own weights, by asset class or for specific securities."
              onClick={() => setMixMode("custom")}
            >
              <WeightsBar segments={segments} />
              {showWeights && <WeightsLegend segments={segments} />}
            </ChoiceCard>
          </div>

          {showWeights && (
            <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200/70 p-4 md:p-5 space-y-5">
              <div className="space-y-4">
                <div>
                  <p className="text-[13px] font-black text-slate-900">Asset classes</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Each one bought through a single ETF.</p>
                </div>
                <ul className="divide-y divide-slate-100 rounded-xl bg-white border border-slate-200/70 px-3">
                  {STRATEGY_CATEGORIES.map((c) => {
                    const weight = form.weights[c];
                    return (
                      <li key={c} className="py-2.5 flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[c] }} />
                          <span className="min-w-0 flex-1">
                            <span className={`block text-[13px] font-black truncate ${weight > 0 ? "text-slate-900" : "text-slate-500"}`}>{STRATEGY_CATEGORY_LABELS[c]}</span>
                            <span className="block text-[11px] font-semibold text-slate-400 truncate">{STRATEGY_PROXIES[c]}</span>
                          </span>
                        </span>
                        <WeightBar pct={weight} color={CATEGORY_COLORS[c]} />
                        <WeightStepper
                          value={weight}
                          label={STRATEGY_CATEGORY_LABELS[c]}
                          onChange={(v) => setWeights({ ...form.weights, [c]: v })}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="space-y-3 pt-5 border-t border-slate-200/70">
                <div>
                  <p className="text-[13px] font-black text-slate-900">Securities</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">A stock, ETF, fund or crypto bought as it is.</p>
                </div>
                {form.securities.length > 0 && (
                  <ul className="divide-y divide-slate-100 rounded-xl bg-white border border-slate-200/70 px-3">
                    {form.securities.map((p, i) => {
                      const key = securityKey(p.asset);
                      const refused = key === invalidKey;
                      return (
                        <li key={key} className={`py-2.5 ${refused ? "-mx-3 px-3 bg-rose-50/60" : ""}`}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: SECURITY_COLORS[i % SECURITY_COLORS.length] }} />
                              <span className="min-w-0 flex-1">
                                <span className="block text-[13px] font-black text-slate-900 truncate">{p.asset.name}</span>
                                <span className="block text-[11px] font-semibold text-slate-500 truncate">{assetListingLine(p.asset)}</span>
                              </span>
                            </span>
                            <WeightBar pct={p.weight} color={SECURITY_COLORS[i % SECURITY_COLORS.length]} />
                            <span className="flex items-center gap-1 shrink-0">
                              <WeightStepper
                                value={p.weight}
                                label={p.asset.ticker}
                                onChange={(v) => setSecurities(form.securities.map((x) => (x === p ? { ...x, weight: v } : x)))}
                              />
                              <button type="button" onClick={() => setSecurities(form.securities.filter((x) => x !== p))} aria-label={`Remove ${p.asset.ticker}`} className="ml-1 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                                <X className="h-4 w-4" />
                              </button>
                            </span>
                          </div>
                          {refused && (
                            <p className="text-[11px] font-bold text-rose-600 mt-1.5">
                              This listing can&apos;t be priced for a backtest: remove it or pick another one.
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {targetCount < MAX_STRATEGY_TARGETS ? (
                  <AssetPicker
                    value={null}
                    onChange={addSecurity}
                    label="Add a security"
                    excludeTickers={form.securities.map((s) => s.asset.ticker)}
                    excludeIsins={form.securities.flatMap((s) => (s.asset.isin ? [s.asset.isin] : []))}
                  />
                ) : (
                  <p className="text-xs text-slate-500">
                    That&apos;s {MAX_STRATEGY_TARGETS} asset classes and securities, the most a strategy holds.
                  </p>
                )}
              </div>

              <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-2.5 ${sum === 100 ? "bg-emerald-50" : "bg-amber-50"}`}>
                <span className={`text-sm font-black tabular-nums ${sum === 100 ? "text-emerald-700" : "text-amber-700"}`}>
                  Total {sum}% {sum === 100 ? "✓" : sum > 100 ? `— ${sum - 100} points too many` : `— ${100 - sum} points left`}
                </span>
                <span className="flex items-center gap-4">
                  {sum !== 100 && sum > 0 && (
                    <button type="button" onClick={scaleTo100} className="text-xs font-bold text-amber-800 underline underline-offset-2">
                      Scale to 100%
                    </button>
                  )}
                  <span className={`text-xs font-bold tabular-nums ${targetCount > MAX_STRATEGY_TARGETS ? "text-rose-600" : "text-slate-500"}`}>
                    {targetCount} / {MAX_STRATEGY_TARGETS} held
                  </span>
                </span>
              </div>
            </div>
          )}
        </Question>

        <Question n={2} title="How much?" text="What you'd have put in at the start, and what you'd have added every month.">
          <div className="grid grid-cols-1 @md:grid-cols-2 gap-4">
            <NumberField label="To start with" suffix={currency} value={form.initialAmount} step={1000} min={0} onChange={(v) => patch("initialAmount", Math.max(0, v))} />
            {simpleContribution ? (
              <NumberField
                label="Every month"
                suffix={currency}
                value={form.contributions.enabled ? form.contributions.amount : 0}
                step={50}
                min={0}
                onChange={(v) => patch("contributions", { amount: Math.max(0, v), enabled: v > 0 })}
              />
            ) : (
              <div>
                <span className={fieldLabel}>Adding</span>
                <button type="button" onClick={() => setAdvancedOpen(true)} className="h-11 w-full px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-left text-sm font-semibold text-slate-600">
                  Set in Advanced settings
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mt-3">
            The starting amount is invested all at once, on the first day. The monthly amount is your recurring contribution
            (PAC), the same one as in Advanced settings; leave it at 0 for a single lump sum.
          </p>
        </Question>

        <Question n={3} title="Keep the mix in balance?" text="As prices move, the mix drifts. Rebalancing sells what grew too big and buys what fell behind.">
          <div className="grid grid-cols-1 @xl:grid-cols-3 gap-3">
            {SIMPLE_REBALANCE.map((o) => (
              <ChoiceCard
                key={o.value}
                selected={simpleRebalance === o.value}
                title={o.title}
                text={o.text}
                onClick={() => patch("rebalancing", o.rules)}
              />
            ))}
          </div>
          {simpleRebalance === null && (
            <p className="text-xs text-slate-500 mt-3">Custom rules are set in Advanced settings.</p>
          )}
        </Question>
      </div>

      {/* Everything past the three questions, closed until asked for. */}
      <section className="space-y-4">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          aria-expanded={advancedOpen}
          className="w-full flex items-center justify-between gap-4 p-5 md:px-7 text-left bg-white rounded-3xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors"
        >
          <span className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0"><SlidersHorizontal className="h-4 w-4" /></span>
            <span className="min-w-0">
              <span className="block text-xl font-black text-slate-900 leading-tight" style={serif}>Advanced settings</span>
              <span className="block text-[13px] text-slate-500 truncate mt-0.5">{advancedSummary}</span>
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 shrink-0">
            {advancedOpen ? "Hide" : "Show"}
            <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
          </span>
        </button>

        {advancedOpen && (
          <div className="space-y-3">
            <Advanced icon={<Repeat className="h-4 w-4" />} title="Rebalancing rules" text="When the mix is brought back to its weights.">
              <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-3">
                {([
                  { value: "none", title: "Never", text: "Let the weights drift." },
                  { value: "calendar", title: "On a calendar", text: "At fixed dates." },
                  { value: "threshold", title: "On drift", text: "Past a band." },
                  { value: "both", title: "Calendar + drift", text: "Dates, plus the band." },
                ] as { value: RebalanceMode; title: string; text: string }[]).map((o) => (
                  <ChoiceCard key={o.value} selected={mode === o.value} title={o.title} text={o.text} onClick={() => patch("rebalancing", { mode: o.value })} />
                ))}
              </div>
              {mode !== "none" && (
                <div className="grid grid-cols-1 @xl:grid-cols-3 gap-4 mt-4">
                  {(mode === "calendar" || mode === "both") && (
                    <SelectField label="How often" value={form.rebalancing.frequency} options={FREQUENCY_OPTIONS} onChange={(v) => patch("rebalancing", { frequency: v as StrategyFrequency })} />
                  )}
                  {needsBand && (
                    <>
                      <OptionalNumberField label="Absolute band" suffix="± points" value={thresholdPct} onChange={(v) => patch("rebalancing", { thresholdPct: v == null ? null : clamp(v, 0.1, 100) })} />
                      <OptionalNumberField label="Relative band" suffix="± % of weight" value={relativeThresholdPct} onChange={(v) => patch("rebalancing", { relativeThresholdPct: v == null ? null : clamp(v, 0.1, 100) })} />
                    </>
                  )}
                </div>
              )}
              {needsBand && (
                <p className="text-xs text-slate-500 leading-relaxed mt-3">
                  Checked every trading day. With both bands set, crossing either one rebalances. Leave a band empty to turn it off.
                </p>
              )}
            </Advanced>

            <Advanced icon={<PiggyBank className="h-4 w-4" />} title="Contributions" text="How the money added over time goes in (PAC).">
              <FlowCard title="Recurring contribution" enabled={form.contributions.enabled} onToggle={(v) => patch("contributions", { enabled: v })}>
                <AmountFields currency={currency} amount={form.contributions.amount} amountType={form.contributions.amountType} onChange={(v) => patch("contributions", v)} />
                <SelectField label="How often" value={form.contributions.frequency} options={FREQUENCY_OPTIONS} onChange={(v) => patch("contributions", { frequency: v as StrategyFrequency })} />
                <SelectField
                  label="Bought at"
                  value={form.contributions.allocation}
                  options={[{ value: "target", label: "Target weights" }, { value: "current", label: "Current weights" }]}
                  onChange={(v) => patch("contributions", { allocation: v as "current" | "target" })}
                />
              </FlowCard>
            </Advanced>

            <Advanced icon={<ArrowDownToLine className="h-4 w-4" />} title="Withdrawals" text="Money taken out on a schedule, sold from every asset in proportion.">
              <FlowCard title="Scheduled withdrawal" enabled={form.withdrawals.enabled} onToggle={(v) => patch("withdrawals", { enabled: v })}>
                <AmountFields currency={currency} amount={form.withdrawals.amount} amountType={form.withdrawals.amountType} onChange={(v) => patch("withdrawals", v)} />
                <SelectField label="How often" value={form.withdrawals.frequency} options={FREQUENCY_OPTIONS} onChange={(v) => patch("withdrawals", { frequency: v as StrategyFrequency })} />
                <NumberField label="Starting after" suffix="years" value={form.withdrawals.startAfterYears} min={0} onChange={(v) => patch("withdrawals", { startAfterYears: Math.max(0, Math.round(v)) })} />
              </FlowCard>
              <p className="text-xs text-slate-500 leading-relaxed mt-3">
                A percentage is of the portfolio&apos;s value that day, each time: 4% every month is 4% a month, not a year.
              </p>
            </Advanced>

            <Advanced icon={<Coins className="h-4 w-4" />} title="Trading costs" text="What each trade costs. Fund fees are already in the ETFs' prices; taxes aren't modelled yet.">
              <div className="grid grid-cols-1 @xl:grid-cols-3 gap-4">
                <NumberField label="Commission" suffix="% per trade" step={0.05} min={0} value={form.costs.commissionPct} onChange={(v) => patch("costs", { commissionPct: clamp(v, 0, 100) })} />
                <NumberField label="Fixed fee" suffix={`${currency} per trade`} step={0.5} min={0} value={form.costs.fixedFee} onChange={(v) => patch("costs", { fixedFee: Math.max(0, v) })} />
                <NumberField label="Bid-ask spread" suffix="%" step={0.05} min={0} value={form.costs.spreadPct} onChange={(v) => patch("costs", { spreadPct: Math.max(0, v) })} />
              </div>
            </Advanced>
          </div>
        )}
      </section>

      <div className="bg-[#1c1917] rounded-3xl p-5 md:p-7 space-y-5">
        {/* The three answers at a glance, before it runs. */}
        <div className="space-y-3">
          <h3 className="text-xl font-black text-white leading-tight" style={serif}>Your strategy</h3>
          <div className="max-w-md"><WeightsBar segments={segments} /></div>
          <ul className="flex flex-wrap gap-2">
            {recap.map((r) => (
              <li key={r.label} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider">{r.label}</span>
                <span className="block text-[13px] font-black text-white tabular-nums">{r.value}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-5 border-t border-white/10">
          <div className="min-w-0 flex-1 space-y-2">
            <label className="block max-w-md">
              <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">Name</span>
              <input
                value={form.name}
                onChange={(e) => patch("name", e.target.value)}
                placeholder={autoName}
                maxLength={80}
                aria-label="Strategy name"
                className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-white outline-none placeholder:text-stone-400 focus:border-[#C49A3C]/60 focus:ring-4 focus:ring-[#C49A3C]/10"
              />
            </label>
            <p className="text-[13px] text-stone-400">
              {isDemo
                ? "Backtests can't be run on a demo account."
                : valid
                  ? "Creates a virtual portfolio and opens it. Its figures take a few minutes to come in. With less than a year of prices in common, it can't run."
                  : problems[0]}
            </p>
            {error && <p className="text-[13px] font-bold text-rose-400">{error}</p>}
          </div>
          <button
            type="button"
            onClick={run}
            disabled={!valid || isDemo || submitting}
            title={isDemo ? DEMO_DISABLED_TITLE : undefined}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#C49A3C] text-[#131210] text-sm font-black hover:bg-[#d4aa4c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
            Run backtest
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 text-center max-w-xl mx-auto leading-relaxed">
        A backtest shows how rules would have played out in the past. Past returns don&apos;t predict future ones. Not investment advice.
      </p>
    </div>
  );
}

/**
 * One of the three questions, a card of its own: its number, wording and a line on the left, its
 * answers on the right (stacked on narrow screens), centred on the heading's height when shorter.
 * The answers' grids follow their own width.
 */
function Question({ n, title, text, children }: { n: number; title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-7 grid grid-cols-1 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-center gap-5 lg:gap-8">
      <header className="flex lg:flex-col items-start lg:self-start gap-3">
        <span className="w-9 h-9 rounded-full bg-[#C49A3C] text-white text-sm font-black flex items-center justify-center shrink-0">{n}</span>
        <div className="min-w-0">
          <h3 className="text-xl font-black text-slate-900 leading-tight" style={serif}>{title}</h3>
          <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed">{text}</p>
        </div>
      </header>
      <div className="@container min-w-0">{children}</div>
    </section>
  );
}

/**
 * One group of advanced settings, a card laid out like a question's (heading left, fields right),
 * a step quieter: an icon for the number, no shadow, a smaller title.
 */
function Advanced({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl border border-slate-200 p-5 md:p-7 grid grid-cols-1 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-center gap-4 lg:gap-8">
      <header className="flex lg:flex-col items-start lg:self-start gap-3">
        <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">{icon}</span>
        <div className="min-w-0">
          <h4 className="text-lg font-black text-slate-900 leading-tight" style={serif}>{title}</h4>
          <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed">{text}</p>
        </div>
      </header>
      <div className="@container min-w-0">{children}</div>
    </section>
  );
}

/** A choice among a few: a card with a title and a line, gold when picked. */
function ChoiceCard({ selected, title, badge, text, onClick, className = "", children }: {
  selected: boolean;
  className?: string;
  title: string;
  badge?: React.ReactNode;
  text: string;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`${className} text-left rounded-2xl border-2 p-3.5 transition-colors flex flex-col gap-2 ${
        selected ? "border-[#C49A3C] bg-[#C49A3C]/5" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <span>
        <span className="flex items-center gap-2 text-[13px] font-black text-slate-900">{title}{badge}</span>
        <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">{text}</span>
      </span>
      {/* At the card's foot, so the bars of a row line up whatever the text's length. */}
      {children && <span className="mt-auto flex flex-col gap-1.5">{children}</span>}
    </button>
  );
}

// One slice of a mix: an asset class or a security, with its share and colour.
interface Segment {
  key: string;
  label: string;
  pct: number;
  color: string;
}

/** A mix as slices: its asset classes, then its securities in the order they were added. */
function segmentsOf(weights: Weights, securities: SecurityPick[] = []): Segment[] {
  return [
    ...STRATEGY_CATEGORIES.map((c) => ({ key: c as string, label: STRATEGY_CATEGORY_LABELS[c], pct: weights[c], color: CATEGORY_COLORS[c] })),
    ...securities.map((s, i) => ({ key: securityKey(s.asset), label: s.asset.ticker, pct: s.weight, color: SECURITY_COLORS[i % SECURITY_COLORS.length] })),
  ];
}

/** A mix's slices with their share, under its bar: "Equity 60% · VWCE.DE 40%". */
function WeightsLegend({ segments }: { segments: Segment[] }) {
  const held = segments.filter((s) => s.pct > 0);
  if (held.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] font-bold text-slate-500 tabular-nums">
      {held.map((s) => (
        <span key={s.key} className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
          {s.label} {s.pct}%
        </span>
      ))}
    </span>
  );
}

/** A mix as one thin bar, each slice in its colour. */
function WeightsBar({ segments }: { segments: Segment[] }) {
  return (
    <span className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
      {segments.map((s) => (
        <span key={s.key} style={{ width: `${Math.min(s.pct, 100)}%`, background: s.color }} />
      ))}
    </span>
  );
}

function FlowCard({ title, enabled, onToggle, children }: { title: string; enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-4 transition-colors ${enabled ? "border-[#C49A3C]/40 bg-[#C49A3C]/5" : "border-slate-200"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-black text-slate-900">{title}</span>
        <Toggle checked={enabled} onChange={onToggle} label={title} />
      </div>
      {enabled && <div className="grid grid-cols-1 @md:grid-cols-2 gap-3 mt-4">{children}</div>}
    </div>
  );
}

/** A cash flow's amount, either a sum or a percentage of the portfolio's value. */
function AmountFields({ currency, amount, amountType, onChange }: {
  currency: string;
  amount: number;
  amountType: CashFlowAmountType;
  onChange: (v: { amount?: number; amountType?: CashFlowAmountType }) => void;
}) {
  const percent = amountType === "percent_of_value";
  return (
    <>
      <NumberField
        label="Amount"
        suffix={percent ? "% of value" : currency}
        step={percent ? 0.5 : 50}
        min={0}
        max={percent ? 100 : undefined}
        value={amount}
        onChange={(v) => onChange({ amount: percent ? clamp(v, 0, 100) : Math.max(0, v) })}
      />
      <SelectField
        label="As"
        value={amountType}
        options={[{ value: "fixed", label: "A fixed sum" }, { value: "percent_of_value", label: "A % of the value" }]}
        onChange={(v) => onChange({ amountType: v as CashFlowAmountType })}
      />
    </>
  );
}

const fieldLabel = "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";
const fieldBox = "w-full h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold outline-none focus:border-[#C49A3C]/60 focus:ring-4 focus:ring-[#C49A3C]/10";

// The steps − and + move a weight by, from the nearest step.
const WEIGHT_STEP = 5;

/** A weight at a glance, next to its stepper: wide screens only, the number says it all on a phone. */
function WeightBar({ pct, color }: { pct: number; color: string }) {
  return (
    <span aria-hidden className="hidden @md:block w-24 @2xl:w-36 h-1.5 rounded-full bg-slate-100 overflow-hidden shrink-0">
      <span className="block h-full rounded-full transition-[width] duration-200" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
    </span>
  );
}

/** A weight in %: − and + by WEIGHT_STEP, or typed. */
function WeightStepper({ value, label, onChange }: { value: number; label: string; onChange: (v: number) => void }) {
  const down = value % WEIGHT_STEP === 0 ? value - WEIGHT_STEP : value - (value % WEIGHT_STEP);
  const up = value - (value % WEIGHT_STEP) + WEIGHT_STEP;
  const stepButton = "w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors";
  return (
    <span className="flex items-center shrink-0 rounded-lg border border-slate-200 bg-white overflow-hidden focus-within:border-[#C49A3C]/60">
      <button type="button" onClick={() => onChange(clamp(down, 0, 100))} disabled={value <= 0} aria-label={`Lower ${label} weight`} className={stepButton}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="flex items-center border-x border-slate-200 pr-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value), 0, 100))}
          onFocus={(e) => e.target.select()}
          aria-label={`${label} weight`}
          className="w-11 h-8 text-right text-sm font-black tabular-nums text-slate-900 outline-none bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-xs font-bold text-slate-400 ml-0.5">%</span>
      </span>
      <button type="button" onClick={() => onChange(clamp(up, 0, 100))} disabled={value >= 100} aria-label={`Raise ${label} weight`} className={stepButton}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function NumberField({ label, value, onChange, suffix, step = 1, min, max }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: number; min?: number; max?: number }) {
  return (
    <label className="block">
      <span className={fieldLabel}>{label}</span>
      <span className="relative block">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className={`${fieldBox} tabular-nums ${suffix ? "pr-24" : ""}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">{suffix}</span>}
      </span>
    </label>
  );
}

/** A number that can be left empty (null), for a setting that's off without one. */
function OptionalNumberField({ label, value, onChange, suffix }: { label: string; value: number | null; onChange: (v: number | null) => void; suffix?: string }) {
  return (
    <label className="block">
      <span className={fieldLabel}>{label}</span>
      <span className="relative block">
        <input
          type="number"
          value={value ?? ""}
          step={0.5}
          min={0}
          placeholder="Off"
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className={`${fieldBox} tabular-nums placeholder:text-slate-300 ${suffix ? "pr-28" : ""}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">{suffix}</span>}
      </span>
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className={fieldLabel}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldBox}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));

/** Scales weights to add up to exactly 100, the rounding leftovers going to the largest. */
function normalize(weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  const scaled = weights.map((w) => Math.floor((w / sum) * 100));
  let left = 100 - scaled.reduce((s, v) => s + v, 0);
  for (const i of weights.map((_, i) => i).sort((a, b) => weights[b] - weights[a])) {
    if (left <= 0) break;
    scaled[i] += 1;
    left -= 1;
  }
  return scaled;
}
