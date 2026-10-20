// components/dashboard/ManualAssetsEditor.tsx
"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useUser } from "../../context/UserContext";
import { manualAssetService } from "../../services/manualAssetService";
import { ApiError } from "../../services/apiClient";
import { formatCurrency } from "../../lib/format";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";
import { STRATEGY_CATEGORIES, STRATEGY_CATEGORY_LABELS, type StrategyCategory } from "../../models/Strategy";
import {
  MANUAL_ASSET_IN_USE, MANUAL_ASSET_NAME_MAX, MANUAL_VALUATIONS_MAX, type ManualAsset, type ManualValuation,
} from "../../models/ManualAsset";
import { ConfirmDialog } from "./ConfirmDialog";

const INPUT = "h-10 px-3 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal focus:border-slate-300 focus:ring-4 focus:ring-slate-50";
// Today in the user's own time zone, as YYYY-MM-DD.
const today = () => new Date().toLocaleDateString("en-CA");
const dateLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/**
 * MANUAL ASSETS — the user's investments with no market price (GET /v1/manual-assets): unlisted
 * shares, private equity, a loan, physical gold, each valued by hand. Created here with a name, a
 * currency (fixed from then on) and a category, then picked in a transaction like a security.
 * Each row renames it, sets its category, and opens its valuations: a price per day (per unit, or
 * the whole holding's when it was bought as 1 unit), each holding until the next, the purchase
 * price before the first. A valuation is added or replaced by day (PUT) and removed (DELETE); the
 * portfolios holding it are computed again. Deleting the asset is refused while a transaction is
 * on it. With `clientUuid`, an advisor's view of a client's. A demo account sees them but can't
 * change them.
 */
export function ManualAssetsEditor({ clientUuid }: { clientUuid?: string }) {
  const { isDemo } = useUser();
  const [assets, setAssets] = useState<ManualAsset[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ManualAsset | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    manualAssetService.list(clientUuid)
      .then((list) => { if (!cancelled) setAssets(list); })
      .catch((err) => { if (!cancelled) setLoadError(errorText(err, "Unable to load the manual assets.")); });
    return () => { cancelled = true; };
  }, [clientUuid]);

  const replace = (asset: ManualAsset) => setAssets((prev) => prev?.map((a) => (a.uuid === asset.uuid ? asset : a)) ?? prev);

  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await manualAssetService.remove(deleting.uuid);
      setAssets((prev) => prev?.filter((a) => a.uuid !== deleting.uuid) ?? prev);
      setDeleting(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError && err.errorType === MANUAL_ASSET_IN_USE
        ? "It's in some transactions: delete those first, then the asset."
        : errorText(err, "Unable to delete it."));
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loadError) return <p className="text-sm font-semibold text-rose-600">{loadError}</p>;
  if (assets === null) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" /></div>;
  }
  const demo = isDemo ? { disabled: true, title: DEMO_DISABLED_TITLE } : {};

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 md:px-7 pt-5 pb-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900">Manual assets</h3>
            <p className="text-xs text-slate-500 mt-0.5">{assets.length === 0 ? "None yet." : `${assets.length} valued by hand.`}</p>
          </div>
          {!creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              {...demo}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#1c1917]"
            >
              <Plus className="h-3.5 w-3.5" /> New manual asset
            </button>
          )}
        </div>

        {creating && (
          <CreateForm
            clientUuid={clientUuid}
            onCancel={() => setCreating(false)}
            onCreated={(asset) => {
              setAssets((prev) => [...(prev ?? []), asset]);
              setCreating(false);
              setOpen(asset.uuid);
            }}
          />
        )}

        {assets.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {assets.map((a) => (
              <AssetRow
                key={a.uuid}
                asset={a}
                expanded={open === a.uuid}
                readOnly={isDemo}
                onToggle={() => setOpen(open === a.uuid ? null : a.uuid)}
                onChanged={replace}
                onDelete={() => { setDeleteError(null); setDeleting(a); }}
              />
            ))}
          </ul>
        )}
      </section>

      {deleting && (
        <ConfirmDialog
          title="Delete this manual asset?"
          description={`${deleting.name} and its valuations go. It can't be deleted while a transaction is on it.`}
          confirming={deleteBusy}
          error={deleteError}
          onConfirm={() => { void remove(); }}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function CategorySelect({ value, onChange, disabled }: { value: StrategyCategory | null; onChange: (c: StrategyCategory | null) => void; disabled?: boolean }) {
  return (
    <span className="relative inline-block">
      <select
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || null) as StrategyCategory | null)}
        disabled={disabled}
        aria-label="Category"
        className={`${INPUT} pr-8 appearance-none w-40 disabled:bg-slate-50`}
      >
        <option value="">No category</option>
        {STRATEGY_CATEGORIES.map((c) => <option key={c} value={c}>{STRATEGY_CATEGORY_LABELS[c]}</option>)}
      </select>
      <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </span>
  );
}

function CreateForm({ clientUuid, onCancel, onCreated }: { clientUuid?: string; onCancel: () => void; onCreated: (a: ManualAsset) => void }) {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [category, setCategory] = useState<StrategyCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem = name.trim() === "" ? "Give it a name."
    : name.trim().length > MANUAL_ASSET_NAME_MAX ? `The name is ${MANUAL_ASSET_NAME_MAX} characters at most.`
      : !/^[A-Z]{3}$/.test(currency.trim().toUpperCase()) ? "The currency is a 3-letter code (EUR, USD…)."
        : null;

  const submit = async () => {
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onCreated(await manualAssetService.create({ name: name.trim(), currency: currency.trim().toUpperCase(), category }, clientUuid));
    } catch (err) {
      setError(errorText(err, "Unable to create it."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="px-6 md:px-7 py-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block flex-1 min-w-48">
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={MANUAL_ASSET_NAME_MAX} placeholder="Family business shares" className={`${INPUT} w-full`} autoFocus />
        </label>
        <label className="block">
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Currency</span>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} className={`${INPUT} w-24 uppercase`} />
        </label>
        <label className="block">
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</span>
          <CategorySelect value={category} onChange={setCategory} />
        </label>
      </div>
      <p className="text-[11px] text-slate-400">The currency can&apos;t be changed later. Its transactions are in it.</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-rose-600">{error}</span>
        <span className="flex items-center gap-2">
          <button type="button" onClick={onCancel} disabled={saving} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create
          </button>
        </span>
      </div>
    </form>
  );
}

function AssetRow({ asset, expanded, readOnly, onToggle, onChanged, onDelete }: {
  asset: ManualAsset;
  expanded: boolean;
  readOnly: boolean;
  onToggle: () => void;
  onChanged: (a: ManualAsset) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (payload: { name?: string; category?: StrategyCategory | null }) => {
    setBusy(true);
    setError(null);
    try {
      onChanged(await manualAssetService.update(asset.uuid, payload));
      setRenaming(null);
    } catch (err) {
      setError(errorText(err, "Unable to save this change."));
    } finally {
      setBusy(false);
    }
  };

  const latest = asset.latestValuation;
  const demo = readOnly ? { disabled: true, title: DEMO_DISABLED_TITLE } : {};

  return (
    <li>
      <div className="px-6 md:px-7 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex items-center gap-2 min-w-0 flex-1 text-left">
          {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
          <span className="min-w-0">
            {renaming === null ? (
              <span className="block text-[13px] font-black text-slate-900 truncate">{asset.name}</span>
            ) : null}
            <span className="block text-[11px] font-semibold text-slate-500">
              {asset.currency} · {latest ? `${formatCurrency(latest.price, asset.currency)} on ${dateLabel(latest.valuedOn)}` : "Not valued yet: its purchase price holds"}
            </span>
          </span>
        </button>
        {renaming !== null && (
          <form onSubmit={(e) => { e.preventDefault(); if (renaming.trim()) void update({ name: renaming.trim() }); }} className="flex items-center gap-2 order-first basis-full sm:basis-auto sm:order-none">
            <input value={renaming} onChange={(e) => setRenaming(e.target.value)} maxLength={MANUAL_ASSET_NAME_MAX} aria-label="Name" className={`${INPUT} w-56`} autoFocus />
            <button type="submit" disabled={busy || !renaming.trim()} className="px-3 py-2 rounded-xl bg-[#1c1917] text-white text-xs font-bold disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setRenaming(null)} aria-label="Cancel" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </form>
        )}
        <span className="flex items-center gap-2">
          <CategorySelect value={asset.category} onChange={(category) => void update({ category })} disabled={busy || readOnly} />
          {renaming === null && (
            <button type="button" onClick={() => setRenaming(asset.name)} {...demo} aria-label={`Rename ${asset.name}`} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40">
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={onDelete} {...demo} aria-label={`Delete ${asset.name}`} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40">
            <Trash2 className="h-4 w-4" />
          </button>
        </span>
      </div>
      {error && <p className="px-6 md:px-7 pb-3 flex items-center gap-1.5 text-xs font-semibold text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /> {error}</p>}
      {expanded && <Valuations asset={asset} readOnly={readOnly} onLatest={(latestValuation) => onChanged({ ...asset, latestValuation })} />}
    </li>
  );
}

type Draft = { valuedOn: string; price: string };

/**
 * An asset's valuations, newest first, each removable, and new ones added by day (one already
 * there is replaced). No day twice, none in the future, at most MANUAL_VALUATIONS_MAX at once.
 */
function Valuations({ asset, readOnly, onLatest }: { asset: ManualAsset; readOnly: boolean; onLatest: (v: ManualValuation | null) => void }) {
  const [list, setList] = useState<ManualValuation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([{ valuedOn: today(), price: "" }]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    manualAssetService.valuations(asset.uuid)
      .then((v) => { if (!cancelled) setList(v); })
      .catch((err) => { if (!cancelled) { setList([]); setError(errorText(err, "Unable to load the valuations.")); } });
    return () => { cancelled = true; };
  }, [asset.uuid]);

  const take = (next: ManualValuation[]) => {
    setList(next);
    onLatest(next.length > 0 ? next[next.length - 1] : null);
  };

  const filled = drafts.filter((d) => d.valuedOn || d.price.trim());
  const parsePrice = (s: string) => Number(s.replace(",", ".").trim());
  const days = filled.map((d) => d.valuedOn);
  const problem = filled.length === 0 ? null
    : filled.some((d) => !d.valuedOn) ? "Each valuation needs its day."
      : filled.some((d) => d.valuedOn > today()) ? "A valuation can't be in the future."
        : new Set(days).size !== days.length ? "Each day once."
          : filled.some((d) => d.price.trim() === "" || !Number.isFinite(parsePrice(d.price)) || parsePrice(d.price) < 0) ? "Each price is a number, 0 or more."
            : filled.length > MANUAL_VALUATIONS_MAX ? `At most ${MANUAL_VALUATIONS_MAX} at once.`
              : null;

  const save = async () => {
    if (problem || filled.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      take(await manualAssetService.setValuations(asset.uuid, filled.map((d) => ({ valuedOn: d.valuedOn, price: d.price.replace(",", ".").trim() }))));
      setDrafts([{ valuedOn: today(), price: "" }]);
    } catch (err) {
      setError(errorText(err, "Unable to save the valuations."));
    } finally {
      setSaving(false);
    }
  };

  const removeSelected = async () => {
    setSaving(true);
    setError(null);
    try {
      take(await manualAssetService.removeValuations(asset.uuid, [...selected]));
      setSelected(new Set());
    } catch (err) {
      setError(errorText(err, "Unable to remove them."));
    } finally {
      setSaving(false);
    }
  };

  const newestFirst = list ? [...list].reverse() : [];

  return (
    <div className="px-6 md:px-7 pb-5 pl-12 space-y-4">
      <p className="text-[11px] text-slate-500 max-w-2xl">
        The price per unit on each day (or the whole holding&apos;s, if you bought it as 1 unit), in {asset.currency}. Each one holds until the next; before the first, the purchase price does.
      </p>

      {!readOnly && (
        <div className="space-y-2">
          {drafts.map((d, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={d.valuedOn}
                max={today()}
                onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, valuedOn: e.target.value } : x)))}
                aria-label="Day"
                className={`${INPUT} w-40`}
              />
              <span className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={d.price}
                  placeholder="Price"
                  onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
                  aria-label="Price"
                  className={`${INPUT} w-40 pr-12 text-right tabular-nums`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">{asset.currency}</span>
              </span>
              {drafts.length > 1 && (
                <button type="button" onClick={() => setDrafts(drafts.filter((_, j) => j !== i))} aria-label="Remove this row" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setDrafts([...drafts, { valuedOn: "", price: "" }])} className="flex items-center gap-1 text-xs font-bold text-[#C49A3C] hover:text-[#a87f2f]">
              <Plus className="h-3.5 w-3.5" /> Another day
            </button>
            <button
              type="button"
              onClick={() => { void save(); }}
              disabled={saving || filled.length === 0 || problem !== null}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save {filled.length > 1 ? `${filled.length} valuations` : "valuation"}
            </button>
            {problem && <span className="text-xs font-semibold text-amber-700">{problem}</span>}
          </div>
        </div>
      )}

      {error && <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /> {error}</p>}

      {list === null ? (
        <Loader2 className="h-5 w-5 animate-spin text-[#C49A3C]" />
      ) : list.length === 0 ? (
        <p className="text-xs text-slate-400">No valuations yet.</p>
      ) : (
        <div className="space-y-2">
          <ul className="max-w-md border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-72 overflow-y-auto custom-scrollbar">
            {newestFirst.map((v) => (
              <li key={v.valuedOn} className="flex items-center gap-3 px-4 py-2 text-xs">
                {!readOnly && (
                  <input
                    type="checkbox"
                    className="accent-blue-600 w-4 h-4"
                    checked={selected.has(v.valuedOn)}
                    aria-label={`Select ${dateLabel(v.valuedOn)}`}
                    onChange={() => setSelected((s) => {
                      const next = new Set(s);
                      if (next.has(v.valuedOn)) next.delete(v.valuedOn);
                      else next.add(v.valuedOn);
                      return next;
                    })}
                  />
                )}
                <span className="flex-1 font-semibold text-slate-600">{dateLabel(v.valuedOn)}</span>
                <span className="font-bold tabular-nums text-slate-900">{formatCurrency(v.price, asset.currency)}</span>
              </li>
            ))}
          </ul>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => { void removeSelected(); }}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove {selected.size} {selected.size === 1 ? "valuation" : "valuations"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
