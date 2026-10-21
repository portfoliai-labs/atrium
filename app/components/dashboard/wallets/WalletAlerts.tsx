// components/dashboard/wallets/WalletAlerts.tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, BellRing, CircleCheck, Pencil, Plus, Receipt, Target, Trash2, Wallet as WalletIcon } from "lucide-react";
import { useWallets } from "../../../context/WalletsContext";
import { walletService } from "../../../services/walletService";
import {
  ALERT_TYPES, ALERT_TYPE_LIST, alertFindingText, alertRuleText, currentAlertFindings, dayLabel, errorText, type CategoryTree,
} from "../../../lib/wallets";
import type { Wallet, WalletAlertParams, WalletAlertRule, WalletAlertRuleUpdateRequest, WalletAlertType } from "../../../models/Wallet";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { ConfirmDialog } from "../ConfirmDialog";
import { Toggle } from "../Toggle";
import { DialogShell, Field, INPUT, parseAmount } from "./WalletDialogs";
import { CategoryOptions } from "./WalletCategories";
import { DEMO_DISABLED_TITLE } from "../../preview/DemoBanner";

export const WALLET_ALERT_ICONS: Record<WalletAlertType, React.ComponentType<{ className?: string }>> = {
  low_balance: WalletIcon,
  budget_threshold: Target,
  large_payment: Receipt,
  income_received: ArrowDownLeft,
};

const channelsText = (r: Pick<WalletAlertRule, "notifyEmail" | "notifyInApp">) =>
  r.notifyEmail && r.notifyInApp ? "By email and in the app" : r.notifyEmail ? "By email" : r.notifyInApp ? "In the app" : "Not notified";

/**
 * WALLET ALERTS — the rules that watch the wallets (a low balance, a budget running out, a large
 * payment, the salary in), each on one wallet or on every one, and what they find today. Every
 * morning each rule switched on is checked and tells, by email and/or in the app, only what it
 * hadn't found before: what a rule finds when it's made, changed or switched on shows here but
 * isn't told. On a wallet (`scope`), its rules (its own and those on every wallet) and only its
 * findings. A demo account's are sample rules, read only.
 */
export function WalletAlerts({ scope }: { scope: string | null }) {
  const { wallets, categories, source, version, sample } = useWallets();
  const key = `${scope ?? "all"}:${version}`;
  // The list as read, then as the writes left it (no refetch for a toggle).
  const [state, setState] = useState<{ key: string; rules: WalletAlertRule[] | null; error: string | null } | null>(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<WalletAlertRule | "new" | null>(null);
  const [deleting, setDeleting] = useState<WalletAlertRule | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    source.alertRules(scope)
      .then((rules) => { if (!cancelled) setState({ key, rules, error: null }); })
      .catch((err) => { if (!cancelled) setState({ key, rules: null, error: errorText(err, "Unable to load the alerts.") }); });
    return () => { cancelled = true; };
  }, [source, scope, key, reload]);

  const rules = state?.key === key ? state.rules : undefined;
  const replace = (rule: WalletAlertRule) =>
    setState((s) => s && { ...s, rules: s.rules?.map((r) => (r.uuid === rule.uuid ? rule : r)) ?? null });
  const walletOf = (uuid: string | null) => (uuid ? wallets.find((w) => w.uuid === uuid) : undefined);
  const nameOf = (uuid: string | null) => (uuid ? walletOf(uuid)?.name ?? "A wallet" : "Every wallet");
  const ruleText = (r: Pick<WalletAlertRule, "params" | "walletUuid">) => alertRuleText(r.params, walletOf(r.walletUuid)?.currency ?? "EUR", categories);
  const findingsOf = (r: WalletAlertRule) => (scope ? r.findings.filter((f) => f.walletUuid === scope || f.walletUuid === null) : r.findings);
  const findings = rules ? currentAlertFindings(rules).filter((f) => !scope || f.walletUuid === scope || f.walletUuid === null) : [];

  const toggle = async (rule: WalletAlertRule, enabled: boolean) => {
    setBusy(rule.uuid);
    setError(null);
    try {
      replace(await walletService.updateAlertRule(rule.uuid, { enabled }));
    } catch (err) {
      setError(errorText(err, "Unable to change this rule."));
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy(deleting.uuid);
    setError(null);
    try {
      await walletService.removeAlertRule(deleting.uuid);
      setDeleting(null);
      setReload((n) => n + 1);
    } catch (err) {
      setError(errorText(err, "Unable to delete this rule."));
    } finally {
      setBusy(null);
    }
  };

  if (rules === undefined) return <p className="text-[13px] text-[#857e78]">Loading…</p>;
  if (rules === null) return <p className="text-[13px] font-semibold text-rose-600">{state?.error}</p>;

  const archived = !!walletOf(scope)?.archived;
  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing("new")}
          disabled={sample || archived}
          title={sample ? DEMO_DISABLED_TITLE : archived ? "An archived wallet is read only" : undefined}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#1c1917] text-white hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:hover:bg-[#1c1917] disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" /> New alert
        </button>
      </div>

      {rules.some((r) => r.enabled) && (
        <Module>
          <ModuleHead title="Needs a look" desc={scope ? `What the rules find on ${nameOf(scope)} today.` : "What the rules find today."} />
          <div className={MODULE_BODY}>
            {findings.length === 0 ? (
              <p className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700">
                <CircleCheck className="h-4 w-4" /> Nothing today: every rule switched on is clear.
              </p>
            ) : (
              <ul className="divide-y divide-[#EEE9DD]">
                {findings.map((f) => {
                  const Icon = WALLET_ALERT_ICONS[f.kind];
                  const text = alertFindingText(f);
                  return (
                    <li key={`${f.kind}:${f.key}`} className="flex items-center gap-3 py-2.5">
                      <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0"><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-bold text-slate-800">{text.title}</span>
                        <span className="block text-[11.5px] text-slate-500">{text.detail}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
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
            <p className="text-[12.5px] text-[#857e78]">
              No alert yet. Add one to be told when a balance runs low, a budget is nearly used up, a large payment goes out or
              your salary comes in.
            </p>
          ) : (
            <ul className="divide-y divide-[#EEE9DD]">
              {rules.map((r) => {
                const Icon = WALLET_ALERT_ICONS[r.params.type];
                const found = findingsOf(r).length;
                const meta = [
                  nameOf(r.walletUuid),
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
                        {ruleText(r)}
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
                      label={ruleText(r)}
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

      {editing && (
        <AlertRuleDialog
          rule={editing === "new" ? undefined : editing}
          wallets={wallets.filter((w) => !w.archived)}
          initialWalletUuid={scope}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setReload((n) => n + 1); }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this alert?"
          description={`“${ruleText(deleting)}” on ${deleting.walletUuid ? nameOf(deleting.walletUuid) : "every wallet"} stops being checked. This can't be undone.`}
          confirming={busy === deleting.uuid}
          error={error}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}

/** The value a rule's form starts from: its own, or the type's default (the salary, or the first money-in category). */
function initialValue(type: WalletAlertType, tree: CategoryTree, rule?: WalletAlertRule): string {
  const params = rule?.params.type === type ? rule.params : undefined;
  switch (type) {
    case "low_balance":
      return params?.type === "low_balance" ? params.threshold : "500";
    case "budget_threshold":
      return params?.type === "budget_threshold" ? params.thresholdPct : "90";
    case "large_payment":
      return params?.type === "large_payment" ? params.threshold : "250";
    case "income_received":
      return params?.type === "income_received" ? params.categoryUuid : (tree.preset("salary") ?? tree.active("income")[0])?.uuid ?? "";
  }
}

/** A rule's params as they're sent: a money-in category by its uuid alone. */
const sentParams = (p: WalletAlertParams): WalletAlertParams => (p.type === "income_received" ? { type: p.type, categoryUuid: p.categoryUuid } : p);

/**
 * A rule, new or to change: what it watches (fixed once made), the wallet (one, every one, or
 * either, as the type takes; fixed once made), its number or category, and how it tells.
 */
function AlertRuleDialog({ rule, wallets, initialWalletUuid, onClose, onSaved }: {
  rule?: WalletAlertRule;
  wallets: Wallet[];
  initialWalletUuid: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { categories } = useWallets();
  const [type, setType] = useState<WalletAlertType>(rule?.params.type ?? "low_balance");
  const [walletUuid, setWalletUuid] = useState<string>(rule ? rule.walletUuid ?? "" : initialWalletUuid ?? wallets[0]?.uuid ?? "");
  const [value, setValue] = useState(initialValue(type, categories, rule));
  const [notifyEmail, setNotifyEmail] = useState(rule?.notifyEmail ?? true);
  const [notifyInApp, setNotifyInApp] = useState(rule?.notifyInApp ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scope = ALERT_TYPES[type].wallet;
  const wallet = wallets.find((w) => w.uuid === walletUuid);
  const currency = wallet?.currency ?? "EUR";
  const parsed = parseAmount(value);
  let params: WalletAlertParams | null = null;
  if (type === "income_received") params = value ? { type, categoryUuid: value } : null;
  else if (parsed !== null && type === "low_balance") params = { type, threshold: parsed };
  else if (parsed !== null && type === "large_payment" && Number(parsed) > 0) params = { type, threshold: parsed };
  else if (parsed !== null && type === "budget_threshold" && Number(parsed) > 0 && Number(parsed) <= 200) params = { type, thresholdPct: parsed };
  const valid = params !== null && (scope !== "one" || !!walletUuid);

  const pickType = (t: WalletAlertType) => {
    setType(t);
    setValue(initialValue(t, categories, rule));
    if (ALERT_TYPES[t].wallet === "one" && !walletUuid) setWalletUuid(initialWalletUuid ?? wallets[0]?.uuid ?? "");
  };

  const save = async () => {
    if (!params) return;
    setBusy(true);
    setError(null);
    try {
      if (rule) {
        // Only what changed: new params make what the rule finds now known again, not told.
        const changes: WalletAlertRuleUpdateRequest = {};
        if (JSON.stringify(params) !== JSON.stringify(sentParams(rule.params))) changes.params = params;
        if (notifyEmail !== rule.notifyEmail) changes.notifyEmail = notifyEmail;
        if (notifyInApp !== rule.notifyInApp) changes.notifyInApp = notifyInApp;
        if (Object.keys(changes).length > 0) await walletService.updateAlertRule(rule.uuid, changes);
      } else {
        await walletService.addAlertRule({ walletUuid: scope === "all" ? null : walletUuid || null, params, notifyEmail, notifyInApp });
      }
      onSaved();
    } catch (err) {
      setError(errorText(err, "Unable to save this alert."));
      setBusy(false);
    }
  };

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
      <div className="space-y-1.5">
        <span className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Tell me when</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ALERT_TYPE_LIST.map((t) => {
            const Icon = WALLET_ALERT_ICONS[t];
            const on = t === type;
            return (
              <button
                key={t}
                type="button"
                onClick={() => pickType(t)}
                disabled={!!rule && t !== rule.params.type}
                aria-pressed={on}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${on ? "border-[#C49A3C] bg-[#C49A3C]/5" : "border-slate-200 hover:border-[#C49A3C]/50"}`}
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
        {scope === "all" ? (
          <Field label="Wallets" hint="Budgets are across all your wallets.">
            <input className={INPUT} value="Every wallet" disabled />
          </Field>
        ) : (
          <Field label="Wallet" hint={rule ? "An alert's wallet can't change: delete it and add another." : undefined}>
            <select value={walletUuid} onChange={(e) => setWalletUuid(e.target.value)} disabled={!!rule} className={INPUT}>
              {scope === "either" && <option value="">Every wallet</option>}
              {wallets.map((w) => <option key={w.uuid} value={w.uuid}>{w.name}</option>)}
              {rule?.walletUuid && !wallets.some((w) => w.uuid === rule.walletUuid) && <option value={rule.walletUuid}>An archived wallet</option>}
            </select>
          </Field>
        )}
        {type === "income_received" ? (
          <Field label="Coming in as" hint="Its subcategories' money in counts too.">
            <select value={value} onChange={(e) => setValue(e.target.value)} className={INPUT}>
              <CategoryOptions kind="income" />
            </select>
          </Field>
        ) : (
          <Field
            label={type === "low_balance" ? "Balance under" : type === "large_payment" ? "Payments from" : "Share of the limit"}
            hint={type === "budget_threshold" ? "Above 0, up to 200%." : type === "low_balance" ? "In the wallet's currency; negative for a card." : "In the wallet's currency."}
          >
            <div className="flex items-center gap-2">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputMode="decimal"
                className={`${INPUT.replace("w-full", "")} min-w-0 flex-1`}
                aria-invalid={params === null}
              />
              <span className="text-sm font-bold text-slate-500">{type === "budget_threshold" ? "%" : currency}</span>
            </div>
          </Field>
        )}
      </div>

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
      {params && <p className="text-[12px] font-semibold text-slate-500">“{alertRuleText(params, currency, categories)}”</p>}
    </DialogShell>
  );
}
