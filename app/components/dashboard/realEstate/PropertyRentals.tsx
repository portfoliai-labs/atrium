// components/dashboard/realEstate/PropertyRentals.tsx
"use client";

import { useState } from "react";
import { FileSignature, Pencil, Receipt, Trash2 } from "lucide-react";
import { useRealEstate, useRealEstateQuery, useRealEstateRead } from "../../../context/RealEstateContext";
import { realEstateService } from "../../../services/realEstateService";
import { formatCurrency } from "../../../lib/format";
import {
  AGREED_KINDS, RENTAL_CONTRACT_KINDS, RENTAL_CONTRACT_KIND_LABELS, TAX_REGIME_LABELS, fieldErrorText,
} from "../../../lib/realEstate";
import { dayLabel, today } from "../../../lib/wallets";
import type {
  Property, RentalContract, RentalContractKind, RentalContractUpdateRequest, TaxRegime, TaxpayerYear,
} from "../../../models/RealEstate";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { ConfirmDialog } from "../ConfirmDialog";
import { DialogShell, Field, INPUT, parseAmount } from "../wallets/WalletDialogs";
import { Percent } from "./NewPropertyFields";

/** Whether a lease's kind and regime can be the cedolare: a person's home in Italy, never commercial. */
const flatRateAllowed = (property: Property, kind: RentalContractKind) =>
  property.address.country === "IT" && kind !== "commercial" && property.holder.kind === "person";

/**
 * LEASES — a property's long-term contracts, by start: their kind, dates, monthly rent (the whole
 * property's), tax regime and tenant; each one changed or deleted, a new one added. Their rents are
 * taxed as they fall due, paid or not (the rents' tax, PropertyTaxModule); one at an agreed rent
 * lowers IMU to 75%. Nothing without a lease: the first is added from the page's actions.
 */
export function LeasesModule({ property, readOnly, onChanged }: { property: Property; readOnly: boolean; onChanged: () => void }) {
  const list = useRealEstateRead<RentalContract[]>(["rentalContracts", property.uuid], (source) => source.rentalContracts(property.uuid));
  const [editing, setEditing] = useState<RentalContract | "new" | null>(null);
  const [deleting, setDeleting] = useState<RentalContract | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = today();
  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await realEstateService.removeRentalContract(deleting.uuid);
      setDeleting(null);
      onChanged();
    } catch (err) {
      setError(fieldErrorText(err, "Unable to delete this lease."));
    } finally {
      setBusy(false);
    }
  };

  if (list === undefined || list?.length === 0) return null;
  return (
    <Module>
      <ModuleHead
        title="Leases"
        desc="Its long-term rental contracts: their rent is taxed as it falls due, paid or not."
        right={!readOnly ? (
          <button type="button" onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E0DACC] text-[11px] font-bold text-[#1c1917] hover:border-[#C49A3C]">
            <FileSignature className="h-3 w-3" /> Add lease
          </button>
        ) : undefined}
      />
      <div className={MODULE_BODY}>
        {list === null ? (
          <p className="text-[12.5px] text-rose-600">Unable to load the leases.</p>
        ) : (
          <ul className="divide-y divide-[#EEE9DD]">
            {list.map((l) => {
              const running = l.startsOn <= now && (!l.endsOn || l.endsOn >= now);
              return (
                <li key={l.uuid} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-slate-800">
                      {RENTAL_CONTRACT_KIND_LABELS[l.kind]}{l.tenant ? ` · ${l.tenant}` : ""}
                      {running && <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-[#C49A3C]">Running</span>}
                    </span>
                    <span className="block text-[11.5px] text-slate-500">
                      {dayLabel(l.startsOn)} – {l.endsOn ? dayLabel(l.endsOn) : "open-ended"} · {TAX_REGIME_LABELS[l.taxRegime]}
                      {l.highTensionMunicipality && " · high housing tension"}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold tabular-nums text-slate-900">{formatCurrency(l.monthlyRent, l.currency, 0)}</span>
                    <span className="block text-[10.5px] text-slate-400">a month</span>
                  </span>
                  {!readOnly && (
                    <span className="flex gap-1">
                      <button type="button" onClick={() => setEditing(l)} aria-label="Edit lease" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => { setError(null); setDeleting(l); }} aria-label="Delete lease" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {editing && (
        <LeaseDialog
          property={property}
          lease={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this lease?"
          description="Its rent leaves the rents' tax, and an agreed rent's IMU reduction goes with it. The rents recorded stay. This can't be undone."
          confirming={busy}
          error={error}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </Module>
  );
}

/** A lease, new or to change: kind, dates, the whole property's monthly rent, regime, tenant. */
export function LeaseDialog({ property, lease, onClose, onSaved }: { property: Property; lease?: RentalContract; onClose: () => void; onSaved: () => void }) {
  const italy = property.address.country === "IT";
  const kinds = italy ? RENTAL_CONTRACT_KINDS : RENTAL_CONTRACT_KINDS.filter((k) => !AGREED_KINDS.includes(k));
  const [kind, setKind] = useState<RentalContractKind>(lease?.kind ?? "residential");
  const [startsOn, setStartsOn] = useState(lease?.startsOn ?? today());
  const [endsOn, setEndsOn] = useState(lease?.endsOn ?? "");
  const [rent, setRent] = useState(lease ? String(lease.monthlyRent) : "");
  const [regime, setRegime] = useState<TaxRegime>(lease?.taxRegime ?? (flatRateAllowed(property, "residential") ? "flat_rate" : "ordinary"));
  const [highTension, setHighTension] = useState(lease?.highTensionMunicipality ?? false);
  const [tenant, setTenant] = useState(lease?.tenant ?? "");
  const [note, setNote] = useState(lease?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canFlat = flatRateAllowed(property, kind);
  const agreed = AGREED_KINDS.includes(kind);
  const effectiveRegime = canFlat ? regime : "ordinary";
  const rentValue = parseAmount(rent);
  const valid = !!startsOn && (!endsOn || endsOn >= startsOn) && rentValue !== null && Number(rentValue) > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!lease) {
        await realEstateService.addRentalContract(property.uuid, {
          kind, startsOn, endsOn: endsOn || null, monthlyRent: rentValue!, taxRegime: effectiveRegime,
          highTensionMunicipality: agreed && highTension, tenant: tenant.trim() || null, note: note.trim() || null,
        });
      } else {
        // Only what changed; "" clears the end (it runs on again), the tenant and the note.
        const changes: RentalContractUpdateRequest = {
          ...(kind !== lease.kind ? { kind } : {}),
          ...(startsOn !== lease.startsOn ? { startsOn } : {}),
          ...(endsOn !== (lease.endsOn ?? "") ? { endsOn } : {}),
          ...(Number(rentValue) !== lease.monthlyRent ? { monthlyRent: rentValue! } : {}),
          ...(effectiveRegime !== lease.taxRegime ? { taxRegime: effectiveRegime } : {}),
          ...(agreed && highTension !== lease.highTensionMunicipality ? { highTensionMunicipality: highTension } : {}),
          ...(tenant.trim() !== (lease.tenant ?? "") ? { tenant: tenant.trim() } : {}),
          ...(note.trim() !== (lease.note ?? "") ? { note: note.trim() } : {}),
        };
        if (Object.keys(changes).length > 0) await realEstateService.updateRentalContract(lease.uuid, changes);
      }
      onSaved();
    } catch (err) {
      setError(fieldErrorText(err, "Unable to save this lease."));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      icon={<FileSignature className="h-5 w-5" />}
      title={lease ? "Edit lease" : "New lease"}
      subtitle={`${property.name}: a long-term rental contract. Its rent is taxed as it falls due.`}
      busy={busy}
      error={error}
      submitLabel={lease ? "Save" : "Add lease"}
      canSubmit={valid}
      onSubmit={submit}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Kind">
          <select value={kind} onChange={(e) => setKind(e.target.value as RentalContractKind)} className={INPUT}>
            {kinds.map((k) => <option key={k} value={k}>{RENTAL_CONTRACT_KIND_LABELS[k]}</option>)}
          </select>
        </Field>
        <Field label={`Monthly rent (${property.currency})`} hint={property.ownershipSharePct < 100 ? `The whole property's: the taxes take your ${property.ownershipSharePct}%.` : "The whole property's."}>
          <input autoFocus value={rent} onChange={(e) => setRent(e.target.value)} inputMode="decimal" placeholder="1200" className={INPUT} />
        </Field>
        <Field label="Start">
          <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={INPUT} />
        </Field>
        <Field label="End" hint="Empty while it runs on.">
          <input type="date" value={endsOn} min={startsOn || undefined} onChange={(e) => setEndsOn(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Tax regime" hint={canFlat ? "The cedolare secca replaces IRPEF on this rent." : "The cedolare secca is only for a person's home in Italy, never a commercial lease."}>
          <select value={effectiveRegime} onChange={(e) => setRegime(e.target.value as TaxRegime)} disabled={!canFlat} className={INPUT}>
            <option value="flat_rate">Cedolare secca</option>
            <option value="ordinary">IRPEF</option>
          </select>
        </Field>
        <Field label="Tenant">
          <input value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="Optional" className={INPUT} />
        </Field>
        {agreed && (
          <label className="sm:col-span-2 flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={highTension} onChange={(e) => setHighTension(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#C49A3C]" />
            <span>
              <span className="block text-[13px] font-semibold text-slate-700">The municipality is one of high housing tension</span>
              <span className="block text-[11px] text-slate-400">&quot;Ad alta tensione abitativa&quot;: the cedolare at 10% (or IRPEF on 70% of the rent).</span>
            </span>
          </label>
        )}
        <Field label="Note" className="sm:col-span-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className={INPUT} />
        </Field>
      </div>
    </DialogShell>
  );
}

/**
 * YOUR TAX DETAILS — what the rents' tax needs of the user for a year: their other income at the
 * ordinary rates (from the CU or the 730: IRPEF on rents can't be worked out without it), the
 * regional and municipal surcharges, which property's short stays take the 21%, and how short stays
 * are taxed. Saved whole (PUT), or removed.
 */
export function TaxpayerYearDialog({ year, onClose, onSaved }: { year: number; onClose: () => void; onSaved: () => void }) {
  const { properties } = useRealEstate();
  const read = useRealEstateQuery(["taxpayerYears", year], (source) => source.taxpayerYears(year));
  const [record, setRecord] = useState<TaxpayerYear | null | undefined>(undefined);
  const [otherIncome, setOtherIncome] = useState("");
  const [surcharges, setSurcharges] = useState("");
  const [reducedRate, setReducedRate] = useState("");
  const [shortStayRegime, setShortStayRegime] = useState<TaxRegime>("flat_rate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shortStays = properties.filter((p) => !p.archived && p.uses.some((u) => u.use === "short_term_rental"));

  // The form filled once, from an answer read now (not one being read again after a save).
  if (record === undefined && !read.isFetching && (read.isSuccess || read.isError)) {
    const own = read.isError ? null : read.data.find((t) => t.holderName === null) ?? null;
    setRecord(own);
    if (own) {
      setOtherIncome(own.otherIncome != null ? String(own.otherIncome) : "");
      setSurcharges(own.surchargesPct != null ? String(own.surchargesPct) : "");
      setReducedRate(own.reducedRatePropertyUuid ?? "");
      setShortStayRegime(own.shortStayRegime ?? "flat_rate");
    }
  }

  const income = parseAmount(otherIncome);
  const surchargesValue = parseAmount(surcharges);
  const valid = (otherIncome.trim() === "" || (income !== null && Number(income) >= 0))
    && (surcharges.trim() === "" || (surchargesValue !== null && Number(surchargesValue) >= 0 && Number(surchargesValue) <= 10));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await realEstateService.putTaxpayerYear({
        year,
        holderName: null,
        otherIncome: otherIncome.trim() ? income : null,
        surchargesPct: surcharges.trim() ? surchargesValue : null,
        reducedRatePropertyUuid: reducedRate || null,
        shortStayRegime,
      });
      onSaved();
    } catch (err) {
      setError(fieldErrorText(err, "Unable to save your tax details."));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      icon={<Receipt className="h-5 w-5" />}
      title={`Your ${year} tax details`}
      subtitle="What the tax on your rents needs to be worked out. Nothing here leaves the app."
      busy={busy || record === undefined}
      error={error}
      submitLabel="Save"
      canSubmit={valid && record !== undefined}
      onSubmit={submit}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Your other income (€)" hint="At the ordinary rates, other than these rents: from the CU or the 730. Not what you own.">
          <input autoFocus value={otherIncome} onChange={(e) => setOtherIncome(e.target.value)} inputMode="decimal" placeholder="42000" className={INPUT} />
        </Field>
        <Field label="Regional and municipal surcharges" hint="The addizionali together, e.g. 2.53.">
          <Percent value={surcharges} onChange={setSurcharges} placeholder="2.53" />
        </Field>
        {shortStays.length > 0 && (
          <>
            <Field label="Short stays taxed" hint="The cedolare at 21% (26% from a further apartment), or IRPEF.">
              <select value={shortStayRegime} onChange={(e) => setShortStayRegime(e.target.value as TaxRegime)} className={INPUT}>
                <option value="flat_rate">Cedolare secca</option>
                <option value="ordinary">IRPEF</option>
              </select>
            </Field>
            {shortStays.length > 1 && (
              <Field label="The apartment at 21%" hint="Only one takes the lower rate.">
                <select value={reducedRate} onChange={(e) => setReducedRate(e.target.value)} className={INPUT}>
                  <option value="">The one that earns the most</option>
                  {shortStays.map((p) => <option key={p.uuid} value={p.uuid}>{p.name}</option>)}
                </select>
              </Field>
            )}
          </>
        )}
      </div>
    </DialogShell>
  );
}
