// models/Report.ts

// Matches DocumentStatuses enum from backend
type DocumentStatus = 'UPLOADED' | 'PROCESSING' | 'FAILED';

// Matches ReportType enum from backend — FULL covers full history,
// PERIODIC covers a custom period (period_start..period_end)
type ReportType = 'FULL' | 'PERIODIC';

// Matches DocumentResponse DTO (GET /v1/reports/, GET /v1/reports/{id}/download)
interface Document {
  document_id: string;
  user_id: string;
  job_id: string | null;
  generated_by_uuid: string | null;
  name: string;
  size: number;
  status: DocumentStatus;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  // All three null when the document has no resolvable job (old records, or a missing
  // job) — treat as "unknown" and fall back to created_at-based display. For a FULL
  // report, period_start/period_end are always null even when report_type is set —
  // only PERIODIC reports carry a period.
  report_type: ReportType | null;
  period_start: string | null;
  period_end: string | null;
}

// Matches PresignedUrlResponse DTO (GET /v1/reports/{id}/download)
interface PresignedUrl {
  url: string;
}

// Frontend-only shape used while a transaction is being parsed/edited client-side,
// before it is turned into a backend TransactionInput (see models/Transaction.ts) and saved.
// `id` is a locally-generated key (the ticker, or isin as a last resort), not the
// backend transaction_uuid. `ticker` is always required — the backend has no
// ticker-from-ISIN resolver, so `isin` can only ever supplement it, never replace it.
type StandardTransaction = {
  id: string;
  date: string;
  operation: 'buy' | 'sell' | 'dividend' | 'other';
  amount: number;
  quantity: number | null;
  price: number | null;
  currency: string;
  fees: number;
  broker: string;
  ticker: string;
  isin?: string;
};

export type { Document, DocumentStatus, PresignedUrl, ReportType, StandardTransaction };
