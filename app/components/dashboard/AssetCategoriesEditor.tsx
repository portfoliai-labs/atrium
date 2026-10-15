// components/dashboard/AssetCategoriesEditor.tsx
"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, Loader2, RotateCcw } from "lucide-react";
import { useUser } from "../../context/UserContext";
import { assetCategoryService } from "../../services/assetCategoryService";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";
import { STRATEGY_CATEGORIES, STRATEGY_CATEGORY_LABELS, type StrategyCategory } from "../../models/Strategy";
import type { AssetCategoryEntry } from "../../models/AssetCategory";

/**
 * ASSET CATEGORIES — the economic category of every security in the user's portfolios (GET
 * /v1/asset-categories), the one category alerts and adopting a strategy "in categories" weigh a
 * portfolio by. Each row shows the category that counts in a select, with the one suggested under
 * it; picking another corrects it right away (PUT), in all the user's portfolios, and "Restore
 * suggestion" drops the correction (DELETE). Securities without a category come first,
 * highlighted: they count towards no category. Corrections on securities no longer held are kept,
 * listed apart at the foot. With `clientUuid`, an advisor's view of a client's (the corrections
 * stay the client's). A demo account sees them but can't change them.
 */
export function AssetCategoriesEditor({ clientUuid }: { clientUuid?: string }) {
  const { isDemo } = useUser();
  const [entries, setEntries] = useState<AssetCategoryEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The rows with a change on its way, and the last change each one couldn't make.
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [showGone, setShowGone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    assetCategoryService.list(clientUuid)
      .then((list) => { if (!cancelled) setEntries(list); })
      .catch((err) => { if (!cancelled) setLoadError(err instanceof Error ? err.message : "Unable to load the categories."); });
    return () => { cancelled = true; };
  }, [clientUuid]);

  // Both writes answer with the whole list as it is then.
  const change = async (assetId: string, write: () => Promise<AssetCategoryEntry[]>) => {
    setBusy((b) => new Set(b).add(assetId));
    setRowErrors((e) => Object.fromEntries(Object.entries(e).filter(([id]) => id !== assetId)));
    try {
      setEntries(await write());
    } catch (err) {
      setRowErrors((e) => ({ ...e, [assetId]: err instanceof Error ? err.message : "Unable to save this change." }));
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(assetId);
        return next;
      });
    }
  };
  const correct = (assetId: string, category: StrategyCategory) =>
    change(assetId, () => assetCategoryService.correct([{ assetId, category }], clientUuid));
  const restore = (assetId: string) =>
    change(assetId, () => assetCategoryService.restore([assetId], clientUuid));

  if (loadError) return <p className="text-sm font-semibold text-rose-600">{loadError}</p>;
  if (entries === null) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" />
      </div>
    );
  }

  // Held first, those without a category leading; then the corrections no longer held.
  const held = entries.filter((e) => e.held);
  const sorted = [...held.filter((e) => e.category === null), ...held.filter((e) => e.category !== null)];
  const gone = entries.filter((e) => !e.held);
  const missing = held.length - held.filter((e) => e.category !== null).length;

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 md:px-7 pt-5 pb-4 border-b border-slate-100">
          <h3 className="text-sm font-black text-slate-900">Securities</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {held.length} {held.length === 1 ? "security" : "securities"}
            {missing > 0 && <span className="font-bold text-amber-700"> · {missing} without a category</span>}
          </p>
        </div>
        {sorted.length === 0 ? (
          <p className="px-6 md:px-7 py-6 text-sm text-slate-500">
            No securities yet: once your portfolios hold some, their categories show up here.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sorted.map((e) => (
              <CategoryRow
                key={e.assetId}
                entry={e}
                busy={busy.has(e.assetId)}
                error={rowErrors[e.assetId]}
                readOnly={isDemo}
                onCorrect={(c) => correct(e.assetId, c)}
                onRestore={() => restore(e.assetId)}
              />
            ))}
          </ul>
        )}
      </section>

      {gone.length > 0 && (
        <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowGone((s) => !s)}
            aria-expanded={showGone}
            className="w-full flex items-center justify-between gap-4 px-6 md:px-7 py-4 text-left"
          >
            <span>
              <span className="block text-sm font-black text-slate-900">No longer held</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                {gone.length} {gone.length === 1 ? "correction" : "corrections"} kept for securities you no longer hold, in case you buy them again
              </span>
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${showGone ? "rotate-180" : ""}`} />
          </button>
          {showGone && (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {gone.map((e) => (
                <li key={e.assetId} className="px-6 md:px-7 py-3 flex items-center justify-between gap-4">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-slate-900 truncate">{e.assetId}</span>
                    <span className="block text-[11px] text-slate-500">
                      {e.corrected ? STRATEGY_CATEGORY_LABELS[e.corrected] : "—"}
                    </span>
                    {rowErrors[e.assetId] && <span className="block text-[11px] font-semibold text-rose-600 mt-0.5">{rowErrors[e.assetId]}</span>}
                  </span>
                  <RestoreButton busy={busy.has(e.assetId)} readOnly={isDemo} onClick={() => restore(e.assetId)} label="Remove correction" />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * One held security: its name, ticker and ISIN, what's suggested for it, and the category that
 * counts in a select. Highlighted when it has none.
 */
function CategoryRow({ entry, busy, error, readOnly, onCorrect, onRestore }: {
  entry: AssetCategoryEntry;
  busy: boolean;
  error?: string;
  readOnly: boolean;
  onCorrect: (category: StrategyCategory) => void;
  onRestore: () => void;
}) {
  const uncategorized = entry.category === null;
  const ids = [entry.ticker, entry.isin && entry.isin !== entry.ticker ? entry.isin : null].filter(Boolean).join(" · ");

  return (
    <li className={`px-6 md:px-7 py-3.5 ${uncategorized ? "bg-amber-50/60" : ""}`}>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_13rem] items-center gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {uncategorized && <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
            <span className="text-[13px] font-black text-slate-900 truncate">{entry.name ?? entry.ticker ?? entry.assetId}</span>
            {entry.corrected && (
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#C49A3C]/10 text-[10px] font-black uppercase tracking-wider text-[#8A6A28]">
                Corrected
              </span>
            )}
          </div>
          {ids && <p className="text-[11px] font-semibold text-slate-500 truncate mt-0.5">{ids}</p>}
          <p className="text-[11px] text-slate-500 mt-0.5">
            {entry.proposed ? `Suggested: ${STRATEGY_CATEGORY_LABELS[entry.proposed]}` : "No suggestion"}
            {uncategorized && (
              <span className="font-semibold text-amber-700"> · Counts towards no category in alerts or in adopting a strategy by category.</span>
            )}
          </p>
          {error && <p className="text-[11px] font-semibold text-rose-600 mt-1">{error}</p>}
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-1">
          <span className="relative flex items-center gap-2 w-full">
            <select
              value={entry.category ?? ""}
              onChange={(e) => onCorrect(e.target.value as StrategyCategory)}
              disabled={busy || readOnly}
              title={readOnly ? DEMO_DISABLED_TITLE : undefined}
              aria-label={`Category of ${entry.name ?? entry.assetId}`}
              className={`w-full h-10 pl-3 pr-9 rounded-xl border text-sm font-semibold outline-none appearance-none transition-all focus:ring-4 disabled:opacity-60 disabled:cursor-not-allowed ${
                uncategorized
                  ? "bg-white border-amber-300 text-slate-400 focus:border-amber-400 focus:ring-amber-50"
                  : "bg-white border-slate-200 text-slate-900 focus:border-[#C49A3C]/60 focus:ring-[#C49A3C]/10"
              }`}
            >
              {uncategorized && <option value="" disabled>Choose a category…</option>}
              {STRATEGY_CATEGORIES.map((c) => (
                <option key={c} value={c} className="text-slate-900">
                  {STRATEGY_CATEGORY_LABELS[c]}{c === entry.proposed ? " (suggested)" : ""}
                </option>
              ))}
            </select>
            {busy
              ? <Loader2 className="h-4 w-4 animate-spin text-slate-400 absolute right-3 pointer-events-none" />
              : <ChevronDown className="h-4 w-4 text-slate-400 absolute right-3 pointer-events-none" />}
          </span>
          {entry.corrected && (
            <RestoreButton busy={busy} readOnly={readOnly} onClick={onRestore} label={entry.proposed ? "Restore suggestion" : "Remove correction"} />
          )}
        </div>
      </div>
    </li>
  );
}

function RestoreButton({ busy, readOnly, onClick, label }: { busy: boolean; readOnly: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || readOnly}
      title={readOnly ? DEMO_DISABLED_TITLE : undefined}
      className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <RotateCcw className="h-3 w-3" />
      {label}
    </button>
  );
}
