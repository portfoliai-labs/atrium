// components/dashboard/custody/CustodyField.tsx
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { CUSTODY_SOURCE_LABELS, type Custody, type CustodyRequest } from "../../../models/Custody";

type Choice = "unknown" | "intermediary" | "self";

/**
 * Who keeps a wallet's money or a portfolio's assets (models/Custody): an intermediary in a country
 * (two letters: IT, IE, LT…), the user's own keeping, or not known. Shows where the prefill comes
 * from; a change saves at once through `onSave` (null: back to the prefill). What the Taxes page's
 * taxes on holdings read: a bank or broker in Italy charges the stamp duty, one abroad leaves the
 * IVAFE to the user, crypto-assets on one's own addresses pay their own tax.
 */
export function CustodyField({ custody, onSave, disabled, ownKeeping = true }: {
  custody: Custody | null | undefined;
  onSave: (custody: CustodyRequest | null) => Promise<unknown>;
  disabled?: boolean;
  // Whether one's own keeping is offered (an on-chain address's; not a bank account's).
  ownKeeping?: boolean;
}) {
  const current: Choice = custody ? custody.kind : "unknown";
  const [country, setCountry] = useState(custody?.country ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (request: CustodyRequest | null) => {
    setSaving(true);
    setError(null);
    try {
      await onSave(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save who keeps it.");
    } finally {
      setSaving(false);
    }
  };
  const choose = (choice: Choice) => {
    if (choice === "unknown") void save(null);
    else if (choice === "self") void save({ kind: "self" });
    else if (/^[A-Za-z]{2}$/.test(country)) void save({ kind: "intermediary", country: country.toUpperCase() });
    else setError("Type the country's two letters (IT, IE, LT…), then press Enter.");
  };
  const saveCountry = () => {
    if (!/^[A-Za-z]{2}$/.test(country)) return setError("The country's two letters: IT, IE, LT…");
    if (country.toUpperCase() !== custody?.country) void save({ kind: "intermediary", country: country.toUpperCase() });
  };

  const control = "h-7 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none hover:border-[#C49A3C]/60 focus:ring-2 focus:ring-[#C49A3C]/30 disabled:opacity-60";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-semibold">Kept by</span>
        <select
          value={current}
          onChange={(e) => choose(e.target.value as Choice)}
          disabled={disabled || saving}
          aria-label="Who keeps it"
          className={`${control} pl-2 pr-6`}
        >
          <option value="unknown">Not known</option>
          <option value="intermediary">A bank or broker</option>
          {(ownKeeping || current === "self") && <option value="self">Me (my own address)</option>}
        </select>
        {current !== "self" && (
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value.slice(0, 2))}
            onBlur={() => current === "intermediary" && country && saveCountry()}
            onKeyDown={(e) => { if (e.key === "Enter") saveCountry(); }}
            disabled={disabled || saving}
            placeholder="Country"
            aria-label="The custodian's country"
            className={`${control} w-[4.5rem] px-2 text-center ${country ? "uppercase" : ""}`}
          />
        )}
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-300" />}
        {custody && <span className="text-slate-400">{CUSTODY_SOURCE_LABELS[custody.source]}</span>}
        {!custody && <span className="text-amber-700">Needed for the taxes on holdings</span>}
      </div>
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
