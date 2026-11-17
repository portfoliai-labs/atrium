// components/dashboard/wallets/TransferSuggestions.tsx
"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowLeftRight, ChevronRight, Loader2 } from "lucide-react";
import { useWalletQuery, useWallets } from "../../../context/WalletsContext";
import { walletService } from "../../../services/walletService";
import { formatCurrency } from "../../../lib/format";
import { dayLabel, errorText, walletColor } from "../../../lib/wallets";
import type { Movement, TransferSuggestion, TransferSuggestionReason, Wallet } from "../../../models/Wallet";

const REASON_LABELS: Record<TransferSuggestionReason, string> = {
  own_iban: "The bank names your other account",
  sole_candidate: "The only match",
  several_candidates: "One of several matches",
  different_currencies: "Two currencies, at the day's rate",
  stablecoin_purchase: "A stablecoin bought",
};

const daysApart = (days: number) => (days === 0 ? "Same day" : days === 1 ? "1 day apart" : `${days} days apart`);

/** The suggestions, read once for every module that asks (the badge, the page). */
function useTransferSuggestions() {
  return useWalletQuery(["transferSuggestions"], (source) => source.transferSuggestions());
}

/**
 * The Transactions' badge: how many transfers wait to be confirmed (every wallet's pending, or
 * those `scope` is in), opening their page; nothing when none wait or the API has none to give.
 */
export function TransferSuggestionsBadge({ scope, onOpen }: { scope: string | null; onOpen: () => void }) {
  const read = useTransferSuggestions();
  const page = read.data;
  const count = !page ? 0 : scope === null ? page.pending : page.items.filter((s) => involves(s, scope)).length;
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-5 py-3.5 rounded-3xl bg-[#C49A3C]/10 hover:bg-[#C49A3C]/15 transition-colors text-left"
    >
      <ArrowLeftRight className="h-5 w-5 text-[#9A7A2E] shrink-0" />
      <span className="flex-1 text-sm font-black text-slate-900">
        {count === 1 ? "1 transfer to confirm" : `${count} transfers to confirm`}
      </span>
      <ChevronRight className="h-4 w-4 text-slate-400" />
    </button>
  );
}

const involves = (s: TransferSuggestion, walletUuid: string) =>
  s.outgoing.walletUuid === walletUuid || s.incoming.walletUuid === walletUuid;

/**
 * The pairs of movements that may be a transfer between the user's wallets (tabella's
 * `TransferSuggestionsScreen`): each one's two legs, how sure arca is and how many days apart they
 * are, linked as one transfer or dismissed (never suggested again). Nothing is linked until the
 * user says so.
 */
export function TransferSuggestions() {
  const { wallets, changed } = useWallets();
  const read = useTransferSuggestions();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const byUuid = useMemo(() => new Map(wallets.map((w, i) => [w.uuid, { wallet: w, color: walletColor(w, i) }])), [wallets]);

  const answer = async (s: TransferSuggestion, accept: boolean) => {
    setBusy(s.uuid);
    setNotice(null);
    try {
      if (accept) await walletService.acceptTransferSuggestions([s.uuid]);
      else await walletService.dismissTransferSuggestions([s.uuid]);
      setNotice({ text: accept ? "Linked as a transfer" : "Dismissed: it won't be suggested again", error: false });
      changed();
    } catch (err) {
      setNotice({ text: errorText(err, accept ? "Unable to link these movements." : "Unable to dismiss this suggestion."), error: true });
    } finally {
      setBusy(null);
    }
  };

  const page = read.data;
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 max-w-2xl">
        Money that seems to have left one of your wallets and arrived in another. Linked as a transfer, it counts as
        neither spending nor income. Nothing is linked until you say so.
      </p>
      {notice && <p className={`text-xs font-semibold ${notice.error ? "text-rose-600" : "text-emerald-700"}`}>{notice.text}</p>}
      {read.isError ? (
        <p className="text-sm font-semibold text-rose-600">{errorText(read.error, "Unable to load the transfers to confirm.")}</p>
      ) : !page ? (
        <div className="py-16 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
      ) : page.items.length === 0 ? (
        <section className="bg-white border border-slate-200 rounded-4xl shadow-sm p-10 text-center">
          <p className="text-slate-600 font-semibold">Nothing to confirm: no movements look like a transfer between your wallets.</p>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {page.items.map((s) => (
              <section key={s.uuid} className="bg-white border border-slate-200 rounded-4xl shadow-sm p-5 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#C49A3C]/15 text-[#9A7A2E]">{REASON_LABELS[s.reason] ?? REASON_LABELS.several_candidates}</span>
                  <span className="text-xs font-semibold text-slate-400">{daysApart(s.daysApart)}</span>
                </div>
                <Leg movement={s.outgoing} wallet={byUuid.get(s.outgoing.walletUuid)} />
                <ArrowDown className="h-4 w-4 text-slate-300 ml-0.5" />
                <Leg movement={s.incoming} wallet={byUuid.get(s.incoming.walletUuid)} />
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => answer(s, false)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:border-slate-300 transition-colors disabled:opacity-50"
                  >
                    Not a transfer
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => answer(s, true)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    {busy === s.uuid && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Link as transfer
                  </button>
                </div>
              </section>
            ))}
          </div>
          {page.pending > page.items.length && (
            <p className="text-xs text-slate-400">{page.items.length} of {page.pending} shown: the others come once these are answered.</p>
          )}
        </>
      )}
    </div>
  );
}

/** One leg: its wallet, its day and description, its amount in its wallet's currency. */
function Leg({ movement: m, wallet }: { movement: Movement; wallet?: { wallet: Wallet; color: string } }) {
  return (
    <div className="flex items-start gap-3">
      <span className="h-2.5 w-2.5 rounded-full mt-1.5 shrink-0" style={{ background: wallet?.color ?? "#94a3b8" }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-slate-900 truncate">{wallet?.wallet.name ?? "—"}</p>
        <p className="text-xs text-slate-400 truncate">{dayLabel(m.bookedOn)} · {m.description}</p>
      </div>
      <span className={`text-sm font-black tabular-nums whitespace-nowrap ${m.amount > 0 ? "text-emerald-600" : "text-slate-900"}`}>
        {m.amount > 0 ? "+" : ""}{formatCurrency(m.amount, m.currency, 2)}
      </span>
    </div>
  );
}
