// components/dashboard/journal/ReportDialog.tsx
"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Flag, Loader2, X } from "lucide-react";
import type { ReportReason } from "../../../models/Journal";
import { journalService } from "../../../services/journalService";
import { NOTE_MAX, REASONS, REASON_LABELS, journalErrorText } from "../../../lib/journal";
import { ApiError } from "../../../services/apiClient";

/** What a report is about: an article, or a comment under one. */
export type ReportTarget = { kind: "article" | "comment"; uuid: string };

/**
 * Reports an article or a comment to the editors: a reason from the fixed list and a note
 * (required with "Something else"). Reporting again while the last report is open replaces it.
 */
export function ReportDialog({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const what = target.kind === "comment" ? "comment" : "article";
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const noteNeeded = reason === "other" && !note.trim();

  const send = async () => {
    if (!reason || noteNeeded) return;
    setSending(true);
    setError(null);
    try {
      if (target.kind === "comment") await journalService.reportComment(target.uuid, reason, note.trim());
      else await journalService.report(target.uuid, reason, note.trim());
      setSent(true);
    } catch (err) {
      const own = err instanceof ApiError && (err.errorType === "OwnArticleError" || err.errorType === "OwnCommentError");
      setError(own ? `You can't report your own ${what}.` : journalErrorText(err, "The report couldn't be sent."));
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => !sending && onClose()}>
      <div className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-md w-full p-6 md:p-8 space-y-5 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 rounded-xl shrink-0"><Flag className="h-5 w-5 text-rose-600" /></div>
            <h3 className="text-lg font-black text-slate-900">Report this {what}</h3>
          </div>
          <button onClick={onClose} disabled={sending} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="space-y-4">
            <p className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              Thanks: the editors will look at it. You&apos;ll find their decision under Saved, in your reports.
            </p>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800">Done</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 leading-relaxed">Tell the editors what&apos;s wrong. Your report is anonymous to the author.</p>
            <div className="space-y-1.5">
              {REASONS.map((r) => (
                <label key={r} className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer text-sm transition-colors ${reason === r ? "border-[#C49A3C] bg-[#C49A3C]/5 text-slate-900 font-semibold" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                  <input type="radio" name="report-reason" className="accent-[#C49A3C]" checked={reason === r} onChange={() => setReason(r)} />
                  {REASON_LABELS[r]}
                </label>
              ))}
            </div>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{reason === "other" ? "What's wrong (required)" : "Anything to add (optional)"}</span>
              <textarea
                value={note}
                maxLength={NOTE_MAX}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#C49A3C] resize-none"
              />
            </label>
            {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
            <div className="flex items-center justify-end gap-3">
              <button onClick={onClose} disabled={sending} className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
              <button
                onClick={() => void send()}
                disabled={!reason || noteNeeded || sending}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                Send report
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
