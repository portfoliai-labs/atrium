// components/dashboard/realEstate/RealEstateSection.tsx
"use client";

import { useSectionView } from "../../../lib/dashboardHistory";
import { REAL_ESTATE_SECTION } from "../../../lib/dashboardNav";
import { RealEstateNode, type RealEstatePage } from "./RealEstateNode";

// The real estate: every property together, or one (`property`, its page or its transactions); on
// its Taxes, the year (`year`).
export type RealEstateView = { page: RealEstatePage; property?: string; year?: number };

/** The page a history entry's view is on (one from Wealth's, `kind` and all, too). */
function realEstateViewOf(raw: unknown): RealEstateView {
  const v = (typeof raw === "object" && raw !== null ? raw : {}) as { page?: unknown; property?: unknown; year?: unknown };
  const page = typeof v.page === "string" ? (v.page as RealEstatePage) : "home";
  // Taxes without a year: this one's.
  if (page === "taxes") return { page, year: typeof v.year === "number" ? v.year : new Date().getFullYear() };
  return typeof v.property === "string" ? { page, property: v.property } : { page };
}

/**
 * REAL ESTATE SECTION — the investor's properties: the real estate's own page and each property's
 * (RealEstateNode), each a browser history entry (see lib/dashboardHistory). A page it doesn't know, or a property that's gone, opens its own page.
 */
export function RealEstateSection() {
  const [view, open] = useSectionView(REAL_ESTATE_SECTION, realEstateViewOf);
  return (
    <RealEstateNode
      page={view.page}
      property={view.property}
      year={view.year}
      rootTrail={[]}
      onOpen={(page, property, year) => open(property ? { page, property } : year !== undefined ? { page, year } : { page })}
    />
  );
}
