"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardList, Loader2, X,
} from "lucide-react";
import { useUser } from "../../context/UserContext";
import type { IpsSaveStatus } from "../../hooks/useInvestorPolicy";
import { IPS_STEPS, completedSteps, stepIssues } from "../../lib/ips";
import type { InvestorPolicy, IpsStepId } from "../../models/InvestorPolicy";
import { AllocationStep } from "./ips/AllocationStep";
import { PolicySummary } from "./ips/PolicySummary";
import {
  ConstraintsStep, GuidelinesStep, MonitoringStep, ObjectivesStep, RiskStep, type StepProps,
} from "./ips/steps";

type ViewId = IpsStepId | "review";

const VIEWS: { id: ViewId; label: string; description: string }[] = [
  ...IPS_STEPS,
  { id: "review", label: "Review", description: "Your policy as a document, and what is still missing." },
];

const RISK_LABELS: Record<string, string> = { low: "Conservative", medium: "Moderate", high: "Aggressive" };

interface InvestorPolicyDialogProps {
  policy: InvestorPolicy;
  status: IpsSaveStatus;
  update: StepProps["update"];
  onClose: () => void;
}

/**
 * INVESTOR POLICY — the Investor Policy Statement, built one step at a time in a dialog opened
 * from Profile: objectives, risk, constraints, allocation, guidelines and monitoring, then a
 * review that reads it back as a document. The policy and its saving belong to the caller (the
 * Profile page also shows its progress); every change is saved as it is made, so closing the
 * dialog at any point loses nothing.
 */
export function InvestorPolicyDialog({ policy, status, update, onClose }: InvestorPolicyDialogProps) {
  const { user } = useUser();
  const [view, setView] = useState<ViewId>("objectives");
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Read through a ref so a caller passing a new function each render doesn't re-run the setup
  // below (which would move focus back to the panel in the middle of typing).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    // The page behind must not scroll while the dialog is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const currency = user?.currency || "USD";
  const riskTolerance = user?.risk_tolerance ? RISK_LABELS[user.risk_tolerance] ?? null : null;
  const index = VIEWS.findIndex((v) => v.id === view);
  const current = VIEWS[index];
  const completed = completedSteps(policy).length;

  const goTo = (id: ViewId) => {
    setView(id);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const stepProps: StepProps = { policy, update, currency };

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#1c1917]/40 backdrop-blur-sm sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ips-dialog-title"
        tabIndex={-1}
        className="bg-white w-full h-full sm:h-[min(52rem,calc(100dvh-2rem))] sm:max-w-5xl sm:rounded-4xl sm:border border-[rgba(196,154,60,0.2)] shadow-2xl flex flex-col overflow-hidden outline-none animate-in zoom-in-95 duration-200"
      >
        <header className="flex items-center justify-between gap-4 px-5 md:px-8 py-4 md:py-5 border-b border-[rgba(196,154,60,0.15)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-[#F7F5EF] text-[#C49A3C] rounded-xl shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="ips-dialog-title"
                className="text-lg md:text-xl font-bold text-[#1c1917] tracking-tight"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                Investment Policy
              </h2>
              <p className="text-xs text-[#78716c] font-medium">{completed} of {IPS_STEPS.length} steps complete</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <SaveIndicator status={status} savedAt={policy.updated_at} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 text-[#a8a29e] hover:text-[#1c1917] hover:bg-[#F7F5EF] rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Steps: numbered dots in one row on small screens, a labelled list from lg up. */}
          <nav
            aria-label="Investor policy steps"
            className="shrink-0 lg:w-60 p-3 lg:p-4 border-b lg:border-b-0 lg:border-r border-[rgba(196,154,60,0.15)] lg:overflow-y-auto"
          >
            <div className="hidden lg:block px-2 pb-4 space-y-2">
              <div className="h-1.5 rounded-full bg-[#ece6d6] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#C49A3C] transition-all duration-500"
                  style={{ width: `${(completed / IPS_STEPS.length) * 100}%` }}
                />
              </div>
            </div>

            <ol className="grid grid-cols-7 lg:grid-cols-1 gap-1">
              {VIEWS.map((v, i) => {
                const active = v.id === view;
                const complete = v.id !== "review" && stepIssues(v.id, policy).length === 0;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => goTo(v.id)}
                      aria-current={active ? "step" : undefined}
                      aria-label={`${v.label}${complete ? ", complete" : ""}`}
                      className={`w-full flex flex-col lg:flex-row items-center gap-1.5 lg:gap-3 px-1 lg:px-3 py-2 lg:py-2.5 rounded-xl text-left transition-colors ${
                        active ? "bg-[#1c1917] text-white" : "text-[#78716c] hover:bg-[#F7F5EF] hover:text-[#1c1917]"
                      }`}
                    >
                      <span
                        className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-black ${
                          complete
                            ? "bg-emerald-600 text-white"
                            : active
                            ? "bg-white text-[#1c1917]"
                            : "bg-[#F7F5EF] text-[#78716c]"
                        }`}
                      >
                        {complete ? <Check className="w-3.5 h-3.5" /> : v.id === "review" ? <ClipboardList className="w-3.5 h-3.5" /> : i + 1}
                      </span>
                      <span className="hidden lg:inline text-sm font-bold">{v.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div ref={scrollRef} className="flex-1 min-w-0 min-h-0 overflow-y-auto p-5 md:p-8 space-y-8">
            <div className="border-b border-[rgba(196,154,60,0.15)] pb-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#C49A3C]">
                Step {index + 1} of {VIEWS.length}
              </p>
              <h3
                className="text-xl md:text-2xl font-bold text-[#1c1917] tracking-tight mt-1"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {current.label}
              </h3>
              <p className="text-sm text-[#78716c] font-medium mt-1">{current.description}</p>
            </div>

            {view === "objectives" && <ObjectivesStep {...stepProps} />}
            {view === "risk" && <RiskStep {...stepProps} riskTolerance={riskTolerance} />}
            {view === "constraints" && <ConstraintsStep {...stepProps} />}
            {view === "allocation" && <AllocationStep {...stepProps} />}
            {view === "guidelines" && <GuidelinesStep {...stepProps} />}
            {view === "monitoring" && <MonitoringStep {...stepProps} />}
            {view === "review" && (
              <PolicySummary {...stepProps} riskTolerance={riskTolerance} onGoToStep={goTo} />
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 px-5 md:px-8 py-4 border-t border-[rgba(196,154,60,0.15)]">
          <button
            type="button"
            onClick={() => goTo(VIEWS[index - 1].id)}
            disabled={index === 0}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[rgba(196,154,60,0.3)] text-sm font-bold text-[#1c1917] hover:border-[#C49A3C] transition-colors disabled:opacity-0 disabled:pointer-events-none"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          {index < VIEWS.length - 1 ? (
            <button
              type="button"
              onClick={() => goTo(VIEWS[index + 1].id)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors"
            >
              {VIEWS[index + 1].id === "review" ? "Review policy" : "Next"} <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors"
            >
              Done
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function SaveIndicator({ status, savedAt }: { status: IpsSaveStatus; savedAt: string | null }) {
  // On narrow screens only the icon shows; the text is for anyone with room.
  const text = "hidden sm:inline";
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-[#78716c] min-h-5" aria-live="polite">
      {status === "saving" && (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> <span className={text}>Saving…</span></>)}
      {status === "saved" && (<><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> <span className={text}>Saved on this device</span></>)}
      {status === "error" && (<><AlertCircle className="w-3.5 h-3.5 text-rose-500" /> <span className={text}>Couldn&apos;t save your changes</span></>)}
      {status === "idle" && savedAt && (<><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> <span className={text}>Saved on this device</span></>)}
    </p>
  );
}
