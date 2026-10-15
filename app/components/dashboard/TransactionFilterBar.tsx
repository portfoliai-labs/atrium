"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import type { TransactionOperation } from "../../models/Transaction";
import type { Portfolio } from "../../models/Portfolio";

export interface TransactionFilterState {
  // A portfolio's uuid, or "" for every portfolio. Picks which list is fetched rather than
  // being a query param (see FileUploader).
  portfolio: string;
  ticker: string;
  isin: string;
  broker: string;
  operation: TransactionOperation | "";
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_TRANSACTION_FILTERS: TransactionFilterState = {
  portfolio: "",
  ticker: "",
  isin: "",
  broker: "",
  operation: "",
  dateFrom: "",
  dateTo: "",
};

const OPERATIONS: TransactionOperation[] = ["buy", "sell", "dividend", "other"];

function FilterInput({
  placeholder, value, onChange, type = "text",
}: {
  placeholder: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs font-semibold placeholder:text-slate-300 placeholder:font-normal outline-none focus:ring-4 focus:ring-slate-50 focus:border-slate-300 transition-all min-w-0 w-full sm:w-32"
    />
  );
}

function DateFilterInput({
  value, onChange,
}: {
  value: string; onChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      type={focused || value ? "date" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder=""
      className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs font-semibold placeholder:text-slate-300 placeholder:font-normal outline-none focus:ring-4 focus:ring-slate-50 focus:border-slate-300 transition-all min-w-0 w-full sm:w-32"
    />
  );
}

interface TransactionFilterBarProps {
  filters: TransactionFilterState;
  onChange: (filters: TransactionFilterState) => void;
  // The portfolios the list can show (the real ones: virtual portfolios aren't filtered on); the
  // portfolio filter only shows with two or more.
  portfolios?: Portfolio[];
}

// The filters tucked behind "More filters" — the portfolio and the date range stay in view.
const SECONDARY_FILTERS = ["ticker", "isin", "broker", "operation"] as const;

export function TransactionFilterBar({ filters, onChange, portfolios = [] }: TransactionFilterBarProps) {
  const set = <K extends keyof TransactionFilterState>(key: K) => (value: TransactionFilterState[K]) =>
    onChange({ ...filters, [key]: value });

  const hasActiveFilters = Object.values(filters).some(Boolean);
  const activeSecondary = SECONDARY_FILTERS.filter((key) => filters[key]).length;
  // Starts open only if one of the tucked-away filters is already set, so it isn't hidden.
  const [showMore, setShowMore] = useState(activeSecondary > 0);

  return (
    <div className="px-5 md:px-6 py-3 border-b border-slate-200 bg-slate-50/40 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {portfolios.length > 1 && (
          <div className="relative w-full sm:w-40">
            <select
              value={filters.portfolio}
              onChange={(e) => set("portfolio")(e.target.value)}
              aria-label="Portfolio"
              className="h-9 pl-3 pr-8 w-full rounded-lg bg-white border border-slate-200 text-slate-900 text-xs font-semibold outline-none focus:ring-4 focus:ring-slate-50 focus:border-slate-300 transition-all appearance-none"
            >
              <option value="">All portfolios</option>
              {portfolios.filter((p) => !p.isVirtual).map((p) => <option key={p.uuid} value={p.uuid}>{p.name}</option>)}
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">From</span>
          <DateFilterInput value={filters.dateFrom} onChange={set("dateFrom")} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">To</span>
          <DateFilterInput value={filters.dateTo} onChange={set("dateTo")} />
        </div>

        <button
          onClick={() => setShowMore((open) => !open)}
          aria-expanded={showMore}
          className={`flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs font-bold transition-colors ${
            showMore || activeSecondary > 0
              ? "bg-white border-slate-300 text-slate-700"
              : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          More filters
          {activeSecondary > 0 && (
            <span className="min-w-4 h-4 px-1 rounded-full bg-slate-900 text-white text-[10px] leading-4 text-center">{activeSecondary}</span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMore ? "rotate-180" : ""}`} />
        </button>

        {hasActiveFilters && (
          <button
            onClick={() => onChange(EMPTY_TRANSACTION_FILTERS)}
            className="flex items-center gap-1 px-2.5 h-9 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {showMore && (
        <div className="flex items-center gap-2 flex-wrap">
          <FilterInput placeholder="Ticker" value={filters.ticker} onChange={set("ticker")} />
          <FilterInput placeholder="ISIN" value={filters.isin} onChange={set("isin")} />
          <FilterInput placeholder="Broker" value={filters.broker} onChange={set("broker")} />
          <div className="relative w-full sm:w-32">
            <select
              value={filters.operation}
              onChange={(e) => set("operation")(e.target.value as TransactionOperation | "")}
              aria-label="Type"
              className="h-9 pl-3 pr-8 w-full rounded-lg bg-white border border-slate-200 text-slate-900 text-xs font-semibold outline-none focus:ring-4 focus:ring-slate-50 focus:border-slate-300 transition-all appearance-none"
            >
              <option value="">All types</option>
              {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}
    </div>
  );
}
