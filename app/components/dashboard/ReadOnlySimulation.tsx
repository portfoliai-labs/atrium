// components/dashboard/ReadOnlySimulation.tsx
"use client";

import { useState } from "react";
import { useInvestmentsRead } from "../../context/PortfolioContext";
import { portfoliosService } from "../../services/portfoliosService";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";
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
  const [tool, setTool] = useState<"stress" | "projection" | null>(null);
  // Its returns beside the Performance chart (TWR since inception, last 12 months, per year), from
  // the comparison as a portfolio's page has them (GET /v1/portfolios/comparison reads any portfolio
  // the viewer can).
  const comparison = useInvestmentsRead<PortfolioComparisonEntry | null>(
    ["comparison", "own", portfolioUuid], async () => (await portfoliosService.compare([portfolioUuid]))[0] ?? null,
  );
  const name = useInvestmentsRead(["portfolio", portfolioUuid], () => portfoliosService.get(portfolioUuid), !knownTitle);

  const title = knownTitle ?? name?.name ?? "Simulation";

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
      comparison={comparison ?? null}
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
