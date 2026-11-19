// components/dashboard/taxes/WealthTaxes.tsx
"use client";

import { Fragment, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Loader2, Pencil, RotateCcw, X } from "lucide-react";
import { investmentsKey } from "../../../context/PortfolioContext";
import { formatCurrency } from "../../../lib/format";
import { dayLabel } from "../../../lib/wallets";
import type { HoldingKind, WealthLine, WealthTax, WealthTaxKind, WealthTaxes } from "../../../models/Tax";
import { taxService } from "../../../services/taxService";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";

const SOURCE_TEXT: Record<string, string> = {
  year_end_price: "value at the year's end",
  exit_price: "value when sold",
  average_balance: "average balance",
  purchase_price: "purchase price",
  valuation: "latest valuation",
  user: "your value",
};

const HOLDING_WORD: Record<HoldingKind, string> = { account: "wallet", portfolio: "portfolio", property: "property" };

// Each tax in the app's words; fiscus' name (Italy's official one) goes beneath it.
export const WEALTH_TAX_LABEL: Record<WealthTaxKind, string> = {
  accounts_stamp_duty: "Stamp duty on accounts",
  securities_stamp_duty: "Stamp duty on investments",
  foreign_accounts_tax: "Tax on accounts abroad (IVAFE)",
  foreign_securities_tax: "Tax on investments abroad (IVAFE)",
  crypto_assets_tax: "Tax on crypto-assets",
  foreign_property_tax: "Tax on properties abroad (IVIE)",
};

// The taxes whose lines are lots: one row per holding and asset, its lots added up.
const BY_LOT: WealthTaxKind[] = ["securities_stamp_duty", "foreign_securities_tax", "crypto_assets_tax"];

type Row = { line: WealthLine; lots: WealthLine[] };

/** A tax's lines as rows: a holding's lots of one asset together (taxes and credits added up). */
function rows(tax: WealthTax): Row[] {
  if (!BY_LOT.includes(tax.kind)) return tax.lines.map((line) => ({ line, lots: [line] }));
  const found = new Map<string, WealthLine[]>();
  for (const line of tax.lines) {
    const key = `${line.holding.uuid}:${line.assetId ?? line.isin ?? line.ticker ?? ""}`;
    found.set(key, [...(found.get(key) ?? []), line]);
  }
  return [...found.values()].map((lots) => ({
    lots,
    line: lots.length === 1 ? lots[0] : {
      ...lots[0],
      value: lots.some((l) => l.value === null) ? null : lots.reduce((s, l) => s + (l.value ?? 0), 0),
      tax: lots.reduce((s, l) => s + l.tax, 0),
      credit: lots.reduce((s, l) => s + l.credit, 0),
    },
  }));
}

const pct = (v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;

/** A row's facts, short: where it's kept, its value and for how long (each lot's), the rate. */
function lineFacts({ line, lots }: Row): string {
  const parts: string[] = [];
  // A portfolio's cash has the portfolio for its intermediary: its name once is enough.
  const intermediary = line.intermediaryName && line.intermediaryName !== line.holding.name ? line.intermediaryName : null;
  if (line.custodyCountry) parts.push(intermediary ? `${intermediary} (${line.custodyCountry})` : line.custodyCountry);
  if (line.value !== null) parts.push(`${formatCurrency(line.value, line.currency, 0)} ${lots.length > 1 ? "value" : line.valueSource ? SOURCE_TEXT[line.valueSource] : ""}`.trim());
  else parts.push("no value yet: set one");
  if (line.months) parts.push(`${line.months} months${line.exemptMonths ? `, ${line.exemptMonths} as your main home (exempt)` : ""}`);
  else if (lots.length > 1) parts.push(`${lots.length} lots: ${lots.map((l) => l.days).join(", ")} days`);
  else if (line.days) parts.push(`${line.days} days`);
  if (line.sharePct !== 100) parts.push(`your share ${pct(line.sharePct)}`);
  if (line.fixedAmount !== null) parts.push(line.aboveThreshold ? `${formatCurrency(line.fixedAmount, "EUR")} a year` : "within the 5,000 € average: none due");
  else if (line.ratePct !== null) parts.push(`${pct(line.ratePct)}${line.privilegedRegime ? " (a privileged tax regime's state)" : ""}`);
  if (line.holding.kind === "property" && line.value !== null && !line.aboveThreshold) parts.push("200 € or less on its whole value: none due");
  return parts.join(" · ");
}

/**
 * TAXES ON HOLDINGS — Italy's taxes on what the user holds (fiscus' wealth taxes), by who keeps
 * each holding (the wallets' and portfolios' "Kept by"): the stamp duty Italian banks and brokers
 * charge (estimated, they take it), the IVAFE on accounts and investments abroad, the tax on
 * crypto-assets kept without an Italian intermediary, the IVIE on properties abroad. Each tax with
 * its lines and, for those paid with the tax return, its instalments and F24 codes. A property's
 * value for the year (its cadastral value in the EU, say) and the wealth tax paid abroad on a
 * wallet or portfolio are the user's to set, line by line.
 */
export function WealthTaxesModule({ data, onOpenPortfolios }: { data: WealthTaxes; onOpenPortfolios: () => void }) {
  return (
    <Module>
      <ModuleHead
        title={`Taxes on holdings ${data.year}`}
        desc="By who keeps them: Italian banks and brokers charge the stamp duty themselves; abroad, the IVAFE and the IVIE are yours to pay."
      />
      <div className={`${MODULE_BODY} space-y-5`}>
        {data.unknownCustody.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 text-[12.5px] text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Left out until you say who keeps them:{" "}
              {data.unknownCustody.map((h, i) => (
                <Fragment key={h.uuid}>{i > 0 && ", "}<b>{h.name}</b> ({HOLDING_WORD[h.kind]})</Fragment>
              ))}
              . Set it in the wallet&apos;s settings or in{" "}
              <button type="button" onClick={onOpenPortfolios} className="font-bold underline underline-offset-2">Manage portfolios</button>.
            </span>
          </div>
        )}
        {data.taxes.length === 0 && data.unknownCustody.length === 0 && (
          <p className="text-[13px] text-[#78716c]">Nothing held this year that these taxes reach.</p>
        )}
        {data.taxes.map((tax) => <TaxBlock key={tax.kind} tax={tax} year={data.year} currency={data.currency} />)}
        {data.unpricedAssetIds.length > 0 && (
          <p className="text-[12px] text-[#78716c]">Left out for want of a price: {data.unpricedAssetIds.join(", ")}.</p>
        )}
      </div>
    </Module>
  );
}

function TaxBlock({ tax, year, currency }: { tax: WealthTax; year: number; currency: string }) {
  const money = (v: number, digits?: number) => formatCurrency(v, currency, digits);
  const state = tax.status === "not_computed" ? "Not computed for this year"
    : tax.withheld ? "Charged by your bank or broker (estimated)"
    : tax.credit > 0 ? `${money(tax.gross)} less ${money(tax.credit)} paid abroad`
    : null;
  const shown = rows(tax);
  // The wealth tax paid abroad is a wallet's or a portfolio's: asked on its first row only.
  const asked = new Set<string>();
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-[#1c1917]">{WEALTH_TAX_LABEL[tax.kind] ?? tax.name}</span>
          <span className="block text-[11px] italic text-[#857e78]">{tax.name}</span>
          {state && <span className={`block text-[11.5px] ${tax.status === "not_computed" ? "text-amber-700" : "text-[#78716c]"}`}>{state}</span>}
        </span>
        <span className={`text-sm font-bold tabular-nums ${tax.withheld ? "text-[#78716c]" : "text-[#1c1917]"}`}>
          {tax.status === "not_computed" ? "—" : money(tax.amount)}
        </span>
      </div>
      <ul className="divide-y divide-[#EEE9DD]">
        {shown.map((row, i) => {
          const { line } = row;
          const ask = !tax.withheld && (line.holding.kind === "property" || !asked.has(line.holding.uuid));
          asked.add(line.holding.uuid);
          return (
          <li key={`${line.holding.uuid}:${line.assetId ?? ""}:${i}`} className="flex items-baseline gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-[#1c1917] truncate">
                {line.holding.name}{line.ticker || line.isin ? ` · ${line.ticker ?? line.isin}` : ""}
              </span>
              <span className="block text-[11.5px] text-[#78716c]">{lineFacts(row)}</span>
              {ask && <FigureEditor line={line} year={year} credited={tax.lines.some((l) => l.holding.uuid === line.holding.uuid && l.credit > 0)} />}
            </span>
            <span className="text-[13px] font-bold tabular-nums text-[#1c1917]">
              {money(line.tax)}
              {line.credit > 0 && <span className="block text-right text-[11px] font-semibold text-emerald-700">−{money(line.credit)}</span>}
            </span>
          </li>
          );
        })}
      </ul>
      {tax.instalments.length > 0 && (
        <ul className="pt-1 space-y-1">
          {tax.instalments.map((i) => (
            <li key={i.number} className="flex items-center gap-3 text-[12px] text-[#5A6270]">
              <span className="w-24 shrink-0 font-bold tabular-nums">{dayLabel(i.dueOn)}</span>
              <span className="flex-1">{i.number === 3 ? "Balance" : `On account ${i.number}`} · F24 code {i.taxCode}</span>
              <span className="font-bold tabular-nums">{money(i.amount, 0)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The user's figure for a line's holding and year: a property's value (the whole property's, in its
 * currency), a wallet's or portfolio's wealth tax paid abroad (euro). Saved at once; the taxes read
 * again.
 */
function FigureEditor({ line, year, credited }: { line: WealthLine; year: number; credited: boolean }) {
  const queryClient = useQueryClient();
  const property = line.holding.kind === "property";
  // A wallet's or portfolio's figure is spread over its lines: `credited` when any took some.
  const own = property ? line.valueSource === "user" : credited;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: investmentsKey("taxes") });
  const run = async (write: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await write();
      setEditing(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save it.");
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    const amount = Number(text.replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0 || (property && amount === 0)) return setError(property ? "A value above 0." : "An amount of 0 or more.");
    void run(() => taxService.setHoldingOverride(line.holding.kind, line.holding.uuid, year, property ? { value: amount } : { foreignTaxPaid: amount }));
  };

  if (!editing) {
    return (
      <span className="mt-0.5 flex items-center gap-3 text-[11.5px]">
        <button
          type="button"
          onClick={() => { setText(""); setEditing(true); }}
          className="inline-flex items-center gap-1 font-bold text-[#8A6A28] hover:text-[#C49A3C]"
        >
          <Pencil className="h-3 w-3" /> {property ? `Set its ${year} value` : "Wealth tax paid abroad"}
        </button>
        {own && (
          <button
            type="button"
            onClick={() => run(() => taxService.deleteHoldingOverride(line.holding.kind, line.holding.uuid, year))}
            disabled={busy}
            className="inline-flex items-center gap-1 font-bold text-[#78716c] hover:text-[#1c1917]"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} {property ? "Back to the purchase price" : "Clear"}
          </button>
        )}
        {error && <span className="text-rose-600">{error}</span>}
      </span>
    );
  }
  return (
    <span className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px]">
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        inputMode="decimal"
        placeholder={property ? `Value in ${line.currency}` : "Paid abroad, €"}
        className="h-7 w-36 px-2 rounded-lg border border-[#C49A3C]/50 bg-white text-xs font-semibold outline-none focus:ring-2 focus:ring-[#C49A3C]/30"
      />
      <button type="button" onClick={save} disabled={busy} aria-label="Save" className="h-7 w-7 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </button>
      <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">
        <X className="h-3.5 w-3.5" />
      </button>
      {property && <span className="text-[#78716c]">The whole property&apos;s, e.g. its cadastral value in the EU.</span>}
      {error && <span className="text-rose-600">{error}</span>}
    </span>
  );
}
