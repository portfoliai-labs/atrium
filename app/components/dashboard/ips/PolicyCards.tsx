"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Pencil, X } from "lucide-react";
import { ASSET_CLASSES, IPS_STEPS, policySections, stepIssues } from "../../../lib/ips";
import type { IpsSaveStatus } from "../../../hooks/useInvestorPolicy";
import type { InvestorPolicy, IpsStepId } from "../../../models/InvestorPolicy";
import { PolicyStepForm, SaveIndicator } from "../InvestorPolicyDialog";
import { AllocationBar } from "./AllocationStep";
import type { StepProps } from "./steps";

const SERIF = { fontFamily: "'Playfair Display', Georgia, serif" };
const NOT_SET = "Not specified";
// The rows a card shows: the first few of its section, the rest in its Edit.
const CARD_ROWS = 4;

/**
 * POLICY CARDS — the Investor Policy once it's been set up, one card per step on Profile: its
 * section of the policy (policySections, the review's own) in a few rows, what's missing should an
 * edit leave it incomplete, and Edit, which opens that step's form alone (PolicyStepDialog).
 */
export function PolicyCards({ policy, status, update, currency, riskTolerance, leading }: {
  // Cards of Profile's own placed first in the same grid (its Preferences).
  leading?: ReactNode;
  policy: InvestorPolicy;
  status: IpsSaveStatus;
  update: StepProps["update"];
  currency: string;
  riskTolerance: string | null;
}) {
  const [editing, setEditing] = useState<IpsStepId | null>(null);
  const sections = policySections(policy, { currency, riskTolerance });

  return (
    <>
      <div className={PROFILE_GRID}>
        {leading}
        {sections.map((section) => {
          const issues = stepIssues(section.id, policy);
          const description = IPS_STEPS.find((s) => s.id === section.id)?.description;
          const rows = section.rows.slice(0, CARD_ROWS);
          const more = section.rows.length - rows.length;
          return (
            <ProfileCard
              key={section.id}
              title={section.title}
              description={description}
              onEdit={() => setEditing(section.id)}
              wide={section.id === "allocation"}
              warn={issues.length > 0}
            >
              {section.id === "allocation" && (
                <div>
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

              {section.id !== "allocation" && (
                <ProfileRows rows={rows} footer={more > 0 ? `and ${more} more in Edit` : undefined} />
              )}

              {issues.length > 0 && (
                <p className="mt-auto flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {issues.join(" · ")}
                </p>
              )}
            </ProfileCard>
          );
        })}
      </div>

      {editing && (
        <PolicyStepDialog
          step={editing}
          policy={policy}
          status={status}
          update={update}
          currency={currency}
          riskTolerance={riskTolerance}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

/** One step of the policy, alone in a dialog: saved as it's changed, like the guided setup. */
function PolicyStepDialog({ step, policy, status, update, currency, riskTolerance, onClose }: StepProps & {
  step: IpsStepId;
  status: IpsSaveStatus;
  riskTolerance: string | null;
  onClose: () => void;
}) {
  const meta = IPS_STEPS.find((s) => s.id === step);
  return (
    <ProfileDialog
      title={meta?.label ?? ""}
      description={meta?.description}
      status={<SaveIndicator status={status} savedAt={policy.savedAt} />}
      size="wide"
      onClose={onClose}
      footer={(
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-3 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors"
        >
          Done
        </button>
      )}
    >
      <PolicyStepForm step={step} policy={policy} update={update} currency={currency} riskTolerance={riskTolerance} />
    </ProfileDialog>
  );
}

// Profile's cards: two to a row from md, a wide one across.
export const PROFILE_GRID = "grid grid-cols-1 md:grid-cols-2 gap-5";

/** A card of Profile: its title and what it's about, Edit, and its summary under them. */
export function ProfileCard({ title, description, onEdit, editDisabled, wide = false, warn = false, children }: {
  title: string;
  description?: string;
  onEdit: () => void;
  // A reason Edit can't be used (a demo account), as its title.
  editDisabled?: string;
  wide?: boolean;
  // Something's missing: a warmer border.
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`bg-white p-6 rounded-[2rem] border shadow-sm flex flex-col gap-4 ${wide ? "md:col-span-2" : ""} ${
        warn ? "border-amber-300" : "border-[rgba(196,154,60,0.2)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-[#1c1917]" style={SERIF}>{title}</h3>
          {description && <p className="text-xs text-[#78716c] mt-0.5">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onEdit}
          disabled={!!editDisabled}
          title={editDisabled}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[rgba(196,154,60,0.3)] text-xs font-bold text-[#1c1917] hover:border-[#C49A3C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
      </div>
      {children}
    </section>
  );
}

/** A card's rows: a label, and its value on the right ("Not specified" muted). */
export function ProfileRows({ rows, footer }: { rows: { label: string; value: ReactNode }[]; footer?: string }) {
  return (
    <dl className="space-y-2 text-sm">
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <dt className="font-semibold text-[#78716c]">{r.label}</dt>
          <dd className={`font-bold text-right whitespace-pre-wrap ${r.value === NOT_SET ? "text-[#857e78]" : "text-[#1c1917]"}`}>
            {r.value}
          </dd>
        </div>
      ))}
      {footer && <p className="text-xs font-semibold text-[#857e78]">{footer}</p>}
    </dl>
  );
}

/** A card's Edit, as a dialog: a title, the form, and its buttons. */
export function ProfileDialog({ title, description, status, size = "narrow", footer, onClose, children }: {
  title: string;
  description?: string;
  // Beside the close button: how saving goes.
  status?: ReactNode;
  size?: "narrow" | "wide";
  footer: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#1c1917]/40 backdrop-blur-sm sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-dialog-title"
        tabIndex={-1}
        className={`bg-white w-full h-full sm:h-auto sm:max-h-[calc(100dvh-2rem)] ${size === "wide" ? "sm:max-w-3xl" : "sm:max-w-lg"} sm:rounded-4xl sm:border border-[rgba(196,154,60,0.2)] shadow-2xl flex flex-col overflow-hidden outline-none animate-in zoom-in-95 duration-200`}
      >
        <header className="flex items-start justify-between gap-4 px-5 md:px-8 py-4 md:py-5 border-b border-[rgba(196,154,60,0.15)]">
          <div className="min-w-0">
            <h2 id="profile-dialog-title" className="text-lg md:text-xl font-bold text-[#1c1917] tracking-tight" style={SERIF}>
              {title}
            </h2>
            {description && <p className="text-xs text-[#78716c] font-medium mt-0.5">{description}</p>}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {status}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 text-[#857e78] hover:text-[#1c1917] hover:bg-[#F7F5EF] rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto p-5 md:p-8 space-y-8">{children}</div>
        <footer className="flex items-center justify-end gap-3 px-5 md:px-8 py-4 border-t border-[rgba(196,154,60,0.15)]">{footer}</footer>
      </div>
    </div>,
    document.body,
  );
}
