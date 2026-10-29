// components/dashboard/realEstate/PropertyMarket.tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useRealEstate, useRealEstateRead } from "../../../context/RealEstateContext";
import { formatCurrency } from "../../../lib/format";
import { SALES_SEGMENT_LABELS, VALUATION_SOURCE_LABELS } from "../../../lib/realEstate";
import type { MarketQuotation, MarketSales, MarketSemester, MarketTrend, Property, PropertyMarket } from "../../../models/RealEstate";
import { Fig, Figs, MODULE_BODY, Module, ModuleHead, NoteS } from "../PerformanceSection";
import { AXIS_TICK, PreviewBadge, TOOLTIP_STYLE } from "../../preview/PreviewKit";

const MISSING_TEXT: Record<string, string> = {
  "address.location": "the address's location",
  "details.municipality_code": "the municipality (in the land registry details)",
  surface_sqm: "the surface",
};

const POSITION_TEXT = { below: "Below the zone's", within: "Within the zone's", above: "Above the zone's" } as const;
const POSITION_CHIP = { below: "bg-amber-50 text-amber-700", within: "bg-emerald-50 text-emerald-700", above: "bg-[#F6F1E6] text-[#8A6A28]" } as const;

const SALE_COLOR = "#C49A3C";
const RENT_COLOR = "#0f766e";

const semesterText = (s: MarketSemester) => `${s.half === 1 ? "first" : "second"} half of ${s.year}`;
const surfaceText = (s: MarketQuotation["saleSurface"]) => (s === "net" ? "net m²" : s === "gross" ? "gross m²" : "m²");

/**
 * MARKET — what its zone's market says of a property (Italy: the OMI of the Agenzia delle Entrate):
 * the zone (picked by the user, or found from the address's location), what the whole property
 * would be worth within the zone's sale range against its value now, the sale and rent ranges per
 * m² for its kind of building and its rent against the zone's; then, each a part of its own, the
 * prices over time, the municipality's sales and every kind of building the zone quotes. An
 * indicative range, never an appraisal; the source is credited wherever the figures show (CC BY
 * 4.0). Without a zone it says what's missing, or offers to pick one; nothing at all for a country
 * with no source. The municipality's sales show whatever the zone's status, as they need only the
 * municipality.
 */
export function PropertyMarketModule({ property, readOnly, onEdit }: { property: Property; readOnly: boolean; onEdit: () => void }) {
  const { sample } = useRealEstate();
  const market = useRealEstateRead<PropertyMarket>(["market", property.uuid], (source) => source.market(property.uuid));
  // Nothing to say where there's no source (or the API has no market yet).
  if (market === null || market?.status === "no_source") return null;

  const eur = (v: number) => formatCurrency(v, "EUR", 0);
  const perSqm = (v: number, digits = 0) => formatCurrency(v, "EUR", digits);
  const editButton = (label: string) => !readOnly && (
    <button type="button" onClick={onEdit} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E0DACC] text-[11px] font-bold text-[#1c1917] hover:border-[#C49A3C]">
      <MapPin className="h-3 w-3" /> {label}
    </button>
  );
  const notice = (text: React.ReactNode, button?: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[12.5px] text-[#78716c]">{text}</p>
      {button}
    </div>
  );
  const quotation = market?.quotation;

  return (
    <Module>
      <ModuleHead
        title="The zone's market"
        desc={quotation ? `Its zone's indicative range, ${semesterText(quotation.semester)}: not an appraisal.` : "Its zone's indicative range: not an appraisal."}
        right={sample ? <PreviewBadge label="Sample" /> : undefined}
      />
      <div className={`${MODULE_BODY} space-y-5`}>
        {market === undefined ? (
          <p className="text-[12.5px] text-[#857e78]">Loading…</p>
        ) : market.status === "missing_fields" ? (
          // The form has no map: a zone is found from the municipality, picked by hand.
          market.missingFields.includes("details.municipality_code")
            ? notice("Add its municipality (in the land registry details), then pick its market zone.", editButton("Edit property"))
            : notice(<>Its zone can&apos;t be found without {market.missingFields.map((f) => MISSING_TEXT[f] ?? f).join(" and ")}: pick it from the municipality&apos;s.</>, editButton("Pick the zone"))
        ) : market.status === "no_zone" ? (
          notice(<>No market zone found for its address: pick it from the municipality&apos;s.</>, editButton("Pick the zone"))
        ) : market.status === "no_data" ? (
          notice(<>Market data isn&apos;t available for this municipality.</>)
        ) : (
          <>
            {market.zone && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F7F5EF] px-3.5 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <MapPin className="h-4 w-4 shrink-0 text-[#C49A3C]" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-bold text-[#1c1917] truncate">
                      Zone {market.zone.code} · {market.zone.band}
                    </p>
                    <p className="text-[11px] text-[#857e78] truncate" title={market.zone.description}>
                      {market.zone.description} · {market.match === "user" ? "picked by you" : "from the address's location"}
                    </p>
                  </div>
                </div>
                {editButton("Change zone")}
              </div>
            )}
            {market.status === "not_quoted" || !quotation ? (
              notice("The zone has no quotation for this kind of property.")
            ) : (
              <>
                {market.value ? (
                  <ValueRange low={market.value.low} mid={market.value.mid} high={market.value.high} property={property} money={eur} />
                ) : (
                  notice("Add its surface to see what it would be worth within the range.")
                )}
                <Figs>
                  <Fig
                    label={`Sale, per ${surfaceText(quotation.saleSurface)}`}
                    value={`${perSqm(quotation.saleMin)} – ${perSqm(quotation.saleMax)}`}
                    sub={`${quotation.buildingType}, ${quotation.state.toLowerCase()}`}
                  />
                  <Fig
                    label={`Rent, per ${surfaceText(quotation.rentSurface)} a month`}
                    value={quotation.rentMin !== null && quotation.rentMax !== null ? `${perSqm(quotation.rentMin, 1)} – ${perSqm(quotation.rentMax, 1)}` : "—"}
                  />
                  {market.rent ? (
                    <Fig
                      label="Its rent, per m² a month"
                      value={perSqm(market.rent.monthlyRentPerSqm, 1)}
                      badge={<span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${POSITION_CHIP[market.rent.position]}`}>{POSITION_TEXT[market.rent.position]}</span>}
                    />
                  ) : (
                    <Fig label="Its rent" value="—" sub="No lease running today." />
                  )}
                </Figs>
              </>
            )}
            {market.trend && market.trend.points.length > 1 && <Trend trend={market.trend} />}
            {market.zoneQuotations.length > 0 && <ZoneQuotations quotations={market.zoneQuotations} quotation={quotation ?? null} />}
          </>
        )}
        {market?.sales && market.sales.years.length > 0 && <Sales sales={market.sales} />}
        {market && (market.attribution || sample) && (
          <NoteS className="text-[10.5px]">
            {market.attribution
              ? <>Source: {market.attribution} (CC BY 4.0).{quotation && " Indicative ranges for the zone, not an appraisal of this property."}</>
              : "Sample figures, made up for the demo: not the OMI's."}
          </NoteS>
        )}
      </div>
    </Module>
  );
}

/** One of the module's parts under its figures: a hairline above, a small heading, `right` beside it. */
function Part({ title, sub, right, children }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t border-[#EEE9DD] pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[12.5px] font-bold text-[#1c1917]">
          {title}
          {sub && <span className="font-normal text-[#857e78]"> · {sub}</span>}
        </p>
        {right}
      </div>
      {children}
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
  const source = fromMarket
    ? "The zone's middle: no valuation of yours"
    : property.figures.valueSource ? VALUATION_SOURCE_LABELS[property.figures.valueSource] : null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-[11px] text-[#78716c]">Worth at the zone&apos;s prices</p>
          <p className="text-[22px] font-bold tabular-nums tracking-[-0.01em] text-[#1c1917]">{money(low)} – {money(high)}</p>
          <p className="text-[11px] text-[#857e78]">Middle {money(mid)}, from its surface</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-[#78716c]">Its value now</p>
          <p className="text-[17px] font-bold tabular-nums text-[#1c1917]">{money(value)}</p>
          {source && <p className="text-[11px] text-[#857e78]">{source}</p>}
        </div>
      </div>
      <div className="relative h-2.5 rounded-full bg-[#F7F5EF]">
        <div className="absolute inset-y-0 rounded-full bg-[#C49A3C]/30" style={{ left: at(low), width: `calc(${at(high)} - ${at(low)})` }} />
        <div className="absolute -top-0.5 h-3.5 w-0.5 bg-[#C49A3C]" style={{ left: at(mid) }} title={`Middle ${money(mid)}`} />
        <div className="absolute -top-1 h-4.5 w-4.5 -ml-2 rounded-full border-2 border-white bg-[#1c1917] shadow" style={{ left: at(value) }} title={`Its value ${money(value)}`} />
      </div>
    </div>
  );
}

const changeText = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`);
const toneOf = (v: number | null): "gain" | "loss" | undefined => (v === null || v === 0 ? undefined : v > 0 ? "gain" : "loss");

function Key({ color, dashed, label }: { color: string; dashed?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[#78716c]">
      <span className="w-4 border-t-2" style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} />
      {label}
    </span>
  );
}

/**
 * The zone's middle sale price and rent per m² over the semesters (its kind of building and state),
 * and how they moved: on the same half a year earlier, and on the semester before the latest.
 * The semesters needn't follow on: one without a quotation is left out.
 */
function Trend({ trend }: { trend: MarketTrend }) {
  const data = trend.points.map((p) => ({ label: `H${p.semester.half} ’${String(p.semester.year).slice(2)}`, sale: p.saleMid, rent: p.rentMid }));
  const hasRent = trend.points.some((p) => p.rentMid !== null);
  return (
    <Part
      title="Prices over time"
      sub={`${trend.buildingType}, ${trend.state.toLowerCase()}`}
      right={(
        <div className="flex gap-4">
          <Key color={SALE_COLOR} label="Sale €/m² (left)" />
          {hasRent && <Key color={RENT_COLOR} dashed label="Rent €/m² a month (right)" />}
        </div>
      )}
    >
      <Figs>
        <Fig label="Sale, on the year" value={changeText(trend.saleChangeYearPct)} tone={toneOf(trend.saleChangeYearPct)} />
        <Fig label="Sale, on the semester" value={changeText(trend.saleChangeSemesterPct)} tone={toneOf(trend.saleChangeSemesterPct)} />
        {hasRent && <Fig label="Rent, on the year" value={changeText(trend.rentChangeYearPct)} tone={toneOf(trend.rentChangeYearPct)} />}
        {hasRent && <Fig label="Rent, on the semester" value={changeText(trend.rentChangeSemesterPct)} tone={toneOf(trend.rentChangeSemesterPct)} />}
      </Figs>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 192 }}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            {/* Kept clear of the Y axes' lowest ticks, in the corners they share. */}
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} padding={{ left: 12, right: hasRent ? 12 : 0 }} />
            <YAxis yAxisId="sale" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} width={56} domain={["auto", "auto"]} tickFormatter={(v) => `€${Number(v).toLocaleString("en-US")}`} />
            {hasRent && <YAxis yAxisId="rent" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} width={44} domain={["auto", "auto"]} tickFormatter={(v) => `€${v}`} />}
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v, name) => (name === "sale" ? [`€${Number(v).toLocaleString("en-US")}/m²`, "Sale, middle"] : [`€${Number(v).toFixed(1)}/m² a month`, "Rent, middle"])}
            />
            <Line yAxisId="sale" type="monotone" dataKey="sale" stroke={SALE_COLOR} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
            {hasRent && <Line yAxisId="rent" type="monotone" dataKey="rent" stroke={RENT_COLOR} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Part>
  );
}

/** Every kind of building the zone quotes, folded: the property's own in bold. */
function ZoneQuotations({ quotations, quotation }: { quotations: MarketQuotation[]; quotation: MarketQuotation | null }) {
  const [open, setOpen] = useState(false);
  const own = (q: MarketQuotation) => q === quotation || (q.buildingTypeCode === quotation?.buildingTypeCode && q.state === quotation?.state);
  return (
    <div className="space-y-3 border-t border-[#EEE9DD] pt-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-[12.5px] font-bold text-[#1c1917] hover:text-[#8A6A28]">
        Every kind of building in the zone
        <span className="font-normal text-[#857e78]"> · {quotations.length}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-[#857e78]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#857e78]" />}
      </button>
      {open && (
        <div className="overflow-x-auto rounded-xl border border-[#EEE9DD]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-[#857e78] bg-[#F7F5EF]">
                <th className="px-3 py-2">Building</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2 text-right">Sale €/m²</th>
                <th className="px-3 py-2 text-right">Rent €/m² a month</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE9DD]">
              {quotations.map((q) => (
                <tr key={`${q.buildingTypeCode}:${q.state}`} className={own(q) ? "font-bold text-[#1c1917]" : "text-[#78716c]"}>
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
  );
}

const MARKET_SIZE_TEXT = "The Agenzia's ranking of the municipality's market by sales, from S to XXL.";
const salesText = (v: number) => Math.round(v).toLocaleString("en-US");
const salesChangeText = (v: number | null, year: number) => (v === null ? undefined : `${changeText(v)} on ${year - 1}`);

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
  const homes = latest.residentialTransactions === null ? "—" : salesText(latest.residentialTransactions);
  return (
    <Part
      title="Sales in the municipality"
      sub={String(latest.year)}
      right={chip && (
        <span title={sales.marketSize ? MARKET_SIZE_TEXT : undefined} className="rounded-full bg-[#F6F1E6] px-2.5 py-0.5 text-[10.5px] font-bold text-[#8A6A28]">
          {chip}
        </span>
      )}
    >
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_260px] gap-x-6 gap-y-3 items-end">
        <Figs>
          {segment ? (
            <>
              <Fig label={`${segment}, sold`} value={salesText(latest.transactions!)} sub={salesChangeText(sales.changeYearPct, latest.year)} strong />
              <Fig label="All homes, sold" value={homes} sub={salesChangeText(sales.residentialChangeYearPct, latest.year)} />
            </>
          ) : (
            <Fig label="Homes, sold" value={homes} sub={salesChangeText(sales.residentialChangeYearPct, latest.year)} strong />
          )}
        </Figs>
        {bars.length > 1 && (
          <div className="h-20 w-full">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 260, height: 80 }}>
              <BarChart data={bars} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="year" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={6} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} formatter={(v) => [v === null ? "—" : salesText(Number(v)), "Sold"]} />
                <Bar dataKey="sold" fill={SALE_COLOR} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Part>
  );
}
