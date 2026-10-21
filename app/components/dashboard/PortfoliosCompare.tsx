// components/dashboard/PortfoliosCompare.tsx
"use client";

import { useMemo, useState } from "react";
import { usePortfolio } from "../../context/PortfolioContext";
import { ComparisonView, type CompareStrategy } from "./ComparisonView";
import type { Crumb } from "./Breadcrumb";

/**
 * PORTFOLIOS COMPARE — Wealth's Compare, from a portfolio's Compare module (CompareModule): every
 * one of the user's portfolios side by side (ComparisonView), nothing to pick. Beside them the
 * strategies that aren't theirs, as it opened with them (`compareWith`: one opened from its page
 * in the catalog, or one their advisor shared), each until taken out.
 */
export function PortfoliosCompare({ trail, compareWith, onOpen }: {
  trail: Crumb[];
  compareWith?: CompareStrategy[];
  onOpen: (uuid: string) => void;
}) {
  const { portfolios } = usePortfolio();
  const real = useMemo(() => portfolios.filter((p) => !p.isVirtual && !p.isAggregate), [portfolios]);
  const [compared, setCompared] = useState<CompareStrategy[]>(compareWith ?? []);

  return (
    <ComparisonView
      candidates={real}
      trail={trail}
      onOpen={onOpen}
      strategies={compared}
      onRemoveStrategy={(uuid) => setCompared((prev) => prev.filter((s) => s.uuid !== uuid))}
    />
  );
}
