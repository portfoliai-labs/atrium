// components/dashboard/wallets/WalletCards.tsx
"use client";

import { useState } from "react";
import { CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import { useWallets } from "../../../context/WalletsContext";
import { useCards } from "../../../hooks/useAccounts";
import { accountService } from "../../../services/accountService";
import { formatCurrency } from "../../../lib/format";
import { errorText } from "../../../lib/wallets";
import type { Card, CardKind, CardNetwork } from "../../../models/Account";
import type { Wallet } from "../../../models/Wallet";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { ConfirmDialog } from "../ConfirmDialog";
import { DEMO_DISABLED_TITLE } from "../../preview/DemoBanner";
import { DialogShell, Field, INPUT, parseAmount } from "./WalletDialogs";

export const CARD_KIND_LABELS: Record<CardKind, string> = { debit: "Debit", credit: "Credit", prepaid: "Prepaid" };

export const CARD_NETWORK_LABELS: Record<CardNetwork, string> = {
  visa: "Visa", mastercard: "Mastercard", maestro: "Maestro", amex: "American Express", diners: "Diners Club",
  discover: "Discover", jcb: "JCB", unionpay: "UnionPay", other: "Other",
};

const CARD_NETWORKS = Object.keys(CARD_NETWORK_LABELS) as CardNetwork[];

/** "Visa •••• 4242 · 12/30", the card's own name first when it has one. */
export const cardLabel = (c: Card) =>
  [c.name, `${CARD_NETWORK_LABELS[c.network]} •••• ${c.lastDigits}`, `${String(c.expiryMonth).padStart(2, "0")}/${String(c.expiryYear).slice(-2)}`]
    .filter(Boolean).join(" · ");

/**
 * The kinds of card a wallet takes: a credit card on a credit card's wallet, the others on one
 * that's neither that nor cash. None on an address' stablecoin (read from the chain).
 */
export const cardKindsFor = (wallet: Pick<Wallet, "kind">): CardKind[] =>
  wallet.kind === "credit_card" ? ["credit"] : wallet.kind === "cash" || wallet.kind === "crypto" ? [] : ["debit", "prepaid"];

// ── A card ──

/** What's typed in the expiry field, as printed on a card: MM/YY, the slash put in as one types. */
function formatExpiry(typed: string): string {
  const digits = typed.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/** An MM/YY expiry's month and four-digit year; [0, 0] while it isn't one. */
function parseExpiry(expiry: string): [number, number] {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!match) return [0, 0];
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? [month, 2000 + Number(match[2])] : [0, 0];
}

/**
 * A card added to a wallet, or one changed: what tells it apart (its own name, network, last four
 * digits), its expiry and a credit card's limit. Never its number nor its CVC: the field takes four
 * digits only. Its kind is the wallet's to say and doesn't change.
 */
export function CardDialog({ wallet, card, onClose, onSaved }: { wallet: Wallet; card?: Card; onClose: () => void; onSaved: () => void }) {
  const kinds = cardKindsFor(wallet);
  const [kind, setKind] = useState<CardKind>(card?.kind ?? kinds[0] ?? "debit");
  const [name, setName] = useState(card?.name ?? "");
  const [network, setNetwork] = useState<CardNetwork>(card?.network ?? "visa");
  const [lastDigits, setLastDigits] = useState(card?.lastDigits ?? "");
  const [expiry, setExpiry] = useState(card ? `${String(card.expiryMonth).padStart(2, "0")}/${String(card.expiryYear).slice(-2)}` : "");
  const [limit, setLimit] = useState(card?.creditLimit != null ? String(card.creditLimit) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [month, year] = parseExpiry(expiry);
  const limitAmount = limit.trim() ? parseAmount(limit) : null;
  const valid = /^\d{4}$/.test(lastDigits) && year > 0 && month > 0 && (!limit.trim() || (limitAmount !== null && Number(limitAmount) > 0));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!card) {
        await accountService.createCard({
          walletUuid: wallet.uuid, kind, network, lastDigits, expiryMonth: month, expiryYear: year, name: name.trim() || null,
          creditLimit: kind === "credit" ? limitAmount : null,
        });
      } else {
        // Only what changed; "" clears the name, 0 the limit.
        await accountService.updateCard(card.uuid, {
          ...(name.trim() !== (card.name ?? "") ? { name: name.trim() } : {}),
          ...(network !== card.network ? { network } : {}),
          ...(lastDigits !== card.lastDigits ? { lastDigits } : {}),
          ...(month !== card.expiryMonth ? { expiryMonth: month } : {}),
          ...(year !== card.expiryYear ? { expiryYear: year } : {}),
          ...(card.kind === "credit" && Number(limitAmount ?? 0) !== (card.creditLimit ?? 0) ? { creditLimit: limitAmount ?? 0 } : {}),
        });
      }
      onSaved();
    } catch (err) {
      setError(errorText(err, "Unable to save this card."));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      icon={card ? <Pencil className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
      title={card ? "Edit card" : "New card"}
      subtitle={`${wallet.name}: the wallet it spends from`}
      busy={busy}
      error={error}
      submitLabel={card ? "Save" : "Add"}
      canSubmit={valid}
      onSubmit={submit}
      onClose={onClose}
    >
      <p className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-[13px] text-slate-600">
        Only the last four digits are kept: never the card number nor its security code.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Kind" hint={card ? "Fixed: another kind is another card." : undefined}>
          <select value={kind} onChange={(e) => setKind(e.target.value as CardKind)} disabled={!!card || kinds.length < 2} className={INPUT}>
            {(card ? [card.kind] : kinds).map((k) => <option key={k} value={k}>{CARD_KIND_LABELS[k]}</option>)}
          </select>
        </Field>
        <Field label="Network">
          <select value={network} onChange={(e) => setNetwork(e.target.value as CardNetwork)} className={INPUT}>
            {CARD_NETWORKS.map((n) => <option key={n} value={n}>{CARD_NETWORK_LABELS[n]}</option>)}
          </select>
        </Field>
        <Field label="Last four digits">
          <input
            autoFocus={!card}
            value={lastDigits}
            onChange={(e) => setLastDigits(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="4242"
            className={INPUT}
          />
        </Field>
        <Field label="Expiry">
          <input
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="MM/YY"
            className={INPUT}
            aria-invalid={expiry.length === 5 && month === 0}
          />
        </Field>
        <Field label="Name" className={kind === "credit" ? "" : "sm:col-span-2"}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Optional" className={INPUT} />
        </Field>
        {kind === "credit" && (
          <Field label={`Limit (${wallet.currency})`}>
            <input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" placeholder="Optional" className={INPUT} aria-invalid={!!limit.trim() && limitAmount === null} />
          </Field>
        )}
      </div>
    </DialogShell>
  );
}

// ── A wallet's page ──

/**
 * A wallet's Cards page: the cards that spend from it, each to edit or delete, and a new one. The
 * movements a deleted card made stay, no longer naming it.
 */
export function WalletCards({ wallet }: { wallet: Wallet }) {
  const { sample, changed } = useWallets();
  const read = useCards();
  const [editing, setEditing] = useState<Card | "new" | null>(null);
  const [deleting, setDeleting] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kinds = cardKindsFor(wallet);
  const lock = sample ? DEMO_DISABLED_TITLE : wallet.archived ? "An archived wallet is read only" : kinds.length === 0 ? "This kind of wallet takes no card" : undefined;

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await accountService.removeCard(deleting.uuid);
      setDeleting(null);
      changed();
    } catch (err) {
      setError(errorText(err, "Unable to delete this card."));
    } finally {
      setBusy(false);
    }
  };

  if (read.isPending) return <p className="text-[13px] text-[#857e78]">Loading…</p>;
  if (read.isError) return <p className="text-[13px] font-semibold text-rose-600">{errorText(read.error, "Unable to load the cards.")}</p>;
  const cards = read.data.filter((c) => c.walletUuid === wallet.uuid);

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing("new")}
          disabled={!!lock}
          title={lock}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#1c1917] text-white hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:hover:bg-[#1c1917] disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" /> New card
        </button>
      </div>

      <Module>
        <ModuleHead title="Cards" desc="The cards that spend from this wallet. Only their last four digits are kept: never the number nor the security code." />
        <div className={MODULE_BODY}>
          {cards.length === 0 ? (
            <p className="text-[12.5px] text-[#857e78]">No card yet.</p>
          ) : (
            <ul className="divide-y divide-[#EEE9DD]">
              {cards.map((c) => (
                <li key={c.uuid} className="flex items-center gap-3 py-3">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.expired ? "bg-rose-50 text-rose-600" : "bg-[#C49A3C]/10 text-[#C49A3C]"}`}>
                    <CreditCard className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-slate-800">
                      {cardLabel(c)}
                      {c.expired && (
                        <span className="ml-2 px-1.5 py-0.5 rounded-full bg-rose-50 text-[9px] font-black uppercase tracking-wider text-rose-600 align-middle">Expired</span>
                      )}
                    </span>
                    <span className="block text-[11.5px] text-slate-500">
                      {[CARD_KIND_LABELS[c.kind], c.creditLimit != null ? `limit ${formatCurrency(c.creditLimit, wallet.currency, 0)}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {!sample && !wallet.archived && (
                    <span className="flex gap-1">
                      <button type="button" onClick={() => setEditing(c)} aria-label="Edit card" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => { setError(null); setDeleting(c); }} aria-label="Delete card" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Module>

      {editing && (
        <CardDialog
          wallet={wallet}
          card={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); changed(); }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this card?"
          description={`${cardLabel(deleting)} is removed from ${wallet.name}. The movements it made stay, no longer naming it.`}
          confirming={busy}
          error={error}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
