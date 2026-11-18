// components/dashboard/taxes/TaxAlerts.tsx
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing, Hourglass, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { investmentsKey } from "../../../context/PortfolioContext";
import { useTaxAlertRules } from "../../../hooks/useTaxes";
import { formatCurrency } from "../../../lib/format";
import { fieldErrorText } from "../../../lib/realEstate";
import { categoryLabel } from "../../../lib/taxes";
import { dayLabel, today } from "../../../lib/wallets";
import { taxService } from "../../../services/taxService";
import type { TaxAlertFinding, TaxAlertParams, TaxAlertRule, TaxAlertRuleUpdateRequest, TaxAlertType } from "../../../models/Tax";
import { ConfirmDialog } from "../ConfirmDialog";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { Toggle } from "../Toggle";
import { DialogShell, Field, INPUT } from "../wallets/WalletDialogs";

const ICONS: Record<TaxAlertType, React.ComponentType<{ className?: string }>> = { tax_due: Receipt, losses_expiring: Hourglass };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const TYPES: Record<TaxAlertType, { label: string; desc: string }> = {
  tax_due: { label: "A tax falling due", desc: "An instalment of a property's tax (IMU, the tax on rents, a sale's) not paid by some days before it's due." },
  losses_expiring: { label: "Losses about to expire", desc: "Earlier losses this year is the last to offset, with the positions in gain that would take them." },
};

const ALERT_RULES_KEY = investmentsKey("taxes", "own", "alertRules");

// The investments' tax alerts, the Taxes page's: earlier losses about to expire.
export const INVESTMENT_TAX_ALERTS: TaxAlertType[] = ["losses_expiring"];
export const isInvestmentAlert = (r: TaxAlertRule) => INVESTMENT_TAX_ALERTS.includes(r.params.type);

export function taxAlertRuleText(params: TaxAlertParams): string {
  if (params.type === "tax_due") {
    return params.daysBefore === 0 ? "A tax instalment due today or overdue" : `A tax instalment due within ${params.daysBefore} ${params.daysBefore === 1 ? "day" : "days"}`;
  }
  return `Losses expiring this year, from ${params.fromDay} ${MONTHS[params.fromMonth - 1]}`;
}

function findingText(f: TaxAlertFinding): { title: string; detail: string } {
  const money = (v: number) => formatCurrency(v, f.currency, 0);
  if (f.kind === "tax_due") {
    const due = f.dueOn ? (f.dueOn < today() ? `was due ${dayLabel(f.dueOn)}` : `due ${dayLabel(f.dueOn)}`) : null;
    return {
      title: `${f.taxName ?? "A tax"}${f.taxYear ? ` ${f.taxYear}` : ""}: an instalment not paid`,
      detail: [f.propertyName, money(f.amount), due].filter(Boolean).join(" · "),
    };
  }
  const where = [...new Set(f.losses.map((l) => l.portfolioName ?? (l.portfolioUuid ? "A portfolio" : "Your tax return")))].join(", ");
  const takers = f.harvestablePositions ? `${f.harvestablePositions} ${f.harvestablePositions === 1 ? "position" : "positions"} in gain would take them` : "no position in gain would take them";
  return {
    title: `${money(f.amount)} of losses expire at the year's end`,
    detail: [f.losses.map((l) => `${categoryLabel(l.category)} ${l.originYear}`).join(", "), where, takers].filter(Boolean).join(" · "),
  };
}

const channelsText = (r: Pick<TaxAlertRule, "notifyEmail" | "notifyInApp">) =>
  r.notifyEmail && r.notifyInApp ? "By email and in the app" : r.notifyEmail ? "By email" : r.notifyInApp ? "In the app" : "Not notified";

/**
 * TAX ALERTS — the user's own rules on their taxes (fiscus'): a property's tax instalment falling
 * due, earlier losses about to expire; each with what it finds today. Checked every morning: only
 * what's new is told, by email and/or in the app. No rule exists until the user adds one. The
 * real estate's Alerts list the tax_due ones too: here (the investments' Taxes) only the
 * investments' are, the losses about to expire (INVESTMENT_TAX_ALERTS); a property's tax falling
 * due is the real estate's to watch.
 */
export function TaxAlerts({ properties = [] }: { properties?: { uuid: string; name: string }[] }) {
  const queryClient = useQueryClient();
  const read = useTaxAlertRules(true);
  const [editing, setEditing] = useState<TaxAlertRule | "new" | null>(null);
  const [deleting, setDeleting] = useState<TaxAlertRule | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rules = read.isError ? null : read.data?.filter(isInvestmentAlert);
  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ALERT_RULES_KEY });
    // The real estate's Alerts list the tax_due rules too.
    void queryClient.invalidateQueries({ queryKey: ["realEstate", "alertRules"] });
  };
  const nameOf = (uuid: string | null) => (uuid ? properties.find((p) => p.uuid === uuid)?.name ?? "A property" : null);

  const toggle = async (rule: TaxAlertRule, enabled: boolean) => {
    setBusy(rule.uuid);
    setError(null);
    try {
      const updated = await taxService.updateAlertRule(rule.uuid, { enabled });
      queryClient.setQueryData<TaxAlertRule[]>(ALERT_RULES_KEY, (list) => list?.map((r) => (r.uuid === updated.uuid ? updated : r)));
    } catch (err) {
      setError(fieldErrorText(err, "Unable to change this rule."));
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy(deleting.uuid);
    setError(null);
    try {
      await taxService.removeAlertRule(deleting.uuid);
      setDeleting(null);
      reload();
    } catch (err) {
      setError(fieldErrorText(err, "Unable to delete this rule."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Module>
      <ModuleHead
        title="Tax alerts"
        desc="Checked every morning: you're told only of what's new, by email and/or in the app's bell."
        right={(
          <button
            type="button"
            onClick={() => setEditing("new")}
            disabled={!rules}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11.5px] font-bold bg-[#1c1917] text-white hover:bg-[#C49A3C] transition-colors disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> New alert
          </button>
        )}
      />
      <div className={MODULE_BODY}>
        {rules === undefined ? (
          <p className="text-[12.5px] text-[#857e78]">Loading…</p>
        ) : rules === null ? (
          <p className="text-[12.5px] font-semibold text-rose-600">{fieldErrorText(read.error, "Unable to load the tax alerts.")}</p>
        ) : rules.length === 0 ? (
          <p className="text-[12.5px] text-[#857e78]">
            No tax alert yet. Add one to be told when earlier losses are about to expire. A property&apos;s tax falling due is watched in Real estate&apos;s alerts.
          </p>
        ) : (
          <ul className="divide-y divide-[#EEE9DD]">
            {rules.map((r) => {
              const Icon = ICONS[r.params.type];
              const found = r.enabled ? r.findings : [];
              const meta = [
                r.params.type === "tax_due" ? nameOf(r.propertyUuid) ?? "Every property" : null,
                channelsText(r),
                r.lastCheckedAt ? `checked ${dayLabel(r.lastCheckedAt.slice(0, 10))}` : "not checked yet",
              ].filter(Boolean).join(" · ");
              return (
                <li key={r.uuid} className="py-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${found.length > 0 ? "bg-rose-50 text-rose-600" : r.enabled ? "bg-[#C49A3C]/10 text-[#C49A3C]" : "bg-slate-100 text-slate-400"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-slate-800">
                        {taxAlertRuleText(r.params)}
                        {!r.enabled && <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Off</span>}
                      </span>
                      <span className="block text-[11.5px] text-slate-500">{meta}</span>
                    </span>
                    <span className="flex gap-1">
                      <button type="button" onClick={() => setEditing(r)} aria-label="Edit rule" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => { setError(null); setDeleting(r); }} aria-label="Delete rule" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                    </span>
                    <Toggle checked={r.enabled} label={taxAlertRuleText(r.params)} disabled={busy === r.uuid} onChange={(v) => void toggle(r, v)} />
                  </div>
                  {found.length > 0 && (
                    <ul className="mt-2 ml-12 space-y-1.5">
                      {found.map((f) => {
                        const text = findingText(f);
                        return (
                          <li key={f.key} className="text-[12px]">
                            <span className="block font-bold text-rose-700">{text.title}</span>
                            <span className="block text-slate-500">{text.detail}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {error && !deleting && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}
      </div>

      {editing && (
        <TaxAlertDialog
          rule={editing === "new" ? undefined : editing}
          properties={properties}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this alert?"
          description={`“${taxAlertRuleText(deleting.params)}” stops being checked. This can't be undone.`}
          confirming={busy === deleting.uuid}
          error={error}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </Module>
  );
}

/** A rule, new or to change: what it watches with its number (days, or the day of the year), the
 * property for a tax falling due (every one, or one; fixed once made), and how it tells. */
function TaxAlertDialog({ rule, properties, onClose, onSaved }: {
  rule?: TaxAlertRule;
  properties: { uuid: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<TaxAlertType>(rule?.params.type ?? "losses_expiring");
  const [propertyUuid, setPropertyUuid] = useState(rule?.propertyUuid ?? "");
  const [days, setDays] = useState(String(rule?.params.type === "tax_due" ? rule.params.daysBefore : 15));
  const [month, setMonth] = useState(rule?.params.type === "losses_expiring" ? rule.params.fromMonth : 10);
  const [day, setDay] = useState(rule?.params.type === "losses_expiring" ? rule.params.fromDay : 1);
  const [notifyEmail, setNotifyEmail] = useState(rule?.notifyEmail ?? true);
  const [notifyInApp, setNotifyInApp] = useState(rule?.notifyInApp ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const daysBefore = /^\d+$/.test(days.trim()) ? Number(days.trim()) : null;
  const params: TaxAlertParams | null = type === "tax_due"
    ? (daysBefore !== null && daysBefore <= 90 ? { type, daysBefore } : null)
    : { type, fromMonth: month, fromDay: Math.min(day, DAYS_IN_MONTH[month - 1]) };

  const save = async () => {
    if (!params) return;
    setBusy(true);
    setError(null);
    try {
      if (rule) {
        // Only what changed: new params make what the rule finds now known again, not notified.
        const changes: TaxAlertRuleUpdateRequest = {};
        if (JSON.stringify(params) !== JSON.stringify(rule.params)) changes.params = params;
        if (notifyEmail !== rule.notifyEmail) changes.notifyEmail = notifyEmail;
        if (notifyInApp !== rule.notifyInApp) changes.notifyInApp = notifyInApp;
        if (Object.keys(changes).length > 0) await taxService.updateAlertRule(rule.uuid, changes);
      } else {
        await taxService.addAlertRule({ propertyUuid: type === "tax_due" ? propertyUuid || null : null, params, notifyEmail, notifyInApp });
      }
      onSaved();
    } catch (err) {
      setError(fieldErrorText(err, "Unable to save this alert."));
      setBusy(false);
    }
  };

  // A rule on one property stays a tax falling due: its property can't change. A new one is the
  // investments' (a property's tax falling due is made in Real estate's alerts).
  const types: TaxAlertType[] = rule?.propertyUuid ? ["tax_due"] : rule?.params.type === "tax_due" ? ["tax_due"] : INVESTMENT_TAX_ALERTS;
  return (
    <DialogShell
      icon={<BellRing className="h-5 w-5" />}
      title={rule ? "Edit tax alert" : "New tax alert"}
      subtitle="Checked every morning. What it finds today shows on the page; you're told only of what's new."
      busy={busy}
      error={error}
      submitLabel={rule ? "Save" : "Add alert"}
      canSubmit={params !== null}
      onSubmit={() => void save()}
      onClose={onClose}
      wide
    >
      <div className="space-y-1.5">
        <span className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Tell me when</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {types.map((t) => {
            const Icon = ICONS[t];
            const on = t === type;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={on}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${on ? "border-[#C49A3C] bg-[#C49A3C]/5" : "border-slate-200 hover:border-[#C49A3C]/50"}`}
              >
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${on ? "text-[#C49A3C]" : "text-slate-400"}`} />
                <span>
                  <span className="block text-[13px] font-bold text-slate-900">{TYPES[t].label}</span>
                  <span className="block text-[11px] text-slate-500 leading-snug">{TYPES[t].desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {type === "tax_due" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <Field label="Property" hint={rule ? "An alert's property can't change: delete it and add another." : undefined}>
            <select value={propertyUuid} onChange={(e) => setPropertyUuid(e.target.value)} disabled={!!rule} className={INPUT}>
              <option value="">Every property</option>
              {properties.map((p) => <option key={p.uuid} value={p.uuid}>{p.name}</option>)}
              {rule?.propertyUuid && !properties.some((p) => p.uuid === rule.propertyUuid) && <option value={rule.propertyUuid}>Another property</option>}
            </select>
          </Field>
          <Field label="Days before it's due" hint="From 0 (due today or overdue) to 90.">
            <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" className={INPUT} aria-invalid={params === null} />
          </Field>
        </div>
      ) : (
        <Field label="From" hint="Each year, from this day on, while some loss expires at the year's end.">
          <div className="flex gap-2">
            <select value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Day" className={`${INPUT.replace("w-full", "")} w-24`}>
              {Array.from({ length: DAYS_IN_MONTH[month - 1] }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Month" className={`${INPUT.replace("w-full", "")} flex-1`}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </Field>
      )}

      <div className="space-y-1.5">
        <span className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Tell me</span>
        <label className="flex items-center justify-between gap-3 h-11">
          <span className="text-sm font-semibold text-slate-700">By email</span>
          <Toggle checked={notifyEmail} onChange={setNotifyEmail} label="By email" />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-slate-700">In the app</span>
          <Toggle checked={notifyInApp} onChange={setNotifyInApp} label="In the app" />
        </label>
      </div>
      {params && <p className="text-[12px] font-semibold text-slate-500">“{taxAlertRuleText(params)}”</p>}
    </DialogShell>
  );
}
