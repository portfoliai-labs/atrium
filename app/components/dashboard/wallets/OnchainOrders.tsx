// components/dashboard/wallets/OnchainOrders.tsx
"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useWalletQuery, useWallets } from "../../../context/WalletsContext";
import { formatCurrency, formatQuantity } from "../../../lib/format";
import { transactionUrl } from "../../../lib/solanaWallets";
import { dayLabel, errorText } from "../../../lib/wallets";
import type { Order, TradingAccount } from "../../../models/Trading";
import { tradingService } from "../../../services/tradingService";
import { orderStateLabel } from "../OrderPage";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";

// Each state's chip colours.
const CHIPS: Record<Order["state"], string> = {
  requested: "bg-slate-100 text-slate-600",
  awaiting_signature: "bg-amber-50 text-amber-700",
  submitted: "bg-sky-50 text-sky-700",
  partially_filled: "bg-sky-50 text-sky-700",
  filled: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-600",
  failed: "bg-rose-50 text-rose-600",
  expired: "bg-slate-100 text-slate-500",
  cancelled: "bg-slate-100 text-slate-500",
};
// What the user may still cancel: nothing was sent.
const CANCELLABLE: Order["state"][] = ["requested", "awaiting_signature"];

/** What an order asked, and what it got once filled: "Buy · 25.00 USD → 0.0745 units at 335.23 USD". */
function orderLine(order: Order) {
  const asked = order.side === "buy"
    ? `Buy · ${formatCurrency(order.cashAmount ?? 0, order.cashCurrency, 2)}`
    : `Sell · ${formatQuantity(String(order.quantity ?? 0))} units`;
  if (order.state !== "filled" || order.filledQuantity === null || order.averagePrice === null) return asked;
  return `${asked} → ${formatQuantity(order.filledQuantity.toFixed(8))} units at ${formatCurrency(order.averagePrice, order.cashCurrency, 2)}`;
}

/**
 * ON-CHAIN ORDERS — the orders placed on the user's addresses (bought and sold from an asset's
 * Tokenized versions), newest first, each with its state and its transaction once sent; one not
 * sent yet may be cancelled.
 */
export function OnchainOrders({ accounts, onOpen }: { accounts: TradingAccount[]; onOpen: (orderUuid: string) => void }) {
  const { changed } = useWallets();
  const read = useWalletQuery(["orders"], () => tradingService.orders());
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const orders = read.data ?? [];
  const accountName = (uuid: string) => accounts.find((a) => a.uuid === uuid)?.name ?? "";

  const cancel = async (order: Order) => {
    setCancelling(order.uuid);
    setError(null);
    try {
      await tradingService.cancelOrder(order.uuid);
      changed();
      void read.refetch();
    } catch (err) {
      setError(errorText(err, "Unable to cancel this order."));
    } finally {
      setCancelling(null);
    }
  };

  if (!read.isError && orders.length === 0) return null;
  return (
    <Module>
      <ModuleHead title="Orders" desc="Bought and sold on your addresses, newest first." />
      <div className={MODULE_BODY}>
        {read.isError ? (
          <p className="text-xs font-medium text-rose-600">Unable to load the orders right now.</p>
        ) : (
          <ul className="divide-y divide-[#EEE9DD]">
            {orders.map((order) => (
              <li key={order.uuid} className="flex flex-wrap items-center gap-3 py-3">
                <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wide ${CHIPS[order.state]}`}>
                  {orderStateLabel(order.state)}
                </span>
                <button type="button" onClick={() => onOpen(order.uuid)} className="min-w-0 flex-1 text-left group">
                  <span className="block text-[13px] font-bold text-slate-800 group-hover:underline">{orderLine(order)}</span>
                  <span className="block text-[11.5px] text-slate-500">
                    {[accountName(order.tradingAccountUuid), dayLabel(order.createdAt.slice(0, 10)), order.reason].filter(Boolean).join(" · ")}
                  </span>
                </button>
                {order.transaction && (
                  <a
                    href={transactionUrl(order.transaction)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View the transaction"
                    className="text-[#8A6A28] hover:text-[#C49A3C]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {CANCELLABLE.includes(order.state) && (
                  <button
                    type="button"
                    onClick={() => void cancel(order)}
                    disabled={cancelling === order.uuid}
                    className="px-3 py-1.5 rounded-lg text-[11.5px] font-bold border border-slate-200 text-slate-700 hover:border-rose-300 disabled:opacity-50 transition-colors"
                  >
                    {cancelling === order.uuid ? "Cancelling…" : "Cancel"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}
      </div>
    </Module>
  );
}
