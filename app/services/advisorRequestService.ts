// services/advisorRequestService.ts
import type { AdvisorCard, AdvisorMatch, AdvisorRequest, AdvisorRequestPayload } from "../models/AdvisorRequest";
import type { InvestorPolicy } from "../models/InvestorPolicy";
import type { NetworkAdvisor, SnapshotShare } from "../models/ClientSnapshot";
import { mergeWithDefaults } from "../lib/ips";
import { apiFetch } from "./apiClient";

export const advisorRequestService = {
  // --- The investor ---

  // GET /users/advisor-matches — at most 3 advisors, best first: the verified ones, then the
  // network's (never verified), left out with `onlyVerified`. 409 InvestorPolicyRequiredError
  // before the caller saved an investor policy.
  async getMatches(onlyVerified = false): Promise<AdvisorMatch[]> {
    return apiFetch<AdvisorMatch[]>(`/v1/users/advisor-matches?onlyVerified=${onlyVerified}`);
  },

  // POST /users/advisor-requests — 409 AdvisorRequestPendingError while another one is pending;
  // to a network advisor (by advisorPubkey), 409 NetworkRefusedError when the network refused it.
  async createRequest(payload: AdvisorRequestPayload): Promise<AdvisorRequest> {
    return apiFetch<AdvisorRequest>("/v1/users/advisor-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // GET /users/advisor-requests — newest first.
  async getMyRequests(): Promise<AdvisorRequest[]> {
    return apiFetch<AdvisorRequest[]>("/v1/users/advisor-requests");
  },

  async withdrawRequest(requestUuid: string): Promise<AdvisorRequest> {
    return apiFetch<AdvisorRequest>(`/v1/users/advisor-requests/${requestUuid}/withdraw`, { method: "POST" });
  },

  // GET /users/advisors — the investor's advisors now (each through a request they accepted): they
  // read the investor's data, and change none of it.
  async getMyAdvisors(): Promise<AdvisorCard[]> {
    return apiFetch<AdvisorCard[]>("/v1/users/advisors");
  },

  // DELETE /users/advisors/{advisor_uuid} — ends it: the advisor no longer sees the investor's
  // data. 404 when they aren't the investor's advisor.
  async endAdvisor(advisorUuid: string): Promise<void> {
    await apiFetch<{ status: string }>(`/v1/users/advisors/${advisorUuid}`, { method: "DELETE" });
  },

  // --- The investor's network advisors (the portfolios shared with them) ---

  // GET /users/network-advisors — the network advisors who accepted the caller, the pair not
  // ended, oldest first, each with what the caller shares with them (null: nothing).
  async getMyNetworkAdvisors(): Promise<NetworkAdvisor[]> {
    return apiFetch<NetworkAdvisor[]>("/v1/users/network-advisors");
  },

  // PUT /users/network-advisors/{key}/share — these standard portfolios of the caller's, replacing
  // what was shared: 403 NotYourNetworkAdvisorError, 409 PortfolioNotShareableError
  // (`portfolio_uuid`), 422 InvalidFieldError (none, or more than 50) or InvalidAdvisorKeyError.
  async setShare(advisorPubkey: string, portfolioUuids: string[]): Promise<SnapshotShare> {
    return apiFetch<SnapshotShare>(`/v1/users/network-advisors/${encodeURIComponent(advisorPubkey)}/share`, {
      method: "PUT",
      body: JSON.stringify({ portfolioUuids }),
    });
  },

  // DELETE /users/network-advisors/{key}/share — stops sharing: the advisor is told and the file
  // deleted (the share is `ending` meanwhile). 404 SnapshotShareNotFoundError with no share.
  async stopShare(advisorPubkey: string): Promise<void> {
    await apiFetch<{ status: string }>(`/v1/users/network-advisors/${encodeURIComponent(advisorPubkey)}/share`, { method: "DELETE" });
  },

  // DELETE /users/network-advisors/{key} — ends the relation (sharing stops with it). 404 when
  // they aren't the caller's network advisor.
  async endNetworkAdvisor(advisorPubkey: string): Promise<void> {
    await apiFetch<{ status: string }>(`/v1/users/network-advisors/${encodeURIComponent(advisorPubkey)}`, { method: "DELETE" });
  },

  // --- The advisor ---

  // GET /advisor/requests — newest first.
  async getIncomingRequests(): Promise<AdvisorRequest[]> {
    return apiFetch<AdvisorRequest[]>("/v1/advisor/requests");
  },

  // A network investor is answered by a private message and becomes no client: the pair only talks.
  async acceptRequest(requestUuid: string, reply = ""): Promise<AdvisorRequest> {
    return apiFetch<AdvisorRequest>(`/v1/advisor/requests/${requestUuid}/accept`, {
      method: "POST",
      body: JSON.stringify({ reply }),
    });
  },

  async declineRequest(requestUuid: string, reply: string): Promise<AdvisorRequest> {
    return apiFetch<AdvisorRequest>(`/v1/advisor/requests/${requestUuid}/decline`, {
      method: "POST",
      body: JSON.stringify({ reply }),
    });
  },

  // GET /advisor/requests/{uuid}/investor-policy — the version the investor shared with the request.
  async getSharedPolicy(requestUuid: string): Promise<InvestorPolicy | null> {
    const stored = await apiFetch<Partial<InvestorPolicy> | null>(`/v1/advisor/requests/${requestUuid}/investor-policy`);
    return stored ? mergeWithDefaults(stored) : null;
  },
};
