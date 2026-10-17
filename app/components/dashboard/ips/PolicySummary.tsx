"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Copy, Download } from "lucide-react";
import { ASSET_CLASSES, IPS_STEPS, policySections, policyToMarkdown, stepIssues } from "../../../lib/ips";
import type { IpsStepId } from "../../../models/InvestorPolicy";
import { AllocationBar } from "./AllocationStep";
import type { StepProps } from "./steps";

/** The last step: what's still missing, and the finished policy as a document to copy or download. */
export function PolicySummary({
  policy, currency, riskTolerance, onGoToStep,
}: StepProps & { riskTolerance: string | null; onGoToStep: (step: IpsStepId) => void }) {
  const [copied, setCopied] = useState(false);
  const ctx = { currency, riskTolerance };
  const sections = policySections(policy, ctx);
  const done = IPS_STEPS.filter((s) => stepIssues(s.id, policy).length === 0).length;

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(policyToMarkdown(policy, ctx));
      setCopied(true);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(new Blob([policyToMarkdown(policy, ctx)], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "investor-policy-statement.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-semibold text-[#44403c]">
          {done === IPS_STEPS.length
            ? "Your policy is complete."
            : `${done} of ${IPS_STEPS.length} steps complete. You can export it at any point.`}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[rgba(196,154,60,0.3)] bg-white text-xs font-bold text-[#1c1917] hover:border-[#C49A3C] transition-colors"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] transition-colors"
          >
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {IPS_STEPS.map((s) => {
          const issues = stepIssues(s.id, policy);
          return (
            <div key={s.id} className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-[#F7F5EF]">
              {issues.length === 0
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                : <Circle className="w-4 h-4 mt-0.5 shrink-0 text-[#a8a29e]" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1c1917]">{s.label}</p>
                {issues.length > 0 && (
                  <ul className="text-xs text-[#78716c] font-medium mt-0.5 space-y-0.5">
                    {issues.map((i) => <li key={i}>{i}</li>)}
                  </ul>
                )}
              </div>
              <button
                type="button"
                onClick={() => onGoToStep(s.id)}
                className="text-xs font-bold text-[#C49A3C] hover:text-[#1c1917] transition-colors shrink-0"
              >
                {issues.length === 0 ? "Edit" : "Complete"}
              </button>
            </div>
          );
        })}
      </div>

      <article className="space-y-8 border-t border-[rgba(196,154,60,0.15)] pt-8">
        <h3 className="text-xl font-bold text-[#1c1917]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Investor Policy Statement
        </h3>
        {sections.map((s, i) => (
          <section key={s.id} className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#78716c]">
              {i + 1}. {s.title}
            </h4>
            {s.id === "allocation" && (
              <div className="pb-2">
                <AllocationBar targets={policy.allocation.targets} />
                <ul className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                  {ASSET_CLASSES.filter((c) => (policy.allocation.targets[c.id] ?? 0) > 0).map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-xs font-semibold text-[#44403c]">
                      <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: c.color }} aria-hidden />
                      {c.label} {policy.allocation.targets[c.id]}%
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <dl className="grid grid-cols-1 sm:grid-cols-[13rem_1fr] gap-x-6 gap-y-2 text-sm">
              {s.rows.map((r, j) => (
                <div key={`${r.label}-${j}`} className="contents">
                  <dt className="font-semibold text-[#78716c]">{r.label}</dt>
                  <dd className={`font-bold whitespace-pre-wrap ${r.value === "Not specified" ? "text-[#a8a29e]" : "text-[#1c1917]"}`}>
                    {r.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </article>
    </div>
  );
}
