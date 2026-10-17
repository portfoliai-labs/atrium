// components/dashboard/WealthBreakdown.tsx
"use client";

import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useUser } from "../../context/UserContext";
import { useWallets } from "../../context/WalletsContext";
import { useRealEstate, useRealEstateOverview } from "../../context/RealEstateContext";
import { useWalletsOverview } from "../../hooks/useWalletsOverview";
import { CATEGORICAL_PALETTE } from "../../lib/chartColors";
import { formatCompact, formatCurrency } from "../../lib/format";
import { monthLabel, savingsRate } from "../../lib/wallets";
import { Module, ModuleHead, MODULE_BODY, Figs, Fig, HBars } from "./PerformanceSection";
import { useComparisonEntry } from "./InvestmentsSection";

const WALLETS_COLOR = "#0f766e";
const REAL_ESTATE_COLOR = "#eb6834";

const rateText = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate)}%`);

/**
 * WEALTH BREAKDOWN — on the Dashboard, under the net worth: the wallets' cash flow over the last six
 * months (where the user has wallets to have), and what the whole wealth is in by asset class (the
 * investments' allocation, the wallets as cash, the real estate's equity). The wallets and the real
 * estate count when they're in the investments' currency, as in the net worth. A demo account's
 * wallets and properties are sample data.
 */
export function WealthBreakdown({ investmentsUuid }: { investmentsUuid: string }) {
  const { isDemo } = useUser();
  const { available: walletsAvailable, sample } = useWallets();
  // The wallets are a demo account's sample data, or the user's own where the backend has them.
  const hasWallets = isDemo || walletsAvailable;
  const { available: realEstateShown } = useRealEstate();
  const realEstate = useRealEstateOverview(realEstateShown);
  const entry = useComparisonEntry(investmentsUuid);
  const overview = useWalletsOverview();
  const currency = entry?.value?.currency ?? overview?.currency ?? "EUR";
  const walletsCurrency = overview?.currency ?? currency;
  const walletCount = overview?.wallets.length ?? 0;
  const walletsCounted = overview && overview.currency === currency ? overview.balance ?? 0 : 0;
  const realEstateCounted = realEstate && realEstate.currency === currency ? realEstate.equity : 0;
  const recent = (overview?.months ?? []).slice(-6);
  const sampleNote = sample ? " · sample data" : "";

  const classParts = [
    ...(entry?.allocation ?? []).map((a, i) => ({
      key: `class:${a.assetClass}`,
      label: a.assetClass,
      value: a.marketValue,
      color: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length],
    })),
    ...(walletsCounted > 0 ? [{ key: "class:cash", label: `Cash${sampleNote}`, value: walletsCounted, color: WALLETS_COLOR }] : []),
    ...(realEstateCounted > 0 ? [{ key: "class:realEstate", label: `Real estate${sampleNote}`, value: realEstateCounted, color: REAL_ESTATE_COLOR }] : []),
  ].sort((a, b) => b.value - a.value);
  const classTotal = classParts.reduce((sum, p) => sum + p.value, 0);

  const classes = (
    <Module>
      <ModuleHead title="Asset Classes" desc="What your wealth is in, across every portfolio, wallet and property." />
      <div className={`${MODULE_BODY} space-y-3`}>
        {entry === undefined ? (
          <p className="text-[12.5px] text-[#a8a29e]">Loading…</p>
        ) : classParts.length === 0 ? (
          <p className="text-[12.5px] text-[#a8a29e]">Nothing held yet.</p>
        ) : (
          <HBars
            max={100}
            rows={classParts.map((p) => {
              const share = classTotal > 0 ? (p.value / classTotal) * 100 : 0;
              return { key: p.key, label: p.label, value: share, figure: `${share.toFixed(0)}%`, color: p.color };
            })}
          />
        )}
      </div>
    </Module>
  );

  if (!hasWallets) return classes;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Module>
        <ModuleHead
          title="Cash Flow"
          desc={`What came into your wallets and what went out, month by month, transfers between them left out.${sample ? " Sample data." : ""}`}
        />
        <div className={`${MODULE_BODY} space-y-4`}>
          {recent.length === 0 ? (
            <p className="text-[12.5px] text-[#a8a29e]">
              {overview === undefined ? "Loading…" : walletCount === 0 ? "Add a wallet to see what comes in and goes out." : "Can't be added up right now: an exchange rate is missing."}
            </p>
          ) : (
            <>
              <Figs>
                <Fig label="In · 6 months" value={formatCurrency(recent.reduce((sum, m) => sum + m.income, 0), walletsCurrency, 0)} tone="gain" strong />
                <Fig label="Out · 6 months" value={formatCurrency(recent.reduce((sum, m) => sum + m.spending, 0), walletsCurrency, 0)} />
                <Fig label="Savings rate" value={rateText(savingsRate(recent))} />
              </Figs>
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 150 }}>
                  <BarChart data={recent.map((m) => ({ label: monthLabel(m.month), income: m.income, expenses: -m.spending }))} stackOffset="sign" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip formatter={(v, name) => [formatCurrency(Math.abs(Number(v)), walletsCurrency, 0), name === "income" ? "In" : "Out"]} contentStyle={{ borderRadius: 12, border: "1px solid #E0DACC", fontSize: 12 }} />
                    <ReferenceLine y={0} stroke="#a8a29e" />
                    <Bar dataKey="income" stackId="flow" fill="#1baf7a" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="expenses" stackId="flow" fill="#e11d48" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </Module>
      {classes}
    </div>
  );
}
