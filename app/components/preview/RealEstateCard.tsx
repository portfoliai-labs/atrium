// components/preview/RealEstateCard.tsx

import { formatCurrency } from "../../lib/format";
import { PROPERTIES, portfolioValueSeries, propertyValue } from "../../lib/mock/realEstate";
import type { HolderItem } from "../dashboard/PortfolioHolder";
import { PreviewBadge, formatPct } from "./PreviewKit";

// Its colour among the portfolios' cards: the orange of the real estate pages.
const REAL_ESTATE_COLOR = "#eb6834";

/**
 * REAL ESTATE CARD (preview) — the sample real estate portfolio as a card in the Investments hub's
 * card holder (PortfolioHolder), next to the user's portfolios: badged, since it isn't one of
 * theirs. Pulled out, it shows the gain on what the properties cost and how their value moved.
 */
export function realEstateHolderItem(onOpen: () => void): HolderItem {
  const value = PROPERTIES.reduce((s, p) => s + propertyValue(p), 0);
  const invested = PROPERTIES.reduce((s, p) => s + p.purchasePrice + p.purchaseCosts, 0);
  return {
    key: "real-estate",
    name: "Real estate",
    color: REAL_ESTATE_COLOR,
    badge: <PreviewBadge dark />,
    value: formatCurrency(value, "EUR", 0),
    // Sample data: never added to the user's own portfolios' total.
    headline: formatPct((value / invested - 1) * 100, 2),
    caption: "since purchase",
    points: portfolioValueSeries().map((row) => ({ value: row.value })),
    empty: "",
    onOpen,
  };
}
