// components/dashboard/MarketRates.tsx
"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useInvestmentsRead } from "../../context/PortfolioContext";
import { ratesService } from "../../services/ratesService";
import {
  areaLabel, bondCurveAreas, bundSpread, currencyArea, hasBundSpread, hasDailyCurve, isEuribor, longMonthLabel,
  mortgageBenchmark, ratePct, tenorLabel,
} from "../../lib/rates";
import { RATE_INDEX_LABELS } from "../../lib/realEstate";
import { dayLabel } from "../../lib/wallets";
import type { Mortgage } from "../../models/RealEstate";
import type { Benchmark, PolicyRate } from "../../models/Rates";
import {
  AXIS_TICK_COLOR, Fig, Figs, MODULE_BODY, Module, ModuleHead, NoteS, PORTFOLIO_COLOR, TOOLTIP_STYLE,
} from "./PerformanceSection";

const TEN_YEARS = 120;

/**
 * One read of the rates, in the query cache under investmentsKey("rates", ...key) (a currency's
 * policy rate is one read for a bond and a mortgage alike): undefined while loading, null when it
 * failed (or `key` is null: not asked).
 */
function useRates<T>(key: unknown[] | null, read: () => Promise<T>): T | null | undefined {
  const value = useInvestmentsRead(["rates", ...(key ?? [])], read, key !== null);
  return key === null ? null : value;
}

const found = <T extends { found: boolean }>(list: T[] | null | undefined) => list?.find((x) => x.found) ?? null;

/**
 * BOND RATES — the market a single bond is priced against, on its holding's page (AssetExplore): the
 * policy rate of its currency's central bank (a bond in EUR follows the ECB whoever issued it), the
 * government curve of its area and, for a euro area country but Germany, its 10-year spread over the
 * Bund. The area is a guess (see bondCurveAreas): a government bond's by its ISIN, a corporate's by
 * its currency; when both have a curve, chips switch between them. Each curve's source is named under
 * it. Renders nothing when the rates can't be had.
 */
export function BondRatesModule({ isin, name, currency }: { isin: string | null; name: string; currency: string }) {
  const areas = useMemo(() => bondCurveAreas({ isin, name, currency }), [isin, name, currency]);
  const policies = useRates(["policy", currency], () => ratesService.policy([currency]));
  const curves = useRates(areas.length ? ["curves", ...areas] : null, () => ratesService.yieldCurves(areas));
  const spreadAreas = areas.filter(hasBundSpread);
  const histories = useRates(
    spreadAreas.length ? ["history", ...spreadAreas] : null,
    () => ratesService.yieldHistory([...spreadAreas, "DE"], [TEN_YEARS]),
  );
  const [picked, setPicked] = useState<string | null>(null);

  const policy = found(policies);
  const available = (curves ?? []).filter((c) => c.found && c.points.length > 0);
  const curve = available.find((c) => c.area === picked) ?? available[0] ?? null;

  if (policies === undefined || curves === undefined) {
    return (
      <Module>
        <ModuleHead title="Rates" />
        <div className={MODULE_BODY}><Loader2 className="h-5 w-5 animate-spin text-[#C49A3C]" /></div>
      </Module>
    );
  }
  if (!policy?.rate && !curve) return null;

  const points = curve ? [...curve.points].sort((a, b) => a.tenorMonths - b.tenorMonths) : [];
  const tenYear = points.find((p) => p.tenorMonths === TEN_YEARS) ?? null;
  const daily = curve ? hasDailyCurve(curve.area) : false;
  const spread = curve && histories ? bundSpread(curve.area, histories) : null;
  const byCurrency = curve !== null && curve.area === currencyArea(currency);
  const chip = (on: boolean) =>
    `px-2.5 py-1 rounded-full border text-[11.5px] font-semibold transition-colors ${on ? "bg-[#1c1917] border-[#1c1917] text-white" : "border-[#E0DACC] text-[#78716c] hover:text-[#1c1917]"}`;

  return (
    <Module>
      <ModuleHead
        title="Rates"
        desc="The rates the bond is priced against: its central bank's and its government curve."
        right={available.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {available.map((c) => (
              <button key={c.area} type="button" aria-pressed={c.area === curve?.area} onClick={() => setPicked(c.area)} className={chip(c.area === curve?.area)}>
                {areaLabel(c.area)}
              </button>
            ))}
          </div>
        ) : undefined}
      />
      <div className={`${MODULE_BODY} space-y-4`}>
        <Figs>
          {policy?.rate != null && (
            <Fig
              label="Policy rate"
              value={ratePct(policy.rate)}
              sub={[policy.centralBank, policy.since && `since ${dayLabel(policy.since)}`].filter(Boolean).join(", ")}
              info={`A bond in ${currency} follows ${policy.centralBank ?? "its central bank"}, whoever issued it.`}
            />
          )}
          {curve && tenYear && (
            <Fig
              label={`10-year, ${areaLabel(curve.area)}`}
              value={ratePct(tenYear.yieldPct)}
              sub={curve.asOf ? (daily ? `On ${dayLabel(curve.asOf)}` : `${longMonthLabel(curve.asOf.slice(0, 7))} average`) : undefined}
            />
          )}
          {spread && curve && (
            <Fig
              label="Spread over the Bund"
              value={`${spread.bp > 0 ? "+" : ""}${spread.bp} bp`}
              sub={`10-year, ${longMonthLabel(spread.month)}`}
              info={`${areaLabel(curve.area)}'s 10-year yield against Germany's in the same month. ${areaLabel(curve.area)}'s is a monthly average, so it's set against the average of Germany's daily yields that month.`}
            />
          )}
        </Figs>

        {points.length > 1 && (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 200 }}>
              <LineChart data={points.map((p) => ({ tenor: tenorLabel(p.tenorMonths), value: p.yieldPct }))} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#F2EEE4" />
                <XAxis dataKey="tenor" tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                <YAxis
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => ratePct(Number(v))}
                  tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  labelFormatter={(label) => `${label} maturity`}
                  formatter={(value) => [ratePct(Number(value)), "Yield"]}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Line type="linear" dataKey="value" stroke={PORTFOLIO_COLOR} strokeWidth={2} dot={{ r: 2.5, fill: PORTFOLIO_COLOR }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {curve && (
          <NoteS>
            {byCurrency
              ? `Read against the curve of its currency, ${currency}.`
              : `Read against ${areaLabel(curve.area)}'s government curve, by its ISIN.`}
            {!daily && ` Only the 10-year yield is published for ${areaLabel(curve.area)}, as a monthly average.`}
            {curve.description && <> Source: {curve.description}.</>}
          </NoteS>
        )}
      </div>
    </Module>
  );
}

/**
 * MORTGAGE MARKET RATES — under an open variable mortgage's figures, the market its index moves with.
 * SOFR is served, so its last fixing shows with what today's rate would be at the mortgage's spread.
 * Euribor isn't (it needs an EMMI licence): the rate stays the one the user enters, and the ECB's rate
 * and €STR are there for reference. Any other index gets its currency's policy rate. Each figure names
 * its source. Renders nothing when there's nothing to show.
 */
export function MortgageMarketRates({ mortgage: m }: { mortgage: Mortgage }) {
  const variable = m.rate.variable;
  const code = variable ? mortgageBenchmark(variable.index) : null;
  const euribor = variable ? isEuribor(variable.index) : false;
  const codes = code ? [code] : euribor ? (["ESTR"] as const) : [];
  const benchmarks = useRates(variable && codes.length ? ["benchmarks", ...codes] : null, () => ratesService.benchmarks([...codes]));
  const policyCurrency = euribor ? "EUR" : m.currency;
  const policies = useRates(variable && !code ? ["policy", policyCurrency] : null, () => ratesService.policy([policyCurrency]));

  if (!variable || m.closedOn) return null;
  const benchmark = found(benchmarks);
  const policy = found(policies);
  if (benchmarks === undefined || policies === undefined) return null;
  if (!benchmark?.rate && !policy?.rate) return null;

  return (
    <div className="rounded-xl bg-[#F7F5EF] px-3.5 py-2.5 space-y-1 text-[11.5px] text-slate-600">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Market rates</p>
      {code && benchmark?.rate != null ? (
        <SofrLine benchmark={benchmark} spreadPct={variable.spreadPct} currentPct={m.currentRatePct} />
      ) : (
        <>
          {euribor && (
            <p>
              {`${RATE_INDEX_LABELS[variable.index]} isn't available here (it needs a licence from EMMI), so the rate stays the one you enter. For reference:`}
            </p>
          )}
          <p className="flex flex-wrap gap-x-4 gap-y-0.5">
            {policy?.rate != null && <PolicyFigure policy={policy} />}
            {benchmark?.rate != null && <BenchmarkFigure benchmark={benchmark} />}
          </p>
        </>
      )}
    </div>
  );
}

function SofrLine({ benchmark, spreadPct, currentPct }: { benchmark: Benchmark; spreadPct: number; currentPct: number }) {
  const atToday = (benchmark.rate ?? 0) + spreadPct;
  const gap = atToday - currentPct;
  return (
    <>
      <p><BenchmarkFigure benchmark={benchmark} /></p>
      <p>
        At that fixing, plus your {ratePct(spreadPct)} spread, the rate would be <span className="font-bold text-slate-800 tabular-nums">{ratePct(atToday)}</span>
        {Math.abs(gap) >= 0.005 && <>, {Math.abs(gap).toFixed(2)} points {gap > 0 ? "above" : "below"} the {ratePct(currentPct)} you have now</>}.
        {" "}Your lender&apos;s own reset rules apply: record a change with Change rate.
      </p>
    </>
  );
}

function PolicyFigure({ policy }: { policy: PolicyRate }) {
  return (
    <span>
      {policy.centralBank ?? `${policy.currency} policy rate`} <span className="font-bold text-slate-800 tabular-nums">{ratePct(policy.rate ?? 0)}</span>
      {policy.since && <span className="text-slate-400"> since {dayLabel(policy.since)}</span>}
    </span>
  );
}

function BenchmarkFigure({ benchmark }: { benchmark: Benchmark }) {
  const label = benchmark.benchmark === "ESTR" ? "€STR" : benchmark.benchmark;
  return (
    <span>
      {label} <span className="font-bold text-slate-800 tabular-nums">{ratePct(benchmark.rate ?? 0)}</span>
      {benchmark.asOf && <span className="text-slate-400"> on {dayLabel(benchmark.asOf)}</span>}
      {benchmark.administrator && <span className="text-slate-400"> · {benchmark.administrator}</span>}
    </span>
  );
}
