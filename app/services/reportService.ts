// services/reportService.ts
import type { Document, PresignedUrl, ReportType } from "../models/Report";
import { apiFetch } from "./apiClient";

// Matches ReportPayload (POST /v1/portfolios/{p}/reports). period_start/period_end are ISO
// dates, required for PERIODIC and ignored for FULL. `force` skips the backend's guard against
// a second report while one is still queued/processing for the portfolio (a 409 otherwise).
interface CreateReportPayload {
  filename: string;
  report_type: ReportType;
  period_start?: string;
  period_end?: string;
  force?: boolean;
}

export const reportService = {
  // POST /v1/portfolios/{p}/reports — queues the report; its progress arrives on the
  // notification stream, and the finished PDF shows up in getAllDocuments.
  async createReport(portfolioUuid: string, payload: CreateReportPayload): Promise<{ status: string; job_id: string }> {
    return apiFetch<{ status: string; job_id: string }>(`/v1/portfolios/${portfolioUuid}/reports`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // GET /v1/portfolios/{p}/reports
  async getAllDocuments(portfolioUuid: string): Promise<Document[]> {
    return apiFetch<Document[]>(`/v1/portfolios/${portfolioUuid}/reports`);
  },

  async downloadReport(portfolioUuid: string, documentId: string): Promise<PresignedUrl> {
    return apiFetch<PresignedUrl>(`/v1/portfolios/${portfolioUuid}/reports/${documentId}/download`);
  },

  async addTag(portfolioUuid: string, documentId: string, tagName: string): Promise<void> {
    return apiFetch<void>(`/v1/portfolios/${portfolioUuid}/reports/${documentId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ name: tagName }),
    });
  },

  async removeTag(portfolioUuid: string, documentId: string, tagName: string): Promise<void> {
    return apiFetch<void>(`/v1/portfolios/${portfolioUuid}/reports/${documentId}/tags/${encodeURIComponent(tagName)}`, {
      method: 'DELETE',
    });
  },
};
