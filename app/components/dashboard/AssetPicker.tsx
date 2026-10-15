"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { exchangeLabel, type AssetSearchResult } from "../../models/AssetSearch";
import { ASSET_SEARCH_MIN_LENGTH, assetSearchService } from "../../services/assetSearchService";

const SEARCH_DEBOUNCE_MS = 300;

type SearchStatus = "idle" | "loading" | "done" | "error";

/** "VWCE.DE · Xetra (XETR) · EUR · ETF": what tells apart the listings of one ISIN. */
export function assetListingLine(asset: Pick<AssetSearchResult, "ticker" | "exchangeMic" | "currency" | "assetClass">): string {
  return [asset.ticker, exchangeLabel(asset.exchangeMic), asset.currency, asset.assetClass].filter(Boolean).join(" · ");
}

/**
 * ASSET PICKER — finds a security the backend can price (GET /v1/asset-search) by name, ticker
 * or ISIN, and picks one of its listings. Searches as the user types, once they pause; once
 * picked, the field shows the security with a button to pick another. Listings in
 * `excludeTickers`, or of an ISIN in `excludeIsins`, are listed but can't be picked (e.g. the
 * securities a strategy already holds).
 */
export function AssetPicker({
  value, onChange, label = "Security", placeholder = "Name, ticker or ISIN", excludeTickers = [], excludeIsins = [], required = false, autoFocus = false,
}: {
  value: AssetSearchResult | null;
  onChange: (asset: AssetSearchResult | null) => void;
  label?: string;
  placeholder?: string;
  excludeTickers?: string[];
  excludeIsins?: string[];
  required?: boolean;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetSearchResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const isSearchable = query.trim().length >= ASSET_SEARCH_MIN_LENGTH;
  const isTaken = (r: AssetSearchResult) => excludeTickers.includes(r.ticker) || (r.isin != null && excludeIsins.includes(r.isin));

  useEffect(() => {
    if (query.trim().length < ASSET_SEARCH_MIN_LENGTH) return;
    // A newer keystroke cancels the pending search and drops any answer still on its way.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const found = await assetSearchService.search(query, controller.signal);
        if (controller.signal.aborted) return;
        setResults(found);
        setActive(found.findIndex((r) => !isTaken(r)));
        setStatus("done");
      } catch (err) {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(err instanceof Error ? err.message : "Search failed.");
        setStatus("error");
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // The exclusions only seed the highlighted row: it isn't a reason to search again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleInput = (next: string) => {
    setQuery(next);
    setOpen(true);
    setError(null);
    if (next.trim().length < ASSET_SEARCH_MIN_LENGTH) {
      setResults([]);
      setStatus("idle");
      setActive(-1);
    } else {
      setStatus("loading");
    }
  };

  const pick = (asset: AssetSearchResult) => {
    if (isTaken(asset)) return;
    onChange(asset);
    setOpen(false);
    setQuery("");
    setResults([]);
    setStatus("idle");
  };

  const clear = () => {
    onChange(null);
    // The input only mounts once the picked security is gone.
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const move = (step: 1 | -1) => {
    if (results.length === 0) return;
    let next = active;
    for (let i = 0; i < results.length; i++) {
      next = (next + step + results.length) % results.length;
      if (!isTaken(results[next])) break;
    }
    setActive(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      if (open && results[active]) {
        e.preventDefault();
        pick(results[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const labelEl = (
    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
      {label} {required && <span className="text-rose-500">*</span>}
    </span>
  );

  if (value) {
    return (
      <div>
        {labelEl}
        <div className="flex items-center gap-3 min-h-11 px-3.5 py-2 rounded-xl bg-white border border-slate-200">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 truncate">{value.name}</p>
            <p className="text-[11px] font-semibold text-slate-500 truncate">
              {assetListingLine(value)}{value.isin ? ` · ${value.isin}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            title="Pick another security"
            aria-label="Pick another security"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const showList = open && query.trim().length > 0;

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label htmlFor={`${listId}-input`}>{labelEl}</label>
      <div className="relative">
        <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id={`${listId}-input`}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-11 pl-10 pr-10 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold placeholder:text-slate-300 placeholder:font-normal outline-none focus:ring-4 focus:ring-slate-50 focus:border-slate-300 transition-all"
        />
        {status === "loading" && (
          <Loader2 className="h-4 w-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin" />
        )}
      </div>

      {showList && (
        <div className="absolute z-10 left-0 right-0 mt-1.5 rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-200/60 overflow-hidden">
          {!isSearchable ? (
            <p className="px-4 py-3 text-xs font-semibold text-slate-400">
              Type at least {ASSET_SEARCH_MIN_LENGTH} characters — name, ticker or ISIN.
            </p>
          ) : status === "loading" ? (
            <p className="px-4 py-3 text-xs font-semibold text-slate-400">Searching…</p>
          ) : status === "error" ? (
            <p className="px-4 py-3 text-xs font-semibold text-rose-600">{error}</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-xs font-semibold text-slate-500">
              No priced security matches &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto custom-scrollbar py-1">
              {results.map((r, i) => {
                const taken = isTaken(r);
                return (
                  <li
                    key={`${r.ticker}-${r.exchangeMic ?? ""}`}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    aria-disabled={taken}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => !taken && setActive(i)}
                    onClick={() => pick(r)}
                    className={`flex items-center gap-3 px-4 py-2.5 ${
                      taken ? "opacity-50 cursor-not-allowed" : `cursor-pointer ${i === active ? "bg-slate-50" : ""}`
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">{r.name}</p>
                      <p className="text-[11px] font-semibold text-slate-500 truncate">{assetListingLine(r)}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                      {taken ? "Already added" : r.isin}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
