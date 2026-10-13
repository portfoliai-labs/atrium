// components/dashboard/realEstate/PropertyDialogs.tsx
"use client";

import { useState } from "react";
import { Landmark, Pencil, Percent as PercentIcon, Scale } from "lucide-react";
import { realEstateService } from "../../../services/realEstateService";
import { today } from "../../../lib/wallets";
import { fieldErrorText } from "../../../lib/realEstate";
import type { Mortgage, Property } from "../../../models/RealEstate";
import { DialogShell, Field, INPUT, parseAmount } from "../wallets/WalletDialogs";
import { Percent, monthAfter, useMortgageFields, usePropertyFields } from "./NewPropertyFields";

/** Saves through `action`, then `onSaved`; on failure, the API's reason in the dialog. */
function useSave(onSaved: () => void, fallback: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onSaved();
    } catch (err) {
      setError(fieldErrorText(err, fallback));
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** A property's own fields, to change (its purchase, mortgages and valuations are on its page). */
export function PropertyEditDialog({ property, onClose, onSaved }: { property: Property; onClose: () => void; onSaved: () => void }) {
  const form = usePropertyFields(property);
  const { busy, error, run } = useSave(onSaved, "Unable to save this property.");
  // Bought through a purchase transaction: that's its acquisition, not to change here.
  const bought = property.acquisition.kind === "purchase" && !!property.purchasedOn;
  const changes = { ...form.changes(), ...(bought ? {} : form.acquisitionChanges()) };
  const problems = [...form.problems, ...(bought ? [] : form.acquisitionProblems)];
  return (
    <DialogShell
      icon={<Pencil className="h-5 w-5" />}
      title={`Edit ${property.name}`}
      busy={busy}
      error={error ?? (problems.length > 0 ? `Still needed: ${problems.join(", ")}.` : null)}
      submitLabel="Save"
      canSubmit={problems.length === 0}
      onSubmit={() => run(() => (Object.keys(changes).length > 0 ? realEstateService.update(property.uuid, changes) : Promise.resolve()))}
      onClose={onClose}
      wide
    >
      {form.fields}
      {!bought && (
        <fieldset className="space-y-3">
          <legend className="text-[11px] font-black uppercase tracking-widest text-slate-700 mb-3">Acquisition</legend>
          {form.acquisitionFields}
        </fieldset>
      )}
    </DialogShell>
  );
}

/** What the whole property is worth on a day: the user's estimate or an appraisal. */
export function ValuationDialog({ property, onClose, onSaved }: { property: Property; onClose: () => void; onSaved: () => void }) {
  const [valuedOn, setValuedOn] = useState(today());
  const [value, setValue] = useState("");
  const [source, setSource] = useState<"user_estimate" | "appraisal">("user_estimate");
  const [note, setNote] = useState("");
  const { busy, error, run } = useSave(onSaved, "Unable to add this valuation.");
  const amount = parseAmount(value);
  const partial = property.ownershipSharePct < 100;
  return (
    <DialogShell
      icon={<Scale className="h-5 w-5" />}
      title="New valuation"
      subtitle={`What ${property.name} is worth: its value from that day on.`}
      busy={busy}
      error={error}
      submitLabel="Add valuation"
      canSubmit={!!valuedOn && amount !== null && Number(amount) > 0}
      onSubmit={() => run(() => realEstateService.addValuation(property.uuid, { valuedOn, value: amount!, source, note: note.trim() || null }))}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Day">
          <input type="date" value={valuedOn} max={today()} onChange={(e) => setValuedOn(e.target.value)} className={INPUT} />
        </Field>
        <Field label={`Value (${property.currency})`} hint={partial ? `The whole property's, not your ${property.ownershipSharePct}%.` : "The whole property's."}>
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={String(Math.round(property.figures.value))} className={INPUT} />
        </Field>
        <Field label="Source" className="sm:col-span-2">
          <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className={INPUT}>
            <option value="user_estimate">Your estimate</option>
            <option value="appraisal">An appraisal</option>
          </select>
        </Field>
        <Field label="Note" className="sm:col-span-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional: who appraised it, what it's based on" className={INPUT} />
        </Field>
      </div>
    </DialogShell>
  );
}

/** A mortgage taken on a property already tracked (a refinance, or one left out at the purchase). */
export function MortgageDialog({ property, onClose, onSaved }: { property: Property; onClose: () => void; onSaved: () => void }) {
  const form = useMortgageFields(property.currency, property.purchasedOn ? monthAfter(property.purchasedOn) : monthAfter(today()));
  const { busy, error, run } = useSave(onSaved, "Unable to add this mortgage.");
  return (
    <DialogShell
      icon={<Landmark className="h-5 w-5" />}
      title="New mortgage"
      subtitle="Equal instalments (French amortisation); the schedule is worked out for you."
      busy={busy}
      error={error}
      submitLabel="Add mortgage"
      canSubmit={form.problems.length === 0}
      onSubmit={() => run(() => realEstateService.addMortgage(property.uuid, form.input()))}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{form.fields}</div>
    </DialogShell>
  );
}

/** A mortgage's new rate from a day on: a variable rate's reset, a renegotiation. */
export function RateChangeDialog({ mortgage, onClose, onSaved }: { mortgage: Mortgage; onClose: () => void; onSaved: () => void }) {
  const [effectiveOn, setEffectiveOn] = useState(today());
  const [rate, setRate] = useState("");
  const { busy, error, run } = useSave(onSaved, "Unable to change the rate.");
  const value = parseAmount(rate);
  return (
    <DialogShell
      icon={<PercentIcon className="h-5 w-5" />}
      title="Rate change"
      subtitle={`Now ${mortgage.currentRatePct.toFixed(2)}%. The instalments from that day on are worked out again; one already on that day is replaced.`}
      busy={busy}
      error={error}
      submitLabel="Change rate"
      canSubmit={!!effectiveOn && value !== null}
      onSubmit={() => run(() => realEstateService.changeRate(mortgage.uuid, effectiveOn, value!))}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="From">
          <input type="date" value={effectiveOn} onChange={(e) => setEffectiveOn(e.target.value)} className={INPUT} />
        </Field>
        <Field label="New rate">
          <Percent value={rate} onChange={setRate} placeholder={mortgage.currentRatePct.toFixed(2)} />
        </Field>
      </div>
    </DialogShell>
  );
}
