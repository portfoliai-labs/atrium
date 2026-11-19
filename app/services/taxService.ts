// services/taxService.ts
// The user's taxes (see models/Tax): on their investments, a whole year's with the properties', and
// the tax alert rules. With `clientUuid`, an advisor's view of that client's (the same answers;
// 403 for someone who isn't their client; a year's without the properties; no alert rules).
import type {
  CostMethod, HoldingKind, HoldingOverrideRequest, InvestmentIncome, RealizedGains, TaxAlertRule, TaxAlertRuleRequest,
  TaxAlertRuleUpdateRequest, TaxYear, YearTaxes,
} from "../models/Tax";
import { apiFetch } from "./apiClient";

const base = (clientUuid?: string | null) => (clientUuid ? `/v1/advisor/clients/${clientUuid}/taxes` : "/v1/taxes");

export const taxService = {
  // GET /v1/taxes/realized-gains?year=&method= — the year's disposals. Without a method, the tax
  // regime's.
  async realizedGains(year: number, method?: CostMethod | null, clientUuid?: string | null): Promise<RealizedGains> {
    const query = new URLSearchParams({ year: String(year), ...(method ? { method } : {}) });
    return apiFetch<RealizedGains>(`${base(clientUuid)}/realized-gains?${query}`);
  },

  // GET /v1/taxes/income?year= — the year's dividends, coupons and interest.
  async income(year: number, clientUuid?: string | null): Promise<InvestmentIncome> {
    return apiFetch<InvestmentIncome>(`${base(clientUuid)}/income?year=${year}`);
  },

  // GET /v1/taxes/years/{year} — 409 TaxRegimeUnavailableError without a tax residence or a
  // regime for it.
  async year(year: number, clientUuid?: string | null): Promise<TaxYear> {
    return apiFetch<TaxYear>(`${base(clientUuid)}/years/${year}`);
  },

  // GET /v1/taxes/years?fromYear= — every year's, from the first transaction's (fromYear if
  // later) to this one, oldest first, in one call; [] without any transaction. 409 as year's.
  async years(fromYear: number, clientUuid?: string | null): Promise<TaxYear[]> {
    return apiFetch<TaxYear[]>(`${base(clientUuid)}/years?fromYear=${fromYear}`);
  },

  // GET /v1/taxes/overview/{year} — every tax of the year: the investments' (null with
  // investmentsUnavailable without a regime, never a 409), the properties', the totals and the
  // instalments by due day.
  async overview(year: number, clientUuid?: string | null): Promise<YearTaxes> {
    return apiFetch<YearTaxes>(`${base(clientUuid)}/overview/${year}`);
  },

  // PUT /v1/taxes/wealth/overrides/{kind}/{uuid}/{year} — the user's own figure for a holding's
  // year: a property's value (the IVIE's base), an account's or a portfolio's wealth tax paid
  // abroad. 404 for a holding not theirs; 422 for the wrong figure for its kind.
  async setHoldingOverride(kind: HoldingKind, uuid: string, year: number, figure: HoldingOverrideRequest): Promise<void> {
    await apiFetch(`/v1/taxes/wealth/overrides/${kind}/${uuid}/${year}`, { method: "PUT", body: JSON.stringify(figure) });
  },

  // DELETE /v1/taxes/wealth/overrides/{kind}/{uuid}/{year} — back to the facts' figure.
  async deleteHoldingOverride(kind: HoldingKind, uuid: string, year: number): Promise<void> {
    await apiFetch(`/v1/taxes/wealth/overrides/${kind}/${uuid}/${year}`, { method: "DELETE" });
  },

  // GET /v1/taxes/alert-rules — the user's tax alert rules, each with what it finds today.
  async alertRules(): Promise<TaxAlertRule[]> {
    return apiFetch<TaxAlertRule[]>("/v1/taxes/alert-rules");
  },

  // POST /v1/taxes/alert-rules — 422 InvalidAlertRuleError (e.g. a property on losses_expiring);
  // 409 past 50 rules.
  async addAlertRule(rule: TaxAlertRuleRequest): Promise<TaxAlertRule> {
    return apiFetch<TaxAlertRule>("/v1/taxes/alert-rules", { method: "POST", body: JSON.stringify(rule) });
  },

  // PATCH /v1/taxes/alert-rules/{uuid} — only what's sent changes; its type may change.
  async updateAlertRule(uuid: string, changes: TaxAlertRuleUpdateRequest): Promise<TaxAlertRule> {
    return apiFetch<TaxAlertRule>(`/v1/taxes/alert-rules/${uuid}`, { method: "PATCH", body: JSON.stringify(changes) });
  },

  async removeAlertRule(uuid: string): Promise<void> {
    await apiFetch(`/v1/taxes/alert-rules/${uuid}`, { method: "DELETE" });
  },
};
