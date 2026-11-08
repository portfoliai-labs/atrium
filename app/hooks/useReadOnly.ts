// app/hooks/useReadOnly.ts
"use client";

import { usePortfolio } from "../context/PortfolioContext";
import { useUser } from "../context/UserContext";
import { DEMO_DISABLED_TITLE } from "../components/preview/DemoBanner";

/** The tooltip on a control an advisor can't use on a client's data. */
export const CLIENT_READ_ONLY_TITLE = "Your client changes their own data";

/** Spread onto a PageAction (or a button's props) to disable it, saying why. */
export type ReadOnlyLock = { disabled?: boolean; title?: string };

/**
 * READ ONLY — whether the investments' pages may change the data they show. Not on a demo account
 * (see lib/demo), nor on an advisor's client's (PortfolioContext's `client`): the advisor reads a
 * client's portfolios, transactions, manual assets and asset categories, and the client alone
 * changes them (the backend refuses the advisor's writes with ADVISOR_READ_ONLY). What the advisor
 * does on a client that's their own — adopting or sharing a strategy, rebalancing proposals, their
 * alerts — isn't the client's data, and doesn't ask this.
 *
 * `title` says why on a disabled control; `lock` is `{ disabled, title }` to spread, `{}` when open.
 * `clientUuid`: a client's data shown outside their PortfolioProvider (the client's details), read
 * only as well.
 */
export function useReadOnly(clientUuid?: string | null): { readOnly: boolean; title: string | undefined; lock: ReadOnlyLock } {
  const { isDemo } = useUser();
  const { client } = usePortfolio();
  const title = isDemo ? DEMO_DISABLED_TITLE : client || clientUuid ? CLIENT_READ_ONLY_TITLE : undefined;
  const readOnly = title !== undefined;
  return { readOnly, title, lock: readOnly ? { disabled: true, title } : {} };
}
