// services/tradingService.ts
import type {
  AddressProof,
  BrokerAccount,
  BrokerSession,
  ChainHolding,
  EligibilityNotice,
  OnchainAddress,
  Order,
  OrderDetails,
  OrderExecution,
  OrderQuote,
  OrderSide,
  PlaceOrderInput,
  TradingAccount,
} from "../models/Trading";
import { apiFetch } from "./apiClient";

// Errors come back as ApiError with the backend's `error_type`: InvalidFieldError (422, an unknown
// chain or not an address), AddressProofExpiredError (409, the message is older than 5 minutes or
// was used: ask for a new one), AddressSignatureInvalidError (422, another wallet signed),
// AddressAlreadyRegisteredError (409), AddressLimitReachedError (409, 20 addresses),
// AddressNotFoundError (404), TradingAccountNotFoundError (404), ChainHoldingNotFoundError (404),
// InvalidChainHoldingLinkError (422, a wallet of another currency or a day out of range),
// WalletAlreadyLinkedError (409, the wallet takes a bank account's or another stablecoin's
// movements), WalletArchivedError (409). A broker's: BrokerUnavailableError (503, the deployment's
// session with it isn't connected), BrokerAccountLinkedElsewhereError (409, another user linked
// it), BrokerAccountNotFoundError (404).
export const tradingService = {
  // GET /v1/brokers/{b}/session — the deployment's session with the broker ("interactive_brokers").
  async brokerSession(broker: string): Promise<BrokerSession> {
    return apiFetch<BrokerSession>(`/v1/brokers/${broker}/session`);
  },

  // POST /v1/brokers/{b}/accounts — the accounts the deployment's broker login manages, linked to
  // the user and read: each makes a trading account (a portfolio, an account) moments later.
  async linkBroker(broker: string): Promise<BrokerAccount[]> {
    return apiFetch<BrokerAccount[]>(`/v1/brokers/${broker}/accounts`, { method: "POST" });
  },

  // GET /v1/brokers/accounts — oldest first.
  async brokerAccounts(): Promise<BrokerAccount[]> {
    return apiFetch<BrokerAccount[]>(`/v1/brokers/accounts`);
  },

  // POST /v1/brokers/accounts/{a}/read — the positions and currencies not seen before, then its
  // history not read yet, come in a moment later.
  async readBrokerAccount(accountUuid: string): Promise<{ balancesSeen: number; movementsSeen: number }> {
    return apiFetch<{ balancesSeen: number; movementsSeen: number }>(`/v1/brokers/accounts/${accountUuid}/read`, { method: "POST" });
  },

  // DELETE /v1/brokers/accounts/{a} — nothing is read from it any more; its portfolio and wallets stay.
  async removeBrokerAccount(accountUuid: string): Promise<void> {
    await apiFetch(`/v1/brokers/accounts/${accountUuid}`, { method: "DELETE" });
  },

  // POST /v1/addresses/proofs — the message the address' wallet signs, valid for 5 minutes.
  async startProof(chain: string, address: string): Promise<AddressProof> {
    return apiFetch<AddressProof>(`/v1/addresses/proofs`, { method: "POST", body: JSON.stringify({ chain, address }) });
  },

  // POST /v1/addresses — the proof's address, with the wallet's signature of its message (base64).
  async register(nonce: string, signature: string): Promise<OnchainAddress> {
    return apiFetch<OnchainAddress>(`/v1/addresses`, { method: "POST", body: JSON.stringify({ nonce, signature }) });
  },

  // GET /v1/addresses — oldest first.
  async addresses(): Promise<OnchainAddress[]> {
    return apiFetch<OnchainAddress[]>(`/v1/addresses`);
  },

  // POST /v1/addresses/{a}/read — its stablecoins read now; their movements come into its wallets
  // moments later. 503 while the Solana node fails.
  async read(addressUuid: string): Promise<{ movements: number }> {
    return apiFetch<{ movements: number }>(`/v1/addresses/${addressUuid}/read`, { method: "POST" });
  },

  // DELETE /v1/addresses/{a} — nothing is read from it any more; its portfolio and wallets stay.
  async remove(addressUuid: string): Promise<void> {
    await apiFetch(`/v1/addresses/${addressUuid}`, { method: "DELETE" });
  },

  // GET /v1/trading-accounts — oldest first.
  async tradingAccounts(): Promise<TradingAccount[]> {
    return apiFetch<TradingAccount[]>(`/v1/trading-accounts`);
  },

  // GET /v1/chain-holdings — the addresses' stablecoins, in the order their reads told them.
  async holdings(): Promise<ChainHolding[]> {
    return apiFetch<ChainHolding[]>(`/v1/chain-holdings`);
  },

  // PUT /v1/chain-holdings/{h}/wallet — into one of the user's wallets of its currency, or a new
  // one (null); the movements already read come in at once.
  async linkHolding(holdingUuid: string, walletUuid: string | null): Promise<ChainHolding> {
    return apiFetch<ChainHolding>(`/v1/chain-holdings/${holdingUuid}/wallet`, {
      method: "PUT", body: JSON.stringify(walletUuid ? { walletUuid } : {}),
    });
  },

  // DELETE /v1/chain-holdings/{h}/wallet — the movements it brought stay.
  async unlinkHolding(holdingUuid: string): Promise<ChainHolding> {
    return apiFetch<ChainHolding>(`/v1/chain-holdings/${holdingUuid}/wallet`, { method: "DELETE" });
  },

  // GET /v1/orders/quote — the venue's quote for an order not placed yet: a buy by the cash to
  // spend, a sale by the units to give. 409 NoRouteError, NoVenueError (devnet has none).
  async quote(input: { tradingAccountUuid: string; listingId: string; side: OrderSide; quantity?: number; cashAmount?: number; cashCurrency: string }): Promise<OrderQuote> {
    const params = new URLSearchParams({
      tradingAccountUuid: input.tradingAccountUuid, listingId: input.listingId, side: input.side, cashCurrency: input.cashCurrency,
    });
    if (input.quantity !== undefined) params.set("quantity", String(input.quantity));
    if (input.cashAmount !== undefined) params.set("cashAmount", String(input.cashAmount));
    return apiFetch<OrderQuote>(`/v1/orders/quote?${params.toString()}`);
  },

  // GET /v1/orders/eligibility — the notice before the first order, and when the user accepted it.
  async eligibility(): Promise<EligibilityNotice> {
    return apiFetch<EligibilityNotice>(`/v1/orders/eligibility`);
  },

  // POST /v1/orders/eligibility — 409 EligibilityNoticeOutdatedError for a version not current.
  async acceptEligibility(version: string): Promise<EligibilityNotice> {
    return apiFetch<EligibilityNotice>(`/v1/orders/eligibility`, { method: "POST", body: JSON.stringify({ version }) });
  },

  // POST /v1/orders — once per idempotency key. 409 EligibilityNoticeNotAcceptedError.
  async placeOrder(input: PlaceOrderInput): Promise<Order> {
    return apiFetch<Order>(`/v1/orders`, { method: "POST", body: JSON.stringify(input) });
  },

  // GET /v1/orders — newest first; of one trading account when given.
  async orders(tradingAccountUuid?: string): Promise<Order[]> {
    const query = tradingAccountUuid ? `?tradingAccountUuid=${encodeURIComponent(tradingAccountUuid)}` : "";
    return apiFetch<Order[]>(`/v1/orders${query}`);
  },

  // GET /v1/orders/{o} — with the states it went through.
  async order(orderUuid: string): Promise<Order> {
    return apiFetch<Order>(`/v1/orders/${orderUuid}`);
  },

  // GET /v1/orders/{o}/details — the order, its execution, the chain's receipt and the trade against the market.
  async orderDetails(orderUuid: string): Promise<OrderDetails> {
    return apiFetch<OrderDetails>(`/v1/orders/${orderUuid}/details`);
  },

  // POST /v1/orders/{o}/cancel — an order not sent yet; 409 OrderNotCancellableError once sent.
  async cancelOrder(orderUuid: string): Promise<Order> {
    return apiFetch<Order>(`/v1/orders/${orderUuid}/cancel`, { method: "POST" });
  },

  // POST /v1/orders/{o}/transaction — the transaction to sign now (it holds for seconds), with its
  // quote. 404 ExecutionNotFoundError for moments after placing (the order is on its way to catena).
  async prepareTransaction(orderUuid: string): Promise<OrderExecution> {
    return apiFetch<OrderExecution>(`/v1/orders/${orderUuid}/transaction`, { method: "POST" });
  },

  // POST /v1/orders/{o}/signature — the signed transaction (base64): filled, failed, or submitted
  // while its outcome isn't known. 409 TransactionExpiredError (prepare it again),
  // 422 TransactionMismatchError.
  async submitTransaction(orderUuid: string, signedTransaction: string): Promise<OrderExecution> {
    return apiFetch<OrderExecution>(`/v1/orders/${orderUuid}/signature`, {
      method: "POST", body: JSON.stringify({ signedTransaction }),
    });
  },
};
