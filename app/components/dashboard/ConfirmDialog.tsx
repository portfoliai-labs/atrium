"use client";

import { createPortal } from "react-dom";
import { AlertTriangle, HelpCircle, Loader2, X } from "lucide-react";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirming?: boolean;
  // Why the last confirm failed, shown above the buttons.
  error?: string | null;
  // `neutral`: a confirmation that destroys nothing (e.g. sending something for review).
  tone?: "danger" | "neutral";
  // More to fill in, under the description.
  children?: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

// Shared destructive-action confirmation, styled to match TransactionModal/ImportWizard
// (same portal + backdrop + rounded-4xl card) instead of the browser's native window.confirm.
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  confirming,
  error,
  tone = "danger",
  children,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const danger = tone === "danger";
  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => !confirming && onClose()}>
      <div
        className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-md w-full p-6 md:p-8 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${danger ? "bg-rose-50" : "bg-slate-100"}`}>
              {danger ? <AlertTriangle className="h-5 w-5 text-rose-600" /> : <HelpCircle className="h-5 w-5 text-slate-600" />}
            </div>
            <h3 className="text-lg font-black text-slate-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={confirming}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
        {children}
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={confirming}
            className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-colors shadow-md disabled:opacity-60 ${danger ? "bg-rose-600 hover:bg-rose-700 shadow-rose-100" : "bg-slate-900 hover:bg-slate-800 shadow-slate-200"}`}
          >
            {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
