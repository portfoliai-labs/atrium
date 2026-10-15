"use client";

import { createPortal } from "react-dom";
import { AlertCircle, AlertTriangle, CalendarClock, FileText, X, Check } from "lucide-react";
import { ALL_FIELDS, REQUIRED_FIELDS, DATE_FORMAT_OPTIONS } from "../../lib/parser";
import { StandardTransaction } from "../../models/Report";
import { UploadedFileState } from "./uploaderTypes";
import type { Portfolio } from "../../models/Portfolio";
import { PortfolioSelect } from "./PortfolioSelect";

interface FileMappingModalProps {
  file: UploadedFileState;
  onMappingChange: (field: keyof StandardTransaction, csvHeader: string) => void;
  onDateFormatChange: (dateFormat: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  // With two or more portfolios, asks which one the file's rows go into: a must before they
  // reach the preview (the file starts with none).
  portfolios?: Portfolio[];
  onPortfolioChange?: (portfolioUuid: string) => void;
}

export function FileMappingModal({
  file, onMappingChange, onDateFormatChange, onConfirm, onClose, portfolios, onPortfolioChange,
}: FileMappingModalProps) {
  // Shown once auto-detection isn't confident, and kept visible after the user picks a format
  // explicitly (dateFormat stops being "auto") so they can still change their mind.
  const showDateFormatPicker = file.dateFormatAmbiguous || file.dateFormat !== "auto";
  const needsPortfolio = !!portfolios && portfolios.length > 1 && !file.portfolioUuid;
  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 md:p-8 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2.5 bg-blue-50 rounded-xl shrink-0">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div className="overflow-hidden">
              <h3 className="text-lg font-black text-slate-900 truncate">{file.fileName}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Detected Broker: <span className="px-1.5 py-0.5 bg-slate-100 rounded-md text-slate-700 font-bold ml-1">{file.detectedBroker}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {portfolios && portfolios.length > 1 && onPortfolioChange && (
          <div className="max-w-xs">
            <PortfolioSelect portfolios={portfolios} value={file.portfolioUuid} onChange={onPortfolioChange} />
          </div>
        )}

        {file.missingFields.length > 0 && (
          <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-800 font-medium leading-relaxed">
              Still missing: <span className="font-bold">{file.missingFields.join(", ")}</span>. Map {file.missingFields.length === 1 ? "this field" : "these fields"} below before saving.
            </p>
          </div>
        )}

        {file.hasOrdersWithoutTime && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 font-medium leading-relaxed">
              Some orders are missing execution times. For these transactions, the spread will be calculated as a daily approximation.
            </p>
          </div>
        )}

        {!file.validationErrors.isValid && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
              <span className="text-xs font-bold text-rose-800">
                {file.validationErrors.invalidRowCount} row{file.validationErrors.invalidRowCount !== 1 ? 's' : ''} have validation errors
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pl-6">
              {Object.entries(file.validationErrors.errorsByField).map(([field, count]) => (
                <span key={field} className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-1 rounded-lg">
                  {field}: {count} error{count !== 1 ? 's' : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {showDateFormatPicker && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <CalendarClock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                Couldn&apos;t confidently tell which date format this file uses. Pick the right one below — the preview updates immediately.
              </p>
              <select
                value={file.resolvedDateFormat}
                onChange={(e) => onDateFormatChange(e.target.value)}
                className="text-xs bg-white border border-amber-300 rounded-xl p-2.5 font-semibold outline-none transition-all focus:ring-4 focus:ring-amber-50"
              >
                {DATE_FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {ALL_FIELDS.map((field) => {
            const isRequired = REQUIRED_FIELDS.includes(field);
            const hasValue = !!file.previewData[0]?.[field];
            const hasMissingDates = field === "date" && file.hasOrdersWithoutTime;
            return (
              <div key={field} className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  {field} {isRequired && <span className="text-rose-500 text-xs">*</span>}
                  {hasMissingDates && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                  {file.validationErrors.errorsByField[field] && (
                    <span className="bg-rose-100 text-rose-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {file.validationErrors.errorsByField[field]}
                    </span>
                  )}
                </span>
                <select
                  value={file.manualMap[field] || ""}
                  onChange={(e) => onMappingChange(field, e.target.value)}
                  className={`text-xs bg-white border rounded-xl p-2.5 font-semibold outline-none transition-all focus:ring-4 ${
                    !hasValue && isRequired ? 'border-amber-300 focus:ring-amber-50 bg-amber-50/30' : 'border-slate-200 focus:ring-slate-50 focus:border-slate-300'
                  }`}
                >
                  <option value="" className="text-slate-400">-- Ignore --</option>
                  {Array.from(
                    new Set(file.rawData.flatMap(r => Object.keys(r)))
                  ).map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={needsPortfolio}
            title={needsPortfolio ? "Choose the portfolio to add these transactions to first" : undefined}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-blue-600 transition-colors shadow-md shadow-slate-200 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
          >
            <Check className="h-4 w-4" />
            Done — show in preview
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
