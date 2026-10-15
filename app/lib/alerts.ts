import type { AlertParams, AlertRuleResponse, AlertWindow, WeightSelector } from "../models/Alert";
import { STRATEGY_CATEGORY_LABELS, type StrategyCategory } from "../models/Strategy";

// The backend caps the rules made by hand at 20 per portfolio (a 409 beyond that); those an
// adopted strategy keeps don't count.
export const ALERT_RULE_LIMIT = 20;

/** Whether an adopted strategy keeps the rule: its params and its existence aren't the user's to change. */
export const isKept = (rule: Pick<AlertRuleResponse, "source">) => rule.source != null;

/** A category as shown: its label for a known one, the backend's own wording otherwise. */
export const categoryLabel = (category: string) => STRATEGY_CATEGORY_LABELS[category as StrategyCategory] ?? category;

// From this share of the way to the threshold a rule reads as "approaching". The backend has no
// notion of "near" (it only says whether the condition holds), so this cut-off is the frontend's.
export const APPROACHING_FROM_PCT = 60;

export const WINDOW_LABEL: Record<AlertWindow, string> = {
  day: "1 day",
  week: "7 days",
  month: "30 days",
};

/** A percentage with at most two decimals and no trailing zeros; `signed` adds "+" to positives. */
export function formatAlertPct(value: number, signed = false): string {
  return `${signed && value > 0 ? "+" : ""}${Number(value.toFixed(2))}%`;
}

export type AlertTone = "ok" | "warn" | "danger" | "muted";

export interface AlertState {
  kind: "off" | "pending" | "unavailable" | "triggered" | "reached" | "approaching" | "ok";
  label: string;
  tone: AlertTone;
  // The gauge position, null when there's nothing to draw (off, waiting, not measurable).
  progressPct: number | null;
  // The condition holds right now, which turns the gauge's upper zone red.
  breached: boolean;
}

/**
 * The state of a rule, worked out from what the backend sends: a disabled rule is "off" (its
 * reading is stale, so it's ignored); no reading yet is "pending"; an unmeasurable one is
 * "unavailable"; isTriggered means the condition holds and has held for two checks (or held at
 * the first check, which never notifies); `breached` alone means it holds but not for two checks
 * yet; otherwise it's "approaching" from APPROACHING_FROM_PCT of the way to the threshold, and "ok"
 * below that. A weight rule outside its range says just that, where the portfolio stands.
 */
export function alertState(rule: AlertRuleResponse): AlertState {
  const reading = rule.reading;
  const base = { progressPct: null, breached: false };

  if (!rule.enabled) return { kind: "off", label: "Off", tone: "muted", ...base };
  if (reading === null) return { kind: "pending", label: "Waiting for first check", tone: "muted", ...base };
  if (reading.status === "unavailable") return { kind: "unavailable", label: "Not enough history", tone: "muted", ...base };

  const progressPct = reading.progressPct;
  const weight = rule.params.type === "weight";
  if (rule.isTriggered) return { kind: "triggered", label: weight ? "Outside your range" : "Triggered", tone: "danger", progressPct, breached: true };
  if (reading.breached) return { kind: "reached", label: weight ? "Outside your range" : "Threshold reached", tone: "danger", progressPct, breached: true };
  if (progressPct !== null && progressPct >= APPROACHING_FROM_PCT) {
    return { kind: "approaching", label: "Approaching", tone: "warn", progressPct, breached: false };
  }
  return { kind: "ok", label: "Within range", tone: "ok", progressPct, breached: false };
}

/** A weight range in words: "35–45%", "at least 5%", "at most 40%". */
export function formatRange(minPct: number | null | undefined, maxPct: number | null | undefined): string {
  if (minPct != null && maxPct != null) return `${Number(minPct.toFixed(2))}–${formatAlertPct(maxPct)}`;
  if (minPct != null) return `at least ${formatAlertPct(minPct)}`;
  return maxPct != null ? `at most ${formatAlertPct(maxPct)}` : "";
}

/**
 * A short title and subtitle for a rule, in neutral factual wording. `clientName` words it for an
 * advisor's rule on that client's portfolio.
 */
export function describeAlert(rule: AlertRuleResponse, clientName?: string): { title: string; subtitle: string } {
  const { params, reading } = rule;

  if (params.type === "portfolio_change") {
    return {
      title: `Portfolio ${params.direction === "down" ? "down" : "up"} ${formatAlertPct(params.thresholdPct)}`,
      subtitle: `Over ${WINDOW_LABEL[params.window]}`,
    };
  }

  const { selector } = params;
  const range = formatRange(params.minPct, params.maxPct);
  const share = `share of ${clientName ? `${clientName}'s` : "your"} portfolio`;
  switch (selector.kind) {
    case "any_asset":
      return {
        title: `Any single holding ${range}`,
        subtitle: reading?.ticker ? `Heaviest now: ${reading.ticker}` : `Each holding's ${share}`,
      };
    case "asset":
      return {
        title: `${reading?.ticker ?? reading?.assetName ?? selector.assetId} ${range}`,
        subtitle: `Its ${share}`,
      };
    case "category":
      return {
        title: `${categoryLabel(selector.category)} ${range}`,
        subtitle: `The securities in this asset class, combined ${share}`,
      };
    case "group": {
      const count = selector.assetIds.length === 1 ? "1 security" : `${selector.assetIds.length} securities`;
      return {
        title: `${selector.label || count} ${range}`,
        subtitle: `${selector.label ? `${count}, combined` : "Combined"} ${share}`,
      };
    }
  }
}

/** "Now" and "limit" figures for the gauge, or null when the rule has no measurement to show. */
export function alertFigures(rule: AlertRuleResponse): { current: string; limit: string } | null {
  const reading = rule.reading;
  if (!rule.enabled || reading === null || reading.status !== "ok") return null;
  if (reading.currentValue === null || reading.thresholdValue === null) return null;

  // portfolio_change readings are signed (a fall is negative); weights are plain shares, against
  // the end of the range they're measured to.
  if (rule.params.type === "portfolio_change") {
    return { current: formatAlertPct(reading.currentValue, true), limit: formatAlertPct(reading.thresholdValue, true) };
  }
  const limit = formatAlertPct(reading.thresholdValue);
  return {
    current: formatAlertPct(reading.currentValue),
    limit: reading.bound === "min" ? `min ${limit}` : reading.bound === "max" ? `max ${limit}` : limit,
  };
}

/** What a weight selector picks, in words: "Bonds", "VWCE", "Core", "any single holding". */
export function selectorLabel(selector: WeightSelector, assetLabel?: string): string {
  switch (selector.kind) {
    case "any_asset": return "any single holding";
    case "asset": return assetLabel ?? "the selected security";
    case "category": return categoryLabel(selector.category);
    case "group":
      return selector.label || `${selector.assetIds.length === 1 ? "1 security" : `${selector.assetIds.length} securities`} together`;
  }
}

/**
 * One sentence saying what a set of params means, for the form's preview. `clientName` words it
 * for an advisor's rule on that client's portfolio; `portfolioName` names the investor's own
 * portfolio when they have several.
 */
export function describeParams(params: AlertParams, assetLabel?: string, clientName?: string, portfolioName?: string): string {
  const portfolio = clientName ? `${clientName}'s portfolio` : portfolioName ?? "my portfolio";
  if (params.type === "portfolio_change") {
    const verb = params.direction === "down" ? "falls" : "rises";
    return `Notify me when the result of ${portfolio} ${verb} by ${formatAlertPct(params.thresholdPct)} or more over ${WINDOW_LABEL[params.window]}.`;
  }
  const subject = selectorLabel(params.selector, assetLabel);
  const { minPct, maxPct } = params;
  const where = minPct != null && maxPct != null
    ? `below ${formatAlertPct(minPct)} or above ${formatAlertPct(maxPct)}`
    : minPct != null ? `below ${formatAlertPct(minPct)}` : `above ${formatAlertPct(maxPct ?? 0)}`;
  return `Notify me when ${subject} is ${where} of ${portfolio}.`;
}

/**
 * How pressing a rule is, for ordering a list with the most urgent first: triggered or at the
 * threshold, then approaching, then within range (each by how close it is), then the rules with
 * nothing to show (waiting, not measurable, off).
 */
export function alertUrgency(rule: AlertRuleResponse): number {
  const state = alertState(rule);
  const progress = state.progressPct ?? 0;
  switch (state.kind) {
    case "triggered": return 400 + progress;
    case "reached": return 300 + progress;
    case "approaching": return 200 + progress;
    case "ok": return 100 + progress;
    case "pending": return 2;
    case "unavailable": return 1;
    default: return 0;
  }
}

/** Whether two sets of params describe the same condition, so an edit can skip resending them. */
export function sameParams(a: AlertParams, b: AlertParams): boolean {
  if (a.type === "portfolio_change" && b.type === "portfolio_change") {
    return a.direction === b.direction && a.window === b.window && a.thresholdPct === b.thresholdPct;
  }
  if (a.type === "weight" && b.type === "weight") {
    return a.minPct === b.minPct && a.maxPct === b.maxPct && sameSelector(a.selector, b.selector);
  }
  return false;
}

function sameSelector(a: WeightSelector, b: WeightSelector): boolean {
  if (a.kind === "asset" && b.kind === "asset") return a.assetId === b.assetId;
  if (a.kind === "category" && b.kind === "category") return a.category === b.category;
  if (a.kind === "group" && b.kind === "group") {
    return (a.label ?? null) === (b.label ?? null)
      && a.assetIds.length === b.assetIds.length
      && a.assetIds.every((id) => b.assetIds.includes(id));
  }
  return a.kind === "any_asset" && b.kind === "any_asset";
}
