// models/Report.ts
import type { RewardKind, TransactionOperation } from "./Transaction";

// Matches DocumentStatuses enum from backend
type DocumentStatus = 'UPLOADED' | 'PROCESSING' | 'FAILED';

// Matches ReportType enum from backend — FULL covers full history,
// PERIODIC covers a custom period (period_start..period_end)
type ReportType = 'FULL' | 'PERIODIC';

// Matches DocumentResponse DTO (GET /v1/portfolios/{p}/reports, GET .../reports/{id}/download)
interface Document {
  document_id: string;
  user_id: string;
  portfolio_uuid: string;
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
// backend transaction_uuid. A transaction on census' listing carries its `listingId` (what is
// sent), its ticker, name and ISIN only to be shown; one without names its security by `ticker`
// (a file's rows, transactions recorded before listings), `isin` only supplementing it. A manual
// asset's carries its `assetId` ("manual:<uuid>") and name; a cash movement names nothing (ticker
// ""). Which of the optional fields an operation takes is in lib/operations.
type StandardTransaction = {
  id: string;
  date: string;
  operation: TransactionOperation;
  // NaN where it's left to the backend (a transfer_out without one).
  amount: number;
  quantity: number | null;
  price: number | null;
  currency: string;
  fees: number;
  broker: string;
  ticker: string;
  isin?: string;
  listingId?: string;
  name?: string;
  assetId?: string;
  withholdingTax?: number | null;
  accruedInterest?: number | null;
  counterAmount?: number | null;
  counterCurrency?: string | null;
  rewardKind?: RewardKind | null;
  // Frontend-only: the portfolio a not-yet-saved row will be saved into, where the user can
  // pick one (see FileUploader). Never sent as part of the transaction itself.
  portfolioUuid?: string;
};

export type { Document, DocumentStatus, PresignedUrl, ReportType, StandardTransaction };
