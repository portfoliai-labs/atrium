"use client";

import { useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import { useUser } from "../../context/UserContext";
import { useInvestorPolicy } from "../../hooks/useInvestorPolicy";
import { IPS_STEPS, stepIssues } from "../../lib/ips";
import type { IpsStepId } from "../../models/InvestorPolicy";
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

/**
 * INVESTOR POLICY — the Investor Policy Statement, built one step at a time from Profile:
 * objectives, risk, constraints, allocation, guidelines and monitoring, then a review that reads
 * it back as a document. Every change is saved as it is made, so it can be left and resumed.
 */
export function InvestorPolicy() {
  const { user } = useUser();
  const { policy, status, update } = useInvestorPolicy(user?.uuid);
  const [view, setView] = useState<ViewId>("objectives");
  const cardRef = useRef<HTMLDivElement>(null);

  if (!policy) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-[#C49A3C]" />
      </div>
    );
  }

  const currency = user?.currency || "USD";
  const riskTolerance = user?.risk_tolerance ? RISK_LABELS[user.risk_tolerance] ?? null : null;
  const index = VIEWS.findIndex((v) => v.id === view);
  const current = VIEWS[index];
  const completed = IPS_STEPS.filter((s) => stepIssues(s.id, policy).length === 0).length;

  const goTo = (id: ViewId) => {
    setView(id);
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const stepProps: StepProps = { policy, update, currency };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-6 items-start">
      {/* Steps: numbered dots in one row on small screens, a labelled list from lg up. */}
      <nav
        aria-label="Investor policy steps"
        className="bg-white p-4 md:p-5 rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm space-y-4 lg:sticky lg:top-6"
      >
        <div className="hidden lg:block px-2 pt-1 space-y-2">
          <p className="text-xs font-bold text-[#1c1917]">{completed} of {IPS_STEPS.length} steps complete</p>
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

      <div
        ref={cardRef}
        className="bg-white p-6 md:p-8 rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm space-y-8 scroll-mt-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(196,154,60,0.15)] pb-5">
          <div>
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
          <SaveIndicator status={status} savedAt={policy.updated_at} />
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

        <div className="flex items-center justify-between gap-3 border-t border-[rgba(196,154,60,0.15)] pt-6">
          <button
            type="button"
            onClick={() => goTo(VIEWS[index - 1].id)}
            disabled={index === 0}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[rgba(196,154,60,0.3)] text-sm font-bold text-[#1c1917] hover:border-[#C49A3C] transition-colors disabled:opacity-0 disabled:pointer-events-none"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          {index < VIEWS.length - 1 && (
            <button
              type="button"
              onClick={() => goTo(VIEWS[index + 1].id)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors"
            >
              {VIEWS[index + 1].id === "review" ? "Review policy" : "Next"} <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ status, savedAt }: { status: "idle" | "saving" | "saved" | "error"; savedAt: string | null }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-[#78716c] min-h-5" aria-live="polite">
      {status === "saving" && (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>)}
      {status === "saved" && (<><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Saved on this device</>)}
      {status === "error" && (<><AlertCircle className="w-3.5 h-3.5 text-rose-500" /> Couldn&apos;t save your changes</>)}
      {status === "idle" && savedAt && (<><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Saved on this device</>)}
    </p>
  );
}
