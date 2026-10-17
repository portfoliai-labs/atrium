// components/dashboard/GenerateReportDialog.tsx
"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, FileText, X } from "lucide-react";
import { PreviewBadge } from "../preview/PreviewKit";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";
import { ReportCover, type ReportKindId } from "./ReportKinds";

/** A kind of report the dialog offers, on its cover; `available` false = coming soon. */
export interface GenerateKindOption {
  id: string;
  cover: ReportKindId;
  label: string;
  description: string;
  available: boolean;
}

/** What a report can be about (a portfolio, a wallet), in its colour. */
export interface GenerateTarget {
  id: string;
  name: string;
  color: string;
}

/**
 * GENERATE REPORT DIALOG — Reports' "Generate report" (Investments' and Wallets'): first which kind
 * of report (`kinds`, each on its cover; the ones not ready yet shown as coming soon), then what
 * it's about (`targets`, called `targetLabel`: a must; none picked to start with unless there's
 * only one). `onGenerate` gets the choice; the page sends it and shows how it went. `readOnly`
 * (a demo account, or a preview): everything can be picked, but "Generate" stays off, saying why.
 */
export function GenerateReportDialog({ kinds, targets, targetLabel, readOnly = false, readOnlyTitle = DEMO_DISABLED_TITLE, onGenerate, onClose }: {
  kinds: GenerateKindOption[];
  targets: GenerateTarget[];
  // "Portfolio", "Wallet".
  targetLabel: string;
  readOnly?: boolean;
  readOnlyTitle?: string;
  onGenerate: (kindId: string, target: GenerateTarget) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState(kinds.find((k) => k.available)?.id ?? kinds[0]?.id ?? "");
  const [targetId, setTargetId] = useState(targets.length === 1 ? targets[0].id : "");
  const picked = kinds.find((k) => k.id === kind);
  const target = targets.find((t) => t.id === targetId);
  const ready = !!picked?.available && !!target;

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-report-title"
        className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="generate-report-title" className="text-xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Generate a report
            </h3>
            <p className="text-sm text-slate-500 mt-1">You&apos;ll get a notification when it&apos;s ready, and it lands in Reports.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 1. Which kind. */}
        <fieldset>
          <legend className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">1 · Kind of report</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {kinds.map((k) => {
              const available = k.available;
              const selected = kind === k.id;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => available && setKind(k.id)}
                  disabled={!available}
                  aria-pressed={selected}
                  className={`relative text-left rounded-2xl border-2 overflow-hidden transition-all ${
                    selected ? "border-[#C49A3C] shadow-md" : "border-slate-200 hover:border-slate-300"
                  } disabled:cursor-not-allowed disabled:hover:border-slate-200`}
                >
                  <div className={`h-24 ${available ? "" : "opacity-50 grayscale"}`}><ReportCover kind={k.cover} /></div>
                  <div className="p-4">
                    <p className="flex items-center gap-2 text-sm font-black text-slate-900">
                      {k.label}
                      {!available && <PreviewBadge label="Soon" />}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{k.description}</p>
                  </div>
                  {selected && (
                    <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#C49A3C] text-white flex items-center justify-center shadow">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 2. What it's about. */}
        <fieldset>
          <legend className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">2 · {targetLabel}</legend>
          <div className="flex flex-wrap gap-2">
            {targets.map((p) => {
              const selected = p.id === targetId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTargetId(p.id)}
                  aria-pressed={selected}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors ${
                    selected ? "bg-[#1c1917] border-[#1c1917] text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  {p.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500">
            {target && picked ? <>{picked.label} of <span className="text-slate-900">{target.name}</span></> : `Choose a ${targetLabel.toLowerCase()}.`}
          </p>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => target && !readOnly && onGenerate(kind, target)}
              disabled={!ready || readOnly}
              title={readOnly ? readOnlyTitle : undefined}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#1c1917] hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1c1917]"
            >
              <FileText className="h-4 w-4" />
              Generate
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
