// SAMPLE DATA for a demo account's Alerts (a portfolio's Alerts tab, see AlertsSettings): a
// demo account is read only, so it can't create rules of its own, and this shows what the page
// looks like with some, grouped by portfolio. Made-up rules in every state (triggered,
// approaching, within range, off), put on up to two of its portfolios that have none. Never sent
// anywhere; their ids start with SAMPLE_RULE_PREFIX.

import type { PortfolioAlertRule } from "../../hooks/useAlertRules";
import type { AlertParams, AlertRuleReading } from "../../models/Alert";

export const SAMPLE_RULE_PREFIX = "sample-";

export const isSampleRule = (rule: { ruleId: string }) => rule.ruleId.startsWith(SAMPLE_RULE_PREFIX);

const NOW = "2026-09-29T08:00:00Z";

const reading = (r: Partial<AlertRuleReading>): AlertRuleReading => ({
  status: "ok",
  evaluatedAt: NOW,
  unavailableReason: null,
  breached: false,
  currentValue: null,
  thresholdValue: null,
  progressPct: null,
  assetId: null,
  assetName: null,
  ticker: null,
  bound: null,
  pnlChange: null,
  currency: "EUR",
  referenceDate: null,
  ...r,
});

type Sample = {
  params: AlertParams;
  reading: AlertRuleReading;
  enabled?: boolean;
  isTriggered?: boolean;
  lastTriggeredAt?: string;
  notifyEmail?: boolean;
};

// The first portfolio's rules, then the second's.
const SAMPLES: Sample[][] = [
  [
    {
      params: { type: "portfolio_change", direction: "down", thresholdPct: 5, window: "week" },
      reading: reading({ breached: true, currentValue: -5.8, thresholdValue: -5, progressPct: 100, pnlChange: -2140, referenceDate: "2026-09-22" }),
      isTriggered: true,
      lastTriggeredAt: "2026-09-28T14:10:00Z",
    },
    {
      params: { type: "weight", selector: { kind: "any_asset" }, minPct: null, maxPct: 25 },
      reading: reading({ currentValue: 21.4, thresholdValue: 25, progressPct: 86, assetName: "iShares Core MSCI World", ticker: "SWDA", bound: "max" }),
    },
    {
      params: { type: "portfolio_change", direction: "up", thresholdPct: 10, window: "month" },
      reading: reading({ currentValue: 2.1, thresholdValue: 10, progressPct: 21, pnlChange: 780, referenceDate: "2026-08-30" }),
      notifyEmail: false,
    },
    {
      params: { type: "weight", selector: { kind: "category", category: "bonds" }, minPct: 20, maxPct: 40 },
      reading: reading({ currentValue: 23.5, thresholdValue: 20, progressPct: 45, bound: "min" }),
    },
  ],
  [
    {
      params: { type: "portfolio_change", direction: "down", thresholdPct: 3, window: "day" },
      reading: reading({ currentValue: -0.4, thresholdValue: -3, progressPct: 13, pnlChange: -95, referenceDate: "2026-09-28" }),
    },
    {
      params: { type: "weight", selector: { kind: "any_asset" }, minPct: null, maxPct: 40 },
      reading: reading({ currentValue: 31, thresholdValue: 40, progressPct: 78, assetName: "Apple Inc.", ticker: "AAPL", bound: "max" }),
      enabled: false,
    },
  ],
];

/** Sample rules for the first two of `portfolioUuids` (those with none of their own). */
export function sampleAlertRules(portfolioUuids: string[]): PortfolioAlertRule[] {
  return portfolioUuids.slice(0, SAMPLES.length).flatMap((portfolioUuid, i) =>
    SAMPLES[i].map((s, j) => ({
      ruleId: `${SAMPLE_RULE_PREFIX}${i}-${j}`,
      portfolioUuid,
      params: s.params,
      notifyEmail: s.notifyEmail ?? true,
      notifyInApp: true,
      enabled: s.enabled ?? true,
      isTriggered: s.isTriggered ?? false,
      lastTriggeredAt: s.lastTriggeredAt ?? null,
      reading: s.reading,
      source: null,
      createdAt: "2026-06-01T09:00:00Z",
      updatedAt: "2026-06-01T09:00:00Z",
    })),
  );
}
