// models/Import.ts
// Mirrors the backend's Pydantic DTOs in app/api/dto/transaction_import.py exactly (field
// names, casing, nesting) — these are round-tripped as-is (analyze-columns' response feeds
// straight into commit's confirmed_column_mapping), so drifting from the backend shape here
// breaks the request rather than just failing to render.

type ConfidenceLevel = "high" | "medium" | "low";

// The AI's enum for a categorical value's target. Deliberately has no "ignore" — a value left
// unmapped (target: null) already means "not imported", which is how every row that doesn't
// resolve to buy/sell/dividend ends up excluded, explicitly and visibly, rather than dropped.
type TransactionTarget = "buy" | "sell" | "dividend";

// Matches ImportTargetField (backend enum) — the internal schema an uploaded file is mapped onto.
type MappingTarget = "date" | "type" | "amount" | "quantity" | "price" | "fees" | "currency" | "ticker" | "isin" | "name" | "broker";

const MAPPING_TARGETS: MappingTarget[] = [
  "date", "type", "amount", "quantity", "price", "fees", "currency", "ticker", "isin", "name", "broker",
];

// date/type/amount are what the AI's own confidence scoring centers on; currency is added
// because a transaction's currency is never optional server-side, so a mapping that can't
// resolve it for every row can't produce persistable transactions at all.
const REQUIRED_MAPPING_TARGETS: MappingTarget[] = ["date", "type", "amount", "currency"];

// How one target field is populated: either from a source column, or a constant (e.g. a file
// that's entirely EUR can map currency as a constant instead of a column). Only date/number
// fields ever populate date_format/decimal_separator/thousands_separator.
interface ColumnFieldMapping {
  source_column?: string | null;
  constant_value?: string | null;
  confidence: ConfidenceLevel;
  date_format?: string | null; // Python strftime, e.g. "%d/%m/%Y"
  decimal_separator?: string | null;
  thousands_separator?: string | null;
}

// Round-trip shape: what analyze-columns proposes, and what commit sends back (edited or not).
interface ColumnMappingDTO {
  fingerprint: string;
  fields: Partial<Record<MappingTarget, ColumnFieldMapping>>;
  categorical_columns: string[];
}

interface ColumnMappingResponse extends ColumnMappingDTO {
  is_from_cache: boolean;
}

interface ColumnProfileDTO {
  // Every distinct raw value of the column across the WHOLE file, not just the sample —
  // lets the AI reason about e.g. a column that's blank in 12% of rows without seeing all of it.
  distinct_values: string[];
  null_rate_pct: number; // 0-100
}

interface AnalyzeColumnsRequest {
  headers: string[];
  sample_rows: Record<string, string>[];
  column_profiles: Record<string, ColumnProfileDTO>;
}

interface AnalyzeValuesRequest {
  column_name: string;
  distinct_values: string[];
  sample_rows: Record<string, string>[];
}

interface ValueMappingEntryDTO {
  raw_value: string;
  target: TransactionTarget | null;
  confidence: ConfidenceLevel;
}

// Only the single column mapped to `type` ever needs value mapping — every other categorical
// column (currency, broker, ...) is free text/constant, never an enum.
interface CategoricalColumnMappingDTO {
  column_name: string;
  values: ValueMappingEntryDTO[];
}

type ValueMappingResponse = CategoricalColumnMappingDTO;

interface InstrumentOverridePayload {
  ticker: string;
  isin?: string | null;
  exchange?: string | null;
}

// A single resolved listing OpenFIGI found for an ambiguous ISIN (e.g. the same ETF on two
// markets) — offered to the user as a pick instead of asking them to type a ticker blind.
interface InstrumentCandidateDTO {
  ticker: string;
  isin?: string | null;
  exchange?: string | null; // raw MIC, e.g. "XMIL"
  exchange_name?: string | null; // human-readable market name, e.g. "Borsa Italiana" — prefer this for display
  currency?: string | null;
}

// The JSON carried in commit's `mapping` form field, alongside the uploaded file itself.
interface CommitMappingPayload {
  confirmed_column_mapping: ColumnMappingDTO;
  confirmed_value_mapping: CategoricalColumnMappingDTO;
  proposed_column_mapping?: ColumnMappingDTO | null;
  manual_instrument_overrides?: Record<string, InstrumentOverridePayload>;
  // Restricts a recommit to just these row indexes (the still-unresolved ones from the prior
  // response) so rows already persisted in an earlier round aren't reprocessed and duplicated.
  // Omitted/null means "process every row" — the original, non-recommit behavior.
  only_row_indexes?: number[] | null;
}

interface ImportRowIssueResponse {
  row_index: number;
  reason: string;
}

interface ImportIntegrityWarningResponse {
  type: string;
  message: string;
  row_indexes: number[];
}

// "ambiguous" means OpenFIGI found more than one listing and the row's currency wasn't enough
// to narrow it to one — `candidates` then carries every listing found, for the user to pick
// from. "not_found" (the original, still-default case) means candidates is always empty and
// the user has to type a ticker/ISIN by hand, exactly as before this field existed.
type UnresolvedReason = "not_found" | "ambiguous";

interface UnresolvedInstrumentResponse {
  raw_identifier: string;
  row_indexes: number[];
  reason: UnresolvedReason;
  candidates: InstrumentCandidateDTO[];
}

interface CommitImportResponse {
  imported_count: number;
  issues: ImportRowIssueResponse[];
  integrity_warnings: ImportIntegrityWarningResponse[];
  unresolved_instruments: UnresolvedInstrumentResponse[];
}

export type {
  ConfidenceLevel,
  TransactionTarget,
  MappingTarget,
  ColumnFieldMapping,
  ColumnMappingDTO,
  ColumnMappingResponse,
  ColumnProfileDTO,
  AnalyzeColumnsRequest,
  AnalyzeValuesRequest,
  ValueMappingEntryDTO,
  CategoricalColumnMappingDTO,
  ValueMappingResponse,
  InstrumentOverridePayload,
  InstrumentCandidateDTO,
  CommitMappingPayload,
  ImportRowIssueResponse,
  ImportIntegrityWarningResponse,
  UnresolvedReason,
  UnresolvedInstrumentResponse,
  CommitImportResponse,
};

export { MAPPING_TARGETS, REQUIRED_MAPPING_TARGETS };
