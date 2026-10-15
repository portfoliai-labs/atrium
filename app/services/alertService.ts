// services/alertService.ts
import type {
  AlertRuleResponse, AlertRuleCreateRequest, AlertRuleUpdateRequest, ClientAlertRuleResponse,
} from "../models/Alert";
import { apiFetch } from "./apiClient";

// Errors come back as ApiError with the backend's `detail` as the message: 404 (no such rule
// or portfolio), 409 (already at the 20 rules made by hand, or KeptAlertRuleOperationError: new
// params for, or deleting, a rule an adopted strategy keeps), 422 (a portfolio_change whose window
// the history doesn't cover yet, or a value out of range), 403 (a portfolio that isn't the
// caller's own or their client's).
export const alertService = {
  // GET /v1/portfolios/{p}/alert-rules — the rules on that portfolio, oldest first; an empty
  // list (never null) if none. An advisor manages a client's the same way, on the client's
  // portfolio uuid: those rules are the advisor's own (the client doesn't see them, and the
  // advisor is the one notified). With `source`, only the rules that keeps (an adoption's).
  async listRules(portfolioUuid: string, source?: string): Promise<AlertRuleResponse[]> {
    const query = source ? `?source=${encodeURIComponent(source)}` : "";
    return apiFetch<AlertRuleResponse[]>(`/v1/portfolios/${portfolioUuid}/alert-rules${query}`);
  },

  // GET /v1/advisor/alert-rules — advisors only: every rule they put on any client's
  // portfolio, oldest first, each carrying which portfolio/client it watches.
  async listClientRules(): Promise<ClientAlertRuleResponse[]> {
    return apiFetch<ClientAlertRuleResponse[]>(`/v1/advisor/alert-rules`);
  },

  // POST /v1/portfolios/{p}/alert-rules — notifyEmail / notifyInApp default to true when omitted.
  async createRule(portfolioUuid: string, payload: AlertRuleCreateRequest): Promise<AlertRuleResponse> {
    return apiFetch<AlertRuleResponse>(`/v1/portfolios/${portfolioUuid}/alert-rules`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // PATCH /v1/portfolios/{p}/alert-rules/{ruleId} — only the fields sent change.
  async updateRule(
    portfolioUuid: string, ruleId: string, payload: AlertRuleUpdateRequest,
  ): Promise<AlertRuleResponse> {
    return apiFetch<AlertRuleResponse>(
      `/v1/portfolios/${portfolioUuid}/alert-rules/${encodeURIComponent(ruleId)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
  },

  // DELETE /v1/portfolios/{p}/alert-rules/{ruleId}
  async deleteRule(portfolioUuid: string, ruleId: string): Promise<void> {
    await apiFetch<{ status: string }>(
      `/v1/portfolios/${portfolioUuid}/alert-rules/${encodeURIComponent(ruleId)}`,
      { method: "DELETE" },
    );
  },
};
