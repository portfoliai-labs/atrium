// services/realEstateService.ts
import type {
  Mortgage, MortgageInput, MortgageSchedule, MortgageUpdateRequest, Property, PropertyCreateRequest,
  PropertyCreateResponse, PropertyTransaction, PropertyTransactionFilters, PropertyTransactionInput,
  PropertyTransactionList, PropertyTransactionUpdateRequest, PropertyUpdateRequest, RealEstateOverview,
  RealEstateSummary, Valuation, ValuationInput, Amount,
} from "../models/RealEstate";
import { apiFetch } from "./apiClient";

// Errors come back as ApiError with the backend's `detail` as the message and its `error_type`:
// PropertyNotFoundError / TransactionNotFoundError / MortgageNotFoundError / ValuationNotFoundError
// (404, someone else's included), InvalidPropertyError / InvalidTransactionError /
// InvalidMortgageError / InvalidRateChangeError / InvalidValuationError (422, as FastAPI's own),
// PropertyArchivedError (409, a write on an archived property), PropertyHasTransactionsError (409,
// a currency change), MortgageHasTransactionsError (409, deleting a mortgage that transactions
// name). A demo account's writes are refused before they leave (see lib/demo).

const BASE = "/v1/real-estate";

function transactionQuery(filters: PropertyTransactionFilters = {}) {
  const params = new URLSearchParams();
  if (filters.bookedFrom) params.set("bookedFrom", filters.bookedFrom);
  if (filters.bookedTo) params.set("bookedTo", filters.bookedTo);
  for (const k of filters.kinds ?? []) params.append("kind", k);
  if (filters.text?.trim()) params.set("text", filters.text.trim());
  if (filters.mortgageUuid) params.set("mortgageUuid", filters.mortgageUuid);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.offset !== undefined) params.set("offset", String(filters.offset));
  const query = params.toString();
  return query ? `?${query}` : "";
}

function monthRange(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const realEstateService = {
  // GET /v1/real-estate/overview — every non-archived property, today, in the reference currency.
  async overview(): Promise<RealEstateOverview> {
    return apiFetch<RealEstateOverview>(`${BASE}/overview`);
  },

  // GET /v1/real-estate/summary (every non-archived property, in the reference currency) or
  // /properties/{p}/summary (its own currency). The last 12 months, this one included, by default.
  async summary(propertyUuid: string | null, from?: string, to?: string): Promise<RealEstateSummary> {
    const base = propertyUuid ? `${BASE}/properties/${propertyUuid}/summary` : `${BASE}/summary`;
    return apiFetch<RealEstateSummary>(`${base}${monthRange(from, to)}`);
  },

  // GET /v1/real-estate/properties — the archived ones too when asked. Only this list carries
  // figures.reference.
  async list(includeArchived = false): Promise<Property[]> {
    return apiFetch<Property[]>(`${BASE}/properties${includeArchived ? "?includeArchived=true" : ""}`);
  },

  // POST /v1/real-estate/properties — with its purchase and mortgage, all or none.
  async create(payload: PropertyCreateRequest): Promise<PropertyCreateResponse> {
    return apiFetch<PropertyCreateResponse>(`${BASE}/properties`, { method: "POST", body: JSON.stringify(payload) });
  },

  async get(propertyUuid: string): Promise<Property> {
    return apiFetch<Property>(`${BASE}/properties/${propertyUuid}`);
  },

  // PATCH /v1/real-estate/properties/{p} — only the fields sent change.
  async update(propertyUuid: string, payload: PropertyUpdateRequest): Promise<Property> {
    return apiFetch<Property>(`${BASE}/properties/${propertyUuid}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  // PUT /v1/real-estate/properties/{p}/archived — an archived property takes no writes and is out
  // of the figures across properties.
  async setArchived(propertyUuid: string, archived: boolean): Promise<Property> {
    return apiFetch<Property>(`${BASE}/properties/${propertyUuid}/archived`, { method: "PUT", body: JSON.stringify({ archived }) });
  },

  // DELETE /v1/real-estate/properties/{p} — its transactions, mortgages and valuations go with it.
  async remove(propertyUuid: string): Promise<void> {
    await apiFetch(`${BASE}/properties/${propertyUuid}`, { method: "DELETE" });
  },

  // GET /v1/real-estate/transactions (every property's) or /properties/{p}/transactions.
  async transactions(propertyUuid: string | null, filters?: PropertyTransactionFilters): Promise<PropertyTransactionList> {
    const base = propertyUuid ? `${BASE}/properties/${propertyUuid}/transactions` : `${BASE}/transactions`;
    return apiFetch<PropertyTransactionList>(`${base}${transactionQuery(filters)}`);
  },

  // POST /v1/real-estate/properties/{p}/transactions — 1 to 500, all or none.
  async addTransactions(propertyUuid: string, transactions: PropertyTransactionInput[]): Promise<PropertyTransaction[]> {
    return apiFetch<PropertyTransaction[]>(`${BASE}/properties/${propertyUuid}/transactions`, {
      method: "POST",
      body: JSON.stringify(transactions),
    });
  },

  // PATCH /v1/real-estate/transactions/{t}
  async updateTransaction(transactionUuid: string, payload: PropertyTransactionUpdateRequest): Promise<PropertyTransaction> {
    return apiFetch<PropertyTransaction>(`${BASE}/transactions/${transactionUuid}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  // DELETE /v1/real-estate/transactions — all or none.
  async deleteTransactions(transactionUuids: string[]): Promise<{ deleted: number }> {
    return apiFetch<{ deleted: number }>(`${BASE}/transactions`, { method: "DELETE", body: JSON.stringify(transactionUuids) });
  },

  // GET /v1/real-estate/mortgages (every property's) or /properties/{p}/mortgages; closed ones
  // included.
  async mortgages(propertyUuid: string | null): Promise<Mortgage[]> {
    return apiFetch<Mortgage[]>(propertyUuid ? `${BASE}/properties/${propertyUuid}/mortgages` : `${BASE}/mortgages`);
  },

  // POST /v1/real-estate/properties/{p}/mortgages
  async addMortgage(propertyUuid: string, payload: MortgageInput): Promise<Mortgage> {
    return apiFetch<Mortgage>(`${BASE}/properties/${propertyUuid}/mortgages`, { method: "POST", body: JSON.stringify(payload) });
  },

  async getMortgage(mortgageUuid: string): Promise<Mortgage> {
    return apiFetch<Mortgage>(`${BASE}/mortgages/${mortgageUuid}`);
  },

  // PATCH /v1/real-estate/mortgages/{m} — closedOn closes it, "" opens it again.
  async updateMortgage(mortgageUuid: string, payload: MortgageUpdateRequest): Promise<Mortgage> {
    return apiFetch<Mortgage>(`${BASE}/mortgages/${mortgageUuid}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  // DELETE /v1/real-estate/mortgages/{m} — refused (409) while transactions name it.
  async removeMortgage(mortgageUuid: string): Promise<void> {
    await apiFetch(`${BASE}/mortgages/${mortgageUuid}`, { method: "DELETE" });
  },

  // POST /v1/real-estate/mortgages/{m}/rate-changes — one already on that day is replaced.
  async changeRate(mortgageUuid: string, effectiveOn: string, ratePct: Amount): Promise<Mortgage> {
    return apiFetch<Mortgage>(`${BASE}/mortgages/${mortgageUuid}/rate-changes`, {
      method: "POST",
      body: JSON.stringify({ effectiveOn, ratePct }),
    });
  },

  // DELETE /v1/real-estate/mortgages/{m}/rate-changes/{YYYY-MM-DD}
  async removeRateChange(mortgageUuid: string, effectiveOn: string): Promise<Mortgage> {
    return apiFetch<Mortgage>(`${BASE}/mortgages/${mortgageUuid}/rate-changes/${effectiveOn}`, { method: "DELETE" });
  },

  // GET /v1/real-estate/mortgages/{m}/schedule — computed on read.
  async schedule(mortgageUuid: string): Promise<MortgageSchedule> {
    return apiFetch<MortgageSchedule>(`${BASE}/mortgages/${mortgageUuid}/schedule`);
  },

  // GET /v1/real-estate/properties/{p}/valuations — newest first.
  async valuations(propertyUuid: string): Promise<Valuation[]> {
    return apiFetch<Valuation[]>(`${BASE}/properties/${propertyUuid}/valuations`);
  },

  // POST /v1/real-estate/properties/{p}/valuations — the whole property's value.
  async addValuation(propertyUuid: string, payload: ValuationInput): Promise<Valuation> {
    return apiFetch<Valuation>(`${BASE}/properties/${propertyUuid}/valuations`, { method: "POST", body: JSON.stringify(payload) });
  },

  // DELETE /v1/real-estate/valuations/{v}
  async removeValuation(valuationUuid: string): Promise<void> {
    await apiFetch(`${BASE}/valuations/${valuationUuid}`, { method: "DELETE" });
  },
};
