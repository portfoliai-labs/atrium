// models/Rebalancing.ts
// Matches RebalancingOrdersResponse (GET /v1/portfolios/{p}/adopted-strategy/rebalancing-orders
// ?contribution=&mode=): the orders that would take a standard portfolio back to the strategy
// adopted on it, at the portfolio's last tick's prices. Suggestions only: nothing is recorded. The
// caller's own adoption: the owner's, or an advisor's on a client's portfolio (a client can't ask
// it on the one their advisor shared). 404 AdoptionNotFoundError without one; 409
// VirtualPortfolioOperationError on a backtest or the aggregate; 422 for a negative contribution.
//
// A category target is spread over the held assets of that category (the user's correction, else
// the proposed one) by their value; with none held, its proxy ETF is suggested (isProxy). A cash
// target is the portfolio's cash. What rounding to whole units leaves stays in cash.

import type { StrategyTarget } from "./Strategy";
import type { TaxCategory } from "./Tax";

// "full" sells what's above its target (all of what no target covers), then buys what's below;
// "buy_only" buys with the cash and the contribution and sells nothing (no gain realized).
type RebalancingMode = "full" | "buy_only";

// A sale's tax estimate, in RebalancingOrders.taxes.currency.
interface SaleEstimate {
  proceeds: number;
  cost: number;
  gain: number;
  // null without a tax regime (no residence).
  taxCategory: TaxCategory | null;
  // false: its gain offsets no loss (Italy: an ETF's or a fund's); null without a regime.
  offsettable: boolean | null;
  // The share of the gain that's taxed (Italy: 0.4808 for government bonds, otherwise 1).
  taxableShare: number | null;
  // A withheld portfolio's: what its broker would withhold. Otherwise null.
  withheldTax: number | null;
}

interface RebalancingOrder {
  side: "sell" | "buy";
  assetId: string;
  ticker: string | null;
  listingId: string | null;
  isin: string | null;
  name: string;
  // The instrument's quote currency; price and amount are in the reference currency.
  assetCurrency: string;
  // A category's proxy ETF, suggested because nothing of it is held (no listingId).
  isProxy: boolean;
  // null: an asset no target covers (sold in full in "full").
  target: StrategyTarget | null;
  // Exact decimal: whole units; fractions for crypto and manual assets; a bond's nominal, in 1000s.
  quantity: string;
  price: number;
  amount: number;
  // Sales only; null on buys or without an estimate.
  sale: SaleEstimate | null;
}

// One per target with a weight, in the strategy's order.
interface RebalancingAllocation {
  target: StrategyTarget;
  currentPct: number;
  afterPct: number;
  // false: no price to buy it at, so its share stays in cash.
  priced: boolean;
}

interface RebalancingOrders {
  // The portfolio's reference currency.
  currency: string;
  // The prices' tick; null while the portfolio isn't computed yet.
  pricedAt: string | null;
  mode: RebalancingMode;
  // Sales first, then buys, each by amount, largest first.
  orders: RebalancingOrder[];
  allocations: RebalancingAllocation[];
  cashBefore: number;
  contribution: number;
  // cashBefore + contribution + sales − buys.
  cashAfter: number;
  // The held assets no target covers, after the orders (they stay in "buy_only").
  untargetedAfterPct: number;
  // null: no sale, or no estimate. `tax`: what the sales add to this year's tax, net of the year's
  // and the carried losses; below 0 when selling at a loss saves some; null without a regime.
  taxes: { currency: string; tax: number | null } | null;
}

export type { RebalancingMode, SaleEstimate, RebalancingOrder, RebalancingAllocation, RebalancingOrders };
