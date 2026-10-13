// components/dashboard/realEstate/RealEstateTransactions.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { useRealEstate } from "../../../context/RealEstateContext";
import { realEstateService } from "../../../services/realEstateService";
import { formatCurrency } from "../../../lib/format";
import {
  COST_KIND_LABELS, EXPENSE_KIND_LABELS, INCENTIVE_KIND_LABELS, PREPAYMENT_EFFECT_LABELS, TRANSACTION_KIND_LABELS, fieldErrorText,
} from "../../../lib/realEstate";
import { dayLabel, errorText, monthName } from "../../../lib/wallets";
import type {
  CostKind, ExpenseKind, IncentiveKind, PrepaymentEffect, PropertyTransaction, PropertyTransactionFilters, PropertyTransactionKind,
  PropertyTransactionUpdateRequest, TaxRegime,
} from "../../../models/RealEstate";
import { ConfirmDialog } from "../ConfirmDialog";
import { DialogShell, Field, INPUT, parseAmount } from "../wallets/WalletDialogs";
import { MovementLinkField, MovementLinkMark, MovementProposals } from "./MovementLinks";

const PAGE = 50;
const SELECT = "h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 outline-none";
export const ALL_PROPERTIES = "all";

// The kinds, as the filter groups them.
const KIND_GROUPS: { label: string; kinds: PropertyTransactionKind[] }[] = [
  { label: "Money in", kinds: ["rent", "short_stay_payout", "sale"] },
  { label: "Running costs", kinds: ["expense", "property_tax", "income_tax", "works"] },
  { label: "Mortgage", kinds: ["mortgage_instalment", "mortgage_prepayment"] },
  { label: "Buying and selling", kinds: ["purchase", "purchase_cost", "sale_cost", "capital_gains_tax"] },
];

// Money in, by kind; an expense goes either way (a refund is money in).
const IN_KINDS = new Set<PropertyTransactionKind>(["sale", "rent", "short_stay_payout"]);

const KIND_COLORS: Record<PropertyTransactionKind, string> = {
  purchase: "#4a3aa7", purchase_cost: "#4a3aa7", sale: "#1baf7a", sale_cost: "#64748b",
  rent: "#1baf7a", short_stay_payout: "#eb6834", expense: "#e34948", works: "#a16207", property_tax: "#eda100",
  mortgage_instalment: "#2a78d6", mortgage_prepayment: "#2a78d6", income_tax: "#eda100", capital_gains_tax: "#eda100",
};

export function KindChip({ transaction }: { transaction: PropertyTransaction }) {
  const color = KIND_COLORS[transaction.kind];
  const detail = transaction.expenseKind ? EXPENSE_KIND_LABELS[transaction.expenseKind]
    : transaction.costKind ? COST_KIND_LABELS[transaction.costKind]
    : TRANSACTION_KIND_LABELS[transaction.kind];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap" style={{ background: `${color}14`, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{detail}
    </span>
  );
}

/** What a transaction is for, under its description: the rent's month, the tax year, the instalment… */
function detailOf(t: PropertyTransaction) {
  return [
    t.rentPeriod && `For ${monthName(t.rentPeriod)}`,
    t.taxYear && `Tax year ${t.taxYear}`,
    t.taxRegime && t.kind === "sale" && (t.taxRegime === "flat_rate" ? "Gain taxed at the deed (26%)" : "Gain taxed with IRPEF"),
    t.incentiveKind && INCENTIVE_KIND_LABELS[t.incentiveKind],
    t.worksCompletedOn && `Ended ${dayLabel(t.worksCompletedOn)}`,
    t.platformFee != null && `Platform fee ${formatCurrency(t.platformFee, t.currency, 2)}`,
    t.taxWithheld != null && `Tax withheld ${formatCurrency(t.taxWithheld, t.currency, 2)}`,
    t.instalmentNumber && `Instalment ${t.instalmentNumber}${t.interest != null ? `, ${formatCurrency(t.interest, t.currency, 2)} interest` : ""}`,
    t.prepaymentEffect && PREPAYMENT_EFFECT_LABELS[t.prepaymentEffect],
    t.incentive,
    t.counterparty,
    t.note,
  ].filter(Boolean).join(" · ");
}

/**
 * Every property's transactions, or one's (the list widens to all of them from its own filter):
 * searched, filtered and paged by the API, newest first, with the net of everything that matches
 * per currency. A transaction opens to be changed (not its kind or mortgage: delete it and add
 * another) and linked to its wallet movement; several picked together can be deleted. Above them,
 * the wallets' movements that may be transactions not linked yet, or instalments not recorded. An
 * archived property's, and a demo account's, are read only.
 */
export function RealEstateTransactions({ initial, readOnly }: { initial: string; readOnly: boolean }) {
  const { properties, source, version, changed } = useRealEstate();
  const [propertyUuid, setPropertyUuid] = useState(initial);
  const scope = propertyUuid === ALL_PROPERTIES ? null : propertyUuid;
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"all" | PropertyTransactionKind>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<PropertyTransaction[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [totals, setTotals] = useState<{ currency: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pages, setPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<PropertyTransaction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // The search goes out once typing stops.
  useEffect(() => {
    const t = setTimeout(() => setText(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const filters = useMemo<PropertyTransactionFilters>(() => ({
    ...(text.trim() ? { text } : {}),
    ...(kind !== "all" ? { kinds: [kind] } : {}),
    ...(from ? { bookedFrom: from } : {}),
    ...(to ? { bookedTo: to } : {}),
  }), [text, kind, from, to]);
  const filterKey = JSON.stringify([scope, filters]);

  // A new filter starts from the first page, the selection cleared.
  useEffect(() => {
    setPages(1);
    setSelected(new Set());
  }, [filterKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Page by page (the API reads at most 200 at once), all of them again after a change.
    Promise.all(Array.from({ length: pages }, (_, i) => source.transactions(scope, { ...filters, limit: PAGE, offset: i * PAGE })))
      .then((lists) => {
        if (cancelled) return;
        setRows(lists.flatMap((l) => l.items));
        setTotal(lists[0].total);
        setTotals(lists[0].totals);
        setLoadError(null);
      })
      .catch((err) => { if (!cancelled) setLoadError(errorText(err, "Unable to load the transactions.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // filters is read through filterKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, filterKey, pages, version]);

  const byUuid = useMemo(() => new Map(properties.map((p) => [p.uuid, p])), [properties]);
  const editable = (t: PropertyTransaction) => !readOnly && !byUuid.get(t.propertyUuid)?.archived;
  const picked = rows.filter((t) => selected.has(t.uuid));
  const more = total !== null && rows.length < total;

  const toggle = (uuid: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(uuid)) next.delete(uuid);
    else next.add(uuid);
    return next;
  });

  const remove = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await realEstateService.deleteTransactions(picked.map((t) => t.uuid));
      setSelected(new Set());
      setConfirmDelete(false);
      changed();
    } catch (err) {
      setActionError(errorText(err, "Unable to delete these transactions."));
    } finally {
      setBusy(false);
    }
  };
  const removesPurchaseOrSale = picked.some((t) => t.kind === "purchase" || t.kind === "sale");

  return (
    <>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 md:p-5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search description, counterparty, note"
              aria-label="Search transactions"
              className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-[#C49A3C]/60"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={propertyUuid} onChange={(e) => setPropertyUuid(e.target.value)} aria-label="Property" className={SELECT}>
              <option value={ALL_PROPERTIES}>Every property</option>
              {properties.map((p) => <option key={p.uuid} value={p.uuid}>{p.name}{p.archived ? " (archived)" : ""}</option>)}
            </select>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Kind" className={SELECT}>
              <option value="all">Every kind</option>
              {KIND_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.kinds.map((k) => <option key={k} value={k}>{TRANSACTION_KIND_LABELS[k]}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
          <label className="flex items-center gap-2">From <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={SELECT} /></label>
          <label className="flex items-center gap-2">to <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={SELECT} /></label>
        </div>
      </div>

      {!readOnly && !(scope && byUuid.get(scope)?.archived) && (
        <MovementProposals propertyUuid={scope} from={from} to={to} transactions={rows} />
      )}

      {picked.length > 0 && (
        <div className="sticky top-20 z-10 bg-[#1c1917] text-white rounded-2xl shadow-lg px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold">{picked.length} selected</span>
          <button
            type="button"
            onClick={() => { setActionError(null); setConfirmDelete(true); }}
            disabled={busy}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold bg-rose-500/90 hover:bg-rose-500 transition-colors disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs font-bold text-white/60 hover:text-white">Clear</button>
        </div>
      )}

      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 md:px-7 pt-5 pb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
          <h3 className="text-sm font-black text-slate-900">
            {total === null ? "Transactions" : `${total.toLocaleString("en-US")} ${total === 1 ? "transaction" : "transactions"}`}
          </h3>
          <span className="flex items-center gap-3 text-sm font-black tabular-nums">
            {totals.map((t) => (
              <span key={t.currency} className={t.amount >= 0 ? "text-emerald-600" : "text-slate-900"}>
                {t.amount >= 0 ? "+" : ""}{formatCurrency(t.amount, t.currency, 0)}
              </span>
            ))}
            {totals.length > 0 && <span className="text-xs font-semibold text-slate-400">net</span>}
            {loading && <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />}
          </span>
        </div>
        {loadError ? (
          <p className="p-6 text-sm font-semibold text-rose-600">{loadError}</p>
        ) : rows.length === 0 && !loading ? (
          <p className="p-6 text-sm font-semibold text-slate-500">
            {Object.keys(filters).length === 0 ? "No transactions yet." : "No transactions match."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                  {!readOnly && <th className="pl-6 pr-2 py-3 w-8" />}
                  <th className={`${readOnly ? "pl-6" : "pl-2"} pr-3 py-3`}>Date</th>
                  <th className="px-3 py-3">Description</th>
                  <th className="px-3 py-3">Kind</th>
                  {!scope && <th className="px-3 py-3">Property</th>}
                  <th className="pl-3 pr-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((t) => {
                  const canEdit = editable(t);
                  const detail = detailOf(t);
                  return (
                    <tr
                      key={t.uuid}
                      onClick={() => canEdit && setEditing(t)}
                      className={`${canEdit ? "cursor-pointer hover:bg-slate-50" : ""} ${selected.has(t.uuid) ? "bg-[#C49A3C]/5" : ""}`}
                    >
                      {!readOnly && (
                        <td className="pl-6 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            disabled={!canEdit}
                            checked={selected.has(t.uuid)}
                            onChange={() => toggle(t.uuid)}
                            aria-label={`Select ${t.description}`}
                            className="accent-[#C49A3C]"
                          />
                        </td>
                      )}
                      <td className={`${readOnly ? "pl-6" : "pl-2"} pr-3 py-3 whitespace-nowrap text-slate-500`}>{dayLabel(t.bookedOn)}</td>
                      <td className="px-3 py-3 min-w-48">
                        <p className="flex items-center gap-1.5 font-semibold text-slate-800">{t.description}<MovementLinkMark transaction={t} /></p>
                        {detail && <p className="text-[11px] text-slate-400 truncate max-w-md">{detail}</p>}
                      </td>
                      <td className="px-3 py-3"><KindChip transaction={t} /></td>
                      {!scope && <td className="px-3 py-3 whitespace-nowrap text-slate-500">{byUuid.get(t.propertyUuid)?.name ?? "—"}</td>}
                      <td className={`pl-3 pr-6 py-3 text-right font-bold tabular-nums whitespace-nowrap ${t.amount > 0 ? "text-emerald-600" : "text-slate-900"}`}>
                        {t.amount > 0 ? "+" : ""}{formatCurrency(t.amount, t.currency, 2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {more && (
          <div className="px-6 py-4 border-t border-slate-100 flex justify-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => setPages((p) => p + 1)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:border-slate-300 disabled:opacity-60"
            >
              Show more ({(total! - rows.length).toLocaleString("en-US")} left)
            </button>
          </div>
        )}
      </section>

      {editing && (
        <TransactionEditDialog
          transaction={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); changed(); }}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${picked.length === 1 ? "this transaction" : `${picked.length} transactions`}?`}
          description={`${removesPurchaseOrSale ? "Deleting a purchase or a sale changes when the property counts as bought or sold. " : ""}The property's figures change accordingly. This can't be undone.`}
          confirming={busy}
          error={actionError}
          onConfirm={remove}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

/**
 * A transaction's fields, to change: its day, amount (typed positive, signed by its kind; an
 * expense can be a refund) and what its kind has. Its kind and its mortgage stay.
 */
function TransactionEditDialog({ transaction: t, onClose, onSaved }: { transaction: PropertyTransaction; onClose: () => void; onSaved: () => void }) {
  const [bookedOn, setBookedOn] = useState(t.bookedOn);
  const [amount, setAmount] = useState(String(Math.abs(t.amount)));
  const [refund, setRefund] = useState(t.kind === "expense" && t.amount > 0);
  const [description, setDescription] = useState(t.description);
  const [counterparty, setCounterparty] = useState(t.counterparty ?? "");
  const [note, setNote] = useState(t.note ?? "");
  const [costKind, setCostKind] = useState<CostKind>(t.costKind ?? "other");
  const [expenseKind, setExpenseKind] = useState<ExpenseKind>(t.expenseKind ?? "other");
  const [rentPeriod, setRentPeriod] = useState(t.rentPeriod ?? "");
  const [taxYear, setTaxYear] = useState(t.taxYear ? String(t.taxYear) : "");
  const [incentive, setIncentive] = useState(t.incentive ?? "");
  const [instalmentNumber, setInstalmentNumber] = useState(t.instalmentNumber ? String(t.instalmentNumber) : "");
  const interestText = t.interest != null ? String(t.interest) : "";
  const [interest, setInterest] = useState(interestText);
  const [effect, setEffect] = useState<PrepaymentEffect>(t.prepaymentEffect ?? "reduce_instalment");
  const [platformFee, setPlatformFee] = useState(t.platformFee != null ? String(t.platformFee) : "");
  const [taxWithheld, setTaxWithheld] = useState(t.taxWithheld != null ? String(t.taxWithheld) : "");
  const [incentiveKind, setIncentiveKind] = useState<IncentiveKind | "">(t.incentiveKind ?? "");
  const [worksCompletedOn, setWorksCompletedOn] = useState(t.worksCompletedOn ?? "");
  const [taxRegime, setTaxRegime] = useState<TaxRegime>(t.taxRegime ?? "flat_rate");
  const [movementUuid, setMovementUuid] = useState(t.movementUuid ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = parseAmount(amount);
  const positiveIn = IN_KINDS.has(t.kind) || (t.kind === "expense" && refund);
  const signed = value === null ? null : positiveIn ? value : `-${value}`;
  const valid = !!bookedOn && value !== null && Number(value) > 0
    && (taxYear.trim() === "" || /^\d{4}$/.test(taxYear.trim()))
    && (instalmentNumber.trim() === "" || /^\d+$/.test(instalmentNumber.trim()))
    && (interest.trim() === "" || parseAmount(interest) !== null)
    && [platformFee, taxWithheld].every((x) => x.trim() === "" || (parseAmount(x) !== null && Number(parseAmount(x)) >= 0));

  const submit = async () => {
    setBusy(true);
    setError(null);
    // Only what changed; "" clears counterparty, note and incentive, and gives back the kind's
    // name to the description and the schedule's interest to an instalment.
    const changes: PropertyTransactionUpdateRequest = {
      ...(bookedOn !== t.bookedOn ? { bookedOn } : {}),
      ...(Number(signed) !== t.amount ? { amount: signed! } : {}),
      ...(description.trim() !== t.description ? { description: description.trim() } : {}),
      ...(counterparty.trim() !== (t.counterparty ?? "") ? { counterparty: counterparty.trim() } : {}),
      ...(note.trim() !== (t.note ?? "") ? { note: note.trim() } : {}),
      ...(t.costKind && costKind !== t.costKind ? { costKind } : {}),
      ...(t.kind === "expense" && expenseKind !== t.expenseKind ? { expenseKind } : {}),
      ...(t.kind === "rent" && rentPeriod && rentPeriod !== t.rentPeriod ? { rentPeriod } : {}),
      ...(t.kind === "works" && incentiveKind && incentiveKind !== t.incentiveKind ? { incentiveKind } : {}),
      ...(t.kind === "works" && worksCompletedOn && worksCompletedOn !== t.worksCompletedOn ? { worksCompletedOn } : {}),
      ...(t.kind === "sale" && taxRegime !== (t.taxRegime ?? "flat_rate") ? { taxRegime } : {}),
      ...((t.kind === "property_tax" || t.kind === "income_tax" || t.kind === "capital_gains_tax") && taxYear.trim() && Number(taxYear) !== t.taxYear ? { taxYear: Number(taxYear) } : {}),
      // "" clears a payout's platform fee or withheld tax.
      ...(t.kind === "short_stay_payout" && platformFee.trim() !== (t.platformFee != null ? String(t.platformFee) : "")
        ? { platformFee: platformFee.trim() === "" ? "" : parseAmount(platformFee)! } : {}),
      ...(t.kind === "short_stay_payout" && taxWithheld.trim() !== (t.taxWithheld != null ? String(t.taxWithheld) : "")
        ? { taxWithheld: taxWithheld.trim() === "" ? "" : parseAmount(taxWithheld)! } : {}),
      ...(t.kind === "works" && incentive.trim() !== (t.incentive ?? "") ? { incentive: incentive.trim() } : {}),
      ...(t.kind === "mortgage_instalment" && instalmentNumber.trim() && Number(instalmentNumber) !== t.instalmentNumber ? { instalmentNumber: Number(instalmentNumber) } : {}),
      ...(t.kind === "mortgage_instalment" && interest.trim() !== interestText
        ? { interest: interest.trim() === "" ? "" : parseAmount(interest)! } : {}),
      ...(t.kind === "mortgage_prepayment" && effect !== t.prepaymentEffect ? { prepaymentEffect: effect } : {}),
      // "" unlinks it.
      ...(movementUuid !== (t.movementUuid ?? "") ? { movementUuid } : {}),
    };
    try {
      if (Object.keys(changes).length > 0) await realEstateService.updateTransaction(t.uuid, changes);
      onSaved();
    } catch (err) {
      setError(fieldErrorText(err, "Unable to save this transaction."));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      icon={<Pencil className="h-5 w-5" />}
      title={`Edit ${TRANSACTION_KIND_LABELS[t.kind].toLowerCase()}`}
      subtitle="Its kind and mortgage stay: to change them, delete it and add another."
      busy={busy}
      error={error}
      submitLabel="Save"
      canSubmit={valid}
      onSubmit={submit}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Day">
          <input type="date" value={bookedOn} onChange={(e) => setBookedOn(e.target.value)} className={INPUT} />
        </Field>
        <Field label={`Amount (${t.currency})`} hint={positiveIn ? "Money in." : "Money out."}>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={INPUT} />
        </Field>
        {t.kind === "expense" && (
          <>
            <Field label="What for">
              <select value={expenseKind} onChange={(e) => setExpenseKind(e.target.value as ExpenseKind)} className={INPUT}>
                {(Object.keys(EXPENSE_KIND_LABELS) as ExpenseKind[]).map((k) => <option key={k} value={k}>{EXPENSE_KIND_LABELS[k]}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 self-end h-11 text-[13px] font-semibold text-slate-600">
              <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} className="h-4 w-4 accent-[#C49A3C]" />
              It&apos;s a refund (money in)
            </label>
          </>
        )}
        {t.costKind && (
          <Field label="Cost">
            <select value={costKind} onChange={(e) => setCostKind(e.target.value as CostKind)} className={INPUT}>
              {(Object.keys(COST_KIND_LABELS) as CostKind[]).map((k) => <option key={k} value={k}>{COST_KIND_LABELS[k]}</option>)}
            </select>
          </Field>
        )}
        {t.kind === "rent" && (
          <Field label="Month it pays">
            <input type="month" value={rentPeriod} onChange={(e) => setRentPeriod(e.target.value)} className={INPUT} />
          </Field>
        )}
        {t.kind === "short_stay_payout" && (
          <>
            <Field label="Platform fee" hint="What the platform kept.">
              <input value={platformFee} onChange={(e) => setPlatformFee(e.target.value)} inputMode="decimal" placeholder="Optional" className={INPUT} />
            </Field>
            <Field label="Tax withheld" hint="The 21% the platform withheld.">
              <input value={taxWithheld} onChange={(e) => setTaxWithheld(e.target.value)} inputMode="decimal" placeholder="Optional" className={INPUT} />
            </Field>
          </>
        )}
        {t.kind === "works" && (
          <>
            <Field label="Incentive, for the taxes" hint="Superbonus works change how a sale is taxed.">
              <select value={incentiveKind} onChange={(e) => setIncentiveKind(e.target.value as IncentiveKind)} className={INPUT}>
                <option value="" disabled>None said</option>
                {(Object.keys(INCENTIVE_KIND_LABELS) as IncentiveKind[]).map((k) => <option key={k} value={k}>{INCENTIVE_KIND_LABELS[k]}</option>)}
              </select>
            </Field>
            <Field label="Works ended on" hint="Needed for Superbonus works.">
              <input type="date" value={worksCompletedOn} onChange={(e) => setWorksCompletedOn(e.target.value)} className={INPUT} />
            </Field>
          </>
        )}
        {t.kind === "sale" && (
          <Field label="Gain taxed">
            <select value={taxRegime} onChange={(e) => setTaxRegime(e.target.value as TaxRegime)} className={INPUT}>
              <option value="flat_rate">At the deed: 26% substitute tax, via the notary</option>
              <option value="ordinary">With IRPEF, in the return</option>
            </select>
          </Field>
        )}
        {(t.kind === "property_tax" || t.kind === "income_tax" || t.kind === "capital_gains_tax") && (
          <Field label="Tax year">
            <input value={taxYear} onChange={(e) => setTaxYear(e.target.value)} inputMode="numeric" className={INPUT} />
          </Field>
        )}
        {t.kind === "works" && (
          <Field label="Tax incentive">
            <input value={incentive} onChange={(e) => setIncentive(e.target.value)} placeholder="Optional" className={INPUT} />
          </Field>
        )}
        {t.kind === "mortgage_instalment" && (
          <>
            <Field label="Instalment number">
              <input value={instalmentNumber} onChange={(e) => setInstalmentNumber(e.target.value)} inputMode="numeric" className={INPUT} />
            </Field>
            <Field label="Of which interest" hint="Empty: the schedule's.">
              <input value={interest} onChange={(e) => setInterest(e.target.value)} inputMode="decimal" className={INPUT} />
            </Field>
          </>
        )}
        {t.kind === "mortgage_prepayment" && (
          <Field label="Afterwards">
            <select value={effect} onChange={(e) => setEffect(e.target.value as PrepaymentEffect)} className={INPUT}>
              {(Object.keys(PREPAYMENT_EFFECT_LABELS) as PrepaymentEffect[]).map((k) => <option key={k} value={k}>{PREPAYMENT_EFFECT_LABELS[k]}</option>)}
            </select>
          </Field>
        )}
        <Field label="Counterparty">
          <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Optional" className={INPUT} />
        </Field>
        <Field label="Description" hint="Empty: the kind's name." className="sm:col-span-2">
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className={INPUT} />
        </Field>
        <Field label="Note" className="sm:col-span-2">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${INPUT} h-auto py-2.5`} />
        </Field>
        <div className="sm:col-span-2 space-y-1.5">
          <span className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Wallet movement</span>
          <MovementLinkField transaction={t} bookedOn={bookedOn} moneyIn={positiveIn} value={movementUuid} onChange={setMovementUuid} />
        </div>
      </div>
    </DialogShell>
  );
}
