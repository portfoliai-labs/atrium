// components/dashboard/wallets/WalletImportDialog.tsx
"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { walletService } from "../../../services/walletService";
import {
  buildColumnProfilesForRequest, guessDateFormat, guessDecimalSeparator, guessThousandsSeparator, parseImportFile, selectSample,
  type ParsedFile,
} from "../../../lib/import";
import { errorText } from "../../../lib/wallets";
import type { StatementColumnMapping, StatementField, StatementFieldMapping, StatementImportResult, Wallet } from "../../../models/Wallet";
import { DialogShell, Field, INPUT } from "./WalletDialogs";

const MAX_BYTES = 10 * 1024 * 1024;

const FIELDS: { field: StatementField; label: string; hint: string }[] = [
  { field: "date", label: "Date", hint: "The day it was booked" },
  { field: "description", label: "Description", hint: "What it was" },
  { field: "amount", label: "Amount", hint: "Signed: money in positive" },
  { field: "debit", label: "Money out", hint: "Where the statement splits them" },
  { field: "credit", label: "Money in", hint: "Where the statement splits them" },
  { field: "counterparty", label: "Counterparty", hint: "Optional" },
  { field: "currency", label: "Currency", hint: "Optional: rows in another currency are rejected" },
];
const NUMERIC: StatementField[] = ["amount", "debit", "credit"];

const CONFIDENCE_STYLE: Record<StatementFieldMapping["confidence"], string> = {
  high: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-rose-50 text-rose-700",
};

type Step = { kind: "pick" } | { kind: "analyzing" } | { kind: "mapping" } | { kind: "done"; result: StatementImportResult };

/**
 * IMPORT STATEMENT — a bank or card statement (CSV, XLS, XLSX, up to 10 MB) read into one wallet:
 * the file is read here for its columns and a sample, the backend proposes which column is what
 * (analyze-columns), the user checks it, and the file goes up with the confirmed mapping (commit).
 * An overlapping statement only adds what's new; what's imported arrives uncategorised.
 */
export function WalletImportDialog({ wallet, onClose, onImported }: {
  wallet: Wallet;
  onClose: () => void;
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<StatementColumnMapping | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (picked: File) => {
    setError(null);
    if (picked.size > MAX_BYTES) {
      setError("The file is larger than 10 MB.");
      return;
    }
    setFile(picked);
    setStep({ kind: "analyzing" });
    try {
      const read = await parseImportFile(picked);
      if (read.headers.length === 0 || read.rows.length === 0) throw new Error("No rows found in this file.");
      const { sampleRows } = selectSample(read.headers, read.rows);
      const profiles = buildColumnProfilesForRequest(read.headers, read.rows);
      const proposal = await walletService.analyzeStatement(wallet.uuid, {
        headers: read.headers,
        sampleRows,
        columnProfiles: Object.fromEntries(Object.entries(profiles).map(([col, p]) => [col, { distinctValues: p.distinct_values.slice(0, 200), nullRatePct: p.null_rate_pct }])),
      });
      const { isFromCache, ...proposed } = proposal;
      setParsed(read);
      // The lines before the column names, as this file has them, unless the proposal knows better.
      setMapping({ ...proposed, skipRows: proposed.skipRows || read.skippedHeaderRows });
      setFromCache(isFromCache);
      setStep({ kind: "mapping" });
    } catch (err) {
      setError(errorText(err, "Unable to read this file."));
      setStep({ kind: "pick" });
    }
  };

  const valuesOf = (column: string) => (parsed?.rows ?? []).map((r) => r[column] ?? "").filter((v) => v.trim() !== "").slice(0, 200);

  const setColumn = (field: StatementField, column: string) => setMapping((m) => {
    if (!m) return m;
    const fields = { ...m.fields };
    if (!column) delete fields[field];
    else {
      const values = valuesOf(column);
      const next: StatementFieldMapping = { sourceColumn: column, confidence: "high" };
      if (field === "date") next.dateFormat = guessDateFormat(values).date_format;
      if (NUMERIC.includes(field)) {
        const decimal = guessDecimalSeparator(values);
        next.decimalSeparator = decimal;
        next.thousandsSeparator = guessThousandsSeparator(values, decimal);
      }
      fields[field] = next;
    }
    return { ...m, fields };
  });
  const setFieldOption = (field: StatementField, change: Partial<StatementFieldMapping>) =>
    setMapping((m) => (m && m.fields[field] ? { ...m, fields: { ...m.fields, [field]: { ...m.fields[field]!, ...change } } } : m));

  const f = mapping?.fields ?? {};
  const complete = !!f.date && !!f.description && (!!f.amount || !!f.debit || !!f.credit);

  const commit = async () => {
    if (!file || !mapping) return;
    setBusy(true);
    setError(null);
    try {
      const result = await walletService.commitStatement(wallet.uuid, file, mapping);
      setStep({ kind: "done", result });
      if (result.imported > 0) onImported();
    } catch (err) {
      setError(errorText(err, "Unable to import this statement."));
    } finally {
      setBusy(false);
    }
  };

  if (step.kind === "done") {
    const { result } = step;
    return (
      <DialogShell icon={<CheckCircle2 className="h-5 w-5" />} title="Statement imported" subtitle={wallet.name} busy={false} error={null} submitLabel="Done" canSubmit onSubmit={onClose} onClose={onClose}>
        <ul className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Imported", value: result.imported },
            { label: "Already there", value: result.duplicates },
            { label: "Rejected", value: result.rejected.length },
          ].map((s) => (
            <li key={s.label} className="rounded-2xl bg-slate-50 border border-slate-200 py-3">
              <p className="text-2xl font-black text-slate-900 tabular-nums">{s.value}</p>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
            </li>
          ))}
        </ul>
        {result.firstBookedOn && (
          <p className="text-[13px] text-slate-600">From {result.firstBookedOn} to {result.lastBookedOn}. Imported movements arrive uncategorised: pick their categories in Transactions.</p>
        )}
        {result.rejected.length > 0 && (
          <div className="max-h-40 overflow-y-auto custom-scrollbar rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3">
            <ul className="space-y-1 text-[12px] text-rose-700">
              {result.rejected.map((r) => <li key={r.rowNumber}><span className="font-bold">Row {r.rowNumber}:</span> {r.reason}</li>)}
            </ul>
          </div>
        )}
      </DialogShell>
    );
  }

  return (
    <DialogShell
      icon={<Upload className="h-5 w-5" />}
      title="Import statement"
      subtitle={`Into ${wallet.name} · ${wallet.currency}`}
      busy={busy || step.kind === "analyzing"}
      error={error}
      submitLabel="Import"
      canSubmit={step.kind === "mapping" && complete}
      onSubmit={commit}
      onClose={onClose}
      wide
    >
      {step.kind !== "mapping" && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={step.kind === "analyzing"}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-200 hover:border-[#C49A3C]/60 bg-slate-50/60 px-6 py-10 text-center transition-colors"
        >
          {step.kind === "analyzing" ? (
            <>
              <Loader2 className="h-7 w-7 text-[#C49A3C] animate-spin" />
              <span className="text-sm font-bold text-slate-700">Reading {file?.name}…</span>
              <span className="text-xs text-slate-400">Working out which column is what. This can take up to a minute.</span>
            </>
          ) : (
            <>
              <FileSpreadsheet className="h-7 w-7 text-slate-400" />
              <span className="text-sm font-bold text-slate-700">Choose a statement</span>
              <span className="text-xs text-slate-400">CSV, XLS or XLSX, up to 10 MB, as your bank exports it.</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,.xls,.xlsx"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (picked) void analyze(picked);
        }}
      />

      {step.kind === "mapping" && mapping && parsed && (
        <div className="space-y-5">
          <p className="text-[13px] text-slate-600">
            <span className="font-bold text-slate-900">{parsed.fileName}</span> · {parsed.totalRows.toLocaleString("en-US")} rows.{" "}
            {fromCache ? "This layout was confirmed before: check it still fits." : "Check which column is what before importing."}
          </p>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {FIELDS.map(({ field, label, hint }) => {
              const m = f[field];
              return (
                <div key={field} className="grid grid-cols-1 sm:grid-cols-[140px_minmax(0,1fr)] gap-x-4 gap-y-2 px-4 py-3 items-center">
                  <div>
                    <p className="text-[13px] font-bold text-slate-800">{label}</p>
                    <p className="text-[11px] text-slate-400">{hint}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={m?.sourceColumn ?? ""} onChange={(e) => setColumn(field, e.target.value)} aria-label={label} className={`${INPUT} h-9 flex-1 min-w-40`}>
                      <option value="">Not in this file</option>
                      {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    {m && <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${CONFIDENCE_STYLE[m.confidence]}`}>{m.confidence}</span>}
                    {m && field === "date" && (
                      <input
                        value={m.dateFormat ?? ""}
                        onChange={(e) => setFieldOption(field, { dateFormat: e.target.value || null })}
                        placeholder="ISO (YYYY-MM-DD)"
                        aria-label="Date format"
                        title="As Python writes it: %d/%m/%Y"
                        className={`${INPUT} h-9 w-36`}
                      />
                    )}
                    {m && NUMERIC.includes(field) && (
                      <select
                        value={m.decimalSeparator ?? "."}
                        onChange={(e) => setFieldOption(field, { decimalSeparator: e.target.value, thousandsSeparator: e.target.value === "," ? "." : null })}
                        aria-label="Decimal separator"
                        className={`${INPUT} h-9 w-36`}
                      >
                        <option value=".">1,234.56</option>
                        <option value=",">1.234,56</option>
                      </select>
                    )}
                  </div>
                  {m && <p className="sm:col-start-2 text-[11px] text-slate-400 truncate">e.g. {valuesOf(m.sourceColumn).slice(0, 3).join(" · ") || "—"}</p>}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={mapping.spendingIsPositive} onChange={(e) => setMapping({ ...mapping, spendingIsPositive: e.target.checked })} className="mt-0.5 accent-[#C49A3C]" />
              <span>
                <span className="block text-[13px] font-bold text-slate-800">Spending is written as positive</span>
                <span className="block text-[11px] text-slate-400">As many card statements do, in the amount column.</span>
              </span>
            </label>
            <Field label="Lines before the column names">
              <input type="number" min={0} value={mapping.skipRows} onChange={(e) => setMapping({ ...mapping, skipRows: Math.max(0, Number(e.target.value) || 0) })} className={INPUT} />
            </Field>
          </div>
          {!complete && <p className="text-xs font-semibold text-amber-700">Pick the date, the description, and an amount (or money in and out).</p>}
        </div>
      )}
    </DialogShell>
  );
}
