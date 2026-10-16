// components/dashboard/StrategiesCompare.tsx
"use client";

import { useMemo, useState } from "react";
import { usePortfolio } from "../../context/PortfolioContext";
import { openPortfolioPage, openRealEstatePage } from "../../lib/dashboardNav";
import { isBacktest } from "../../models/Portfolio";
import { ComparisonView, MAX_COMPARED, type CompareStrategy } from "./ComparisonView";
import type { Crumb } from "./Breadcrumb";

/**
 * STRATEGIES COMPARE — Plan's Compare, under Strategy: strategies and portfolios side by side
 * (ComparisonView). The cards are the user's backtests, then their portfolios (and their real
 * estate, where it's theirs to see); beside them the strategies that aren't theirs, as it opened
 * with them (`compareWith`: one opened from its page in Explore, or one their advisor shared). It
 * starts on those strategies alone, with the user's portfolios too when asked
 * (`withPortfolios`), or, opened on its own, on the first two backtests (else portfolios).
 */
export function StrategiesCompare({ trail, compareWith, withPortfolios = false, onOpenBacktest, onNavigate }: {
  trail: Crumb[];
  compareWith?: CompareStrategy[];
  withPortfolios?: boolean;
  onOpenBacktest: (uuid: string) => void;
  onNavigate: (section: string) => void;
}) {
  const { portfolios } = usePortfolio();
  const backtests = useMemo(() => portfolios.filter(isBacktest), [portfolios]);
  const real = useMemo(() => portfolios.filter((p) => !p.isVirtual && !p.isAggregate), [portfolios]);
  const candidates = useMemo(() => [...backtests, ...real], [backtests, real]);
  const [compared, setCompared] = useState<CompareStrategy[]>(compareWith ?? []);
  const [selection, setSelection] = useState<string[]>(() => {
    const room = Math.max(0, MAX_COMPARED - (compareWith?.length ?? 0));
    if (withPortfolios) return real.slice(0, Math.min(2, room)).map((p) => p.uuid);
    if (compareWith?.length) return [];
    return (backtests.length > 0 ? backtests : real).slice(0, 2).map((p) => p.uuid);
  });

  return (
    <ComparisonView
      candidates={candidates}
      selection={selection}
      onToggle={(uuid) => setSelection((prev) => {
        if (prev.includes(uuid)) return prev.filter((u) => u !== uuid);
        // The strategies take their columns first.
        return prev.length >= MAX_COMPARED - compared.length ? prev : [...prev, uuid];
      })}
      trail={trail}
      onOpen={(uuid) => (backtests.some((p) => p.uuid === uuid) ? onOpenBacktest(uuid) : openPortfolioPage(onNavigate, uuid))}
      onOpenRealEstate={() => openRealEstatePage(onNavigate)}
      strategies={compared}
      onRemoveStrategy={(uuid) => setCompared((prev) => prev.filter((s) => s.uuid !== uuid))}
    />
  );
}

