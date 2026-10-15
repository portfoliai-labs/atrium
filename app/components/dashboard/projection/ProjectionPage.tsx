// components/dashboard/projection/ProjectionPage.tsx
"use client";

import { useState } from "react";
import { AlertTriangle, Hourglass, Info, Loader2 } from "lucide-react";
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { projectionService } from "../../../services/projectionService";
import { ApiError } from "../../../services/apiClient";
import { formatCompact, formatCurrency } from "../../../lib/format";
import {
  PROJECTION_HISTORY_TOO_SHORT, PROJECTION_MAX_YEARS, PROJECTION_MIN_MONTHS,
  type Projection, type ProjectionRequest, type ProjectionYear,
} from "../../../models/Projection";
import { Breadcrumb, type Crumb } from "../Breadcrumb";
import { Fig, Figs, Module, ModuleHead, MODULE_BODY } from "../PerformanceSection";

const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;
const AXIS_TICK_COLOR = "#57534e";
const TOOLTIP_STYLE: React.CSSProperties = { borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12, color: "#334155" };
const GOLD = "#C49A3C";
const pct = (v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;

type Question = "goal" | "survival" | "safeWithdrawal";
const QUESTIONS: { id: Question; label: string; detail: string }[] = [
  { id: "goal", label: "Reach a goal", detail: "Will it get to an amount, and when?" },
  { id: "survival", label: "Will it last", detail: "Do monthly withdrawals last the years you need?" },
  { id: "safeWithdrawal", label: "Safe withdrawal", detail: "How much could you take each month?" },
];

// Each question's form, as typed.
interface Forms {
  goal: { targetAmount: string; monthlyContribution: string; targetHorizonYears: string };
  survival: { monthlyWithdrawal: string; horizonYears: string; yearsUntilRetirement: string; monthlyContribution: string };
  safeWithdrawal: { horizonYears: string; yearsUntilRetirement: string; monthlyContribution: string; targetSuccessPct: string };
}
const INITIAL_FORMS: Forms = {
  goal: { targetAmount: "", monthlyContribution: "", targetHorizonYears: "" },
  survival: { monthlyWithdrawal: "", horizonYears: "30", yearsUntilRetirement: "0", monthlyContribution: "" },
  safeWithdrawal: { horizonYears: "30", yearsUntilRetirement: "0", monthlyContribution: "", targetSuccessPct: "90" },
};

interface Outcome {
  data: Projection | null;
  error: string | null;
  // PROJECTION_HISTORY_TOO_SHORT: the months there are, when said.
  tooShort?: { months: number | null };
}

/** A typed number: undefined when left empty, NaN when it isn't one. */
const num = (text: string) => (text.trim() === "" ? undefined : Number(text.replace(",", ".").trim()));
const between = (v: number | undefined, min: number, max: number) => v !== undefined && Number.isFinite(v) && v >= min && v <= max;
const optional = (v: number | undefined, min: number, max = Infinity) => v === undefined || between(v, min, max);

/** The request a form makes, or what's wrong with it. */
function requestOf(question: Question, forms: Forms): { request: ProjectionRequest } | { problem: string } {
  if (question === "goal") {
    const f = forms.goal;
    const target = num(f.targetAmount);
    const contribution = num(f.monthlyContribution);
    const horizon = num(f.targetHorizonYears);
    if (!(target !== undefined && target > 0)) return { problem: "Enter the amount to reach." };
    if (!optional(contribution, 0)) return { problem: "The monthly contribution is 0 or more." };
    if (!optional(horizon, 1, PROJECTION_MAX_YEARS) || (horizon !== undefined && !Number.isInteger(horizon))) return { problem: `The deadline is 1 to ${PROJECTION_MAX_YEARS} years.` };
    return { request: { goal: { targetAmount: target, monthlyContribution: contribution, targetHorizonYears: horizon } } };
  }
  const f = forms[question];
  const horizon = num(f.horizonYears);
  const until = num(f.yearsUntilRetirement);
  const contribution = num(f.monthlyContribution);
  if (!between(horizon, 1, PROJECTION_MAX_YEARS) || !Number.isInteger(horizon)) return { problem: `The years in retirement are 1 to ${PROJECTION_MAX_YEARS}.` };
  if (!optional(until, 0, PROJECTION_MAX_YEARS) || (until !== undefined && !Number.isInteger(until))) return { problem: `The years until retirement are 0 to ${PROJECTION_MAX_YEARS}.` };
  if (horizon! + (until ?? 0) > PROJECTION_MAX_YEARS) return { problem: `Years until retirement and in retirement add up to ${PROJECTION_MAX_YEARS} at most.` };
  if (!optional(contribution, 0)) return { problem: "The monthly contribution is 0 or more." };
  if (question === "survival") {
    const withdrawal = num(forms.survival.monthlyWithdrawal);
    if (!(withdrawal !== undefined && withdrawal > 0)) return { problem: "Enter the monthly withdrawal." };
    return { request: { survival: { monthlyWithdrawal: withdrawal, horizonYears: horizon!, yearsUntilRetirement: until, monthlyContribution: contribution } } };
  }
  const success = num(forms.safeWithdrawal.targetSuccessPct);
  if (!optional(success, 50, 99)) return { problem: "The success rate is 50% to 99%." };
  return { request: { safeWithdrawal: { horizonYears: horizon!, yearsUntilRetirement: until, monthlyContribution: contribution, targetSuccessPct: success } } };
}

/**
 * PROJECTION — a portfolio's page (any the user reads, as the stress test): a Monte Carlo of where
 * it could go as it is (POST .../projection), on one of three questions, each its own form, run
 * when asked: reaching a goal (the probability, and when at the 10th/50th/90th percentile), whether
 * monthly withdrawals last (the success rate, the ending balances), and the safe withdrawal (the
 * largest that lasts in the success rate asked). Goal and survival draw the balance's fan, year by
 * year, with the probability beside it. What the runs rest on (models/Projection's basis) is
 * spelled out under them. Inputs are in today's money, balances nominal: the page says so. Under 12
 * months of returns the backend refuses, and the page says why and when to come back.
 */
// `picker`: the form's first field, the portfolio it runs on (Plan's).
export function ProjectionPage({ portfolioUuid, trail, eyebrow, picker }: { portfolioUuid: string; trail: Crumb[]; eyebrow?: string; picker?: React.ReactNode }) {
  const [question, setQuestion] = useState<Question>("goal");
  const [forms, setForms] = useState<Forms>(INITIAL_FORMS);
  // By portfolio and question (`${portfolioUuid}:${question}`): another portfolio picked keeps the form.
  const [outcomes, setOutcomes] = useState<Partial<Record<string, Outcome>>>({});
  const [running, setRunning] = useState(false);
  // The reference currency, once a run has said it.
  const [currency, setCurrency] = useState<string | null>(null);

  const built = requestOf(question, forms);
  const problem = "problem" in built ? built.problem : null;
  const outcome = outcomes[`${portfolioUuid}:${question}`];

  const run = async () => {
    if (!("request" in built)) return;
    const asked = `${portfolioUuid}:${question}`;
    setRunning(true);
    try {
      const data = await projectionService.run(portfolioUuid, built.request);
      setCurrency(data.currency);
      setOutcomes((o) => ({ ...o, [asked]: { data, error: null } }));
    } catch (err) {
      const tooShort = err instanceof ApiError && err.status === 409 && err.errorType === PROJECTION_HISTORY_TOO_SHORT;
      const months = tooShort && err.metadata.months !== undefined ? Number(err.metadata.months) : NaN;
      setOutcomes((o) => ({
        ...o,
        [asked]: tooShort
          ? { data: null, error: null, tooShort: { months: Number.isFinite(months) ? months : null } }
          : { data: null, error: err instanceof Error ? err.message : "Unable to run the projection." },
      }));
    } finally {
      setRunning(false);
    }
  };

  const set = <Q extends Question>(q: Q, field: keyof Forms[Q], value: string) =>
    setForms((f) => ({ ...f, [q]: { ...f[q], [field]: value } }));
  const unit = currency ?? "";

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="Projection" />
      <div className="flex flex-col gap-2">
        {eyebrow && <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C]">{eyebrow}</p>}
        <h1 className="text-[30px] md:text-[40px] font-bold text-[#1c1917] leading-[1.05]" style={serif}>Projection</h1>
        <p className="flex items-start gap-2 text-[12.5px] text-[#78716c] max-w-3xl">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Where the portfolio as it is could go, over thousands of simulated markets drawn from its past returns. A range of outcomes, not a forecast: nothing is recorded. You enter amounts in today&apos;s money; the results are in the money of each year, inflation included.
        </p>
      </div>

      {/* The question on the left, what it gives on the right: wide screens fill with the answer. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] gap-6 items-start">
        {/* Its own box: Module fills its grid cell, which would stretch it to the answer's height. */}
        <div className="lg:sticky lg:top-6">
          <Module>
            <ModuleHead title="Question" />
            <div className={`${MODULE_BODY} space-y-5`}>
              {picker}
              <div role="tablist" aria-label="Question" className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2.5">
                {QUESTIONS.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    role="tab"
                    aria-selected={question === q.id}
                    onClick={() => setQuestion(q.id)}
                    className={`text-left rounded-2xl border px-4 py-3 transition-colors ${
                      question === q.id ? "border-[#C49A3C] bg-[#FBF6EA]" : "border-[#EEE9DD] bg-white hover:border-[#C49A3C]/60"
                    }`}
                  >
                    <span className="block text-[13px] font-black text-[#1c1917]">{q.label}</span>
                    <span className="block text-[11.5px] text-[#78716c] mt-1 leading-snug">{q.detail}</span>
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); void run(); }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 pt-5 border-t border-[#EEE9DD]"
              >
                {question === "goal" && (
                  <>
                    <Field label="Amount to reach" suffix={unit} value={forms.goal.targetAmount} onChange={(v) => set("goal", "targetAmount", v)} />
                    <Field label="Added each month" suffix={unit} placeholder="0" value={forms.goal.monthlyContribution} onChange={(v) => set("goal", "monthlyContribution", v)} />
                    <Field label="Deadline" suffix="years" placeholder="None" value={forms.goal.targetHorizonYears} onChange={(v) => set("goal", "targetHorizonYears", v)} />
                  </>
                )}
                {question === "survival" && (
                  <>
                    <Field label="Withdrawn each month" suffix={unit} value={forms.survival.monthlyWithdrawal} onChange={(v) => set("survival", "monthlyWithdrawal", v)} />
                    <Field label="Years in retirement" suffix="years" value={forms.survival.horizonYears} onChange={(v) => set("survival", "horizonYears", v)} />
                    <Field label="Years until retirement" suffix="years" value={forms.survival.yearsUntilRetirement} onChange={(v) => set("survival", "yearsUntilRetirement", v)} />
                    <Field label="Added each month until then" suffix={unit} placeholder="0" value={forms.survival.monthlyContribution} onChange={(v) => set("survival", "monthlyContribution", v)} />
                  </>
                )}
                {question === "safeWithdrawal" && (
                  <>
                    <Field label="Years in retirement" suffix="years" value={forms.safeWithdrawal.horizonYears} onChange={(v) => set("safeWithdrawal", "horizonYears", v)} />
                    <Field label="Years until retirement" suffix="years" value={forms.safeWithdrawal.yearsUntilRetirement} onChange={(v) => set("safeWithdrawal", "yearsUntilRetirement", v)} />
                    <Field label="Added each month until then" suffix={unit} placeholder="0" value={forms.safeWithdrawal.monthlyContribution} onChange={(v) => set("safeWithdrawal", "monthlyContribution", v)} />
                    <Field label="Success rate" suffix="%" value={forms.safeWithdrawal.targetSuccessPct} onChange={(v) => set("safeWithdrawal", "targetSuccessPct", v)} />
                  </>
                )}
                <div className="sm:col-span-2 lg:col-span-1 flex flex-col gap-2 pt-1">
                  {problem && <span className="text-xs font-bold text-amber-700">{problem}</span>}
                  <button
                    type="submit"
                    disabled={problem !== null || running}
                    className="flex items-center justify-center gap-2 h-11 w-full px-4 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Run the projection
                  </button>
                </div>
              </form>
            </div>
          </Module>
        </div>

        <div className="min-w-0 space-y-6">
          {outcome?.tooShort ? (
            <Module>
              <div className="px-6 py-6 flex items-start gap-3 text-[13px] text-[#57534e]">
                <Hourglass className="h-5 w-5 shrink-0 text-[#C49A3C]" />
                {outcome.tooShort.months === 0 ? (
                  <p>
                    Nothing to project yet: the portfolio holds nothing, or hasn&apos;t been rebuilt since it was created. It&apos;s rebuilt overnight (at 04:00) and after each edit; try again once it has been.
                  </p>
                ) : (
                  <p>
                    Not enough history to project yet: {outcome.tooShort.months === null
                      ? `a projection needs ${PROJECTION_MIN_MONTHS} months of returns the positions held share.`
                      : `the positions held have ${outcome.tooShort.months} ${outcome.tooShort.months === 1 ? "month" : "months"} of returns together, and a projection needs ${PROJECTION_MIN_MONTHS}.`} It comes once they have them.
                  </p>
                )}
              </div>
            </Module>
          ) : outcome?.error ? (
            <Module>
              <p className="px-6 py-6 flex items-center gap-2 text-sm font-semibold text-[#e11d48]"><AlertTriangle className="h-4 w-4 shrink-0" /> {outcome.error}</p>
            </Module>
          ) : outcome?.data ? (
            <div className={`space-y-6 transition-opacity ${running ? "opacity-50" : ""}`}>
              <Result data={outcome.data} />
              <Basis data={outcome.data} />
            </div>
          ) : (
            <Awaiting question={question} running={running} />
          )}
        </div>
      </div>
    </div>
  );
}

// What each question's answer shows, before it's run.
const AWAITING: Record<Question, { title: string; figures: string[]; fan: boolean }> = {
  goal: { title: "Reaching the goal", figures: ["Chance of reaching it", "By the deadline", "Median time", "In poor markets"], fan: true },
  survival: { title: "Whether it lasts", figures: ["Lasts the whole time", "Median at retirement", "Median at the end", "End, poor markets"], fan: true },
  safeWithdrawal: { title: "Safe withdrawal", figures: ["Each month", "Withdrawal rate", "Lasts in", "Median at retirement"], fan: false },
};

/**
 * AWAITING — the answer's place before a run: the figures it will give, blank, and the balance's
 * fan drawn faintly where the question has one, so the page reads whole from the start.
 */
function Awaiting({ question, running }: { question: Question; running: boolean }) {
  const a = AWAITING[question];
  return (
    <Module>
      <ModuleHead title={a.title} desc={running ? "Running thousands of simulated markets…" : "Fill in the question and run the projection"} />
      <div className={`${MODULE_BODY} space-y-5 ${running ? "animate-pulse" : ""}`}>
        <Figs>
          {a.figures.map((label, i) => <Fig key={label} label={label} value="—" strong={i === 0} />)}
        </Figs>
        {a.fan ? (
          <svg viewBox="0 0 400 160" preserveAspectRatio="none" className="w-full h-72" aria-hidden>
            <path d="M0 120 C 120 100, 240 70, 400 20 L 400 120 C 240 125, 120 128, 0 120 Z" fill={GOLD} opacity={0.1} />
            <path d="M0 120 C 120 113, 240 100, 400 72" fill="none" stroke={GOLD} strokeOpacity={0.35} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <line x1="0" y1="150" x2="400" y2="150" stroke="#EEE9DD" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : (
          <p className="text-[12.5px] text-[#78716c] leading-relaxed max-w-xl">
            The largest monthly withdrawal that lasts the years in retirement in the share of simulated markets you ask, in today&apos;s money.
          </p>
        )}
      </div>
    </Module>
  );
}

function Field({ label, suffix, value, placeholder, onChange }: { label: string; suffix: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold text-[#78716c] uppercase tracking-wider mb-1.5">{label}</span>
      <span className="relative block">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 px-3 pr-16 rounded-xl bg-white border border-[#E0DACC] text-sm font-semibold tabular-nums text-[#1c1917] outline-none placeholder:text-[#d6d3d1] focus:border-[#C49A3C] focus:ring-4 focus:ring-[#C49A3C]/10"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#a8a29e] pointer-events-none">{suffix}</span>
      </span>
    </label>
  );
}

const durationLabel = (months: number | null) => {
  if (months === null) return "Not reached";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y > 0 && `${y} yr${y === 1 ? "" : "s"}`, m > 0 && `${m} mo`].filter(Boolean).join(" ") || "At once";
};

function Result({ data }: { data: Projection }) {
  const money = (v: number) => formatCurrency(v, data.currency, 0);

  if (data.goal) {
    const g = data.goal;
    return (
      <Module>
        <ModuleHead title="Reaching the goal" desc={`Over ${g.maxHorizonYears} years at most`} />
        <div className={`${MODULE_BODY} space-y-5`}>
          <Figs>
            <Fig label={`Reached within ${g.maxHorizonYears} years`} value={pct(g.probabilityPct)} strong />
            {g.deadlineProbabilityPct !== null && <Fig label="By the deadline" value={pct(g.deadlineProbabilityPct)} />}
            <Fig label="Median time" value={durationLabel(g.monthsToGoalP50)} info="Half the simulated markets reach it sooner, half later." />
            <Fig label="In good markets" value={durationLabel(g.monthsToGoalP10)} info="The time 1 in 10 simulated markets beat." />
            <Fig label="In poor markets" value={durationLabel(g.monthsToGoalP90)} info="The time 9 in 10 simulated markets beat." />
          </Figs>
          <Fan years={g.years} start={data.initialValue} currency={data.currency} probabilityLabel="Reached by then" />
        </div>
      </Module>
    );
  }

  if (data.survival) {
    const s = data.survival;
    return (
      <Module>
        <ModuleHead title="Whether it lasts" desc="Years counted from retirement" />
        <div className={`${MODULE_BODY} space-y-5`}>
          <Figs>
            <Fig label="Lasts the whole time" value={pct(s.successPct)} strong tone={s.successPct >= 80 ? "gain" : s.successPct < 50 ? "loss" : undefined} />
            {s.medianBalanceAtRetirement !== null && <Fig label="Median at retirement" value={money(s.medianBalanceAtRetirement)} />}
            <Fig label="Median at the end" value={money(s.endingBalanceP50)} />
            <Fig label="End, poor markets" value={money(s.endingBalanceP10)} sub={`25th percentile ${money(s.endingBalanceP25)}`} info="What 9 in 10 simulated markets end above." />
            <Fig label="End, good markets" value={money(s.endingBalanceP90)} sub={`75th percentile ${money(s.endingBalanceP75)}`} info="What 1 in 10 simulated markets end above." />
          </Figs>
          <Fan years={s.years} currency={data.currency} probabilityLabel="Run out by then" yearLabel="Year of retirement" />
        </div>
      </Module>
    );
  }

  if (data.safeWithdrawal) {
    const w = data.safeWithdrawal;
    return (
      <Module>
        <ModuleHead title="Safe withdrawal" />
        <div className={`${MODULE_BODY} space-y-4`}>
          <Figs>
            <Fig label="Each month" value={money(w.monthlyWithdrawal)} strong sub={`In today's money: each withdrawal grows with inflation (about ${pct(data.basis.inflationPct)} a year)`} />
            <Fig
              label="Withdrawal rate"
              value={pct(w.annualWithdrawalRatePct)}
              sub={w.medianBalanceAtRetirement !== null ? "A year, of the median balance at retirement" : "A year, of the value today"}
            />
            <Fig label="Lasts in" value={pct(w.achievedSuccessPct)} sub={`Asked ${pct(w.targetSuccessPct)}`} />
            {w.medianBalanceAtRetirement !== null && <Fig label="Median at retirement" value={money(w.medianBalanceAtRetirement)} />}
          </Figs>
          {!w.converged && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              The search stopped before hitting the success rate asked exactly: the withdrawal is the closest it found.
            </p>
          )}
        </div>
      </Module>
    );
  }
  return null;
}

/**
 * The balance's fan, year by year: the 10th–90th percentile band, the median, and the probability
 * so far on its own axis. A goal's starts from the value today (year 0).
 */
function Fan({ years, start, currency, probabilityLabel, yearLabel = "Year" }: {
  years: ProjectionYear[];
  start?: number;
  currency: string;
  probabilityLabel: string;
  yearLabel?: string;
}) {
  if (years.length === 0) return null;
  const points = [
    ...(start !== undefined ? [{ year: 0, band: [start, start] as [number, number], median: start, probability: null as number | null }] : []),
    ...years.map((y) => ({ year: y.year, band: [y.balanceP10, y.balanceP90] as [number, number], median: y.balanceP50, probability: y.probabilityPct as number | null })),
  ];
  return (
    <div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 12, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis yAxisId="value" tickFormatter={(v) => formatCompact(Number(v))} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} width={56} />
            <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(label) => `${yearLabel} ${label}`}
              formatter={(value, name) => {
                if (name === "band" && Array.isArray(value)) return [`${formatCurrency(Number(value[0]), currency, 0)} – ${formatCurrency(Number(value[1]), currency, 0)}`, "10th–90th percentile"];
                if (name === "probability") return [pct(Number(value)), probabilityLabel];
                return [formatCurrency(Number(value), currency, 0), "Median"];
              }}
            />
            <Area yAxisId="value" type="monotone" dataKey="band" stroke="none" fill={GOLD} fillOpacity={0.18} isAnimationActive={false} />
            <Line yAxisId="value" type="monotone" dataKey="median" stroke={GOLD} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line yAxisId="pct" type="monotone" dataKey="probability" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#78716c]">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: GOLD, opacity: 0.25 }} /> 8 in 10 simulated markets</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: GOLD }} /> Median balance</span>
        <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-[#64748b]" /> {probabilityLabel} (right axis)</span>
      </p>
    </div>
  );
}

/** What the runs rest on, from the response's basis. */
function Basis({ data }: { data: Projection }) {
  const b = data.basis;
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—");
  const lines = [
    `${b.simulations.toLocaleString()} simulated markets, drawn from ${b.historyMonths} months of the positions' returns.`,
    b.longRunReturnPct !== null
      ? `Their own return was ${pct(b.ownReturnPct)} a year; with under 5 years of history, it is re-centred on the benchmark's long-run ${pct(b.longRunReturnPct)}.`
      : `Their own return was ${pct(b.ownReturnPct)} a year.`,
    `The simulated return is ${pct(b.simulatedReturnPct)} a year${b.capped ? ", held at the 10% ceiling" : ""}.`,
    b.cashPct > 0 ? `The cash, ${pct(b.cashPct)} of the portfolio, earns nothing.` : null,
    `Inflation ${pct(b.inflationPct)} a year, give or take ${pct(b.inflationStdPct)}, grows the contributions, withdrawals and goal month by month from today; the balances shown include it.`,
  ].filter(Boolean);
  return (
    <Module>
      <ModuleHead title="Assumptions" />
      <div className={MODULE_BODY}>
        <ul className="space-y-1.5 text-[12.5px] text-[#57534e] list-disc pl-4">
          {lines.map((l) => <li key={l}>{l}</li>)}
        </ul>
        <p className="mt-3 text-[11px] text-[#a8a29e]">
          Starting value {formatCurrency(data.initialValue, data.currency, 0)}, cash included · prices of {date(data.pricedAt)} · returns of {date(data.returnsComputedAt)}. Past returns don&apos;t promise future ones.
        </p>
      </div>
    </Module>
  );
}
