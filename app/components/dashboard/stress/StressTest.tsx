// components/dashboard/stress/StressTest.tsx
"use client";

import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { AlertTriangle, Info, Loader2, Minus, Plus, X } from "lucide-react";
import { useClientsQuery } from "../../../context/ClientsContext";
import { investmentsKey, useInvestmentsQuery } from "../../../context/PortfolioContext";
import { useUser } from "../../../context/UserContext";
import { ipsService } from "../../../services/ipsService";
import { stressTestService } from "../../../services/stressTestService";
import { formatCurrency } from "../../../lib/format";
import { STRATEGY_CATEGORIES, STRATEGY_CATEGORY_LABELS, type StrategyCategory } from "../../../models/Strategy";
import {
  STRESS_CRISES, type CustomShocks, type StressCrisis, type StressPosition, type StressTest, type StressTestRequest,
} from "../../../models/StressTest";
import { Fig, Figs, Module, ModuleHead, MODULE_BODY } from "../PerformanceSection";

const dateLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
// "2007–09", or "2020" within one year.
const yearsLabel = (start: string, end: string) => (start.slice(0, 4) === end.slice(0, 4) ? start.slice(0, 4) : `${start.slice(0, 4)}–${end.slice(2, 4)}`);
const pct = (v: number, signed = true) => `${signed && v > 0 ? "+" : ""}${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
const toneOf = (v: number): "gain" | "loss" | undefined => (v > 0 ? "gain" : v < 0 ? "loss" : undefined);
const toneText = (v: number) => (v > 0 ? "text-[#047857]" : v < 0 ? "text-[#e11d48]" : "text-[#1c1917]");
const categoryName = (c: StrategyCategory | null) => (c ? STRATEGY_CATEGORY_LABELS[c] ?? c : "No category");

// The currencies offered to shock, the reference one left out.
const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "JPY", "CAD", "AUD", "SEK", "NOK", "DKK", "CNY", "HKD"];
// The stand-in indexes' tickers, as they read.
const PROXY_NAMES: Record<string, string> = { "^990100-USD-STRD": "MSCI World" };

type Choice = StressCrisis | "custom";
type Row<K extends string> = { key: K; text: string };
interface Draft {
  // Every category, "" or 0 for no shock.
  categories: Record<StrategyCategory, string>;
  currencies: Row<string>[];
}

const TH = "py-2 pr-4 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[#857e78] whitespace-nowrap";
const THR = `${TH} text-right pr-0 pl-4`;
const TD = "py-2.5 pr-4 align-top";
const TDR = "py-2.5 pl-4 text-right tabular-nums align-top whitespace-nowrap";

/**
 * STRESS TEST — opened from Volatility's detail (see StressTestModule), one level further down,
 * on any portfolio the user reads (a standard one, the aggregate, a backtest, a strategy shared or
 * published): how a past crisis, or shocks the user picks, would hit it as it is today (POST
 * .../stress-test). A crisis runs as soon as it's picked; custom shocks (a change per asset
 * category and per currency against the reference one) when asked. It shows the total before and
 * after, what each category adds to the change, each position with where its figure comes from
 * (its own prices, its category's stand-in index, the shock, or nothing: kept flat), and the cash
 * by currency. A simulation: nothing is recorded, and the panel says so.
 *
 * The scenario on the left, its impact on the right:
 * wide screens fill with the answer. Stacked on narrow ones. The crises all run at once, each card
 * with what it would do to the portfolio, so they read side by side before one is picked (each
 * under the key the picked one is read by: picking it shows it at once). With `withPolicy`, the
 * investor's largest acceptable loss (their Investment Policy's) is marked on each card's bar,
 * and a crisis beyond it says so; left out where the money isn't theirs (a backtest, a strategy).
 */
export function StressTestPanel({ portfolioUuid, withPolicy = false }: { portfolioUuid: string; withPolicy?: boolean }) {
  const [choice, setChoice] = useState<Choice>("global_financial");
  const [draft, setDraft] = useState<Draft>({
    categories: { equity: "-30", bonds: "", real_estate: "", commodities: "", cash: "", crypto: "" },
    currencies: [],
  });
  // The custom shocks last run: they run again only when asked.
  const [customRun, setCustomRun] = useState<CustomShocks | null>(null);
  // The reference currency, once a run has said it.
  const [currency, setCurrency] = useState<string | null>(null);

  const request: StressTestRequest | null = choice === "custom" ? (customRun ? { custom: customRun } : null) : { crisis: choice };
  // In the cache by the portfolio and the scenario, read again after a write to the portfolio:
  // a scenario picked again shows at once. The last result stays on screen, dimmed, while the next one loads.
  const read = useInvestmentsQuery(
    ["stressTest", portfolioUuid, request],
    () => stressTestService.run(portfolioUuid, request!),
    { enabled: request !== null, keepPrevious: true },
  );
  if (read.data && read.data.currency !== currency) setCurrency(read.data.currency);
  const shown = request === null ? null : read.isError
    ? { data: null, error: read.error instanceof Error ? read.error.message : "Unable to run the stress test." }
    : read.data ? { data: read.data, error: null } : null;
  const loading = request !== null && (read.isPending || read.isPlaceholderData);

  const crises = useCrisisRuns(portfolioUuid);
  const limitPct = usePolicyLossLimit(withPolicy);
  const scale = lossScale(crises, limitPct);

  // In the page's own spacing, under the trail (see PerformanceSection).
  return (
    <>
      <p className="flex items-start gap-2 text-[12.5px] text-[#78716c] max-w-3xl">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        How a past crisis, or the shocks you pick, would hit the portfolio as it is today. A simulation on past prices: nothing is recorded, and it says nothing of what comes next.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] gap-6 items-start">
        {/* Its own box: Module fills its grid cell, which would stretch it to the answer's height. */}
        <div className="lg:sticky lg:top-6">
          <Module>
            <ModuleHead title="Scenario" />
            <div className={`${MODULE_BODY} space-y-4`}>
              <div role="radiogroup" aria-label="Scenario" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                {STRESS_CRISES.map((c, i) => (
                  <ScenarioCard key={c.crisis} selected={choice === c.crisis} onSelect={() => setChoice(c.crisis)} title={c.label} sub={`${dateLabel(c.startDate)} – ${dateLabel(c.endDate)}`} detail={c.detail}>
                    <CrisisImpact data={crises[i].data} failed={crises[i].isError} limitPct={limitPct} scale={scale} />
                  </ScenarioCard>
                ))}
                <ScenarioCard selected={choice === "custom"} onSelect={() => setChoice("custom")} title="Your own shocks" sub="By asset category and currency" detail="Move each category and currency by the change you pick" />
              </div>
              {choice === "custom" && (
                <CustomEditor draft={draft} onChange={setDraft} referenceCurrency={currency} holdings={crises.find((r) => r.data?.pricedAt)?.data ?? null} running={loading && customRun !== null} onRun={setCustomRun} />
              )}
            </div>
          </Module>
        </div>

        <div className="min-w-0 space-y-6">
          {shown?.error ? (
            <Module>
              <p className="px-6 py-6 flex items-center gap-2 text-sm font-semibold text-[#e11d48]"><AlertTriangle className="h-4 w-4 shrink-0" /> {shown.error}</p>
            </Module>
          ) : shown?.data ? (
            <div className={`space-y-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
              <Result data={shown.data} limitPct={limitPct} />
            </div>
          ) : (
            <Module>
              <ModuleHead title="Impact on the portfolio" desc={request ? "Running the scenario…" : "Set your shocks and run them"} />
              <div className={`${MODULE_BODY} flex items-center justify-center py-16`}>
                {request
                  ? <Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" />
                  : <p className="text-[12.5px] text-[#78716c] text-center max-w-sm">The value before and after, what each category adds to the change, and every position.</p>}
              </div>
            </Module>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Every past crisis run on the portfolio, at once, each under the key StressTestPanel reads the
 * picked one by (so the summary, the cards and the answer ask only once).
 */
function useCrisisRuns(portfolioUuid: string) {
  return useQueries({
    queries: STRESS_CRISES.map((c) => ({
      queryKey: investmentsKey("stressTest", portfolioUuid, { crisis: c.crisis }),
      queryFn: () => stressTestService.run(portfolioUuid, { crisis: c.crisis }),
    })),
  });
}

/** The largest loss the investor said they could accept (their Investment Policy's), in %; null without one, or when not asked. */
function usePolicyLossLimit(withPolicy: boolean): number | null {
  const { user } = useUser();
  const policy = useClientsQuery(["policy"], () => ipsService.getPolicy(), { enabled: withPolicy && Boolean(user) && user?.role !== "ADVISOR" });
  return withPolicy ? policy.data?.risk.maxDrawdownPct ?? null : null;
}

// The crises' bars share one scale: the deepest loss, or the limit when it's deeper.
const lossScale = (runs: { data?: StressTest }[], limitPct: number | null) =>
  Math.max(...runs.map((r) => -Math.min(r.data?.changePct ?? 0, 0)), limitPct ?? 0, 1);

/**
 * STRESS TEST MODULE — the stress test in Volatility's detail (RiskDetail): what each past
 * crisis would do to the portfolio as it is today, a line each (kept short: it sits beside the
 * portfolios' correlation matrix, often a small one), with the investor's largest
 * acceptable loss marked on the bars when `withPolicy` (see StressTestPanel). Opens the stress
 * test itself, one level further down (`onOpen`): each crisis's categories and positions, and
 * shocks of one's own.
 */
export function StressTestModule({ portfolioUuid, withPolicy, onOpen }: { portfolioUuid: string; withPolicy: boolean; onOpen: () => void }) {
  const crises = useCrisisRuns(portfolioUuid);
  const limitPct = usePolicyLossLimit(withPolicy);
  const scale = lossScale(crises, limitPct);
  const done = crises.map((r) => r.data).filter((d): d is StressTest => Boolean(d));
  const nothingValued = done.length > 0 && done.every((d) => !d.pricedAt);
  const beyond = limitPct !== null && done.some((d) => -d.changePct > limitPct);

  return (
    <Module>
      <ModuleHead
        title="Stress test"
        desc="How past crises would hit the portfolio as it is today. Open it for each crisis's categories and positions, or to set shocks of your own."
        onExplore={onOpen}
      />
      <div className={MODULE_BODY}>
        {nothingValued ? (
          <p className="text-[12.5px] text-[#857e78]">Nothing to test yet: the portfolio holds nothing that has been valued.</p>
        ) : (
          <>
            <ul className="space-y-3">
              {STRESS_CRISES.map((c, i) => {
                const { data, isError } = crises[i];
                return (
                  // The bar between the name and the figure, or under them both when it's narrow.
                  <li key={c.crisis} className="grid grid-cols-[minmax(0,1fr)_auto] @sm:grid-cols-[minmax(0,1fr)_minmax(4rem,1.5fr)_auto] items-center gap-x-4 gap-y-1.5">
                    <span className="min-w-0" title={`${dateLabel(c.startDate)} – ${dateLabel(c.endDate)}`}>
                      <span className="block text-[13px] font-bold text-[#1c1917] truncate">{c.label}</span>
                      <span className="block text-[11px] text-[#857e78]">{yearsLabel(c.startDate, c.endDate)}</span>
                    </span>
                    <span className="col-span-2 order-last @sm:col-span-1 @sm:order-none">
                      {data?.pricedAt && <LossBar changePct={data.changePct} limitPct={limitPct} scale={scale} />}
                    </span>
                    <span className="text-right">
                      {isError ? <span className="text-[11px] font-semibold text-[#e11d48]">Unavailable</span>
                        : !data ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-[#C49A3C]" />
                          : data.pricedAt && (
                            <>
                              <span className={`block text-[13px] font-black tabular-nums ${toneText(data.changePct)}`}>{pct(data.changePct)}</span>
                              <span className="block text-[11px] tabular-nums text-[#857e78]">{data.change > 0 ? "+" : ""}{formatCurrency(data.change, data.currency, 0)}</span>
                            </>
                          )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {limitPct !== null && done.length > 0 && (
              <p className="mt-4 flex items-center gap-2 text-[12px] text-[#78716c]">
                <span className="h-3 w-0.5 shrink-0 bg-[#1c1917]" />
                {beyond
                  ? <>At least one crisis goes <span className="font-bold text-[#e11d48]">beyond the {pct(limitPct, false)}</span> loss you said you could accept, in your Investment Policy.</>
                  : <>Within the {pct(limitPct, false)} loss you said you could accept, in your Investment Policy.</>}
              </p>
            )}
          </>
        )}
      </div>
    </Module>
  );
}

function ScenarioCard({ selected, onSelect, title, sub, detail, children }: {
  selected: boolean; onSelect: () => void; title: string; sub: string; detail: string; children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`text-left rounded-2xl border px-4 py-3.5 transition-colors ${
        selected ? "border-[#C49A3C] bg-[#FBF6EA]" : "border-[#EEE9DD] bg-white hover:border-[#C49A3C]/60"
      }`}
    >
      <span className="block text-[13px] font-black text-[#1c1917]">{title}</span>
      <span className="block text-[11px] font-bold text-[#C49A3C] mt-0.5">{sub}</span>
      <span className="block text-[11.5px] text-[#78716c] mt-1.5 leading-snug">{detail}</span>
      {children}
    </button>
  );
}

/** A crisis's loss as a bar from the left, on the `scale` the crises share, the policy's limit a tick on it (red past it). */
function LossBar({ changePct, limitPct, scale }: { changePct: number; limitPct: number | null; scale: number }) {
  const beyond = limitPct !== null && -changePct > limitPct;
  return (
    <span className="relative block h-1.5 rounded-full bg-[#F4F1EA]">
      {changePct < 0 && (
        <span className={`absolute inset-y-0 left-0 rounded-full ${beyond ? "bg-[#e11d48]" : "bg-[#C49A3C]"}`} style={{ width: `${(-changePct / scale) * 100}%` }} />
      )}
      {limitPct !== null && <span className="absolute -inset-y-1 w-0.5 -ml-px bg-[#1c1917]" style={{ left: `${(limitPct / scale) * 100}%` }} />}
    </span>
  );
}

/**
 * A crisis card's answer: the change to the whole portfolio and the loss as a bar from the left,
 * on the scale all the cards share, with the policy's limit as a tick on it (red past it).
 */
function CrisisImpact({ data, failed, limitPct, scale }: { data: StressTest | undefined; failed: boolean; limitPct: number | null; scale: number }) {
  if (failed) return <span className="block mt-2.5 text-[11px] font-semibold text-[#e11d48]">Unable to run it</span>;
  if (!data) return <Loader2 className="mt-2.5 h-3.5 w-3.5 animate-spin text-[#C49A3C]" />;
  // Nothing valued: the panel's answer says so.
  if (!data.pricedAt) return null;
  const beyond = limitPct !== null && -data.changePct > limitPct;
  return (
    <span className="block mt-2.5 space-y-1.5">
      <span className="flex items-baseline justify-between gap-3 text-[12px]">
        <span className={`font-black tabular-nums ${toneText(data.changePct)}`}>{pct(data.changePct)}</span>
        <span className="tabular-nums text-[#857e78]">{data.change > 0 ? "+" : ""}{formatCurrency(data.change, data.currency, 0)}</span>
      </span>
      <LossBar changePct={data.changePct} limitPct={limitPct} scale={scale} />
      {beyond && <span className="block text-[11px] font-semibold text-[#e11d48]">Beyond the {pct(limitPct, false)} you could accept</span>}
    </span>
  );
}

/**
 * The custom shocks: a change per category and per currency, -100% or more. The six categories
 * are always all there, each with its share of the portfolio (from a crisis's run, `holdings`)
 * so the ones it doesn't hold read as such; blank or 0 is no shock. Currencies are added one at
 * a time, each at most once; the reference one, once known, isn't offered (the backend refuses it).
 */
function CustomEditor({ draft, onChange, referenceCurrency, holdings, running, onRun }: {
  draft: Draft;
  onChange: (d: Draft) => void;
  referenceCurrency: string | null;
  holdings: StressTest | null;
  running: boolean;
  onRun: (shocks: CustomShocks) => void;
}) {
  const parse = (text: string) => {
    const v = Number(text.replace(",", ".").trim());
    return text.trim() !== "" && Number.isFinite(v) && v >= -100 ? v : null;
  };
  // Blank is no shock, so it's valid too.
  const validCategory = (text: string) => text.trim() === "" || parse(text) !== null;
  const shocked = STRATEGY_CATEGORIES.filter((c) => (parse(draft.categories[c]) ?? 0) !== 0);
  const freeCurrencies = CURRENCIES.filter((c) => c !== referenceCurrency && !draft.currencies.some((r) => r.key === c));
  const problem = STRATEGY_CATEGORIES.some((c) => !validCategory(draft.categories[c])) || draft.currencies.some((r) => parse(r.text) === null)
    ? "Each change is a percentage of -100 or more."
    : shocked.length === 0 && draft.currencies.length === 0 ? "Move at least one category or currency."
      : null;
  const share = (c: StrategyCategory) => {
    if (!holdings || holdings.valueBefore <= 0) return null;
    return (holdings.categories.find((x) => x.category === c)?.valueBefore ?? 0) / holdings.valueBefore * 100;
  };

  const run = () => {
    if (problem) return;
    onRun({
      categories: shocked.map((c) => ({ category: c, changePct: parse(draft.categories[c])! })),
      currencies: draft.currencies.map((r) => ({ currency: r.key, changePct: parse(r.text)! })),
    });
  };
  const setCategory = (c: StrategyCategory, text: string) => onChange({ ...draft, categories: { ...draft.categories, [c]: text } });

  return (
    <div className="rounded-2xl bg-[#FBFAF6] border border-[#EEE9DD] p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-5">
        <div>
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#78716c]">Asset categories</p>
            {shocked.length > 0 && (
              <button type="button" onClick={() => onChange({ ...draft, categories: Object.fromEntries(STRATEGY_CATEGORIES.map((c) => [c, ""])) as Draft["categories"] })} className="text-[11px] font-bold text-[#857e78] hover:text-[#1c1917]">
                Clear
              </button>
            )}
          </div>
          <ul className="divide-y divide-[#EEE9DD]">
            {STRATEGY_CATEGORIES.map((c) => {
              const weight = share(c);
              const held = weight === null || weight > 0;
              const value = parse(draft.categories[c]) ?? 0;
              return (
                <li key={c} className="flex items-center gap-3 py-2">
                  <span className="flex-1 min-w-0">
                    <span className={`block truncate text-[13px] font-bold ${held ? "text-[#1c1917]" : "text-[#a8a29e]"}`}>{STRATEGY_CATEGORY_LABELS[c]}</span>
                    <span className="block truncate text-[11px] text-[#857e78]">
                      {weight === null ? null : weight > 0 ? `${pct(weight, false)} of the portfolio` : "Not held"}
                      {c === "cash" && <>{weight !== null && " · "}Cash-like funds, not the balance</>}
                    </span>
                  </span>
                  <ShockInput
                    label={STRATEGY_CATEGORY_LABELS[c]}
                    text={draft.categories[c]}
                    valid={validCategory(draft.categories[c])}
                    tone={value}
                    onChange={(text) => setCategory(c, text)}
                    onStep={(by) => setCategory(c, String(Math.max(-100, value + by)))}
                  />
                </li>
              );
            })}
          </ul>
        </div>
        <ShockList
          title="Currencies"
          note={referenceCurrency ? `Against ${referenceCurrency}, the reference currency; moves the cash too` : "Against the reference currency; moves the cash too"}
          rows={draft.currencies}
          label={(k) => k}
          options={freeCurrencies.map((c) => ({ value: c, label: c }))}
          onChange={(currencies) => onChange({ ...draft, currencies })}
          valid={(t) => parse(t) !== null}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold text-amber-700">{problem}</span>
        <button
          type="button"
          onClick={run}
          disabled={problem !== null || running}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Run the shocks
        </button>
      </div>
    </div>
  );
}

/** A shock's change: the percentage, coloured by its sign, between steps of 5 points either way. */
function ShockInput({ label, text, valid, tone, onChange, onStep }: {
  label: string; text: string; valid: boolean; tone: number; onChange: (text: string) => void; onStep: (by: number) => void;
}) {
  const step = "w-7 h-9 flex items-center justify-center text-[#857e78] hover:text-[#1c1917] disabled:opacity-30";
  return (
    <span className={`flex items-center rounded-lg bg-white border ${valid ? "border-[#E0DACC] focus-within:border-[#C49A3C]" : "border-rose-300"}`}>
      <button type="button" onClick={() => onStep(-5)} disabled={tone <= -100} aria-label={`${label}: 5 points lower`} className={step}><Minus className="h-3.5 w-3.5" /></button>
      <span className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={text}
          placeholder="0"
          aria-label={`${label} change`}
          aria-invalid={!valid}
          onChange={(e) => onChange(e.target.value)}
          className={`w-14 h-9 pr-4 bg-transparent text-right text-sm font-bold tabular-nums outline-none placeholder:text-[#C9C2B8] ${toneText(tone)}`}
        />
        <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#857e78] pointer-events-none">%</span>
      </span>
      <button type="button" onClick={() => onStep(5)} aria-label={`${label}: 5 points higher`} className={step}><Plus className="h-3.5 w-3.5" /></button>
    </span>
  );
}

function ShockList<K extends string>({ title, note, rows, label, options, onChange, valid }: {
  title: string;
  note: string;
  rows: Row<K>[];
  label: (key: K) => string;
  options: { value: K; label: string }[];
  onChange: (rows: Row<K>[]) => void;
  valid: (text: string) => boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#78716c]">{title}</p>
      <p className="text-[11px] text-[#857e78] mb-2">{note}</p>
      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-2">
            <span className="flex-1 min-w-0 truncate text-[13px] font-bold text-[#1c1917]">{label(r.key)}</span>
            <ShockInput
              label={label(r.key)}
              text={r.text}
              valid={valid(r.text)}
              tone={Number(r.text.replace(",", ".")) || 0}
              onChange={(text) => onChange(rows.map((x, j) => (j === i ? { ...x, text } : x)))}
              onStep={(by) => onChange(rows.map((x, j) => (j === i ? { ...x, text: String(Math.max(-100, (Number(x.text.replace(",", ".")) || 0) + by)) } : x)))}
            />
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              aria-label={`Remove ${label(r.key)}`}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#857e78] hover:text-[#e11d48] hover:bg-rose-50"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      {options.length > 0 && (
        <label className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-[#C49A3C]">
          <Plus className="h-3.5 w-3.5" />
          <select
            value=""
            onChange={(e) => e.target.value && onChange([...rows, { key: e.target.value as K, text: "-10" }])}
            className="bg-transparent outline-none cursor-pointer"
            aria-label={`Add a ${title.toLowerCase()} shock`}
          >
            <option value="">Add</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

function Result({ data, limitPct }: { data: StressTest; limitPct: number | null }) {
  const money = (v: number) => formatCurrency(v, data.currency, 0);
  if (!data.pricedAt) {
    return (
      <Module>
        <div className="px-6 py-8 text-[13px] text-[#78716c]">Nothing to test yet: the portfolio holds nothing that has been valued.</div>
      </Module>
    );
  }
  const scenario = data.crisis
    ? (() => {
        const c = STRESS_CRISES.find((x) => x.crisis === data.crisis!.crisis);
        return `${c?.label ?? data.crisis.crisis}, ${dateLabel(data.crisis.startDate)} – ${dateLabel(data.crisis.endDate)}`;
      })()
    : "Your own shocks";
  const maxContribution = Math.max(...data.categories.map((c) => Math.abs(c.contributionPct)), 0.01);

  return (
    <>
      <Module>
        <ModuleHead title="Impact on the portfolio" desc={scenario} />
        <div className={MODULE_BODY}>
          <Figs>
            <Fig label="Value today" value={money(data.valueBefore)} sub={`As of ${new Date(data.pricedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}`} />
            <Fig label="Value after" value={money(data.valueAfter)} strong />
            <Fig label="Change" value={`${data.change > 0 ? "+" : ""}${money(data.change)}`} tone={toneOf(data.change)} />
            <Fig label="Change %" value={pct(data.changePct)} tone={toneOf(data.changePct)} info="Of the whole portfolio, cash included." />
          </Figs>
          {limitPct !== null && data.changePct < 0 && (
            <p className="mt-4 text-[12px] text-[#78716c]">
              {-data.changePct > limitPct
                ? <>A loss <span className="font-bold text-[#e11d48]">beyond the {pct(limitPct, false)}</span> you said you could accept, in your Investment Policy.</>
                : <>Within the {pct(limitPct, false)} loss you said you could accept, in your Investment Policy.</>}
            </p>
          )}
          {data.uncoveredValue > 0 && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {money(data.uncoveredValue)} of the portfolio has no data for this scenario and is kept flat: the loss shown is understated by what that part would have lost.
            </p>
          )}
        </div>
      </Module>

      {data.categories.length > 0 && (
        <Module>
          <ModuleHead title="By asset category" desc="What each category adds to the change, in points of the whole portfolio" />
          <div className={MODULE_BODY}>
            <ul className="space-y-2.5">
              {data.categories.map((c) => (
                <li key={c.category ?? "none"} className="grid grid-cols-[8rem_minmax(0,1fr)_5rem] sm:grid-cols-[10rem_minmax(0,1fr)_9rem_5rem] items-center gap-3 text-[13px]">
                  <span className="font-bold text-[#1c1917] truncate">{categoryName(c.category)}{c.category === "cash" && <span className="font-normal text-[#857e78]"> · with the balance</span>}</span>
                  {/* A diverging bar around the middle: losses left, gains right. */}
                  <span className="relative h-2.5 rounded-full bg-[#F4F1EA]">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-[#E0DACC]" />
                    <span
                      className={`absolute inset-y-0 rounded-full ${c.contributionPct < 0 ? "bg-[#e11d48]" : "bg-[#047857]"}`}
                      style={c.contributionPct < 0
                        ? { right: "50%", width: `${(Math.abs(c.contributionPct) / maxContribution) * 50}%` }
                        : { left: "50%", width: `${(c.contributionPct / maxContribution) * 50}%` }}
                    />
                  </span>
                  <span className="hidden sm:block text-right tabular-nums text-[#78716c]">{money(c.valueBefore)} → {money(c.valueAfter)}</span>
                  <span className={`text-right font-bold tabular-nums ${toneText(c.contributionPct)}`} title={`${pct(c.changePct)} on the category itself`}>
                    {c.contributionPct > 0 ? "+" : ""}{c.contributionPct.toLocaleString(undefined, { maximumFractionDigits: 1 })} pt
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Module>
      )}

      {data.positions.length > 0 && (
        <Module>
          <ModuleHead title="Positions" desc="Largest first, each with where its figure comes from" />
          <div className={MODULE_BODY}>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead className="border-b border-[#EEE9DD]">
                  <tr>
                    <th className={TH}>Position</th>
                    <th className={TH}>Based on</th>
                    <th className={THR}>Today</th>
                    <th className={THR}>After</th>
                    <th className={THR}>Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEE9DD]">
                  {data.positions.map((p) => (
                    <tr key={p.assetId}>
                      <td className={TD}>
                        <span className="block font-semibold text-[#1c1917]">{p.name}</span>
                        <span className="block text-[11px] text-[#857e78]">{[p.ticker ?? p.isin, categoryName(p.category), p.assetCurrency].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td className={`${TD} text-[12px] ${p.source === "uncovered" ? "text-amber-700 font-semibold" : "text-[#78716c]"}`}>{sourceLabel(p)}</td>
                      <td className={TDR}>{money(p.valueBefore)}</td>
                      <td className={`${TDR} font-semibold text-[#1c1917]`}>{money(p.valueAfter)}</td>
                      <td className={`${TDR} font-bold ${toneText(p.changePct)}`}>{pct(p.changePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Module>
      )}

      {data.cash.length > 0 && (
        <Module>
          <ModuleHead title="Cash" desc="The balance by currency: it moves only with the currencies" />
          <div className={MODULE_BODY}>
            <ul className="divide-y divide-[#EEE9DD]">
              {data.cash.map((c) => (
                <li key={c.currency} className="py-2.5 flex flex-wrap items-baseline justify-between gap-3 text-[13px]">
                  <span className="font-semibold text-[#1c1917]">
                    {formatCurrency(c.amount, c.currency)}
                    {!c.covered && <span className="ml-2 text-[11px] font-semibold text-amber-700">No rate for this scenario: kept flat</span>}
                  </span>
                  <span className="tabular-nums text-[#78716c]">
                    {money(c.valueBefore)} → <span className={`font-bold ${toneText(c.valueAfter - c.valueBefore)}`}>{money(c.valueAfter)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Module>
      )}
    </>
  );
}

function sourceLabel(p: StressPosition): string {
  switch (p.source) {
    case "own_history": return "Its own prices";
    case "category_proxy": return p.proxyTicker ? `Its category's index: ${PROXY_NAMES[p.proxyTicker] ?? p.proxyTicker}` : "Cash-like funds' stand-in";
    case "custom_shock": return "Your shock";
    case "uncovered": return "No data: kept flat";
    default: return p.source;
  }
}
