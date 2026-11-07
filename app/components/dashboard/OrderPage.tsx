// components/dashboard/OrderPage.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { useTradingAccounts } from "../../hooks/useChainHoldings";
import { useWallets } from "../../context/WalletsContext";
import { formatCurrency, formatQuantity } from "../../lib/format";
import { errorText } from "../../lib/wallets";
import { signTransaction, walletFor } from "../../lib/solanaWallets";
import type { Order, OrderExecution, OrderQuote, OrderSide, TradingAccount } from "../../models/Trading";
import { ApiError } from "../../services/apiClient";
import { tradingService } from "../../services/tradingService";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";
import { Breadcrumb } from "./Breadcrumb";
import { MODULE_BODY, Module, ModuleHead } from "./PerformanceSection";

// The executor of on-chain accounts: the only one orders are placed on from here, for now.
const ON_CHAIN_EXECUTOR = "catena";
// What a buy is paid in, and a sale settled in: the tracked US listing's currency (USDC).
const CASH_CURRENCY = "USD";
// The order reaches catena moments after it's placed (mercatura → catena, by event): its
// transaction is asked this many times, this far apart, before giving up.
const PREPARE_TRIES = 6;
const PREPARE_PAUSE_MS = 500;
// A placed order reaches catena through the bus moments later: the first ask waits this long.
const FIRST_PREPARE_WAIT_MS = 500;
// An order sent whose outcome isn't known yet is read again this often, for this long.
const POLL_MS = 2_000;
const POLL_FOR_MS = 60_000;
// A venue's price this far from the reference price is said (a warning, never a block).
const GAP_WARNING_PCT = 1;
// Venue's fees above this share of the order are explained (a warning, never a block): mostly a
// fixed part (the network's fee and the token account opened on a first buy, paid by the venue
// when the address holds no SOL), they weigh on a small order.
const FEE_WARNING_PCT = 1;
// The eligibility notice's version this text is (mercatura's ELIGIBILITY_NOTICE_VERSION).
const NOTICE_VERSION = "2026-11-04";
const NOTICE_POINTS = [
  "What you may buy is yours to check: Ondo's tokens are sold outside the United States only (Regulation S), and in the EEA some are for professional investors only.",
  "A token is another issuer's security tracking the asset, not the share itself, with that issuer's risk.",
  "A token bought on a decentralised exchange can't be redeemed at Ondo without Ondo's own checks (KYC): it is sold on an exchange.",
  "You sign every transaction in your own wallet; the platform never holds your keys or your money.",
];

// Why an order was refused or failed, by its executor's code.
const REASONS: Record<string, string> = {
  NO_VENUE: "There's no venue on this network: orders work on Solana's mainnet only (development runs on devnet).",
  NO_ROUTE: "The venue can't fill this now (no liquidity for this pair or amount, the market is closed, or the amount is under its minimum).",
  INSUFFICIENT_FUNDS: "The address doesn't hold enough for this order: send funds to it (Add funds) and try again.",
  VENUE_REFUSED: "The venue refused the order.",
  AMOUNT_UNSUPPORTED: "A buy is by the cash to spend, a sale by the units to give.",
  TOKEN_NOT_TRADABLE: "This token can't be traded here.",
  CURRENCY_UNSUPPORTED: "There's no stablecoin in this currency on this network.",
  ADDRESS_NOT_FOUND: "The address was removed.",
  TRANSACTION_UNEXPECTED: "The venue's transaction wasn't what catena allows to be signed: nothing was sent.",
  SLIPPAGE_ABOVE_LIMIT: "The venue's price could move more than the order allows.",
  TRANSACTION_FAILED: "The transaction failed.",
  NOT_LANDED: "The transaction never reached the chain.",
  UNCONFIRMED: "The venue never confirmed the transaction: check your wallet's history.",
};
const reasonText = (reason: string | null, detail: string | null) =>
  [reason ? REASONS[reason] ?? reason : null, detail].filter(Boolean).join(" ");

const STATE_LABELS: Record<Order["state"], string> = {
  requested: "Requested",
  awaiting_signature: "Awaiting signature",
  submitted: "Sent",
  filled: "Filled",
  rejected: "Rejected",
  failed: "Failed",
  expired: "Expired",
  cancelled: "Cancelled",
};
export const orderStateLabel = (state: Order["state"]) => STATE_LABELS[state];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const isError = (err: unknown, type: string) => err instanceof ApiError && err.errorType === type;

/** The token an order page trades: a tracker listing of the asset's (Ondo's AAPLon). */
export interface OrderTarget {
  listingId: string;
  ticker: string;
  issuer: string | null;
  side: OrderSide;
}

/** The user's accounts orders may be placed on from here: their on-chain addresses. */
export function useOrderAccounts(): TradingAccount[] {
  const accounts = useTradingAccounts();
  return useMemo(() => (accounts.data ?? []).filter((a) => a.executor === ON_CHAIN_EXECUTOR), [accounts.data]);
}

type Step =
  | { kind: "form" }
  | { kind: "notice" }
  | { kind: "working"; label: string }
  | { kind: "expired"; order: Order }
  | { kind: "done"; order: Order; execution: OrderExecution | null };

/**
 * ORDER PAGE — buying or selling a token of the asset's (a tracker) on one of the user's addresses:
 * the venue's quote beside the asset's reference price (the gap is said above 1%, never blocking),
 * the eligibility notice before the first order, then the order placed, its transaction signed in
 * the user's own wallet and sent by catena. A page of the asset's, under its breadcrumb.
 */
export function OrderPage({ target, assetName, referencePrice, referenceCurrency, onBack }: {
  target: OrderTarget;
  assetName: string;
  // The tracked listing's last price, in `referenceCurrency`: what the token's price is compared to.
  referencePrice: number | null;
  referenceCurrency: string | null;
  onBack: () => void;
}) {
  const { sample } = useWallets();
  const accounts = useOrderAccounts();
  const [accountUuid, setAccountUuid] = useState("");
  const account = accounts.find((a) => a.uuid === accountUuid) ?? accounts[0] ?? null;
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: "form" });
  // One key per order the user means: a retry after a failure in between places nothing new.
  const keyRef = useRef(newKey());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const buying = target.side === "buy";
  const value = Number(amount.replace(",", "."));
  const valid = Number.isFinite(value) && value > 0;
  const gapPct = quote && referencePrice && referenceCurrency === quote.cashCurrency
    ? ((quote.price - referencePrice) / referencePrice) * 100
    : null;

  const getQuote = async () => {
    if (!account || !valid) return;
    setQuoting(true);
    setError(null);
    setQuote(null);
    try {
      setQuote(await tradingService.quote({
        tradingAccountUuid: account.uuid, listingId: target.listingId, side: target.side, cashCurrency: CASH_CURRENCY,
        ...(buying ? { cashAmount: value } : { quantity: value }),
      }));
    } catch (err) {
      setError(err instanceof ApiError && err.errorType && REASONS[toCode(err.errorType)] ? REASONS[toCode(err.errorType)] : errorText(err, "Unable to get a quote now."));
    } finally {
      setQuoting(false);
    }
  };

  const confirm = async () => {
    setError(null);
    try {
      const notice = await tradingService.eligibility();
      if (!notice.acceptedAt) { setStep({ kind: "notice" }); return; }
    } catch (err) {
      setError(errorText(err, "Unable to place the order now."));
      return;
    }
    await place();
  };

  const accept = async () => {
    setError(null);
    try {
      await tradingService.acceptEligibility(NOTICE_VERSION);
    } catch (err) {
      setStep({ kind: "form" });
      setError(isError(err, "EligibilityNoticeOutdatedError")
        ? "The notice changed: reload the page to read it again."
        : errorText(err, "Unable to record your acceptance."));
      return;
    }
    await place();
  };

  const place = async () => {
    if (!account) return;
    setStep({ kind: "working", label: "Placing the order…" });
    let order: Order;
    try {
      order = await tradingService.placeOrder({
        tradingAccountUuid: account.uuid, listingId: target.listingId, side: target.side, cashCurrency: CASH_CURRENCY,
        idempotencyKey: keyRef.current, ...(buying ? { cashAmount: value } : { quantity: value }),
      });
    } catch (err) {
      setStep({ kind: "form" });
      setError(errorText(err, "Unable to place the order now."));
      return;
    }
    keyRef.current = newKey();
    await signAndSend(order, true);
  };

  /** Asks catena for the transaction (retrying while the order is on its way), signs it, sends it. */
  const signAndSend = async (order: Order, justPlaced = false) => {
    setStep({ kind: "working", label: "Preparing the transaction…" });
    if (justPlaced) await sleep(FIRST_PREPARE_WAIT_MS);
    let execution: OrderExecution | null = null;
    for (let i = 0; i < PREPARE_TRIES && alive.current; i++) {
      try {
        execution = await tradingService.prepareTransaction(order.uuid);
        break;
      } catch (err) {
        if (!isError(err, "ExecutionNotFoundError") || i === PREPARE_TRIES - 1) {
          setStep({ kind: "done", order: await reread(order), execution: null });
          setError(errorText(err, "Unable to prepare the transaction now."));
          return;
        }
        await sleep(PREPARE_PAUSE_MS);
      }
    }
    if (!execution || !alive.current) return;
    if (execution.state !== "awaiting_signature" || !execution.transaction) {
      setStep({ kind: "done", order: await reread(order), execution });
      return;
    }
    if (execution.quote) setQuote(execution.quote);
    setStep({ kind: "working", label: "Sign the transaction in your wallet…" });
    let signed: string;
    try {
      const address = account ? addressOf(account) : null;
      const found = address ? await walletFor(address) : null;
      if (!found) throw new Error("No wallet here holds this address: open the wallet that does, and try again.");
      signed = await signTransaction(found.wallet, found.account, execution.transaction);
    } catch (err) {
      setStep({ kind: "expired", order });
      setError(errorText(err, "The wallet didn't sign."));
      return;
    }
    setStep({ kind: "working", label: "Sending…" });
    try {
      execution = await tradingService.submitTransaction(order.uuid, signed);
    } catch (err) {
      if (isError(err, "TransactionExpiredError")) {
        setStep({ kind: "expired", order });
        setError("The quote expired before it was signed: get a new one.");
        return;
      }
      setStep({ kind: "done", order: await reread(order), execution: null });
      setError(errorText(err, "Unable to send the transaction."));
      return;
    }
    if (execution.state === "submitted") {
      setStep({ kind: "working", label: "Waiting for the chain…" });
      const settled = await follow(order);
      setStep({ kind: "done", order: settled, execution });
      return;
    }
    setStep({ kind: "done", order: await reread(order), execution });
  };

  // The trading account's address: catena's, by its reference. Read from the name's ends would be
  // a guess, so the addresses are asked.
  const addressesRef = useRef<Record<string, string>>({});
  const addressOf = (a: TradingAccount) => addressesRef.current[a.reference] ?? null;
  useEffect(() => {
    void tradingService.addresses().then((list) => {
      addressesRef.current = Object.fromEntries(list.map((x) => [x.uuid, x.address]));
    }).catch(() => undefined);
  }, []);

  const reread = async (order: Order) => {
    try { return await tradingService.order(order.uuid); } catch { return order; }
  };
  const follow = async (order: Order) => {
    const until = Date.now() + POLL_FOR_MS;
    let current = order;
    while (Date.now() < until && alive.current) {
      await sleep(POLL_MS);
      current = await reread(order);
      if (!["requested", "awaiting_signature", "submitted"].includes(current.state)) break;
    }
    return current;
  };

  const verb = buying ? "Buy" : "Sell";
  const title = `${verb} ${target.ticker}`;

  return (
    <div className="space-y-5">
      <Breadcrumb trail={[{ label: assetName, onClick: onBack }]} current={title} />
      <Module>
        <ModuleHead
          title={title}
          desc={`${target.issuer ? `Issued by ${target.issuer}. ` : ""}Signed in your own wallet; ${buying ? "paid in USDC from" : "settled in USDC to"} the address.`}
        />
        <div className={`${MODULE_BODY} space-y-4`}>
          {accounts.length === 0 ? (
            <p className="text-[12.5px] text-slate-500">Connect a Solana wallet under Liquidity › On-chain first: orders are placed on one of your addresses.</p>
          ) : step.kind === "notice" ? (
            <EligibilityNoticePanel onAccept={() => void accept()} onCancel={() => setStep({ kind: "form" })} />
          ) : step.kind === "working" ? (
            <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
              <Loader2 className="h-4 w-4 animate-spin text-[#C49A3C]" /> {step.label}
            </p>
          ) : step.kind === "done" ? (
            <OrderResult order={step.order} execution={step.execution} onAnother={() => { setStep({ kind: "form" }); setQuote(null); setAmount(""); }} />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[11.5px] font-bold text-slate-600">
                  Address
                  <select
                    value={account?.uuid ?? ""}
                    onChange={(e) => { setAccountUuid(e.target.value); setQuote(null); }}
                    disabled={step.kind === "expired"}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-800"
                  >
                    {accounts.map((a) => <option key={a.uuid} value={a.uuid}>{a.name}</option>)}
                  </select>
                </label>
                <label className="block text-[11.5px] font-bold text-slate-600">
                  {buying ? "Amount to spend (USD, paid in USDC)" : `Units of ${target.ticker} to sell`}
                  <input
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setQuote(null); }}
                    disabled={step.kind === "expired"}
                    placeholder={buying ? "25" : "0.1"}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-800"
                  />
                </label>
              </div>
              {quote && <QuoteSummary quote={quote} ticker={target.ticker} referencePrice={referencePrice} gapPct={gapPct} />}
              <div className="flex flex-wrap items-center gap-2">
                {step.kind === "expired" ? (
                  <button
                    type="button"
                    onClick={() => void signAndSend(step.order)}
                    className="px-4 py-2 rounded-lg text-[12px] font-bold bg-[#1c1917] text-white hover:bg-black transition-colors"
                  >
                    Get a new quote and sign
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void getQuote()}
                      disabled={!valid || quoting}
                      className="px-4 py-2 rounded-lg text-[12px] font-bold border border-slate-200 text-slate-700 hover:border-[#C49A3C]/60 disabled:opacity-50 transition-colors"
                    >
                      {quoting ? "Getting a quote…" : "Get quote"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirm()}
                      disabled={!quote || sample}
                      title={sample ? DEMO_DISABLED_TITLE : undefined}
                      className="px-4 py-2 rounded-lg text-[12px] font-bold bg-[#1c1917] text-white hover:bg-black disabled:opacity-40 transition-colors"
                    >
                      {verb}
                    </button>
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                The transaction is prepared when you {buying ? "buy" : "sell"}, at the venue&apos;s price then (it may differ from this quote within 1%), and your wallet shows it before you approve.
              </p>
            </>
          )}
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        </div>
      </Module>
    </div>
  );
}

/** "NoRouteError" → "NO_ROUTE": ianus' error type back to the executor's code. */
function toCode(errorType: string) {
  return errorType.replace(/Error$/, "").replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

function QuoteSummary({ quote, ticker, referencePrice, gapPct }: {
  quote: OrderQuote; ticker: string; referencePrice: number | null; gapPct: number | null;
}) {
  const buying = quote.side === "buy";
  const rows: [string, string][] = [
    [buying ? "You get about" : "You give", `${formatQuantity(quote.quantity.toFixed(8))} ${ticker}`],
    [buying ? "You pay" : "You get about", formatCurrency(quote.cashAmount, quote.cashCurrency, 2)],
    ["Price per unit", formatCurrency(quote.price, quote.cashCurrency, 2)],
    ...(referencePrice ? [["Reference price", formatCurrency(referencePrice, quote.cashCurrency, 2)] as [string, string]] : []),
    [`Venue's fees (${(quote.feeBps / 100).toFixed(2)}%)`, formatCurrency(quote.fees, quote.cashCurrency, 2)],
    ["At least", buying ? `${formatQuantity(quote.minimum.toFixed(8))} ${ticker}` : formatCurrency(quote.minimum, quote.cashCurrency, 2)],
    ["Venue", quote.venue === "jupiter" ? "Jupiter" : quote.venue],
  ];
  return (
    <div className="rounded-xl border border-[#EEE9DD] px-4 py-3 space-y-2">
      <dl>
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-1 text-[12.5px]">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-semibold text-slate-800 text-right">{value}</dd>
          </div>
        ))}
      </dl>
      {quote.feeBps / 100 > FEE_WARNING_PCT && (
        <p className="flex items-start gap-2 text-[12px] font-semibold text-amber-700">
          <TriangleAlert className="h-4 w-4 shrink-0 mt-px" />
          The venue&apos;s fees are {(quote.feeBps / 100).toFixed(2)}% of this order. They are mostly a fixed amount — the network&apos;s fee and, on a first buy of this token, opening its account on your address — so they weigh less on a larger order.
        </p>
      )}
      {gapPct !== null && Math.abs(gapPct) > GAP_WARNING_PCT && (
        <p className="flex items-start gap-2 text-[12px] font-semibold text-amber-700">
          <TriangleAlert className="h-4 w-4 shrink-0 mt-px" />
          The venue&apos;s price is {Math.abs(gapPct).toFixed(1)}% {gapPct > 0 ? "above" : "below"} the reference price: the token trades on its own market, which may drift from the asset&apos;s (outside market hours especially).
        </p>
      )}
    </div>
  );
}

function EligibilityNoticePanel({ onAccept, onCancel }: { onAccept: () => void; onCancel: () => void }) {
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-[13px] font-bold text-slate-800">
        <ShieldCheck className="h-4 w-4 text-[#C49A3C]" /> Before your first order
      </p>
      <ul className="list-disc pl-5 space-y-1.5 text-[12.5px] text-slate-600">
        {NOTICE_POINTS.map((point) => <li key={point}>{point}</li>)}
      </ul>
      <div className="flex gap-2">
        <button type="button" onClick={onAccept} className="px-4 py-2 rounded-lg text-[12px] font-bold bg-[#1c1917] text-white hover:bg-black transition-colors">
          I understand, continue
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-[12px] font-bold border border-slate-200 text-slate-700 transition-colors">
          Back
        </button>
      </div>
    </div>
  );
}

function OrderResult({ order, execution, onAnother }: { order: Order; execution: OrderExecution | null; onAnother: () => void }) {
  const signature = order.transaction ?? execution?.signature ?? null;
  const quantity = order.filledQuantity ?? execution?.filledQuantity ?? null;
  const price = order.averagePrice ?? execution?.averagePrice ?? null;
  const fees = order.fees ?? execution?.fees ?? null;
  const filled = order.state === "filled";
  const pending = ["requested", "awaiting_signature", "submitted"].includes(order.state);
  const why = reasonText(order.reason ?? execution?.reason ?? null, order.detail ?? execution?.detail ?? null);
  return (
    <div className="space-y-3">
      <p className={`text-[13.5px] font-bold ${filled ? "text-emerald-700" : pending ? "text-slate-700" : "text-rose-600"}`}>
        {filled ? "Filled" : pending ? "Sent: its outcome isn't known yet — it shows under Liquidity › On-chain once it is." : orderStateLabel(order.state)}
      </p>
      {filled && quantity !== null && price !== null && (
        <p className="text-[12.5px] text-slate-600">
          {formatQuantity(quantity.toFixed(8))} at {formatCurrency(price, order.cashCurrency, 2)}
          {fees ? `, fees ${formatCurrency(fees, order.cashCurrency, 2)}` : ""}. It shows in the address&apos; portfolio in a moment.
        </p>
      )}
      {!filled && why && <p className="text-[12.5px] text-slate-600">{why}</p>}
      {signature && (
        <a
          href={`https://solscan.io/tx/${signature}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#8A6A28] hover:underline"
        >
          View the transaction <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      <div>
        <button type="button" onClick={onAnother} className="px-4 py-2 rounded-lg text-[12px] font-bold border border-slate-200 text-slate-700 transition-colors">
          Another order
        </button>
      </div>
    </div>
  );
}
