// components/dashboard/realEstate/RealEstateTaxes.tsx
"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { realEstateKey, useRealEstate, useRealEstateRead } from "../../../context/RealEstateContext";
import { CATEGORICAL_PALETTE } from "../../../lib/chartColors";
import { formatCompact, formatCurrency } from "../../../lib/format";
import { today } from "../../../lib/wallets";
import type { Property, TaxKind, TaxList } from "../../../models/RealEstate";
import { Breadcrumb, type Crumb } from "../Breadcrumb";
import { PAGE_HEAD, PageTitle } from "../PageHeader";
import { AXIS_TICK_COLOR, MODULE_BODY, Module, ModuleHead, TOOLTIP_STYLE } from "../PerformanceSection";
import { PropertiesTaxes, PropertiesYearGlance, type PropertyYearTaxes } from "../taxes/YearTaxes";

// The years the chart goes back at most: a request each (praedium's taxes are by year).
const MAX_YEARS = 10;

// The bars' series, in the palette's fixed order.
const KINDS: { kind: TaxKind; label: string; color: string }[] = [
  { kind: "property_tax", label: "Property tax", color: CATEGORICAL_PALETTE[0] },
  { kind: "rental_income_tax", label: "Tax on rents", color: CATEGORICAL_PALETTE[1] },
  { kind: "capital_gains_tax", label: "Tax on a sale", color: CATEGORICAL_PALETTE[2] },
];

const PROPERTY_TAX_INFO = "Every figure is an estimate on what's recorded: the rates, the rents and the payments. Open a property to see how its taxes are worked out.";

/** A year's taxes across the properties, the archived ones' too (the year one was sold): its key and read. */
const yearTaxes = (year: number) => ({
  key: ["taxes", "all", year, "archived"],
  read: (source: ReturnType<typeof useRealEstate>["source"]) => source.taxes(null, year, true),
});

/**
 * PROPERTY TAXES BY YEAR — Real estate's: what the properties' taxes came to each year, from the
 * first purchase's (the last MAX_YEARS at most), by kind (the property tax, the tax on rents, on a
 * sale), at the user's share. A year (its bar) opens its page (`onOpenYear`: RealEstateTaxesPage).
 * Shown only when some property has them (one in Italy).
 */
export function PropertyTaxesByYearModule({ properties, onOpenYear }: { properties: Property[]; onOpenYear: (year: number) => void }) {
  const { source, available } = useRealEstate();
  const current = Number(today().slice(0, 4));
  const taxed = properties.some((p) => p.address.country === "IT");
  const years = useMemo(() => {
    const first = properties.map((p) => p.purchasedOn?.slice(0, 4)).filter((y): y is string => !!y).map(Number).sort()[0] ?? current;
    const from = Math.max(first, current - MAX_YEARS + 1);
    return Array.from({ length: current - from + 1 }, (_, i) => from + i);
  }, [properties, current]);
  const reads = useQueries({
    queries: years.map((year) => {
      const { key, read } = yearTaxes(year);
      return { queryKey: realEstateKey(...key), queryFn: () => read(source), enabled: available && taxed };
    }),
  });
  if (!taxed) return null;

  const loading = reads.some((r) => r.isPending);
  const failed = reads.some((r) => r.isError);
  const rows = years.map((year, i) => {
    const taxes = (reads[i].data as TaxList | undefined)?.taxes.filter((t) => t.status === "computed") ?? [];
    return { year, ...Object.fromEntries(KINDS.map((k) => [k.label, taxes.filter((t) => t.kind === k.kind).reduce((s, t) => s + t.amount, 0)])) } as Record<string, number>;
  });
  const series = KINDS.filter((k) => rows.some((r) => r[k.label] > 0));
  const money = (v: number) => formatCurrency(v, "EUR", 0);

  return (
    <Module>
      <ModuleHead title="Taxes by year" desc="What the properties' taxes came to each year, at your share. A year opens its detail." />
      <div className={MODULE_BODY}>
        {loading ? (
          <p className="text-[12.5px] text-[#857e78]">Loading…</p>
        ) : failed ? (
          <p className="text-[12.5px] text-rose-600">Unable to work out the taxes right now.</p>
        ) : series.length === 0 ? (
          <p className="text-[12.5px] text-[#857e78]">No property tax in any year so far.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 224 }}>
              <BarChart
                data={rows}
                margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                onClick={(s) => {
                  const row = rows[Number(s?.activeIndex)];
                  if (row) onOpenYear(row.year);
                }}
                style={{ cursor: "pointer" }}
              >
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: "#f8fafc" }}
                  labelFormatter={(y) => (Number(y) === current ? `${y} so far` : String(y))}
                  formatter={(v, n) => [money(Number(v)), n]}
                />
                {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                {series.map((s, i) => (
                  <Bar
                    key={s.kind}
                    dataKey={s.label}
                    stackId="t"
                    fill={s.color}
                    radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
                    maxBarSize={40}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Module>
  );
}

/**
 * REAL ESTATE'S YEAR OF TAXES — Real estate › Taxes › a year: the properties' taxes that year (the
 * archived ones' too, in the year one was sold): what they come to, what's paid and left, the
 * instalments by due day, then each property's taxes, each opening its page (`onOpenProperty`,
 * where they're worked out and paid). Opened from the taxes by year or this year's taxes.
 */
export function RealEstateTaxesPage({ year, trail, properties, onOpenProperty }: {
  year: number;
  trail: Crumb[];
  properties: Property[];
  onOpenProperty: (uuid: string) => void;
}) {
  const { key, read } = yearTaxes(year);
  const list = useRealEstateRead<TaxList>(key, read);
  const byUuid = new Map(properties.map((p) => [p.uuid, p]));
  // Each property once, its taxes under it, in the list's order.
  const grouped: PropertyYearTaxes[] = [...new Set((list?.taxes ?? []).map((t) => t.propertyUuid))].map((uuid) => ({
    propertyUuid: uuid,
    name: byUuid.get(uuid)?.name ?? "A property",
    taxes: list!.taxes.filter((t) => t.propertyUuid === uuid),
  }));

  return (
    <div className="space-y-6 pb-12">
      <div className={PAGE_HEAD}>
        <Breadcrumb trail={trail} current="Taxes" after={<span className="tabular-nums">{year}</span>} />
        <PageTitle title={`Property taxes ${year}`} info={PROPERTY_TAX_INFO} />
      </div>
      {list === undefined ? (
        <Module><div className={`${MODULE_BODY} pt-[22px]`}><p className="text-[12.5px] text-[#857e78]">Loading…</p></div></Module>
      ) : list === null ? (
        <Module><div className={`${MODULE_BODY} pt-[22px]`}><p className="text-[12.5px] text-rose-600">Unable to work out the taxes right now.</p></div></Module>
      ) : grouped.length === 0 ? (
        <Module><div className={`${MODULE_BODY} pt-[22px]`}><p className="text-[12.5px] text-[#857e78]">No property tax in {year}.</p></div></Module>
      ) : (
        <>
          <PropertiesYearGlance year={year} properties={grouped} onOpenProperty={onOpenProperty} />
          <PropertiesTaxes year={year} properties={grouped} onOpenProperty={onOpenProperty} />
        </>
      )}
    </div>
  );
}
