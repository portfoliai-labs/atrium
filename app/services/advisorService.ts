// services/advisorService.ts
import type {
  AdvisorProfile,
  AdvisorStatement,
  AdvisorStatementPayload,
  AdvisorProfileUpdatePayload,
  Client,
} from "../models/Advisor";
import { apiFetch, apiFetchForm } from "./apiClient";

export const advisorService = {
  // --- Advisor own profile ---

  async getAdvisorProfile(): Promise<AdvisorProfile> {
    return apiFetch<AdvisorProfile>('/v1/advisor/profile');
  },

  async updateAdvisorProfile(payload: AdvisorProfileUpdatePayload): Promise<void> {
    return apiFetch<void>('/v1/advisor/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async uploadAdvisorLogo(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetchForm<void>('/v1/advisor/profile/logo', formData, { method: 'POST' });
  },

  async deleteAdvisorLogo(): Promise<void> {
    return apiFetch<void>('/v1/advisor/profile/logo', {
      method: 'DELETE',
    });
  },

  // GET /advisor/statement — null while never saved.
  async getAdvisorStatement(): Promise<AdvisorStatement | null> {
    return apiFetch<AdvisorStatement | null>('/v1/advisor/statement');
  },

  // PUT /advisor/statement — the whole statement; another register number puts it back to be verified.
  async saveAdvisorStatement(payload: AdvisorStatementPayload): Promise<AdvisorStatement> {
    return apiFetch<AdvisorStatement>('/v1/advisor/statement', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // --- Clients ---
  // A client comes through their own advisor request, accepted (advisorRequestService); the
  // advisor reads their data, and only the client changes it.

  async getClients(): Promise<Client[]> {
    return apiFetch<Client[]>('/v1/advisor/clients');
  },

  async deleteClient(clientUuid: string): Promise<void> {
    return apiFetch<void>(`/v1/advisor/clients/${clientUuid}`, {
      method: 'DELETE',
    });
  },
};
