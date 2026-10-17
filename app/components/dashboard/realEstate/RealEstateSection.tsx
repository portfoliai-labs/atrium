// components/dashboard/realEstate/RealEstateSection.tsx
"use client";

import { useSectionView } from "../../../lib/dashboardHistory";
import { REAL_ESTATE_SECTION } from "../../../lib/dashboardNav";
import { RealEstateNode, type RealEstatePage } from "./RealEstateNode";

// The real estate: every property together, or one (`property`, its page or its transactions).
export type RealEstateView = { page: RealEstatePage; property?: string };

/** The page a history entry's view is on (one from Wealth's, `kind` and all, too). */
function realEstateViewOf(raw: unknown): RealEstateView {
  const v = (typeof raw === "object" && raw !== null ? raw : {}) as { page?: unknown; property?: unknown };
  const page = typeof v.page === "string" ? (v.page as RealEstatePage) : "home";
  return typeof v.property === "string" ? { page, property: v.property } : { page };
}

/**
 * REAL ESTATE SECTION — the investor's properties (a demo account's are sample data): the real
 * estate's own page and each property's (RealEstateNode), each a browser history entry (see
 * lib/dashboardHistory). A page it doesn't know, or a property that's gone, opens its own page.
 */
export function RealEstateSection() {
  const [view, open] = useSectionView(REAL_ESTATE_SECTION, realEstateViewOf);
  return (
    <RealEstateNode
      page={view.page}
      property={view.property}
      rootTrail={[]}
      onOpen={(page, property) => open(property ? { page, property } : { page })}
    />
  );
}
