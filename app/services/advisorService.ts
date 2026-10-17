// services/advisorService.ts
import type {
  AdvisorProfile,
  AdvisorStatement,
  AdvisorStatementPayload,
  AdvisorProfileUpdatePayload,
  Client,
  ClientCreatePayload,
  ClientLookupResponse,
  ClientProfileUpdatePayload,
} from "../models/Advisor";
import { apiFetch, apiFetchForm } from "./apiClient";

export const advisorService = {
  // --- Advisor own profile ---

  async getAdvisorProfile(): Promise<AdvisorProfile> {
    return apiFetch<AdvisorProfile>('/advisor/profile');
  },

  async updateAdvisorProfile(payload: AdvisorProfileUpdatePayload): Promise<void> {
    return apiFetch<void>('/advisor/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async uploadAdvisorLogo(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetchForm<void>('/advisor/profile/logo', formData, { method: 'POST' });
  },

  async deleteAdvisorLogo(): Promise<void> {
    return apiFetch<void>('/advisor/profile/logo', {
      method: 'DELETE',
    });
  },

  // GET /advisor/statement — null while never saved.
  async getAdvisorStatement(): Promise<AdvisorStatement | null> {
    return apiFetch<AdvisorStatement | null>('/advisor/statement');
  },

  // PUT /advisor/statement — the whole statement; another register number puts it back to be verified.
  async saveAdvisorStatement(payload: AdvisorStatementPayload): Promise<AdvisorStatement> {
    return apiFetch<AdvisorStatement>('/advisor/statement', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // --- Client management ---

  async getClients(): Promise<Client[]> {
    return apiFetch<Client[]>('/advisor/clients');
  },

  async lookupClient(email: string): Promise<ClientLookupResponse> {
    return apiFetch<ClientLookupResponse>(`/advisor/clients/lookup?email=${encodeURIComponent(email)}`);
  },

  async createClient(payload: ClientCreatePayload): Promise<Client> {
    return apiFetch<Client>('/advisor/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteClient(clientUuid: string): Promise<void> {
    return apiFetch<void>(`/advisor/clients/${clientUuid}`, {
      method: 'DELETE',
    });
  },

  async updateClientProfile(clientUuid: string, payload: ClientProfileUpdatePayload): Promise<void> {
    return apiFetch<void>(`/advisor/clients/${clientUuid}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
