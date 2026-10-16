// components/dashboard/ReadOnlySimulation.tsx
"use client";

import { useEffect, useState } from "react";
import { portfoliosService } from "../../services/portfoliosService";
import { PerformanceSection } from "./PerformanceSection";
import { PageHeader, type PageAction } from "./PageHeader";
import { BacktestBanner } from "./BacktestMarks";
import type { Crumb } from "./Breadcrumb";
import { StressTestPage } from "./stress/StressTestPage";
import { ProjectionPage } from "./projection/ProjectionPage";

/**
 * READ-ONLY SIMULATION — someone else's strategy portfolio, opened from a strategy an advisor
 * shared or from the strategies catalog: the backend lets the viewer read it through the usual
 * portfolio routes (its Insights, its strategy) though it isn't in their list. Its page is a
 * backtest's (PerformanceSection's `backtest`) under a header whose actions are its stress test and
 * its projection (StressTestPage, ProjectionPage, opened in place with a crumb back), and the
 * page's own (`extraActions`: Compare): it can't be copied, backtested again or adopted. `notice`
 * adds a line of its own above the backtest strip (left out with `banner` false, when the page says
 * what the strategy is itself), and `children` come under the header, hidden with it while a
 * detail view is open.
 */
export function ReadOnlySimulation({ portfolioUuid, trail, eyebrow, title: knownTitle, notice, banner = true, strategyShown = false, children, onNavigate, extraActions = [] }: {
  portfolioUuid: string;
  trail: Crumb[];
  eyebrow: string;
  // Its name when already known; otherwise read from the portfolio.
  title?: string;
  notice?: React.ReactNode;
  banner?: boolean;
  // `children` say what the strategy is: its Insights leave out the strategy's own modules.
  strategyShown?: boolean;
  children?: React.ReactNode;
  // Actions of the page's own, after the stress test and the projection (Compare, where it's offered).
  extraActions?: PageAction[];
  onNavigate?: (section: string) => void;
}) {
  const [name, setName] = useState<{ uuid: string; value: string | null } | null>(null);
  const [tool, setTool] = useState<"stress" | "projection" | null>(null);

  useEffect(() => {
    if (knownTitle) return;
    let cancelled = false;
    portfoliosService.get(portfolioUuid)
      .then((p) => { if (!cancelled) setName({ uuid: portfolioUuid, value: p.name }); })
      .catch(() => { if (!cancelled) setName({ uuid: portfolioUuid, value: null }); });
    return () => { cancelled = true; };
  }, [portfolioUuid, knownTitle]);

  const title = knownTitle ?? (name?.uuid === portfolioUuid ? name.value : null) ?? "Simulation";

  const back = [...trail, { label: title, onClick: () => setTool(null) }];
  if (tool === "stress") return <StressTestPage portfolioUuid={portfolioUuid} trail={back} eyebrow={eyebrow} />;
  if (tool === "projection") return <ProjectionPage portfolioUuid={portfolioUuid} trail={back} eyebrow={eyebrow} />;
  const open = (next: "stress" | "projection") => {
    setTool(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <PerformanceSection
      key={portfolioUuid}
      portfolioUuid={portfolioUuid}
      backtest
      strategyShown={strategyShown}
      trail={trail}
      pageLabel={title}
      onNavigate={onNavigate}
      top={(
        <>
          <PageHeader
            eyebrow={eyebrow}
            title={title}
            actions={[{ label: "Stress test", onClick: () => open("stress") }, { label: "Projection", onClick: () => open("projection") }, ...extraActions]}
            notice={(
              <div className="space-y-3">
                {notice}
                {banner && <BacktestBanner portfolioUuid={portfolioUuid} showStrategy />}
              </div>
            )}
          />
          {children}
        </>
      )}
    />
  );
}
