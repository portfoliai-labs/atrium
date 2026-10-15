// services/advisorService.ts
import type {
  AdvisorProfile,
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

  // --- Client management ---

  async getClients(): Promise<Client[]> {
    return apiFetch<Client[]>('/v1/advisor/clients');
  },

  async lookupClient(email: string): Promise<ClientLookupResponse> {
    return apiFetch<ClientLookupResponse>(`/v1/advisor/clients/lookup?email=${encodeURIComponent(email)}`);
  },

  async createClient(payload: ClientCreatePayload): Promise<Client> {
    return apiFetch<Client>('/v1/advisor/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteClient(clientUuid: string): Promise<void> {
    return apiFetch<void>(`/v1/advisor/clients/${clientUuid}`, {
      method: 'DELETE',
    });
  },

  async updateClientProfile(clientUuid: string, payload: ClientProfileUpdatePayload): Promise<void> {
    return apiFetch<void>(`/v1/advisor/clients/${clientUuid}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
