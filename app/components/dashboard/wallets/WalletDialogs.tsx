// components/dashboard/wallets/WalletDialogs.tsx
"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, Loader2, Pencil, Plus, X } from "lucide-react";
import { walletService } from "../../../services/walletService";
import {
  CATEGORY_LABELS, COMMON_CURRENCIES, INCOME_CATEGORIES, KIND_LABELS, SPENDING_CATEGORIES, WALLET_COLORS, WALLET_KINDS,
  errorText, today,
} from "../../../lib/wallets";
import type { Movement, MovementCategory, Wallet, WalletKind } from "../../../models/Wallet";

// ── The pieces every dialog here is made of ──

export const INPUT = "w-full h-11 px-3.5 rounded-xl bg-white text-sm font-semibold text-slate-900 outline-none border border-slate-200 placeholder:text-slate-400 placeholder:font-normal focus:border-[#C49A3C]/60 focus:ring-4 focus:ring-[#C49A3C]/10 disabled:bg-slate-50 disabled:text-slate-400";

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="block text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

/** The shell every wallet dialog shares (NewPortfolioDialog's): icon, title, body, buttons. */
export function DialogShell({ icon, title, subtitle, busy, error, submitLabel, canSubmit, onSubmit, onClose, wide, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  busy: boolean;
  error: string | null;
  submitLabel: string;
  canSubmit: boolean;
  onSubmit: () => void;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => !busy && onClose()}>
      <form
        className={`bg-white rounded-4xl shadow-2xl border border-slate-200 w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[calc(100vh-2rem)] overflow-y-auto p-6 md:p-8 space-y-5`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit && !busy) onSubmit();
        }}
        onKeyDown={(e) => { if (e.key === "Escape" && !busy) onClose(); }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#C49A3C]/10 rounded-xl shrink-0 text-[#C49A3C]">{icon}</div>
            <div>
              <h3 className="text-lg font-black text-slate-900">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0 disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !canSubmit}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#1c1917] hover:bg-[#C49A3C] transition-colors disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/** "1.234,56" or "1234.56" → "1234.56"; null when it isn't a number. Kept a string, to stay exact. */
export function parseAmount(text: string): string | null {
  let s = text.trim().replace(/\s/g, "");
  if (!s) return null;
  // The last of "." and "," is the decimal mark; the other groups thousands.
  const decimal = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  if (decimal >= 0) s = s.slice(0, decimal).replace(/[.,]/g, "") + "." + s.slice(decimal + 1);
  return /^-?\d+(\.\d+)?$/.test(s) ? s : null;
}

/** A movement's or a wallet's figure, as the field shows it. */
const amountText = (v: number) => String(Math.abs(v));

// ── A wallet ──

/**
 * New wallet, or a wallet's settings: name, kind, institution, currency (only while it has no
 * movements), opening balance and day (no movement can be booked before it), colour.
 */
export function WalletFormDialog({ wallet, takenColors = [], onClose, onSaved }: {
  wallet?: Wallet;
  // The other wallets' colours: a new one gets the first free one.
  takenColors?: string[];
  onClose: () => void;
  onSaved: (wallet: Wallet) => void;
}) {
  const [name, setName] = useState(wallet?.name ?? "");
  const [kind, setKind] = useState<WalletKind>(wallet?.kind ?? "current_account");
  const [institution, setInstitution] = useState(wallet?.institution ?? "");
  const [currency, setCurrency] = useState(wallet?.currency ?? "EUR");
  const [opening, setOpening] = useState(wallet ? String(wallet.openingBalance) : "0");
  const [openingDate, setOpeningDate] = useState(wallet?.openingDate ?? today());
  const [color, setColor] = useState(wallet?.color ?? WALLET_COLORS.find((c) => !takenColors.includes(c)) ?? WALLET_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMovements = !!wallet?.lastMovementDate;
  const openingAmount = parseAmount(opening);
  const code = currency.trim().toUpperCase();
  const valid = name.trim().length > 0 && openingAmount !== null && /^[A-Z]{3}$/.test(code) && !!openingDate;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      let saved: Wallet;
      if (!wallet) {
        saved = await walletService.create({
          name: name.trim(), kind, currency: code, institution: institution.trim() || null,
          openingBalance: openingAmount!, openingDate, color,
        });
      } else {
        // Only what changed; "" clears the institution.
        saved = await walletService.update(wallet.uuid, {
          ...(name.trim() !== wallet.name ? { name: name.trim() } : {}),
          ...(kind !== wallet.kind ? { kind } : {}),
          ...(institution.trim() !== (wallet.institution ?? "") ? { institution: institution.trim() } : {}),
          ...(code !== wallet.currency ? { currency: code } : {}),
          ...(Number(openingAmount) !== wallet.openingBalance ? { openingBalance: openingAmount! } : {}),
          ...(openingDate !== wallet.openingDate ? { openingDate } : {}),
          ...(color !== wallet.color ? { color } : {}),
        });
      }
      onSaved(saved);
    } catch (err) {
      setError(errorText(err, wallet ? "Unable to save this wallet." : "Unable to create this wallet."));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      icon={wallet ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      title={wallet ? `Edit ${wallet.name}` : "New wallet"}
      subtitle={wallet ? undefined : "An account, a card, savings or cash: what comes in and goes out of it."}
      busy={busy}
      error={error}
      submitLabel={wallet ? "Save" : "Create"}
      canSubmit={valid}
      onSubmit={submit}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name" className="sm:col-span-2">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Everyday account" className={INPUT} />
        </Field>
        <Field label="Kind">
          <select value={kind} onChange={(e) => setKind(e.target.value as WalletKind)} className={INPUT}>
            {WALLET_KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
        </Field>
        <Field label="Bank or provider">
          <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Optional" className={INPUT} />
        </Field>
        <Field label="Currency" hint={hasMovements ? "Fixed once it has movements." : undefined}>
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            disabled={hasMovements}
            maxLength={3}
            list="wallet-currencies"
            className={INPUT}
          />
          <datalist id="wallet-currencies">{COMMON_CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Opening balance" hint={kind === "credit_card" ? "Negative while something is owed." : undefined}>
          <input value={opening} onChange={(e) => setOpening(e.target.value)} inputMode="decimal" className={INPUT} aria-invalid={openingAmount === null} />
        </Field>
        <Field label="Opening day" hint="No movement can be booked before it." className="sm:col-span-2">
          <input
            type="date"
            value={openingDate}
            max={wallet?.lastMovementDate ?? undefined}
            onChange={(e) => setOpeningDate(e.target.value)}
            className={INPUT}
          />
        </Field>
      </div>
      <div className="space-y-1.5">
        <span className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Colour</span>
        <div className="flex flex-wrap gap-2">
          {WALLET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              aria-pressed={c === color}
              className={`h-8 w-8 rounded-full border-2 transition-transform ${c === color ? "border-slate-900 scale-110" : "border-white shadow-sm"}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </DialogShell>
  );
}

// ── A movement ──

/**
 * A movement added by hand to a wallet, or one changed: money in or out, the amount, the day,
 * what it was, its category (offered by direction), the counterparty and a note. A transfer's leg
 * keeps its day, amount and category (unlink it first); a category is cleared with categorize.
 */
export function MovementDialog({ wallet, movement, onClose, onSaved }: {
  wallet: Wallet;
  movement?: Movement;
  onClose: () => void;
  onSaved: () => void;
}) {
  const leg = !!movement?.transferUuid;
  const [direction, setDirection] = useState<"in" | "out">(movement && movement.amount > 0 ? "in" : "out");
  const [amount, setAmount] = useState(movement ? amountText(movement.amount) : "");
  const [bookedOn, setBookedOn] = useState(movement?.bookedOn ?? (today() < wallet.openingDate ? wallet.openingDate : today()));
  const [description, setDescription] = useState(movement?.description ?? "");
  const [category, setCategory] = useState<MovementCategory | "">(movement?.category ?? "");
  const [counterparty, setCounterparty] = useState(movement?.counterparty ?? "");
  const [note, setNote] = useState(movement?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseAmount(amount);
  const signed = parsed === null || Number(parsed) === 0 ? null : `${direction === "out" ? "-" : ""}${parsed.replace(/^-/, "")}`;
  const valid = signed !== null && description.trim().length > 0 && !!bookedOn && bookedOn >= wallet.openingDate;
  const offered = direction === "in" ? INCOME_CATEGORIES : SPENDING_CATEGORIES;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const chosen = category || null;
    try {
      if (!movement) {
        await walletService.addMovements(wallet.uuid, [{
          bookedOn, description: description.trim(), amount: signed!, category: chosen,
          counterparty: counterparty.trim() || null, note: note.trim() || null,
        }]);
      } else {
        // Only what changed; "" clears the counterparty or the note.
        const changes = {
          ...(description.trim() !== movement.description ? { description: description.trim() } : {}),
          ...(counterparty.trim() !== (movement.counterparty ?? "") ? { counterparty: counterparty.trim() } : {}),
          ...(note.trim() !== (movement.note ?? "") ? { note: note.trim() } : {}),
          ...(!leg && bookedOn !== movement.bookedOn ? { bookedOn } : {}),
          ...(!leg && Number(signed) !== movement.amount ? { amount: signed! } : {}),
          ...(!leg && chosen && chosen !== movement.category ? { category: chosen } : {}),
        };
        if (Object.keys(changes).length > 0) await walletService.updateMovement(movement.uuid, changes);
        if (!leg && !chosen && movement.category) await walletService.categorize([movement.uuid], null);
      }
      onSaved();
    } catch (err) {
      setError(errorText(err, "Unable to save this movement."));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      icon={movement ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      title={movement ? "Edit movement" : "New movement"}
      subtitle={`${wallet.name} · ${wallet.currency}`}
      busy={busy}
      error={error}
      submitLabel={movement ? "Save" : "Add"}
      canSubmit={valid}
      onSubmit={submit}
      onClose={onClose}
    >
      {leg && (
        <p className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-[13px] text-slate-600">
          This is one side of a transfer: its day and amount are the transfer&apos;s. To change them, unlink the transfer first.
        </p>
      )}
      <div role="group" aria-label="Direction" className="grid grid-cols-2 gap-2">
        {(["out", "in"] as const).map((d) => (
          <button
            key={d}
            type="button"
            disabled={leg}
            aria-pressed={direction === d}
            onClick={() => {
              setDirection(d);
              if (category && !(d === "in" ? INCOME_CATEGORIES : SPENDING_CATEGORIES).includes(category)) setCategory("");
            }}
            className={`h-10 rounded-xl text-sm font-bold border transition-colors disabled:opacity-60 ${
              direction === d
                ? d === "in" ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-rose-50 border-rose-300 text-rose-700"
                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {d === "in" ? "Money in" : "Money out"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={`Amount (${wallet.currency})`}>
          <input autoFocus={!movement} value={amount} onChange={(e) => setAmount(e.target.value)} disabled={leg} inputMode="decimal" placeholder="0.00" className={INPUT} />
        </Field>
        <Field label="Day" hint={bookedOn < wallet.openingDate ? "Before the wallet's opening day." : undefined}>
          <input type="date" value={bookedOn} min={wallet.openingDate} onChange={(e) => setBookedOn(e.target.value)} disabled={leg} className={INPUT} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="Groceries at the market" className={INPUT} />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value as MovementCategory | "")} disabled={leg} className={INPUT}>
            <option value="">Uncategorised</option>
            {offered.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </Field>
        <Field label="Counterparty">
          <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Optional" className={INPUT} />
        </Field>
        <Field label="Note" className="sm:col-span-2">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Optional" className={`${INPUT} h-auto py-2.5 resize-none`} />
        </Field>
      </div>
    </DialogShell>
  );
}

// ── A transfer ──

/**
 * Money moved between two of the user's wallets: neither income nor spending across them. In two
 * currencies, what arrives is asked too.
 */
export function TransferDialog({ wallets, from: initialFrom, onClose, onSaved }: {
  // The wallets that take writes (not archived).
  wallets: Wallet[];
  from?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [from, setFrom] = useState(initialFrom ?? wallets[0]?.uuid ?? "");
  const [to, setTo] = useState(wallets.find((w) => w.uuid !== (initialFrom ?? wallets[0]?.uuid))?.uuid ?? "");
  const [bookedOn, setBookedOn] = useState(today());
  const [amount, setAmount] = useState("");
  const [received, setReceived] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const source = wallets.find((w) => w.uuid === from);
  const target = wallets.find((w) => w.uuid === to);
  const crossCurrency = !!source && !!target && source.currency !== target.currency;
  const parsed = parseAmount(amount);
  const parsedReceived = parseAmount(received);
  const latestOpening = [source?.openingDate ?? "", target?.openingDate ?? ""].sort().at(-1)!;
  const valid = !!source && !!target && from !== to && parsed !== null && Number(parsed) > 0 && !!bookedOn
    && bookedOn >= latestOpening && (!crossCurrency || (parsedReceived !== null && Number(parsedReceived) > 0));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await walletService.transfer({
        fromWalletUuid: from, toWalletUuid: to, bookedOn, amount: parsed!,
        ...(crossCurrency ? { receivedAmount: parsedReceived! } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      onSaved();
    } catch (err) {
      setError(errorText(err, "Unable to make this transfer."));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      icon={<ArrowLeftRight className="h-5 w-5" />}
      title="Transfer"
      subtitle="Between two of your wallets: neither income nor spending."
      busy={busy}
      error={error}
      submitLabel="Transfer"
      canSubmit={valid}
      onSubmit={submit}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="From">
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={INPUT}>
            {wallets.map((w) => <option key={w.uuid} value={w.uuid}>{w.name} · {w.currency}</option>)}
          </select>
        </Field>
        <Field label="To">
          <select value={to} onChange={(e) => setTo(e.target.value)} className={INPUT}>
            {wallets.filter((w) => w.uuid !== from).map((w) => <option key={w.uuid} value={w.uuid}>{w.name} · {w.currency}</option>)}
          </select>
        </Field>
        <Field label={`Amount${source ? ` (${source.currency})` : ""}`}>
          <input autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className={INPUT} />
        </Field>
        {crossCurrency ? (
          <Field label={`Received (${target!.currency})`}>
            <input value={received} onChange={(e) => setReceived(e.target.value)} inputMode="decimal" placeholder="0.00" className={INPUT} />
          </Field>
        ) : (
          <Field label="Day" hint={bookedOn < latestOpening ? "Before a wallet's opening day." : undefined}>
            <input type="date" value={bookedOn} min={latestOpening} onChange={(e) => setBookedOn(e.target.value)} className={INPUT} />
          </Field>
        )}
        {crossCurrency && (
          <Field label="Day" hint={bookedOn < latestOpening ? "Before a wallet's opening day." : undefined}>
            <input type="date" value={bookedOn} min={latestOpening} onChange={(e) => setBookedOn(e.target.value)} className={INPUT} />
          </Field>
        )}
        <Field label="Description" className={crossCurrency ? "" : "sm:col-span-2"}>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder={target ? `Transfer to ${target.name}` : "Optional"} className={INPUT} />
        </Field>
      </div>
    </DialogShell>
  );
}
