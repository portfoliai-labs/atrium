// components/dashboard/wallets/OrderDetails.tsx
"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { formatCurrency, formatQuantity } from "../../../lib/format";
import { transactionUrl } from "../../../lib/solanaWallets";
import type { BalanceChange, OrderDetails as Details } from "../../../models/Trading";
import { tradingService } from "../../../services/tradingService";
import { orderStateLabel } from "../OrderPage";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";

// A fill's receipt is read from the chain moments after it: asked again this many times, this far apart.
const RECEIPT_TRIES = 8;
const RECEIPT_EVERY_MS = 3000;

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const shortKey = (key: string) => (key.length > 12 ? `${key.slice(0, 4)}…${key.slice(-4)}` : key);
const signed = (change: BalanceChange) =>
  `${change.amount > 0 ? "+" : ""}${formatQuantity(change.amount.toFixed(9).replace(/\.?0+$/, ""))} ${change.symbol ?? shortKey(change.mint ?? "")}`;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[12px] text-slate-500">{label}</dt>
      <dd className="text-right text-[12.5px] font-bold text-slate-800 tabular-nums">{children}</dd>
    </div>
  );
}

function Block({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Module>
      <ModuleHead title={title} desc={desc} />
      <dl className={`${MODULE_BODY} divide-y divide-[#EEE9DD]`}>{children}</dl>
    </Module>
  );
}

/**
 * AN ORDER'S DETAILS — everything about an order bought or sold on an address: what it asked and
 * got, what it cost (the venue's fee, the network's), the trade against its listing's price at the
 * minute of the fill, the transaction as the chain keeps it and on an explorer, and the states it
 * went through. A part a service can't give now is left out; a fill's receipt comes moments later.
 */
export function OrderDetails({ orderUuid }: { orderUuid: string }) {
  const [details, setDetails] = useState<Details | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const read = await tradingService.orderDetails(orderUuid);
        if (!alive) return;
        setDetails(read);
        setFailed(false);
        // Filled, its receipt not read yet (or sent, its outcome not known): asked again shortly.
        const waiting = (read.order.state === "filled" && !read.receipt) || read.order.state === "submitted";
        if (waiting && ++tries < RECEIPT_TRIES) timer = setTimeout(() => void load(), RECEIPT_EVERY_MS);
      } catch {
        if (alive) setFailed(true);
      }
    };
    void load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [orderUuid]);

  if (failed && !details) return <p className="text-xs font-medium text-rose-600">Unable to load this order right now.</p>;
  if (!details) return <p className="text-xs text-slate-500">Loading the order…</p>;

  const { order, execution, receipt, market } = details;
  const currency = order.cashCurrency;
  const buying = order.side === "buy";
  const signature = order.transaction ?? execution?.signature ?? null;
  const explorer = execution?.explorerUrl ?? (signature ? transactionUrl(signature) : null);
  const quote = execution?.quote ?? null;
  const tokenChange = receipt?.changes.find((c) => c.mint !== null && (buying ? c.amount > 0 : c.amount < 0)) ?? null;
  const cashChange = receipt?.changes.find((c) => c.mint !== null && c !== tokenChange) ?? null;
  const solChange = receipt?.changes.find((c) => c.mint === null) ?? null;
  const cash = cashChange ? Math.abs(cashChange.amount)
    : order.filledQuantity !== null && order.averagePrice !== null
      ? order.filledQuantity * order.averagePrice + (buying ? 1 : -1) * (order.fees ?? 0)
      : null;
  const premium = market && order.averagePrice !== null && market.referencePrice > 0
    ? (order.averagePrice / market.referencePrice - 1) * 100 * (buying ? 1 : -1)
    : null;

  return (
    <div className="space-y-6">
      <Block title={buying ? "Bought" : "Sold"} desc="What the order asked, and what it got once filled.">
        <Row label="State">{orderStateLabel(order.state)}{order.reason ? ` · ${order.reason}` : ""}</Row>
        {order.detail && <Row label="Why">{order.detail}</Row>}
        <Row label={buying ? "Units received" : "Units sold"}>
          {order.filledQuantity !== null
            ? `${formatQuantity(order.filledQuantity.toFixed(9).replace(/\.?0+$/, ""))}${tokenChange?.symbol ? ` ${tokenChange.symbol}` : ""}`
            : order.quantity !== null ? formatQuantity(String(order.quantity)) : "—"}
        </Row>
        <Row label={buying ? "Paid" : "Received"}>{cash !== null ? formatCurrency(cash, currency, 2) : order.cashAmount !== null ? formatCurrency(order.cashAmount, currency, 2) : "—"}</Row>
        {order.averagePrice !== null && <Row label="Price per unit, before fees">{formatCurrency(order.averagePrice, currency, 4)}</Row>}
        {order.fees !== null && (
          <Row label={`Venue's fee${quote ? ` (${(quote.feeBps / 100).toFixed(2)}%)` : ""}`}>{formatCurrency(order.fees, currency, 4)}</Row>
        )}
        <Row label="Venue">{order.venue ?? execution?.venue ?? "—"}{quote?.route && quote.route !== order.venue ? ` · ${quote.route}` : ""}</Row>
        <Row label="Placed">{dateTime(order.createdAt)}</Row>
      </Block>

      {market && (
        <Block title="Against the market" desc="The trade against its listing's price at the minute it was filled (the tracked listing's, for a token).">
          <Row label="Market price at the fill">{formatCurrency(market.referencePrice, market.currency, 4)}</Row>
          {premium !== null && <Row label={buying ? "Paid over it" : "Got under it"}>{`${premium >= 0 ? "" : "−"}${Math.abs(premium).toFixed(2)}%`}</Row>}
          {market.spreadCost !== null && <Row label="Spread cost">{formatCurrency(market.spreadCost, market.currency, 4)}</Row>}
        </Block>
      )}

      {quote && (
        <Block title="Quoted and filled" desc="The venue's quote when the transaction was prepared, and the least it guaranteed.">
          <Row label="Quoted">{`${formatQuantity(quote.quantity.toFixed(9).replace(/\.?0+$/, ""))} units for ${formatCurrency(quote.cashAmount, quote.cashCurrency, 2)}`}</Row>
          <Row label={buying ? "Least units guaranteed" : "Least cash guaranteed"}>
            {buying ? formatQuantity(quote.minimum.toFixed(9).replace(/\.?0+$/, "")) : formatCurrency(quote.minimum, quote.cashCurrency, 2)}
          </Row>
          <Row label="Slippage allowed">{`${(order.slippageBps / 100).toFixed(2)}%`}</Row>
          {quote.priceImpactPct !== null && <Row label="Price impact">{`${quote.priceImpactPct}%`}</Row>}
        </Block>
      )}

      {(receipt || signature) && (
        <Block title="On chain" desc="The transaction as the chain keeps it.">
          {receipt && <Row label="Network">{`Solana ${receipt.network}`}</Row>}
          {receipt && (
            <Row label="Network fee">
              {`${receipt.networkFee.toFixed(9).replace(/\.?0+$/, "")} SOL · paid by ${receipt.paidByAddress ? "you" : "the venue"}`}
            </Row>
          )}
          {receipt?.changes.filter((c) => c.mint !== null).map((change) => (
            <Row key={change.mint ?? ""} label={change.amount > 0 ? "Came in" : "Went out"}>{signed(change)}</Row>
          ))}
          {solChange && <Row label="SOL (fee and accounts' rent)">{signed(solChange)}</Row>}
          {receipt?.blockTime && <Row label="Confirmed">{dateTime(receipt.blockTime)}</Row>}
          {receipt && <Row label="Block (slot)">{receipt.slot.toLocaleString()}</Row>}
          {signature && <Row label="Transaction">{shortKey(signature)}</Row>}
          {!receipt && order.state === "filled" && <Row label="Receipt">Reading it from the chain…</Row>}
          {explorer && (
            <div className="pt-3">
              <a href={explorer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#8A6A28] hover:underline">
                View it on Solscan <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </Block>
      )}

      {order.events.length > 0 && (
        <Block title="Timeline" desc="The states the order went through.">
          {order.events.map((event, index) => (
            <Row key={`${event.state}-${index}`} label={orderStateLabel(event.state)}>
              {dateTime(event.occurredAt)}{event.reason ? ` · ${event.reason}` : ""}
            </Row>
          ))}
        </Block>
      )}
    </div>
  );
}
