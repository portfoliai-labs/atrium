"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { reportService } from "../../services/reportService";
import { ApiError } from "../../services/apiClient";
import type { Portfolio } from "../../models/Portfolio";

type RequestState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "queued" }
  // The backend runs one report per portfolio at a time and answers 409 while one is in flight.
  | { kind: "conflict" }
  | { kind: "error"; message: string };

/**
 * USE GENERATE REPORT — queues a full-history report on a portfolio (POST .../reports, FULL
 * only for now, named after the portfolio) and returns the toast that says how it went.
 * Once queued, progress arrives as notifications and the PDF lands in Reports. A 409 means a
 * report is already being generated for this portfolio; the toast then offers to start this
 * one anyway (force).
 */
export function useGenerateReport() {
  const [state, setState] = useState<RequestState>({ kind: "idle" });
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  const send = async (target: Portfolio, force = false) => {
    setPortfolio(target);
    setState({ kind: "sending" });
    try {
      await reportService.createReport(target.uuid, {
        filename: `${target.name} — Full history`,
        report_type: "FULL",
        ...(force ? { force: true } : {}),
      });
      setState({ kind: "queued" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && !force) setState({ kind: "conflict" });
      else setState({ kind: "error", message: err instanceof Error ? err.message : "Unable to generate the report." });
    }
  };

  // A confirmation clears itself; a question or an error waits for the user.
  useEffect(() => {
    if (state.kind !== "queued") return;
    const timer = setTimeout(() => setState({ kind: "idle" }), 6000);
    return () => clearTimeout(timer);
  }, [state]);

  const toast = state.kind === "idle" ? null : (
    <ReportToast
      state={state}
      onForce={() => portfolio && send(portfolio, true)}
      onClose={() => setState({ kind: "idle" })}
    />
  );

  return { generate: (target: Portfolio) => send(target), sending: state.kind === "sending", toast };
}

/**
 * REPORT TOAST — bottom-centred, styled like Transactions' toast. Portaled to <body> so it
 * stays fixed to the viewport whatever transformed ancestor the bar sits in.
 */
function ReportToast({ state, onForce, onClose }: { state: Exclude<RequestState, { kind: "idle" }>; onForce: () => void; onClose: () => void }) {
  const isError = state.kind === "error";
  const title =
    state.kind === "sending" ? "Requesting your report…"
      : state.kind === "queued" ? "Report on its way"
        : state.kind === "conflict" ? "A report is already in progress"
          : "Couldn't generate the report";
  const body =
    state.kind === "sending" ? "Hang on a moment."
      : state.kind === "queued" ? "You'll get a notification when it's ready, and you'll find it in Reports."
        : state.kind === "conflict" ? "One is still being generated for this portfolio. Wait for it, or start a new one anyway."
          : state.message;

  return createPortal(
    <div
      role="status"
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-100 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 w-[calc(100%-2rem)] max-w-lg ${
        isError ? "bg-rose-500 text-white" : "bg-slate-900 text-white"
      }`}
    >
      {state.kind === "sending" ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#C49A3C]" />
      ) : state.kind === "queued" ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
      ) : (
        <AlertCircle className={`h-5 w-5 shrink-0 ${isError ? "text-rose-200" : "text-amber-400"}`} />
      )}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-bold">{title}</span>
        <span className="text-xs opacity-80">{body}</span>
      </div>
      {state.kind === "conflict" && (
        <button onClick={onForce} className="shrink-0 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold transition-colors">
          Generate anyway
        </button>
      )}
      {state.kind !== "sending" && (
        <button onClick={onClose} aria-label="Dismiss" className="shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>,
    document.body,
  );
}
