// components/preview/PreviewKit.tsx
"use client";

import { FlaskConical, Lock } from "lucide-react";

/**
 * PREVIEW KIT — the pieces every not-yet-available feature is built from (Real estate, Wallets,
 * Explore, the property form in the transaction modal). Those pages run on sample data
 * from lib/mock and save nothing: they're here to show where the product is heading, and each
 * one says so up front (PreviewBanner), on its way in (PreviewBadge) and on every action that
 * would need a backend (ComingSoonButton).
 */

// Shared recharts tooltip box, same as the Insights pages' (see PerformanceSection).
export const TOOLTIP_STYLE: React.CSSProperties = { borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12, color: "#334155" };
export const AXIS_TICK = { fontSize: 11, fill: "#64748b" };

/** Small "Preview" pill for a way into a mocked feature: a sidebar entry, a hub card, a tab. */
export function PreviewBadge({ dark = false, label = "Preview" }: { dark?: boolean; label?: string }) {
  return (
    <span
      title="Not available yet — shown with sample data"
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.08em] leading-none shrink-0 border ${
        dark ? "bg-violet-400/15 text-violet-200 border-violet-300/30" : "bg-violet-50 text-violet-700 border-violet-200"
      }`}
    >
      <FlaskConical className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

/** The strip at the top of every mocked page: what it is, and that nothing here is real yet. */
export function PreviewBanner({ feature, children }: { feature: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50/80 px-4 py-3.5">
      <span className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
        <FlaskConical className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-black text-violet-900">
          {feature} is a preview — not available yet
        </p>
        <p className="text-xs text-violet-800/80 mt-0.5 leading-relaxed">
          {children ?? "Everything on this page is sample data, shown to give a feel for where PortfoliAI is heading. Nothing you do here is saved."}
        </p>
      </div>
    </div>
  );
}

/** An action that will need a backend: drawn as it will look, but disabled and labelled. */
export function ComingSoonButton({ icon, children, dark = true, className = "" }: { icon?: React.ReactNode; children: React.ReactNode; dark?: boolean; className?: string }) {
  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 cursor-not-allowed opacity-60 ${
        dark ? "bg-[#1c1917] text-white" : "bg-white border border-slate-200 text-slate-600"
      } ${className}`}
    >
      {icon ?? <Lock className="h-3.5 w-3.5" />}
      {children}
      <span className="text-[9px] font-black uppercase tracking-wider opacity-70">Soon</span>
    </button>
  );
}

/** A white card with a heading, like the Insights modules. */
export function Panel({
  title, subtitle, right, children, className = "",
}: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      <div className="px-6 md:px-7 pt-5 pb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/** One figure in a row of them: label over value, with an optional line under it. */
export function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "gain" | "loss" }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-base font-black tabular-nums mt-1 ${tone === "gain" ? "text-emerald-600" : tone === "loss" ? "text-rose-600" : "text-slate-900"}`}>
        {value}
      </p>
      {note && <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{note}</p>}
    </div>
  );
}

/** Pills to pick one of a few options (a property, a period, a filter). */
export function Pills<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
            value === o.value ? "bg-[#1c1917] text-white border-[#1c1917]" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;
export const formatPct = (pct: number, decimals = 1) => `${pct >= 0 ? "+" : ""}${pct.toFixed(decimals)}%`;
