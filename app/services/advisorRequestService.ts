// services/advisorRequestService.ts
import type { AdvisorMatch, AdvisorRequest, AdvisorRequestPayload } from "../models/AdvisorRequest";
import type { InvestorPolicy } from "../models/InvestorPolicy";
import { mergeWithDefaults } from "../lib/ips";
import { apiFetch } from "./apiClient";

export const advisorRequestService = {
  // --- The investor ---

  // GET /users/advisor-matches — at most 3 advisors, best first. 409 InvestorPolicyRequiredError
  // before the caller saved an investor policy.
  async getMatches(): Promise<AdvisorMatch[]> {
    return apiFetch<AdvisorMatch[]>("/users/advisor-matches");
  },

  // POST /users/advisor-requests — 409 AdvisorRequestPendingError while another one is pending.
  async createRequest(payload: AdvisorRequestPayload): Promise<AdvisorRequest> {
    return apiFetch<AdvisorRequest>("/users/advisor-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // GET /users/advisor-requests — newest first.
  async getMyRequests(): Promise<AdvisorRequest[]> {
    return apiFetch<AdvisorRequest[]>("/users/advisor-requests");
  },

  async withdrawRequest(requestUuid: string): Promise<AdvisorRequest> {
    return apiFetch<AdvisorRequest>(`/users/advisor-requests/${requestUuid}/withdraw`, { method: "POST" });
  },

  // --- The advisor ---

  // GET /advisor/requests — newest first.
  async getIncomingRequests(): Promise<AdvisorRequest[]> {
    return apiFetch<AdvisorRequest[]>("/advisor/requests");
  },

  async acceptRequest(requestUuid: string): Promise<AdvisorRequest> {
    return apiFetch<AdvisorRequest>(`/advisor/requests/${requestUuid}/accept`, { method: "POST" });
  },

  async declineRequest(requestUuid: string, reply: string): Promise<AdvisorRequest> {
    return apiFetch<AdvisorRequest>(`/advisor/requests/${requestUuid}/decline`, {
      method: "POST",
      body: JSON.stringify({ reply }),
    });
  },

  // GET /advisor/requests/{uuid}/investor-policy — the version the investor shared with the request.
  async getSharedPolicy(requestUuid: string): Promise<InvestorPolicy | null> {
    const stored = await apiFetch<Partial<InvestorPolicy> | null>(`/advisor/requests/${requestUuid}/investor-policy`);
    return stored ? mergeWithDefaults(stored) : null;
  },
};
