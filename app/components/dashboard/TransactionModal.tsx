"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, AlertCircle, PlusCircle, Pencil, Trash2, TrendingUp, TrendingDown, Coins, type LucideIcon } from "lucide-react";
import { StandardTransaction } from "../../models/Report";
import { validateTransactions } from "../../lib/parser";
import type { Portfolio } from "../../models/Portfolio";
import { PortfolioSelect } from "./PortfolioSelect";
import { AssetPicker } from "./AssetPicker";
import type { Listing, ListingRef } from "../../models/Listing";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";

interface TransactionModalProps {
  mode: "add" | "edit";
  initial?: StandardTransaction;
  onClose: () => void;
  onSave: (transaction: StandardTransaction) => void;
  onDelete?: () => void;
  // Where the transaction will be saved: with two or more portfolios the form asks, and the
  // pick comes back as the saved transaction's portfolioUuid. Omit for a saved transaction,
  // which stays in the portfolio it's in.
  portfolios?: Portfolio[];
  defaultPortfolioUuid?: string;
  // The form can be filled in but not saved (a demo account, see lib/demo).
  readOnly?: boolean;
}

// Colors mirror the operation badges in TransactionsSection.tsx (OPERATION_STYLES)
// for a consistent palette across the transactions feature.
const OPERATION_OPTIONS: { value: StandardTransaction["operation"]; label: string; icon: LucideIcon; activeClasses: string }[] = [
  { value: "buy", label: "Buy", icon: TrendingUp, activeClasses: "border-emerald-400 bg-emerald-50 text-emerald-700" },
  { value: "sell", label: "Sell", icon: TrendingDown, activeClasses: "border-rose-400 bg-rose-50 text-rose-700" },
  { value: "dividend", label: "Dividend", icon: Coins, activeClasses: "border-blue-400 bg-blue-50 text-blue-700" },
];

type DividendType = "cash" | "shares";

interface FormState {
  date: string;
  time: string;
  operation: StandardTransaction["operation"];
  // UI-only: not part of StandardTransaction — drives whether Quantity/Price
  // are shown for a dividend. "shares" ⇔ both are filled in on submit.
  dividendType: DividendType;
  amount: string;
  quantity: string;
  price: string;
  currency: string;
  fees: string;
  // census' listing picked from the search; empty for a transaction recorded by a ticker, which
  // keeps it until another security is picked.
  listingId: string;
  ticker: string;
  isin: string;
  name: string;
  broker: string;
}

const emptyForm: FormState = {
  date: "",
  time: "",
  operation: "buy",
  dividendType: "cash",
  amount: "",
  quantity: "",
  price: "",
  currency: "EUR",
  fees: "",
  listingId: "",
  ticker: "",
  isin: "",
  name: "",
  broker: "Manual",
};

// Pulls the "YYYY-MM-DD" and, if present, "HH:mm" straight out of the ISO string as text —
// deliberately not routed through `Date`, which would reinterpret a bare date (no time,
// no offset) as UTC midnight and could shift it by a day once displayed in local time.
function splitIsoDate(iso: string): { date: string; time: string } {
  const match = iso?.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
  if (!match) return { date: iso ?? "", time: "" };
  return { date: match[1], time: match[2] ?? "" };
}

function toFormState(tx?: StandardTransaction): FormState {
  if (!tx) return emptyForm;
  const { date, time } = splitIsoDate(tx.date);
  return {
    date,
    time,
    operation: tx.operation,
    dividendType: tx.operation === "dividend" && tx.quantity != null ? "shares" : "cash",
    amount: Number.isNaN(tx.amount) ? "" : String(tx.amount),
    quantity: tx.quantity == null || Number.isNaN(tx.quantity) ? "" : String(tx.quantity),
    price: tx.price == null || Number.isNaN(tx.price) ? "" : String(tx.price),
    currency: tx.currency,
    fees: String(tx.fees ?? 0),
    listingId: tx.listingId ?? "",
    ticker: tx.ticker ?? "",
    isin: tx.isin ?? "",
    name: tx.name ?? "",
    broker: tx.broker,
  };
}

function InputField({
  label, value, onChange, type = "text", placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold placeholder:text-slate-300 placeholder:font-normal outline-none focus:ring-4 focus:ring-slate-50 focus:border-slate-300 transition-all"
      />
    </div>
  );
}

function OperationButton({
  label, icon: Icon, active, activeClasses, onClick,
}: {
  label: string; icon: LucideIcon; active: boolean; activeClasses: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 w-20 sm:w-24 py-3 rounded-2xl border-2 transition-all shrink-0 ${
        active ? activeClasses : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
}

function PillButton({
  label, active, activeClasses, onClick,
}: {
  label: string; active: boolean; activeClasses: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-xl border-2 text-xs font-bold transition-all ${
        active ? activeClasses : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
      }`}
    >
      {label}
    </button>
  );
}

export function TransactionModal({ mode, initial, onClose, onSave, onDelete, portfolios, defaultPortfolioUuid, readOnly = false }: TransactionModalProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [portfolioUuid, setPortfolioUuid] = useState(initial?.portfolioUuid ?? defaultPortfolioUuid ?? portfolios?.[0]?.uuid);
  const [errors, setErrors] = useState<string[]>([]);
  const isEdit = mode === "edit";
  // The security is picked from the search, which fills in the currency too. A saved
  // transaction opens on the security it already has.
  const [pickedAsset, setPickedAsset] = useState<ListingRef | null>(() => {
    const saved = toFormState(initial);
    if (!saved.ticker && !saved.listingId) return null;
    return { listingId: saved.listingId || undefined, ticker: saved.ticker, name: saved.name || saved.ticker, isin: saved.isin || null };
  });

  const set = <K extends keyof FormState>(key: K) => (value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const isDividend = form.operation === "dividend";
  const isStockDividend = isDividend && form.dividendType === "shares";

  const setDividendType = (dividendType: DividendType) =>
    setForm(prev => ({
      ...prev,
      dividendType,
      // Switching back to "cash" drops any quantity/price the user had typed
      // while exploring "shares", so a stray value can't sneak into the payload.
      ...(dividendType === "cash" ? { quantity: "", price: "" } : {}),
    }));

  const pickAsset = (listing: Listing | null) => {
    setPickedAsset(listing);
    setForm(prev => ({
      ...prev,
      listingId: listing?.listingId ?? "",
      ticker: listing?.ticker ?? "",
      isin: listing?.isin ?? "",
      name: listing?.name ?? "",
      currency: listing?.currency ?? prev.currency,
    }));
  };

  const showQuantityPrice = !isDividend || isStockDividend;
  const requiresQuantityPrice = form.operation === "buy" || form.operation === "sell" || isStockDividend;
  // A cash dividend has no quantity/price to derive a value from, so it's the
  // only case where the total still has to be entered by hand.
  const showAmountField = isDividend && !isStockDividend;

  const handleSubmit = () => {
    const foundErrors: string[] = [];

    if (!form.listingId && !form.ticker.trim())
      foundErrors.push("Pick a security.");

    // Blank means "not applicable" (e.g. a cash dividend) rather than 0 — only
    // parse when the user actually typed something.
    const quantity = form.quantity.trim() === "" ? null : Number(form.quantity);
    const price = form.price.trim() === "" ? null : Number(form.price);
    // Amount is auto-computed from quantity × price whenever both are collected
    // (buy/sell/in-kind dividend); only a cash dividend needs it typed in directly.
    const amount = showQuantityPrice
      ? (quantity != null && price != null ? quantity * price : NaN)
      : Number(form.amount);

    const isin = form.isin.trim().toUpperCase();
    const ticker = form.ticker.trim().toUpperCase();

    const transaction: StandardTransaction = {
      // Locally-generated key, not shown to the user.
      id: initial?.id || ticker,
      date: form.time ? `${form.date}T${form.time}` : form.date,
      operation: form.operation,
      amount,
      quantity,
      price,
      currency: form.currency.trim().toUpperCase(),
      fees: form.fees.trim() === "" ? 0 : Number(form.fees),
      broker: form.broker.trim() || "Manual",
      ticker,
      ...(isin ? { isin } : {}),
      ...(form.listingId ? { listingId: form.listingId, name: form.name } : {}),
      ...(portfolios && portfolioUuid ? { portfolioUuid } : {}),
    };

    const { errors: validationErrors } = validateTransactions([transaction]);
    // When amount is auto-computed, it's not an editable field in this form —
    // surfacing an "Amount" error would point at nothing the user can fix directly;
    // the underlying quantity/price errors (still shown) are the actionable ones.
    const relevantErrors = showQuantityPrice
      ? validationErrors.filter(e => e.field !== "amount")
      : validationErrors;
    foundErrors.push(...relevantErrors.map(e => e.message));

    if (foundErrors.length > 0) {
      setErrors(foundErrors);
      return;
    }

    onSave(transaction);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 md:p-8 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl">
              {isEdit ? <Pencil className="h-5 w-5 text-blue-600" /> : <PlusCircle className="h-5 w-5 text-blue-600" />}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">{isEdit ? "Edit transaction" : "Add transaction"}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEdit ? "Update the fields for this transaction" : "Fill in the fields for a single transaction"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {readOnly && (
          <p className="rounded-2xl bg-[#1c1917] px-4 py-3 text-xs font-semibold text-stone-300">
            <span className="font-black text-white">Demo account — read only.</span> Try the form out; it can&apos;t be saved.
          </p>
        )}

        {portfolios && portfolios.length > 1 && portfolioUuid && (
          <PortfolioSelect portfolios={portfolios} value={portfolioUuid} onChange={setPortfolioUuid} label={isEdit ? "Portfolio" : "Add to portfolio"} />
        )}

        <div className="flex flex-wrap gap-3">
          {OPERATION_OPTIONS.map((op) => (
            <OperationButton
              key={op.value}
              label={op.label}
              icon={op.icon}
              active={form.operation === op.value}
              activeClasses={op.activeClasses}
              onClick={() => set("operation")(op.value)}
            />
          ))}
        </div>

        {isDividend && (
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Dividend type</p>
            <div className="flex gap-3">
              <PillButton
                label="Cash"
                active={form.dividendType === "cash"}
                activeClasses="border-blue-400 bg-blue-50 text-blue-700"
                onClick={() => setDividendType("cash")}
              />
              <PillButton
                label="In Kind"
                active={form.dividendType === "shares"}
                activeClasses="border-blue-400 bg-blue-50 text-blue-700"
                onClick={() => setDividendType("shares")}
              />
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 space-y-1.5">
            {errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-rose-700">{err}</span>
              </div>
            ))}
          </div>
        )}

        <AssetPicker value={pickedAsset} onChange={pickAsset} required />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField label="Date" type="date" value={form.date} onChange={set("date")} required />
          <InputField label="Time" type="time" value={form.time} onChange={set("time")} placeholder="Optional" />
          {showAmountField && (
            <InputField label="Amount" type="number" value={form.amount} onChange={set("amount")} placeholder="1500.00" required />
          )}
          {showQuantityPrice && (
            <>
              <InputField label="Quantity" type="number" value={form.quantity} onChange={set("quantity")} placeholder="10" required={requiresQuantityPrice} />
              <InputField label="Price" type="number" value={form.price} onChange={set("price")} placeholder="185.20" required={requiresQuantityPrice} />
            </>
          )}
          <InputField label="Currency" value={form.currency} onChange={set("currency")} placeholder="EUR" required />
          <InputField label="Fees" type="number" value={form.fees} onChange={set("fees")} placeholder="0" />
          <InputField label="Broker" value={form.broker} onChange={set("broker")} placeholder="Manual" />
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          {isEdit && onDelete && !readOnly ? (
            <button
              onClick={onDelete}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          ) : <span />}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={readOnly}
              title={readOnly ? DEMO_DISABLED_TITLE : undefined}
              className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-blue-600 transition-colors shadow-md shadow-slate-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900"
            >
              {isEdit ? "Save changes" : "Add transaction"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
