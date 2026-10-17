// components/dashboard/realEstate/PropertyPage.tsx
"use client";

import { useEffect, useState } from "react";
import { Archive, Calculator, ChevronDown, ChevronUp, Loader2, Trash2, X } from "lucide-react";
import { useRealEstate, useRealEstateSummary } from "../../../context/RealEstateContext";
import { realEstateService } from "../../../services/realEstateService";
import { formatCurrency } from "../../../lib/format";
import {
  FREQUENCY_LABELS, PROPERTY_KIND_LABELS, PROPERTY_USE_LABELS, RATE_INDEX_LABELS, VALUATION_SOURCE_LABELS, sqmToSqft,
} from "../../../lib/realEstate";
import { dayLabel, errorText, today } from "../../../lib/wallets";
import type { Mortgage, MortgageSchedule, Property, Valuation } from "../../../models/RealEstate";
import type { Crumb } from "../Breadcrumb";
import { Breadcrumb } from "../Breadcrumb";
import { ConfirmDialog } from "../ConfirmDialog";
import { PageHeader, type PageAction, type PageFigure } from "../PageHeader";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { DEMO_DISABLED_TITLE } from "../../preview/DemoBanner";
import { PreviewBadge } from "../../preview/PreviewKit";
import { MortgageMarketRates } from "../MarketRates";
import { CashFlowModule, ValueModule } from "./RealEstateNode";
import { MortgageDialog, PropertyEditDialog, RateChangeDialog, ValuationDialog } from "./PropertyDialogs";
import { RealEstateTransactionDialog, type TaxPaymentPrefill } from "./RealEstateTransactionForm";
import { PropertyTaxModule, PropertyUsesModule } from "./PropertyTaxes";
import { LeasesModule, TaxpayerYearDialog } from "./PropertyRentals";
import { SaleSimulatorModule } from "./SaleTax";
import { alertsCounter, useAlertRules } from "./RealEstateAlerts";
import { MortgageSimulatorDialog } from "./MortgageSimulator";
import { PropertyMarketModule } from "./PropertyMarket";

const ARCHIVED_TITLE = "An archived property is read only";
const pct = (v: number, digits = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
const toneOf = (v: number | null | undefined): "gain" | "loss" | undefined => (v == null || v === 0 ? undefined : v > 0 ? "gain" : "loss");

type Dialog = "transaction" | "valuation" | "mortgage" | "edit" | "archive" | "delete";

/**
 * PROPERTY PAGE — one property, under the real estate: a header with its value at the user's
 * share, how that stands against what was put in, its year in figures and what can be done with it
 * (a transaction, a valuation, a mortgage, its settings, archive, delete); under it its value since
 * the purchase and its last 12 months' cash flow, its taxes (Italy's IMU and the tax on its rents,
 * PropertyTaxModule), its leases, its zone's market (Italy's OMI, PropertyMarketModule), what a sale
 * would be taxed (SaleSimulatorModule), its mortgages (each with its schedule and rate changes, closed or
 * reopened, a prepayment or a refinancing simulated), its valuations, its use over time and its details. Its amounts are in its own
 * currency. An archived property, and a demo account's, are read only.
 */
export function PropertyPage({ property, trail, onOpenTransactions, onOpenAlerts, onOpenReports, onGone }: {
  property: Property;
  trail: Crumb[];
  onOpenTransactions: () => void;
  onOpenAlerts: () => void;
  onOpenReports: () => void;
  // After it's deleted.
  onGone: () => void;
}) {
  const { sample, changed, source, version } = useRealEstate();
  const summary = useRealEstateSummary(property.uuid, (property.purchasedOn ?? property.createdAt).slice(0, 7));
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [rateFor, setRateFor] = useState<Mortgage | null>(null);
  const [simulating, setSimulating] = useState<Mortgage | null>(null);
  const [taxPayment, setTaxPayment] = useState<TaxPaymentPrefill | null>(null);
  const [taxpayerYear, setTaxpayerYear] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const count = useTransactionCount(property.uuid);
  const alertRules = useAlertRules(property.uuid);

  const f = property.figures;
  const money = (v: number) => formatCurrency(v, property.currency, 0);
  const readOnly = sample || property.archived;
  const locked = sample ? { disabled: true, title: DEMO_DISABLED_TITLE } : property.archived ? { disabled: true, title: ARCHIVED_TITLE } : {};
  const sampleLock = sample ? { disabled: true, title: DEMO_DISABLED_TITLE } : {};
  const close = () => { setDialog(null); setDialogError(null); };
  const done = () => { close(); changed(); };

  const run = async (action: () => Promise<unknown>, fallback: string, after?: () => void) => {
    setBusy(true);
    setDialogError(null);
    try {
      await action();
      close();
      changed();
      after?.();
    } catch (err) {
      setDialogError(errorText(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const actions: PageAction[] = [
    { label: "Add transaction", primary: true, onClick: () => setDialog("transaction"), ...(property.soldOn ? { disabled: true, title: "Sold: it takes no new transactions" } : locked) },
    { label: "Reports", onClick: onOpenReports },
    { label: "Add valuation", onClick: () => setDialog("valuation"), ...locked },
    { label: "Add mortgage", onClick: () => setDialog("mortgage"), ...locked },
    { label: "Edit property", onClick: () => setDialog("edit"), ...locked },
    { label: property.archived ? "Unarchive" : "Archive", onClick: () => setDialog("archive"), ...sampleLock },
    { label: "Delete property", danger: true, onClick: () => setDialog("delete"), ...sampleLock },
  ];

  const gain = f.invested > 0 && !property.soldOn ? ((f.valueAtShare - f.invested) / f.invested) * 100 : null;
  const figures: PageFigure[] = [
    { label: "Equity", value: money(f.equity), sub: f.loanToValuePct === null ? undefined : `Loan-to-value ${f.loanToValuePct.toFixed(0)}%` },
    { label: "Mortgage debt", value: money(f.residualDebt) },
    { label: "Income, 12 months", value: money(f.yearlyIncome), sub: f.grossYieldPct === null ? undefined : `${f.grossYieldPct.toFixed(1)}% gross yield` },
    { label: "Net cash flow, 12 months", value: money(f.yearlyNetCashFlow), tone: toneOf(f.yearlyNetCashFlow) },
  ];
  const eyebrow = ["Property", property.archived && "Archived", property.soldOn && `Sold ${dayLabel(property.soldOn)}`].filter(Boolean).join(" · ");
  const note = [
    PROPERTY_KIND_LABELS[property.kind],
    [property.address.street, property.address.locality].join(", "),
    PROPERTY_USE_LABELS[property.use],
    property.ownershipSharePct < 100 ? `your ${property.ownershipSharePct}%` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current={property.name} />
      <PageHeader
        eyebrow={eyebrow}
        badge={sample ? <PreviewBadge label="Sample" /> : undefined}
        title={property.name}
        value={money(f.valueAtShare)}
        change={gain === null ? null : { text: `${pct(gain)} on what was put in`, tone: toneOf(gain) }}
        note={note}
        counters={[
          { key: "transactions", label: "transactions", count, onClick: onOpenTransactions },
          ...(alertRules === null ? [] : [alertsCounter(alertRules, onOpenAlerts, property.uuid)]),
          { key: "reports", label: "reports", onClick: onOpenReports },
        ]}
        actions={actions}
        figures={figures}
      />
      {property.archived && (
        <p className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-semibold text-slate-600">
          <Archive className="h-4 w-4 shrink-0" />
          Archived: read only, and left out of the figures across your properties. Unarchive it to change it again.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6">
        <ValueModule summary={summary} desc="What it's worth at your share, against what was put in (the purchase, its costs and works)." />
        <CashFlowModule summary={summary} />
      </div>

      <PropertyTaxModule
        property={property}
        readOnly={readOnly}
        onEdit={() => setDialog("edit")}
        onEditTaxpayer={setTaxpayerYear}
        onRecordPayment={setTaxPayment}
      />

      <LeasesModule property={property} readOnly={readOnly} onChanged={changed} />

      {property.address.country === "IT" && <PropertyMarketModule property={property} readOnly={readOnly} onEdit={() => setDialog("edit")} />}

      {property.address.country === "IT" && !property.soldOn && !property.archived && <SaleSimulatorModule property={property} />}

      <MortgagesModule
        property={property}
        source={source}
        version={version}
        readOnly={readOnly}
        onChangeRate={setRateFor}
        onSimulate={setSimulating}
        onChanged={changed}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ValuationsModule property={property} source={source} version={version} readOnly={readOnly} onChanged={changed} />
        <PropertyUsesModule property={property} readOnly={readOnly} onChanged={changed} />
      </div>
      <DetailsModule property={property} />

      {dialog === "transaction" && (
        <RealEstateTransactionDialog initialKind="rent" initialPropertyUuid={property.uuid} onClose={close} onSaved={close} />
      )}
      {simulating && (
        <MortgageSimulatorDialog
          property={property}
          mortgage={simulating}
          readOnly={readOnly}
          onClose={() => setSimulating(null)}
          onRecorded={() => { setSimulating(null); changed(); }}
        />
      )}
      {taxpayerYear !== null && (
        <TaxpayerYearDialog year={taxpayerYear} onClose={() => setTaxpayerYear(null)} onSaved={() => { setTaxpayerYear(null); changed(); }} />
      )}
      {taxPayment && (
        <RealEstateTransactionDialog
          initialPropertyUuid={property.uuid}
          taxPayment={taxPayment}
          onClose={() => setTaxPayment(null)}
          onSaved={() => setTaxPayment(null)}
        />
      )}
      {dialog === "valuation" && <ValuationDialog property={property} onClose={close} onSaved={done} />}
      {dialog === "mortgage" && <MortgageDialog property={property} onClose={close} onSaved={done} />}
      {dialog === "edit" && <PropertyEditDialog property={property} onClose={close} onSaved={done} />}
      {rateFor && <RateChangeDialog mortgage={rateFor} onClose={() => setRateFor(null)} onSaved={() => { setRateFor(null); changed(); }} />}
      {dialog === "archive" && (
        <ConfirmDialog
          title={property.archived ? `Unarchive "${property.name}"?` : `Archive "${property.name}"?`}
          description={property.archived
            ? "It can be changed again, and counts in the figures across your properties."
            : "It keeps its transactions, mortgages and valuations, but takes no changes and is left out of the figures across your properties. You can unarchive it any time."}
          confirmLabel={property.archived ? "Unarchive" : "Archive"}
          confirming={busy}
          error={dialogError}
          onConfirm={() => run(() => realEstateService.setArchived(property.uuid, !property.archived), "Unable to change this property.")}
          onClose={close}
        />
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          title={`Delete "${property.name}"?`}
          description="Its transactions, mortgages and valuations are deleted with it. To keep its history, archive it instead. This can't be undone."
          confirming={busy}
          error={dialogError}
          onConfirm={() => run(() => realEstateService.remove(property.uuid), "Unable to delete this property.", onGone)}
          onClose={close}
        />
      )}
    </div>
  );
}

/** How many transactions a property has: null while loading. */
function useTransactionCount(propertyUuid: string) {
  const { source, version } = useRealEstate();
  const key = `${propertyUuid}:${version}`;
  const [state, setState] = useState<{ key: string; total: number | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    source.transactions(propertyUuid, { limit: 1 })
      .then((list) => { if (!cancelled) setState({ key, total: list.total }); })
      .catch(() => { if (!cancelled) setState({ key, total: null }); });
    return () => { cancelled = true; };
  }, [source, propertyUuid, key]);
  return state?.key === key ? state.total : null;
}

type Source = ReturnType<typeof useRealEstate>["source"];

/** A read of the source for this property, again as the real estate changes: undefined while loading. */
function useRead<T>(key: string, read: () => Promise<T>, version: number) {
  const full = `${key}:${version}`;
  const [state, setState] = useState<{ key: string; value: T | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    read()
      .then((value) => { if (!cancelled) setState({ key: full, value }); })
      .catch(() => { if (!cancelled) setState({ key: full, value: null }); });
    return () => { cancelled = true; };
    // `read` is identified by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);
  return state?.key === full ? state.value : undefined;
}

function rateText(m: Mortgage) {
  if (m.rate.variable) {
    const v = m.rate.variable;
    return `Variable, ${RATE_INDEX_LABELS[v.index]} + ${v.spreadPct.toFixed(2)}%`;
  }
  return `Fixed ${m.rate.fixedPct?.toFixed(2)}%`;
}

/** The property's mortgages, open first: each with its figures, its schedule and its rate changes. */
function MortgagesModule({ property, source, version, readOnly, onChangeRate, onSimulate, onChanged }: {
  property: Property;
  source: Source;
  version: number;
  readOnly: boolean;
  onChangeRate: (m: Mortgage) => void;
  // Prepaying or refinancing it, simulated (read only too: nothing is stored until recorded).
  onSimulate: (m: Mortgage) => void;
  onChanged: () => void;
}) {
  const mortgages = useRead(`mortgages:${property.uuid}`, () => source.mortgages(property.uuid), version);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Mortgage | null>(null);
  const money = (v: number) => formatCurrency(v, property.currency, 0);

  const act = async (key: string, action: () => Promise<unknown>, fallback: string) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      setDeleting(null);
      onChanged();
    } catch (err) {
      setError(errorText(err, fallback));
    } finally {
      setBusy(null);
    }
  };

  const sorted = [...(mortgages ?? [])].sort((a, b) => Number(!!a.closedOn) - Number(!!b.closedOn));
  return (
    <Module>
      <ModuleHead title="Mortgages" desc="Your part of each loan, its schedule worked out on its rate changes and the instalments paid." />
      <div className={`${MODULE_BODY} space-y-4`}>
        {mortgages === undefined ? (
          <p className="text-[12.5px] text-[#a8a29e]">Loading…</p>
        ) : mortgages === null ? (
          <p className="text-[12.5px] text-rose-600">Unable to load the mortgages.</p>
        ) : sorted.length === 0 ? (
          <p className="text-[12.5px] text-[#a8a29e]">No mortgage on it.</p>
        ) : sorted.map((m) => (
          <MortgageCard
            key={m.uuid}
            mortgage={m}
            source={source}
            version={version}
            money={money}
            readOnly={readOnly}
            busy={busy !== null}
            onChangeRate={() => onChangeRate(m)}
            onSimulate={() => onSimulate(m)}
            onRemoveRate={(day) => act(m.uuid, () => realEstateService.removeRateChange(m.uuid, day), "Unable to remove this rate change.")}
            onToggleClosed={() => act(m.uuid, () => realEstateService.updateMortgage(m.uuid, { closedOn: m.closedOn ? "" : today() }), "Unable to change this mortgage.")}
            onDelete={() => { setError(null); setDeleting(m); }}
          />
        ))}
        {error && !deleting && <p className="text-xs font-semibold text-rose-600">{error}</p>}
      </div>
      {deleting && (
        <ConfirmDialog
          title="Delete this mortgage?"
          description="Only a mortgage no transaction names can be deleted: delete its instalments first, or close it instead to keep its history. This can't be undone."
          confirming={busy !== null}
          error={error}
          onConfirm={() => act(deleting.uuid, () => realEstateService.removeMortgage(deleting.uuid), "Unable to delete this mortgage.")}
          onClose={() => setDeleting(null)}
        />
      )}
    </Module>
  );
}

function MortgageCard({ mortgage: m, source, version, money, readOnly, busy, onChangeRate, onSimulate, onRemoveRate, onToggleClosed, onDelete }: {
  mortgage: Mortgage;
  source: Source;
  version: number;
  money: (v: number) => string;
  readOnly: boolean;
  busy: boolean;
  onChangeRate: () => void;
  onSimulate: () => void;
  onRemoveRate: (day: string) => void;
  onToggleClosed: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const paidShare = m.principal > 0 ? Math.min(100, Math.max(0, (1 - m.residualDebt / m.principal) * 100)) : 0;
  const button = "px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:border-slate-300 disabled:opacity-50";
  return (
    <div className={`rounded-2xl border ${m.closedOn ? "border-slate-100 bg-slate-50/60" : "border-[#EEE9DD]"} p-4 space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">
            {m.lender ?? "Mortgage"}
            {m.closedOn && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-slate-200 text-[9px] font-black uppercase tracking-wider text-slate-500 align-middle">Closed {dayLabel(m.closedOn)}</span>}
          </p>
          <p className="text-[11.5px] text-slate-500">
            {money(m.principal)} over {m.termMonths % 12 === 0 ? `${m.termMonths / 12} years` : `${m.termMonths} months`} · {FREQUENCY_LABELS[m.frequency]} · {rateText(m)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!m.closedOn && m.residualDebt > 0 && (
            <button type="button" disabled={busy} onClick={onSimulate} className={`${button} inline-flex items-center gap-1.5 text-[#8A6A28] border-[#E0DACC] hover:border-[#C49A3C]`}>
              <Calculator className="h-3 w-3" /> Prepay or refinance
            </button>
          )}
          {!readOnly && (
            <>
              {!m.closedOn && <button type="button" disabled={busy} onClick={onChangeRate} className={button}>Change rate</button>}
              <button type="button" disabled={busy} onClick={onToggleClosed} className={button}>{m.closedOn ? "Reopen" : "Close"}</button>
              <button type="button" disabled={busy} onClick={onDelete} aria-label="Delete mortgage" className={`${button} text-rose-600`}><Trash2 className="h-3.5 w-3.5" /></button>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-2 text-[12px]">
        <Stat label="Left to repay" value={money(m.residualDebt)} />
        <Stat label="Rate now" value={`${m.currentRatePct.toFixed(2)}%`} />
        <Stat label="Instalment" value={m.closedOn || m.residualDebt === 0 ? "—" : formatCurrency(m.currentInstalment, m.currency, 2)} />
        <Stat label="Last instalment" value={m.lastInstalmentOn ? dayLabel(m.lastInstalmentOn) : "—"} />
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" title={`${paidShare.toFixed(0)}% repaid`}>
        <div className="h-full rounded-full bg-[#0f766e]" style={{ width: `${paidShare}%` }} />
      </div>
      <MortgageMarketRates mortgage={m} />
      {m.rateChanges.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {m.rateChanges.map((c, i) => (
            <span key={c.effectiveOn} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
              {i === 0 ? "From" : "Since"} {dayLabel(c.effectiveOn)}: {c.ratePct.toFixed(2)}%
              {i > 0 && !readOnly && (
                <button type="button" disabled={busy} onClick={() => onRemoveRate(c.effectiveOn)} aria-label={`Remove the rate change of ${c.effectiveOn}`} className="text-slate-400 hover:text-rose-600">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-[11px] font-bold text-[#8A6A28] hover:text-[#C49A3C]">
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {open ? "Hide the schedule" : "Show the schedule"}
      </button>
      {open && <Schedule mortgage={m} source={source} version={version} />}
    </div>
  );
}

function Schedule({ mortgage, source, version }: { mortgage: Mortgage; source: Source; version: number }) {
  const schedule = useRead<MortgageSchedule>(`schedule:${mortgage.uuid}`, () => source.schedule(mortgage.uuid), version);
  const [all, setAll] = useState(false);
  if (schedule === undefined) return <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />;
  if (schedule === null) return <p className="text-xs font-semibold text-rose-600">Unable to load the schedule.</p>;
  const money = (v: number) => formatCurrency(v, schedule.currency, 2);
  const now = today();
  // Around today: the last few paid and the next ones, unless all of it is asked for.
  const next = schedule.instalments.findIndex((i) => i.dueOn >= now);
  const from = Math.max(0, (next === -1 ? schedule.instalments.length : next) - 3);
  const rows = all ? schedule.instalments : schedule.instalments.slice(from, from + 12);
  return (
    <div className="space-y-2">
      <p className="text-[11.5px] text-slate-500">
        {schedule.instalments.length} instalments · {money(schedule.totalInterest)} interest in all
        {schedule.prepayments.length > 0 && ` · ${schedule.prepayments.length} prepayment${schedule.prepayments.length === 1 ? "" : "s"}`}
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2 text-right">Payment</th>
              <th className="px-3 py-2 text-right">Principal</th>
              <th className="px-3 py-2 text-right">Interest</th>
              <th className="px-3 py-2 text-right">Left</th>
              <th className="px-3 py-2 text-right">Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((i) => (
              <tr key={i.number} className={i.transactionUuid ? "text-slate-400" : i.dueOn < now ? "text-rose-600" : "text-slate-700"}>
                <td className="px-3 py-1.5 tabular-nums">{i.number}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{dayLabel(i.dueOn)}{i.transactionUuid ? " · paid" : i.dueOn < now ? " · not recorded" : ""}</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-bold">{money(i.payment)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(i.principal)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(i.interest)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(i.residualDebt)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{i.ratePct.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {schedule.instalments.length > rows.length || all ? (
        <button type="button" onClick={() => setAll((a) => !a)} className="text-[11px] font-bold text-slate-500 hover:text-slate-800">
          {all ? "Show around today" : `Show all ${schedule.instalments.length}`}
        </button>
      ) : null}
    </div>
  );
}

/** Its valuations, newest first: the latest is its value. */
function ValuationsModule({ property, source, version, readOnly, onChanged }: {
  property: Property; source: Source; version: number; readOnly: boolean; onChanged: () => void;
}) {
  const valuations = useRead<Valuation[]>(`valuations:${property.uuid}`, () => source.valuations(property.uuid), version);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async (uuid: string) => {
    setBusy(true);
    setError(null);
    try {
      await realEstateService.removeValuation(uuid);
      onChanged();
    } catch (err) {
      setError(errorText(err, "Unable to delete this valuation."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Module>
      <ModuleHead title="Valuations" desc="What the whole property is worth: the latest is its value. Before any, the purchase price." />
      <div className={MODULE_BODY}>
        {valuations === undefined ? (
          <p className="text-[12.5px] text-[#a8a29e]">Loading…</p>
        ) : !valuations || valuations.length === 0 ? (
          <p className="text-[12.5px] text-[#a8a29e]">
            {property.figures.valueSource === "purchase_price" ? "None yet: its value is the purchase price."
              : property.figures.valueSource === "market_zone" ? "None yet: its value is the middle of its zone's market range." : "None yet."}
          </p>
        ) : (
          <ul className="divide-y divide-[#EEE9DD]">
            {valuations.map((v, i) => (
              <li key={v.uuid} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-slate-800">
                    {formatCurrency(v.value, v.currency, 0)}
                    {i === 0 && <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-[#C49A3C]">Current</span>}
                  </span>
                  <span className="block truncate text-[11.5px] text-slate-500">{dayLabel(v.valuedOn)} · {VALUATION_SOURCE_LABELS[v.source]}{v.note ? ` · ${v.note}` : ""}</span>
                </span>
                {!readOnly && (
                  <button type="button" disabled={busy} onClick={() => remove(v.uuid)} aria-label="Delete valuation" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-xs font-semibold text-rose-600 mt-2">{error}</p>}
      </div>
    </Module>
  );
}

function DetailsModule({ property: p }: { property: Property }) {
  const italy = p.details.italy;
  const { properties, source } = useRealEstate();
  const owner = p.appurtenantToUuid ? properties.find((x) => x.uuid === p.appurtenantToUuid) : undefined;
  const appurtenances = properties.filter((x) => x.appurtenantToUuid === p.uuid);
  const municipality = useRead(`municipality:${italy?.municipalityCode ?? ""}`, () => (italy?.municipalityCode ? source.municipalities({ codes: [italy.municipalityCode] }) : Promise.resolve([])), 0);
  const rows: [string, string | null][] = [
    ["Address", [p.address.street, [p.address.postalCode, p.address.locality].filter(Boolean).join(" "), p.address.region, p.address.country].filter(Boolean).join(", ")],
    ["Neighbourhood", p.address.neighbourhood ?? null],
    ["Surface", p.surfaceSqm ? `${p.surfaceSqm} m² · ${Math.round(sqmToSqft(p.surfaceSqm))} sq ft` : null],
    ["Rooms", p.rooms != null ? String(p.rooms) : null],
    ["Year built", p.yearBuilt != null ? String(p.yearBuilt) : null],
    ["Energy rating", p.energyRating],
    ["Your share", `${p.ownershipSharePct}%`],
    ["Held by", p.holder.name ? `${p.holder.name}${p.holder.kind === "company" ? " (a company)" : ""}` : p.holder.kind === "company" ? "A company" : null],
    ["Belongs to", owner?.name ?? null],
    ["Its appurtenances", appurtenances.length ? appurtenances.map((x) => x.name).join(", ") : null],
    ["Bought", p.purchasedOn ? dayLabel(p.purchasedOn) : null],
    ["Sold", p.soldOn ? dayLabel(p.soldOn) : null],
    ["Value from", p.figures.valueSource ? `${VALUATION_SOURCE_LABELS[p.figures.valueSource]}${p.figures.valuedOn ? `, ${dayLabel(p.figures.valuedOn)}` : ""}` : null],
    ["Currency", p.currency],
    ["Municipality", italy?.municipalityCode ? (municipality?.[0] ? `${municipality[0].name} (${municipality[0].province}) · ${italy.municipalityCode}` : italy.municipalityCode) : null],
    ["Cadastral reference", italy && (italy.cadastralSheet || italy.cadastralParcel)
      ? [ italy.cadastralSheet && `Fg. ${italy.cadastralSheet}`, italy.cadastralParcel && `Part. ${italy.cadastralParcel}`, italy.cadastralSubunit && `Sub. ${italy.cadastralSubunit}`].filter(Boolean).join(", ")
      : null],
    ["Cadastral category", italy?.cadastralCategory ?? null],
    ["Cadastral income", italy?.cadastralIncome != null ? formatCurrency(italy.cadastralIncome, "EUR", 2) : null],
    ["Listed building", italy?.historic ? "Yes: IMU on half the base" : null],
    ["Lent to a relative", italy?.freeLoanToRelative && p.use === "free_loan" ? "On IMU's conditions: half the base" : null],
    ["Note", p.note],
  ];
  return (
    <Module>
      <ModuleHead title="Details" />
      <dl className={`${MODULE_BODY} grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-[12.5px]`}>
        {rows.filter(([, v]) => v).map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-semibold text-slate-800 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </Module>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-[10.5px] text-slate-400">{label}</span>
      <span className="font-bold text-slate-900 tabular-nums">{value}</span>
    </span>
  );
}
