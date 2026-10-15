"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import {
  UploadCloud, AlertCircle, Loader2, Send,
  FileText, CheckCircle2, X, PlusCircle
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
import type { TransactionInput, TransactionResponse } from "../../models/Transaction";
import { TransactionModal } from "./TransactionModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { FileMappingModal } from "./FileMappingModal";
import { ImportWizard } from "./import/ImportWizard";
import { UploadedFileState } from "./uploaderTypes";
import { TransactionsSection, TransactionRow, DisplayTransaction, BulkOperation } from "./TransactionsSection";
import { TransactionFilterBar, TransactionFilterState, EMPTY_TRANSACTION_FILTERS } from "./TransactionFilterBar";
import { usePortfolio } from "../../context/PortfolioContext";
import { useUser } from "../../context/UserContext";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";

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

// Groups items by the portfolio they belong to, for writes that have to go portfolio by portfolio.
function groupByPortfolio<T>(items: T[], portfolioOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = portfolioOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

// Two ways in:
// - the investor (no portfolioUuid): every portfolio at once. The saved list is read from the
//   aggregate "All portfolios" (which merges them all, each row carrying its own
//   portfolio_uuid), or from one portfolio when the filter picks it; writes on a saved row go
//   to the portfolio it belongs to, and new rows to the portfolio picked where they're added.
// - the advisor (portfolioUuid: a client's portfolio): that one portfolio, nothing to pick.
// `readOnly`: a virtual portfolio's (a backtest's) generated transactions — the saved list only,
// with nothing to add, import, edit or delete.
export function FileUploader({ portfolioUuid: fixedPortfolioUuid, readOnly = false }: { portfolioUuid?: string; readOnly?: boolean } = {}) {
  const { portfolios: allPortfolios, current } = usePortfolio();
  // A demo account (see lib/demo) sees the list and can open the form, but can't import, save,
  // edit or delete anything.
  const { isDemo } = useUser();
  const isFixed = fixedPortfolioUuid !== undefined;
  // The portfolios that hold the user's transactions — the aggregate only lists them, and a
  // backtest's are generated (virtual portfolios take no writes).
  const ownPortfolios = useMemo(() => (isFixed ? [] : allPortfolios.filter(p => !p.isVirtual)), [isFixed, allPortfolios]);
  const aggregate = isFixed ? undefined : allPortfolios.find(p => p.isAggregate);
  // Pickers and portfolio labels only make sense with a choice to make.
  const pickable = ownPortfolios.length > 1 ? ownPortfolios : undefined;
  // Where new rows go unless the user picks otherwise: the portfolio open elsewhere in the
  // app, or the default one while that's the aggregate.
  const defaultTarget = fixedPortfolioUuid
    ?? (current && !current.isVirtual ? current.uuid : (ownPortfolios.find(p => p.isDefault) ?? ownPortfolios[0])?.uuid)
    ?? "";
  const portfolioName = (uuid?: string) => allPortfolios.find(p => p.uuid === uuid)?.name ?? "";
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
  const [updatingKeys, setUpdatingKeys] = useState<Set<string>>(new Set());
  // Rows mid-mutation (deleting or bulk-editing) — dimmed and non-interactive in the table.
  const busyKeys = useMemo(() => new Set([...deletingKeys, ...updatingKeys]), [deletingKeys, updatingKeys]);
  const [deletingAllExisting, setDeletingAllExisting] = useState(false);
  const [confirmDeleteKeys, setConfirmDeleteKeys] = useState<string[] | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [status, setStatus] = useState<"idle" | "preview" | "saved" | "processing" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  // Files awaiting the AI-assisted import wizard, processed one at a time.
  const [wizardQueue, setWizardQueue] = useState<File[]>([]);

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

  // Which list the saved section shows: the picked portfolio, else every portfolio (the
  // aggregate, or the only portfolio when there's no aggregate).
  const listUuid = fixedPortfolioUuid ?? (existingFilters.portfolio || aggregate?.uuid || ownPortfolios[0]?.uuid || "");

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
    if (!listUuid) return;
    transactionService.getUserTransactions(listUuid, EXISTING_PAGE_SIZE, (existingPage - 1) * EXISTING_PAGE_SIZE, toServiceFilters(existingFilters))
      .then(res => {
        if (cancelled) return;
        setExistingItems(res.items);
        setExistingTotal(res.total);
      })
      .finally(() => { if (!cancelled) setLoadingExisting(false); });
    return () => { cancelled = true; };
  }, [listUuid, existingPage, existingFilters]);

  // Re-fetches a given page of saved transactions (used after a save/delete changes the underlying data)
  const refreshExisting = async (page: number) => {
    setLoadingExisting(true);
    try {
      const res = await transactionService.getUserTransactions(listUuid, EXISTING_PAGE_SIZE, (page - 1) * EXISTING_PAGE_SIZE, toServiceFilters(existingFilters));
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
    // With a choice of portfolios, each new row says where it's going.
    const withTarget = (label: string, uuid: string) => (pickable ? `${label} → ${portfolioName(uuid)}` : label);
    const manualRows = manualTransactions.map(tx => ({
      key: `manual::${tx.id}`,
      transaction: pendingToDisplay(tx),
      sourceLabel: withTarget("Manual", tx.portfolioUuid ?? defaultTarget),
      origin: "pending" as const,
      errorFields: new Set<string>(),
      portfolioUuid: tx.portfolioUuid ?? defaultTarget,
    }));

    const fileRows = files.filter(f => f.confirmed).flatMap(f => {
      const errSet = fileErrorSets.get(f.id) ?? new Set<string>();
      return f.previewData.map((tx, idx) => ({
        key: `file::${f.id}::${idx}`,
        transaction: pendingToDisplay(tx),
        sourceLabel: withTarget(f.fileName, f.portfolioUuid),
        origin: "pending" as const,
        errorFields: new Set(ALL_FIELDS.filter(field => errSet.has(`${idx}_${field}`))),
        portfolioUuid: f.portfolioUuid,
      }));
    });

    return [...manualRows, ...fileRows];
    // portfolioName reads allPortfolios, already covered by pickable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualTransactions, files, fileErrorSets, pickable, defaultTarget]);

  // Pending rows are paginated client-side (e.g. a large file upload), independently of the saved-transactions pagination
  const pendingTotalPages = Math.max(1, Math.ceil(pendingRows.length / PENDING_PAGE_SIZE));
  const clampedPendingPage = Math.min(pendingPage, pendingTotalPages);
  const pagedPendingRows = useMemo(() =>
    pendingRows.slice((clampedPendingPage - 1) * PENDING_PAGE_SIZE, clampedPendingPage * PENDING_PAGE_SIZE),
  [pendingRows, clampedPendingPage]);

  const existingRows = useMemo<TransactionRow[]>(() => existingItems.map(tx => ({
    key: `existing::${tx.transaction_uuid}`,
    transaction: existingToDisplay(tx),
    // Saved rows name their portfolio when there's more than one to tell apart.
    sourceLabel: pickable ? (pickable.find(p => p.uuid === tx.portfolio_uuid)?.name ?? "") : "",
    origin: "existing" as const,
    errorFields: new Set<string>(),
    portfolioUuid: tx.portfolio_uuid,
  })), [existingItems, pickable]);

  // Resolves the row behind the currently-open edit modal, regardless of its origin
  const editingTransaction = useMemo<StandardTransaction | undefined>(() => {
    if (!editingKey) return undefined;
    const [type, ...rest] = editingKey.split("::");
    if (type === "manual") return manualTransactions.find(t => t.id === rest[0]);
    if (type === "file") {
      const [fileId, idxStr] = rest;
      const file = files.find(f => f.id === fileId);
      const tx = file?.previewData[Number(idxStr)];
      return tx && file ? { ...tx, portfolioUuid: file.portfolioUuid } : undefined;
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
      // With a choice to make, the user picks where the file goes in the mapping modal.
      portfolioUuid: pickable ? "" : defaultTarget,
    };

    setFiles(prev => [...prev, newFile]);
    setMappingModalFileId(id);
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
        await Promise.all(
          Array.from(groupByPortfolio(toDelete, tx => tx.portfolio_uuid)).map(([uuid, txs]) =>
            transactionService.deleteTransactions(uuid, txs.map(tx => tx.transaction_uuid)),
          ),
        );
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
      setConfirmDeleteKeys(keys);
      return;
    }
    void deleteKeys(keys);
  };

  // Deletes every saved transaction matching the active filters directly in the backend —
  // not just the current page. With no filters active, this wipes all saved transactions.
  // Across every portfolio unless the filter picks one: the aggregate takes no writes, so
  // that's one call per portfolio.
  const handleDeleteAllExisting = async () => {
    setDeletingAllExisting(true);
    try {
      const targets = fixedPortfolioUuid
        ? [fixedPortfolioUuid]
        : existingFilters.portfolio ? [existingFilters.portfolio] : ownPortfolios.map(p => p.uuid);
      await Promise.all(targets.map(uuid => transactionService.deleteAllTransactions(uuid, toServiceFilters(existingFilters))));
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

  // Every uploaded file goes through the AI-assisted import wizard first — it accepts
  // whatever format the broker exports, so the user never has to reformat a spreadsheet
  // by hand. Multiple files are processed one at a time.
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;
    // Snapshot into a plain array before resetting the input below — `files` is a live
    // FileList tied to the input, so clearing `.value` empties it too, and the state
    // updater below doesn't actually run until after this handler returns.
    const newFiles = Array.from(uploadedFiles);
    setWizardQueue((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current)
      fileInputRef.current.value = "";
  };

  const advanceWizardQueue = () => setWizardQueue((prev) => prev.slice(1));

  // Re-parses the file with the legacy column-by-column mapper — offered as a fallback from
  // the wizard when AI analysis can't make sense of a file.
  const parseFileRawRows = (file: File): Promise<RawRow[]> =>
    new Promise((resolve, reject) => {
      if (file.name.toLowerCase().endsWith(".csv")) {
        Papa.parse(file, { header: true, skipEmptyLines: true, complete: (results) => resolve(results.data as RawRow[]), error: reject });
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const workbook = XLSX.read(e.target?.result, { type: "array" });
            // defval: "" ensures every row includes ALL column keys even when cells are empty
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" }) as RawRow[];
            resolve(json);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      }
    });

  const handleWizardFallbackToManual = async (file: File) => {
    const data = await parseFileRawRows(file);
    onParseComplete(data, file.name);
    advanceWizardQueue();
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
      const owner = existingItems.find(tx => tx.transaction_uuid === uuid)?.portfolio_uuid ?? listUuid;
      try {
        await transactionService.updateTransaction(owner, uuid, toTransactionInput(pendingToDisplay(updated)));
        await refreshExisting(existingPage);
      } catch (error: unknown) {
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to update transaction.");
        setShowToast(true);
      }
    }
  };

  // Reassigns `operation` for every selected row in one go — the manual counterpart to the
  // AI's per-distinct-value mapping in the import wizard, but usable any time afterwards
  // (not just during import) on whichever rows it got wrong, regardless of how many there are.
  const handleBulkEditOperation = async (keys: string[], operation: BulkOperation) => {
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
      setManualTransactions(prev => prev.map(t => manualIds.has(t.id) ? { ...t, operation } : t));
    }

    // File-sourced rows are regenerated from raw data + column mapping on every render and
    // can't hold a one-off edit — same as a single-row edit, detach the edited ones into
    // standalone manual transactions instead of mutating the file in place.
    fileGroups.forEach((idxSet, fileId) => {
      const file = files.find(f => f.id === fileId);
      if (!file) return;
      const edited = file.previewData.filter((_, i) => idxSet.has(i)).map(tx => ({ ...tx, operation }));
      updateFileRawData(fileId, file.rawData.filter((_, i) => !idxSet.has(i)));
      setManualTransactions(prev => [...prev, ...edited]);
    });

    if (existingIds.size > 0) {
      const existingKeys = Array.from(existingIds).map(id => `existing::${id}`);
      setUpdatingKeys(prev => new Set([...prev, ...existingKeys]));
      try {
        const toEdit = existingItems.filter(tx => existingIds.has(tx.transaction_uuid));
        await Promise.all(
          toEdit.map(tx => transactionService.updateTransaction(tx.portfolio_uuid, tx.transaction_uuid, toTransactionInput({ ...existingToDisplay(tx), operation }))),
        );
        await refreshExisting(existingPage);
      } catch (error: unknown) {
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to update some transactions.");
        setShowToast(true);
      } finally {
        setUpdatingKeys(prev => {
          const next = new Set(prev);
          existingKeys.forEach(k => next.delete(k));
          return next;
        });
      }
    }
  };

  const handleConfirmUpload = async () => {
    if (!canSubmit) return;
    try {
      setLoading(true);
      // One save per destination portfolio.
      await Promise.all(
        Array.from(groupByPortfolio(pendingRows, r => r.portfolioUuid ?? defaultTarget)).map(([uuid, rows]) =>
          transactionService.saveTransactions(uuid, rows.map(r => toTransactionInput(r.transaction))),
        ),
      );
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

      {/* MODAL: Add a single transaction manually */}
      {showAddModal && (
        <TransactionModal
          mode="add"
          onClose={() => setShowAddModal(false)}
          onSave={handleAddManualTransaction}
          portfolios={pickable}
          defaultPortfolioUuid={defaultTarget}
          readOnly={isDemo}
        />
      )}

      {/* MODAL: Edit (or delete) whichever transaction row was clicked */}
      {editingKey && editingTransaction && (
        <TransactionModal
          mode="edit"
          initial={editingTransaction}
          // A saved row stays in its portfolio; a new one can still be sent elsewhere.
          portfolios={editingKey.startsWith("existing::") ? undefined : pickable}
          defaultPortfolioUuid={defaultTarget}
          onClose={() => setEditingKey(null)}
          onSave={(transaction) => { void handleUpdateTransaction(editingKey, transaction); setEditingKey(null); }}
          onDelete={() => { confirmAndDeleteKeys([editingKey]); setEditingKey(null); }}
        />
      )}

      {/* MODAL: AI-assisted import wizard — the primary path for every uploaded file */}
      {wizardQueue[0] && (
        <ImportWizard
          key={wizardQueue[0].name + wizardQueue[0].lastModified}
          file={wizardQueue[0]}
          portfolioUuid={defaultTarget}
          portfolios={pickable}
          onClose={advanceWizardQueue}
          onImported={() => {
            // Only refreshes the saved-transactions list — the wizard stays open on its
            // "Import complete" summary until the user dismisses it via the Done button,
            // which is what actually advances the queue (onClose).
            if (existingPage === 1) {
              void refreshExisting(1);
            } else {
              setExistingPage(1);
            }
          }}
          onFallbackToManual={() => { void handleWizardFallbackToManual(wizardQueue[0]); }}
        />
      )}

      {/* MODAL: confirm deleting a batch of selected saved transactions */}
      {confirmDeleteKeys && (
        <ConfirmDialog
          title="Delete transactions"
          description={`Delete ${confirmDeleteKeys.filter(k => k.startsWith("existing::")).length} saved transaction${confirmDeleteKeys.filter(k => k.startsWith("existing::")).length !== 1 ? "s" : ""}? This cannot be undone.`}
          onClose={() => setConfirmDeleteKeys(null)}
          onConfirm={() => {
            const keys = confirmDeleteKeys;
            setConfirmDeleteKeys(null);
            void deleteKeys(keys);
          }}
        />
      )}

      {/* MODAL: confirm wiping every saved transaction (optionally scoped to the active filters) */}
      {confirmDeleteAll && (
        <ConfirmDialog
          title="Delete all transactions"
          description={
            hasActiveFilters
              ? `Delete all ${existingTotal} transactions matching the current filters? This cannot be undone.`
              : pickable && !existingFilters.portfolio
              ? `Delete all ${existingTotal} saved transactions, across all your portfolios? This cannot be undone.`
              : `Delete all ${existingTotal} saved transactions? This cannot be undone.`
          }
          confirming={deletingAllExisting}
          onClose={() => setConfirmDeleteAll(false)}
          onConfirm={async () => {
            await handleDeleteAllExisting();
            setConfirmDeleteAll(false);
          }}
        />
      )}

      {/* MODAL: Map a file's columns before its rows join the preview (fallback from the AI wizard) */}
      {mappingFile && (
        <FileMappingModal
          file={mappingFile}
          onMappingChange={(field, header) => handleMappingChange(mappingFile.id, field, header)}
          onDateFormatChange={(dateFormat) => handleDateFormatChange(mappingFile.id, dateFormat)}
          onConfirm={() => confirmMapping(mappingFile.id)}
          onClose={() => setMappingModalFileId(null)}
          portfolios={pickable}
          onPortfolioChange={(uuid) => setFiles(prev => prev.map(f => f.id === mappingFile.id ? { ...f, portfolioUuid: uuid } : f))}
        />
      )}

      {/* TOOLBAR: upload actions, full width */}
      {!readOnly && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          onClick={() => !isDemo && fileInputRef.current?.click()}
          title={isDemo ? DEMO_DISABLED_TITLE : undefined}
          className={`p-5 border-2 border-dashed border-slate-200/80 rounded-3xl bg-white/50 transition-all flex items-center gap-4 group ${
            isDemo ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50 cursor-pointer"
          }`}
        >
          <div className="bg-slate-100 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
            <UploadCloud className="h-5 w-5 text-slate-500 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="text-left overflow-hidden">
            <span className="text-sm font-bold text-slate-700 block">Browse Files</span>
            <p className="text-xs text-slate-400 truncate">{isDemo ? "Not available on a demo account" : "Any broker export — AI maps the columns for you"}</p>
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
      </div>}

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
          onBulkEditOperation={handleBulkEditOperation}
          onRowClick={setEditingKey}
          deletingKeys={busyKeys}
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
            : readOnly
            ? "No transactions yet: the backtest is still generating them."
            : "No transactions yet. Add one manually or upload a file to get started."
        }
        filterBar={<TransactionFilterBar filters={existingFilters} onChange={handleFiltersChange} portfolios={ownPortfolios} />}
        onDeleteAll={isDemo || readOnly ? undefined : () => setConfirmDeleteAll(true)}
        readOnly={isDemo || readOnly}
        deletingAll={deletingAllExisting}
      />
    </div>
  );
}
