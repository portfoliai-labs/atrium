// models/Alert.ts
//
// Types for the alert rules under /v1/portfolios/{p}/alert-rules (schemas AlertRuleResponse /
// AlertRuleCreateRequest / AlertRuleUpdateRequest). Every key of a response is always present; a
// value that doesn't apply is `null`. Every threshold is a percentage (5 = 5%): there are no
// absolute-value thresholds.

import type { StrategyCategory } from "./Strategy";

type AlertDirection = "up" | "down";

// "day" / "week" / "month" are 1 / 7 / 30 calendar days.
type AlertWindow = "day" | "week" | "month";

// The portfolio's result (change in total P&L, net of deposits and withdrawals, as a % of the
// portfolio's value at the window's reference day) moved by at least thresholdPct in `direction`.
// Not the time-weighted return the reports show. thresholdPct is > 0 and <= 1000.
interface PortfolioChangeParams {
  type: "portfolio_change";
  direction: AlertDirection;
  thresholdPct: number;
  window: AlertWindow;
}

// What a weight rule weighs. `asset`: one security, by its holdings assetId. `group`: 1–50
// holdings assetIds weighed together (those not held count as 0), `label` the user's own name for
// it. `category`: the held securities of that category, as the user's asset categories have it
// (models/AssetCategory). `any_asset`: each holding on its own, the heaviest one measured.
interface AssetSelector {
  kind: "asset";
  assetId: string;
}

interface GroupSelector {
  kind: "group";
  assetIds: string[];
  label: string | null;
}

interface CategorySelector {
  kind: "category";
  category: StrategyCategory;
}

interface AnyAssetSelector {
  kind: "any_asset";
}

type WeightSelector = AssetSelector | GroupSelector | CategorySelector | AnyAssetSelector;

// The share of the portfolio the selector picks is below minPct or above maxPct: at least one is
// set, both > 0 and <= 100, min < max. `any_asset` takes a maxPct only.
interface WeightParams {
  type: "weight";
  selector: WeightSelector;
  minPct: number | null;
  maxPct: number | null;
}

type AlertParams = PortfolioChangeParams | WeightParams;

// A weight reading: which end of the range its thresholdValue is. For "min", progressPct grows
// as the weight falls toward the minimum.
type WeightBound = "min" | "max";

type AlertReadingStatus = "ok" | "unavailable";

type AlertUnavailableReason = "insufficient_history";

// The latest check of a rule, rewritten by the backend's snapshot worker about every 5 minutes.
// currentValue and thresholdValue are in % on the same scale and with the same sign (for a
// "down" rule the threshold is negative and a fall is a negative currentValue). progressPct is
// currentValue / thresholdValue * 100, already clamped to 0..100: 0 = at the threshold's level
// or moving away from it, 100 = reached or passed. It's what the gauge draws, so nothing is
// recomputed here.
interface AlertRuleReading {
  status: AlertReadingStatus;
  evaluatedAt: string;
  unavailableReason: AlertUnavailableReason | null;
  breached: boolean | null;
  currentValue: number | null;
  thresholdValue: number | null;
  progressPct: number | null;
  // A weight rule on one asset: which asset the reading is about (the heaviest one for any_asset).
  assetId: string | null;
  assetName: string | null;
  ticker: string | null;
  // A weight rule's: the end of its range the reading is measured against.
  bound: WeightBound | null;
  // portfolio_change: the P&L move in `currency`, and the day it is measured against.
  pnlChange: number | null;
  currency: string | null;
  referenceDate: string | null;
}

interface AlertRuleResponse {
  ruleId: string;
  params: AlertParams;
  notifyEmail: boolean;
  notifyInApp: boolean;
  enabled: boolean;
  // true once the condition has held for two consecutive checks (5–10 minutes) and stays true
  // while it does; null = never evaluated.
  isTriggered: boolean | null;
  lastTriggeredAt: string | null;
  // null = just created / changed / re-enabled, waiting for its first check (within ~5 min).
  // A disabled rule isn't re-checked, so its reading goes stale: ignore it while enabled is false.
  reading: AlertRuleReading | null;
  // Non-null: the rule is kept by something else, a strategy adopted on the portfolio
  // ("adoption:<id>", models/AdoptedStrategy). Only its channels and `enabled` change by hand: a
  // PATCH with params, or a DELETE, is a 409 KeptAlertRuleOperationError. It changes with the
  // adoption.
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

// GET /v1/advisor/alert-rules (advisors only): a rule the advisor put on a client's portfolio,
// with the portfolio it watches and the client who owns it.
interface ClientAlertRuleResponse extends AlertRuleResponse {
  portfolioUuid: string;
  portfolioName: string;
  clientUuid: string;
}

interface AlertRuleCreateRequest {
  params: AlertParams;
  notifyEmail?: boolean;
  notifyInApp?: boolean;
}

// Only the fields that are sent change. Changing `params`, or turning a disabled rule back on,
// restarts the rule: its next reading is a fresh baseline and never fires.
interface AlertRuleUpdateRequest {
  params?: AlertParams;
  notifyEmail?: boolean;
  notifyInApp?: boolean;
  enabled?: boolean;
}

export type {
  AlertDirection, AlertWindow, PortfolioChangeParams, AssetSelector, GroupSelector, CategorySelector, AnyAssetSelector,
  WeightSelector, WeightParams, AlertParams, WeightBound,
  AlertReadingStatus, AlertUnavailableReason, AlertRuleReading, AlertRuleResponse,
  ClientAlertRuleResponse, AlertRuleCreateRequest, AlertRuleUpdateRequest,
};
