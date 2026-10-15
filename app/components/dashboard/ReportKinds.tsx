// components/dashboard/ReportKinds.tsx
"use client";

import { useId } from "react";
import type { Document } from "../../models/Report";

/**
 * REPORT KINDS — every kind of report the app knows: what it's called, what it says, its cover
 * (the static picture its files show in Reports, see ReportsBrowser) and whether it can be
 * generated yet (see GenerateReportDialog). A new kind (a comparison between portfolios…) is a new
 * entry here, plus its options in the dialog.
 */
export type ReportKindId = "full" | "periodic" | "comparison";

export interface ReportKind {
  id: ReportKindId;
  label: string;
  description: string;
  // Offered in "Generate report": false = shown as coming soon; null = never offered there
  // (made by the backend alone).
  generate: boolean | null;
}

export const REPORT_KINDS: Record<ReportKindId, ReportKind> = {
  full: {
    id: "full",
    label: "Full history",
    description: "One portfolio from its first day: holdings, returns, costs and risk, as a PDF.",
    generate: true,
  },
  periodic: {
    id: "periodic",
    label: "Period statement",
    description: "One portfolio over a month, a quarter or a year.",
    generate: null,
  },
  comparison: {
    id: "comparison",
    label: "Portfolio comparison",
    description: "Two or more portfolios side by side: returns, risk and what they hold.",
    generate: false,
  },
};

/** The kind a saved report is: the backend's report_type (FULL, PERIODIC); full when unknown. */
export const reportKindOf = (doc: Pick<Document, "report_type">): ReportKind =>
  doc.report_type === "PERIODIC" ? REPORT_KINDS.periodic : REPORT_KINDS.full;

/**
 * REPORT COVER — a kind's static picture, filling its box (the box sets the size and the
 * rounding). Drawn here rather than shipped as images so they stay sharp at any size.
 */
export function ReportCover({ kind, className = "" }: { kind: ReportKindId; className?: string }) {
  return (
    <svg viewBox="0 0 240 150" preserveAspectRatio="xMidYMid slice" className={`block w-full h-full ${className}`} aria-hidden="true">
      {kind === "full" && <FullHistoryCover />}
      {kind === "periodic" && <PeriodicCover />}
      {kind === "comparison" && <ComparisonCover />}
    </svg>
  );
}

// Full history: a dark page with a gold return curve climbing across the whole of it.
function FullHistoryCover() {
  // Unique per cover: a grid of them shares one document.
  const id = useId();
  return (
    <>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#292524" />
          <stop offset="1" stopColor="#1c1917" />
        </linearGradient>
        <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C49A3C" stopOpacity="0.45" />
          <stop offset="1" stopColor="#C49A3C" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="240" height="150" fill={`url(#${id}-bg)`} />
      {[45, 75, 105].map((y) => <line key={y} x1="0" x2="240" y1={y} y2={y} stroke="#ffffff" strokeOpacity="0.06" />)}
      <path d="M0 128 L24 118 L44 122 L66 104 L88 108 L110 88 L132 92 L154 70 L176 76 L198 52 L220 58 L240 36 L240 150 L0 150 Z" fill={`url(#${id}-area)`} />
      <path d="M0 128 L24 118 L44 122 L66 104 L88 108 L110 88 L132 92 L154 70 L176 76 L198 52 L220 58 L240 36" fill="none" stroke="#C49A3C" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="240" cy="36" r="5" fill="#C49A3C" />
      <rect x="16" y="16" width="64" height="7" rx="3.5" fill="#ffffff" fillOpacity="0.85" />
      <rect x="16" y="29" width="40" height="5" rx="2.5" fill="#ffffff" fillOpacity="0.3" />
    </>
  );
}

// Period statement: a light page of monthly bars, the latest one in gold.
function PeriodicCover() {
  const bars = [40, 58, 46, 70, 62, 84];
  return (
    <>
      <rect width="240" height="150" fill="#F7F5EF" />
      <rect x="16" y="16" width="64" height="7" rx="3.5" fill="#1c1917" fillOpacity="0.8" />
      <rect x="16" y="29" width="40" height="5" rx="2.5" fill="#1c1917" fillOpacity="0.25" />
      {bars.map((h, i) => (
        <rect key={i} x={28 + i * 34} y={134 - h} width="20" height={h} rx="4" fill={i === bars.length - 1 ? "#C49A3C" : "#1c1917"} fillOpacity={i === bars.length - 1 ? 1 : 0.14} />
      ))}
      <line x1="16" x2="224" y1="134" y2="134" stroke="#1c1917" strokeOpacity="0.15" />
    </>
  );
}

// Portfolio comparison: two curves, gold and blue, crossing on a slate page.
function ComparisonCover() {
  return (
    <>
      <rect width="240" height="150" fill="#1e293b" />
      {[45, 75, 105].map((y) => <line key={y} x1="0" x2="240" y1={y} y2={y} stroke="#ffffff" strokeOpacity="0.06" />)}
      <path d="M0 120 L40 104 L80 110 L120 80 L160 86 L200 60 L240 50" fill="none" stroke="#C49A3C" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M0 100 L40 112 L80 90 L120 96 L160 70 L200 78 L240 64" fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <rect x="16" y="16" width="64" height="7" rx="3.5" fill="#ffffff" fillOpacity="0.85" />
      <rect x="16" y="29" width="40" height="5" rx="2.5" fill="#ffffff" fillOpacity="0.3" />
    </>
  );
}
