// components/preview/RealEstatePortfolio.tsx
"use client";

import { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceDot, Legend, CartesianGrid, ComposedChart,
} from "recharts";
import { Building2, Download, FileSearch, FileText, Home, MapPin, Sparkles } from "lucide-react";
import { Breadcrumb, type Crumb } from "../dashboard/Breadcrumb";
import { formatCompact, formatCurrency } from "../../lib/format";
import { CATEGORICAL_PALETTE } from "../../lib/chartColors";
import {
  PROPERTIES, ZONES, QUARTERS, REAL_ESTATE_REPORTS, zoneById, zoneMarketTrend, zoneNow, zoneYoY, zoneGrossYield,
  propertyValue, shortTermAnalysis,
  type Property, type RealEstateReport,
} from "../../lib/mock/realEstate";
import { AXIS_TICK, ComingSoonButton, Panel, Pills, PreviewBadge, PreviewBanner, Stat, TOOLTIP_STYLE, formatPct, serif } from "./PreviewKit";

const eur = (v: number) => formatCurrency(v, "EUR", 0);
const GOLD = "#C49A3C";

export type RealEstatePreviewPage = "reports";

const PAGE_LABELS: Record<RealEstatePreviewPage, string> = {
  reports: "Reports",
};

/**
 * REAL ESTATE PAGES (preview) — the real estate's pages the API doesn't have yet, a demo account's
 * only, opened from the real estate's own page (dashboard/realEstate/RealEstateNode): Reports.
 * `trail` leads up to Wealth; "Real estate" is added to it. Everything comes from
 * lib/mock/realEstate.
 */
export function RealEstatePortfolio({
  trail, page, onOpenHome,
}: { trail: Crumb[]; page: RealEstatePreviewPage; onOpenHome: () => void }) {
  const pageTrail = [...trail, { label: "Real estate", onClick: onOpenHome }];
  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={pageTrail} current={PAGE_LABELS[page]} right={pageAction(page)} />
      {page === "reports" && <RealEstateReports />}
    </div>
  );
}

function pageAction(page: RealEstatePreviewPage) {
  switch (page) {
    case "reports":
      return <ComingSoonButton icon={<FileText className="h-3.5 w-3.5" />}>Generate report</ComingSoonButton>;
  }
}

/**
 * REAL ESTATE MARKET (preview) — under a demo account's real estate Insights: for the sample
 * property picked, the market of its neighbourhood (price trend against the city, rents in the
 * nearby zones) and how it would do as a short-term rental (a 0–100 score, its seasonality, the
 * income against a long-term lease), then the analyses on the roadmap. Market and rental figures
 * are invented (lib/mock/realEstate). `propertyId`: the sample property to open on.
 */
export function RealEstateMarketPreview({ propertyId }: { propertyId?: string }) {
  const [selectedId, setSelectedId] = useState(PROPERTIES.some((p) => p.id === propertyId) ? propertyId! : PROPERTIES[0].id);
  const selected = PROPERTIES.find((p) => p.id === selectedId)!;

  return (
    <>
      <div className="space-y-4">
        <PreviewBanner feature="Market and short-stay analyses">
          What the market around each property and short stays would mean for it, on invented figures: not available yet.
        </PreviewBanner>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C]">Property analysis</p>
            <h2 className="text-2xl font-black text-slate-900" style={serif}>{selected.name}</h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {selected.address}, {zoneById(selected.zoneId).name} · {selected.city}
            </p>
          </div>
          <Pills options={PROPERTIES.map((p) => ({ value: p.id, label: p.name }))} value={selectedId} onChange={setSelectedId} />
        </div>
        <MarketTrend property={selected} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ZoneSnapshot property={selected} />
          <RentByZone property={selected} />
        </div>
        <ShortTermRental property={selected} />
      </div>
      <Roadmap />
    </>
  );
}

function MarketTrend({ property }: { property: Property }) {
  const zone = zoneById(property.zoneId);
  const data = useMemo(() => zoneMarketTrend(zone), [zone]);
  const [y, m] = property.purchaseDate.split("-").map(Number);
  const purchaseQuarter = QUARTERS[(y - 2019) * 4 + Math.floor((m - 1) / 3)];
  const paidPerSqm = Math.round(property.purchasePrice / property.sqm);

  return (
    <Panel
      title={`Market trend · ${zone.name} vs ${zone.city}`}
      subtitle="Asking price per m², quarterly. The dot is what was paid per m²."
      right={<span className="text-sm font-black tabular-nums"><span className={zoneYoY(zone) >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatPct(zoneYoY(zone))}</span> <span className="text-slate-400 text-xs font-semibold">last 12 months</span></span>}
    >
      <div className="p-4 md:p-6 h-72">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 280 }}>
          <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="quarter" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis tickFormatter={formatCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} domain={["auto", "auto"]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [`${eur(Number(v))}/m²`, name === "zone" ? zone.name : `${zone.city} average`]} />
            <Legend formatter={(v) => (v === "zone" ? zone.name : `${zone.city} average`)} wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine x={purchaseQuarter} stroke="#cbd5e1" strokeDasharray="3 3" label={{ value: "Bought", position: "insideTopLeft", fontSize: 11, fill: "#64748b" }} />
            <Line type="monotone" dataKey="city" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="zone" stroke={CATEGORICAL_PALETTE[0]} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <ReferenceDot x={purchaseQuarter} y={paidPerSqm} r={5} fill={GOLD} stroke="#fff" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function ZoneSnapshot({ property }: { property: Property }) {
  const zone = zoneById(property.zoneId);
  const now = zoneNow(zone);
  const value = propertyValue(property);
  const marketRent = zone.rentPerSqm * property.sqm;
  return (
    <Panel title={`${zone.name} at a glance`} subtitle="Neighbourhood figures, this quarter.">
      <div className="p-6 md:p-7 grid grid-cols-2 gap-x-6 gap-y-5">
        <Stat label="Price / m²" value={eur(now)} note={`${formatPct(zoneYoY(zone))} YoY`} />
        <Stat label="Your value / m²" value={eur(value / property.sqm)} note={`${formatPct((value / property.sqm / now - 1) * 100)} vs zone`} />
        <Stat label="Rent / m² / mo" value={formatCurrency(zone.rentPerSqm, "EUR", 1)} />
        <Stat label="Gross yield (zone)" value={`${zoneGrossYield(zone).toFixed(1)}%`} />
        <Stat label="Vacancy" value={`${zone.vacancyPct.toFixed(1)}%`} />
        <Stat label="Days on market" value={`${zone.daysOnMarket}`} />
        {property.monthlyRent > 0 && (
          <div className="col-span-2 rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-600">
              Rent collected <span className="font-black text-slate-900">{eur(property.monthlyRent)}</span> vs market{" "}
              <span className="font-black text-slate-900">{eur(marketRent)}</span>{" "}
              <span className={property.monthlyRent >= marketRent ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                ({formatPct((property.monthlyRent / marketRent - 1) * 100)})
              </span>
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}

function RentByZone({ property }: { property: Property }) {
  const data = ZONES.filter((z) => z.city === property.city).map((z) => ({ name: z.name, rent: z.rentPerSqm, yield: zoneGrossYield(z), id: z.id }));
  return (
    <Panel title={`Rents across ${property.city}`} subtitle="Long-term rent per m² per month, by neighbourhood.">
      <div className="p-4 md:p-6 h-64">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 240 }}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} />
            <YAxis type="category" dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} width={110} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} formatter={(v, _n, item) => [`€${Number(v).toFixed(1)}/m² · ${(item.payload as { yield: number }).yield.toFixed(1)}% yield`, "Rent"]} />
            <Bar dataKey="rent" radius={[0, 6, 6, 0]} maxBarSize={22} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.id} fill={d.id === property.zoneId ? GOLD : "#cbd5e1"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = score >= 70 ? "#10b981" : score >= 55 ? GOLD : score >= 40 ? "#f59e0b" : "#f43f5e";
  return (
    <svg viewBox="0 0 128 128" className="w-36 h-36" role="img" aria-label={`Score ${score} out of 100`}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
      <circle
        cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 64 64)"
      />
      <text x="64" y="62" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 30, fontWeight: 900, ...serif }}>{score}</text>
      <text x="64" y="82" textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}>/ 100</text>
    </svg>
  );
}

function ShortTermRental({ property }: { property: Property }) {
  const st = useMemo(() => shortTermAnalysis(property), [property]);
  const zone = zoneById(property.zoneId);

  return (
    <Panel
      title="Short-term rental potential"
      subtitle="Would it earn more on Airbnb-style short stays than on a long-term lease?"
      right={<PreviewBadge label="Sample model" />}
    >
      {!st.eligible ? (
        <div className="p-6 md:p-7 flex items-center gap-6">
          <ScoreRing score={st.score} />
          <p className="text-sm text-slate-600 max-w-md">
            A {property.type.toLowerCase()} can&apos;t host guests, so short stays aren&apos;t an option here. Its long-term rent
            of <span className="font-bold text-slate-900">{eur(property.monthlyRent)}</span> a month is the income to track.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          <div className="p-6 md:p-7 grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-8 items-center">
            <div className="flex flex-col items-center gap-2">
              <ScoreRing score={st.score} />
              <span className="text-sm font-black text-slate-900">{st.verdict}</span>
            </div>
            <div className="space-y-3">
              {st.factors.map((f) => (
                <div key={f.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-bold text-slate-700">{f.label}</span>
                    <span className="text-xs font-black tabular-nums text-slate-900">{f.score}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${f.score}%`, background: f.score >= 70 ? "#10b981" : f.score >= 45 ? GOLD : "#f43f5e" }} />
                  </div>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{f.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 md:p-7 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
            <Stat label="Nightly rate" value={eur(st.adr)} note={`${zone.name} average, sized to ${property.rooms} rooms`} />
            <Stat label="Occupancy" value={`${st.occupancyPct}%`} note={`Break-even ${st.breakEvenOccupancyPct.toFixed(0)}%`} />
            <Stat label="Short stays, net / yr" value={eur(st.netYearly)} tone={st.netYearly >= st.longTermNetYearly ? "gain" : "loss"} note="After fees, cleaning, 26% tax" />
            <Stat label="Long lease, net / yr" value={eur(st.longTermNetYearly)} note="After 5% vacancy, 21% flat tax" />
          </div>

          <div className="p-4 md:p-6 h-64">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 240 }}>
              <ComposedChart data={st.monthly} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis yAxisId="rev" tickFormatter={formatCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
                <YAxis yAxisId="occ" orientation="right" tickFormatter={(v) => `${v}%`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} domain={[0, 100]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} formatter={(v, name) => (name === "revenue" ? [eur(Number(v)), "Gross revenue"] : [`${v}%`, "Occupancy"])} />
                <Legend formatter={(v) => (v === "revenue" ? "Gross revenue" : "Occupancy")} wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine yAxisId="rev" y={(st.longTermNetYearly / 12)} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "Long lease, net", position: "insideTopRight", fontSize: 11, fill: "#64748b" }} />
                <Bar yAxisId="rev" dataKey="revenue" fill={CATEGORICAL_PALETTE[4]} radius={[6, 6, 0, 0]} maxBarSize={32} isAnimationActive={false} />
                <Line yAxisId="occ" dataKey="occupancyPct" stroke={GOLD} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Panel>
  );
}

const REPORT_STYLE: Record<RealEstateReport["kind"], string> = {
  Quarterly: "bg-blue-50 text-blue-700",
  Tax: "bg-amber-50 text-amber-700",
  Valuation: "bg-emerald-50 text-emerald-700",
  "Short-term": "bg-violet-50 text-violet-700",
};

function RealEstateReports() {
  return (
    <>
      <PreviewBanner feature="Real estate reports" />
      <Panel title="Reports" subtitle="Made every quarter, plus valuations and tax summaries when they fall due.">
        <ul className="divide-y divide-slate-100">
          {REAL_ESTATE_REPORTS.map((r) => (
            <li key={r.id} className="px-6 md:px-7 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-[#C49A3C]/10 text-[#C49A3C] flex items-center justify-center shrink-0"><FileText className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="text-[13px] font-black text-slate-900 truncate">
                    {r.title}
                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider align-middle ${REPORT_STYLE[r.kind]}`}>{r.kind}</span>
                  </p>
                  <p className="text-[11px] font-semibold text-slate-400 truncate">
                    {new Date(r.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })} · {r.detail}
                  </p>
                </div>
              </div>
              <button type="button" disabled title="Coming soon" className="p-2.5 rounded-xl border border-slate-200 text-slate-300 cursor-not-allowed shrink-0">
                <Download className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function Roadmap() {
  const items = [
    { icon: <FileSearch className="h-4 w-4" />, title: "Valuation from comparables", text: "Estimate each property from recent sales of similar homes nearby, not just the zone index." },
    { icon: <Home className="h-4 w-4" />, title: "Renovation ROI", text: "What an energy-class upgrade adds to value and rent, net of incentives." },
    { icon: <Building2 className="h-4 w-4" />, title: "Real estate next to securities", text: "Property value and equity counted in the Dashboard's net worth and in Compare." },
    { icon: <Sparkles className="h-4 w-4" />, title: "AI deal check", text: "Paste a listing: fair price, expected yield and short-stay score before you buy." },
  ];
  return (
    <Panel title="On the roadmap" subtitle="Analyses planned for real estate.">
      <div className="p-6 md:p-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <div key={it.title} className="rounded-2xl border border-dashed border-slate-200 p-4">
            <span className="w-8 h-8 rounded-lg bg-[#C49A3C]/10 text-[#C49A3C] flex items-center justify-center">{it.icon}</span>
            <p className="text-sm font-black text-slate-900 mt-3">{it.title}</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{it.text}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
