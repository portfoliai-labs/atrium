// components/dashboard/wallets/WalletTransactions.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Link2, Loader2, Search, Trash2, Unlink } from "lucide-react";
import { useWallets } from "../../../context/WalletsContext";
import { walletService } from "../../../services/walletService";
import { formatCurrency } from "../../../lib/format";
import {
  ALL_WALLETS, CATEGORY_LABELS, INCOME_CATEGORIES, SPENDING_CATEGORIES, categoryColor, categoryLabel, dayLabel, errorText, walletColor,
} from "../../../lib/wallets";
import type { Movement, MovementCategory, MovementFilters, Wallet } from "../../../models/Wallet";
import { ConfirmDialog } from "../ConfirmDialog";
import { Pills } from "../../preview/PreviewKit";
import { MovementDialog } from "./WalletDialogs";

const PAGE = 50;
const SELECT = "h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 outline-none";

export function CategoryChip({ category, transfer }: { category: MovementCategory | null; transfer?: string }) {
  if (transfer !== undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap bg-slate-100 text-slate-500">
        <ArrowLeftRight className="h-3 w-3" />{transfer}
      </span>
    );
  }
  const color = categoryColor(category);
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap" style={{ background: `${color}14`, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{categoryLabel(category)}
    </span>
  );
}

/**
 * A wallet's movements, or every wallet's (the list widens to them from its own filter): searched,
 * filtered and paged by the API, newest first. A movement opens to be changed; several picked
 * together can be given a category, deleted, or (two of them, in and out of two wallets) linked
 * as one transfer, which a transfer's leg can be unlinked from. An archived wallet's, and a demo
 * account's, are read only.
 */
export function WalletTransactions({ initial, readOnly }: { initial: string; readOnly: boolean }) {
  const { wallets, source, version, changed } = useWallets();
  const [wallet, setWallet] = useState(initial);
  const scope = wallet === ALL_WALLETS ? null : wallet;
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [direction, setDirection] = useState<"all" | "in" | "out">("all");
  const [category, setCategory] = useState<"all" | "none" | MovementCategory>("all");
  const [hideTransfers, setHideTransfers] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Movement[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pages, setPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Movement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // The search goes out once typing stops.
  useEffect(() => {
    const t = setTimeout(() => setText(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const filters = useMemo<MovementFilters>(() => ({
    ...(text.trim() ? { text } : {}),
    ...(direction !== "all" ? { direction } : {}),
    ...(category === "none" ? { uncategorizedOnly: true } : category !== "all" ? { categories: [category] } : {}),
    ...(hideTransfers ? { excludeTransfers: true } : {}),
    ...(from ? { bookedFrom: from } : {}),
    ...(to ? { bookedTo: to } : {}),
  }), [text, direction, category, hideTransfers, from, to]);
  const filterKey = JSON.stringify([scope, filters]);

  // A new filter starts from the first page, the selection cleared.
  useEffect(() => {
    setPages(1);
    setSelected(new Set());
  }, [filterKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    source.movements(scope, { ...filters, limit: PAGE * pages, offset: 0 })
      .then((list) => {
        if (cancelled) return;
        setRows(list.items);
        setTotal(list.total);
        setLoadError(null);
      })
      .catch((err) => { if (!cancelled) setLoadError(errorText(err, "Unable to load the movements.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // filters is read through filterKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, filterKey, pages, version]);

  const byUuid = useMemo(() => new Map(wallets.map((w, i) => [w.uuid, { wallet: w, color: walletColor(w, i) }])), [wallets]);
  const walletOf = (m: Movement) => byUuid.get(m.walletUuid)?.wallet;
  const editable = (m: Movement) => !readOnly && !walletOf(m)?.archived;
  const picked = rows.filter((m) => selected.has(m.uuid));

  // Two movements of two wallets, one in and one out, neither already a transfer's.
  const linkable = picked.length === 2 && picked[0].walletUuid !== picked[1].walletUuid
    && Math.sign(picked[0].amount) !== Math.sign(picked[1].amount) && picked.every((m) => !m.transferUuid);
  const unlinkable = picked.length === 1 && !!picked[0].transferUuid;
  const categorizable = picked.filter((m) => !m.transferUuid);

  const toggle = (uuid: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(uuid)) next.delete(uuid);
    else next.add(uuid);
    return next;
  });

  const act = async (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      setSelected(new Set());
      setConfirmDelete(false);
      changed();
    } catch (err) {
      setActionError(errorText(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const transferLabel = (m: Movement) => {
    const other = m.counterpartWalletUuid ? byUuid.get(m.counterpartWalletUuid)?.wallet.name : undefined;
    return other ? `${m.amount < 0 ? "To" : "From"} ${other}` : "Transfer";
  };
  const legsDeleted = picked.filter((m) => m.transferUuid).length;

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
              aria-label="Search movements"
              className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-[#C49A3C]/60"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={wallet} onChange={(e) => setWallet(e.target.value)} aria-label="Wallet" className={SELECT}>
              <option value={ALL_WALLETS}>Every wallet</option>
              {wallets.map((w) => <option key={w.uuid} value={w.uuid}>{w.name}{w.archived ? " (archived)" : ""}</option>)}
            </select>
            <Pills<"all" | "in" | "out"> options={[{ value: "all", label: "All" }, { value: "in", label: "Money in" }, { value: "out", label: "Money out" }]} value={direction} onChange={setDirection} />
            <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} aria-label="Category" className={SELECT}>
              <option value="all">Every category</option>
              <option value="none">Uncategorised</option>
              <optgroup label="Money in">{INCOME_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</optgroup>
              <optgroup label="Money out">{SPENDING_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</optgroup>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
          <label className="flex items-center gap-2">From <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={SELECT} /></label>
          <label className="flex items-center gap-2">to <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={SELECT} /></label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={hideTransfers} onChange={(e) => setHideTransfers(e.target.checked)} className="accent-[#C49A3C]" />
            Hide transfers between my wallets
          </label>
        </div>
      </div>

      {picked.length > 0 && (
        <div className="sticky top-20 z-10 bg-[#1c1917] text-white rounded-2xl shadow-lg px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold">{picked.length} selected</span>
          {categorizable.length > 0 && (
            <select
              value=""
              disabled={busy}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                void act(() => walletService.categorize(categorizable.map((m) => m.uuid), value === "none" ? null : (value as MovementCategory)), "Unable to change the category.");
              }}
              aria-label="Set category"
              className="h-9 px-3 rounded-xl bg-white/10 border border-white/20 text-xs font-bold text-white outline-none *:text-slate-900"
            >
              <option value="">Set category…</option>
              <option value="none">Uncategorised</option>
              <optgroup label="Money in">{INCOME_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</optgroup>
              <optgroup label="Money out">{SPENDING_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</optgroup>
            </select>
          )}
          {linkable && (
            <BarButton icon={<Link2 className="h-3.5 w-3.5" />} disabled={busy} onClick={() => act(() => walletService.linkTransfer(picked[0].uuid, picked[1].uuid), "Unable to link these movements.")}>
              Link as transfer
            </BarButton>
          )}
          {unlinkable && (
            <BarButton icon={<Unlink className="h-3.5 w-3.5" />} disabled={busy} onClick={() => act(() => walletService.unlinkTransfer(picked[0].transferUuid!), "Unable to unlink this transfer.")}>
              Unlink transfer
            </BarButton>
          )}
          <BarButton icon={<Trash2 className="h-3.5 w-3.5" />} disabled={busy} danger onClick={() => { setActionError(null); setConfirmDelete(true); }}>Delete</BarButton>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs font-bold text-white/60 hover:text-white">Clear</button>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {actionError && !confirmDelete && <p className="w-full text-xs font-semibold text-rose-300">{actionError}</p>}
        </div>
      )}

      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 md:px-7 pt-5 pb-4 flex items-center justify-between gap-3 border-b border-slate-100">
          <h3 className="text-sm font-black text-slate-900">
            {total === null ? "Movements" : `${total.toLocaleString("en-US")} ${total === 1 ? "movement" : "movements"}`}
          </h3>
          {loading && <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />}
        </div>
        {loadError ? (
          <p className="p-6 text-sm font-semibold text-rose-600">{loadError}</p>
        ) : rows.length === 0 && !loading ? (
          <p className="p-6 text-sm font-semibold text-slate-500">
            {Object.keys(filters).length === 0 ? "No movements yet: add one, or import a statement." : "No movements match."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                  {!readOnly && <th className="pl-6 pr-2 py-3 w-8" />}
                  <th className={`${readOnly ? "pl-6" : "pl-2"} pr-3 py-3`}>Date</th>
                  <th className="px-3 py-3">Description</th>
                  <th className="px-3 py-3">Category</th>
                  {!scope && <th className="px-3 py-3">Wallet</th>}
                  <th className="pl-3 pr-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((m) => {
                  const own = byUuid.get(m.walletUuid);
                  const canEdit = editable(m);
                  return (
                    <tr
                      key={m.uuid}
                      onClick={() => canEdit && setEditing(m)}
                      className={`${canEdit ? "cursor-pointer hover:bg-slate-50" : ""} ${selected.has(m.uuid) ? "bg-[#C49A3C]/5" : ""}`}
                    >
                      {!readOnly && (
                        <td className="pl-6 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            disabled={!canEdit}
                            checked={selected.has(m.uuid)}
                            onChange={() => toggle(m.uuid)}
                            aria-label={`Select ${m.description}`}
                            className="accent-[#C49A3C]"
                          />
                        </td>
                      )}
                      <td className={`${readOnly ? "pl-6" : "pl-2"} pr-3 py-3 whitespace-nowrap text-slate-500`}>{dayLabel(m.bookedOn)}</td>
                      <td className="px-3 py-3 min-w-48">
                        <p className="font-semibold text-slate-800">{m.description}</p>
                        {(m.counterparty || m.note) && (
                          <p className="text-[11px] text-slate-400 truncate max-w-md">{[m.counterparty, m.note].filter(Boolean).join(" · ")}</p>
                        )}
                      </td>
                      <td className="px-3 py-3"><CategoryChip category={m.category} transfer={m.transferUuid ? transferLabel(m) : undefined} /></td>
                      {!scope && (
                        <td className="px-3 py-3 whitespace-nowrap text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: own?.color ?? "#94a3b8" }} />
                            {own?.wallet.name ?? "—"}
                          </span>
                        </td>
                      )}
                      <td className={`pl-3 pr-6 py-3 text-right font-bold tabular-nums whitespace-nowrap ${m.amount > 0 ? "text-emerald-600" : "text-slate-900"}`}>
                        {m.amount > 0 ? "+" : ""}{formatCurrency(m.amount, m.currency, 2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {total !== null && rows.length < total && (
          <div className="px-6 py-4 border-t border-slate-100 flex justify-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => setPages((p) => p + 1)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:border-slate-300 disabled:opacity-60"
            >
              Show more ({(total - rows.length).toLocaleString("en-US")} left)
            </button>
          </div>
        )}
      </section>

      {editing && walletOf(editing) && (
        <MovementDialog
          wallet={walletOf(editing) as Wallet}
          movement={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); changed(); }}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${picked.length === 1 ? "this movement" : `${picked.length} movements`}?`}
          description={`${legsDeleted > 0 ? "A transfer's other side, in the other wallet, is deleted with it. " : ""}The balances change accordingly. This can't be undone.`}
          confirming={busy}
          error={actionError}
          onConfirm={() => act(() => walletService.deleteMovements(picked.map((m) => m.uuid)), "Unable to delete these movements.")}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

function BarButton({ icon, children, onClick, disabled, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold transition-colors disabled:opacity-60 ${danger ? "bg-rose-500/90 hover:bg-rose-500" : "bg-white/10 hover:bg-white/20"}`}
    >
      {icon}
      {children}
    </button>
  );
}
