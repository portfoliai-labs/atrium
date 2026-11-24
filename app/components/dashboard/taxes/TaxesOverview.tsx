// components/dashboard/taxes/TaxesOverview.tsx
"use client";

import { Landmark } from "lucide-react";
import { usePortfolio } from "../../../context/PortfolioContext";
import { formatCurrency } from "../../../lib/format";
import { TAX_DISCLAIMER } from "../../../lib/taxes";
import { Breadcrumb, type Crumb } from "../Breadcrumb";
import { PAGE_HEAD, PageTitle } from "../PageHeader";
import { Fig, Figs, MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { TaxesByYearPanel, taxTotals, useTaxYearsRead } from "./RealizedTaxes";

/**
 * TAXES (every year) — the investments' Taxes section, opened from Profit & Loss's Taxes card:
 * what the taxes came to since the first year (the tax return's, the brokers'), the losses carried
 * on now and those expiring this year, then the taxes year by year (TaxesByYearPanel), each year
 * opening its page (`onOpenYear`: TaxesPage). Without a tax residence (or a regime for it), the
 * way to set it (`onOpenSettings`).
 */
export function TaxesOverviewPage({ trail, onOpenYear, onOpenSettings }: {
  trail: Crumb[];
  onOpenYear: (year: number) => void;
  onOpenSettings?: () => void;
}) {
  const { client } = usePortfolio();
  const data = useTaxYearsRead();
  const rows = Array.isArray(data) ? data : [];
  const t = taxTotals(rows);
  const money = (v: number) => formatCurrency(v, t.currency, 0);

  return (
    <div className="space-y-6 pb-12">
      <div className={PAGE_HEAD}>
        <Breadcrumb trail={trail} current="Taxes" />
        <PageTitle title={client ? `${client.name}'s taxes` : "Taxes"} info={TAX_DISCLAIMER} />
      </div>

      {data === "noRegime" ? (
        <Module>
          <div className="px-6 py-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="flex items-start gap-3">
              <span className="p-2.5 rounded-xl bg-[#C49A3C]/10 text-[#C49A3C] shrink-0"><Landmark className="h-5 w-5" /></span>
              <p className="text-[13px] text-[#57534e] max-w-xl">
                {client ? `${client.name}'s` : "Your"} taxes need a tax residence with rules to work them out. Only Italy&apos;s are computed for now.
              </p>
            </div>
            {onOpenSettings && (
              <button type="button" onClick={onOpenSettings} className="shrink-0 px-4 py-2.5 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] transition-colors">
                Set the tax residence
              </button>
            )}
          </div>
        </Module>
      ) : (
        <>
          {rows.length > 0 && (
            <Module>
              <ModuleHead title={`Since ${rows[0].year}`} desc="The estimated taxes on your investments, every year together." />
              <div className={MODULE_BODY}>
                <Figs spread>
                  <Fig label="Total" strong value={money(t.total)} info="The tax return's on the gains and the income, and what the brokers withheld, every year together." />
                  <Fig label="Declared" value={money(t.declared)} info="What the declared portfolios' gains and income owed, put in the tax returns." />
                  <Fig label="Withheld by brokers" value={money(t.withheld)} info="What the withheld portfolios' brokers took, at source." />
                  <Fig
                    label="Losses carried forward"
                    value={money(t.carried)}
                    sub={t.expiring > 0 ? `${money(t.expiring)} expire this year` : undefined}
                    info="The losses left to offset in the years after, the tax return's and each broker's."
                  />
                </Figs>
              </div>
            </Module>
          )}
          <TaxesByYearPanel onOpen={(year) => year !== undefined && onOpenYear(year)} />
        </>
      )}
    </div>
  );
}
