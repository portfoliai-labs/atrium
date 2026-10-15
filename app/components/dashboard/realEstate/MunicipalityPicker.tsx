// components/dashboard/realEstate/MunicipalityPicker.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useRealEstate } from "../../../context/RealEstateContext";
import type { Municipality } from "../../../models/RealEstate";
import { INPUT } from "../wallets/WalletDialogs";

/**
 * MUNICIPALITY PICKER — Italy's municipality of a property, searched by name (accents and case
 * ignored) from the API's ISTAT list; it keeps the codice catastale (details.italy.municipalityCode),
 * which nobody knows by heart. A code already set is shown by its name.
 */
export function MunicipalityPicker({ code, onChange }: { code: string; onChange: (code: string) => void }) {
  const { source } = useRealEstate();
  const [picked, setPicked] = useState<Municipality | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // A code set before (an existing property's): its name.
  useEffect(() => {
    if (!code || picked?.code === code) return;
    let cancelled = false;
    source.municipalities({ codes: [code] })
      .then((list) => { if (!cancelled) setPicked(list[0] ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [code, picked?.code, source]);

  // The search goes out once typing stops, from 2 characters.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      source.municipalities({ search: q })
        .then((list) => { if (!cancelled) setResults(list); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, source]);

  // Closes on a click outside.
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (code) {
    return (
      <div className={`${INPUT} flex items-center justify-between gap-2`}>
        <span className="truncate">
          {picked && picked.code === code ? `${picked.name} (${picked.province})` : code}
          <span className="ml-1.5 text-[11px] font-bold text-slate-400">{code}</span>
        </span>
        <button type="button" onClick={() => { onChange(""); setPicked(null); setQuery(""); setResults([]); }} aria-label="Change municipality" className="text-slate-400 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const shown = query.trim().length >= 2 ? results : [];
  return (
    <div ref={box} className="relative">
      <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search the municipality"
        aria-label="Municipality"
        className={`${INPUT} pl-10`}
      />
      {loading && <Loader2 className="h-4 w-4 text-slate-400 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />}
      {open && query.trim().length >= 2 && !loading && (
        <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1">
          {shown.length === 0 ? (
            <li className="px-3.5 py-2 text-xs text-slate-400">No municipality matches.</li>
          ) : shown.map((m) => (
            <li key={m.code}>
              <button
                type="button"
                onClick={() => { setPicked(m); onChange(m.code); setOpen(false); }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-50"
              >
                <span className="text-sm font-semibold text-slate-800">{m.name}</span>
                <span className="ml-1.5 text-[11px] text-slate-400">{m.province} · {m.region} · {m.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
