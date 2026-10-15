// models/AssetCategory.ts
// Matches the items of GET/PUT/DELETE /v1/asset-categories (and the advisor's
// /v1/advisor/clients/{clientUuid}/asset-categories): the economic category of each security in
// the user's portfolios, what category alerts and adopting a strategy "in categories" weigh a
// portfolio by. mercurius proposes one; the user's correction wins over it, in all their
// portfolios.

import type { StrategyCategory } from "./Strategy";

interface AssetCategoryEntry {
  // The holdings' assetId: the ISIN when known, the ticker otherwise.
  assetId: string;
  // Null on an asset no longer held, known only by its correction.
  ticker: string | null;
  isin: string | null;
  name: string | null;
  held: boolean;
  proposed: StrategyCategory | null;
  corrected: StrategyCategory | null;
  // The one that counts: the correction if there is one, otherwise the proposal. Null without
  // either: the asset then falls in no category.
  category: StrategyCategory | null;
}

interface AssetCategoryCorrection {
  assetId: string;
  category: StrategyCategory;
}

export type { AssetCategoryEntry, AssetCategoryCorrection };
