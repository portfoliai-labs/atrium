"use client";

import { ChevronDown, Layers } from "lucide-react";
import type { Portfolio } from "../../models/Portfolio";

/**
 * PORTFOLIO PICKER — which portfolio a simulation runs on (Plan's Projection and Stress test), as
 * the first field of its form: All portfolios, marked by its icon, or a portfolio, by its colour.
 * Only the one there is: its name, nothing to pick.
 */
export function PortfolioPicker({ portfolios, value, onChange, colorOf }: {
  portfolios: Portfolio[];
  value: string;
  onChange: (uuid: string) => void;
  colorOf: (uuid: string) => string;
}) {
  const picked = portfolios.find((p) => p.uuid === value);
  const mark = picked?.isAggregate
    ? <Layers className="h-3.5 w-3.5 text-[#C49A3C]" />
    : <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: picked ? colorOf(picked.uuid) : undefined }} />;
  const single = portfolios.length < 2;
  return (
    <label className="block">
      <span className="block text-[10px] font-bold text-[#78716c] uppercase tracking-wider mb-1.5">Portfolio</span>
      <span className="relative block">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">{mark}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={single}
          className="w-full h-11 pl-9 pr-9 rounded-xl bg-[#FBF6EA] border border-[#C49A3C]/50 text-sm font-bold text-[#1c1917] outline-none appearance-none cursor-pointer transition-colors hover:border-[#C49A3C] focus:border-[#C49A3C] focus:ring-4 focus:ring-[#C49A3C]/10 disabled:cursor-default disabled:hover:border-[#C49A3C]/50"
        >
          {portfolios.map((p) => <option key={p.uuid} value={p.uuid}>{p.name}</option>)}
        </select>
        {!single && <ChevronDown className="h-4 w-4 text-[#a8a29e] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
      </span>
    </label>
  );
}
