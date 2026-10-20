// components/dashboard/realEstate/PropertyMarket.tsx
"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useRealEstate } from "../../../context/RealEstateContext";
import { formatCurrency } from "../../../lib/format";
import { SALES_SEGMENT_LABELS, VALUATION_SOURCE_LABELS } from "../../../lib/realEstate";
import type { MarketQuotation, MarketSales, MarketSemester, MarketTrend, Property, PropertyMarket } from "../../../models/RealEstate";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { AXIS_TICK, PreviewBadge, TOOLTIP_STYLE } from "../../preview/PreviewKit";

const MISSING_TEXT: Record<string, string> = {
  "address.location": "the address's location",
  "details.municipality_code": "the municipality (in the land registry details)",
  surface_sqm: "the surface",
};

const POSITION_TEXT = { below: "below the zone's range", within: "within the zone's range", above: "above the zone's range" } as const;
const POSITION_TONE = { below: "text-amber-700", within: "text-emerald-700", above: "text-[#8A6A28]" } as const;

const semesterText = (s: MarketSemester) => `${s.half === 1 ? "first" : "second"} half of ${s.year}`;
const surfaceText = (s: MarketQuotation["saleSurface"]) => (s === "net" ? "net m²" : s === "gross" ? "gross m²" : "m²");

/**
 * MARKET — what its zone's market says of a property (Italy: the OMI of the Agenzia delle Entrate):
 * the zone (picked by the user, or found from the address's location), the sale and rent ranges
 * per m² for its kind of building, what the whole property would be worth within the sale range
 * against its value now, and its rent against the zone's. An indicative range, never an appraisal;
 * the source is credited wherever the figures show (CC BY 4.0). Without a zone it says what's
 * missing, or offers to pick one; nothing at all for a country with no source. The municipality's
 * sales show whatever the zone's status, as they need only the municipality.
 */
export function PropertyMarketModule({ property, readOnly, onEdit }: { property: Property; readOnly: boolean; onEdit: () => void }) {
  const { source, version, sample } = useRealEstate();
  const key = `${property.uuid}:${version}`;
  const [state, setState] = useState<{ key: string; market: PropertyMarket | null } | null>(null);
  const [allTypes, setAllTypes] = useState(false);
  useEffect(() => {
    let cancelled = false;
    source.market(property.uuid)
      .then((market) => { if (!cancelled) setState({ key, market }); })
      .catch(() => { if (!cancelled) setState({ key, market: null }); });
    return () => { cancelled = true; };
  }, [source, property.uuid, key]);
  const market = state?.key === key ? state.market : undefined;
  // Nothing to say where there's no source (or the API has no market yet).
  if (market === null || market?.status === "no_source") return null;

  const eur = (v: number) => formatCurrency(v, "EUR", 0);
  const perSqm = (v: number, digits = 0) => formatCurrency(v, "EUR", digits);
  const editButton = (label: string) => !readOnly && (
    <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E0DACC] text-[11px] font-bold text-[#1c1917] hover:border-[#C49A3C]">
      <MapPin className="h-3 w-3" /> {label}
    </button>
  );

  return (
    <Module>
      <ModuleHead
        title="The zone's market"
        desc={market?.quotation ? `Its zone's indicative range, ${semesterText(market.quotation.semester)}: not an appraisal.` : "Its zone's indicative range: not an appraisal."}
        right={sample ? <PreviewBadge label="Sample" /> : undefined}
      />
      <div className={`${MODULE_BODY} space-y-4`}>
        {market === undefined ? (
          <p className="text-[12.5px] text-[#857e78]">Loading…</p>
        ) : market.status === "missing_fields" ? (
          // The form has no map: a zone is found from the municipality, picked by hand.
          market.missingFields.includes("details.municipality_code") ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12.5px] text-slate-600">Add its municipality (in the land registry details), then pick its market zone.</p>
              {editButton("Edit property")}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12.5px] text-slate-600">
                Its zone can&apos;t be found without {market.missingFields.map((f) => MISSING_TEXT[f] ?? f).join(" and ")}: pick it from the municipality&apos;s.
              </p>
              {editButton("Pick the zone")}
            </div>
          )
        ) : market.status === "no_zone" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-slate-600">No market zone found for its address: pick it from the municipality&apos;s.</p>
            {editButton("Pick the zone")}
          </div>
        ) : market.status === "no_data" ? (
          <p className="text-[12.5px] text-slate-500">Market data isn&apos;t available for this municipality.</p>
        ) : (
          <>
            {market.zone && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12.5px] text-slate-600">
                  <span className="font-bold text-slate-900">Zone {market.zone.code}</span> · {market.zone.band} · {market.zone.description}
                  <span className="text-slate-400"> — {market.match === "user" ? "picked by you" : "from the address's location"}</span>
                </p>
                {editButton("Change zone")}
              </div>
            )}
            {market.status === "not_quoted" || !market.quotation ? (
              <p className="text-[12.5px] text-slate-500">The zone has no quotation for this kind of property.</p>
            ) : (
              <>
                {market.value ? (
                  <ValueRange low={market.value.low} mid={market.value.mid} high={market.value.high} property={property} money={eur} />
                ) : (
                  <p className="text-[12.5px] text-slate-500">Add its surface to see what it would be worth within the range.</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[12px]">
                  <Figure
                    label={`Sale, per ${surfaceText(market.quotation.saleSurface)}`}
                    value={`${perSqm(market.quotation.saleMin)} – ${perSqm(market.quotation.saleMax)}`}
                    note={`${market.quotation.buildingType}, ${market.quotation.state.toLowerCase()}`}
                  />
                  <Figure
                    label={`Rent, per ${surfaceText(market.quotation.rentSurface)} a month`}
                    value={market.quotation.rentMin !== null && market.quotation.rentMax !== null ? `${perSqm(market.quotation.rentMin, 1)} – ${perSqm(market.quotation.rentMax, 1)}` : "—"}
                  />
                  {market.rent ? (
                    <Figure
                      label="Its rent, per m² a month"
                      value={perSqm(market.rent.monthlyRentPerSqm, 1)}
                      note={<span className={`font-bold ${POSITION_TONE[market.rent.position]}`}>{POSITION_TEXT[market.rent.position]}</span>}
                    />
                  ) : (
                    <Figure label="Its rent" value="—" note="No lease running today." />
                  )}
                </div>
              </>
            )}
            {market.trend && market.trend.points.length > 1 && <Trend trend={market.trend} />}
            {market.zoneQuotations.length > 0 && (
              <div className="space-y-2">
                <button type="button" onClick={() => setAllTypes((o) => !o)} className="flex items-center gap-1 text-[11px] font-bold text-[#8A6A28] hover:text-[#C49A3C]">
                  {allTypes ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {allTypes ? "Hide the zone's other buildings" : `Every kind of building in the zone (${market.zoneQuotations.length})`}
                </button>
                {allTypes && (
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50">
                          <th className="px-3 py-2">Building</th>
                          <th className="px-3 py-2">State</th>
                          <th className="px-3 py-2 text-right">Sale €/m²</th>
                          <th className="px-3 py-2 text-right">Rent €/m² a month</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {market.zoneQuotations.map((q) => (
                          <tr key={`${q.buildingTypeCode}:${q.state}`} className={q === market.quotation || (q.buildingTypeCode === market.quotation?.buildingTypeCode && q.state === market.quotation?.state) ? "font-bold text-slate-900" : "text-slate-600"}>
                            <td className="px-3 py-1.5">{q.buildingType}</td>
                            <td className="px-3 py-1.5">{q.state}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{q.saleMin.toLocaleString("en-US")} – {q.saleMax.toLocaleString("en-US")}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{q.rentMin !== null && q.rentMax !== null ? `${q.rentMin.toFixed(1)} – ${q.rentMax.toFixed(1)}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {market?.sales && market.sales.years.length > 0 && <Sales sales={market.sales} />}
        {market && (market.attribution || sample) && (
          <p className="text-[10.5px] text-slate-400">
            {market.attribution
              ? <>Source: {market.attribution} (CC BY 4.0).{market.quotation && " Indicative ranges for the zone, not an appraisal of this property."}</>
              : "Sample figures, made up for the demo: not the OMI's."}
          </p>
        )}
      </div>
    </Module>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10.5px] text-slate-400">{label}</p>
      <p className="font-bold text-slate-900 tabular-nums">{value}</p>
      {note && <p className="text-[11px] text-slate-500">{note}</p>}
    </div>
  );
}

/** The whole property's range at the zone's prices, its middle, and where its value now falls. */
function ValueRange({ low, mid, high, property, money }: { low: number; mid: number; high: number; property: Property; money: (v: number) => string }) {
  const value = property.figures.value;
  // Room either side, so a value off the range still shows.
  const from = Math.min(low, value) * 0.95;
  const to = Math.max(high, value) * 1.05;
  const at = (v: number) => `${((v - from) / (to - from)) * 100}%`;
  const fromMarket = property.figures.valueSource === "market_zone";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] text-slate-600">
          At the zone&apos;s prices: <span className="font-black text-slate-900">{money(low)} – {money(high)}</span>
          <span className="text-slate-400"> (middle {money(mid)})</span>
        </p>
        <p className="text-[12px] text-slate-500">
          Its value now <span className="font-bold text-slate-900">{money(value)}</span>
          {property.figures.valueSource && !fromMarket && ` (${VALUATION_SOURCE_LABELS[property.figures.valueSource].toLowerCase()})`}
          {fromMarket && " (the zone's middle: no valuation of yours)"}
        </p>
      </div>
      <div className="relative h-2.5 rounded-full bg-slate-100">
        <div className="absolute inset-y-0 rounded-full bg-[#C49A3C]/30" style={{ left: at(low), width: `calc(${at(high)} - ${at(low)})` }} />
        <div className="absolute -top-0.5 h-3.5 w-0.5 bg-[#C49A3C]" style={{ left: at(mid) }} title={`Middle ${money(mid)}`} />
        <div className="absolute -top-1 h-4.5 w-4.5 -ml-2 rounded-full border-2 border-white bg-slate-900 shadow" style={{ left: at(value) }} title={`Its value ${money(value)}`} />
      </div>
      <p className="text-[11px] text-slate-400">The whole property&apos;s, from its surface; the dot is its value now.</p>
    </div>
  );
}

const changeText = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`);
const changeTone = (v: number | null) => (v === null || v === 0 ? "text-slate-500" : v > 0 ? "text-emerald-700" : "text-rose-600");

/**
 * The zone's middle sale price and rent per m² over the semesters (its kind of building and state),
 * and how they moved: on the semester before the latest, and on the same half a year earlier.
 * The semesters needn't follow on: one without a quotation is left out.
 */
function Trend({ trend }: { trend: MarketTrend }) {
  const data = trend.points.map((p) => ({ label: `H${p.semester.half} ’${String(p.semester.year).slice(2)}`, sale: p.saleMid, rent: p.rentMid }));
  const hasRent = trend.points.some((p) => p.rentMid !== null);
  const change = (label: string, semester: number | null, year: number | null) => (
    <p className="text-[12px] text-slate-500">
      {label}: <span className={`font-bold ${changeTone(year)}`}>{changeText(year)}</span> on the year,{" "}
      <span className={`font-bold ${changeTone(semester)}`}>{changeText(semester)}</span> on the semester
    </p>
  );
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-[12.5px] font-bold text-slate-700">Prices over time · {trend.buildingType}, {trend.state.toLowerCase()}</p>
        <div className="flex flex-wrap gap-x-5">
          {change("Sale", trend.saleChangeSemesterPct, trend.saleChangeYearPct)}
          {hasRent && change("Rent", trend.rentChangeSemesterPct, trend.rentChangeYearPct)}
        </div>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 200 }}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis yAxisId="sale" tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} domain={["auto", "auto"]} tickFormatter={(v) => `€${Number(v).toLocaleString("en-US")}`} />
            {hasRent && <YAxis yAxisId="rent" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} domain={["auto", "auto"]} tickFormatter={(v) => `€${v}`} />}
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v, name) => (name === "sale" ? [`€${Number(v).toLocaleString("en-US")}/m²`, "Sale, middle"] : [`€${Number(v).toFixed(1)}/m² a month`, "Rent, middle"])}
            />
            <Legend formatter={(v) => (v === "sale" ? "Sale €/m² (left)" : "Rent €/m² a month (right)")} wrapperStyle={{ fontSize: 12 }} />
            <Line yAxisId="sale" type="monotone" dataKey="sale" stroke="#C49A3C" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
            {hasRent && <Line yAxisId="rent" type="monotone" dataKey="rent" stroke="#0f766e" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


const MARKET_SIZE_TEXT = "The Agenzia's ranking of the municipality's market by sales, from S to XXL.";
const salesText = (v: number) => Math.round(v).toLocaleString("en-US");

/**
 * The municipality's sales by year (OMI's NTN, a share sold counting for its share): the property's
 * segment, its change on the year before, and all the homes sold for context. Land has no segment:
 * only the homes then.
 */
function Sales({ sales }: { sales: MarketSales }) {
  const latest = sales.years.at(-1)!;
  const segment = sales.segment && latest.transactions !== null ? SALES_SEGMENT_LABELS[sales.segment] : null;
  // The segment's bars, else the homes'.
  const bars = sales.years.map((y) => ({ year: String(y.year), sold: segment ? y.transactions : y.residentialTransactions }));
  const chip = [sales.provincialCapital && "Provincial capital", sales.marketSize && `${sales.marketSize} market`].filter(Boolean).join(" · ");
  // The segment's figures first, else the homes'.
  const [count, change] = segment ? [latest.transactions!, sales.changeYearPct] : [latest.residentialTransactions, sales.residentialChangeYearPct];
  return (
    <div className="space-y-3 rounded-xl border border-slate-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] font-bold text-slate-700">Sales in the municipality · {latest.year}</p>
        {chip && (
          <span title={sales.marketSize ? MARKET_SIZE_TEXT : undefined} className="rounded-full bg-[#F6F1E6] px-2.5 py-0.5 text-[10.5px] font-bold text-[#8A6A28]">
            {chip}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10.5px] text-slate-400">{segment ?? "Homes"}</p>
          <p className="flex items-baseline gap-2">
            <span className="text-[20px] font-black text-slate-900 tabular-nums">{count === null ? "—" : salesText(count)}</span>
            <span className="text-[11px] text-slate-500">sold</span>
            {change !== null && <span className={`text-[12px] font-bold ${changeTone(change)}`}>{changeText(change)} on {latest.year - 1}</span>}
          </p>
          {segment && (
            <p className="text-[11.5px] text-slate-500">
              All homes in the municipality:{" "}
              <span className="tabular-nums text-slate-700">{latest.residentialTransactions === null ? "—" : salesText(latest.residentialTransactions)}</span>
              {sales.residentialChangeYearPct !== null && <span className={`font-bold ${changeTone(sales.residentialChangeYearPct)}`}> ({changeText(sales.residentialChangeYearPct)})</span>}
            </p>
          )}
        </div>
        {bars.length > 1 && (
          <div className="h-20 w-full max-w-[260px]">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 260, height: 80 }}>
              <BarChart data={bars} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="year" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} formatter={(v) => [v === null ? "—" : salesText(Number(v)), "Sold"]} />
                <Bar dataKey="sold" fill="#C49A3C" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
