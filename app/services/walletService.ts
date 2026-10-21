// services/walletService.ts
import type {
  AnalyzeStatementRequest, Budget, BudgetInput, BudgetMonth, Category, CategoryCreateRequest, CategoryMonths, CategoryRule, CategoryUpdateRequest,
  Merchants, Observations, RecurringPayments, Movement, MovementFilters, MovementInput, MovementList,
  MovementUpdateRequest, StatementColumnMapping, StatementColumnMappingResponse, StatementImportResult,
  Transfer, TransferCreateRequest, Wallet, WalletAlertRule, WalletAlertRuleCreateRequest, WalletAlertRuleUpdateRequest,
  WalletCreateRequest, WalletReport, WalletReportRequest, WalletSummary, WalletUpdateRequest,
} from "../models/Wallet";
import { apiFetch, apiFetchForm } from "./apiClient";

// Errors come back as ApiError with the backend's `detail` as the message and its `error_type`:
// WalletNotFoundError / MovementNotFoundError (404, someone else's included), WalletArchivedError
// (409, a write on an archived wallet), WalletHasMovementsError (409, a currency change),
// MovementInTransferError (409, a transfer leg's date, amount or category), InvalidWalletError /
// InvalidMovementError / InvalidTransferError / InvalidBudgetError / InvalidAlertRuleError /
// InvalidCategoryError (422: a name taken, a parent of the other kind, too deep, past 200),
// CategoryNotFoundError (404),
// AlertRuleNotFoundError / CategoryRuleNotFoundError (404), AlertRuleLimitReachedError (409, past 50 rules), FxRatesUnavailableError
// (503, the summary or the budgets across wallets), ImportFileParsingError / ImportMappingIncompleteError (422). A demo account's
// writes are refused before they leave (see lib/demo).

function movementQuery(filters: MovementFilters = {}) {
  const params = new URLSearchParams();
  if (filters.bookedFrom) params.set("bookedFrom", filters.bookedFrom);
  if (filters.bookedTo) params.set("bookedTo", filters.bookedTo);
  for (const c of filters.categoryUuids ?? []) params.append("categoryUuid", c);
  if (filters.uncategorizedOnly) params.set("uncategorizedOnly", "true");
  if (filters.text?.trim()) params.set("text", filters.text.trim());
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.excludeTransfers) params.set("excludeTransfers", "true");
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

const insightsBase = (walletUuid: string | null) => (walletUuid ? `/v1/wallets/${walletUuid}/insights` : `/v1/wallets/insights`);

export const walletService = {
  // GET /v1/wallets — oldest first; the archived ones too when asked.
  async list(includeArchived = false): Promise<Wallet[]> {
    return apiFetch<Wallet[]>(`/v1/wallets${includeArchived ? "?includeArchived=true" : ""}`);
  },

  // POST /v1/wallets — openingBalance 0 and openingDate today unless given.
  async create(payload: WalletCreateRequest): Promise<Wallet> {
    return apiFetch<Wallet>(`/v1/wallets`, { method: "POST", body: JSON.stringify(payload) });
  },

  async get(walletUuid: string): Promise<Wallet> {
    return apiFetch<Wallet>(`/v1/wallets/${walletUuid}`);
  },

  // PATCH /v1/wallets/{w} — only the fields sent change.
  async update(walletUuid: string, payload: WalletUpdateRequest): Promise<Wallet> {
    return apiFetch<Wallet>(`/v1/wallets/${walletUuid}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  // PUT /v1/wallets/{w}/archived — an archived wallet is read only and out of the summary.
  async setArchived(walletUuid: string, archived: boolean): Promise<Wallet> {
    return apiFetch<Wallet>(`/v1/wallets/${walletUuid}/archived`, { method: "PUT", body: JSON.stringify({ archived }) });
  },

  // DELETE /v1/wallets/{w} — its movements go with it (a transfer's other leg too).
  async remove(walletUuid: string): Promise<void> {
    await apiFetch(`/v1/wallets/${walletUuid}`, { method: "DELETE" });
  },

  // GET /v1/wallets/summary (every non-archived wallet, in the user's reference currency) or
  // /v1/wallets/{w}/summary (its own currency). The last 12 months, this one included, by default.
  async summary(walletUuid: string | null, from?: string, to?: string): Promise<WalletSummary> {
    const base = walletUuid ? `/v1/wallets/${walletUuid}/summary` : `/v1/wallets/summary`;
    return apiFetch<WalletSummary>(`${base}${monthRange(from, to)}`);
  },

  // GET /v1/wallets/movements (every wallet's, archived included) or /v1/wallets/{w}/movements.
  async movements(walletUuid: string | null, filters?: MovementFilters): Promise<MovementList> {
    const base = walletUuid ? `/v1/wallets/${walletUuid}/movements` : `/v1/wallets/movements`;
    return apiFetch<MovementList>(`${base}${movementQuery(filters)}`);
  },

  // POST /v1/wallets/{w}/movements — 1 to 500, all or none.
  async addMovements(walletUuid: string, movements: MovementInput[]): Promise<Movement[]> {
    return apiFetch<Movement[]>(`/v1/wallets/${walletUuid}/movements`, { method: "POST", body: JSON.stringify(movements) });
  },

  // PATCH /v1/wallets/movements/{m}
  async updateMovement(movementUuid: string, payload: MovementUpdateRequest): Promise<Movement> {
    return apiFetch<Movement>(`/v1/wallets/movements/${movementUuid}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  // POST /v1/wallets/movements/categorize — null clears the category. A category given is the rule
  // for each movement's payee (null ends it): the payee's other movements nobody categorised take it.
  async categorize(movementUuids: string[], categoryUuid: string | null): Promise<Movement[]> {
    return apiFetch<Movement[]>(`/v1/wallets/movements/categorize`, {
      method: "POST",
      body: JSON.stringify({ movementUuids, categoryUuid }),
    });
  },

  // DELETE /v1/wallets/movements — all or none; a transfer's leg takes the other with it (counted).
  async deleteMovements(movementUuids: string[]): Promise<{ deleted: number }> {
    return apiFetch<{ deleted: number }>(`/v1/wallets/movements`, { method: "DELETE", body: JSON.stringify(movementUuids) });
  },

  // POST /v1/wallets/transfers
  async transfer(payload: TransferCreateRequest): Promise<Transfer> {
    return apiFetch<Transfer>(`/v1/wallets/transfers`, { method: "POST", body: JSON.stringify(payload) });
  },

  // POST /v1/wallets/transfers/link — two movements of two wallets, opposite in sign, made one
  // transfer (their categories are cleared).
  async linkTransfer(firstMovementUuid: string, secondMovementUuid: string): Promise<Transfer> {
    return apiFetch<Transfer>(`/v1/wallets/transfers/link`, {
      method: "POST",
      body: JSON.stringify({ firstMovementUuid, secondMovementUuid }),
    });
  },

  // POST /v1/wallets/transfers/{t}/unlink — back to two plain, uncategorised movements.
  async unlinkTransfer(transferUuid: string): Promise<Movement[]> {
    return apiFetch<Movement[]>(`/v1/wallets/transfers/${transferUuid}/unlink`, { method: "POST" });
  },

  // GET /v1/wallets/insights/categories or /v1/wallets/{w}/insights/categories — each month's money
  // in and out by category (the last 12 by default), transfers left out.
  async categoryMonths(walletUuid: string | null, from?: string, to?: string): Promise<CategoryMonths> {
    return apiFetch<CategoryMonths>(`${insightsBase(walletUuid)}/categories${monthRange(from, to)}`);
  },

  // GET .../insights/merchants — where the money went, by payee, most spent first.
  async merchants(walletUuid: string | null, from?: string, to?: string, limit?: number): Promise<Merchants> {
    const params = new URLSearchParams(monthRange(from, to).slice(1));
    if (limit !== undefined) params.set("limit", String(limit));
    const query = params.toString();
    return apiFetch<Merchants>(`${insightsBase(walletUuid)}/merchants${query ? `?${query}` : ""}`);
  },

  // GET .../insights/recurring — the payments that repeat (the last 13 months), not lapsed.
  async recurringPayments(walletUuid: string | null): Promise<RecurringPayments> {
    return apiFetch<RecurringPayments>(`${insightsBase(walletUuid)}/recurring`);
  },

  // GET .../insights/observations — what stands out about last month.
  async observations(walletUuid: string | null): Promise<Observations> {
    return apiFetch<Observations>(`${insightsBase(walletUuid)}/observations`);
  },

  // GET /v1/wallets/categories — the user's, in tree order (a parent before its children, income
  // first); the presets are made on the first read. The deleted ones last, when asked.
  async categories(includeDeleted = false): Promise<Category[]> {
    return apiFetch<Category[]>(`/v1/wallets/categories${includeDeleted ? "?includeDeleted=true" : ""}`);
  },

  async createCategory(payload: CategoryCreateRequest): Promise<Category> {
    return apiFetch<Category>(`/v1/wallets/categories`, { method: "POST", body: JSON.stringify(payload) });
  },

  // PATCH /v1/wallets/categories/{c} — its children move with it.
  async updateCategory(categoryUuid: string, payload: CategoryUpdateRequest): Promise<Category> {
    return apiFetch<Category>(`/v1/wallets/categories/${categoryUuid}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  // DELETE /v1/wallets/categories — all or none: each one's children, movements, rules and income
  // alerts go to its parent; its budget ends this month.
  async deleteCategories(categoryUuids: string[]): Promise<void> {
    await apiFetch(`/v1/wallets/categories`, { method: "DELETE", body: JSON.stringify(categoryUuids) });
  },

  // GET /v1/wallets/budgets — this month's, in the categories' tree order.
  async budgets(): Promise<Budget[]> {
    return apiFetch<Budget[]>(`/v1/wallets/budgets`);
  },

  // POST /v1/wallets/budgets — sets the categories' monthly limits from this month on (one per
  // spending category, at any level), all or none; answers every budget.
  async setBudgets(budgets: BudgetInput[]): Promise<Budget[]> {
    return apiFetch<Budget[]>(`/v1/wallets/budgets`, { method: "POST", body: JSON.stringify(budgets) });
  },

  // DELETE /v1/wallets/budgets — from this month on: the months before keep them.
  async deleteBudgets(categoryUuids: string[]): Promise<void> {
    await apiFetch(`/v1/wallets/budgets`, { method: "DELETE", body: JSON.stringify(categoryUuids) });
  },

  // GET /v1/wallets/budgets/month — a month (YYYY-MM, this one by default) against the budgets it had.
  async budgetMonth(month?: string): Promise<BudgetMonth> {
    return apiFetch<BudgetMonth>(`/v1/wallets/budgets/month${month ? `?month=${month}` : ""}`);
  },

  // GET /v1/wallets/alert-rules (every rule) or /v1/wallets/{w}/alert-rules (its own and those on
  // every wallet), oldest first, each with what it finds today.
  async alertRules(walletUuid: string | null): Promise<WalletAlertRule[]> {
    return apiFetch<WalletAlertRule[]>(walletUuid ? `/v1/wallets/${walletUuid}/alert-rules` : `/v1/wallets/alert-rules`);
  },

  // POST /v1/wallets/alert-rules — what it finds when made is shown, not told.
  async addAlertRule(payload: WalletAlertRuleCreateRequest): Promise<WalletAlertRule> {
    return apiFetch<WalletAlertRule>(`/v1/wallets/alert-rules`, { method: "POST", body: JSON.stringify(payload) });
  },

  // PATCH /v1/wallets/alert-rules/{r}
  async updateAlertRule(ruleUuid: string, payload: WalletAlertRuleUpdateRequest): Promise<WalletAlertRule> {
    return apiFetch<WalletAlertRule>(`/v1/wallets/alert-rules/${ruleUuid}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  async removeAlertRule(ruleUuid: string): Promise<void> {
    await apiFetch(`/v1/wallets/alert-rules/${ruleUuid}`, { method: "DELETE" });
  },

  // GET /v1/wallets/category-rules — by payee, money out before money in.
  async categoryRules(): Promise<CategoryRule[]> {
    return apiFetch<CategoryRule[]>(`/v1/wallets/category-rules`);
  },

  // DELETE /v1/wallets/category-rules/{r} — the movements it categorised are left uncategorised.
  async removeCategoryRule(ruleUuid: string): Promise<void> {
    await apiFetch(`/v1/wallets/category-rules/${ruleUuid}`, { method: "DELETE" });
  },

  // POST /v1/wallets/{w}/import/analyze-columns — a proposed mapping for a statement's columns.
  async analyzeStatement(walletUuid: string, payload: AnalyzeStatementRequest): Promise<StatementColumnMappingResponse> {
    return apiFetch<StatementColumnMappingResponse>(`/v1/wallets/${walletUuid}/import/analyze-columns`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // POST /v1/wallets/{w}/import/commit — the file (CSV/XLS/XLSX, up to 10 MB) and the confirmed
  // mapping. Rows already in the wallet are counted as duplicates, not added again; what's imported
  // takes the category of its payee's rule, if there is one.
  async commitStatement(walletUuid: string, file: File, mapping: StatementColumnMapping): Promise<StatementImportResult> {
    const form = new FormData();
    form.append("file", file);
    form.append("mapping", JSON.stringify(mapping));
    return apiFetchForm<StatementImportResult>(`/v1/wallets/${walletUuid}/import/commit`, form);
  },

  // GET /v1/wallets/reports — every wallet's reports (archived ones' too), newest first.
  async reports(): Promise<WalletReport[]> {
    return apiFetch<WalletReport[]>(`/v1/wallets/reports`);
  },

  /**
   * POST /v1/wallets/reports — queues a wallet's full report, its whole history (needs the plan's
   * reports); its outcome arrives as a notification. 409 while another of the same wallet's is in
   * progress, unless `force`.
   * @deprecated Deprecated (2026-10-22): a report is asked for in the assistant's chat only (its action card); served until removed.
   */
  async requestReport(payload: WalletReportRequest): Promise<{ jobId: string }> {
    return apiFetch<{ jobId: string }>(`/v1/wallets/reports`, { method: "POST", body: JSON.stringify(payload) });
  },

  // GET /v1/wallets/reports/{walletUuid}/{d}/download — an hour's link to the file.
  async reportDownloadUrl(walletUuid: string, documentId: string): Promise<{ url: string }> {
    return apiFetch<{ url: string }>(`/v1/wallets/reports/${walletUuid}/${documentId}/download`);
  },

  async addReportTag(walletUuid: string, documentId: string, name: string): Promise<void> {
    await apiFetch(`/v1/wallets/reports/${walletUuid}/${documentId}/tags`, { method: "POST", body: JSON.stringify({ name }) });
  },

  async removeReportTag(walletUuid: string, documentId: string, name: string): Promise<void> {
    await apiFetch(`/v1/wallets/reports/${walletUuid}/${documentId}/tags/${encodeURIComponent(name)}`, { method: "DELETE" });
  },
};
