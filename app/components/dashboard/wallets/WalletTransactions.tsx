// components/dashboard/wallets/WalletTransactions.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, FileText, Link2, Loader2, PlusCircle, Search,
  SlidersHorizontal, Trash2, Unlink, UploadCloud, Wand2, X,
} from "lucide-react";
import { useWallets } from "../../../context/WalletsContext";
import { walletService } from "../../../services/walletService";
import { formatCurrency } from "../../../lib/format";
import {
  ALL_WALLETS, CATEGORY_LABELS, INCOME_CATEGORIES, SPENDING_CATEGORIES, categoryColor, categoryLabel, dayLabel, errorText, walletColor,
} from "../../../lib/wallets";
import type { CategoryRule, Movement, MovementCategory, MovementFilters, Wallet } from "../../../models/Wallet";
import { ConfirmDialog } from "../ConfirmDialog";
import { Pills } from "../../preview/PreviewKit";
import { DialogShell, MovementDialog } from "./WalletDialogs";

const PAGE = 25;

// `byRule`: set by the user's rule for the payee, not by the user.
export function CategoryChip({ category, transfer, byRule }: { category: MovementCategory | null; transfer?: string; byRule?: boolean }) {
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
      {byRule && <span title="Set by your rule for this payee"><Wand2 className="h-3 w-3 opacity-70" aria-label="Set by a rule" /></span>}
    </span>
  );
}

// A filter control in the list's filter bar (TransactionFilterBar's).
const FILTER = "h-9 px-3 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs font-semibold placeholder:text-slate-400 placeholder:font-normal outline-none focus:ring-4 focus:ring-slate-50 focus:border-slate-300 transition-all min-w-0";

type Direction = "all" | "in" | "out";

/**
 * A wallet's movements, or every wallet's (the list widens to them from its own filter), laid out
 * as a portfolio's Transactions: the ways to add some (a statement, or one by hand) above, then
 * the saved ones in one card, filtered, searched and paged by the API, newest first. A movement
 * opens to be changed; several picked on a page can be given a category, deleted, or (two of
 * them, in and out of two wallets) linked as one transfer, which a transfer's leg can be unlinked
 * from. An archived wallet's, and a demo account's, are read only (`lock` says why).
 */
export function WalletTransactions({ initial, readOnly, lock, onAdd, onImport }: {
  initial: string;
  readOnly: boolean;
  // Why movements can't be added here (a demo account, an archived wallet); undefined when they can.
  lock?: string;
  onAdd: () => void;
  onImport: () => void;
}) {
  const { wallets, source, version, changed } = useWallets();
  const [wallet, setWallet] = useState(initial);
  const scope = wallet === ALL_WALLETS ? null : wallet;
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [direction, setDirection] = useState<Direction>("all");
  const [category, setCategory] = useState<"all" | "none" | MovementCategory>("all");
  const [hideTransfers, setHideTransfers] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // The filters tucked behind "More filters": open from the start only if one is set.
  const secondary = [direction !== "all", category !== "all", hideTransfers].filter(Boolean).length;
  const [showMore, setShowMore] = useState(false);
  // What the last answer was for (`key`): the rows stay shown while the next one loads.
  const [result, setResult] = useState<{ key: string; rows: Movement[]; total: number | null; error: string | null } | null>(null);
  // The page and the selection belong to one filter: a new one starts from the first page, none selected.
  const [paging, setPaging] = useState<{ key: string; page: number }>({ key: "", page: 1 });
  const [selection, setSelection] = useState<{ key: string; uuids: Set<string> }>({ key: "", uuids: new Set() });
  const [editing, setEditing] = useState<Movement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showRules, setShowRules] = useState(false);
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
  const page = paging.key === filterKey ? paging.page : 1;
  const setPage = (next: number) => setPaging({ key: filterKey, page: next });
  // A page's own: what's picked on one page isn't carried to the next.
  const pageKey = `${filterKey}:${page}`;
  const selected = selection.key === pageKey ? selection.uuids : new Set<string>();
  const setSelected = (change: Set<string> | ((prev: Set<string>) => Set<string>)) =>
    setSelection({ key: pageKey, uuids: typeof change === "function" ? change(selected) : change });
  const requestKey = `${pageKey}:${version}`;

  useEffect(() => {
    let cancelled = false;
    source.movements(scope, { ...filters, limit: PAGE, offset: (page - 1) * PAGE })
      .then((list) => { if (!cancelled) setResult({ key: requestKey, rows: list.items, total: list.total, error: null }); })
      .catch((err) => {
        if (!cancelled) setResult((prev) => ({ key: requestKey, rows: prev?.rows ?? [], total: prev?.total ?? null, error: errorText(err, "Unable to load the movements.") }));
      });
    return () => { cancelled = true; };
    // filters and page are read through requestKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, requestKey]);
  const rows = result?.rows ?? [];
  const total = result?.total ?? null;
  const loading = result?.key !== requestKey;
  const loadError = result?.key === requestKey ? result.error : null;
  const pages = Math.max(1, Math.ceil((total ?? 0) / PAGE));

  const byUuid = useMemo(() => new Map(wallets.map((w, i) => [w.uuid, { wallet: w, color: walletColor(w, i) }])), [wallets]);
  const walletOf = (m: Movement) => byUuid.get(m.walletUuid)?.wallet;
  const editable = (m: Movement) => !readOnly && !walletOf(m)?.archived;
  const picked = rows.filter((m) => selected.has(m.uuid));
  const pickable = rows.filter(editable);
  const allPicked = pickable.length > 0 && pickable.every((m) => selected.has(m.uuid));

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
  const filtered = Object.keys(filters).length > 0 || scope !== (initial === ALL_WALLETS ? null : initial);
  const clear = () => {
    setQuery(""); setText(""); setDirection("all"); setCategory("all"); setHideTransfers(false); setFrom(""); setTo(""); setWallet(initial);
  };

  return (
    <>
      {!readOnly || lock ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AddCard
            icon={<UploadCloud className="h-5 w-5" />}
            title="Import statement"
            desc={lock ?? "CSV, XLS or XLSX, as your bank exports it"}
            lock={lock}
            dashed
            onClick={onImport}
          />
          <AddCard
            icon={<PlusCircle className="h-5 w-5" />}
            title="Add movement"
            desc={lock ?? "Money in or out by hand, or a transfer between your wallets"}
            lock={lock}
            onClick={onAdd}
          />
        </div>
      ) : null}

      <section className="bg-white border border-slate-200 rounded-4xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-slate-200 gap-4 flex-wrap">
          <h4 className="text-sm font-black text-slate-900">
            Saved movements {total !== null && <span className="text-slate-400 font-semibold">({total.toLocaleString("en-US")})</span>}
          </h4>
          <div className="flex items-center gap-3">
            {loading && result && <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />}
            <button
              type="button"
              onClick={() => setShowRules(true)}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors"
            >
              <Wand2 className="h-3.5 w-3.5" />Category rules
            </button>
          </div>
        </div>

        <div className="px-5 md:px-6 py-3 border-b border-slate-200 bg-slate-50/40 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-64">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Description, counterparty, note"
                aria-label="Search movements"
                className={`${FILTER} w-full pl-8`}
              />
            </div>
            {wallets.length > 1 && (
              <div className="relative w-full sm:w-44">
                <select value={wallet} onChange={(e) => setWallet(e.target.value)} aria-label="Wallet" className={`${FILTER} w-full pr-8 appearance-none`}>
                  <option value={ALL_WALLETS}>Every wallet</option>
                  {wallets.map((w) => <option key={w.uuid} value={w.uuid}>{w.name}{w.archived ? " (archived)" : ""}</option>)}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
            <label className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">From</span>
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={`${FILTER} w-full sm:w-36`} />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">To</span>
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={`${FILTER} w-full sm:w-36`} />
            </label>
            <button
              type="button"
              onClick={() => setShowMore((open) => !open)}
              aria-expanded={showMore || secondary > 0}
              className={`flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs font-bold transition-colors ${
                showMore || secondary > 0 ? "bg-white border-slate-300 text-slate-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              More filters
              {secondary > 0 && <span className="min-w-4 h-4 px-1 rounded-full bg-slate-900 text-white text-[10px] leading-4 text-center">{secondary}</span>}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMore || secondary > 0 ? "rotate-180" : ""}`} />
            </button>
            {filtered && (
              <button type="button" onClick={clear} className="flex items-center gap-1 px-2.5 h-9 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">
                <X className="h-3.5 w-3.5" />Clear filters
              </button>
            )}
          </div>
          {(showMore || secondary > 0) && (
            <div className="flex items-center gap-2 flex-wrap">
              <Pills<Direction> options={[{ value: "all", label: "In and out" }, { value: "in", label: "Money in" }, { value: "out", label: "Money out" }]} value={direction} onChange={setDirection} />
              <div className="relative w-full sm:w-44">
                <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} aria-label="Category" className={`${FILTER} w-full pr-8 appearance-none`}>
                  <option value="all">Every category</option>
                  <option value="none">Uncategorised</option>
                  <optgroup label="Money in">{INCOME_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</optgroup>
                  <optgroup label="Money out">{SPENDING_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</optgroup>
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <label className="flex items-center gap-2 px-1 text-xs font-bold text-slate-500 cursor-pointer">
                <input type="checkbox" checked={hideTransfers} onChange={(e) => setHideTransfers(e.target.checked)} className="accent-[#C49A3C]" />
                Hide transfers between my wallets
              </label>
            </div>
          )}
        </div>

        {pickable.length > 0 && (
          <div className="flex items-center justify-between px-5 md:px-6 py-2.5 border-b border-slate-100 bg-slate-50/50 gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-[#C49A3C] w-4 h-4 cursor-pointer"
                checked={allPicked}
                onChange={() => setSelected(allPicked ? new Set() : new Set(pickable.map((m) => m.uuid)))}
              />
              <span className="text-xs font-semibold text-slate-500">Select all on this page</span>
            </label>
            {picked.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
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
                    title="The payee's other uncategorised movements, and new ones, take it too"
                    className="text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none cursor-pointer transition-all focus:ring-4 focus:ring-slate-50"
                  >
                    <option value="">Set category ({categorizable.length})…</option>
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
                <BarButton icon={<Trash2 className="h-3.5 w-3.5" />} disabled={busy} danger onClick={() => { setActionError(null); setConfirmDelete(true); }}>
                  Delete selected ({picked.length})
                </BarButton>
                {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              </div>
            )}
            {actionError && !confirmDelete && <p className="w-full text-xs font-semibold text-rose-600">{actionError}</p>}
          </div>
        )}

        {loadError ? (
          <p className="p-6 text-sm font-semibold text-rose-600">{loadError}</p>
        ) : !result ? (
          <div className="py-16 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
        ) : rows.length === 0 && !loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-center px-6">
            <div className="p-5 bg-slate-50 rounded-2xl mb-4"><FileText className="h-7 w-7 text-slate-300" /></div>
            <p className="text-slate-600 font-semibold">{filtered ? "No movements match these filters." : "No movements yet: add one, or import a statement."}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((m) => {
              const own = byUuid.get(m.walletUuid);
              const canEdit = editable(m);
              const kind = m.transferUuid ? ROW_STYLE.transfer : m.amount > 0 ? ROW_STYLE.in : ROW_STYLE.out;
              const Icon = kind.icon;
              const secondaryParts = [m.counterparty, m.note, !scope && own?.wallet.name].filter(Boolean).join(" · ");
              return (
                <div
                  key={m.uuid}
                  onClick={() => canEdit && setEditing(m)}
                  className={`flex items-center gap-3 px-5 md:px-6 py-3.5 transition-colors ${canEdit ? "cursor-pointer" : ""} ${
                    selected.has(m.uuid) ? "bg-[#C49A3C]/5" : canEdit ? "hover:bg-slate-50" : ""
                  }`}
                >
                  {!readOnly && (
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={selected.has(m.uuid)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggle(m.uuid)}
                      aria-label={`Select ${m.description}`}
                      className="accent-[#C49A3C] w-4 h-4 cursor-pointer shrink-0 disabled:cursor-not-allowed"
                    />
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${kind.classes}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-slate-900 truncate">{m.description}</span>
                      <CategoryChip category={m.category} transfer={m.transferUuid ? transferLabel(m) : undefined} byRule={m.categorySource === "rule"} />
                      <span className="text-xs font-semibold text-slate-400 shrink-0">{dayLabel(m.bookedOn)}</span>
                    </div>
                    {secondaryParts && (
                      <p className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1.5">
                        {!scope && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: own?.color ?? "#94a3b8" }} />}
                        {secondaryParts}
                      </p>
                    )}
                  </div>
                  <span className={`text-sm font-black tabular-nums whitespace-nowrap shrink-0 ${m.amount > 0 ? "text-emerald-600" : "text-slate-900"}`}>
                    {m.amount > 0 ? "+" : ""}{formatCurrency(m.amount, m.currency, 2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-5 md:px-6 py-3.5 border-t border-slate-200">
            <PageButton disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}><ChevronLeft className="h-3.5 w-3.5" />Prev</PageButton>
            <span className="text-xs font-semibold text-slate-400">Page {page} of {pages}</span>
            <PageButton disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Next<ChevronRight className="h-3.5 w-3.5" /></PageButton>
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
      {showRules && <CategoryRulesDialog readOnly={readOnly} onClose={() => setShowRules(false)} />}
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

// A row's icon, as a portfolio's operations have theirs (TransactionsSection's).
const ROW_STYLE = {
  in: { icon: ArrowDownLeft, classes: "bg-emerald-50 text-emerald-600" },
  out: { icon: ArrowUpRight, classes: "bg-rose-50 text-rose-600" },
  transfer: { icon: ArrowLeftRight, classes: "bg-slate-100 text-slate-500" },
};

// One of the ways to add movements, above the list (FileUploader's toolbar): `lock` disables it, and says why.
function AddCard({ icon, title, desc, lock, dashed, onClick }: {
  icon: React.ReactNode; title: string; desc: string; lock?: string; dashed?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!lock}
      title={lock}
      className={`p-5 rounded-3xl flex items-center gap-4 transition-colors group text-left disabled:opacity-50 disabled:cursor-not-allowed ${
        dashed ? "border-2 border-dashed border-slate-200/80 bg-white/50 enabled:hover:bg-slate-50" : "border border-slate-200 bg-white enabled:hover:bg-slate-50"
      }`}
    >
      <div className="bg-[#C49A3C]/10 text-[#C49A3C] w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-enabled:group-hover:bg-[#C49A3C]/20 transition-colors">
        {icon}
      </div>
      <div className="overflow-hidden">
        <span className="text-sm font-bold text-slate-700 block">{title}</span>
        <p className="text-xs text-slate-400 truncate">{desc}</p>
      </div>
    </button>
  );
}

function PageButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
    >
      {children}
    </button>
  );
}

function BarButton({ icon, children, onClick, disabled, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${
        danger ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * The user's category rules: one per payee, money in and money out apart, learnt from the last
 * category they gave one of its movements. Deleting one leaves the movements it categorised
 * uncategorised; a demo account's are read only.
 */
export function CategoryRulesDialog({ readOnly, onClose }: { readOnly: boolean; onClose: () => void }) {
  const { changed } = useWallets();
  const [rules, setRules] = useState<CategoryRule[] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    walletService.categoryRules()
      .then((list) => { if (!cancelled) setRules(list); })
      .catch((err) => { if (!cancelled) setError(errorText(err, "Unable to load the category rules.")); });
    return () => { cancelled = true; };
  }, []);

  const remove = async (rule: CategoryRule) => {
    setRemoving(rule.uuid);
    setError(null);
    try {
      await walletService.removeCategoryRule(rule.uuid);
      setRules((prev) => prev?.filter((r) => r.uuid !== rule.uuid) ?? null);
      changed();
    } catch (err) {
      setError(errorText(err, "Unable to delete this rule."));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <DialogShell
      icon={<Wand2 className="h-5 w-5" />}
      title="Category rules"
      subtitle="The category you give a movement is used for its payee's other movements, and for new ones."
      busy={removing !== null}
      error={error}
      submitLabel="Done"
      canSubmit
      onSubmit={onClose}
      onClose={onClose}
      wide
    >
      {rules === null ? (
        !error && <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
      ) : rules.length === 0 ? (
        <p className="text-sm font-semibold text-slate-500">
          No rules yet: give a movement a category, and its payee&apos;s other movements follow.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-2xl">
          {rules.map((rule) => (
            <li key={rule.uuid} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{rule.payee}</p>
                <p className="text-[11px] text-slate-400">{rule.incoming ? "Money in" : "Money out"}</p>
              </div>
              <CategoryChip category={rule.category} />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => void remove(rule)}
                  disabled={removing !== null}
                  aria-label={`Delete the rule for ${rule.payee}`}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {removing === rule.uuid ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </DialogShell>
  );
}
