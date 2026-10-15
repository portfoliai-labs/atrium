// components/dashboard/ClientStrategySharing.tsx
"use client";

import { useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { adoptionService } from "../../services/adoptionService";
import { ApiError } from "../../services/apiClient";
import type { AdoptedStrategy } from "../../models/AdoptedStrategy";
import { Toggle } from "./Toggle";

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

/**
 * CLIENT STRATEGY SHARING — on a client's portfolio's Strategy page (an advisor's): whether the
 * strategy the advisor adopted there is shared with the client (PUT .../adopted-strategy/sharing).
 * Shared, the client sees it read-only on that portfolio's Strategy page, with the backtest it came
 * from, and is notified; adopting another one stops sharing it.
 */
export function ClientStrategySharing({ portfolioUuid, adoption, clientName, onChange }: {
  portfolioUuid: string;
  adoption: AdoptedStrategy;
  clientName: string;
  onChange: (adoption: AdoptedStrategy) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shared = adoption.sharedWithClient;

  const setShared = async (next: boolean) => {
    setSaving(true);
    setError(null);
    try {
      onChange(await adoptionService.setShared(portfolioUuid, next));
    } catch (err) {
      setError(err instanceof ApiError && err.errorType === "AdoptionNotShareableError"
        ? "Only a strategy you adopted on a client's portfolio can be shared."
        : err instanceof Error ? err.message : "Unable to change the sharing.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`rounded-3xl border px-5 md:px-6 py-4 flex flex-wrap items-center justify-between gap-4 ${shared ? "bg-emerald-50/60 border-emerald-200" : "bg-white border-slate-200"}`}>
      <span className="flex items-start gap-3 min-w-0">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${shared ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {shared ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-black text-slate-900">
            {shared ? `Shared with ${clientName}` : `Not shared with ${clientName}`}
          </span>
          <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
            {shared && adoption.sharedAt
              ? `Since ${dateLabel(adoption.sharedAt)}: ${clientName} reads it on this portfolio, with your backtest, and can't change it.`
              : `Only you see it. Shared, ${clientName} reads it on this portfolio, with your backtest, and is notified.`}
          </span>
        </span>
      </span>
      <span className="flex items-center gap-2 shrink-0">
        {saving && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        <Toggle checked={shared} onChange={(v) => { if (!saving) void setShared(v); }} label={`Share the strategy with ${clientName}`} />
      </span>
      {error && <p className="basis-full flex items-center gap-2 text-xs font-medium text-rose-600"><AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}</p>}
    </section>
  );
}
