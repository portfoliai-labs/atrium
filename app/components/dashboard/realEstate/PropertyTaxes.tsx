// components/dashboard/realEstate/PropertyTaxes.tsx
"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Percent as PercentIcon, Repeat, Trash2 } from "lucide-react";
import { useRealEstate } from "../../../context/RealEstateContext";
import { realEstateService } from "../../../services/realEstateService";
import { formatCurrency } from "../../../lib/format";
import {
  NOT_COMPUTED_TEXT, PROPERTY_USES, PROPERTY_USE_LABELS, REDUCTION_LABELS, TAX_REGIME_LABELS, fieldErrorText, fieldLabel, rateClassLabel,
  rateSourceText,
} from "../../../lib/realEstate";
import { dayLabel, today } from "../../../lib/wallets";
import type { Property, PropertyTax, PropertyUse, RentalContract, TaxList } from "../../../models/RealEstate";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { ConfirmDialog } from "../ConfirmDialog";
import { DialogShell, Field, INPUT, parseAmount } from "../wallets/WalletDialogs";
import { Percent } from "./NewPropertyFields";
import type { TaxPaymentPrefill } from "./RealEstateTransactionForm";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthsText = (first: number, last: number) => (first === 1 && last === 12 ? "All year" : first === last ? MONTHS[first - 1] : `${MONTHS[first - 1]}–${MONTHS[last - 1]}`);
const BUTTON = "px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:border-slate-300";

/**
 * PROPERTY TAXES — a property's taxes for a year (this one by default; any since its purchase, from
 * 2020), side by side: its IMU (ImuCard) and, when it had rents or short stays, the tax on them
 * (RentalTaxCard: Italy's cedolare secca or IRPEF). Only for a country that has them (Italy).
 */
export function PropertyTaxModule({ property, readOnly, onEdit, onEditTaxpayer, onRecordPayment }: {
  property: Property;
  readOnly: boolean;
  // To fill in what a tax lacks: the property's land registry, the taxpayer's year (for a year).
  onEdit: () => void;
  onEditTaxpayer: (year: number) => void;
  onRecordPayment: (prefill: TaxPaymentPrefill) => void;
}) {
  const { source, version } = useRealEstate();
  const thisYear = Number(today().slice(0, 4));
  const firstYear = Math.max(2020, Number((property.purchasedOn ?? property.createdAt).slice(0, 4)));
  const lastYear = property.soldOn ? Number(property.soldOn.slice(0, 4)) : thisYear;
  const years = Array.from({ length: Math.max(0, lastYear - firstYear + 1) }, (_, i) => lastYear - i);
  const [year, setYear] = useState(Math.min(thisYear, lastYear));
  const key = `${property.uuid}:${year}:${version}`;
  const [state, setState] = useState<{ key: string; list: TaxList | null } | null>(null);
  const [leases, setLeases] = useState<{ key: string; list: RentalContract[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    source.taxes(property.uuid, year)
      .then((list) => { if (!cancelled) setState({ key, list }); })
      .catch(() => { if (!cancelled) setState({ key, list: null }); });
    source.rentalContracts(property.uuid)
      .then((list) => { if (!cancelled) setLeases({ key, list }); })
      .catch(() => { if (!cancelled) setLeases({ key, list: [] }); });
    return () => { cancelled = true; };
  }, [source, property.uuid, year, key]);

  if (property.address.country !== "IT") return null;
  const list = state?.key === key ? state.list : undefined;
  const imu = list?.taxes.find((t) => t.kind === "property_tax");
  const rents = list?.taxes.find((t) => t.kind === "rental_income_tax");
  const yearPicker = years.length > 1 && (
    <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year" className="h-8 px-2.5 rounded-lg border border-[#E0DACC] bg-white text-xs font-bold text-[#1c1917] outline-none">
      {years.map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  );
  const common = { property, year, readOnly, onRecordPayment };

  return (
    <div className={`grid grid-cols-1 ${rents ? "xl:grid-cols-2" : ""} gap-6`}>
      <ImuCard {...common} list={list} tax={imu} right={yearPicker || undefined} onEdit={onEdit} />
      {rents && (
        <RentalTaxCard
          {...common}
          tax={rents}
          leases={leases?.key === key ? leases.list : []}
          right={!imu ? yearPicker || undefined : undefined}
          onEditTaxpayer={() => onEditTaxpayer(year)}
        />
      )}
    </div>
  );
}

type CardProps = {
  property: Property;
  year: number;
  readOnly: boolean;
  onRecordPayment: (prefill: TaxPaymentPrefill) => void;
  right?: React.ReactNode;
};

/**
 * IMU — what it comes to at the user's share, its two instalments with their due days (paid, due
 * or overdue, as the year's property tax transactions cover them) and the way to record one, how
 * it's worked out month by month (use, rate class, base, rate and where the rate comes from), an
 * estimate while the year's rates can still change; the user's own rate for the year (a canone
 * concordato's, say), set or removed. Not computed: why, and for missing land registry details the
 * way to fill them in.
 */
function ImuCard({ property, year, readOnly, onRecordPayment, right, list, tax, onEdit }: CardProps & {
  list: TaxList | null | undefined;
  tax: PropertyTax | undefined;
  onEdit: () => void;
}) {
  const { changed } = useRealEstate();
  const [rateDialog, setRateDialog] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const money = (v: number) => formatCurrency(v, tax?.currency ?? property.currency, 0);
  const ownRate = tax?.periods.some((p) => p.rateSource === "user") ?? false;

  const removeRate = async () => {
    setBusy(true);
    setError(null);
    try {
      await realEstateService.removeTaxRate(property.uuid, year);
      setRemoving(false);
      changed();
    } catch (err) {
      setError(fieldErrorText(err, "Unable to remove your rate."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Module>
      <ModuleHead title={`${tax?.name ?? "IMU"} ${year}`} desc="The property tax at your share, worked out from the land registry and the municipality's rates." right={right} />
      <div className={`${MODULE_BODY} space-y-4`}>
        {list === undefined ? (
          <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
        ) : list === null ? (
          <p className="text-[12.5px] text-rose-600">Unable to work out the tax right now.</p>
        ) : !tax ? (
          <p className="text-[12.5px] text-[#a8a29e]">Nothing owed for {year}: it wasn&apos;t yours that year.</p>
        ) : tax.status === "not_computed" ? (
          <NotComputed tax={tax} money={money} readOnly={readOnly} action={{ label: "Complete the land registry", onClick: onEdit }} />
        ) : (
          <>
            <Headline tax={tax} money={money} estimateTitle="The year's municipal rates can still change (until 28 October)." />
            <Instalments tax={tax} money={money} readOnly={readOnly} names={["First instalment (acconto)", "Balance (saldo)"]} kind="property_tax" onRecordPayment={onRecordPayment} />
            <div className="space-y-2">
              {tax.periods.map((p) => (
                <div key={p.firstMonth} className="rounded-xl bg-[#F7F5EF] px-4 py-2.5 text-[12px] text-slate-600 space-y-0.5">
                  <p className="flex flex-wrap justify-between gap-2">
                    <span className="font-bold text-slate-800">{monthsText(p.firstMonth, p.lastMonth)} · {PROPERTY_USE_LABELS[p.use]}</span>
                    <span className="font-bold tabular-nums text-slate-900">{money(p.amount)}</span>
                  </p>
                  <p>{rateClassLabel(p.rateClass)}</p>
                  {p.rateSource !== "exempt" && (
                    <p>
                      {money(p.taxableBase)} base (the whole property&apos;s) × {p.ratePct.toFixed(2)}% · {rateSourceText(p.rateSource, year, p.rateYear)}
                      {p.deduction > 0 && ` · ${money(p.deduction)} deduction`}
                    </p>
                  )}
                  {p.reductions.length > 0 && (
                    <p className="text-emerald-700">
                      {p.reductions.map((r) => (r === "agreed_rent" ? "Agreed rent: IMU at 75%" : REDUCTION_LABELS[r])).join(" · ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {!readOnly && tax.status === "computed" && (
              <div className="flex flex-wrap items-center gap-2">
                {ownRate ? (
                  <button type="button" onClick={() => { setError(null); setRemoving(true); }} className={BUTTON}>
                    Back to the municipality&apos;s rate
                  </button>
                ) : (
                  <button type="button" onClick={() => setRateDialog(true)} className={`inline-flex items-center gap-1.5 ${BUTTON}`}>
                    <PercentIcon className="h-3 w-3" /> Use your own rate
                  </button>
                )}
                <span className="text-[11px] text-slate-400">E.g. a lower rate your municipality grants that isn&apos;t applied by itself.</span>
              </div>
            )}
          </>
        )}
      </div>
      {rateDialog && <TaxRateDialog property={property} year={year} onClose={() => setRateDialog(false)} onSaved={() => { setRateDialog(false); changed(); }} />}
      {removing && (
        <ConfirmDialog
          title={`Remove your ${year} rate?`}
          description="The tax is worked out again at the municipality's rate (or the law's)."
          confirmLabel="Remove"
          confirming={busy}
          error={error}
          onConfirm={removeRate}
          onClose={() => setRemoving(false)}
        />
      )}
    </Module>
  );
}

/**
 * THE RENTS' TAX — the cedolare secca or IRPEF on a year's rents and short stays, at the user's
 * share: what it comes to, what the platforms withheld (paid already), the payments on account and
 * the balance (with the next year's return) with the way to record one, then each lease's and the
 * short stays' share of it, with what the other regime would have cost. An estimate until the year
 * ends. Not computed: why; IRPEF without the taxpayer's other income asks for their tax details.
 */
function RentalTaxCard({ property, year, readOnly, onRecordPayment, right, tax, leases, onEditTaxpayer }: CardProps & {
  tax: PropertyTax;
  leases: RentalContract[];
  onEditTaxpayer: () => void;
}) {
  const money = (v: number) => formatCurrency(v, tax.currency ?? property.currency, 0);
  const leaseOf = (uuid: string | null) => leases.find((l) => l.uuid === uuid);
  const onAccount = tax.instalments.length - 1;
  const names = tax.instalments.map((_, i) => (i === onAccount ? `Balance, with the ${year + 1} return` : onAccount > 1 ? `Payment on account ${i + 1} of ${onAccount}` : "Payment on account"));

  return (
    <Module>
      <ModuleHead title={`${tax.name} ${year}`} desc="The income tax on the rents and short stays, at your share." right={right} />
      <div className={`${MODULE_BODY} space-y-4`}>
        {tax.status === "not_computed" ? (
          <NotComputed
            tax={tax}
            money={money}
            readOnly={readOnly}
            action={tax.missingFields.includes("taxpayer.otherIncome") ? { label: `Add your ${year} tax details`, onClick: onEditTaxpayer } : undefined}
            note={tax.missingFields.includes("taxpayer.otherIncome") ? "IRPEF needs your other income that year (from the CU or the 730), to work out the rate on the rents." : undefined}
          />
        ) : (
          <>
            <Headline tax={tax} money={money} estimateTitle="The year isn't over: the rents and income can still change." />
            {tax.withheldAmount > 0 && (
              <p className="text-[12px] text-slate-600">{money(tax.withheldAmount)} withheld by the platforms on the short stays: already paid.</p>
            )}
            <Instalments tax={tax} money={money} readOnly={readOnly} names={names} kind="income_tax" onRecordPayment={onRecordPayment} />
            <div className="space-y-2">
              {tax.periods.map((p) => {
                const lease = leaseOf(p.rentalContractUuid);
                const saving = p.alternativeAmount === null ? null : p.alternativeAmount - p.amount;
                const other = p.regime === "flat_rate" ? "IRPEF" : "the cedolare";
                return (
                  <div key={`${p.rentalContractUuid ?? "short"}:${p.firstMonth}`} className="rounded-xl bg-[#F7F5EF] px-4 py-2.5 text-[12px] text-slate-600 space-y-0.5">
                    <p className="flex flex-wrap justify-between gap-2">
                      <span className="font-bold text-slate-800">
                        {p.rentalContractUuid ? `Lease${lease?.tenant ? ` · ${lease.tenant}` : ""}` : "Short stays"} · {monthsText(p.firstMonth, p.lastMonth)}
                      </span>
                      <span className="font-bold tabular-nums text-slate-900">{money(p.amount)}</span>
                    </p>
                    <p>{rateClassLabel(p.rateClass)}{p.regime === "ordinary" ? `: ${p.ratePct.toFixed(1)}% with the surcharges` : ""}</p>
                    <p>
                      {money(p.income)} {p.rentalContractUuid ? "of rent" : "paid by the guests"} at your share
                      {p.taxableBase !== p.income && ` · ${money(p.taxableBase)} taxed`}
                    </p>
                    {p.reductions.includes("agreed_rent") && <p className="text-emerald-700">Agreed rent where housing is tight</p>}
                    {saving !== null && (
                      <p className={saving >= 0 ? "text-emerald-700 font-semibold" : "text-amber-700 font-semibold"}>
                        With {other} it would be {money(p.alternativeAmount!)}
                        {saving > 0 ? `: ${p.regime ? TAX_REGIME_LABELS[p.regime] : "this regime"} saves you ${money(saving)}` : saving < 0 ? `: ${money(-saving)} less, worth considering` : ": the same"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {!readOnly && (
              <button type="button" onClick={onEditTaxpayer} className={BUTTON}>Your {year} tax details</button>
            )}
          </>
        )}
      </div>
    </Module>
  );
}

/** A tax's amount, the estimate badge and what was paid against it. */
function Headline({ tax, money, estimateTitle }: { tax: PropertyTax; money: (v: number) => string; estimateTitle: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <span className="text-[26px] font-bold text-[#1c1917] tabular-nums">{tax.status === "exempt" ? "Exempt" : money(tax.amount)}</span>
      {tax.provisional && tax.status === "computed" && (
        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-[10px] font-black uppercase tracking-wider text-amber-700" title={estimateTitle}>
          Estimate
        </span>
      )}
      <PaidLine tax={tax} money={money} />
    </div>
  );
}

/** Why a tax isn't worked out, and the way to what it lacks. */
function NotComputed({ tax, money, readOnly, action, note }: {
  tax: PropertyTax;
  money: (v: number) => string;
  readOnly: boolean;
  action?: { label: string; onClick: () => void };
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
      <p className="text-[13px] font-semibold text-amber-800">{tax.notComputed ? NOT_COMPUTED_TEXT[tax.notComputed] : "Not computed."}</p>
      {tax.missingFields.length > 0 && <p className="text-[12px] text-amber-700">Missing: {tax.missingFields.map(fieldLabel).join(", ")}.</p>}
      {note && <p className="text-[12px] text-amber-700">{note}</p>}
      {action && !readOnly && (
        <button type="button" onClick={action.onClick} className="px-3.5 py-2 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] transition-colors">
          {action.label}
        </button>
      )}
      {(tax.paidAmount > 0 || tax.withheldAmount > 0) && (
        <p className="text-[12px] text-amber-700">{money(tax.paidAmount + tax.withheldAmount)} recorded as paid for {tax.year}.</p>
      )}
    </div>
  );
}

/**
 * A tax's instalments: due day, amount, paid or due (overdue past its day) and, for one due, the way
 * to record it — the form filled in with the tax, its year, what's still due on it and its day.
 */
function Instalments({ tax, money, readOnly, names, kind, onRecordPayment }: {
  tax: PropertyTax;
  money: (v: number) => string;
  readOnly: boolean;
  names: string[];
  kind: TaxPaymentPrefill["kind"];
  onRecordPayment: (prefill: TaxPaymentPrefill) => void;
}) {
  if (tax.instalments.length === 0) return null;
  return (
    <ul className="divide-y divide-[#EEE9DD] rounded-2xl border border-[#EEE9DD]">
      {tax.instalments.map((i, index) => {
        const before = tax.instalments.slice(0, index).reduce((s, x) => s + x.amount, 0);
        const left = Math.max(0, Math.min(i.amount, before + i.amount - tax.paidAmount));
        const overdue = !i.paid && i.dueOn < today();
        const nothing = i.amount === 0;
        return (
          <li key={i.number} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-slate-800">{names[index] ?? `Instalment ${i.number}`}</span>
              <span className={`block text-[11.5px] ${overdue && !nothing ? "text-rose-600 font-semibold" : "text-slate-500"}`}>
                {nothing ? `By ${dayLabel(i.dueOn)}: nothing to pay` : i.paid ? `Due ${dayLabel(i.dueOn)}` : overdue ? `Overdue since ${dayLabel(i.dueOn)}` : `Due by ${dayLabel(i.dueOn)}`}
                {!nothing && !i.paid && left < i.amount && ` · ${money(left)} left`}
              </span>
            </span>
            <span className="font-bold tabular-nums text-slate-900">{money(i.amount)}</span>
            {nothing ? null : i.paid ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Paid</span>
            ) : !readOnly ? (
              <button
                type="button"
                onClick={() => onRecordPayment({ kind, year: tax.year, amount: left, dueOn: i.dueOn, description: `${tax.name} ${tax.year} — ${names[index] ?? `instalment ${i.number}`}` })}
                className={BUTTON}
              >
                Record payment
              </button>
            ) : (
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Due</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** What was recorded as paid against what's owed: still due, all paid, or a credit. */
function PaidLine({ tax, money }: { tax: PropertyTax; money: (v: number) => string }) {
  // The platforms' withholding counts as paid.
  const paid = tax.paidAmount + tax.withheldAmount;
  if (tax.status === "exempt") {
    return paid > 0 ? <span className="text-[12.5px] font-semibold text-sky-700">{money(paid)} paid: a credit</span> : null;
  }
  const left = tax.amount - paid;
  if (paid === 0) return <span className="text-[12.5px] text-[#78716c]">Nothing recorded as paid yet</span>;
  if (left > 0.5) return <span className="text-[12.5px] text-[#78716c]">{money(paid)} paid · <b className="text-[#1c1917]">{money(left)} left</b></span>;
  if (left < -0.5) return <span className="text-[12.5px] font-semibold text-sky-700">{money(paid)} paid: {money(-left)} more than owed, a credit</span>;
  return <span className="text-[12.5px] font-semibold text-emerald-700">All paid</span>;
}

/** The user's own rate for a year, in place of the one found. */
function TaxRateDialog({ property, year, onClose, onSaved }: { property: Property; year: number; onClose: () => void; onSaved: () => void }) {
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = parseAmount(rate);
  const valid = value !== null && Number(value) >= 0 && Number(value) <= 100;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await realEstateService.setTaxRate(property.uuid, year, value!);
      onSaved();
    } catch (err) {
      setError(fieldErrorText(err, "Unable to set this rate."));
      setBusy(false);
    }
  };
  return (
    <DialogShell
      icon={<PercentIcon className="h-5 w-5" />}
      title={`Your IMU rate for ${year}`}
      subtitle="Applied to every taxed month of the year, in place of the municipality's."
      busy={busy}
      error={error}
      submitLabel="Use this rate"
      canSubmit={valid}
      onSubmit={submit}
      onClose={onClose}
    >
      <Field label="Rate" hint="As the municipality's resolution writes it, e.g. 0.76 for a canone concordato lease.">
        <Percent value={rate} onChange={setRate} placeholder="0.76" />
      </Field>
    </DialogShell>
  );
}

/**
 * USES — what the property has been used for over time: the use since the start, then each change
 * with its day. A use that changed on a day is added here ("Use changed"); a change can be removed.
 * Correcting today's use is the property's settings.
 */
export function PropertyUsesModule({ property, readOnly, onChanged }: { property: Property; readOnly: boolean; onChanged: () => void }) {
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async (day: string) => {
    setBusy(true);
    setError(null);
    try {
      await realEstateService.removeUseChange(property.uuid, day);
      onChanged();
    } catch (err) {
      setError(fieldErrorText(err, "Unable to remove this change."));
    } finally {
      setBusy(false);
    }
  };
  const periods = [...property.uses].reverse();
  return (
    <Module>
      <ModuleHead
        title="Use"
        desc="What it's been used for, from which day: it decides the taxes of each month."
        right={!readOnly ? (
          <button type="button" onClick={() => setDialog(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E0DACC] text-[11px] font-bold text-[#1c1917] hover:border-[#C49A3C]">
            <Repeat className="h-3 w-3" /> Use changed
          </button>
        ) : undefined}
      />
      <div className={MODULE_BODY}>
        <ul className="divide-y divide-[#EEE9DD]">
          {periods.map((u, i) => (
            <li key={u.effectiveOn ?? "start"} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-slate-800">
                  {PROPERTY_USE_LABELS[u.use]}
                  {i === 0 && <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-[#C49A3C]">Now</span>}
                </span>
                <span className="block text-[11.5px] text-slate-500">{u.effectiveOn ? `From ${dayLabel(u.effectiveOn)}` : "From the start"}</span>
              </span>
              {u.effectiveOn && !readOnly && (
                <button type="button" disabled={busy} onClick={() => remove(u.effectiveOn!)} aria-label="Remove this change" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {error && <p className="text-xs font-semibold text-rose-600 mt-2">{error}</p>}
      </div>
      {dialog && <UseChangeDialog property={property} onClose={() => setDialog(false)} onSaved={() => { setDialog(false); onChanged(); }} />}
    </Module>
  );
}

function UseChangeDialog({ property, onClose, onSaved }: { property: Property; onClose: () => void; onSaved: () => void }) {
  const [effectiveOn, setEffectiveOn] = useState(today());
  const [use, setUse] = useState<PropertyUse>(PROPERTY_USES.find((u) => u !== property.use) ?? property.use);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await realEstateService.changeUse(property.uuid, effectiveOn, use);
      onSaved();
    } catch (err) {
      setError(fieldErrorText(err, "Unable to change the use."));
      setBusy(false);
    }
  };
  return (
    <DialogShell
      icon={<Repeat className="h-5 w-5" />}
      title="Use changed"
      subtitle={`Now ${PROPERTY_USE_LABELS[property.use].toLowerCase()}. A change on a day that already has one replaces it.`}
      busy={busy}
      error={error}
      submitLabel="Save"
      canSubmit={!!effectiveOn}
      onSubmit={submit}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="From">
          <input type="date" value={effectiveOn} onChange={(e) => setEffectiveOn(e.target.value)} className={INPUT} />
        </Field>
        <Field label="New use">
          <select value={use} onChange={(e) => setUse(e.target.value as PropertyUse)} className={INPUT}>
            {PROPERTY_USES.map((u) => <option key={u} value={u}>{PROPERTY_USE_LABELS[u]}</option>)}
          </select>
        </Field>
      </div>
    </DialogShell>
  );
}
