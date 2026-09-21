"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  DROP_REACTION_OPTIONS, EXCLUSION_SUGGESTIONS, GOAL_LIMIT, INCOME_STABILITY_OPTIONS, INSTRUMENT_OPTIONS,
  LIQUIDITY_OPTIONS, PURPOSE_OPTIONS, REBALANCE_OPTIONS, REVIEW_OPTIONS,
} from "../../../lib/ips";
import type { InvestorPolicy, IpsGoal } from "../../../models/InvestorPolicy";
import {
  ChipSelect, ChoiceCards, Field, FieldGroup, INPUT_CLASS, NumberInput, TagList, TextArea, TextInput, YesNo,
} from "./fields";

export interface StepProps {
  policy: InvestorPolicy;
  update: (change: (current: InvestorPolicy) => InvestorPolicy) => void;
  currency: string;
}

export function ObjectivesStep({ policy, update, currency }: StepProps) {
  const o = policy.objectives;
  const set = (patch: Partial<typeof o>) => update((p) => ({ ...p, objectives: { ...p.objectives, ...patch } }));
  const setGoal = (id: string, patch: Partial<IpsGoal>) =>
    set({ goals: o.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) });

  return (
    <div className="space-y-8">
      <FieldGroup label="Main purpose" hint="What is this portfolio mainly for?">
        <ChoiceCards options={PURPOSE_OPTIONS} value={o.purpose} onChange={(purpose) => set({ purpose })} />
      </FieldGroup>

      <FieldGroup label="Goals" hint="Concrete things the portfolio should help you reach.">
        <div className="space-y-3">
          {o.goals.map((g, i) => (
            <div key={g.id} className="grid grid-cols-1 sm:grid-cols-[1fr_9rem_7rem_auto] gap-3 items-center">
              <input
                type="text"
                value={g.description}
                maxLength={200}
                aria-label={`Goal ${i + 1} description`}
                placeholder="e.g. Buy a house"
                onChange={(e) => setGoal(g.id, { description: e.target.value })}
                className={INPUT_CLASS}
              />
              <NumberInput
                aria-label={`Goal ${i + 1} target amount`}
                value={g.targetAmount}
                onChange={(targetAmount) => setGoal(g.id, { targetAmount })}
                placeholder="Amount"
                suffix={currency}
              />
              <NumberInput
                aria-label={`Goal ${i + 1} target year`}
                value={g.targetYear}
                onChange={(targetYear) => setGoal(g.id, { targetYear })}
                placeholder="Year"
                min={new Date().getFullYear()}
                max={2200}
              />
              <button
                type="button"
                aria-label={`Remove goal ${i + 1}`}
                onClick={() => set({ goals: o.goals.filter((x) => x.id !== g.id) })}
                className="justify-self-start p-3 rounded-xl text-[#a8a29e] hover:text-rose-500 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={o.goals.length >= GOAL_LIMIT}
            onClick={() =>
              set({ goals: [...o.goals, { id: crypto.randomUUID(), description: "", targetAmount: null, targetYear: null }] })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-dashed border-[#d6cdb8] bg-white text-[13px] font-semibold text-[#78716c] hover:border-[#C49A3C] hover:text-[#C49A3C] transition-all disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> Add a goal
          </button>
        </div>
      </FieldGroup>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Field label="Target annual return" hint="Before inflation, on average.">
          <NumberInput value={o.targetReturnPct} onChange={(targetReturnPct) => set({ targetReturnPct })} placeholder="6" suffix="%" max={100} step={0.1} />
        </Field>
        <Field label="Income needed per year" hint="Drawn from the portfolio. Leave empty if none.">
          <NumberInput value={o.annualIncomeNeed} onChange={(annualIncomeNeed) => set({ annualIncomeNeed })} placeholder="0" suffix={currency} />
        </Field>
        <Field label="Contribution per month" hint="What you add regularly.">
          <NumberInput value={o.monthlyContribution} onChange={(monthlyContribution) => set({ monthlyContribution })} placeholder="0" suffix={currency} />
        </Field>
      </div>
    </div>
  );
}

export function RiskStep({ policy, update, riskTolerance }: StepProps & { riskTolerance: string | null }) {
  const r = policy.risk;
  const set = (patch: Partial<typeof r>) => update((p) => ({ ...p, risk: { ...p.risk, ...patch } }));

  return (
    <div className="space-y-8">
      {riskTolerance && (
        <p className="text-sm font-medium text-[#78716c] bg-[#F7F5EF] rounded-2xl px-4 py-3">
          Your general risk tolerance, set in the General tab, is <strong className="text-[#1c1917]">{riskTolerance}</strong>.
          The answers below make it specific.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field label="Largest acceptable loss" hint="The fall from a peak you could sit through without changing the plan.">
          <NumberInput value={r.maxDrawdownPct} onChange={(maxDrawdownPct) => set({ maxDrawdownPct })} placeholder="20" suffix="%" max={100} />
        </Field>
        <Field label="Emergency fund" hint="Months of expenses kept outside the portfolio.">
          <NumberInput value={r.emergencyFundMonths} onChange={(emergencyFundMonths) => set({ emergencyFundMonths })} placeholder="6" suffix="months" max={240} />
        </Field>
      </div>

      <FieldGroup label="If your portfolio fell 20% in a few months, you would…">
        <ChoiceCards columns={4} options={DROP_REACTION_OPTIONS} value={r.dropReaction} onChange={(dropReaction) => set({ dropReaction })} />
      </FieldGroup>

      <FieldGroup label="How stable is your income?">
        <ChoiceCards options={INCOME_STABILITY_OPTIONS} value={r.incomeStability} onChange={(incomeStability) => set({ incomeStability })} />
      </FieldGroup>
    </div>
  );
}

export function ConstraintsStep({ policy, update }: StepProps) {
  const c = policy.constraints;
  const set = (patch: Partial<typeof c>) => update((p) => ({ ...p, constraints: { ...p.constraints, ...patch } }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field label="Time horizon" hint="Years until you expect to start drawing on the money.">
          <NumberInput value={c.timeHorizonYears} onChange={(timeHorizonYears) => set({ timeHorizonYears })} placeholder="20" suffix="years" max={100} />
        </Field>
        <Field label="Tax residence" hint="Where you are taxed on investment income.">
          <TextInput value={c.taxResidence} onChange={(taxResidence) => set({ taxResidence })} placeholder="e.g. Italy" />
        </Field>
      </div>

      <FieldGroup label="Liquidity need" hint="How quickly you might need to turn investments into cash.">
        <ChoiceCards options={LIQUIDITY_OPTIONS} value={c.liquidityNeed} onChange={(liquidityNeed) => set({ liquidityNeed })} />
      </FieldGroup>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Field label="Liquidity notes" hint="Planned withdrawals or big expenses ahead.">
          <TextArea value={c.liquidityNotes} onChange={(liquidityNotes) => set({ liquidityNotes })} placeholder="e.g. School fees in 2028" />
        </Field>
        <Field label="Tax notes" hint="Wrappers, allowances or rules that shape what you buy.">
          <TextArea value={c.taxNotes} onChange={(taxNotes) => set({ taxNotes })} placeholder="e.g. Capital gains taxed at 26%" />
        </Field>
      </div>

      <Field label="Other constraints" hint="Legal or regulatory limits, dependants, anything unusual about your situation.">
        <TextArea value={c.otherConstraints} onChange={(otherConstraints) => set({ otherConstraints })} />
      </Field>
    </div>
  );
}

export function GuidelinesStep({ policy, update }: StepProps) {
  const g = policy.guidelines;
  const set = (patch: Partial<typeof g>) => update((p) => ({ ...p, guidelines: { ...p.guidelines, ...patch } }));

  return (
    <div className="space-y-8">
      <FieldGroup label="Instruments you allow" hint="Select every type you are happy to hold.">
        <ChipSelect options={INSTRUMENT_OPTIONS} selected={g.allowedInstruments} onChange={(allowedInstruments) => set({ allowedInstruments })} />
      </FieldGroup>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FieldGroup label="Leverage" hint="Borrowing to invest.">
          <YesNo value={g.leverageAllowed} onChange={(leverageAllowed) => set({ leverageAllowed })} />
        </FieldGroup>
        <Field label="Largest single position" hint="Maximum share of the portfolio in any one holding.">
          <NumberInput value={g.maxPositionPct} onChange={(maxPositionPct) => set({ maxPositionPct })} placeholder="10" suffix="%" max={100} />
        </Field>
      </div>

      <FieldGroup label="Exclusions" hint="Sectors or themes you don't want to invest in.">
        <TagList
          values={g.exclusions}
          onChange={(exclusions) => set({ exclusions })}
          suggestions={EXCLUSION_SUGGESTIONS}
          placeholder="Add your own and press Enter"
        />
      </FieldGroup>
    </div>
  );
}

export function MonitoringStep({ policy, update }: StepProps) {
  const m = policy.monitoring;
  const set = (patch: Partial<typeof m>) => update((p) => ({ ...p, monitoring: { ...p.monitoring, ...patch } }));

  return (
    <div className="space-y-8">
      <FieldGroup label="How often do you review this policy?">
        <ChoiceCards columns={4} options={REVIEW_OPTIONS} value={m.reviewFrequency} onChange={(reviewFrequency) => set({ reviewFrequency })} />
      </FieldGroup>

      <FieldGroup label="Rebalancing" hint="How the portfolio is brought back to its targets.">
        <ChoiceCards options={REBALANCE_OPTIONS} value={m.rebalanceMethod} onChange={(rebalanceMethod) => set({ rebalanceMethod })} />
      </FieldGroup>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {m.rebalanceMethod !== "calendar" && (
          <Field label="Drift band" hint="How far a class can stray from its target, in percentage points, before it is rebalanced.">
            <NumberInput value={m.rebalanceBandPct} onChange={(rebalanceBandPct) => set({ rebalanceBandPct })} placeholder="5" suffix="pts" max={100} step={0.5} />
          </Field>
        )}
        <Field label="Benchmark" hint="What you measure the portfolio against. Optional.">
          <TextInput value={m.benchmark} onChange={(benchmark) => set({ benchmark })} placeholder="e.g. MSCI World" />
        </Field>
      </div>

      <Field label="Review triggers" hint="Events that call for a review outside the schedule.">
        <TextArea value={m.reviewTriggers} onChange={(reviewTriggers) => set({ reviewTriggers })} placeholder="e.g. Change of job, a new child, a fall of more than 15%" />
      </Field>
    </div>
  );
}
