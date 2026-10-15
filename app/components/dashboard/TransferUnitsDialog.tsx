"use client";

import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { PortfolioSelect } from "./PortfolioSelect";
import { transactionService } from "../../services/transactionService";
import { ApiError } from "../../services/apiClient";
import type { Portfolio } from "../../models/Portfolio";

// What each field the backend names (camelCase, ianus' rule) means for the user.
const FIELD_PROBLEMS: Record<string, string> = {
  toPortfolioUuid: "Pick another of your own portfolios.",
  assetId: "This portfolio didn't hold it on that day.",
  quantity: "That's more than the portfolio held on that day.",
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * TRANSFER UNITS — moves units of a security to another of the owner's standard portfolios (POST
 * .../transactions/transfer), at the origin's average cost: a transfer_out here and a transfer_in
 * there, recorded together. Opened from a saved transaction, which names the security as the
 * origin's transactions do (`assetId`).
 */
export function TransferUnitsDialog({ fromPortfolioUuid, assetId, assetLabel, portfolios, onClose, onDone }: {
  fromPortfolioUuid: string;
  assetId: string;
  assetLabel: string;
  // The owner's standard portfolios; the origin is left out.
  portfolios: Portfolio[];
  onClose: () => void;
  onDone: () => void;
}) {
  const targets = portfolios.filter((p) => p.uuid !== fromPortfolioUuid && !p.isVirtual);
  const [to, setTo] = useState(targets.length === 1 ? targets[0].uuid : "");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = Number(quantity.replace(",", "."));
  const problem = !to ? "Pick the portfolio to move them to."
    : !(quantity.trim() !== "" && Number.isFinite(q) && q > 0) ? "Enter how many units to move."
      : !date ? "Pick the day."
        : null;

  const submit = async () => {
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await transactionService.transfer(fromPortfolioUuid, { to_portfolio_uuid: to, asset_id: assetId, quantity: quantity.replace(",", ".").trim(), date });
      onDone();
    } catch (err) {
      const field = err instanceof ApiError ? err.metadata.field : undefined;
      setError((field && FIELD_PROBLEMS[field]) ?? (err instanceof Error ? err.message : "Unable to move the units."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfirmDialog
      title="Move units"
      description={`Moves units of ${assetLabel} to another of your portfolios, at this portfolio's average cost: a transfer out here, a transfer in there.`}
      confirmLabel="Move"
      tone="neutral"
      confirming={saving}
      error={error}
      onConfirm={() => { void submit(); }}
      onClose={onClose}
    >
      <div className="space-y-4">
        <PortfolioSelect portfolios={targets} value={to} onChange={setTo} label="To portfolio" />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Units</span>
            <input
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="10"
              className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-slate-50 focus:border-slate-300"
            />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date</span>
            <input
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold outline-none focus:ring-4 focus:ring-slate-50 focus:border-slate-300"
            />
          </label>
        </div>
      </div>
    </ConfirmDialog>
  );
}
