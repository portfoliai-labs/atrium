// components/dashboard/StrategyProfile.tsx
"use client";

import { allocationLabel } from "../../lib/classifications";
import type { FactorExposures, FactorSetExposures, ProfileDimension, ProfileShare, StrategyProfile } from "../../models/PublishedStrategy";

// What each dimension is called on a catalog card.
const DIMENSION_TITLES: Record<ProfileDimension, string> = {
  category: "Category",
  asset_class: "Asset class",
  region: "Region",
  sector: "Sector",
  index_factors: "Index factors",
};
// On a catalog card: the dimensions that tell strategies apart at a glance, the largest few of each.
const CARD_DIMENSIONS: ProfileDimension[] = ["category", "region", "index_factors"];
const CARD_SHARES = 2;

/** A share's value as the user reads it: census' values labelled, the look-through's as they are. */
function shareLabel(dimension: ProfileDimension, share: ProfileShare): string {
  if (share.value === null) return "Unknown";
  if (dimension === "category" || dimension === "index_factors") return allocationLabel(dimension, share.value);
  return share.value;
}

const pct = (v: number) => `${v.toFixed(0)}%`;

/**
 * PROFILE SUMMARY — a catalog card's line per dimension (category, region, index factors): its
 * largest values with their weight of the whole, then how many more. Plain percentages, no label
 * of the platform's; nothing until the strategy's holdings are first computed.
 */
export function ProfileSummary({ profile }: { profile: StrategyProfile | null | undefined }) {
  const rows = CARD_DIMENSIONS.flatMap((d) => profile?.breakdowns.filter((b) => b.dimension === d) ?? []);
  if (rows.length === 0 && !styleMix(profile?.factorExposures)) return null;
  const mix = styleMix(profile?.factorExposures);
  return (
    <dl className="space-y-1">
      {mix && mix.styles.length > 0 && (
        <div className="flex items-baseline gap-2 min-w-0 text-[11.5px]">
          <dt className="shrink-0 w-[84px] text-[#78716c]">Behaves like</dt>
          <dd className="min-w-0 truncate text-[#1c1917]" title={mix.styles.map((x) => `${STYLE_LABELS[x.factor] ?? x.name} ${pct(x.value * 100)}`).join(" · ")}>
            {mix.styles.slice(0, CARD_SHARES).map((x) => (
              <span key={x.factor} className="mr-2"><span className="font-semibold">{STYLE_LABELS[x.factor] ?? x.name}</span> <span className="tabular-nums">{pct(x.value * 100)}</span></span>
            ))}
            {mix.styles.length > CARD_SHARES && <span className="text-[#857e78]">+{mix.styles.length - CARD_SHARES}</span>}
          </dd>
        </div>
      )}
      {rows.map((b) => {
        const known = b.shares.filter((s) => s.value !== null);
        const more = known.length - CARD_SHARES;
        return (
          <div key={b.dimension} className="flex items-baseline gap-2 min-w-0 text-[11.5px]">
            <dt className="shrink-0 w-[84px] text-[#78716c]">{DIMENSION_TITLES[b.dimension]}</dt>
            <dd className="min-w-0 truncate text-[#1c1917]" title={known.map((s) => `${shareLabel(b.dimension, s)} ${pct(s.weightPct)}`).join(" · ")}>
              {known.slice(0, CARD_SHARES).map((s) => (
                <span key={s.value} className="mr-2"><span className="font-semibold">{shareLabel(b.dimension, s)}</span> <span className="tabular-nums">{pct(s.weightPct)}</span></span>
              ))}
              {more > 0 && <span className="text-[#857e78]">+{more}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

// A factor ETF's style as the user reads it (the ETF itself is named under it).
const STYLE_LABELS: Record<string, string> = {
  market: "World market",
  value: "Value",
  momentum: "Momentum",
  quality: "Quality",
  min_volatility: "Minimum volatility",
  size: "Mid caps",
  emerging_markets: "Emerging markets",
};

const monthLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" });

/** The factor ETFs' set (long-only), its styles of 5% or more by weight, the largest first; null without one. */
function styleMix(exposures: FactorExposures | null | undefined): { set: FactorSetExposures; styles: FactorSetExposures["exposures"] } | null {
  const set = exposures?.status === "ok" ? exposures.sets.find((s) => s.kind === "long_only") : undefined;
  if (!set) return null;
  return { set, styles: set.exposures.filter((e) => e.significant).sort((a, b) => b.value - a.value) };
}

/**
 * STYLE MIX — what the equity holdings behaved like: the mix of factor ETFs whose monthly returns
 * come closest to theirs (Sharpe's style analysis, computed by the backend), each style of 5% or
 * more with its ETF, the rest as cash when it is as much. How their returns moved, not what they
 * hold (the breakdowns are that). `compact` (a module's card): the largest few styles, the months
 * and how much of their ups and downs the mix explains on one line; else every style and the
 * note with the prices' source. Nothing before the backend measured it.
 */
export function StyleMix({ exposures, compact = false }: { exposures: FactorExposures | null | undefined; compact?: boolean }) {
  if (!exposures) return null;
  if (exposures.status === "insufficient_history") {
    return <p className="text-xs text-slate-500 py-2">Its equity holdings have less than three years of history: too short to measure.</p>;
  }
  const mix = styleMix(exposures);
  if (!mix) return <p className="text-xs text-slate-500 py-2">It holds no equity to measure.</p>;
  const { set, styles } = mix;
  const cash = set.cashWeight !== null && set.cashWeight >= 0.05 ? set.cashWeight : null;
  const rows = [
    ...styles.map((x) => ({ key: x.factor, label: STYLE_LABELS[x.factor] ?? x.name, detail: x.name, weight: x.value })),
    ...(cash !== null ? [{ key: "cash", label: "Cash", detail: "What the styles leave out: the risk-free rate", weight: cash }] : []),
  ];
  const shown = compact ? rows.slice(0, COMPACT_STYLES) : rows;
  const top = Math.max(...rows.map((r) => r.weight), 0.01);
  const period = set.firstMonth && set.lastMonth ? `${monthLabel(set.firstMonth)} – ${monthLabel(set.lastMonth)}` : `${set.months} months`;
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100">
        {shown.map((r) => (
          <li key={r.key} className="py-2.5 space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-slate-900 truncate">{r.label}</span>
                <span className="block text-[11px] text-slate-500 truncate">{r.detail}</span>
              </span>
              <span className="shrink-0 text-[13px] font-black tabular-nums text-slate-900">{pct(r.weight * 100)}</span>
            </div>
            <span className="relative block h-1.5 rounded-full bg-slate-100" aria-hidden>
              <span className="absolute inset-y-0 left-0 rounded-full bg-[#C49A3C]" style={{ width: `${Math.min(100, (r.weight / top) * 100)}%` }} />
            </span>
          </li>
        ))}
      </ul>
      {compact ? (
        <p className="text-[11px] text-slate-500">
          {rows.length > shown.length && `+${rows.length - shown.length} more · `}{set.months} months · explains {pct(set.rSquared * 100)} of its ups and downs
        </p>
      ) : (
        <p className="text-[11px] text-slate-500 leading-relaxed">
          The mix of factor ETFs whose monthly returns come closest to its equity holdings&apos; ({pct(exposures.equityWeightPct)} of
          the portfolio), {period}, with the exchange rate taken out: it explains {pct(set.rSquared * 100)} of their ups and downs. How they behaved,
          not what they hold. Source: {set.source}.
        </p>
      )}
    </div>
  );
}

// A module's card shows this many styles; the rest are in its detail.
const COMPACT_STYLES = 4;

// A Fama-French factor as the user reads it, and what a positive / negative loading leans towards.
const LOADING_LABELS: Record<string, { label: string; positive: string; negative: string }> = {
  market: { label: "Market", positive: "moves more than the market", negative: "moves less than the market" },
  size: { label: "Size", positive: "small caps", negative: "large caps" },
  value: { label: "Value", positive: "cheap (value) stocks", negative: "expensive (growth) stocks" },
  profitability: { label: "Profitability", positive: "highly profitable companies", negative: "weakly profitable companies" },
  investment: { label: "Investment", positive: "companies investing conservatively", negative: "companies investing aggressively" },
  momentum: { label: "Momentum", positive: "recent winners", negative: "recent losers" },
};

// The markets a set's factors are built from, as the note names them.
const REGION_LABELS: Record<string, string> = {
  developed: "developed-market",
  developed_ex_us: "developed-market (ex US)",
  europe: "European",
  north_america: "North American",
  united_states: "US",
  japan: "Japanese",
  asia_pacific_ex_japan: "Asia Pacific (ex Japan)",
  emerging: "emerging-market",
};

const signed = (v: number, digits: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;

/** The Fama-French set (long-short) of the measured ones, when the backend serves it. */
export function loadingsSet(exposures: FactorExposures | null | undefined): FactorSetExposures | null {
  return exposures?.status === "ok" ? exposures.sets.find((s) => s.kind === "long_short") ?? null : null;
}

/**
 * FACTOR LOADINGS — the same equity holdings regressed on Fama and French's factors (a module's
 * detail, where the backend serves them): the market's loading always (1.00 moves one for one with
 * it), then those at least two standard errors from zero, each with what it leans towards and its
 * t-stat, the others named together as no clear tilt; the unexplained return and how much the
 * factors explain, with the library cited.
 */
export function FactorLoadings({ set, equityWeightPct }: { set: FactorSetExposures; equityWeightPct: number }) {
  const market = set.exposures.find((e) => e.factor === "market");
  const tilts = set.exposures.filter((e) => e.factor !== "market" && e.significant);
  const none = set.exposures.filter((e) => e.factor !== "market" && !e.significant);
  const label = (factor: string, name: string) => LOADING_LABELS[factor]?.label ?? name;
  const period = set.firstMonth && set.lastMonth ? `${monthLabel(set.firstMonth)} – ${monthLabel(set.lastMonth)}` : `${set.months} months`;
  const alphaSignificant = set.alphaTStat !== null && Math.abs(set.alphaTStat) >= 2;
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100">
        {[...(market ? [market] : []), ...tilts].map((e) => {
          const reading = LOADING_LABELS[e.factor];
          const leans = e.factor === "market"
            ? (e.value >= 1 ? reading?.positive : reading?.negative)
            : `leans towards ${e.value >= 0 ? reading?.positive : reading?.negative}`;
          return (
            <li key={e.factor} className="py-2.5 flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-slate-900 truncate">{label(e.factor, e.name)}</span>
                <span className="block text-[11px] text-slate-500 truncate">{reading ? leans : e.name}</span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block text-[13px] font-black text-slate-900">{signed(e.value, 2)}</span>
                {e.tStat !== null && <span className="block text-[10.5px] text-slate-500">t {e.tStat.toFixed(1)}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {none.length > 0 && <p className="text-[11px] text-slate-500">No clear tilt: {none.map((e) => label(e.factor, e.name)).join(", ")}.</p>}
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Its equity holdings&apos; ({pct(equityWeightPct)} of the portfolio) monthly excess returns regressed on Fama and
        French&apos;s {REGION_LABELS[set.region] ?? set.region} factors, {period}, in dollars. A loading of 1.00 moves one for one
        with its factor; only those at least two standard errors from zero are a tilt. The factors explain {pct(set.rSquared * 100)} of
        its ups and downs; what they don&apos;t, {signed(set.alphaAnnualPct, 1)}% a year, is {alphaSignificant ? "" : "not "}significant.
        Source: {set.sourceUrl
          ? <a href={set.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{set.source}</a>
          : set.source}.
      </p>
    </div>
  );
}
