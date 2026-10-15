// services/legalService.ts
import type { LegalDocument, LegalAcceptanceItem, UserLegalAcceptance } from "../models/Legal";
import { apiFetch } from "./apiClient";

export const legalService = {
  // GET /v1/legal/documents — public, currently-active legal documents (no auth required)
  async getActiveDocuments(): Promise<LegalDocument[]> {
    return apiFetch<LegalDocument[]>('/v1/legal/documents');
  },

  // GET /v1/legal/pending — documents the authenticated user still needs to accept
  async getPendingDocuments(): Promise<LegalDocument[]> {
    return apiFetch<LegalDocument[]>('/v1/legal/pending');
  },

  // POST /v1/legal/acceptances — records the user's acceptance of the given document versions
  async acceptDocuments(items: LegalAcceptanceItem[]): Promise<UserLegalAcceptance[]> {
    return apiFetch<UserLegalAcceptance[]>('/v1/legal/acceptances', {
      method: 'POST',
      body: JSON.stringify({ documents: items }),
    });
  },
};
