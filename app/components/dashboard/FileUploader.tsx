"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  UploadCloud, AlertCircle, Loader2, Send,
  FileText, CheckCircle2, X, FileSpreadsheet, PlusCircle
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { transactionService, TransactionFilters } from "../../services/transactionService";
import {
  identifyBroker,
  BROKER_CONFIGS,
  ALL_FIELDS,
  validateMapping,
  validateTransactions,
  standardizeRow,
  detectDateFormat,
  RawRow,
} from "../../lib/parser";
import { StandardTransaction } from "../../models/Report";
import { REQUIRED_FIELDS } from "../../lib/parser/config";
import type { TransactionInput, TransactionResponse } from "../../models/Transaction";
import { TransactionModal } from "./TransactionModal";
import { FileMappingModal } from "./FileMappingModal";
import { UploadedFileState } from "./uploaderTypes";
import { TransactionsSection, TransactionRow, DisplayTransaction } from "./TransactionsSection";
import { TransactionFilterBar, TransactionFilterState, EMPTY_TRANSACTION_FILTERS } from "./TransactionFilterBar";

const EXISTING_PAGE_SIZE = 10;
const PENDING_PAGE_SIZE = 10;

function pendingToDisplay(tx: StandardTransaction): DisplayTransaction {
  return {
    ticker: tx.ticker ?? null,
    // Not-yet-saved rows haven't been through backend asset resolution, so no name yet.
    name: null,
    isin: tx.isin ?? null,
    date: tx.date,
    operation: tx.operation,
    amount: tx.amount,
    quantity: tx.quantity,
    price: tx.price,
    currency: tx.currency,
    fees: tx.fees,
    broker: tx.broker,
  };
}

function existingToDisplay(tx: TransactionResponse): DisplayTransaction {
  return {
    ticker: tx.ticker,
    name: tx.name,
    isin: tx.isin,
    date: tx.date,
    operation: tx.operation,
    amount: tx.amount,
    // Backend now always returns quantity as a string (arbitrary decimal precision) — parse for display/editing.
    quantity: tx.quantity != null ? Number(tx.quantity) : null,
    price: tx.price,
    currency: tx.currency,
    fees: tx.fees,
    broker: tx.broker,
  };
}

// Converts a saved backend transaction back into the client-local editable shape,
// keyed by transaction_uuid so edits can be routed to the right PATCH call.
function existingResponseToStandard(tx: TransactionResponse): StandardTransaction {
  return {
    id: tx.transaction_uuid,
    date: tx.date,
    operation: tx.operation,
    amount: tx.amount,
    // Backend now always returns quantity as a string (arbitrary decimal precision) — parse for display/editing.
    quantity: tx.quantity != null ? Number(tx.quantity) : null,
    price: tx.price,
    currency: tx.currency,
    fees: tx.fees,
    broker: tx.broker ?? "",
    // Rows saved before ticker became mandatory may only have an isin — fall
    // back to it so the edit form always has a ticker to show/resubmit.
    ticker: tx.ticker ?? tx.isin ?? "",
    ...(tx.isin ? { isin: tx.isin } : {}),
  };
}

// The backend has no ticker-from-ISIN resolver exposed yet, so ISIN-only rows
// fall back to using the ISIN as both asset_id and ticker.
function toTransactionInput(tx: DisplayTransaction): TransactionInput {
  const ticker = tx.ticker ?? tx.isin ?? "";
  return {
    asset_id: ticker,
    isin: tx.isin,
    ticker,
    date: tx.date,
    operation: tx.operation as TransactionInput["operation"],
    amount: tx.amount,
    quantity: tx.quantity,
    price: tx.price,
    fees: tx.fees,
    currency: tx.currency,
    broker: tx.broker,
  };
}

export function FileUploader({ forUserUuid }: { forUserUuid?: string | null } = {}) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<UploadedFileState[]>([]);
  const [mappingModalFileId, setMappingModalFileId] = useState<string | null>(null);
  const [manualTransactions, setManualTransactions] = useState<StandardTransaction[]>([]);
  const [existingItems, setExistingItems] = useState<TransactionResponse[]>([]);
  const [existingTotal, setExistingTotal] = useState(0);
  const [existingPage, setExistingPage] = useState(1);
  const [existingFilters, setExistingFilters] = useState<TransactionFilterState>(EMPTY_TRANSACTION_FILTERS);
  const [pendingPage, setPendingPage] = useState(1);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [deletingKeys, setDeletingKeys] = useState<Set<string>>(new Set());
  const [deletingAllExisting, setDeletingAllExisting] = useState(false);
  const [status, setStatus] = useState<"idle" | "preview" | "saved" | "processing" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showExampleModal, setShowExampleModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effetto per nascondere automaticamente il toast dopo 5 secondi
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Converts the filter bar's form state into the query params the backend expects
  const toServiceFilters = (filters: TransactionFilterState): TransactionFilters => ({
    ticker: filters.ticker || null,
    isin: filters.isin || null,
    broker: filters.broker || null,
    operation: filters.operation || null,
    dateFrom: filters.dateFrom || null,
    dateTo: filters.dateTo || null,
  });

  const hasActiveFilters = Object.values(existingFilters).some(Boolean);

  // Applies a new filter selection and jumps back to page 1, so we don't land on an out-of-range page
  const handleFiltersChange = (filters: TransactionFilterState) => {
    setExistingFilters(filters);
    setExistingPage(1);
  };

  // Fetch one page of the user's already-saved transactions whenever the page, filters, or user changes
  useEffect(() => {
    let cancelled = false;
    setLoadingExisting(true);
    transactionService.getUserTransactions(forUserUuid, EXISTING_PAGE_SIZE, (existingPage - 1) * EXISTING_PAGE_SIZE, toServiceFilters(existingFilters))
      .then(res => {
        if (cancelled) return;
        setExistingItems(res.items);
        setExistingTotal(res.total);
      })
      .finally(() => { if (!cancelled) setLoadingExisting(false); });
    return () => { cancelled = true; };
  }, [forUserUuid, existingPage, existingFilters]);

  // Re-fetches a given page of saved transactions (used after a save/delete changes the underlying data)
  const refreshExisting = async (page: number) => {
    setLoadingExisting(true);
    try {
      const res = await transactionService.getUserTransactions(forUserUuid, EXISTING_PAGE_SIZE, (page - 1) * EXISTING_PAGE_SIZE, toServiceFilters(existingFilters));
      setExistingItems(res.items);
      setExistingTotal(res.total);
    } finally {
      setLoadingExisting(false);
    }
  };

  // Close the mapping modal if the file it points to has been removed
  useEffect(() => {
    if (mappingModalFileId && !files.some(f => f.id === mappingModalFileId)) {
      setMappingModalFileId(null);
    }
  }, [files, mappingModalFileId]);

  const mappingFile = useMemo(() =>
    files.find(f => f.id === mappingModalFileId) || null,
  [files, mappingModalFileId]);

  // Only confirmed files (mapping reviewed by the user) contribute to the preview/submission
  const confirmedFilesValid = useMemo(() =>
    files.filter(f => f.confirmed).every(f => f.isValid),
  [files]);

  // Per-file "rowIndex_field" error sets, used to highlight cells in the unified preview
  const fileErrorSets = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const f of files) {
      map.set(f.id, new Set(f.validationErrors.errors.map(e => `${e.row}_${e.field}`)));
    }
    return map;
  }, [files]);

  // New transactions not yet saved: manual entries + rows from confirmed files
  const pendingRows = useMemo<TransactionRow[]>(() => {
    const manualRows = manualTransactions.map(tx => ({
      key: `manual::${tx.id}`,
      transaction: pendingToDisplay(tx),
      sourceLabel: "Manual",
      origin: "pending" as const,
      errorFields: new Set<string>(),
    }));

    const fileRows = files.filter(f => f.confirmed).flatMap(f => {
      const errSet = fileErrorSets.get(f.id) ?? new Set<string>();
      return f.previewData.map((tx, idx) => ({
        key: `file::${f.id}::${idx}`,
        transaction: pendingToDisplay(tx),
        sourceLabel: f.fileName,
        origin: "pending" as const,
        errorFields: new Set(ALL_FIELDS.filter(field => errSet.has(`${idx}_${field}`))),
      }));
    });

    return [...manualRows, ...fileRows];
  }, [manualTransactions, files, fileErrorSets]);

  // Pending rows are paginated client-side (e.g. a large file upload), independently of the saved-transactions pagination
  const pendingTotalPages = Math.max(1, Math.ceil(pendingRows.length / PENDING_PAGE_SIZE));
  const clampedPendingPage = Math.min(pendingPage, pendingTotalPages);
  const pagedPendingRows = useMemo(() =>
    pendingRows.slice((clampedPendingPage - 1) * PENDING_PAGE_SIZE, clampedPendingPage * PENDING_PAGE_SIZE),
  [pendingRows, clampedPendingPage]);

  const existingRows = useMemo<TransactionRow[]>(() => existingItems.map(tx => ({
    key: `existing::${tx.transaction_uuid}`,
    transaction: existingToDisplay(tx),
    sourceLabel: "Saved",
    origin: "existing" as const,
    errorFields: new Set<string>(),
  })), [existingItems]);

  // Resolves the row behind the currently-open edit modal, regardless of its origin
  const editingTransaction = useMemo<StandardTransaction | undefined>(() => {
    if (!editingKey) return undefined;
    const [type, ...rest] = editingKey.split("::");
    if (type === "manual") return manualTransactions.find(t => t.id === rest[0]);
    if (type === "file") {
      const [fileId, idxStr] = rest;
      return files.find(f => f.id === fileId)?.previewData[Number(idxStr)];
    }
    if (type === "existing") {
      const tx = existingItems.find(t => t.transaction_uuid === rest[0]);
      return tx ? existingResponseToStandard(tx) : undefined;
    }
    return undefined;
  }, [editingKey, manualTransactions, files, existingItems]);

  const canSubmit = pendingRows.length > 0 && confirmedFilesValid;

  const processFileData = (
    rawData: RawRow[],
    mapping: Partial<Record<keyof StandardTransaction, string>>,
    brokerId: string,
    dateFormat: string,
  ) => {
    // A broker with its own date formatter never needs auto-detection (none configured right now).
    const hasCustomDateFormatter = !!BROKER_CONFIGS[brokerId]?.formatters?.date;
    let resolvedDateFormat = dateFormat;
    let dateFormatAmbiguous = false;

    if (!hasCustomDateFormatter && dateFormat === "auto") {
      const dateHeader = mapping.date;
      const rawDateValues = dateHeader ? rawData.map(row => row[dateHeader] as string) : [];
      const detected = detectDateFormat(rawDateValues);
      resolvedDateFormat = detected.format;
      dateFormatAmbiguous = detected.ambiguous;
    }

    const previewData = rawData.map(row => standardizeRow(row, mapping, brokerId, resolvedDateFormat));
    const { isValid: mappingValid, missingFields, hasOrdersWithoutTime } = validateMapping(previewData);
    const validationErrors = validateTransactions(previewData);
    return {
      previewData,
      isValid: mappingValid && validationErrors.isValid,
      missingFields,
      hasOrdersWithoutTime,
      validationErrors,
      resolvedDateFormat,
      dateFormatAmbiguous,
    };
  };

  const onParseComplete = (data: RawRow[], fileName: string) => {
    const id = Math.random().toString(36).substring(7);
    const broker = identifyBroker(data);
    const initialMapping = BROKER_CONFIGS[broker]?.columns || {};

    const { previewData, isValid, missingFields, hasOrdersWithoutTime, validationErrors, resolvedDateFormat, dateFormatAmbiguous } =
      processFileData(data, initialMapping, broker, "auto");

    const newFile: UploadedFileState = {
      id, fileName, rawData: data, previewData, manualMap: initialMapping,
      detectedBroker: broker, dateFormat: "auto", resolvedDateFormat, dateFormatAmbiguous,
      isValid, missingFields: missingFields.map(String),
      hasOrdersWithoutTime, validationErrors, confirmed: false,
    };

    setFiles(prev => [...prev, newFile]);
    setMappingModalFileId(id);
    // A file was picked and is about to be shown for mapping/preview — make sure the upload modal doesn't linger.
    setShowExampleModal(false);
  };

  const handleMappingChange = (fileId: string, stdField: keyof StandardTransaction, csvHeader: string) => {
    setFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      const newMapping = { ...f.manualMap, [stdField]: csvHeader };
      // The date column itself changed — any previously auto-detected/chosen format may no longer apply.
      const dateFormat = stdField === "date" ? "auto" : f.dateFormat;
      const { previewData, isValid, missingFields, hasOrdersWithoutTime, validationErrors, resolvedDateFormat, dateFormatAmbiguous } =
        processFileData(f.rawData, newMapping, f.detectedBroker, dateFormat);
      return {
        ...f, manualMap: newMapping, previewData, isValid, dateFormat, resolvedDateFormat, dateFormatAmbiguous,
        missingFields: missingFields.map(String), hasOrdersWithoutTime, validationErrors,
      };
    }));
  };

  // The user overrides the auto-detected date format (e.g. auto-detection was ambiguous or wrong).
  const handleDateFormatChange = (fileId: string, dateFormat: string) => {
    setFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      const { previewData, isValid, missingFields, hasOrdersWithoutTime, validationErrors, resolvedDateFormat, dateFormatAmbiguous } =
        processFileData(f.rawData, f.manualMap, f.detectedBroker, dateFormat);
      return {
        ...f, previewData, isValid, dateFormat, resolvedDateFormat, dateFormatAmbiguous,
        missingFields: missingFields.map(String), hasOrdersWithoutTime, validationErrors,
      };
    }));
  };

  const confirmMapping = (fileId: string) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, confirmed: true } : f));
    setMappingModalFileId(null);
    setStatus("preview");
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    if (mappingModalFileId === id) setMappingModalFileId(null);
    if (files.length <= 1) setStatus("idle");
  };

  // Recomputes preview/validation for a file after some of its raw rows were deleted; drops the file if it's now empty
  const updateFileRawData = (fileId: string, newRawData: RawRow[]) => {
    setFiles(prev => {
      const next: UploadedFileState[] = [];
      for (const f of prev) {
        if (f.id !== fileId) { next.push(f); continue; }
        if (newRawData.length === 0) continue;
        const { previewData, isValid, missingFields, hasOrdersWithoutTime, validationErrors, resolvedDateFormat, dateFormatAmbiguous } =
          processFileData(newRawData, f.manualMap, f.detectedBroker, f.dateFormat);
        next.push({
          ...f, rawData: newRawData, previewData, isValid, resolvedDateFormat, dateFormatAmbiguous,
          missingFields: missingFields.map(String), hasOrdersWithoutTime, validationErrors,
        });
      }
      return next;
    });
  };

  const toggleRowSelection = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Toggles selection for a given set of keys (e.g. all rows on the current page of a section)
  const toggleSelectAllForKeys = (keys: string[]) => {
    setSelectedKeys(prev => {
      const allSelected = keys.length > 0 && keys.every(k => prev.has(k));
      const next = new Set(prev);
      keys.forEach(k => allSelected ? next.delete(k) : next.add(k));
      return next;
    });
  };

  // Removes a batch of rows regardless of origin: pending ones are dropped locally,
  // existing (saved) ones are deleted via the backend first.
  const deleteKeys = async (keys: string[]) => {
    if (keys.length === 0) return;
    const manualIds = new Set<string>();
    const fileGroups = new Map<string, Set<number>>();
    const existingIds = new Set<string>();

    keys.forEach(key => {
      const [type, ...rest] = key.split("::");
      if (type === "manual") {
        manualIds.add(rest[0]);
      } else if (type === "file") {
        const [fileId, idxStr] = rest;
        if (!fileGroups.has(fileId)) fileGroups.set(fileId, new Set());
        fileGroups.get(fileId)!.add(Number(idxStr));
      } else if (type === "existing") {
        existingIds.add(rest[0]);
      }
    });

    if (manualIds.size > 0) {
      setManualTransactions(prev => prev.filter(t => !manualIds.has(t.id)));
    }

    fileGroups.forEach((idxSet, fileId) => {
      const file = files.find(f => f.id === fileId);
      if (!file) return;
      updateFileRawData(fileId, file.rawData.filter((_, i) => !idxSet.has(i)));
    });

    if (existingIds.size > 0) {
      const existingKeys = Array.from(existingIds).map(id => `existing::${id}`);
      setDeletingKeys(prev => new Set([...prev, ...existingKeys]));
      try {
        const toDelete = existingItems.filter(tx => existingIds.has(tx.transaction_uuid));
        await Promise.all(toDelete.map(tx => transactionService.deleteTransaction(tx.transaction_uuid)));
        await refreshExisting(existingPage);
      } finally {
        setDeletingKeys(prev => {
          const next = new Set(prev);
          existingKeys.forEach(k => next.delete(k));
          return next;
        });
      }
    }

    setSelectedKeys(prev => {
      const next = new Set(prev);
      keys.forEach(k => next.delete(k));
      return next;
    });
  };

  // Saved transactions are already persisted, so confirm before deleting them; pending ones need no confirmation.
  const confirmAndDeleteKeys = (keys: string[]) => {
    const existingCount = keys.filter(k => k.startsWith("existing::")).length;
    if (existingCount > 0) {
      const confirmed = window.confirm(
        `Delete ${existingCount} saved transaction${existingCount !== 1 ? 's' : ''}? This cannot be undone.`
      );
      if (!confirmed) return;
    }
    void deleteKeys(keys);
  };

  // Deletes every saved transaction matching the active filters directly in the backend —
  // not just the current page. With no filters active, this wipes all saved transactions.
  const handleDeleteAllExisting = async () => {
    const confirmed = window.confirm(
      hasActiveFilters
        ? `Delete all ${existingTotal} transactions matching the current filters? This cannot be undone.`
        : `Delete all ${existingTotal} saved transactions? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingAllExisting(true);
    try {
      await transactionService.deleteAllTransactions(forUserUuid, toServiceFilters(existingFilters));
      setSelectedKeys(prev => {
        const next = new Set<string>();
        prev.forEach(k => { if (!k.startsWith("existing::")) next.add(k); });
        return next;
      });
      if (existingPage === 1) {
        await refreshExisting(1);
      } else {
        setExistingPage(1);
      }
    } catch (error: unknown) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete transactions.");
      setShowToast(true);
    } finally {
      setDeletingAllExisting(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    for (const file of Array.from(uploadedFiles)) {
      if (file.name.toLowerCase().endsWith(".csv")) {
        Papa.parse(file, { header: true, skipEmptyLines: true, complete: (results) => onParseComplete(results.data as RawRow[], file.name) });
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const workbook = XLSX.read(e.target?.result, { type: "array" });
          // defval: "" ensures every row includes ALL column keys even when cells are empty
          const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" }) as RawRow[];
          onParseComplete(json, file.name);
        };
        reader.readAsArrayBuffer(file);
      }
    }

    if (fileInputRef.current)
      fileInputRef.current.value = "";
  };

  const handleAddManualTransaction = (transaction: StandardTransaction) => {
    setManualTransactions(prev => [...prev, transaction]);
    setStatus("preview");
  };

  // Applies an edit to whichever row is behind `key`: manual/file rows are updated locally,
  // saved (existing) ones are persisted via PATCH. File-sourced rows are detached into a
  // standalone manual transaction, since their previous shape is regenerated from the file's
  // raw data + column mapping on every change and can't hold a one-off manual edit.
  const handleUpdateTransaction = async (key: string, updated: StandardTransaction) => {
    const [type, ...rest] = key.split("::");

    if (type === "manual") {
      setManualTransactions(prev => prev.map(t => t.id === rest[0] ? updated : t));
      return;
    }

    if (type === "file") {
      const [fileId, idxStr] = rest;
      const file = files.find(f => f.id === fileId);
      if (!file) return;
      updateFileRawData(fileId, file.rawData.filter((_, i) => i !== Number(idxStr)));
      setManualTransactions(prev => [...prev, updated]);
      return;
    }

    if (type === "existing") {
      const uuid = rest[0];
      try {
        await transactionService.updateTransaction(uuid, toTransactionInput(pendingToDisplay(updated)));
        await refreshExisting(existingPage);
      } catch (error: unknown) {
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to update transaction.");
        setShowToast(true);
      }
    }
  };

  const handleConfirmUpload = async () => {
    if (!canSubmit) return;
    try {
      setLoading(true);
      const newTransactions = pendingRows.map(r => toTransactionInput(r.transaction));
      await transactionService.saveTransactions(newTransactions, forUserUuid);
      if (existingPage === 1) {
        await refreshExisting(1);
      } else {
        setExistingPage(1);
      }
      setStatus("saved");
      setShowToast(true);
      setFiles([]);
      setManualTransactions([]);
      setPendingPage(1);
      setSelectedKeys(new Set());
    } catch (error: unknown) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to save transactions.");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 relative">

      {/* NOTIFICA TOAST (Visualizzata in base allo stato) */}
      {showToast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-100 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 ${
          status === "error" ? "bg-rose-500 text-white" : "bg-slate-900 text-white"
        }`}>
          {status === "error" ? (
            <AlertCircle className="h-5 w-5 text-rose-200" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          )}
          <div className="flex flex-col">
            <span className="text-sm font-bold">
              {status === "error" ? "Action Failed" : status === "saved" ? "Transactions Saved" : "Analysis Started Successfully"}
            </span>
            <span className="text-xs opacity-80">
              {status === "error"
                ? errorMessage
                : status === "saved"
                ? "Your transactions have been saved. Run an analysis whenever you're ready."
                : "Your transactions are being processed. Check the archive shortly."}
            </span>
          </div>
          <button onClick={() => setShowToast(false)} className="ml-4 p-1 hover:bg-white/20 rounded-lg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* MODAL: Upload file example */}
      {showExampleModal && createPortal(
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          onClick={() => setShowExampleModal(false)}
        >
          <div
            className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 md:p-8 space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 rounded-xl">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Upload a file</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Expected column format for CSV/Excel</p>
                </div>
              </div>
              <button onClick={() => setShowExampleModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-225">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {ALL_FIELDS.map((field) => (
                        <th key={field} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                          {field} {REQUIRED_FIELDS.includes(field) && <span className="text-rose-500">*</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { date: "2024-01-15", isin: "US0378331005", ticker: "AAPL", operation: "buy", amount: "1852.00", quantity: "10", price: "185.20", currency: "USD", fees: "1.50", broker: "Fineco" },
                      { date: "2024-02-10", isin: "", ticker: "VWCE.MI", operation: "sell", amount: "491.75", quantity: "5", price: "98.35", currency: "EUR", fees: "0", broker: "" },
                      { date: "2024-03-05", isin: "IE00B4L5Y983", ticker: "IUSA.MI", operation: "dividend", amount: "42.30", quantity: "", price: "", currency: "EUR", fees: "0", broker: "Directa" },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        {ALL_FIELDS.map((field) => (
                          <td key={field} className="px-4 py-3 text-sm font-medium text-slate-600 whitespace-nowrap">{(row as Record<string, string>)[field] || <span className="text-slate-300">—</span>}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 font-medium leading-relaxed">
                  <span className="font-bold text-rose-600">*</span> required fields: <span className="font-mono">date</span>, <span className="font-mono">ticker</span>, <span className="font-mono">operation</span>, <span className="font-mono">amount</span> and <span className="font-mono">currency</span>. All other columns, including <span className="font-mono">isin</span>, are optional.
                </p>
              </div>
              <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 font-medium leading-relaxed">
                  <span className="font-bold">ticker</span>: always required, even for rows that also have an <span className="font-mono">isin</span>. Must match the ticker available on <span className="font-bold">Yahoo Finance</span> (e.g. <span className="font-mono">AAPL</span>, <span className="font-mono">VWCE.MI</span>).
                </p>
              </div>
              <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 font-medium leading-relaxed">
                  <span className="font-bold">operation</span>: must be <span className="font-mono">buy</span>, <span className="font-mono">sell</span>, <span className="font-mono">dividend</span> or <span className="font-mono">other</span>. <span className="font-mono">quantity</span>/<span className="font-mono">price</span> are only required for <span className="font-mono">buy</span>/<span className="font-mono">sell</span>.
                </p>
              </div>
              <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 font-medium leading-relaxed">
                  <span className="font-bold">amount</span>: the total transaction value ("controvalore"). Required — if left blank, it's derived from <span className="font-mono">quantity × price</span> when both are present.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowExampleModal(false)}
                className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => { setShowExampleModal(false); fileInputRef.current?.click(); }}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-blue-600 transition-colors shadow-md shadow-slate-200"
              >
                <UploadCloud className="h-4 w-4" />
                Upload file
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: Add a single transaction manually */}
      {showAddModal && (
        <TransactionModal
          mode="add"
          onClose={() => setShowAddModal(false)}
          onSave={handleAddManualTransaction}
        />
      )}

      {/* MODAL: Edit (or delete) whichever transaction row was clicked */}
      {editingKey && editingTransaction && (
        <TransactionModal
          mode="edit"
          initial={editingTransaction}
          onClose={() => setEditingKey(null)}
          onSave={(transaction) => { void handleUpdateTransaction(editingKey, transaction); setEditingKey(null); }}
          onDelete={() => { confirmAndDeleteKeys([editingKey]); setEditingKey(null); }}
        />
      )}

      {/* MODAL: Map a file's columns before its rows join the preview */}
      {mappingFile && (
        <FileMappingModal
          file={mappingFile}
          onMappingChange={(field, header) => handleMappingChange(mappingFile.id, field, header)}
          onDateFormatChange={(dateFormat) => handleDateFormatChange(mappingFile.id, dateFormat)}
          onConfirm={() => confirmMapping(mappingFile.id)}
          onClose={() => setMappingModalFileId(null)}
        />
      )}

      {/* TOOLBAR: upload actions, full width */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          onClick={() => setShowExampleModal(true)}
          className="p-5 border-2 border-dashed border-slate-200/80 rounded-3xl bg-white/50 hover:bg-slate-50 cursor-pointer transition-all flex items-center gap-4 group"
        >
          <div className="bg-slate-100 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
            <UploadCloud className="h-5 w-5 text-slate-500 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="text-left overflow-hidden">
            <span className="text-sm font-bold text-slate-700 block">Browse Files</span>
            <p className="text-xs text-slate-400 truncate">CSV or Excel formats</p>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="p-5 rounded-3xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-4 transition-colors group text-left"
        >
          <div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
            <PlusCircle className="h-5 w-5 text-blue-600" />
          </div>
          <div className="overflow-hidden">
            <span className="text-sm font-bold text-slate-700 block">Add transaction</span>
            <p className="text-xs text-slate-400 truncate">Insert a single row manually</p>
          </div>
        </button>
      </div>

      {/* File chips: click to (re)open the column mapping modal for that file */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map(file => (
            <button
              key={file.id}
              onClick={() => setMappingModalFileId(file.id)}
              className={`flex items-center gap-2 pl-4 pr-2 py-2 rounded-full border transition-all text-sm font-semibold max-w-full ${
                !file.confirmed ? "border-amber-300 bg-amber-50/60 text-amber-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <FileText className={`h-4 w-4 shrink-0 ${!file.confirmed || !file.isValid ? "text-amber-500" : ""}`} />
              <span className="truncate max-w-50">{file.fileName}</span>
              {!file.confirmed && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">
                  Needs mapping
                </span>
              )}
              <span
                onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                className="p-1 rounded-full hover:bg-black/5 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* New transactions: manual entries + confirmed file rows, not yet saved. Paginated client-side for large uploads. */}
      {pendingRows.length > 0 && (
        <TransactionsSection
          title="New transactions"
          rows={pagedPendingRows}
          totalCount={pendingRows.length}
          page={clampedPendingPage}
          pageSize={PENDING_PAGE_SIZE}
          onPageChange={setPendingPage}
          loading={false}
          selectedKeys={selectedKeys}
          onToggleRow={toggleRowSelection}
          onToggleAll={toggleSelectAllForKeys}
          onDeleteSelected={confirmAndDeleteKeys}
          onRowClick={setEditingKey}
          deletingKeys={deletingKeys}
          emptyMessage="No new transactions."
          headerAction={
            <button
              disabled={!canSubmit || loading}
              onClick={handleConfirmUpload}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm ${
                canSubmit ? "bg-slate-900 text-white hover:bg-blue-600" : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
              }`}
            >
              {loading ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              Save {pendingRows.length} new {pendingRows.length === 1 ? 'transaction' : 'transactions'}
            </button>
          }
        />
      )}

      {/* Saved transactions: server-paginated */}
      <TransactionsSection
        title="Saved transactions"
        rows={existingRows}
        totalCount={existingTotal}
        page={existingPage}
        pageSize={EXISTING_PAGE_SIZE}
        onPageChange={setExistingPage}
        loading={loadingExisting}
        selectedKeys={selectedKeys}
        onToggleRow={toggleRowSelection}
        onToggleAll={toggleSelectAllForKeys}
        onDeleteSelected={confirmAndDeleteKeys}
        onRowClick={setEditingKey}
        deletingKeys={deletingKeys}
        emptyMessage={
          hasActiveFilters
            ? "No transactions match the current filters."
            : "No transactions yet. Add one manually or upload a file to get started."
        }
        filterBar={<TransactionFilterBar filters={existingFilters} onChange={handleFiltersChange} />}
        onDeleteAll={handleDeleteAllExisting}
        deletingAll={deletingAllExisting}
      />
    </div>
  );
}
