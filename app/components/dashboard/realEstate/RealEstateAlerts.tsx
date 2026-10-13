// components/dashboard/realEstate/RealEstateAlerts.tsx
"use client";

import { useEffect, useState } from "react";
import { Banknote, BellRing, CircleCheck, FileSignature, Landmark, Pencil, Plus, Receipt, Scale, Trash2, TrendingDown, Tags } from "lucide-react";
import { useRealEstate } from "../../../context/RealEstateContext";
import { realEstateService } from "../../../services/realEstateService";
import { ApiError } from "../../../services/apiClient";
import {
  ALERT_TYPES, ALERT_TYPE_LIST, OMI_ATTRIBUTION, alertFindingText, alertParamValue, alertParams, alertRuleText, currentFindings, fieldErrorText, findingKey,
} from "../../../lib/realEstate";
import { dayLabel } from "../../../lib/wallets";
import type { Property, RealEstateAlertRule, RealEstateAlertRuleUpdateRequest, RealEstateAlertType } from "../../../models/RealEstate";
import { Breadcrumb, type Crumb } from "../Breadcrumb";
import type { PageCounter } from "../PageHeader";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { ConfirmDialog } from "../ConfirmDialog";
import { Toggle } from "../Toggle";
import { DialogShell, Field, INPUT, parseAmount } from "../wallets/WalletDialogs";
import { DEMO_DISABLED_TITLE } from "../../preview/DemoBanner";

export const ALERT_ICONS: Record<RealEstateAlertType, React.ComponentType<{ className?: string }>> = {
  rent_unpaid: Banknote,
  tax_due: Receipt,
  mortgage_instalment_unpaid: Landmark,
  lease_ending: FileSignature,
  loan_to_value: Scale,
  zone_price_drop: TrendingDown,
  rent_below_market: Tags,
};

/**
 * The alert rules, every one or a property's (its own and those on every property), each with what
 * it finds today; refetched as the real estate changes. undefined while loading, null when they
 * can't be read (a backend without alerts yet among them).
 */
export function useAlertRules(propertyUuid: string | null, enabled = true) {
  const { source, version, available } = useRealEstate();
  const key = `${propertyUuid ?? "all"}:${version}`;
  const [state, setState] = useState<{ key: string; rules: RealEstateAlertRule[] | null } | null>(null);
  useEffect(() => {
    if (!enabled || !available) return;
    let cancelled = false;
    source.alertRules(propertyUuid)
      .then((rules) => { if (!cancelled) setState({ key, rules }); })
      .catch(() => { if (!cancelled) setState({ key, rules: null }); });
    return () => { cancelled = true; };
  }, [source, propertyUuid, key, enabled, available]);
  return state?.key === key ? state.rules : undefined;
}

/** The header's way to the Alerts: how many rules, and what the enabled ones find today (in red). */
export function alertsCounter(rules: RealEstateAlertRule[] | null | undefined, onClick: () => void, propertyUuid?: string): PageCounter {
  const found = rules ? currentFindings(rules, propertyUuid).length : 0;
  return {
    key: "alerts",
    label: "alerts",
    count: rules === undefined ? null : rules?.length ?? 0,
    attention: found > 0 ? { count: found, label: "found" } : undefined,
    onClick,
  };
}

const channelsText = (r: Pick<RealEstateAlertRule, "notifyEmail" | "notifyInApp">) =>
  r.notifyEmail && r.notifyInApp ? "By email and in the app" : r.notifyEmail ? "By email" : r.notifyInApp ? "In the app" : "Not notified";

/**
 * REAL ESTATE ALERTS — the rules that watch the properties (a rent not received, a tax falling due,
 * a mortgage instalment not recorded, a lease ending, the loan-to-value too high), each on one
 * property or on every one, and what they find today. Every morning each rule enabled is checked
 * and tells, by email and/or in the app, only what it hadn't found before: what a rule finds when
 * it's made, changed or switched on is shown here but not notified. With `property`, its rules (its
 * own and those on every property) and only its findings. A demo account's are sample rules, read only.
 */
export function RealEstateAlerts({ trail, property, onOpenProperty }: {
  trail: Crumb[];
  property?: Property;
  onOpenProperty: (uuid: string) => void;
}) {
  const { properties, source, version, sample } = useRealEstate();
  const scope = property?.uuid ?? null;
  const key = `${scope ?? "all"}:${version}`;
  // The list as read, then as the writes left it (no refetch for a toggle).
  const [state, setState] = useState<{ key: string; rules: RealEstateAlertRule[] | null; error: string | null } | null>(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<RealEstateAlertRule | "new" | null>(null);
  const [deleting, setDeleting] = useState<RealEstateAlertRule | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    source.alertRules(scope)
      .then((rules) => { if (!cancelled) setState({ key, rules, error: null }); })
      .catch((err) => {
        if (cancelled) return;
        // A backend without alerts answers the route with a bare 404.
        const missing = err instanceof ApiError && err.status === 404 && !scope;
        setState({ key, rules: null, error: missing ? "Alerts aren't available yet." : fieldErrorText(err, "Unable to load the alerts.") });
      });
    return () => { cancelled = true; };
  }, [source, scope, key, reload]);

  const rules = state?.key === key ? state.rules : undefined;
  const replace = (rule: RealEstateAlertRule) =>
    setState((s) => s && { ...s, rules: s.rules?.map((r) => (r.uuid === rule.uuid ? rule : r)) ?? null });
  const nameOf = (uuid: string | null) => (uuid ? properties.find((p) => p.uuid === uuid)?.name ?? "A property" : "Every property");
  const findingsOf = (r: RealEstateAlertRule) => (scope ? r.findings.filter((f) => f.propertyUuid === scope) : r.findings);
  const findings = rules ? currentFindings(rules, scope ?? undefined) : [];

  const toggle = async (rule: RealEstateAlertRule, enabled: boolean) => {
    setBusy(rule.uuid);
    setError(null);
    try {
      replace(await realEstateService.updateAlertRule(rule.uuid, { enabled }));
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
      await realEstateService.removeAlertRule(deleting.uuid);
      setDeleting(null);
      setReload((n) => n + 1);
    } catch (err) {
      setError(fieldErrorText(err, "Unable to delete this rule."));
    } finally {
      setBusy(null);
    }
  };

  const canAdd = !sample && rules !== null && !(property?.archived);
  const pageTrail = property ? [...trail, { label: property.name, onClick: () => onOpenProperty(property.uuid) }] : trail;

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb
        trail={pageTrail}
        current="Alerts"
        right={(
          <button
            type="button"
            onClick={() => setEditing("new")}
            disabled={!canAdd}
            title={sample ? DEMO_DISABLED_TITLE : undefined}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#1c1917] text-white hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:hover:bg-[#1c1917] disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" /> New alert
          </button>
        )}
      />

      {rules === undefined ? (
        <p className="text-[13px] text-[#a8a29e]">Loading…</p>
      ) : rules === null ? (
        <p className="text-[13px] font-semibold text-rose-600">{state?.error}</p>
      ) : (
        <>
          {rules.some((r) => r.enabled) && (
            <Module>
              <ModuleHead
                title="Needs a look"
                desc={property ? `What the rules find on ${property.name} today.` : "What the rules find today, by due day."}
              />
              <div className={MODULE_BODY}>
                {findings.length === 0 ? (
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700">
                    <CircleCheck className="h-4 w-4" /> Nothing today: every rule switched on is clear.
                  </p>
                ) : (
                  <ul className="divide-y divide-[#EEE9DD]">
                    {findings.map((f) => {
                      const Icon = ALERT_ICONS[f.kind];
                      const text = alertFindingText(f);
                      return (
                        <li key={findingKey(f)} className="flex items-center gap-3 py-2.5">
                          <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0"><Icon className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-bold text-slate-800">{text.title}</span>
                            <span className="block text-[11.5px] text-slate-500">{text.detail}</span>
                          </span>
                          {!property && (
                            <button type="button" onClick={() => onOpenProperty(f.propertyUuid)} className="text-[11.5px] font-bold text-[#8A6A28] hover:text-[#C49A3C] text-right shrink-0">
                              {f.propertyName}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {findings.some((f) => ALERT_TYPES[f.kind]?.market) && (
                  <p className="mt-3 text-[10.5px] text-slate-400">
                    {sample ? "Market figures: made up for the demo, not the OMI's." : `Market figures: ${OMI_ATTRIBUTION} (CC BY 4.0), the zone's indicative ranges.`}
                  </p>
                )}
              </div>
            </Module>
          )}

          <Module>
            <ModuleHead
              title="Rules"
              desc="Checked every morning: you're told only of what's new since the day before, by email and/or in the app's bell."
            />
            <div className={MODULE_BODY}>
              {rules.length === 0 ? (
                <p className="text-[12.5px] text-[#a8a29e]">
                  No alert yet. Add one to be told when a rent doesn&apos;t come in, a tax falls due, a mortgage instalment isn&apos;t recorded,
                  a lease is ending or the debt grows too large against the value.
                </p>
              ) : (
                <ul className="divide-y divide-[#EEE9DD]">
                  {rules.map((r) => {
                    const Icon = ALERT_ICONS[r.params.type];
                    const found = findingsOf(r).length;
                    const meta = [
                      nameOf(r.propertyUuid),
                      channelsText(r),
                      r.lastCheckedAt ? `checked ${dayLabel(r.lastCheckedAt.slice(0, 10))}` : "not checked yet",
                    ].join(" · ");
                    return (
                      <li key={r.uuid} className="flex items-center gap-3 py-3">
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${r.enabled && found > 0 ? "bg-rose-50 text-rose-600" : r.enabled ? "bg-[#C49A3C]/10 text-[#C49A3C]" : "bg-slate-100 text-slate-400"}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-bold text-slate-800">
                            {alertRuleText(r.params)}
                            {r.enabled && found > 0 && (
                              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-rose-50 text-[9px] font-black uppercase tracking-wider text-rose-600 align-middle">
                                {found} found
                              </span>
                            )}
                            {!r.enabled && <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Off</span>}
                          </span>
                          <span className="block text-[11.5px] text-slate-500">{meta}</span>
                        </span>
                        {!sample && (
                          <span className="flex gap-1">
                            <button type="button" onClick={() => setEditing(r)} aria-label="Edit rule" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => { setError(null); setDeleting(r); }} aria-label="Delete rule" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                          </span>
                        )}
                        <Toggle
                          checked={r.enabled}
                          label={alertRuleText(r.params)}
                          disabled={sample || busy === r.uuid}
                          title={sample ? DEMO_DISABLED_TITLE : undefined}
                          onChange={(v) => void toggle(r, v)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
              {error && !deleting && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}
            </div>
          </Module>
        </>
      )}

      {editing && (
        <AlertRuleDialog
          rule={editing === "new" ? undefined : editing}
          properties={properties.filter((p) => !p.archived)}
          initialPropertyUuid={scope}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setReload((n) => n + 1); }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this alert?"
          description={`“${alertRuleText(deleting.params)}” on ${deleting.propertyUuid ? nameOf(deleting.propertyUuid) : "every property"} stops being checked. This can't be undone.`}
          confirming={busy === deleting.uuid}
          error={error}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

/**
 * A rule, new or to change: the property it watches (every one, or one; fixed once made), what it
 * watches and its number, and how it tells.
 */
function AlertRuleDialog({ rule, properties, initialPropertyUuid, onClose, onSaved }: {
  rule?: RealEstateAlertRule;
  properties: Property[];
  initialPropertyUuid: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [propertyUuid, setPropertyUuid] = useState<string>(rule ? rule.propertyUuid ?? "" : initialPropertyUuid ?? "");
  const [type, setType] = useState<RealEstateAlertType>(rule?.params.type ?? "rent_unpaid");
  const [value, setValue] = useState(String(rule ? alertParamValue(rule.params) : ALERT_TYPES.rent_unpaid.param.initial));
  const [notifyEmail, setNotifyEmail] = useState(rule?.notifyEmail ?? true);
  const [notifyInApp, setNotifyInApp] = useState(rule?.notifyInApp ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spec = ALERT_TYPES[type].param;
  const parsed = spec.decimal ? parseAmount(value) : /^\d+$/.test(value.trim()) ? value.trim() : null;
  const number = parsed === null ? null : Number(parsed);
  const valid = number !== null && (spec.exclusiveMin ? number > spec.min : number >= spec.min) && number <= spec.max;
  const params = valid ? alertParams(type, spec.decimal ? parsed! : number!) : null;
  const pickType = (t: RealEstateAlertType) => {
    setType(t);
    setValue(String(rule?.params.type === t ? alertParamValue(rule.params) : ALERT_TYPES[t].param.initial));
  };

  const save = async () => {
    if (!params) return;
    setBusy(true);
    setError(null);
    try {
      if (rule) {
        // Only what changed: new params make what the rule finds now known again, not notified.
        const changes: RealEstateAlertRuleUpdateRequest = {};
        if (type !== rule.params.type || number !== alertParamValue(rule.params)) changes.params = params;
        if (notifyEmail !== rule.notifyEmail) changes.notifyEmail = notifyEmail;
        if (notifyInApp !== rule.notifyInApp) changes.notifyInApp = notifyInApp;
        if (Object.keys(changes).length > 0) await realEstateService.updateAlertRule(rule.uuid, changes);
      } else {
        await realEstateService.addAlertRule({ propertyUuid: propertyUuid || null, params, notifyEmail, notifyInApp });
      }
      onSaved();
    } catch (err) {
      setError(fieldErrorText(err, "Unable to save this alert."));
      setBusy(false);
    }
  };

  const range = spec.exclusiveMin ? `Above ${spec.min}, up to ${spec.max}.` : `From ${spec.min} to ${spec.max}.`;
  return (
    <DialogShell
      icon={<BellRing className="h-5 w-5" />}
      title={rule ? "Edit alert" : "New alert"}
      subtitle="Checked every morning. What it finds today shows on the page; you're told only of what's new."
      busy={busy}
      error={error}
      submitLabel={rule ? "Save" : "Add alert"}
      canSubmit={valid}
      onSubmit={() => void save()}
      onClose={onClose}
      wide
    >
      <Field label="Property" hint={rule ? "An alert's property can't change: delete it and add another." : undefined}>
        <select value={propertyUuid} onChange={(e) => setPropertyUuid(e.target.value)} disabled={!!rule} className={INPUT}>
          <option value="">Every property</option>
          {properties.map((p) => <option key={p.uuid} value={p.uuid}>{p.name}</option>)}
          {rule?.propertyUuid && !properties.some((p) => p.uuid === rule.propertyUuid) && <option value={rule.propertyUuid}>An archived property</option>}
        </select>
      </Field>

      <div className="space-y-1.5">
        <span className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Tell me when</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ALERT_TYPE_LIST.map((t) => {
            const Icon = ALERT_ICONS[t];
            const on = t === type;
            return (
              <button
                key={t}
                type="button"
                onClick={() => pickType(t)}
                aria-pressed={on}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${on ? "border-[#C49A3C] bg-[#C49A3C]/5" : "border-slate-200 hover:border-[#C49A3C]/50"}`}
              >
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${on ? "text-[#C49A3C]" : "text-slate-400"}`} />
                <span>
                  <span className="block text-[13px] font-bold text-slate-900">{ALERT_TYPES[t].label}</span>
                  <span className="block text-[11px] text-slate-500 leading-snug">{ALERT_TYPES[t].desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        <Field label={spec.label} hint={range}>
          <div className="flex items-center gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode={spec.decimal ? "decimal" : "numeric"}
              className={`${INPUT.replace("w-full", "")} min-w-0 flex-1`}
              aria-invalid={!valid}
            />
            {spec.unit && <span className="text-sm font-bold text-slate-500">{spec.unit}</span>}
          </div>
        </Field>
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
      </div>
      {params && <p className="text-[12px] font-semibold text-slate-500">“{alertRuleText(params)}”</p>}
    </DialogShell>
  );
}
