// components/dashboard/taxes/YearTaxes.tsx
"use client";

import { CalendarClock, ChevronRight } from "lucide-react";
import { formatCurrency } from "../../../lib/format";
import { NOT_COMPUTED_TEXT } from "../../../lib/realEstate";
import { dayLabel, today } from "../../../lib/wallets";
import type { PropertyTax } from "../../../models/RealEstate";
import type { YearTaxes } from "../../../models/Tax";
import { Fig, Figs, MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { WEALTH_TAX_LABEL } from "./WealthTaxes";

/**
 * THE YEAR AT A GLANCE — every tax of the year in each currency met (never converted): what the
 * tax return pays on the investments, what the brokers withhold, the properties' (what's paid of
 * them and what's left); then the properties' instalments by due day, paid, overdue or to come,
 * each opening its property (`onOpenProperty`, where it's paid).
 */
export function YearGlance({ data, onOpenProperty }: { data: YearTaxes; onOpenProperty?: (uuid: string) => void }) {
  const now = today();
  return (
    <Module>
      <ModuleHead
        title="The year at a glance"
        desc={data.propertiesIncluded ? "The investments', the holdings' and the properties' taxes, in each currency." : "The investments' taxes. The holdings' and the properties' are read by their owner only."}
      />
      <div className={`${MODULE_BODY} space-y-5`}>
        {data.totals.map((t) => {
          const money = (v: number) => formatCurrency(v, t.currency);
          return (
            <Figs key={t.currency} wide>
              <Fig className="col-span-full" label={data.totals.length > 1 ? `Total in ${t.currency}` : "Total"} value={money(t.total)} strong info="Every tax of the year: the tax return's on the investments and on holdings, what the brokers withhold and the properties'. The stamp duty the banks charge is apart." />
              <Fig label="Investments" value={money(t.investments)} info="What the declared portfolios' gains and income owe, to put in the tax return." />
              <Fig label="Withheld by brokers" value={money(t.withheld)} />
              {(t.wealth ?? 0) > 0 && (
                <Fig label="On holdings" value={money(t.wealth ?? 0)} info="IVAFE on accounts and investments abroad, the tax on crypto-assets, IVIE on properties abroad: paid with the tax return." />
              )}
              {(t.wealthWithheld ?? 0) > 0 && (
                <Fig label="Stamp duty" value={money(t.wealthWithheld ?? 0)} info="What Italian banks and brokers charge on your accounts and investments, estimated: they take it themselves, so it isn't in the total." />
              )}
              {data.propertiesIncluded && (
                <Fig
                  label="Properties"
                  value={money(t.properties)}
                  sub={t.properties > 0 ? (t.propertiesDue > 0 ? `${money(t.propertiesDue)} left to pay` : "All paid") : undefined}
                  info="IMU, the tax on rents and on a sale's gain, at your share."
                />
              )}
            </Figs>
          );
        })}
        {data.instalments.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[13px] font-bold text-[#1c1917]">
              <CalendarClock className="h-4 w-4 text-[#C49A3C]" /> Due days
            </p>
            <ul className="divide-y divide-[#EEE9DD]">
              {data.instalments.map((i) => {
                // A tax on holdings' payments aren't recorded: to pay, then past its day not
                // tracked (never overdue nor paid here).
                const onHoldings = Boolean(i.wealthKind);
                const overdue = !onHoldings && !i.paid && i.dueOn < now;
                const state = onHoldings ? (i.dueOn < now ? "Not tracked" : "To pay") : i.paid ? "Paid" : overdue ? "Overdue" : "To pay";
                const name = i.wealthKind ? WEALTH_TAX_LABEL[i.wealthKind] ?? i.taxName : i.taxName;
                return (
                  // On a phone: the day, the amount and the state on a line, the tax beneath.
                  <li key={`${i.propertyUuid ?? i.wealthKind}:${i.kind}:${i.number}`} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-0.5 py-2.5">
                    <span className="w-24 shrink-0 grow sm:grow-0 text-[12.5px] font-bold tabular-nums text-[#1c1917]">{dayLabel(i.dueOn)}</span>
                    <span className="min-w-0 basis-full sm:basis-auto sm:flex-1 order-last sm:order-none">
                      <span className="block text-[13px] font-semibold text-[#1c1917] truncate">{name} · instalment {i.number}</span>
                      {onHoldings ? (
                        <span className="block text-[11.5px] text-[#78716c]">Taxes on holdings{i.taxCode ? ` · F24 code ${i.taxCode}` : ""}</span>
                      ) : onOpenProperty && i.propertyUuid ? (
                        <button type="button" onClick={() => onOpenProperty(i.propertyUuid!)} className="text-[11.5px] font-bold text-[#8A6A28] hover:text-[#C49A3C]">
                          {i.propertyName}
                        </button>
                      ) : (
                        <span className="block text-[11.5px] text-[#78716c]">{i.propertyName}</span>
                      )}
                    </span>
                    <span className="text-[13px] font-bold tabular-nums text-[#1c1917]">{formatCurrency(i.amount, i.currency, 0)}</span>
                    <span className={`w-20 text-right text-[10px] font-black uppercase tracking-wider ${i.paid ? "text-emerald-700" : overdue ? "text-rose-600" : "text-[#857e78]"}`}>
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
export function PropertiesTaxes({ data, onOpenProperty }: { data: YearTaxes; onOpenProperty?: (uuid: string) => void }) {
  return (
    <Module>
      <ModuleHead title={`Property taxes ${data.year}`} desc="IMU, the tax on rents and on a sale's gain, at your share. Open a property to see how they're worked out." />
      <div className={`${MODULE_BODY} space-y-4`}>
        {data.properties.map((p) => (
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
