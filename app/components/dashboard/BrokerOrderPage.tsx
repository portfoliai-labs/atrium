// components/dashboard/BrokerOrderPage.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { useWallets } from "../../context/WalletsContext";
import { useTradingAccounts } from "../../hooks/useChainHoldings";
import { formatCurrency, formatQuantity } from "../../lib/format";
import { errorText } from "../../lib/wallets";
import type { Order, OrderQuote, OrderSide, TradingAccount } from "../../models/Trading";
import { ApiError } from "../../services/apiClient";
import { tradingService } from "../../services/tradingService";
import { Breadcrumb } from "./Breadcrumb";
import { orderStateLabel } from "./OrderPage";
import { MODULE_BODY, Module, ModuleHead } from "./PerformanceSection";
import { SessionChip, sessionHint, useBrokerAccounts, useBrokerSession } from "./wallets/WalletBrokers";

// The executor of broker accounts (negotiator): orders go to the user's broker through the
// deployment's own gateway.
const BROKER_EXECUTOR = "negotiator";
// How far the limit may be from the listing's price, against the order (basis points): the
// choices, and the one picked first (negotiator's default).
const SLIPPAGES_BPS = [25, 50, 100, 200];
const DEFAULT_SLIPPAGE_BPS = 50;
// A placed order reaches the broker through the bus moments later: it is read again this often,
// for this long, until it is over; after that it keeps working at the broker (a DAY order).
const POLL_MS = 2_000;
const POLL_FOR_MS = 60_000;
// The eligibility notice's version (mercatura's ELIGIBILITY_NOTICE_VERSION): accepted once for every
// order, on chain or at a broker.
const NOTICE_VERSION = "2026-11-04";
const NOTICE_POINTS = [
  "The order goes to your own account at your broker, under the login of this installation's gateway: it is yours, as if you placed it there.",
  "It is a limit order for today's session, of whole units: it fills at the limit or better, or not at all, and what isn't filled by the close lapses.",
  "The limit comes from the listing's last price this platform knows (it may be delayed): a market that moved further than the slippage leaves the order unfilled.",
  "The broker's commission and any taxes are charged by the broker, on its own terms.",
];

// Why an order was refused, by negotiator's code or the broker's.
const REASONS: Record<string, string> = {
  AMOUNT_UNSUPPORTED: "At a broker an order is of whole units.",
  CURRENCY_UNSUPPORTED: "The broker trades this listing in another currency.",
  CONTRACT_NOT_FOUND: "The broker has no contract for this listing (or more than one, never guessed).",
  REFERENCE_PRICE_UNAVAILABLE: "There's no recent price of this listing to set the limit from.",
  BROKER_UNAVAILABLE: "The session with the broker isn't connected now: try again in a few minutes.",
  SERVICE_UNAVAILABLE: "A service the order needs didn't answer: try again.",
  SLIPPAGE_UNSUPPORTED: "The slippage is out of range.",
  ACCOUNT_NOT_FOUND: "The broker account was removed.",
  BROKER_REJECTED: "The broker refused the order.",
  NOT_PLACED: "The order never reached the broker.",
};
const reasonText = (reason: string | null, detail: string | null) =>
  [reason ? REASONS[reason] ?? reason : null, detail].filter(Boolean).join(" ");
/** "ContractNotFoundError" → "CONTRACT_NOT_FOUND": ianus' error type back to negotiator's code. */
const toCode = (errorType: string) => errorType.replace(/Error$/, "").replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
const WORKING: Order["state"][] = ["requested", "submitted", "partially_filled"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const isError = (err: unknown, type: string) => err instanceof ApiError && err.errorType === type;

/** The user's broker accounts orders may be placed on. */
export function useBrokerOrderAccounts(): TradingAccount[] {
  const accounts = useTradingAccounts();
  return useMemo(() => (accounts.data ?? []).filter((a) => a.executor === BROKER_EXECUTOR), [accounts.data]);
}

type Step =
  | { kind: "form" }
  | { kind: "notice" }
  | { kind: "working"; label: string }
  | { kind: "done"; order: Order };

/**
 * BROKER ORDER PAGE — buying or selling the page's listing at the user's broker (forum's service
 * map, "Brokers: negotiator" › "The orders"): whole units, a limit from the listing's price and the
 * slippage picked, quoted first (the broker's expected commission, nothing sent), the eligibility
 * notice before the first order, then the order placed and followed until it is over (or left
 * working for the day, cancellable). A page of the asset's, under its breadcrumb.
 */
export function BrokerOrderPage({ listingId, ticker, assetName, side, currency, onBack }: {
  listingId: string;
  ticker: string;
  assetName: string;
  side: OrderSide;
  // The listing's currency: the contract's at the broker, what the order is paid or settled in.
  currency: string;
  onBack: () => void;
}) {
  const { changed } = useWallets();
  const accounts = useBrokerOrderAccounts();
  const [accountUuid, setAccountUuid] = useState("");
  const account = accounts.find((a) => a.uuid === accountUuid) ?? accounts[0] ?? null;
  const brokerAccounts = useBrokerAccounts(accounts.length > 0);
  const broker = (brokerAccounts.data ?? []).find((b) => b.uuid === account?.reference)?.broker ?? "";
  const session = useBrokerSession(broker, !!broker);
  const [units, setUnits] = useState("");
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
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

  const buying = side === "buy";
  const value = Number(units);
  const valid = Number.isInteger(value) && value > 0;
  const connected = session.data?.state === "connected";

  const refusal = (err: unknown, fallback: string) => {
    const code = err instanceof ApiError && err.errorType ? toCode(err.errorType) : null;
    return code && REASONS[code] ? REASONS[code] : errorText(err, fallback);
  };

  const getQuote = async () => {
    if (!account || !valid) return;
    setQuoting(true);
    setError(null);
    setQuote(null);
    try {
      setQuote(await tradingService.quote({
        tradingAccountUuid: account.uuid, listingId, side, quantity: value, cashCurrency: currency, slippageBps,
      }));
    } catch (err) {
      setError(refusal(err, "Unable to get a quote now."));
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
        tradingAccountUuid: account.uuid, listingId, side, quantity: value, cashCurrency: currency, slippageBps,
        idempotencyKey: keyRef.current,
      });
    } catch (err) {
      setStep({ kind: "form" });
      setError(errorText(err, "Unable to place the order now."));
      return;
    }
    keyRef.current = newKey();
    setStep({ kind: "working", label: "At the broker…" });
    const settled = await follow(order);
    if (!alive.current) return;
    setStep({ kind: "done", order: settled });
    changed();
  };

  const reread = async (order: Order) => {
    try { return await tradingService.order(order.uuid); } catch { return order; }
  };
  const follow = async (order: Order) => {
    const until = Date.now() + POLL_FOR_MS;
    let current = order;
    while (Date.now() < until && alive.current) {
      await sleep(POLL_MS);
      current = await reread(order);
      if (!WORKING.includes(current.state)) break;
    }
    return current;
  };

  const cancel = async (order: Order) => {
    setError(null);
    setStep({ kind: "working", label: "Asking the broker to cancel…" });
    try {
      await tradingService.cancelOrder(order.uuid);
    } catch (err) {
      setError(errorText(err, "Unable to cancel this order."));
    }
    const settled = await follow(order);
    if (!alive.current) return;
    setStep({ kind: "done", order: settled });
    changed();
  };

  const verb = buying ? "Buy" : "Sell";
  const title = `${verb} ${ticker}`;

  return (
    <div className="space-y-5">
      <Breadcrumb trail={[{ label: assetName, onClick: onBack }]} current={title} />
      <Module>
        <ModuleHead
          title={title}
          desc={`At your broker: a limit order for today's session, of whole units, ${buying ? "paid" : "settled"} in ${currency}.`}
          right={session.data ? <SessionChip state={session.data.state} /> : undefined}
        />
        <div className={`${MODULE_BODY} space-y-4`}>
          {accounts.length === 0 ? (
            <p className="text-[12.5px] text-slate-500">Connect a broker under Investments first: orders are placed on one of your broker accounts.</p>
          ) : step.kind === "notice" ? (
            <NoticePanel onAccept={() => void accept()} onCancel={() => setStep({ kind: "form" })} />
          ) : step.kind === "working" ? (
            <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
              <Loader2 className="h-4 w-4 animate-spin text-[#C49A3C]" /> {step.label}
            </p>
          ) : step.kind === "done" ? (
            <BrokerOrderResult
              order={step.order}
              onCancel={() => void cancel(step.order)}
              onAnother={() => { setStep({ kind: "form" }); setQuote(null); setUnits(""); }}
            />
          ) : (
            <>
              {session.data && !connected && (
                <p className="text-[12px] font-semibold text-amber-700">{sessionHint(session.data.state)}</p>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-[11.5px] font-bold text-slate-600">
                  Account
                  <select
                    value={account?.uuid ?? ""}
                    onChange={(e) => { setAccountUuid(e.target.value); setQuote(null); }}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-800"
                  >
                    {accounts.map((a) => <option key={a.uuid} value={a.uuid}>{a.name}</option>)}
                  </select>
                </label>
                <label className="block text-[11.5px] font-bold text-slate-600">
                  Units of {ticker} to {buying ? "buy" : "sell"}
                  <input
                    inputMode="numeric"
                    value={units}
                    onChange={(e) => { setUnits(e.target.value.replace(/[^0-9]/g, "")); setQuote(null); }}
                    placeholder="1"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-800"
                  />
                </label>
                <label className="block text-[11.5px] font-bold text-slate-600">
                  Slippage
                  <select
                    value={slippageBps}
                    onChange={(e) => { setSlippageBps(Number(e.target.value)); setQuote(null); }}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-800"
                  >
                    {SLIPPAGES_BPS.map((bps) => <option key={bps} value={bps}>{(bps / 100).toFixed(2)}%</option>)}
                  </select>
                </label>
              </div>
              {quote && <BrokerQuoteSummary quote={quote} ticker={ticker} />}
              <div className="flex flex-wrap items-center gap-2">
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
                  disabled={!quote || !connected}
                  title={connected ? undefined : "The session with the broker isn't connected"}
                  className="px-4 py-2 rounded-lg text-[12px] font-bold bg-[#1c1917] text-white hover:bg-black disabled:opacity-40 transition-colors"
                >
                  {verb}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                The limit is set again from the listing&apos;s price when you {buying ? "buy" : "sell"}; it fills at the limit or better during today&apos;s session, or lapses at the close.
              </p>
            </>
          )}
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        </div>
      </Module>
    </div>
  );
}

function BrokerQuoteSummary({ quote, ticker }: { quote: OrderQuote; ticker: string }) {
  const buying = quote.side === "buy";
  const feesCurrency = quote.feesCurrency ?? quote.cashCurrency;
  const fees = quote.minFees != null && quote.maxFees != null && quote.minFees !== quote.maxFees
    ? `${formatCurrency(quote.minFees, feesCurrency, 2)} – ${formatCurrency(quote.maxFees, feesCurrency, 2)}`
    : formatCurrency(quote.fees, feesCurrency, 2);
  const rows: [string, string][] = [
    [buying ? "You buy" : "You sell", `${formatQuantity(String(quote.quantity))} ${ticker}`],
    ...(quote.referencePrice != null ? [["Last price", formatCurrency(quote.referencePrice, quote.cashCurrency, 2)] as [string, string]] : []),
    [`Limit (${((quote.slippageBps ?? 0) / 100).toFixed(2)}% ${buying ? "above" : "below"})`, formatCurrency(quote.price, quote.cashCurrency, 2)],
    [buying ? "You pay at most" : "You get at least", formatCurrency(quote.cashAmount, quote.cashCurrency, 2)],
    ["Broker's commission", fees],
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
      {quote.referenceTime && (
        <p className="text-[11px] text-slate-400">Last price as of {new Date(quote.referenceTime).toLocaleString()}.</p>
      )}
      {quote.warning && (
        <p className="flex items-start gap-2 text-[12px] font-semibold text-amber-700">
          <TriangleAlert className="h-4 w-4 shrink-0 mt-px" /> {quote.warning}
        </p>
      )}
    </div>
  );
}

function NoticePanel({ onAccept, onCancel }: { onAccept: () => void; onCancel: () => void }) {
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

function BrokerOrderResult({ order, onCancel, onAnother }: { order: Order; onCancel: () => void; onAnother: () => void }) {
  const filled = order.state === "filled";
  const working = WORKING.includes(order.state);
  const part = order.filledQuantity !== null && order.averagePrice !== null
    ? `${formatQuantity(String(order.filledQuantity))} at ${formatCurrency(order.averagePrice, order.cashCurrency, 2)}${order.fees ? `, commission ${formatCurrency(order.fees, order.cashCurrency, 2)}` : ""}`
    : null;
  const why = reasonText(order.reason, order.detail);
  return (
    <div className="space-y-3">
      <p className={`text-[13.5px] font-bold ${filled ? "text-emerald-700" : working ? "text-slate-700" : "text-rose-600"}`}>
        {working ? `${orderStateLabel(order.state)}: still working at the broker for today's session.` : orderStateLabel(order.state)}
      </p>
      {part && <p className="text-[12.5px] text-slate-600">{part}. It shows in the broker&apos;s portfolio in a moment.</p>}
      {!filled && !working && why && <p className="text-[12.5px] text-slate-600">{why}</p>}
      <div className="flex gap-2">
        {working && (
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-[12px] font-bold border border-rose-200 text-rose-600 transition-colors">
            Cancel the order
          </button>
        )}
        <button type="button" onClick={onAnother} className="px-4 py-2 rounded-lg text-[12px] font-bold border border-slate-200 text-slate-700 transition-colors">
          Another order
        </button>
      </div>
    </div>
  );
}
