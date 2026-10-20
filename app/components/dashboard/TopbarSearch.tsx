"use client";

import { useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { listingLine, type Listing } from "../../models/Listing";
import { LISTING_SEARCH_MIN_LENGTH } from "../../services/listingService";
import { useListingSearch } from "../../hooks/useListingSearch";

/**
 * TOPBAR SEARCH — census' listings searched from the top bar, in place: hovering the button (a
 * tap, without a mouse) slides a field open beside it, the matches drop below it as the user
 * types, and the one picked opens its page (`onOpen`). It closes again when the pointer leaves
 * with nothing typed, on Esc, or once a security is picked.
 */
export function TopbarSearch({ onOpen }: { onOpen: (listing: Listing) => void }) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const { searchable, status, results, error } = useListingSearch(query, (found) => setActive(found.length > 0 ? 0 : -1));

  const typed = query.trim().length > 0;
  const showList = expanded && focused && typed;

  const expand = () => {
    setExpanded(true);
    // Focused once the field has started sliding open, so the first keystroke lands in it.
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };

  const collapse = () => {
    setExpanded(false);
    setQuery("");
    setActive(-1);
    inputRef.current?.blur();
  };

  const pick = (listing: Listing) => {
    collapse();
    onOpen(listing);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + step + results.length) % results.length);
    } else if (e.key === "Enter") {
      if (results[active]) {
        e.preventDefault();
        pick(results[active]);
      }
    } else if (e.key === "Escape") {
      collapse();
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => !expanded && expand()}
      onMouseLeave={() => !typed && collapse()}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setFocused(false);
        if (!typed) setExpanded(false);
      }}
    >
      <div
        className={`flex items-center h-10 md:h-11 rounded-xl md:rounded-2xl border transition-all duration-300 ease-out ${
          expanded
            ? "w-44 sm:w-64 md:w-72 bg-white border-[rgba(196,154,60,0.35)] shadow-sm"
            : "w-10 md:w-11 border-transparent hover:bg-[#E0DACC]"
        }`}
      >
        <button
          type="button"
          onClick={() => (expanded ? inputRef.current?.focus() : expand())}
          title="Search securities"
          aria-label="Search securities"
          className="shrink-0 flex items-center justify-center w-10 md:w-11 h-full text-[#857e78] hover:text-[#1c1917] transition-colors"
        >
          {status === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
        </button>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          tabIndex={expanded ? 0 : -1}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Name, ticker or ISIN"
          className={`min-w-0 flex-1 bg-transparent pr-3 text-sm font-semibold text-[#1c1917] placeholder:text-[#857e78] placeholder:font-normal outline-none transition-opacity duration-200 ${
            expanded ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        />
      </div>

      {showList && (
        <div className="absolute right-0 top-full mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl bg-white border border-[#E0DACC] shadow-xl shadow-stone-300/40 overflow-hidden z-10">
          {!searchable ? (
            <p className="px-4 py-3 text-xs font-semibold text-[#857e78]">
              Type at least {LISTING_SEARCH_MIN_LENGTH} characters — name, ticker or ISIN.
            </p>
          ) : status === "loading" ? (
            <p className="px-4 py-3 text-xs font-semibold text-[#857e78]">Searching…</p>
          ) : status === "error" ? (
            <p className="px-4 py-3 text-xs font-semibold text-rose-600">{error}</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-xs font-semibold text-[#78716c]">No security matches &ldquo;{query.trim()}&rdquo;.</p>
          ) : (
            <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto custom-scrollbar py-1">
              {results.map((r, i) => (
                <li
                  key={r.listingId}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(r)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${i === active ? "bg-[#F7F5EF]" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#1c1917] truncate">{r.name}</p>
                    <p
                      className="text-[11px] font-semibold text-[#78716c] truncate"
                      title={r.currencyConfirmed ? undefined : `${r.currency}: presumed from the market until a price confirms it`}
                    >
                      {listingLine(r)}
                    </p>
                  </div>
                  {r.isin && <span className="text-[10px] font-semibold text-[#857e78] shrink-0">{r.isin}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
