// services/reportService.ts
import type { Document, PresignedUrl, ReportType } from "../models/Report";
import { apiFetch } from "./apiClient";

export const reportService = {
  // GET /v1/reports/?for_user_uuid=... — advisors pass client UUID to fetch their documents
  async getAllDocuments(forUserUuid?: string | null): Promise<Document[]> {
    const query = forUserUuid ? `?for_user_uuid=${encodeURIComponent(forUserUuid)}` : '';
    return apiFetch<Document[]>(`/v1/reports/${query}`);
  },

  // POST /v1/reports/process-report — advisors pass for_user_uuid to generate for a client.
  // Transactions must already be saved via transactionService.saveTransactions before calling this.
  // reportType PERIODIC requires periodStart/periodEnd (covers a custom period, not just calendar months).
  async processReport(
    filename: string,
    forUserUuid?: string | null,
    period?: { reportType: ReportType; periodStart?: string; periodEnd?: string },
  ): Promise<void> {
    return apiFetch<void>('/v1/reports/process-report', {
      method: 'POST',
      body: JSON.stringify({
        filename,
        for_user_uuid: forUserUuid ?? null,
        report_type: period?.reportType ?? 'FULL',
        period_start: period?.periodStart ?? null,
        period_end: period?.periodEnd ?? null,
      }),
    });
  },

  async downloadReport(documentId: string): Promise<PresignedUrl> {
    return apiFetch<PresignedUrl>(`/v1/reports/${documentId}/download`);
  },

  async addTag(documentId: string, tagName: string): Promise<void> {
    return apiFetch<void>(`/v1/reports/${documentId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ name: tagName }),
    });
  },

  async removeTag(documentId: string, tagName: string): Promise<void> {
    return apiFetch<void>(`/v1/reports/${documentId}/tags/${encodeURIComponent(tagName)}`, {
      method: 'DELETE',
    });
  },
};
