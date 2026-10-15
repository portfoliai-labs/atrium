// models/ManualAsset.ts
// Matches ManualAssetResponse (GET/POST /v1/manual-assets, PATCH/DELETE /v1/manual-assets/{uuid};
// an advisor's client's under /v1/advisor/clients/{c}/manual-assets): an investment with no market
// price — an unlisted share, private equity, a loan, physical gold — valued by hand. Its
// transactions name it by `assetId` ("manual:<uuid>") alone, in its currency. Prices go out as
// numbers and come in as a number or a decimal string.

import type { StrategyCategory } from "./Strategy";

// A day's value: per unit, or the whole holding's when it was bought as 1 unit. It holds until the
// next one; before the first, the purchase price does.
interface ManualValuation {
  valuedOn: string;
  price: number;
}

interface ManualAsset {
  uuid: string;
  assetId: string;
  ownerUuid: string;
  name: string;
  // Fixed once created.
  currency: string;
  // The strategies' categories, or null.
  category: StrategyCategory | null;
  // An advisor's, when they created it for the client.
  createdByUuid: string;
  createdAt: string;
  updatedAt: string;
  latestValuation: ManualValuation | null;
}

// POST: name 1–120 chars.
interface ManualAssetCreate {
  name: string;
  currency: string;
  category?: StrategyCategory | null;
}

// PATCH: `category: null` removes it. Portfolios see the change from their next tick.
interface ManualAssetUpdate {
  name?: string;
  category?: StrategyCategory | null;
}

const MANUAL_ASSET_NAME_MAX = 120;
// At most this many valuations per PUT.
const MANUAL_VALUATIONS_MAX = 1000;
// DELETE's 409 error_type: a transaction is on it.
const MANUAL_ASSET_IN_USE = "ManualAssetInUseError";

export type { ManualValuation, ManualAsset, ManualAssetCreate, ManualAssetUpdate };
export { MANUAL_ASSET_NAME_MAX, MANUAL_VALUATIONS_MAX, MANUAL_ASSET_IN_USE };
