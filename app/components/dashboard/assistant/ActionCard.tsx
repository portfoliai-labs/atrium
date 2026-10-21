"use client";

import { useEffect, useState } from "react";
import { Ban, Check, Clock, Download, Loader2, TriangleAlert } from "lucide-react";
import { ApiError } from "../../../services/apiClient";
import { conversationService } from "../../../services/conversationService";
import type { ActionState, AssistantAction } from "../../../models/Conversation";
import { saveReportFile } from "../ReportsList";

// What the user reads about a failure the domain wrote nothing for, by its reason.
const FAILURES: Record<string, string> = {
  PLAN_LIMIT_EXCEEDED: "Your plan doesn't include reports.",
  REPORT_ALREADY_EXISTS: "A report on it is already being generated.",
  VIRTUAL_PORTFOLIO_OPERATION: "Reports aren't available for a virtual portfolio.",
};

const STATES: ActionState[] = ["proposed", "running", "done", "failed", "cancelled", "expired"];

/**
 * An action the assistant proposed in an answer (a report asked for), drawn as a card: what it
 * would do, Confirm and Cancel while it waits for the user, then its outcome. Nothing runs
 * without the user's click; the state the server answers with (or sends as `action_changed`) is
 * passed up through `onChange`. While its answer is still being written it can't be confirmed yet
 * (`writing`: the server keeps it once the answer is whole).
 */
export function ActionCard({ action, conversationUuid, onChange, writing = false }: {
  action: AssistantAction;
  conversationUuid: string;
  onChange: (action: AssistantAction) => void;
  writing?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expired = useExpired(action);
  const state: ActionState = action.state === "proposed" && expired ? "expired" : action.state;

  const settle = async (confirm: boolean) => {
    setBusy(true);
    setError(null);
    try {
      onChange(confirm
        ? await conversationService.confirmAction(conversationUuid, action.actionId)
        : await conversationService.cancelAction(conversationUuid, action.actionId));
    } catch (err) {
      const settled = err instanceof ApiError ? settledState(err) : null;
      if (settled) onChange({ ...action, state: settled });
      else setError(err instanceof ApiError && err.errorType === "ReadOnlyAccountError"
        ? "This is a demo account: actions aren't available on it."
        : "That didn't go through. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!action.downloadPath) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await conversationService.actionDownload(action.downloadPath);
      await saveReportFile(url, reportName(action));
    } catch {
      setError("The report couldn't be downloaded. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 space-y-3 ${
      state === "cancelled" || state === "expired" ? "border-[#e7e5e4] bg-[#fafaf9]" : "border-[rgba(196,154,60,0.35)] bg-[#fffdf8]"
    }`}>
      <p className="text-sm font-bold text-[#1c1917]">{action.title}</p>
      {action.details.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {action.details.map((detail, i) => (
            <div key={i} className="contents">
              <dt className="text-[#78716c]">{detail.label}</dt>
              <dd className="text-[#1c1917] wrap-break-word">{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <Outcome action={action} state={state} busy={busy || writing} onConfirm={() => settle(true)} onCancel={() => settle(false)} onDownload={download} />
      {error && <p className="text-xs text-[#b91c1c]">{error}</p>}
    </div>
  );
}

function Outcome({ action, state, busy, onConfirm, onCancel, onDownload }: {
  action: AssistantAction;
  state: ActionState;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onDownload: () => void;
}) {
  switch (state) {
    case "proposed":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onConfirm} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1c1917] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Confirm
          </button>
          <button onClick={onCancel} disabled={busy}
            className="rounded-full border border-[#d6d3d1] px-4 py-1.5 text-xs font-semibold text-[#44403c] disabled:opacity-50">
            Cancel
          </button>
          <span className="text-[11px] text-[#78716c]">
            {busy ? "Just a moment…" : "Nothing happens until you confirm."}
          </span>
        </div>
      );
    case "running":
      return (
        <p className="flex items-center gap-2 text-xs text-[#78716c]">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C49A3C]" /> In progress: you&apos;ll find it here when it&apos;s ready.
        </p>
      );
    case "done":
      return action.downloadPath ? (
        <button onClick={onDownload} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#C49A3C] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Download the report
        </button>
      ) : (
        <p className="flex items-center gap-2 text-xs text-[#15803d]"><Check className="w-3.5 h-3.5" /> Done.</p>
      );
    case "failed":
      return (
        <p className="flex items-start gap-2 text-xs text-[#b91c1c]">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
          {action.failureMessage ?? FAILURES[action.failureReason ?? ""] ?? "It couldn't be done."}
        </p>
      );
    case "cancelled":
      return <p className="flex items-center gap-2 text-xs text-[#78716c]"><Ban className="w-3.5 h-3.5" /> Cancelled.</p>;
    case "expired":
      return <p className="flex items-center gap-2 text-xs text-[#78716c]"><Clock className="w-3.5 h-3.5" /> Expired: ask again if you still want it.</p>;
  }
}

// Whether a proposal is past its time, turning true when it gets there while shown.
function useExpired(action: AssistantAction): boolean {
  const expiresAt = new Date(action.expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (action.state !== "proposed") return;
    const left = expiresAt - Date.now();
    if (left <= 0) return;
    // A proposal lives a day: well within setTimeout's limit.
    const timer = setTimeout(() => setNow(Date.now()), left);
    return () => clearTimeout(timer);
  }, [action.state, expiresAt]);
  return now >= expiresAt;
}

// The state a refusal says the action is in: settled meanwhile (another tab), or expired.
function settledState(err: ApiError): ActionState | null {
  if (err.errorType === "ActionExpiredError") return "expired";
  if (err.errorType !== "ActionAlreadySettledError") return null;
  const state = err.metadata.state as ActionState | undefined;
  return state && STATES.includes(state) ? state : null;
}

function reportName(action: AssistantAction): string {
  return action.details.find((detail) => detail.label === "Name")?.value || "Report";
}
