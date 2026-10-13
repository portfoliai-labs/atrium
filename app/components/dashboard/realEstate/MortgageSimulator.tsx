// components/dashboard/realEstate/MortgageSimulator.tsx
"use client";

import { useEffect, useState } from "react";
import { Calculator, Loader2 } from "lucide-react";
import { useRealEstate } from "../../../context/RealEstateContext";
import { realEstateService } from "../../../services/realEstateService";
import { formatCurrency } from "../../../lib/format";
import { FREQUENCY_LABELS, PREPAYMENT_EFFECT_LABELS, RATE_INDEX_LABELS, fieldErrorText } from "../../../lib/realEstate";
import { dayLabel, today } from "../../../lib/wallets";
import type {
  InstalmentFrequency, Mortgage, MortgageRateInput, PrepaymentEffect, PrepaymentSimulation, PrepaymentSimulationRequest, Property,
  RateIndex, RefinancingSimulation, RefinancingSimulationRequest, ScheduleOutlook,
} from "../../../models/RealEstate";
import { Pills } from "../../preview/PreviewKit";
import { DEMO_DISABLED_TITLE } from "../../preview/DemoBanner";
import { DialogShell, Field, INPUT, parseAmount } from "../wallets/WalletDialogs";
import { Percent } from "./NewPropertyFields";

type Mode = "prepay" | "refinance";

/**
 * A simulation asked again a moment after its request stops changing: undefined while it's worked
 * out; `error` the API's refusal (a past day, a mortgage that owes nothing, a term that doesn't fit).
 */
function useSimulation<Q, R>(request: Q | null, run: (request: Q) => Promise<R>, fallback: string) {
  const key = request ? JSON.stringify(request) : null;
  const [state, setState] = useState<{ key: string; result: R | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!key || !request) return;
    let cancelled = false;
    const t = setTimeout(() => {
      run(request)
        .then((result) => { if (!cancelled) setState({ key, result, error: null }); })
        .catch((err) => { if (!cancelled) setState({ key, result: null, error: fieldErrorText(err, fallback) }); });
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
    // `request` is identified by `key`; `run` reads the same source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!key) return { result: undefined, error: null };
  return state?.key === key ? { result: state.result ?? undefined, error: state.error } : { result: undefined, error: null };
}

/** An amount field's value: "" is none (null), anything else must be a number ≥ 0 (undefined when it isn't). */
function optionalAmount(text: string): string | null | undefined {
  if (!text.trim()) return null;
  const v = parseAmount(text);
  return v !== null && Number(v) >= 0 ? v : undefined;
}

/**
 * MORTGAGE SIMULATOR — what repaying part of a mortgage early, or moving it to another rate and term
 * (a surroga, a renegotiation), would change: the instalment, the instalments left, the last one,
 * the interest left and the saving net of the costs, against the schedule as it stands. Nothing is
 * stored until it's recorded: a prepayment as a mortgage_prepayment transaction (on the day it's
 * paid); a refinancing by closing this mortgage on the day and adding the new one for what's owed.
 * A variable rate is taken as today's for the whole term; the savings are before the deduction on
 * mortgage interest. A demo account's works out on the sample and records nothing.
 */
export function MortgageSimulatorDialog({ property, mortgage, readOnly, onClose, onRecorded }: {
  property: Property;
  mortgage: Mortgage;
  readOnly: boolean;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const { source, sample } = useRealEstate();
  const [mode, setMode] = useState<Mode>("prepay");
  const [day, setDay] = useState(today());
  const [costs, setCosts] = useState("");
  // Prepay.
  const [amount, setAmount] = useState("");
  const [effect, setEffect] = useState<PrepaymentEffect>("reduce_instalment");
  // Refinance.
  const [rateKind, setRateKind] = useState<"fixed" | "variable">("fixed");
  const [fixedPct, setFixedPct] = useState("");
  const [index, setIndex] = useState<RateIndex>("euribor_3m");
  const [spreadPct, setSpreadPct] = useState("");
  const [initialPct, setInitialPct] = useState("");
  const [termYears, setTermYears] = useState("");
  const [frequency, setFrequency] = useState<InstalmentFrequency>(mortgage.frequency);
  const [lender, setLender] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const money = (v: number, digits = 0) => formatCurrency(v, mortgage.currency, digits);
  const costsValue = optionalAmount(costs);
  const amountValue = parseAmount(amount);

  const prepayRequest: PrepaymentSimulationRequest | null = mode === "prepay" && day && amountValue !== null && Number(amountValue) > 0 && costsValue !== undefined
    ? { prepaidOn: day, amount: amountValue, effect, ...(costsValue ? { costs: costsValue } : {}) }
    : null;

  const rate: MortgageRateInput | null = rateKind === "fixed"
    ? (parseAmount(fixedPct) !== null ? { fixedPct: parseAmount(fixedPct)! } : null)
    : (parseAmount(spreadPct) !== null && parseAmount(initialPct) !== null
      ? { variable: { index, spreadPct: parseAmount(spreadPct)!, initialPct: parseAmount(initialPct)! } }
      : null);
  const years = termYears.trim() ? Number(termYears.replace(",", ".")) : null;
  const termMonths = years !== null && Number.isFinite(years) && years > 0 ? Math.round(years * 12) : null;
  const termValid = !termYears.trim() || (termMonths !== null && termMonths <= 600);
  const refinanceRequest: RefinancingSimulationRequest | null = mode === "refinance" && day && rate && termValid && costsValue !== undefined
    ? { refinancedOn: day, rate, frequency, ...(termMonths ? { termMonths } : {}), ...(costsValue ? { costs: costsValue } : {}) }
    : null;

  const prepay = useSimulation<PrepaymentSimulationRequest, PrepaymentSimulation>(
    prepayRequest, (r) => source.simulatePrepayment(mortgage.uuid, r), "Unable to work out this prepayment.",
  );
  const refinance = useSimulation<RefinancingSimulationRequest, RefinancingSimulation>(
    refinanceRequest, (r) => source.simulateRefinancing(mortgage.uuid, r), "Unable to work out this refinancing.",
  );
  const sim = mode === "prepay" ? prepay : refinance;
  const request = mode === "prepay" ? prepayRequest : refinanceRequest;
  const variable = !!mortgage.rate.variable || (mode === "refinance" && rateKind === "variable");

  // A prepayment is recorded on the day it's paid (a transaction isn't booked ahead).
  const canRecord = !readOnly && !!sim.result && !busy && (mode === "refinance" || day === today());
  const record = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "prepay" && prepay.result) {
        await realEstateService.addTransactions(property.uuid, [{
          kind: "mortgage_prepayment", bookedOn: day, amount: String(-prepay.result.prepaid), mortgageUuid: mortgage.uuid,
          prepaymentEffect: effect, counterparty: mortgage.lender,
        }]);
      } else if (mode === "refinance" && refinance.result && rate) {
        const r = refinance.result;
        await realEstateService.updateMortgage(mortgage.uuid, { closedOn: day });
        try {
          await realEstateService.addMortgage(property.uuid, {
            principal: String(r.principal), firstInstalmentOn: r.refinanced.instalments[0]?.dueOn ?? day, termMonths: r.termMonths,
            frequency, rate, lender: lender.trim() || mortgage.lender, note: `Refinances the mortgage of ${dayLabel(mortgage.firstInstalmentOn)}`,
          });
        } catch (err) {
          // The new one wasn't added: the old one stays open.
          await realEstateService.updateMortgage(mortgage.uuid, { closedOn: "" }).catch(() => {});
          throw err;
        }
      }
      onRecorded();
    } catch (err) {
      setError(fieldErrorText(err, "Unable to record it."));
      setBusy(false);
    }
  };

  const after = mode === "prepay" ? prepay.result?.simulated : refinance.result?.refinanced;
  return (
    <DialogShell
      icon={<Calculator className="h-5 w-5" />}
      title={`Simulate · ${mortgage.lender ?? "Mortgage"}`}
      subtitle={`${money(mortgage.residualDebt)} left at ${mortgage.currentRatePct.toFixed(2)}%. Nothing changes until you record it.`}
      busy={busy}
      error={error}
      submitLabel={mode === "prepay" ? "Record the prepayment" : "Record the refinancing"}
      canSubmit={canRecord}
      onSubmit={() => void record()}
      onClose={onClose}
      wide
    >
      <Pills options={[{ value: "prepay", label: "Prepay" }, { value: "refinance", label: "Refinance" }]} value={mode} onChange={setMode} />

      <div className={`grid grid-cols-2 gap-3 ${mode === "prepay" ? "md:grid-cols-[1fr_0.9fr_1.4fr_0.9fr]" : "md:grid-cols-4"}`}>
        <Field label="Day"><input type="date" value={day} min={today()} onChange={(e) => setDay(e.target.value)} className={INPUT} /></Field>
        {mode === "prepay" ? (
          <>
            <Field label={`Amount (${mortgage.currency})`}>
              <input autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={String(Math.round(mortgage.residualDebt / 5 / 1000) * 1000 || 1000)} className={INPUT} />
            </Field>
            <Field label="Then">
              <select value={effect} onChange={(e) => setEffect(e.target.value as PrepaymentEffect)} className={INPUT}>
                <option value="reduce_instalment">Lower instalment</option>
                <option value="shorten_term">{PREPAYMENT_EFFECT_LABELS.shorten_term}</option>
              </select>
            </Field>
            <Field label="Bank charges"><input value={costs} onChange={(e) => setCosts(e.target.value)} inputMode="decimal" placeholder="0" className={INPUT} /></Field>
          </>
        ) : (
          <>
            <Field label="New rate">
              <select value={rateKind} onChange={(e) => setRateKind(e.target.value as "fixed" | "variable")} className={INPUT}>
                <option value="fixed">Fixed</option>
                <option value="variable">Variable</option>
              </select>
            </Field>
            {rateKind === "fixed" ? (
              <Field label="Rate"><Percent value={fixedPct} onChange={setFixedPct} placeholder={mortgage.currentRatePct.toFixed(2)} /></Field>
            ) : (
              <>
                <Field label="Index">
                  <select value={index} onChange={(e) => setIndex(e.target.value as RateIndex)} className={INPUT}>
                    {(Object.keys(RATE_INDEX_LABELS) as RateIndex[]).map((k) => <option key={k} value={k}>{RATE_INDEX_LABELS[k]}</option>)}
                  </select>
                </Field>
                <Field label="Spread"><Percent value={spreadPct} onChange={setSpreadPct} placeholder="1.00" /></Field>
                <Field label="Rate today"><Percent value={initialPct} onChange={setInitialPct} placeholder={mortgage.currentRatePct.toFixed(2)} /></Field>
              </>
            )}
            <Field label="Costs"><input value={costs} onChange={(e) => setCosts(e.target.value)} inputMode="decimal" placeholder="0" className={INPUT} /></Field>
            <Field label="Term (years)" hint={termValid ? undefined : "Up to 50 years."}>
              <input value={termYears} onChange={(e) => setTermYears(e.target.value)} inputMode="decimal" placeholder="As left" className={INPUT} />
            </Field>
            <Field label="Instalments">
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as InstalmentFrequency)} className={INPUT}>
                {(Object.keys(FREQUENCY_LABELS) as InstalmentFrequency[]).map((k) => <option key={k} value={k}>{FREQUENCY_LABELS[k]}</option>)}
              </select>
            </Field>
            <Field label="New lender"><input value={lender} onChange={(e) => setLender(e.target.value)} placeholder={mortgage.lender ?? "Optional"} className={INPUT} /></Field>
          </>
        )}
      </div>

      {!request ? (
        <p className="text-[12.5px] text-[#a8a29e]">{mode === "prepay" ? "Pick a day and an amount." : "Pick a day and the new rate."}</p>
      ) : sim.error ? (
        <p className="text-[12.5px] text-rose-600">{sim.error}</p>
      ) : !sim.result || !after ? (
        <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
      ) : (
        <div className="space-y-3">
          <Comparison current={sim.result.current} after={after} label={mode === "prepay" ? "After the prepayment" : "Refinanced"} money={money} />
          <Saving interestSaved={sim.result.interestSaved} costs={sim.result.costs} netSaving={sim.result.netSaving} money={money} />
          {mode === "prepay" && prepay.result && amountValue !== null && prepay.result.prepaid < Number(amountValue) && (
            <p className="text-[12.5px] font-semibold text-slate-700">Only {money(prepay.result.prepaid, 2)} is owed on that day: the mortgage would be paid off.</p>
          )}
          {mode === "refinance" && refinance.result && (
            <p className="text-[12.5px] text-slate-600">
              The new mortgage: {money(refinance.result.principal, 2)} over {refinance.result.termMonths % 12 === 0 ? `${refinance.result.termMonths / 12} years` : `${refinance.result.termMonths} months`}
              {refinance.result.refinanced.instalments[0] && `, the first instalment ${dayLabel(refinance.result.refinanced.instalments[0].dueOn)}`}.
              {refinance.result.costs > 0 && (refinance.result.breakEvenInstalment
                ? ` The costs are made back by instalment ${refinance.result.breakEvenInstalment}${refinance.result.breakEvenOn ? ` (${dayLabel(refinance.result.breakEvenOn)})` : ""}.`
                : " The interest saved never makes the costs back.")}
            </p>
          )}
          <p className="text-[11px] text-slate-400">
            {variable && "A variable rate is taken as today's for the whole term. "}
            Savings are gross: the tax deduction on mortgage interest isn&apos;t counted.
          </p>
          {!readOnly && mode === "prepay" && day !== today() && (
            <p className="text-[11.5px] text-slate-500">A prepayment is recorded on the day it&apos;s paid: come back then, or add it from Add transaction.</p>
          )}
          {!readOnly && mode === "refinance" && (
            <p className="text-[11.5px] text-slate-500">Recording it closes this mortgage on {dayLabel(day)} and adds the new one for what&apos;s owed then.</p>
          )}
          {sample && <p className="text-[11.5px] text-slate-500">{DEMO_DISABLED_TITLE}: worked out on the sample, nothing is recorded.</p>}
        </div>
      )}
    </DialogShell>
  );
}

/** The schedule as it stands against the simulated one, from the day on. */
function Comparison({ current, after, label, money }: { current: ScheduleOutlook; after: ScheduleOutlook; label: string; money: (v: number, digits?: number) => string }) {
  const rows: { label: string; now: string; then: string; better?: boolean }[] = [
    { label: "Instalment", now: money(current.nextPayment, 2), then: after.instalmentCount ? money(after.nextPayment, 2) : "—", better: after.nextPayment < current.nextPayment },
    { label: "Rate", now: `${current.ratePct.toFixed(2)}%`, then: `${after.ratePct.toFixed(2)}%`, better: after.ratePct < current.ratePct },
    { label: "Instalments left", now: String(current.instalmentCount), then: String(after.instalmentCount), better: after.instalmentCount < current.instalmentCount },
    { label: "Last instalment", now: current.lastInstalmentOn ? dayLabel(current.lastInstalmentOn) : "—", then: after.lastInstalmentOn ? dayLabel(after.lastInstalmentOn) : "Paid off", better: (after.lastInstalmentOn ?? "") < (current.lastInstalmentOn ?? "") },
    { label: "Interest left", now: money(current.interest), then: money(after.interest), better: after.interest < current.interest },
    { label: "Still to pay", now: money(current.totalPaid), then: money(after.totalPaid), better: after.totalPaid < current.totalPaid },
  ];
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50">
            <th className="px-3 py-2" />
            <th className="px-3 py-2 text-right">As it stands</th>
            <th className="px-3 py-2 text-right">{label}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="px-3 py-1.5 text-slate-500">{r.label}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{r.now}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums font-bold ${r.now === r.then ? "text-slate-700" : r.better ? "text-emerald-700" : "text-rose-600"}`}>{r.then}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Saving({ interestSaved, costs, netSaving, money }: { interestSaved: number; costs: number; netSaving: number; money: (v: number) => string }) {
  const tone = netSaving > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : netSaving < 0 ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <div className={`rounded-2xl border px-4 py-3 text-[13px] font-semibold ${tone}`}>
      {netSaving > 0 ? `A saving of ${money(netSaving)}` : netSaving < 0 ? `It costs ${money(-netSaving)} more` : "No saving"}
      <span className="font-normal">
        {" "}— {interestSaved >= 0 ? `${money(interestSaved)} less interest` : `${money(-interestSaved)} more interest`}
        {costs > 0 && `, ${money(costs)} of costs`}.
      </span>
    </div>
  );
}
