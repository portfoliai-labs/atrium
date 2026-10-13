// components/dashboard/realEstate/RealEstateTransactionForm.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Building2, Hammer, HandCoins, Home, KeyRound, Landmark, Loader2, Receipt, X, type LucideIcon } from "lucide-react";
import { useRealEstate } from "../../../context/RealEstateContext";
import { realEstateService } from "../../../services/realEstateService";
import { EXPENSE_KIND_LABELS, PREPAYMENT_EFFECT_LABELS, fieldErrorText } from "../../../lib/realEstate";
import { today } from "../../../lib/wallets";
import { formatCurrency } from "../../../lib/format";
import type { ExpenseKind, Mortgage, PrepaymentEffect, PropertyTransactionInput } from "../../../models/RealEstate";
import { DEMO_DISABLED_TITLE } from "../../preview/DemoBanner";
import { Field, INPUT, parseAmount } from "../wallets/WalletDialogs";
import { useNewProperty } from "./NewPropertyFields";

export type RealEstateEntryKind = "purchase" | "sale" | "rent" | "expense" | "works" | "mortgage";

/** A tax payment to record, filled in from its instalment (the property's tax cards). */
export interface TaxPaymentPrefill {
  // IMU, or the rents' tax.
  kind: "property_tax" | "income_tax";
  year: number;
  // What's still due on it, positive.
  amount: number;
  dueOn: string;
  description: string;
}

const KINDS: { value: RealEstateEntryKind; label: string; icon: LucideIcon }[] = [
  { value: "purchase", label: "Purchase", icon: Home },
  { value: "sale", label: "Sale", icon: KeyRound },
  { value: "rent", label: "Rent in", icon: HandCoins },
  { value: "expense", label: "Expense", icon: Receipt },
  { value: "works", label: "Works", icon: Hammer },
  { value: "mortgage", label: "Mortgage", icon: Landmark },
];

// An expense's type: the API's expense kinds, and the taxes (kinds of their own).
type ExpenseType = ExpenseKind | "property_tax" | "income_tax";
const TAX_TYPES: ExpenseType[] = ["property_tax", "income_tax"];
const EXPENSE_TYPES: { value: ExpenseType; label: string }[] = [
  { value: "property_tax", label: "Property tax (IMU)" },
  { value: "income_tax", label: "Tax on rents (cedolare / IRPEF)" },
  ...(Object.keys(EXPENSE_KIND_LABELS) as ExpenseKind[]).map((k) => ({ value: k, label: EXPENSE_KIND_LABELS[k] })),
];

/**
 * REAL ESTATE FORM — what money a property moved, in RealEstateTransactionDialog: a Purchase adds
 * a new property
 * (with its purchase and mortgage, see useNewProperty); the others are one of the properties'
 * (not archived, not sold) — a sale with its costs, rent or a short-stay payout, an expense or a
 * property tax, works, a mortgage's instalment or prepayment. Amounts are typed as positive and
 * signed here, as each kind wants them. A sale offers to settle each open mortgage of the property
 * (its payoff booked as a prepayment, the mortgage closed on the sale day): the API doesn't close
 * them by itself. A demo account can fill it in but not save it.
 */
export function RealEstateTransactionForm({ initialKind = "purchase", initialPropertyUuid, taxPayment, readOnly = false, onCancel, onSaved }: {
  initialKind?: RealEstateEntryKind;
  initialPropertyUuid?: string;
  // Opens on Expense, as that tax payment (taxYear set: it counts for that year's tax).
  taxPayment?: TaxPaymentPrefill;
  readOnly?: boolean;
  onCancel: () => void;
  // The property the transaction went to (the new one, for a purchase).
  onSaved: (propertyUuid: string) => void;
}) {
  const { properties, source, changed } = useRealEstate();
  const [kind, setKind] = useState<RealEstateEntryKind>(taxPayment ? "expense" : initialKind);
  const open = useMemo(() => properties.filter((p) => !p.archived && !p.soldOn), [properties]);
  const [propertyUuid, setPropertyUuid] = useState(initialPropertyUuid ?? open[0]?.uuid ?? "");
  const property = open.find((p) => p.uuid === propertyUuid) ?? open[0];
  const newProperty = useNewProperty(property?.currency ?? "EUR");

  // ── Shared by every kind but Purchase ──
  const [bookedOn, setBookedOn] = useState(taxPayment?.dueOn ?? today());
  const [amount, setAmount] = useState(taxPayment ? String(taxPayment.amount) : "");
  const [counterparty, setCounterparty] = useState("");
  const [description, setDescription] = useState(taxPayment?.description ?? "");
  const [note, setNote] = useState("");
  // Rent.
  const [payout, setPayout] = useState<boolean | null>(null);
  const [rentPeriod, setRentPeriod] = useState("");
  const [platformFee, setPlatformFee] = useState("");
  const [taxWithheld, setTaxWithheld] = useState("");
  // Expense.
  const [expenseType, setExpenseType] = useState<ExpenseType>(taxPayment?.kind ?? "condo_fees");
  const [refund, setRefund] = useState(false);
  const [taxYear, setTaxYear] = useState(taxPayment ? String(taxPayment.year) : "");
  // Works.
  const [incentive, setIncentive] = useState("");
  // Mortgage.
  const [mortgageUuid, setMortgageUuid] = useState("");
  const [prepayment, setPrepayment] = useState(false);
  const [interest, setInterest] = useState("");
  const [instalmentNumber, setInstalmentNumber] = useState("");
  const [effect, setEffect] = useState<PrepaymentEffect>("reduce_instalment");
  // Sale.
  const [agencyFee, setAgencyFee] = useState("");
  const [otherCosts, setOtherCosts] = useState("");
  const [settle, setSettle] = useState<Record<string, { on: boolean; amount: string }>>({});

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The property's mortgages still open: for an instalment, a prepayment, or a sale's payoff.
  const mortgages = usePropertyMortgages(kind !== "purchase" ? property?.uuid : undefined, source);
  const mortgage = mortgages?.find((m) => m.uuid === mortgageUuid) ?? mortgages?.[0];

  const currency = property?.currency ?? "EUR";
  const amountValue = parseAmount(amount);
  const isPayout = payout ?? property?.use === "short_term_rental";
  const positive = (text: string) => { const v = parseAmount(text); return v !== null && Number(v) > 0; };
  // Empty or 0 and up: an interest of 0, or a sale cost left at 0 (none).
  const optionalAmount = (text: string) => { const v = parseAmount(text); return text.trim() === "" || (v !== null && Number(v) >= 0); };
  const settlements = (mortgages ?? []).map((m) => ({ m, s: settle[m.uuid] ?? { on: true, amount: String(m.residualDebt) } })).filter(({ s }) => s.on);

  const problems: string[] = kind === "purchase"
    ? newProperty.problems
    : [
        !property && "a property",
        !bookedOn && "the day",
        !positive(amount) && (kind === "sale" ? "the sale price" : "the amount"),
        kind === "expense" && TAX_TYPES.includes(expenseType) && taxYear.trim() !== "" && !/^\d{4}$/.test(taxYear.trim()) && "a valid tax year",
        kind === "rent" && isPayout && (!optionalAmount(platformFee) || !optionalAmount(taxWithheld)) && "a valid fee and tax withheld",
        kind === "mortgage" && !mortgage && "a mortgage",
        kind === "mortgage" && !prepayment && !optionalAmount(interest) && "a valid interest",
        kind === "mortgage" && !prepayment && instalmentNumber.trim() !== "" && !/^\d+$/.test(instalmentNumber.trim()) && "a valid instalment number",
        kind === "sale" && (!optionalAmount(agencyFee) || !optionalAmount(otherCosts)) && "valid sale costs",
        kind === "sale" && settlements.some(({ s }) => !positive(s.amount)) && "each payoff's amount",
      ].filter(Boolean) as string[];

  /** The transactions to add, signed (money in positive). */
  const transactions = (): PropertyTransactionInput[] => {
    const common = {
      bookedOn,
      description: description.trim() || null,
      counterparty: counterparty.trim() || null,
      note: note.trim() || null,
    };
    const value = amountValue!;
    switch (kind) {
      case "sale":
        return [
          { kind: "sale", ...common, amount: value },
          ...(positive(agencyFee) ? [{ kind: "sale_cost" as const, bookedOn, costKind: "agency" as const, amount: `-${parseAmount(agencyFee)}` }] : []),
          ...(positive(otherCosts) ? [{ kind: "sale_cost" as const, bookedOn, costKind: "other" as const, amount: `-${parseAmount(otherCosts)}` }] : []),
          ...settlements.map(({ m, s }) => ({
            kind: "mortgage_prepayment" as const, bookedOn, mortgageUuid: m.uuid, amount: `-${parseAmount(s.amount)}`,
            prepaymentEffect: "shorten_term" as const, description: "Mortgage payoff on sale",
          })),
        ];
      case "rent":
        return [isPayout
          ? {
              kind: "short_stay_payout", ...common, amount: value,
              platformFee: platformFee.trim() ? parseAmount(platformFee) : null,
              taxWithheld: taxWithheld.trim() ? parseAmount(taxWithheld) : null,
            }
          : { kind: "rent", ...common, amount: value, rentPeriod: rentPeriod || null }];
      case "expense":
        return [expenseType === "property_tax" || expenseType === "income_tax"
          ? { kind: expenseType, ...common, amount: `-${value}`, taxYear: taxYear.trim() ? Number(taxYear.trim()) : null }
          : { kind: "expense", ...common, amount: refund ? value : `-${value}`, expenseKind: expenseType }];
      case "works":
        return [{ kind: "works", ...common, amount: `-${value}`, incentive: incentive.trim() || null }];
      case "mortgage":
        return [prepayment
          ? { kind: "mortgage_prepayment", ...common, amount: `-${value}`, mortgageUuid: mortgage!.uuid, prepaymentEffect: effect }
          : {
              kind: "mortgage_instalment", ...common, amount: `-${value}`, mortgageUuid: mortgage!.uuid,
              interest: interest.trim() ? parseAmount(interest) : null,
              instalmentNumber: instalmentNumber.trim() ? Number(instalmentNumber.trim()) : null,
            }];
      default:
        return [];
    }
  };

  const submit = async () => {
    if (readOnly || problems.length > 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "purchase") {
        const created = await realEstateService.create(newProperty.request());
        changed();
        onSaved(created.property.uuid);
        return;
      }
      await realEstateService.addTransactions(property!.uuid, transactions());
      // A sale's settled mortgages are closed on the sale day.
      if (kind === "sale") {
        for (const { m } of settlements) await realEstateService.updateMortgage(m.uuid, { closedOn: bookedOn });
      }
      changed();
      onSaved(property!.uuid);
    } catch (err) {
      setError(fieldErrorText(err, kind === "purchase" ? "Unable to add this property." : "Unable to save this transaction."));
      setBusy(false);
    }
  };

  const started = kind === "purchase" ? newProperty.started : amount.trim() !== "";
  const shownError = error ?? (started && problems.length > 0 ? `Still needed: ${problems.join(", ")}.` : null);
  const money = (v: number) => formatCurrency(v, currency, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            aria-pressed={kind === k.value}
            onClick={() => { setKind(k.value); setError(null); }}
            className={`flex flex-col items-center justify-center gap-1.5 w-[4.5rem] sm:w-20 py-2.5 rounded-2xl border-2 transition-all shrink-0 ${
              kind === k.value ? "border-[#C49A3C] bg-[#C49A3C]/10 text-[#8A6A28]" : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
            }`}
          >
            <k.icon className="h-4 w-4" />
            <span className="text-[11px] font-bold">{k.label}</span>
          </button>
        ))}
      </div>

      {kind === "purchase" ? newProperty.fields : !property ? (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-[13px] text-slate-500">
          No property to record it on yet. Add one first, from <span className="font-bold text-slate-700">Purchase</span>.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Property" className="sm:col-span-2">
            <select value={property.uuid} onChange={(e) => { setPropertyUuid(e.target.value); setMortgageUuid(""); setSettle({}); }} className={INPUT}>
              {open.map((p) => <option key={p.uuid} value={p.uuid}>{p.name} · {p.address.locality}</option>)}
            </select>
          </Field>
          <Field label="Day">
            <input type="date" value={bookedOn} onChange={(e) => setBookedOn(e.target.value)} className={INPUT} />
          </Field>
          <Field
            label={`${kind === "sale" ? "Sale price" : kind === "rent" && isPayout ? "Payout received" : "Amount"} (${currency})`}
            hint={kind === "sale" ? "Your part of it." : kind === "rent" && isPayout ? "What reached your account." : undefined}
          >
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder={kind === "mortgage" && mortgage && !prepayment ? String(mortgage.currentInstalment) : "0"}
              className={INPUT}
            />
          </Field>

          {kind === "rent" && (
            <>
              <Field label="Kind">
                <select value={isPayout ? "payout" : "rent"} onChange={(e) => setPayout(e.target.value === "payout")} className={INPUT}>
                  <option value="rent">Rent from a tenant</option>
                  <option value="payout">Short-stay payout</option>
                </select>
              </Field>
              {!isPayout && (
                <Field label="Month it pays" hint="The booking day's month, unless you pick one.">
                  <input type="month" value={rentPeriod} onChange={(e) => setRentPeriod(e.target.value)} className={INPUT} />
                </Field>
              )}
              <Field label={isPayout ? "Platform" : "Tenant"}>
                <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder={isPayout ? "Airbnb" : "Optional"} className={INPUT} />
              </Field>
              {isPayout && (
                <>
                  <Field label="Platform fee" hint="What the platform kept, from its statement.">
                    <input value={platformFee} onChange={(e) => setPlatformFee(e.target.value)} inputMode="decimal" placeholder="Optional" className={INPUT} />
                  </Field>
                  <Field label="Tax withheld" hint="The 21% the platform withheld: it counts as paid.">
                    <input value={taxWithheld} onChange={(e) => setTaxWithheld(e.target.value)} inputMode="decimal" placeholder="Optional" className={INPUT} />
                  </Field>
                </>
              )}
            </>
          )}

          {kind === "expense" && (
            <>
              <Field label="What for">
                <select value={expenseType} onChange={(e) => setExpenseType(e.target.value as ExpenseType)} className={INPUT}>
                  {EXPENSE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              {TAX_TYPES.includes(expenseType) ? (
                <Field label="Tax year" hint={`The ${expenseType === "property_tax" ? "IMU" : "rents' tax"} year it pays: the booking day's year, unless you say.`}>
                  <input value={taxYear} onChange={(e) => setTaxYear(e.target.value)} inputMode="numeric" placeholder={bookedOn.slice(0, 4)} className={INPUT} />
                </Field>
              ) : (
                <label className="flex items-center gap-2 self-end h-11 text-[13px] font-semibold text-slate-600">
                  <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} className="h-4 w-4 accent-[#C49A3C]" />
                  It&apos;s a refund (money in)
                </label>
              )}
              <Field label="Paid to">
                <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Optional" className={INPUT} />
              </Field>
            </>
          )}

          {kind === "works" && (
            <>
              <Field label="Tax incentive">
                <input value={incentive} onChange={(e) => setIncentive(e.target.value)} placeholder="Bonus ristrutturazione 50%" className={INPUT} />
              </Field>
              <Field label="Contractor">
                <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Optional" className={INPUT} />
              </Field>
            </>
          )}

          {kind === "mortgage" && (mortgages === undefined ? (
            <p className="sm:col-span-2 text-[12.5px] text-slate-400">Loading its mortgages…</p>
          ) : !mortgage ? (
            <p className="sm:col-span-2 text-[12.5px] text-slate-500">This property has no open mortgage. Add one from its page.</p>
          ) : (
            <>
              <Field label="Mortgage">
                <select value={mortgage.uuid} onChange={(e) => setMortgageUuid(e.target.value)} className={INPUT}>
                  {mortgages.map((m) => <option key={m.uuid} value={m.uuid}>{m.lender ?? "Mortgage"} · {money(m.residualDebt)} left</option>)}
                </select>
              </Field>
              <Field label="Payment">
                <select value={prepayment ? "prepayment" : "instalment"} onChange={(e) => setPrepayment(e.target.value === "prepayment")} className={INPUT}>
                  <option value="instalment">An instalment</option>
                  <option value="prepayment">A prepayment</option>
                </select>
              </Field>
              {prepayment ? (
                <Field label="Afterwards" className="sm:col-span-2">
                  <select value={effect} onChange={(e) => setEffect(e.target.value as PrepaymentEffect)} className={INPUT}>
                    {(Object.keys(PREPAYMENT_EFFECT_LABELS) as PrepaymentEffect[]).map((k) => <option key={k} value={k}>{PREPAYMENT_EFFECT_LABELS[k]}</option>)}
                  </select>
                </Field>
              ) : (
                <>
                  <Field label="Of which interest" hint="As the bank's statement says; the schedule's otherwise.">
                    <input value={interest} onChange={(e) => setInterest(e.target.value)} inputMode="decimal" placeholder="Optional" className={INPUT} />
                  </Field>
                  <Field label="Instalment number" hint="The first not paid yet, unless you say.">
                    <input value={instalmentNumber} onChange={(e) => setInstalmentNumber(e.target.value)} inputMode="numeric" placeholder="Optional" className={INPUT} />
                  </Field>
                </>
              )}
            </>
          ))}

          {kind === "sale" && (
            <>
              <Field label="Agency fee">
                <input value={agencyFee} onChange={(e) => setAgencyFee(e.target.value)} inputMode="decimal" placeholder="0" className={INPUT} />
              </Field>
              <Field label="Other sale costs">
                <input value={otherCosts} onChange={(e) => setOtherCosts(e.target.value)} inputMode="decimal" placeholder="0" className={INPUT} />
              </Field>
              <Field label="Buyer">
                <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Optional" className={INPUT} />
              </Field>
              {mortgages && mortgages.length > 0 && (
                <div className="sm:col-span-2 rounded-2xl border border-slate-200 p-4 space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">Its mortgages</p>
                  <p className="text-[11px] text-slate-400 -mt-2">
                    A sale doesn&apos;t pay them off by itself. Settled here, the payoff is booked on the sale day and the mortgage closed.
                  </p>
                  {mortgages.map((m) => {
                    const s = settle[m.uuid] ?? { on: true, amount: String(m.residualDebt) };
                    return (
                      <div key={m.uuid} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                          <input type="checkbox" checked={s.on} onChange={(e) => setSettle({ ...settle, [m.uuid]: { ...s, on: e.target.checked } })} className="h-4 w-4 accent-[#C49A3C]" />
                          Pay off {m.lender ?? "the mortgage"} ({money(m.residualDebt)} left)
                        </label>
                        {s.on && (
                          <input
                            value={s.amount}
                            onChange={(e) => setSettle({ ...settle, [m.uuid]: { ...s, amount: e.target.value } })}
                            inputMode="decimal"
                            aria-label="Payoff amount"
                            className={INPUT}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <Field label="Description" className="sm:col-span-2">
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional: the kind's name otherwise" maxLength={200} className={INPUT} />
          </Field>
          <Field label="Note" className="sm:col-span-2">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything worth remembering" className={`${INPUT} h-auto py-2.5`} />
          </Field>
        </div>
      )}

      {shownError && (
        <p className="flex items-start gap-2 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-semibold text-rose-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {shownError}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={busy} className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={readOnly || busy || problems.length > 0 || (kind !== "purchase" && !property)}
          title={readOnly ? DEMO_DISABLED_TITLE : undefined}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#1c1917] hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1c1917]"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {kind === "purchase" ? "Add property" : kind === "sale" ? "Record sale" : "Add transaction"}
        </button>
      </div>
    </div>
  );
}

/** A property's open mortgages: undefined while loading (or with no property). */
function usePropertyMortgages(propertyUuid: string | undefined, source: ReturnType<typeof useRealEstate>["source"]) {
  const { version } = useRealEstate();
  const key = `${propertyUuid}:${version}`;
  const [state, setState] = useState<{ key: string; list: Mortgage[] } | null>(null);
  useEffect(() => {
    if (!propertyUuid) return;
    let cancelled = false;
    source.mortgages(propertyUuid)
      .then((list) => { if (!cancelled) setState({ key, list: list.filter((m) => !m.closedOn) }); })
      .catch(() => { if (!cancelled) setState({ key, list: [] }); });
    return () => { cancelled = true; };
  }, [source, propertyUuid, key]);
  return state?.key === key ? state.list : undefined;
}

/**
 * The real estate form in a dialog: the real estate's "Add transaction" (on Purchase while there's
 * no property yet) and Wealth's "Add property".
 */
export function RealEstateTransactionDialog({ initialKind, initialPropertyUuid, taxPayment, onClose, onSaved }: {
  initialKind?: RealEstateEntryKind;
  initialPropertyUuid?: string;
  taxPayment?: TaxPaymentPrefill;
  onClose: () => void;
  onSaved: (propertyUuid: string) => void;
}) {
  const { sample } = useRealEstate();
  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 md:p-8 space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#C49A3C]/10 rounded-xl shrink-0 text-[#C49A3C]"><Building2 className="h-5 w-5" /></div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Real estate</h3>
              <p className="text-xs text-slate-500">A new property, or money one of yours moved.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        {sample && (
          <p className="rounded-2xl bg-[#1c1917] px-4 py-3 text-xs font-semibold text-stone-300">
            <span className="font-black text-white">Demo account — read only.</span> Try the form out; it can&apos;t be saved.
          </p>
        )}
        <RealEstateTransactionForm initialKind={initialKind} initialPropertyUuid={initialPropertyUuid} taxPayment={taxPayment} readOnly={sample} onCancel={onClose} onSaved={onSaved} />
      </div>
    </div>,
    document.body,
  );
}
