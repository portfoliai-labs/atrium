// components/dashboard/realEstate/MovementLinks.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Link2, Loader2, Search, Unlink, Wallet as WalletIcon } from "lucide-react";
import { useRealEstate, useRealEstateQuery } from "../../../context/RealEstateContext";
import { useWalletQuery, useWallets } from "../../../context/WalletsContext";
import { realEstateService } from "../../../services/realEstateService";
import { formatCurrency } from "../../../lib/format";
import { fieldErrorText } from "../../../lib/realEstate";
import { dayLabel, errorText, today } from "../../../lib/wallets";
import type { LinkedMovement, Mortgage, MovementLinkProposal, PropertyTransaction } from "../../../models/RealEstate";
import type { MovementFilters } from "../../../models/Wallet";
import { INPUT } from "../wallets/WalletDialogs";

// How far back the proposals look when no range is filtered (the API takes at most 366 days).
const PROPOSAL_DAYS = 90;
const MAX_DAYS = 366;
// How far around a transaction's day the link picker looks for movements.
const PICKER_DAYS = 31;

export function addDays(day: string, days: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const NO_PROPOSALS: MovementLinkProposal[] = [];
const NO_MORTGAGES: Mortgage[] = [];

/** The range the proposals are asked for: the filtered one, else the last 90 days; at most 366. */
export function proposalRange(from: string, to: string) {
  const end = to || today();
  const start = from && from <= end ? from : addDays(end, -(PROPOSAL_DAYS - 1));
  return { from: start < addDays(end, -(MAX_DAYS - 1)) ? addDays(end, -(MAX_DAYS - 1)) : start, to: end };
}

/** A movement's line: its wallet, day and description, and its amount. */
function MovementLine({ movement: m, walletName }: { movement: LinkedMovement; walletName: string }) {
  return (
    <span className="flex-1 min-w-0 flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-slate-800 truncate">{m.description}</span>
        <span className="block text-[11px] text-slate-400 truncate">
          {[walletName, dayLabel(m.bookedOn), m.counterparty].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className={`text-[13px] font-bold tabular-nums whitespace-nowrap ${m.amount > 0 ? "text-emerald-600" : "text-slate-900"}`}>
        {m.amount > 0 ? "+" : ""}{formatCurrency(m.amount, m.currency, 2)}
      </span>
    </span>
  );
}

function useWalletName() {
  const { wallets } = useWallets();
  const names = useMemo(() => new Map(wallets.map((w) => [w.uuid, w.name])), [wallets]);
  return (uuid: string) => names.get(uuid) ?? "A wallet";
}

/** A linked transaction's mark in the list: linked, or its movement gone. */
export function MovementLinkMark({ transaction: t }: { transaction: PropertyTransaction }) {
  if (!t.movementUuid) return null;
  if (t.movementState === "gone") {
    return (
      <span title="Its wallet movement was deleted: unlink it, or link another." className="inline-flex text-amber-500">
        <AlertTriangle className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span title="Linked to a wallet movement" className="inline-flex text-[#C49A3C]">
      <Link2 className="h-3.5 w-3.5" />
    </span>
  );
}

/**
 * The wallets' movements that may be the transactions in the range (not linked yet) or the
 * instalments due in it (not recorded yet), every property's or one's: each confirmed with the
 * movement picked, nearest first. A transaction gets linked; an instalment is recorded as the
 * movement says (its day and amount) and linked. Nothing shows when there's nothing to propose, or
 * the wallets can't be asked.
 */
export function MovementProposals({ propertyUuid, from, to, transactions }: {
  propertyUuid: string | null;
  from: string;
  to: string;
  // The transactions listed: the proposals name them by their description.
  transactions: PropertyTransaction[];
}) {
  const { properties, changed } = useRealEstate();
  const range = proposalRange(from, to);
  const read = useRealEstateQuery(
    ["movementLinkProposals", propertyUuid, range.from, range.to],
    (source) => source.movementLinkProposals(propertyUuid, range.from, range.to),
  );
  // 503 when the wallets can't be asked: then there's simply nothing to propose.
  const proposals = read.data ?? NO_PROPOSALS;
  const instalments = proposals.some((p) => p.mortgageUuid);
  const mortgages = useRealEstateQuery(["mortgages", propertyUuid], (source) => source.mortgages(propertyUuid), { enabled: instalments }).data ?? NO_MORTGAGES;

  const byTransaction = useMemo(() => new Map(transactions.map((t) => [t.uuid, t])), [transactions]);
  const propertyName = (uuid: string) => properties.find((p) => p.uuid === uuid)?.name ?? "A property";
  const shown = proposals.filter((p) => p.candidates.length > 0);
  if (shown.length === 0) return null;

  const title = (p: MovementLinkProposal) => {
    if (p.transactionUuid) return byTransaction.get(p.transactionUuid)?.description ?? "A transaction";
    const lender = mortgages.find((m) => m.uuid === p.mortgageUuid)?.lender;
    return `Instalment ${p.instalmentNumber}${lender ? ` · ${lender}` : ""}`;
  };

  return (
    <section className="bg-white rounded-3xl border border-[#C49A3C]/40 shadow-sm overflow-hidden">
      <div className="px-6 md:px-7 pt-5 pb-4 border-b border-slate-100">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
          <WalletIcon className="h-4 w-4 text-[#C49A3C]" /> Found in your wallets
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Movements of the same amount within 5 days of a transaction not linked yet, or of a mortgage instalment not recorded yet
          ({dayLabel(range.from)} – {dayLabel(range.to)}).
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {shown.map((p) => (
          <ProposalRow
            key={`${p.transactionUuid ?? `${p.mortgageUuid}-${p.instalmentNumber}`}`}
            proposal={p}
            title={title(p)}
            propertyName={propertyUuid ? null : propertyName(p.propertyUuid)}
            onDone={changed}
          />
        ))}
      </ul>
    </section>
  );
}

function ProposalRow({ proposal: p, title, propertyName, onDone }: {
  proposal: MovementLinkProposal;
  title: string;
  propertyName: string | null;
  onDone: () => void;
}) {
  const walletName = useWalletName();
  const [picked, setPicked] = useState(p.candidates[0].movementUuid);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const movement = p.candidates.find((c) => c.movementUuid === picked) ?? p.candidates[0];

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      if (p.transactionUuid) {
        await realEstateService.updateTransaction(p.transactionUuid, { movementUuid: movement.movementUuid });
      } else {
        // The instalment as the movement paid it: its day and amount.
        await realEstateService.addTransactions(p.propertyUuid, [{
          kind: "mortgage_instalment", bookedOn: movement.bookedOn, amount: movement.amount,
          mortgageUuid: p.mortgageUuid, instalmentNumber: p.instalmentNumber, movementUuid: movement.movementUuid,
        }]);
      }
      onDone();
    } catch (err) {
      setError(fieldErrorText(err, "Unable to link this movement."));
      setBusy(false);
    }
  };

  return (
    <li className="px-6 md:px-7 py-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-slate-900">{title}</p>
          <p className="text-[11px] text-slate-400">
            {[propertyName, p.transactionUuid ? `Booked ${dayLabel(p.dueOn)}` : `Due ${dayLabel(p.dueOn)}, not recorded`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="text-[13px] font-bold tabular-nums text-slate-900">
          {p.amount > 0 ? "+" : ""}{formatCurrency(p.amount, p.currency, 2)}
        </span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 space-y-1.5">
          {p.candidates.map((c) => (
            <label
              key={c.movementUuid}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${p.candidates.length > 1 ? "cursor-pointer" : ""} ${
                c.movementUuid === movement.movementUuid ? "border-[#C49A3C]/60 bg-[#C49A3C]/5" : "border-slate-200"
              }`}
            >
              {p.candidates.length > 1 && (
                <input
                  type="radio"
                  name={`proposal-${p.transactionUuid ?? `${p.mortgageUuid}-${p.instalmentNumber}`}`}
                  checked={c.movementUuid === movement.movementUuid}
                  onChange={() => setPicked(c.movementUuid)}
                  className="accent-[#C49A3C]"
                />
              )}
              <MovementLine movement={c} walletName={walletName(c.walletUuid)} />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold bg-[#1c1917] text-white hover:bg-[#C49A3C] transition-colors disabled:opacity-60 shrink-0"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          {p.transactionUuid ? "Link" : "Record and link"}
        </button>
      </div>
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
    </li>
  );
}

/**
 * A transaction's wallet movement, in its edit dialog: the one linked (unlinked from here), or one
 * to link, looked up among the wallets' movements around its day in its currency and direction
 * (transfers left out). `value` is the movement's uuid, "" for none.
 */
export function MovementLinkField({ transaction: t, bookedOn, moneyIn, value, onChange }: {
  transaction: PropertyTransaction;
  // The day and direction as the dialog has them now.
  bookedOn: string;
  moneyIn: boolean;
  value: string;
  onChange: (movementUuid: string) => void;
}) {
  const walletName = useWalletName();
  const { available } = useWallets();
  const linked = value !== "" && value === t.movementUuid;
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setText(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const day = bookedOn || t.bookedOn;
  const filters: MovementFilters = {
    bookedFrom: addDays(day, -PICKER_DAYS), bookedTo: addDays(day, PICKER_DAYS),
    direction: moneyIn ? "in" : "out", excludeTransfers: true, limit: 100, ...(text.trim() ? { text } : {}),
  };
  // The wallets' movements around its day, in the cache with the wallets' other reads.
  const read = useWalletQuery(["movements", "all", filters], (source) => source.movements(null, filters), { enabled: !linked });
  // Off where the wallets can't be read at all: said so, not left loading.
  const error = !available ? "Unable to read your wallets." : read.isError ? errorText(read.error, "Unable to read your wallets.") : null;
  const list = useMemo(() => {
    if (!read.data) return undefined;
    const amount = Math.abs(t.amount);
    // Its currency only; the same amount first, then the nearest day.
    const nearness = (m: { amount: number; bookedOn: string }) =>
      [Math.abs(Math.abs(m.amount) - amount) < 0.005 ? 0 : 1, Math.abs(Date.parse(m.bookedOn) - Date.parse(day))];
    return read.data.items
      .filter((m) => m.currency === t.currency)
      .sort((a, b) => { const [x, y] = [nearness(a), nearness(b)]; return x[0] - y[0] || x[1] - y[1]; })
      .map((m): LinkedMovement => ({
        movementUuid: m.uuid, walletUuid: m.walletUuid, bookedOn: m.bookedOn, amount: m.amount,
        currency: m.currency, description: m.description, counterparty: m.counterparty,
      }));
  }, [read.data, day, t.amount, t.currency]);

  if (linked) {
    return (
      <div className="space-y-2">
        {t.movementState === "found" && t.movement ? (
          <div className="flex items-center gap-3 rounded-xl border border-[#C49A3C]/60 bg-[#C49A3C]/5 px-3 py-2">
            <Link2 className="h-4 w-4 text-[#C49A3C] shrink-0" />
            <MovementLine movement={t.movement} walletName={walletName(t.movement.walletUuid)} />
          </div>
        ) : t.movementState === "gone" ? (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Its wallet movement was deleted. Unlink it, or link another.
          </p>
        ) : (
          <p className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">
            Linked to a wallet movement, but your wallets can&apos;t be read right now.
          </p>
        )}
        <button type="button" onClick={() => onChange("")} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-600">
          <Unlink className="h-3.5 w-3.5" /> Unlink
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your wallets' movements"
          aria-label="Search wallet movements"
          className={`${INPUT} pl-10`}
        />
      </div>
      <p className="text-[11px] text-slate-400">
        {moneyIn ? "Money in" : "Money out"} in {t.currency}, within {PICKER_DAYS} days of {dayLabel(day)}; the same amount first.
        {t.movementUuid && " Saving unlinks the movement linked now."}
      </p>
      {error ? (
        <p className="text-xs font-semibold text-rose-600">{error}</p>
      ) : list === undefined ? (
        <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
      ) : list.length === 0 ? (
        <p className="text-xs font-semibold text-slate-500">No movement matches.</p>
      ) : (
        <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
          {value !== "" && (
            <button type="button" onClick={() => onChange("")} className="text-xs font-bold text-slate-500 hover:text-slate-700">Pick none</button>
          )}
          {list.map((m) => (
            <label
              key={m.movementUuid}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 cursor-pointer ${
                m.movementUuid === value ? "border-[#C49A3C]/60 bg-[#C49A3C]/5" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="movement-link"
                checked={m.movementUuid === value}
                onChange={() => onChange(m.movementUuid)}
                className="accent-[#C49A3C]"
              />
              <MovementLine movement={m} walletName={walletName(m.walletUuid)} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
