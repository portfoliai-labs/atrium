"use client";

import { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, CircleDollarSign, FileText, Loader2, Trash2 } from "lucide-react";

// Normalized shape both pending (client-parsed StandardTransaction) and existing
// (backend TransactionResponse) rows are converted into before reaching this component.
export interface DisplayTransaction {
  ticker: string | null;
  name: string | null;
  isin: string | null;
  date: string;
  operation: string;
  amount: number;
  quantity: number | null;
  price: number | null;
  currency: string;
  fees: number;
  broker: string | null;
}

export interface TransactionRow {
  key: string;
  transaction: DisplayTransaction;
  sourceLabel: string;
  origin: "existing" | "pending";
  errorFields: Set<string>;
}

interface TransactionsSectionProps {
  title: string;
  rows: TransactionRow[]; // current page only
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading: boolean;
  selectedKeys: Set<string>;
  onToggleRow: (key: string) => void;
  onToggleAll: (keysOnPage: string[]) => void;
  onDeleteSelected: (keys: string[]) => void;
  onRowClick: (key: string) => void;
  deletingKeys: Set<string>;
  emptyMessage: string;
  headerAction?: ReactNode;
  filterBar?: ReactNode;
  // Deletes every row matching the section's current filters directly in the backend
  // (not just the current page) — omit to hide the action entirely (e.g. pending rows).
  onDeleteAll?: () => void;
  deletingAll?: boolean;
}

const OPERATION_STYLES: Record<string, { icon: typeof ArrowUpRight; classes: string }> = {
  buy: { icon: ArrowUpRight, classes: "bg-emerald-50 text-emerald-600" },
  sell: { icon: ArrowDownRight, classes: "bg-rose-50 text-rose-600" },
  dividend: { icon: CircleDollarSign, classes: "bg-blue-50 text-blue-600" },
  other: { icon: CircleDollarSign, classes: "bg-slate-100 text-slate-500" },
};

function formatMoney(value: number, currency: string): string {
  if (Number.isNaN(value)) return "-";
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ""}`.trim();
}

// The asset's name is the row's primary identifier when known, with its ticker alongside
// for quick recognition — pending (not-yet-saved) rows don't have a resolved name yet, so
// this falls back to whatever identifier is available (ticker, then ISIN).
function rowIdentifier(tx: DisplayTransaction): string {
  if (tx.name && tx.ticker) return `${tx.name} (${tx.ticker})`;
  return tx.name || tx.ticker || tx.isin || "—";
}

export function TransactionsSection({
  title, rows, totalCount, page, pageSize, onPageChange, loading,
  selectedKeys, onToggleRow, onToggleAll, onDeleteSelected, onRowClick, deletingKeys,
  emptyMessage, headerAction, filterBar, onDeleteAll, deletingAll,
}: TransactionsSectionProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageKeys = rows.map(r => r.key);
  const allOnPageSelected = pageKeys.length > 0 && pageKeys.every(k => selectedKeys.has(k));
  const selectedOnPage = pageKeys.filter(k => selectedKeys.has(k));

  return (
    <div className="bg-white border border-slate-200 rounded-4xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-slate-200 gap-4 flex-wrap">
        <h4 className="text-sm font-black text-slate-900">
          {title} <span className="text-slate-400 font-semibold">({totalCount})</span>
        </h4>
        <div className="flex items-center gap-3">
          {onDeleteAll && totalCount > 0 && (
            <button
              onClick={onDeleteAll}
              disabled={deletingAll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deletingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete all
            </button>
          )}
          {headerAction}
        </div>
      </div>

      {filterBar}

      {rows.length > 0 && (
        <div className="flex items-center justify-between px-5 md:px-6 py-2.5 border-b border-slate-100 bg-slate-50/50 gap-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-blue-600 w-4 h-4 cursor-pointer"
              checked={allOnPageSelected}
              onChange={() => onToggleAll(pageKeys)}
            />
            <span className="text-xs font-semibold text-slate-500">Select all on this page</span>
          </label>
          {selectedOnPage.length > 0 && (
            <button
              onClick={() => onDeleteSelected(selectedOnPage)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete selected ({selectedOnPage.length})
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-center px-6">
          <div className="p-5 bg-slate-50 rounded-2xl mb-4">
            <FileText className="h-7 w-7 text-slate-300" />
          </div>
          <p className="text-slate-600 font-semibold">{emptyMessage}</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row) => {
            const tx = row.transaction;
            const isExisting = row.origin === "existing";
            const opStyle = OPERATION_STYLES[tx.operation] ?? OPERATION_STYLES.other;
            const OpIcon = opStyle.icon;
            const isDeleting = deletingKeys.has(row.key);
            const hasError = (field: keyof DisplayTransaction) => row.errorFields.has(field);

            const secondaryParts = [
              tx.quantity != null && tx.price != null && `${tx.quantity} @ ${formatMoney(tx.price, tx.currency)}`,
              `= ${formatMoney(tx.amount, tx.currency)}`,
              tx.isin && `ISIN ${tx.isin}`,
              tx.broker,
              tx.fees > 0 && `fees ${formatMoney(tx.fees, tx.currency)}`,
              !isExisting && row.sourceLabel,
            ].filter(Boolean).join(" · ");

            return (
              <div
                key={row.key}
                onClick={() => !isDeleting && onRowClick(row.key)}
                className={`flex items-center gap-3 px-5 md:px-6 py-3.5 transition-colors cursor-pointer ${
                  isDeleting
                    ? "opacity-40 pointer-events-none"
                    : selectedKeys.has(row.key)
                    ? "bg-blue-50/40"
                    : isExisting
                    ? "bg-slate-50/30 hover:bg-slate-50"
                    : "hover:bg-slate-50/60"
                }`}
              >
                <input
                  type="checkbox"
                  className="accent-blue-600 w-4 h-4 cursor-pointer shrink-0"
                  checked={selectedKeys.has(row.key)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggleRow(row.key)}
                />

                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${opStyle.classes}`}>
                  <OpIcon className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-black truncate ${hasError("ticker") || hasError("isin") ? "text-rose-600" : "text-slate-900"}`}>
                      {rowIdentifier(tx)}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 ${opStyle.classes}`}>
                      {tx.operation}
                    </span>
                    <span className={`text-xs font-semibold shrink-0 ${hasError("date") ? "text-rose-500" : "text-slate-400"}`}>
                      {tx.date || "no date"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{secondaryParts}</p>
                </div>

                {isDeleting && <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 md:px-6 py-3.5 border-t border-slate-200">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>
          <span className="text-xs font-semibold text-slate-400">Page {page} of {totalPages}</span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
