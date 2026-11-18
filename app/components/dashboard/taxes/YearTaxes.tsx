// components/dashboard/taxes/YearTaxes.tsx
"use client";

import { CalendarClock, ChevronRight } from "lucide-react";
import { formatCurrency } from "../../../lib/format";
import { NOT_COMPUTED_TEXT } from "../../../lib/realEstate";
import { dayLabel, today } from "../../../lib/wallets";
import type { PropertyTax } from "../../../models/RealEstate";
import type { TaxYear } from "../../../models/Tax";
import { Fig, Figs, MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

/**
 * THE YEAR AT A GLANCE (the investments') — the Taxes page's top: the year's taxes on the
 * investments altogether, what goes in the tax return (on the gains and the income), what the
 * brokers withhold, and the losses carried to the years after.
 */
export function InvestmentsYearGlance({ data }: { data: TaxYear }) {
  const money = (v: number) => formatCurrency(v, data.currency, 0);
  return (
    <Module>
      <ModuleHead title="The year at a glance" desc="The year's taxes on your investments." />
      <div className={MODULE_BODY}>
        <Figs spread>
          <Fig label="Total" strong value={money(data.tax + data.incomeTax + data.withheldTax)} info="Every tax of the year on the investments: the tax return's and what the brokers withhold." />
          <Fig label="To declare" value={money(data.tax + data.incomeTax)} info="What the declared portfolios' gains and income owe, to put in the tax return." />
          <Fig label="Withheld by brokers" value={money(data.withheldTax)} info="What the withheld portfolios' brokers take, at source." />
          <Fig label="Losses carried forward" value={money(sum(data.carriedLosses.map((l) => l.amount)))} info="The losses left to offset in the years after, the tax return's and each broker's." />
        </Figs>
      </div>
    </Module>
  );
}

// A year's taxes of one property, as Real estate's year of taxes lists them.
export interface PropertyYearTaxes {
  propertyUuid: string;
  name: string;
  taxes: PropertyTax[];
}

/**
 * THE YEAR AT A GLANCE (the properties') — Real estate's year of taxes: what the properties' taxes
 * come to (at the user's share), what's paid of them (the platforms' withholding counting as paid)
 * and what's left; then the instalments by due day, paid, overdue or to come, each opening its
 * property (`onOpenProperty`, where it's paid). In euro: the taxes are Italy's.
 */
export function PropertiesYearGlance({ year, properties, onOpenProperty }: {
  year: number;
  properties: PropertyYearTaxes[];
  onOpenProperty?: (uuid: string) => void;
}) {
  const now = today();
  const taxes = properties.flatMap((p) => p.taxes.filter((t) => t.status === "computed"));
  const currency = taxes[0]?.currency ?? "EUR";
  const money = (v: number) => formatCurrency(v, currency, 0);
  const owed = sum(taxes.map((t) => t.amount));
  const paid = sum(taxes.map((t) => Math.min(t.paidAmount + t.withheldAmount, t.amount)));
  const nameOf = new Map(properties.map((p) => [p.propertyUuid, p.name]));
  const instalments = taxes
    .flatMap((t) => t.instalments.filter((i) => i.amount > 0).map((i) => ({ ...i, tax: t })))
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));

  return (
    <Module>
      <ModuleHead title="The year at a glance" desc={`The properties' taxes in ${year}, at your share.`} />
      <div className={`${MODULE_BODY} space-y-5`}>
        <Figs spread>
          <Fig label="Total" strong value={money(owed)} info="IMU, the tax on rents and on a sale's gain, at your share." />
          <Fig label="Paid" value={money(paid)} info="What the payments recorded for the year cover, with what the platforms withheld." />
          <Fig label="Left to pay" value={money(Math.max(0, owed - paid))} />
        </Figs>
        {instalments.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[13px] font-bold text-[#1c1917]">
              <CalendarClock className="h-4 w-4 text-[#C49A3C]" /> Due days
            </p>
            <ul className="divide-y divide-[#EEE9DD]">
              {instalments.map((i) => {
                const overdue = !i.paid && i.dueOn < now;
                const state = i.paid ? "Paid" : overdue ? "Overdue" : "To pay";
                const name = nameOf.get(i.tax.propertyUuid) ?? "A property";
                return (
                  <li key={`${i.tax.propertyUuid}:${i.tax.kind}:${i.number}`} className="flex items-center gap-3 py-2.5">
                    <span className="w-24 shrink-0 text-[12.5px] font-bold tabular-nums text-[#1c1917]">{dayLabel(i.dueOn)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-[#1c1917] truncate">{i.tax.name} · instalment {i.number}</span>
                      {onOpenProperty ? (
                        <button type="button" onClick={() => onOpenProperty(i.tax.propertyUuid)} className="text-[11.5px] font-bold text-[#8A6A28] hover:text-[#C49A3C]">
                          {name}
                        </button>
                      ) : (
                        <span className="block text-[11.5px] text-[#78716c]">{name}</span>
                      )}
                    </span>
                    <span className="text-[13px] font-bold tabular-nums text-[#1c1917]">{formatCurrency(i.amount, i.tax.currency, 0)}</span>
                    <span className={`w-16 text-right text-[10px] font-black uppercase tracking-wider ${i.paid ? "text-emerald-700" : overdue ? "text-rose-600" : "text-[#857e78]"}`}>
                      {state}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Module>
  );
}

const statusText = (t: PropertyTax) => {
  if (t.status === "exempt") return "Exempt";
  if (t.status === "not_computed") return t.notComputed ? NOT_COMPUTED_TEXT[t.notComputed] : "Not computed.";
  const parts = [t.paidAmount >= t.amount && t.amount > 0 ? "Paid" : t.paidAmount > 0 ? `${formatCurrency(t.paidAmount, t.currency, 0)} paid` : null];
  if (t.withheldAmount > 0) parts.push(`${formatCurrency(t.withheldAmount, t.currency, 0)} withheld`);
  if (t.credit > 0) parts.push(`${formatCurrency(t.credit, t.currency, 0)} credit`);
  if (t.provisional) parts.push("estimate");
  return parts.filter(Boolean).join(" · ");
};

/**
 * THE PROPERTIES — each property with a tax in the year (an archived one's too, in the year it
 * was sold), its taxes with what they come to and their state; a property opens its page, where
 * they're worked out and paid.
 */
export function PropertiesTaxes({ year, properties, onOpenProperty }: {
  year: number;
  properties: PropertyYearTaxes[];
  onOpenProperty?: (uuid: string) => void;
}) {
  return (
    <Module>
      <ModuleHead title={`Property taxes ${year}`} desc="IMU, the tax on rents and on a sale's gain, at your share. Open a property to see how they're worked out." />
      <div className={`${MODULE_BODY} space-y-4`}>
        {properties.map((p) => (
          <div key={p.propertyUuid} className="space-y-1.5">
            {onOpenProperty ? (
              <button type="button" onClick={() => onOpenProperty(p.propertyUuid)} className="group flex items-center gap-1 text-sm font-bold text-[#1c1917] hover:text-[#C49A3C]">
                {p.name} <ChevronRight className="h-3.5 w-3.5 text-[#857e78] group-hover:text-[#C49A3C]" />
              </button>
            ) : (
              <p className="text-sm font-bold text-[#1c1917]">{p.name}</p>
            )}
            <ul className="divide-y divide-[#EEE9DD]">
              {p.taxes.map((t) => (
                <li key={t.kind} className="flex items-baseline gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-[#1c1917]">{t.name}</span>
                    <span className={`block text-[11.5px] ${t.status === "not_computed" ? "text-amber-700" : "text-[#78716c]"}`}>{statusText(t)}</span>
                  </span>
                  <span className="text-[13px] font-bold tabular-nums text-[#1c1917]">
                    {t.status === "computed" ? formatCurrency(t.amount, t.currency, 0) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Module>
  );
}
