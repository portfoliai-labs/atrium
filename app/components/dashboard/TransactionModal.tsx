"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, AlertCircle, PlusCircle, Pencil, Trash2, ArrowRightLeft } from "lucide-react";
import { StandardTransaction } from "../../models/Report";
import { validateTransactions } from "../../lib/parser";
import type { Portfolio } from "../../models/Portfolio";
import type { RewardKind, TransactionOperation } from "../../models/Transaction";
import type { ManualAsset } from "../../models/ManualAsset";
import { manualAssetService } from "../../services/manualAssetService";
import { usePortfolio } from "../../context/PortfolioContext";
import {
  ACCRUED_INTEREST_OPERATIONS, CASH_OPERATIONS, INSTRUMENT_OPERATIONS, OPERATION_HINTS, OPERATION_LABELS,
  PRICE_REQUIRED, QUANTITY_REQUIRED, REWARD_KINDS, REWARD_KIND_LABELS, TAKES_QUANTITY, WITHHOLDING_OPERATIONS,
  isCashOperation,
} from "../../lib/operations";
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
  // A saved transaction stays what it is: one on a security keeps to the operations on one, a
  // cash movement to the cash ones (a PATCH can't add or drop the security).
  lockKind?: boolean;
  // A saved transaction on a security: moves some of its units to another portfolio.
  onTransfer?: () => void;
  // The form can be filled in but not saved (a demo account, see lib/demo).
  readOnly?: boolean;
}

// Colors mirror the operation badges in TransactionsSection.tsx (OPERATION_STYLES).
const GROUPS: { label: string; operations: TransactionOperation[]; active: string }[] = [
  { label: "Investments", operations: INSTRUMENT_OPERATIONS, active: "border-blue-400 bg-blue-50 text-blue-700" },
  { label: "Cash", operations: CASH_OPERATIONS, active: "border-amber-400 bg-amber-50 text-amber-800" },
];

type DividendType = "cash" | "shares";
type AssetSource = "listing" | "manual";

interface FormState {
  date: string;
  time: string;
  operation: TransactionOperation;
  // UI-only: whether a dividend is paid in cash or in kind ("shares" ⇔ quantity and price).
  dividendType: DividendType;
  // UI-only: a bond's quantity is its nominal and its price a % of it (a redemption's always).
  isBond: boolean;
  amount: string;
  quantity: string;
  price: string;
  currency: string;
  fees: string;
  // A listed security (census' listing, or a ticker for one recorded before listings) or one of
  // the user's manual assets.
  assetSource: AssetSource;
  listingId: string;
  ticker: string;
  isin: string;
  name: string;
  assetId: string;
  broker: string;
  withholdingTax: string;
  accruedInterest: string;
  counterAmount: string;
  counterCurrency: string;
  rewardKind: RewardKind | "";
}

const emptyForm: FormState = {
  date: "",
  time: "",
  operation: "buy",
  dividendType: "cash",
  isBond: false,
  amount: "",
  quantity: "",
  price: "",
  currency: "EUR",
  fees: "",
  assetSource: "listing",
  listingId: "",
  ticker: "",
  isin: "",
  name: "",
  assetId: "",
  broker: "Manual",
  withholdingTax: "",
  accruedInterest: "",
  counterAmount: "",
  counterCurrency: "",
  rewardKind: "",
};

// Pulls the "YYYY-MM-DD" and, if present, "HH:mm" straight out of the ISO string as text —
// deliberately not routed through `Date`, which would reinterpret a bare date (no time,
// no offset) as UTC midnight and could shift it by a day once displayed in local time.
function splitIsoDate(iso: string): { date: string; time: string } {
  const match = iso?.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
  if (!match) return { date: iso ?? "", time: "" };
  return { date: match[1], time: match[2] ?? "" };
}

const text = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? "" : String(v));

function toFormState(tx?: StandardTransaction): FormState {
  if (!tx) return emptyForm;
  const { date, time } = splitIsoDate(tx.date);
  // A saved bond trade reads back as one: its amount is the nominal × the price in %.
  const looksLikeBond = tx.operation === "redemption" || (
    (tx.operation === "buy" || tx.operation === "sell") && tx.quantity != null && tx.price != null && tx.price > 0
    && Math.abs(tx.quantity * tx.price / 100 - tx.amount) < Math.abs(tx.quantity * tx.price - tx.amount)
  );
  return {
    date,
    time,
    operation: tx.operation,
    dividendType: tx.operation === "dividend" && tx.quantity != null ? "shares" : "cash",
    isBond: looksLikeBond,
    amount: text(tx.amount),
    quantity: text(tx.quantity),
    price: text(tx.price),
    currency: tx.currency,
    fees: String(tx.fees ?? 0),
    assetSource: tx.assetId ? "manual" : "listing",
    listingId: tx.listingId ?? "",
    ticker: tx.ticker ?? "",
    isin: tx.isin ?? "",
    name: tx.name ?? "",
    assetId: tx.assetId ?? "",
    broker: tx.broker,
    withholdingTax: text(tx.withholdingTax),
    accruedInterest: text(tx.accruedInterest),
    counterAmount: text(tx.counterAmount),
    counterCurrency: tx.counterCurrency ?? "",
    rewardKind: tx.rewardKind ?? "",
  };
}

function InputField({
  label, value, onChange, type = "text", placeholder, required, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; hint?: string;
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
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function PillButton({
  label, active, activeClasses, onClick, disabled,
}: {
  label: string; active: boolean; activeClasses: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3.5 py-2 rounded-xl border-2 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? activeClasses : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
      }`}
    >
      {label}
    </button>
  );
}

const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

export function TransactionModal({
  mode, initial, onClose, onSave, onDelete, portfolios, defaultPortfolioUuid, lockKind = false, onTransfer, readOnly = false,
}: TransactionModalProps) {
  const { client } = usePortfolio();
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [portfolioUuid, setPortfolioUuid] = useState(initial?.portfolioUuid ?? defaultPortfolioUuid ?? portfolios?.[0]?.uuid);
  const [errors, setErrors] = useState<string[]>([]);
  const isEdit = mode === "edit";
  // The security is picked from the search, which fills in the currency too. A saved
  // transaction opens on the security it already has.
  const [pickedAsset, setPickedAsset] = useState<ListingRef | null>(() => {
    const saved = toFormState(initial);
    if (saved.assetId || (!saved.ticker && !saved.listingId)) return null;
    return { listingId: saved.listingId || undefined, ticker: saved.ticker, name: saved.name || saved.ticker, isin: saved.isin || null };
  });
  // The user's manual assets (a client's, on an advisor's view), once asked for.
  const [manualAssets, setManualAssets] = useState<ManualAsset[] | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);

  const op = form.operation;
  const cash = isCashOperation(op);
  const wantsManual = !cash && form.assetSource === "manual";
  useEffect(() => {
    if (!wantsManual || manualAssets !== null) return;
    let cancelled = false;
    manualAssetService.list(client?.uuid)
      .then((list) => { if (!cancelled) setManualAssets(list); })
      .catch((err) => { if (!cancelled) { setManualAssets([]); setManualError(err instanceof Error ? err.message : "Unable to load your manual assets."); } });
    return () => { cancelled = true; };
  }, [wantsManual, manualAssets, client?.uuid]);

  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const isDividend = op === "dividend";
  const isStockDividend = isDividend && form.dividendType === "shares";
  const bond = op === "redemption" || (form.isBond && (op === "buy" || op === "sell"));
  const showQuantityPrice = TAKES_QUANTITY.includes(op) && (!isDividend || isStockDividend);
  const quantityRequired = QUANTITY_REQUIRED.includes(op) || isStockDividend;
  const priceRequired = PRICE_REQUIRED.includes(op) || isStockDividend;

  const quantity = num(form.quantity);
  const price = num(form.price);
  // quantity × price, a bond's price being a % of its nominal.
  const computed = quantity != null && price != null && Number.isFinite(quantity) && Number.isFinite(price)
    ? (bond ? quantity * price / 100 : quantity * price)
    : null;
  // How the amount comes: worked out (buy, sell, a dividend in kind), typed with the worked-out
  // one as its default (a transfer in's total cost, a redemption's cash, a reward's value), left
  // out when blank (a transfer out's), or typed.
  const amountMode: "computed" | "defaulted" | "optional" | "typed" =
    op === "buy" || op === "sell" || isStockDividend ? "computed"
      : op === "transfer_in" || op === "redemption" || op === "reward" ? "defaulted"
        : op === "transfer_out" ? "optional"
          : "typed";
  const amountLabel = op === "transfer_in" ? "Total cost" : op === "redemption" ? "Cash received" : op === "reward" ? "Value received"
    : op === "fx_conversion" ? "Amount changed" : WITHHOLDING_OPERATIONS.includes(op) ? "Gross amount" : "Amount";

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
      assetId: "",
      currency: listing?.currency ?? prev.currency,
    }));
  };

  const pickManual = (assetId: string) => {
    const asset = manualAssets?.find((a) => a.assetId === assetId);
    setForm(prev => ({
      ...prev,
      assetId,
      name: asset?.name ?? "",
      listingId: "",
      ticker: "",
      isin: "",
      currency: asset?.currency ?? prev.currency,
    }));
  };

  const setSource = (assetSource: AssetSource) => {
    if (assetSource === form.assetSource) return;
    setPickedAsset(null);
    setForm(prev => ({ ...prev, assetSource, assetId: "", listingId: "", ticker: "", isin: "", name: "" }));
  };

  const handleSubmit = () => {
    const amountTyped = num(form.amount);
    const amount = amountMode === "computed" ? (computed ?? NaN)
      : amountMode === "defaulted" ? (amountTyped ?? computed ?? NaN)
        : amountMode === "optional" ? (amountTyped ?? NaN)
          : (amountTyped ?? NaN);

    const isin = form.isin.trim().toUpperCase();
    const ticker = form.ticker.trim().toUpperCase();
    const manual = !cash && form.assetSource === "manual" && form.assetId;

    const transaction: StandardTransaction = {
      // Locally-generated key, not shown to the user.
      id: initial?.id || ticker || form.assetId || `${op}-${form.date}-${Math.random().toString(36).slice(2, 8)}`,
      date: form.time ? `${form.date}T${form.time}` : form.date,
      operation: op,
      amount,
      quantity: showQuantityPrice ? quantity : null,
      price: showQuantityPrice ? price : null,
      currency: form.currency.trim().toUpperCase(),
      fees: form.fees.trim() === "" ? 0 : Number(form.fees),
      broker: form.broker.trim() || "Manual",
      ticker: cash || manual ? "" : ticker,
      ...(!cash && !manual && isin ? { isin } : {}),
      ...(!cash && !manual && form.listingId ? { listingId: form.listingId, name: form.name } : {}),
      ...(manual ? { assetId: form.assetId, name: form.name } : {}),
      ...(WITHHOLDING_OPERATIONS.includes(op) && form.withholdingTax.trim() !== "" ? { withholdingTax: num(form.withholdingTax) } : {}),
      ...(ACCRUED_INTEREST_OPERATIONS.includes(op) && form.accruedInterest.trim() !== "" ? { accruedInterest: num(form.accruedInterest) } : {}),
      ...(op === "fx_conversion" ? { counterAmount: num(form.counterAmount), counterCurrency: form.counterCurrency.trim().toUpperCase() } : {}),
      ...(op === "reward" && form.rewardKind ? { rewardKind: form.rewardKind } : {}),
      ...(portfolios && portfolioUuid ? { portfolioUuid } : {}),
    };

    const { errors: validationErrors } = validateTransactions([transaction]);
    // A worked-out amount isn't a field here: its quantity and price errors are the ones to fix.
    const relevant = amountMode === "computed" ? validationErrors.filter(e => e.field !== "amount") : validationErrors;
    const found = relevant.map(e => (e.field === "ticker" && wantsManual && !form.assetId ? "Pick a manual asset." : e.message));

    if (found.length > 0) {
      setErrors([...new Set(found)]);
      return;
    }

    onSave(transaction);
    onClose();
  };

  const savedKindCash = initial ? isCashOperation(initial.operation) : false;

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

        <div className="space-y-3">
          {GROUPS.filter((g) => !lockKind || (g.operations === CASH_OPERATIONS) === savedKindCash).map((g) => (
            <div key={g.label}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{g.label}</p>
              <div className="flex flex-wrap gap-2">
                {g.operations.map((o) => (
                  <PillButton key={o} label={OPERATION_LABELS[o]} active={op === o} activeClasses={g.active} onClick={() => set("operation")(o)} />
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-500">{OPERATION_HINTS[op]}</p>
        </div>

        {isDividend && (
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Dividend type</p>
            <div className="flex gap-3">
              <PillButton label="Cash" active={form.dividendType === "cash"} activeClasses="border-blue-400 bg-blue-50 text-blue-700" onClick={() => setDividendType("cash")} />
              <PillButton label="In Kind" active={form.dividendType === "shares"} activeClasses="border-blue-400 bg-blue-50 text-blue-700" onClick={() => setDividendType("shares")} />
            </div>
          </div>
        )}

        {op === "reward" && (
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reward from <span className="text-rose-500">*</span></p>
            <div className="flex gap-3">
              {REWARD_KINDS.map((k) => (
                <PillButton key={k} label={REWARD_KIND_LABELS[k]} active={form.rewardKind === k} activeClasses="border-blue-400 bg-blue-50 text-blue-700" onClick={() => set("rewardKind")(k)} />
              ))}
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

        {!cash && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <PillButton label="Listed security" active={form.assetSource === "listing"} activeClasses="border-slate-400 bg-slate-50 text-slate-800" onClick={() => setSource("listing")} />
              <PillButton label="Manual asset" active={form.assetSource === "manual"} activeClasses="border-slate-400 bg-slate-50 text-slate-800" onClick={() => setSource("manual")} />
            </div>
            {form.assetSource === "listing" ? (
              <AssetPicker value={pickedAsset} onChange={pickAsset} required />
            ) : (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Manual asset <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.assetId}
                  onChange={(e) => pickManual(e.target.value)}
                  disabled={manualAssets === null}
                  className="w-full h-11 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold outline-none focus:ring-4 focus:ring-slate-50 focus:border-slate-300"
                >
                  <option value="">{manualAssets === null ? "Loading…" : manualAssets.length === 0 ? "No manual assets yet" : "Pick one"}</option>
                  {/* One saved on an asset no longer listed keeps it. */}
                  {form.assetId && manualAssets && !manualAssets.some((a) => a.assetId === form.assetId) && (
                    <option value={form.assetId}>{form.name || form.assetId}</option>
                  )}
                  {manualAssets?.map((a) => <option key={a.uuid} value={a.assetId}>{a.name} · {a.currency}</option>)}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  {manualError ?? "An investment without a market price (unlisted shares, private equity, a loan, physical gold), valued by hand. Add one under Manual assets."}
                </p>
              </div>
            )}
          </div>
        )}

        {(op === "buy" || op === "sell") && (
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
            <input type="checkbox" className="accent-blue-600 w-4 h-4" checked={form.isBond} onChange={(e) => set("isBond")(e.target.checked)} />
            A bond: the quantity is the nominal, the price a % of it
          </label>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField label="Date" type="date" value={form.date} onChange={set("date")} required />
          <InputField label="Time" type="time" value={form.time} onChange={set("time")} placeholder="Optional" />
          {showQuantityPrice && (
            <>
              <InputField label={bond ? "Nominal" : "Quantity"} type="number" value={form.quantity} onChange={set("quantity")} placeholder={bond ? "10000" : "10"} required={quantityRequired} />
              <InputField
                label={bond ? "Price (% of nominal)" : op === "transfer_in" ? "Price per unit" : "Price"}
                type="number"
                value={form.price}
                onChange={set("price")}
                placeholder={bond ? "100" : "185.20"}
                required={priceRequired}
              />
            </>
          )}
          {amountMode !== "computed" && (
            <InputField
              label={amountLabel}
              type="number"
              value={form.amount}
              onChange={set("amount")}
              placeholder={amountMode === "defaulted" && computed != null ? computed.toFixed(2) : amountMode === "optional" ? "Optional" : "1500.00"}
              required={amountMode === "typed"}
              hint={amountMode === "defaulted" ? (op === "reward" ? "Left blank: quantity × price. It can be 0." : "Left blank: quantity × price.") : undefined}
            />
          )}
          <InputField label={op === "fx_conversion" ? "Currency changed" : "Currency"} value={form.currency} onChange={set("currency")} placeholder="EUR" required />
          {op === "fx_conversion" && (
            <>
              <InputField label="Amount received" type="number" value={form.counterAmount} onChange={set("counterAmount")} placeholder="1080.00" required />
              <InputField label="Currency received" value={form.counterCurrency} onChange={set("counterCurrency")} placeholder="USD" required />
            </>
          )}
          {WITHHOLDING_OPERATIONS.includes(op) && (
            <InputField label="Withholding tax" type="number" value={form.withholdingTax} onChange={set("withholdingTax")} placeholder="0" hint="Withheld at source, from 0 to the gross amount." />
          )}
          {ACCRUED_INTEREST_OPERATIONS.includes(op) && form.isBond && (
            <InputField label="Accrued interest" type="number" value={form.accruedInterest} onChange={set("accruedInterest")} placeholder="0" hint="The bond's accrued interest paid or received with the trade." />
          )}
          <InputField label="Fees" type="number" value={form.fees} onChange={set("fees")} placeholder="0" />
          <InputField label="Broker" value={form.broker} onChange={set("broker")} placeholder="Manual" />
        </div>

        {amountMode === "computed" && computed != null && (
          <p className="text-xs text-slate-500">
            Amount: <span className="font-bold tabular-nums text-slate-800">{computed.toLocaleString(undefined, { maximumFractionDigits: 2 })} {form.currency}</span>
            {bond ? " (nominal × price %)" : " (quantity × price)"}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
          <span className="flex items-center gap-1">
            {isEdit && onDelete && !readOnly && (
              <button
                onClick={onDelete}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
            {isEdit && onTransfer && !readOnly && (
              <button
                onClick={onTransfer}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Move units
              </button>
            )}
          </span>
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
