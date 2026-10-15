"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, FileSpreadsheet, Loader2, Send, ShieldCheck, X } from "lucide-react";
import {
  ParsedFile,
  RawRow,
  allDistinctValues,
  buildColumnProfilesForRequest,
  buildPreviewRows,
  guessDateFormat,
  guessDecimalSeparator,
  guessThousandsSeparator,
  parseImportFile,
  selectSample,
  valueCounts,
} from "../../../lib/import";
import { importService } from "../../../services/importService";
import {
  ColumnFieldMapping,
  ColumnMappingDTO,
  CommitImportResponse,
  CommitMappingPayload,
  InstrumentOverridePayload,
  MappingTarget,
  REQUIRED_MAPPING_TARGETS,
  TransactionTarget,
} from "../../../models/Import";
import { ColumnMappingBlock } from "./ColumnMappingBlock";
import { ValueMappingBlock, ValueMappingRow } from "./ValueMappingBlock";
import { PreviewBlock } from "./PreviewBlock";
import { AnomaliesBlock } from "./AnomaliesBlock";
import { CommitSummary } from "./CommitSummary";
import { UnresolvedInstrumentsBlock } from "./UnresolvedInstrumentsBlock";
import { NUMERIC_TARGETS } from "./types";
import type { Portfolio } from "../../../models/Portfolio";
import { PortfolioSelect } from "../PortfolioSelect";

type Phase = "parsing" | "analyzing" | "confirm" | "committing" | "done" | "error";
type Tab = "columns" | "values" | "preview" | "issues";

const emptyField: ColumnFieldMapping = { confidence: "low" };

function isPopulated(field: ColumnFieldMapping | undefined): boolean {
  return !!field && (!!field.source_column || field.constant_value != null);
}

function buildFieldForColumn(target: MappingTarget, column: string, values: string[]): ColumnFieldMapping {
  if (target === "date") {
    return { source_column: column, confidence: "high", date_format: guessDateFormat(values).date_format };
  }
  if (NUMERIC_TARGETS.includes(target)) {
    const decimal = guessDecimalSeparator(values);
    return { source_column: column, confidence: "high", decimal_separator: decimal, thousands_separator: guessThousandsSeparator(values, decimal) };
  }
  return { source_column: column, confidence: "high" };
}

interface ImportWizardProps {
  file: File;
  onClose: () => void;
  onImported: () => void;
  // The portfolio the file is analyzed against and, unless the user picks another from
  // `portfolios`, imported into.
  portfolioUuid: string;
  // With two or more, the wizard asks which portfolio to import into, until the import runs.
  portfolios?: Portfolio[];
  // Lets the user fall back to the legacy manual column-by-column mapper when AI analysis
  // fails outright (e.g. the file really is malformed).
  onFallbackToManual?: () => void;
}

export function ImportWizard({ file, onClose, onImported, portfolioUuid, portfolios, onFallbackToManual }: ImportWizardProps) {
  const [phase, setPhase] = useState<Phase>("parsing");
  // Where the rows go: with a choice to make, none until the user picks one (the import waits
  // for it). Fixed once the first commit runs: a recommit (manual instrument overrides) has to
  // land in the same portfolio as the rows already imported.
  const mustPick = (portfolios?.length ?? 0) > 1;
  const [targetUuid, setTargetUuid] = useState(mustPick ? "" : portfolioUuid);
  const [tab, setTab] = useState<Tab>("columns");
  const [errorMessage, setErrorMessage] = useState("");
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [sampleRowsForRequests, setSampleRowsForRequests] = useState<RawRow[]>([]);
  const [isFromCache, setIsFromCache] = useState(false);
  const [mapping, setMapping] = useState<ColumnMappingDTO | null>(null);
  const [proposedMapping, setProposedMapping] = useState<ColumnMappingDTO | null>(null);
  const [valueColumn, setValueColumn] = useState<string | null>(null);
  const [valueMapping, setValueMapping] = useState<ValueMappingRow[]>([]);
  const [commitResult, setCommitResult] = useState<CommitImportResponse | null>(null);
  const [committing, setCommitting] = useState(false);
  // Accumulates across recommits so a raw identifier resolved in an earlier round stays
  // resolved even though the backend re-processes the whole file from scratch each time.
  const [manualOverrides, setManualOverrides] = useState<Record<string, InstrumentOverridePayload>>({});
  const [recommitting, setRecommitting] = useState(false);
  // True when detectDateFormat couldn't pin the date column to a single confident pattern —
  // gates confirmation the same way a missing required field does, since importing on a guess
  // here risks every date being silently day/month-swapped rather than merely absent.
  const [dateFormatAmbiguous, setDateFormatAmbiguous] = useState(false);

  // Fetches (or re-fetches, when the user repoints 'type' at a different column) every
  // distinct value of the categorical column feeding 'type'. Never blocks the wizard on
  // failure — an all-unresolved list still lets the user map values by hand.
  const loadValueMapping = async (column: string, rows: RawRow[], sampleRows: RawRow[]) => {
    const distinct = allDistinctValues(column, rows);
    const counts = valueCounts(column, rows);
    try {
      const response = await importService.analyzeValues(portfolioUuid, { column_name: column, distinct_values: distinct, sample_rows: sampleRows });
      const byValue = new Map(response.values.map((v) => [v.raw_value, v]));
      setValueColumn(column);
      setValueMapping(
        distinct.map((v) => {
          const entry = byValue.get(v);
          return { raw_value: v, target: entry?.target ?? null, confidence: entry?.confidence ?? "low", count: counts[v] ?? 0 };
        }),
      );
    } catch {
      setValueColumn(column);
      setValueMapping(distinct.map((v) => ({ raw_value: v, target: null, confidence: "low", count: counts[v] ?? 0 })));
    }
  };

  // Runs the whole client-side pipeline once: parse -> structural sample -> analyze-columns
  // -> analyze-values for whichever column ends up mapped to 'type'.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const parsed = await parseImportFile(file);
        if (parsed.rows.length === 0) throw new Error("No data rows found in this file.");
        if (cancelled) return;
        setParsedFile(parsed);
        setPhase("analyzing");

        const sample = selectSample(parsed.headers, parsed.rows);
        if (sample.malformed) {
          throw new Error(
            `This file has ${sample.distinctSignatureCount} structurally different row shapes — it looks malformed. Please check it before importing.`,
          );
        }
        setSampleRowsForRequests(sample.sampleRows);

        const response = await importService.analyzeColumns(portfolioUuid, {
          headers: parsed.headers,
          sample_rows: sample.sampleRows,
          column_profiles: buildColumnProfilesForRequest(parsed.headers, parsed.rows),
        });
        if (cancelled) return;

        // The AI proposes decimal_separator/thousands_separator (and date_format) too, but
        // it's reasoning over a summary, not scanning every value — recompute all three
        // deterministically from the full column instead of trusting its guess, the same way a
        // manual column change already does via buildFieldForColumn. For dates specifically,
        // this catches day/month locale mixups (e.g. guessing MM/dd/yyyy on a day-first file):
        // every day-<=12 row still "parses" under the wrong pattern, so nothing looks wrong
        // until a day-13-to-31 row shows up and fails outright.
        const correctedFields = { ...response.fields };
        const dateField = correctedFields.date;
        if (dateField?.source_column) {
          const values = parsed.rows.map((r) => r[dateField.source_column!] ?? "");
          const guess = guessDateFormat(values);
          correctedFields.date = { ...dateField, date_format: guess.date_format };
          setDateFormatAmbiguous(guess.ambiguous);
        }
        for (const target of NUMERIC_TARGETS) {
          const field = correctedFields[target];
          if (!field?.source_column) continue;
          const values = parsed.rows.map((r) => r[field.source_column!] ?? "");
          const decimal_separator = guessDecimalSeparator(values);
          correctedFields[target] = { ...field, decimal_separator, thousands_separator: guessThousandsSeparator(values, decimal_separator) };
        }

        const initialMapping: ColumnMappingDTO = { fingerprint: response.fingerprint, fields: correctedFields, categorical_columns: response.categorical_columns };
        setMapping(initialMapping);
        setProposedMapping(initialMapping);
        setIsFromCache(response.is_from_cache);

        const typeColumn = response.fields.type?.source_column;
        if (typeColumn) {
          await loadValueMapping(typeColumn, parsed.rows, sample.sampleRows);
        }
        if (cancelled) return;
        setPhase("confirm");
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : "Couldn't analyze this file.");
        setPhase("error");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
    // Runs once per file: portfolioUuid doesn't change during one wizard's lifetime, and
    // loadValueMapping is stable in every way that matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const valueMap = useMemo<Record<string, TransactionTarget | null>>(
    () => Object.fromEntries(valueMapping.map((r) => [r.raw_value, r.target])),
    [valueMapping],
  );

  const previewRows = useMemo(() => {
    if (!parsedFile || !mapping) return [];
    return buildPreviewRows(parsedFile.rows, mapping, valueMap);
  }, [parsedFile, mapping, valueMap]);

  // One full source row per distinct raw value — every original column, not a guessed subset,
  // since which column actually reveals buy-vs-sell (a sign, a "Causale" column, a description)
  // varies by broker and can't be predicted. Lets the user recognize the real transaction
  // instead of judging a bare code from date/instrument/amount alone, which often looks
  // identical between a buy and a sell.
  const valueExamples = useMemo<Record<string, RawRow>>(() => {
    if (!parsedFile || !valueColumn) return {};
    const examples: Record<string, RawRow> = {};
    for (const row of parsedFile.rows) {
      const raw = (row[valueColumn] ?? "").trim();
      if (raw in examples) continue;
      examples[raw] = row;
    }
    return examples;
  }, [parsedFile, valueColumn]);

  const anomalyCount = useMemo(() => previewRows.filter((r) => r.anomalies.length > 0).length, [previewRows]);
  const unresolvedValueCount = useMemo(() => valueMapping.filter((r) => r.target === null).length, [valueMapping]);
  const requiredFieldsMissing = useMemo(
    () => (mapping ? REQUIRED_MAPPING_TARGETS.filter((t) => !isPopulated(mapping.fields[t])) : REQUIRED_MAPPING_TARGETS),
    [mapping],
  );
  // Ticker and ISIN aren't each required (either one is enough to resolve an instrument), but
  // having neither mapped means every row would import with no way to identify what was
  // traded — that's an all-or-nothing gate on the mapping, unlike a single row's blank cell
  // (which surfaces as the "missing-instrument" anomaly instead, without blocking the rest).
  const hasInstrumentMapping = useMemo(
    () => (mapping ? isPopulated(mapping.fields.ticker) || isPopulated(mapping.fields.isin) : false),
    [mapping],
  );

  const handleChangeColumn = (target: MappingTarget, column: string | null) => {
    if (!parsedFile) return;
    const values = column ? parsedFile.rows.map((r) => r[column] ?? "") : [];
    const nextField = column ? buildFieldForColumn(target, column, values) : emptyField;
    setMapping((prev) => (prev ? { ...prev, fields: { ...prev.fields, [target]: nextField } } : prev));

    if (target === "date") {
      setDateFormatAmbiguous(column ? guessDateFormat(values).ambiguous : false);
    }
    if (target === "type") {
      if (column) void loadValueMapping(column, parsedFile.rows, sampleRowsForRequests);
      else {
        setValueColumn(null);
        setValueMapping([]);
      }
    }
  };

  const handleChangeConstant = (target: MappingTarget, value: string) => {
    setMapping((prev) => (prev ? { ...prev, fields: { ...prev.fields, [target]: { confidence: "high", constant_value: value } } } : prev));
    if (target === "date") setDateFormatAmbiguous(false);
    if (target === "type") {
      setValueColumn(null);
      setValueMapping([]);
    }
  };

  // Lets the user override the detected date format directly — the only way to resolve a
  // genuinely ambiguous column (nothing in the data itself can disambiguate dd/MM from MM/dd
  // when every day is <= 12), and a manual correction is trusted over any guess going forward.
  const handleChangeDateFormat = (strftimeFormat: string) => {
    setMapping((prev) =>
      prev ? { ...prev, fields: { ...prev.fields, date: { ...(prev.fields.date ?? emptyField), date_format: strftimeFormat } } } : prev,
    );
    setDateFormatAmbiguous(false);
  };

  const handleValueChange = (rawValue: string, target: TransactionTarget | null) => {
    setValueMapping((prev) => prev.map((r) => (r.raw_value === rawValue ? { ...r, target, confidence: "high" } : r)));
  };

  const handleConfirm = async () => {
    if (!parsedFile || !mapping || requiredFieldsMissing.length > 0 || !hasInstrumentMapping || dateFormatAmbiguous) return;
    setCommitting(true);
    setPhase("committing");
    try {
      const payload: CommitMappingPayload = {
        confirmed_column_mapping: mapping,
        confirmed_value_mapping: {
          column_name: valueColumn ?? mapping.fields.type?.source_column ?? "",
          values: valueMapping.map((r) => ({ raw_value: r.raw_value, target: r.target, confidence: r.confidence })),
        },
        proposed_column_mapping: proposedMapping ?? undefined,
      };
      const result = await importService.commit(targetUuid, file, payload);
      setCommitResult(result);
      setPhase("done");
      onImported();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to import transactions.");
      setPhase("error");
    } finally {
      setCommitting(false);
    }
  };

  // Reimports the same file with manually-resolved instruments added on top of whatever was
  // already resolved in a previous round — the backend has no memory of prior overrides
  // between commit calls, so the full set has to travel with every request. Overrides
  // accumulate across rounds, but only_row_indexes does not: it's the union of row_indexes
  // from the *current* commitResult's unresolved_instruments, since /commit isn't idempotent
  // and rows already persisted in an earlier round must not be reprocessed.
  const handleRecommit = async (newOverrides: Record<string, InstrumentOverridePayload>) => {
    if (!mapping || !commitResult) return;
    const merged = { ...manualOverrides, ...newOverrides };
    setManualOverrides(merged);
    const onlyRowIndexes = Array.from(new Set(commitResult.unresolved_instruments.flatMap((u) => u.row_indexes)));
    setRecommitting(true);
    try {
      const payload: CommitMappingPayload = {
        confirmed_column_mapping: mapping,
        confirmed_value_mapping: {
          column_name: valueColumn ?? mapping.fields.type?.source_column ?? "",
          values: valueMapping.map((r) => ({ raw_value: r.raw_value, target: r.target, confidence: r.confidence })),
        },
        proposed_column_mapping: proposedMapping ?? undefined,
        manual_instrument_overrides: merged,
        only_row_indexes: onlyRowIndexes,
      };
      const result = await importService.commit(targetUuid, file, payload);
      setCommitResult(result);
      // A recommit persists new rows just like the initial commit does — the caller's list
      // needs telling again, or rows resolved in this round never show up without a reload.
      onImported();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to reimport with the manual overrides.");
      setPhase("error");
    } finally {
      setRecommitting(false);
    }
  };

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "columns", label: "Columns" },
    { id: "values", label: "Values", badge: unresolvedValueCount || undefined },
    { id: "preview", label: "Preview" },
    { id: "issues", label: "Issues", badge: anomalyCount || undefined },
  ];

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-5xl w-full p-6 md:p-8 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2.5 bg-blue-50 rounded-xl shrink-0">
              <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            </div>
            <div className="overflow-hidden">
              <h3 className="text-lg font-black text-slate-900 truncate">{file.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                Your file stays in the browser — only headers, a structural sample and distinct values are sent for analysis.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {portfolios && portfolios.length > 1 && phase !== "error" && (
          <div className="max-w-xs">
            <PortfolioSelect
              portfolios={portfolios}
              value={targetUuid}
              onChange={setTargetUuid}
              disabled={phase === "committing" || commitResult !== null}
              label={commitResult ? "Imported into" : "Import into portfolio"}
            />
          </div>
        )}

        {(phase === "parsing" || phase === "analyzing") && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-500">{phase === "parsing" ? "Reading file…" : "Analyzing columns…"}</p>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-800 font-medium leading-relaxed">{errorMessage}</p>
            </div>
            {onFallbackToManual && (
              <div className="flex items-center justify-end gap-3">
                <button onClick={onClose} className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={onFallbackToManual}
                  className="px-5 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-blue-600 transition-colors"
                >
                  Map columns manually instead
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "committing" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-500">Importing transactions…</p>
          </div>
        )}

        {phase === "done" && commitResult && (
          <>
            <CommitSummary summary={commitResult} />
            {commitResult.unresolved_instruments.length > 0 && (
              <UnresolvedInstrumentsBlock
                unresolved={commitResult.unresolved_instruments}
                onRecommit={handleRecommit}
                submitting={recommitting}
              />
            )}
            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button onClick={onClose} className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-blue-600 transition-colors">
                Done
              </button>
            </div>
          </>
        )}

        {phase === "confirm" && parsedFile && mapping && (
          <div className="space-y-5">
            {isFromCache && (
              <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                  Format recognized from a previous import — mapping pre-filled, just review and confirm.
                </p>
              </div>
            )}

            <div className="flex gap-2 border-b border-slate-100 pb-3">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                    tab === t.id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {t.label}
                  {!!t.badge && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-white/20" : "bg-rose-100 text-rose-600"}`}>
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {tab === "columns" && (
              <ColumnMappingBlock
                headers={parsedFile.headers}
                fields={mapping.fields}
                exampleRow={parsedFile.rows[0]}
                onChangeColumn={handleChangeColumn}
                onChangeConstant={handleChangeConstant}
                dateFormatAmbiguous={dateFormatAmbiguous}
                onChangeDateFormat={handleChangeDateFormat}
              />
            )}
            {tab === "values" && (
              <ValueMappingBlock
                columnName={valueColumn ?? mapping.fields.type?.source_column ?? ""}
                headers={parsedFile.headers}
                rows={valueMapping}
                examples={valueExamples}
                onChange={handleValueChange}
              />
            )}
            {tab === "preview" && <PreviewBlock rows={previewRows} />}
            {tab === "issues" && <AnomaliesBlock headers={parsedFile.headers} rows={previewRows} onGoToValuesTab={() => setTab("values")} />}

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500">
                {previewRows.length - anomalyCount} row{previewRows.length - anomalyCount !== 1 ? "s" : ""} ready
                {anomalyCount > 0 && <span className="text-amber-600"> · {anomalyCount} to verify</span>}
              </p>
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors">
                  Cancel
                </button>
                <button
                  disabled={requiredFieldsMissing.length > 0 || !hasInstrumentMapping || dateFormatAmbiguous || !targetUuid || committing}
                  onClick={handleConfirm}
                  title={!targetUuid ? "Choose the portfolio to import into first" : undefined}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-colors shadow-md shadow-slate-200 ${
                    requiredFieldsMissing.length > 0 || !hasInstrumentMapping || dateFormatAmbiguous || !targetUuid
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-slate-900 hover:bg-blue-600"
                  }`}
                >
                  <Send className="h-4 w-4" />
                  Confirm import
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
