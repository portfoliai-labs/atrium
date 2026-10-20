// components/dashboard/realEstate/SaleTax.tsx
"use client";

import { useEffect, useState } from "react";
import { Calculator, Loader2 } from "lucide-react";
import { useRealEstate } from "../../../context/RealEstateContext";
import { formatCurrency } from "../../../lib/format";
import { fieldErrorText, fieldLabel, NOT_COMPUTED_TEXT } from "../../../lib/realEstate";
import { dayLabel, monthName, today } from "../../../lib/wallets";
import type { Property, PropertyTax, SaleSimulationRequest, TaxRegime } from "../../../models/RealEstate";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { Field, INPUT, parseAmount } from "../wallets/WalletDialogs";

/**
 * A sale's tax were the property sold so (POST .../sale-simulation; the demo's sample otherwise),
 * asked again a moment after the request stops changing: undefined while it's worked out, null with
 * no rules for the property's country; `error` the API's refusal (a day before the acquisition).
 */
export function useSaleSimulation(propertyUuid: string | undefined, request: SaleSimulationRequest | null) {
  const { source } = useRealEstate();
  const key = request && propertyUuid ? JSON.stringify([propertyUuid, request]) : null;
  const [state, setState] = useState<{ key: string; tax: PropertyTax | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!key || !propertyUuid || !request) return;
    let cancelled = false;
    const t = setTimeout(() => {
      source.simulateSale(propertyUuid, request)
        .then((tax) => { if (!cancelled) setState({ key, tax, error: null }); })
        .catch((err) => { if (!cancelled) setState({ key, tax: null, error: fieldErrorText(err, "Unable to work out the tax on this sale.") }); });
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
    // `request` is identified by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, source]);
  if (!key) return { tax: undefined, error: null };
  return state?.key === key ? { tax: state.tax, error: state.error } : { tax: undefined, error: null };
}

const EXEMPT_TEXT: Record<string, string> = {
  inherited: "Inherited: a sale's gain is never taxed.",
  primary_residence: "Your primary residence for most of the time held: the gain isn't taxed.",
  outside_window: "Held long enough: the gain isn't taxed.",
};

/**
 * A sale's tax, told plainly: whether the gain is taxed and why, what it comes to under the regime
 * picked and under the other, how the gain is made up (price, costs, purchase — revalued by ISTAT's
 * FOI index when due —, works), and until when a sale is taxed at all. An estimate while the sale
 * month's index isn't out, or when the purchase is too old to revalue.
 */
export function SaleTaxSummary({ tax, currency }: { tax: PropertyTax; currency: string }) {
  const money = (v: number) => formatCurrency(v, currency, 0);
  const g = tax.capitalGain;
  const period = tax.periods[0];
  const flat = period?.regime !== "ordinary";
  const other = period?.alternativeAmount ?? null;
  const revaluation = g?.costRevaluation ?? null;

  if (tax.status === "not_computed") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1 text-[12.5px] text-amber-800">
        <p className="font-semibold">{tax.notComputed ? NOT_COMPUTED_TEXT[tax.notComputed] : "Not computed."}</p>
        {tax.missingFields.length > 0 && <p>Missing: {tax.missingFields.map(fieldLabel).join(", ")}.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tax.status === "computed" && g && g.gain <= 0 ? (
        <p className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-[13px] font-semibold text-slate-700">
          No tax: the sale makes {g.gain < 0 ? `a loss of ${money(-g.gain)}` : "no gain"}.
        </p>
      ) : tax.status === "exempt" ? (
        <p className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-[13px] font-semibold text-emerald-800">
          {EXEMPT_TEXT[period?.rateClass ?? ""] ?? "The gain isn't taxed."}
          {g && g.gain > 0 && ` A gain of ${money(g.gain)}, free of tax.`}
        </p>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-[24px] font-bold text-[#1c1917] tabular-nums">{money(tax.amount)}</span>
          {tax.provisional && (
            <span
              className="px-2 py-0.5 rounded-full bg-amber-50 text-[10px] font-black uppercase tracking-wider text-amber-700"
              title={g?.costRevaluationDue && !revaluation ? "ISTAT's index isn't available for the purchase's month." : "The sale month's ISTAT index isn't out yet."}
            >
              Estimate
            </span>
          )}
          <span className="text-[12.5px] text-[#78716c]">
            {flat ? "26% substitute tax, paid at the deed via the notary" : `IRPEF with the ${tax.year + 1} return${period ? `, ${period.ratePct.toFixed(1)}% with the surcharges` : ""}`}
          </span>
        </div>
      )}
      {tax.status === "computed" && other !== null && !(g && g.gain <= 0) && (
        <p className={`text-[12.5px] font-semibold ${other >= tax.amount ? "text-emerald-700" : "text-amber-700"}`}>
          {flat ? "With IRPEF" : "At the deed (26%)"} it would be {money(other)}
          {other > tax.amount ? `: this way saves you ${money(other - tax.amount)}` : other < tax.amount ? `: ${money(tax.amount - other)} less, worth considering` : ": the same"}
        </p>
      )}
      {tax.status === "computed" && other === null && flat && !(g && g.gain <= 0) && (
        <p className="text-[11.5px] text-[#857e78]">Add your tax details for the year to compare it with IRPEF.</p>
      )}
      {g && (
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-[12.5px] rounded-xl bg-[#F7F5EF] px-4 py-3">
          <dt className="text-slate-500">Sale price</dt><dd className="text-right tabular-nums">{money(g.salePrice)}</dd>
          {g.saleCosts > 0 && <><dt className="text-slate-500">Sale costs</dt><dd className="text-right tabular-nums">−{money(g.saleCosts)}</dd></>}
          {revaluation ? (
            <>
              <dt className="text-slate-500">
                What it cost, revalued
                <span className="block text-[11px] text-slate-400">
                  {money(g.acquisitionCost)} × {revaluation.factor.toFixed(3)} by ISTAT&apos;s FOI index, {monthName(revaluation.fromMonth.slice(0, 7))} to {monthName(revaluation.toMonth.slice(0, 7))}
                </span>
              </dt>
              <dd className="text-right tabular-nums">−{money(revaluation.revaluedCost)}</dd>
            </>
          ) : (
            <><dt className="text-slate-500">What it cost</dt><dd className="text-right tabular-nums">−{money(g.acquisitionCost)}</dd></>
          )}
          {g.acquisitionCosts > 0 && <><dt className="text-slate-500">Its purchase costs</dt><dd className="text-right tabular-nums">−{money(g.acquisitionCosts)}</dd></>}
          {g.works > 0 && <><dt className="text-slate-500">Works</dt><dd className="text-right tabular-nums">−{money(g.works)}</dd></>}
          {g.worksExcluded > 0 && <><dt className="text-slate-500">Works not counted (Superbonus)</dt><dd className="text-right tabular-nums text-slate-400">{money(g.worksExcluded)}</dd></>}
          <dt className="font-bold text-slate-800 border-t border-[#E0DACC] pt-1">{g.gain >= 0 ? "Gain" : "Loss"}</dt>
          <dd className={`text-right tabular-nums font-bold border-t border-[#E0DACC] pt-1 ${g.gain >= 0 ? "text-slate-900" : "text-rose-600"}`}>{money(g.gain)}</dd>
        </dl>
      )}
      {g?.taxedUntil && (
        <p className="text-[12px] text-slate-600">
          {g.soldOn <= g.taxedUntil
            ? <>A sale is taxed until <b>{dayLabel(g.taxedUntil)}</b>{g.rule === "superbonus" ? " (10 years from the end of Superbonus works)" : " (5 years from the purchase)"}: selling after that, the gain isn&apos;t.</>
            : <>Sales were taxed until {dayLabel(g.taxedUntil)}.</>}
        </p>
      )}
      {g?.costRevaluationDue && !revaluation && (
        <p className="text-[11px] text-amber-700">The purchase can&apos;t be revalued: ISTAT&apos;s index isn&apos;t available for its month. The gain shown is overestimated.</p>
      )}
      {revaluation && g && revaluation.toMonth.slice(0, 7) < g.soldOn.slice(0, 7) && (
        <p className="text-[11px] text-[#857e78]">The sale month&apos;s index isn&apos;t out yet: revalued to {monthName(revaluation.toMonth.slice(0, 7))} for now.</p>
      )}
    </div>
  );
}

/**
 * IF YOU SOLD IT — a property's sale simulated on its page: a day (today), a price (its value at
 * the user's share), an agency fee and how the gain would be taxed; the tax it would mean, worked
 * out by the API with nothing stored, and until when a sale is taxed at all.
 */
export function SaleSimulatorModule({ property }: { property: Property }) {
  const [soldOn, setSoldOn] = useState(today());
  const [price, setPrice] = useState(String(Math.round(property.figures.valueAtShare)));
  const [agency, setAgency] = useState("");
  const [regime, setRegime] = useState<TaxRegime>("flat_rate");
  const priceValue = parseAmount(price);
  const agencyValue = parseAmount(agency);
  const valid = !!soldOn && priceValue !== null && Number(priceValue) > 0 && (agency.trim() === "" || (agencyValue !== null && Number(agencyValue) >= 0));
  const request: SaleSimulationRequest | null = valid
    ? { soldOn, price: priceValue!, costs: agencyValue && Number(agencyValue) > 0 ? [{ kind: "agency", amount: agencyValue }] : [], regime }
    : null;
  const { tax, error } = useSaleSimulation(property.uuid, request);

  return (
    <Module>
      <ModuleHead
        title="If you sold it"
        desc="The tax a sale would mean, worked out on the day and price you pick. Nothing is recorded."
        icon={<Calculator className="h-3.5 w-3.5 text-[#78716c]" />}
      />
      <div className={`${MODULE_BODY} space-y-4`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Day"><input type="date" value={soldOn} onChange={(e) => setSoldOn(e.target.value)} className={INPUT} /></Field>
          <Field label={`Price (${property.currency})`}><input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={INPUT} /></Field>
          <Field label="Agency fee"><input value={agency} onChange={(e) => setAgency(e.target.value)} inputMode="decimal" placeholder="0" className={INPUT} /></Field>
          <Field label="Gain taxed">
            <select value={regime} onChange={(e) => setRegime(e.target.value as TaxRegime)} className={INPUT}>
              <option value="flat_rate">At the deed (26%)</option>
              <option value="ordinary">With IRPEF</option>
            </select>
          </Field>
        </div>
        {!request ? (
          <p className="text-[12.5px] text-[#857e78]">Pick a day and a price.</p>
        ) : error ? (
          <p className="text-[12.5px] text-rose-600">{error}</p>
        ) : tax === undefined ? (
          <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
        ) : tax === null ? (
          <p className="text-[12.5px] text-[#857e78]">No rules for a sale in this country.</p>
        ) : (
          <SaleTaxSummary tax={tax} currency={property.currency} />
        )}
      </div>
    </Module>
  );
}
