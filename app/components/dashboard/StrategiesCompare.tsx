// components/dashboard/StrategiesCompare.tsx
"use client";

import { useState } from "react";
import { ComparisonView, type CompareStrategy } from "./ComparisonView";
import type { Crumb } from "./Breadcrumb";

/**
 * STRATEGIES COMPARE — Strategies' Compare: the strategies picked on its list (`strategies`: the
 * user's backtests, the catalog's) side by side (ComparisonView), none of the user's portfolios
 * (theirs is the investments' Compare). Each stays until taken out.
 */
export function StrategiesCompare({ trail, strategies, onOpenBacktest }: {
  trail: Crumb[];
  strategies: CompareStrategy[];
  onOpenBacktest: (uuid: string) => void;
}) {
  const [compared, setCompared] = useState<CompareStrategy[]>(strategies);

  return (
    <ComparisonView
      candidates={[]}
      trail={trail}
      onOpen={onOpenBacktest}
      strategies={compared}
      onRemoveStrategy={(uuid) => setCompared((prev) => prev.filter((s) => s.uuid !== uuid))}
      emptyText="A comparison needs two strategies at least: pick them on Strategies, with Compare."
    />
  );
}
