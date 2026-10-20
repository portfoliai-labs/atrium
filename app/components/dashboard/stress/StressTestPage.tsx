// components/dashboard/stress/StressTestPage.tsx
"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, Loader2, Plus, X } from "lucide-react";
import { stressTestService } from "../../../services/stressTestService";
import { formatCurrency } from "../../../lib/format";
import { STRATEGY_CATEGORIES, STRATEGY_CATEGORY_LABELS, type StrategyCategory } from "../../../models/Strategy";
import {
  STRESS_CRISES, type CustomShocks, type StressCrisis, type StressPosition, type StressTest, type StressTestRequest,
} from "../../../models/StressTest";
import { Breadcrumb, type Crumb } from "../Breadcrumb";
import { Fig, Figs, Module, ModuleHead, MODULE_BODY } from "../PerformanceSection";

const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;
const dateLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
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
  categories: Row<StrategyCategory>[];
  currencies: Row<string>[];
}
interface Loaded {
  key: string;
  data: StressTest | null;
  error: string | null;
}

const TH = "py-2 pr-4 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[#857e78] whitespace-nowrap";
const THR = `${TH} text-right pr-0 pl-4`;
const TD = "py-2.5 pr-4 align-top";
const TDR = "py-2.5 pl-4 text-right tabular-nums align-top whitespace-nowrap";

/**
 * STRESS TEST — a portfolio's page (any the user reads: a standard one, the aggregate, a backtest,
 * a strategy shared or published): how a past crisis, or shocks the user picks, would hit it as it
 * is today (POST .../stress-test). A crisis runs as soon as it's picked; custom shocks (a change
 * per asset category and per currency against the reference one) when asked. It shows the total
 * before and after, what each category adds to the change, each position with where its figure
 * comes from (its own prices, its category's stand-in index, the shock, or nothing: kept flat),
 * and the cash by currency. A simulation: nothing is recorded.
 */
export function StressTestPage({ portfolioUuid, trail, eyebrow }: { portfolioUuid: string; trail: Crumb[]; eyebrow?: string }) {
  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="Stress test" />
      <div className="flex flex-col gap-2">
        {eyebrow && <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C]">{eyebrow}</p>}
        <h1 className="text-[30px] md:text-[40px] font-bold text-[#1c1917] leading-[1.05]" style={serif}>Stress test</h1>
        <p className="flex items-start gap-2 text-[12.5px] text-[#78716c] max-w-3xl">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          How a past crisis, or the shocks you pick, would hit the portfolio as it is today. A simulation on past prices: nothing is recorded, and it says nothing of what comes next.
        </p>
      </div>
      <StressTestPanel portfolioUuid={portfolioUuid} />
    </div>
  );
}

/**
 * The scenario on the left, its impact on the right:
 * wide screens fill with the answer. Stacked on narrow ones.
 */
export function StressTestPanel({ portfolioUuid }: { portfolioUuid: string }) {
  const [choice, setChoice] = useState<Choice>("global_financial");
  const [draft, setDraft] = useState<Draft>({ categories: [{ key: "equity", text: "-30" }], currencies: [] });
  // The custom shocks last run: they run again only when asked.
  const [customRun, setCustomRun] = useState<CustomShocks | null>(null);
  const [result, setResult] = useState<Loaded | null>(null);
  // The reference currency, once a run has said it.
  const [currency, setCurrency] = useState<string | null>(null);

  const request: StressTestRequest | null = choice === "custom" ? (customRun ? { custom: customRun } : null) : { crisis: choice };
  const requestKey = request ? `${portfolioUuid}:${JSON.stringify(request)}` : null;

  useEffect(() => {
    if (!request || !requestKey) return;
    let cancelled = false;
    stressTestService.run(portfolioUuid, request)
      .then((data) => {
        if (cancelled) return;
        setResult({ key: requestKey, data, error: null });
        setCurrency(data.currency);
      })
      .catch((err) => { if (!cancelled) setResult({ key: requestKey, data: null, error: err instanceof Error ? err.message : "Unable to run the stress test." }); });
    return () => { cancelled = true; };
    // The request is requestKey's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioUuid, requestKey]);

  const current = result && result.key === requestKey ? result : null;
  // The last result stays on screen, dimmed, while the next one loads.
  const shown = current ?? (requestKey ? result : null);
  const loading = requestKey !== null && current === null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] gap-6 items-start">
      {/* Its own box: Module fills its grid cell, which would stretch it to the answer's height. */}
      <div className="lg:sticky lg:top-6">
        <Module>
          <ModuleHead title="Scenario" />
          <div className={`${MODULE_BODY} space-y-4`}>
            <div role="radiogroup" aria-label="Scenario" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
              {STRESS_CRISES.map((c) => (
                <ScenarioCard key={c.crisis} selected={choice === c.crisis} onSelect={() => setChoice(c.crisis)} title={c.label} sub={`${dateLabel(c.startDate)} – ${dateLabel(c.endDate)}`} detail={c.detail} />
              ))}
              <ScenarioCard selected={choice === "custom"} onSelect={() => setChoice("custom")} title="Your own shocks" sub="By asset category and currency" detail="Move each category and currency by the change you pick" />
            </div>
            {choice === "custom" && (
              <CustomEditor draft={draft} onChange={setDraft} referenceCurrency={currency} running={loading && customRun !== null} onRun={setCustomRun} />
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
            <Result data={shown.data} />
          </div>
        ) : (
          <Module>
            <ModuleHead title="Impact on the portfolio" desc={requestKey ? "Running the scenario…" : "Set your shocks and run them"} />
            <div className={`${MODULE_BODY} flex items-center justify-center py-16`}>
              {requestKey
                ? <Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" />
                : <p className="text-[12.5px] text-[#78716c] text-center max-w-sm">The value before and after, what each category adds to the change, and every position.</p>}
            </div>
          </Module>
        )}
      </div>
    </div>
  );
}

function ScenarioCard({ selected, onSelect, title, sub, detail }: { selected: boolean; onSelect: () => void; title: string; sub: string; detail: string }) {
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
    </button>
  );
}

/**
 * The custom shocks: a change per category and per currency, each at most once, -100% or more.
 * The reference currency, once known, isn't offered (the backend refuses it).
 */
function CustomEditor({ draft, onChange, referenceCurrency, running, onRun }: {
  draft: Draft;
  onChange: (d: Draft) => void;
  referenceCurrency: string | null;
  running: boolean;
  onRun: (shocks: CustomShocks) => void;
}) {
  const parse = (text: string) => {
    const v = Number(text.replace(",", ".").trim());
    return text.trim() !== "" && Number.isFinite(v) && v >= -100 ? v : null;
  };
  const freeCategories = STRATEGY_CATEGORIES.filter((c) => !draft.categories.some((r) => r.key === c));
  const freeCurrencies = CURRENCIES.filter((c) => c !== referenceCurrency && !draft.currencies.some((r) => r.key === c));
  const rows = [...draft.categories, ...draft.currencies];
  const problem = rows.length === 0 ? "Add at least one shock."
    : rows.some((r) => parse(r.text) === null) ? "Each change is a percentage of -100 or more."
      : null;

  const run = () => {
    if (problem) return;
    onRun({
      categories: draft.categories.map((r) => ({ category: r.key, changePct: parse(r.text)! })),
      currencies: draft.currencies.map((r) => ({ currency: r.key, changePct: parse(r.text)! })),
    });
  };

  return (
    <div className="rounded-2xl bg-[#FBFAF6] border border-[#EEE9DD] p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-5">
        <ShockList
          title="Asset categories"
          note="Cash moves cash-like funds, not the cash balance"
          rows={draft.categories}
          label={(k) => STRATEGY_CATEGORY_LABELS[k]}
          options={freeCategories.map((c) => ({ value: c, label: STRATEGY_CATEGORY_LABELS[c] }))}
          onChange={(categories) => onChange({ ...draft, categories })}
          valid={(t) => parse(t) !== null}
        />
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
            <span className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={r.text}
                aria-label={`${label(r.key)} change`}
                aria-invalid={!valid(r.text)}
                onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                className={`w-24 h-9 pl-3 pr-7 rounded-lg bg-white border text-right text-sm font-bold tabular-nums text-[#1c1917] outline-none ${
                  valid(r.text) ? "border-[#E0DACC] focus:border-[#C49A3C]" : "border-rose-300"
                }`}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#857e78] pointer-events-none">%</span>
            </span>
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

function Result({ data }: { data: StressTest }) {
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
