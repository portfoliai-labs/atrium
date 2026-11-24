// app/hooks/useReadOnly.ts
"use client";

import { usePortfolio } from "../context/PortfolioContext";

/** The tooltip on a control an advisor can't use on a client's data. */
export const CLIENT_READ_ONLY_TITLE = "Your client changes their own data";
/** The same, on a copy a network client shared (an imported portfolio). */
export const IMPORTED_READ_ONLY_TITLE = "Shared by your client: read only";

/** Spread onto a PageAction (or a button's props) to disable it, saying why. */
export type ReadOnlyLock = { disabled?: boolean; title?: string };

/**
 * READ ONLY — whether the investments' pages may change the data they show. Not on an advisor's
 * client's (PortfolioContext's `client`): the advisor reads a client's portfolios, transactions,
 * manual assets and asset categories, and the client alone changes them (the backend refuses the
 * advisor's writes with ADVISOR_READ_ONLY). What the advisor does on a client that's their own —
 * adopting or sharing a strategy, rebalancing proposals, their alerts — isn't the client's data,
 * and doesn't ask this.
 *
 * `title` says why on a disabled control; `lock` is `{ disabled, title }` to spread, `{}` when open.
 * `clientUuid`: a client's data shown outside their PortfolioProvider (the client's details), read
 * only as well. An imported portfolio (a network client's copy) is read only whoever reads it.
 */
export function useReadOnly(clientUuid?: string | null): { readOnly: boolean; title: string | undefined; lock: ReadOnlyLock } {
  const { client, current } = usePortfolio();
  const title = client?.imported || current?.imported
    ? IMPORTED_READ_ONLY_TITLE
    : client || clientUuid ? CLIENT_READ_ONLY_TITLE : undefined;
  const readOnly = title !== undefined;
  return { readOnly, title, lock: readOnly ? { disabled: true, title } : {} };
}
