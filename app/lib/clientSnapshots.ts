// lib/clientSnapshots.ts
//
// PORTFOLIOS SHARED WITH NETWORK ADVISORS — the words both sides read: an investor sharing some of
// their portfolios with a network advisor (AdvisorMatchSection, NetworkAdvisorSharePage), an advisor
// reading a network client's copy (ClientsSection). See models/ClientSnapshot.

import { ApiError } from "../services/apiClient";
import type { NetworkAdvisor, NetworkClient, SnapshotShare } from "../models/ClientSnapshot";
import { shortNpub } from "./journal";

/** A network advisor's name, as their profile tells it, else their short npub. */
export const networkAdvisorName = (advisor: Pick<NetworkAdvisor, "name" | "npub">) =>
  advisor.name?.trim() || shortNpub(advisor.npub);

/** A network client is only a key: their short npub. */
export const networkClientName = (client: Pick<NetworkClient, "npub">) => shortNpub(client.npub);

/** "24 Nov 2026". */
export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** "24 Nov 2026, 09:30". */
export const formatMoment = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** The share's state in a line: what the investor's list and the share page say of it. */
export function shareStateLine(share: SnapshotShare | null): string {
  if (!share) return "You share nothing with them";
  if (share.ending) return "Stopping: they're being told, and the shared file deleted";
  const count = `${share.portfolioUuids.length} ${share.portfolioUuids.length === 1 ? "portfolio" : "portfolios"}`;
  if (share.pending) return share.lastSentAt ? `Sharing ${count} · an update goes out within a day` : `Sharing ${count} · the first copy goes out soon`;
  return share.lastSentAt ? `Sharing ${count} · last sent ${formatMoment(share.lastSentAt)}` : `Sharing ${count}`;
}

// What each refusal means to the user (ianus 0.94's errors, by `error_type`).
const MESSAGES: Record<string, string> = {
  NotYourNetworkAdvisorError: "This advisor is no longer yours: the relation was ended.",
  PortfolioNotShareableError: "One of the portfolios can't be shared: only your own standard portfolios can (not All portfolios, nor a backtest).",
  SnapshotShareNotFoundError: "You don't share anything with this advisor any more.",
  ImportedPortfolioReadOnlyError: "This portfolio was shared by your client: it's read only.",
  InvalidAdvisorKeyError: "This advisor's key isn't valid.",
  NotFoundError: "This relation was already ended.",
};

/** A refusal as the user reads it, else `fallback`. */
export function snapshotErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  if (err.errorType === "InvalidFieldError" && err.metadata.field === "portfolioUuids") {
    return "Pick between 1 and 50 portfolios to share.";
  }
  return (err.errorType && MESSAGES[err.errorType]) || err.message || fallback;
}
