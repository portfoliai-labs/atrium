// components/dashboard/PortfoliosCompare.tsx
"use client";

import { useMemo, useState } from "react";
import { usePortfolio } from "../../context/PortfolioContext";
import { ComparisonView, MAX_COMPARED, type CompareStrategy } from "./ComparisonView";
import type { Crumb } from "./Breadcrumb";

/**
 * PORTFOLIOS COMPARE — Wealth's Compare, from All portfolios: the user's portfolios side by side
 * (ComparisonView), and their real estate where it's theirs to see. Beside them the strategies
 * that aren't theirs, as it opened with them (`compareWith`: one opened from its page in Explore,
 * or one their advisor shared). It starts on the first two portfolios, as many as those leave room for.
 */
export function PortfoliosCompare({ trail, compareWith, onOpen, onOpenRealEstate }: {
  trail: Crumb[];
  compareWith?: CompareStrategy[];
  onOpen: (uuid: string) => void;
  onOpenRealEstate?: () => void;
}) {
  const { portfolios } = usePortfolio();
  const real = useMemo(() => portfolios.filter((p) => !p.isVirtual && !p.isAggregate), [portfolios]);
  const [compared, setCompared] = useState<CompareStrategy[]>(compareWith ?? []);
  const [selection, setSelection] = useState<string[]>(() =>
    real.slice(0, Math.min(2, Math.max(0, MAX_COMPARED - compared.length))).map((p) => p.uuid));

  return (
    <ComparisonView
      candidates={real}
      selection={selection}
      onToggle={(uuid) => setSelection((prev) => {
        if (prev.includes(uuid)) return prev.filter((u) => u !== uuid);
        // The strategies take their columns first.
        return prev.length >= MAX_COMPARED - compared.length ? prev : [...prev, uuid];
      })}
      trail={trail}
      onOpen={onOpen}
      onOpenRealEstate={onOpenRealEstate}
      strategies={compared}
      onRemoveStrategy={(uuid) => setCompared((prev) => prev.filter((s) => s.uuid !== uuid))}
    />
  );
}
