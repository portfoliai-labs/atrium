// components/dashboard/CompareStrategyPicker.tsx
"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { publicationService } from "../../services/publicationService";
import type { CatalogPage } from "../../models/PublishedStrategy";
import { ConfirmDialog } from "./ConfirmDialog";

const PAGE_SIZE = 10;

/**
 * COMPARE STRATEGY PICKER — adds published strategies of the catalog (GET /v1/explore/strategies,
 * newest first, a page at a time) to Compare: up to `room` of them, those already compared
 * (`excluded`, by portfolioUuid) left out.
 */
export function CompareStrategyPicker({ room, excluded, onAdd, onClose }: {
  room: number;
  excluded: string[];
  onAdd: (strategies: { uuid: string; name: string }[]) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<{ page: number; data: CatalogPage | null; error: string | null } | null>(null);
  const [picked, setPicked] = useState<{ uuid: string; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    publicationService.list({ limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((data) => { if (!cancelled) setResult({ page, data, error: null }); })
      .catch((err) => { if (!cancelled) setResult({ page, data: null, error: err instanceof Error ? err.message : "Unable to load the catalog." }); });
    return () => { cancelled = true; };
  }, [page]);

  const current = result?.page === page ? result : null;
  const total = current?.data?.total ?? 0;
  const toggle = (uuid: string, name: string) => setPicked((prev) => (
    prev.some((p) => p.uuid === uuid) ? prev.filter((p) => p.uuid !== uuid) : prev.length >= room ? prev : [...prev, { uuid, name }]
  ));

  return (
    <ConfirmDialog
      title="Add strategies to compare"
      description={room > 0
        ? `Strategies advisors published in Explore, simulated: pick up to ${room} to compare beside the others.`
        : "Compare is full: take a column out to add a strategy."}
      confirmLabel={picked.length > 1 ? `Add ${picked.length}` : "Add"}
      tone="neutral"
      onConfirm={() => { if (picked.length > 0) onAdd(picked); }}
      onClose={onClose}
    >
      {current === null ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#C49A3C]" /></div>
      ) : current.error ? (
        <p className="text-xs font-semibold text-rose-600">{current.error}</p>
      ) : current.data && current.data.strategies.length === 0 ? (
        <p className="text-xs text-slate-500">No strategies published yet.</p>
      ) : (
        <div className="space-y-3">
          <ul className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-72 overflow-y-auto custom-scrollbar">
            {current.data?.strategies.map((s) => {
              const already = excluded.includes(s.portfolioUuid);
              const on = picked.some((p) => p.uuid === s.portfolioUuid);
              const blocked = already || (!on && picked.length >= room);
              return (
                <li key={s.publicationId}>
                  <button
                    type="button"
                    onClick={() => toggle(s.portfolioUuid, s.portfolioName)}
                    disabled={blocked}
                    aria-pressed={on}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center ${on || already ? "bg-[#C49A3C] border-[#C49A3C] text-white" : "border-slate-300 text-transparent"}`}>
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold text-slate-900 truncate">{s.portfolioName}</span>
                      <span className="block text-[11px] text-slate-400 truncate">
                        {already ? "Already compared" : `By ${s.authorName ?? "an advisor"}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span className="tabular-nums">{page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total}</span>
              <span className="flex gap-1.5">
                <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 0} aria-label="Previous page" className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total} aria-label="Next page" className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </span>
            </div>
          )}
        </div>
      )}
    </ConfirmDialog>
  );
}
