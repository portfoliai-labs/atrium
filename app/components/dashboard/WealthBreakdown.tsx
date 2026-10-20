// components/dashboard/WealthBreakdown.tsx
"use client";

import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useUser } from "../../context/UserContext";
import { useWallets } from "../../context/WalletsContext";
import { useWalletsOverview } from "../../hooks/useWalletsOverview";
import { formatCompact, formatCurrency } from "../../lib/format";
import { monthLabel, savingsRate } from "../../lib/wallets";
import { Module, ModuleHead, MODULE_BODY, Figs, Fig } from "./PerformanceSection";

const rateText = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate)}%`);

/**
 * WEALTH BREAKDOWN — on the Dashboard, under the net worth: the wallets' cash flow over the last six
 * months, where the user has wallets to have (a demo account's are sample data). Nothing otherwise.
 */
export function WealthBreakdown() {
  const { isDemo } = useUser();
  const { available: walletsAvailable, sample } = useWallets();
  // The wallets are a demo account's sample data, or the user's own where the backend has them.
  const hasWallets = isDemo || walletsAvailable;
  const overview = useWalletsOverview();
  const walletsCurrency = overview?.currency ?? "EUR";
  const walletCount = overview?.wallets.length ?? 0;
  const recent = (overview?.months ?? []).slice(-6);

  if (!hasWallets) return null;

  return (
    <Module>
      <ModuleHead
        title="Cash Flow"
        desc={`What came into your wallets and what went out, month by month, transfers between them left out.${sample ? " Sample data." : ""}`}
      />
      <div className={`${MODULE_BODY} space-y-4`}>
        {recent.length === 0 ? (
          <p className="text-[12.5px] text-[#857e78]">
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
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#857e78" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={{ fontSize: 10, fill: "#857e78" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v, name) => [formatCurrency(Math.abs(Number(v)), walletsCurrency, 0), name === "income" ? "In" : "Out"]} contentStyle={{ borderRadius: 12, border: "1px solid #E0DACC", fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="#857e78" />
                  <Bar dataKey="income" stackId="flow" fill="#1baf7a" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="expenses" stackId="flow" fill="#e11d48" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </Module>
  );
}
