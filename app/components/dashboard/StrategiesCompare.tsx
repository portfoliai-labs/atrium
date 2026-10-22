// components/dashboard/StrategiesCompare.tsx
"use client";

import { useState } from "react";
import { useInvestmentsQuery, usePortfolio } from "../../context/PortfolioContext";
import { publicationService } from "../../services/publicationService";
import { isBacktest } from "../../models/Portfolio";
import { ComparisonView, type CompareStrategy } from "./ComparisonView";
import type { Crumb } from "./Breadcrumb";

// The catalog's strategies the picker offers: its newest, as many as a page of it takes.
const CATALOG_LIMIT = 100;

/**
 * STRATEGIES COMPARE — Strategies' Compare: strategies side by side (ComparisonView), none of the
 * user's portfolios (theirs is the investments' Compare). Each is picked here ("Add a strategy":
 * the user's backtests, the catalog's) and stays until taken out.
 */
export function StrategiesCompare({ trail, onOpenBacktest }: { trail: Crumb[]; onOpenBacktest: (uuid: string) => void }) {
  const [compared, setCompared] = useState<CompareStrategy[]>([]);

  return (
    <ComparisonView
      candidates={[]}
      trail={trail}
      onOpen={onOpenBacktest}
      strategies={compared}
      onRemoveStrategy={(uuid) => setCompared((prev) => prev.filter((s) => s.uuid !== uuid))}
      actions={<StrategyPicker exclude={compared} onPick={(s) => setCompared((prev) => [...prev, s])} />}
      emptyText="Add two strategies at least to compare them: yours or the published ones."
    />
  );
}

/**
 * STRATEGY PICKER — "Add a strategy": the user's backtests and the catalog's newest strategies,
 * those not compared yet. Picking one adds it and resets.
 */
function StrategyPicker({ exclude, onPick }: { exclude: CompareStrategy[]; onPick: (strategy: CompareStrategy) => void }) {
  const { portfolios } = usePortfolio();
  const query = { limit: CATALOG_LIMIT, offset: 0 };
  const catalog = useInvestmentsQuery(["publications", "catalog", query], () => publicationService.list(query));
  const taken = new Set(exclude.map((s) => s.uuid));
  const own = portfolios.filter((p) => isBacktest(p) && !taken.has(p.uuid)).map((p) => ({ uuid: p.uuid, name: p.name }));
  const ownUuids = new Set(portfolios.map((p) => p.uuid));
  const published = (catalog.data?.strategies ?? [])
    .filter((s) => !taken.has(s.portfolioUuid) && !ownUuids.has(s.portfolioUuid))
    .map((s) => ({ uuid: s.portfolioUuid, name: s.portfolioName }));
  const options = [...own, ...published];

  return (
    <select
      value=""
      onChange={(e) => {
        const picked = options.find((o) => o.uuid === e.target.value);
        if (picked) onPick(picked);
      }}
      disabled={options.length === 0 && !catalog.isPending}
      aria-label="Add a strategy to the comparison"
      className="h-10 px-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#C49A3C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="">{catalog.isPending ? "Loading strategies…" : options.length === 0 ? "No strategy to add" : "+ Add a strategy"}</option>
      {own.length > 0 && (
        <optgroup label="Yours">
          {own.map((o) => <option key={o.uuid} value={o.uuid}>{o.name}</option>)}
        </optgroup>
      )}
      {published.length > 0 && (
        <optgroup label="Published">
          {published.map((o) => <option key={o.uuid} value={o.uuid}>{o.name}</option>)}
        </optgroup>
      )}
    </select>
  );
}
