// components/dashboard/ManagePortfolios.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bell, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";
import { useUser } from "../../context/UserContext";
import { portfoliosService } from "../../services/portfoliosService";
import { formatCurrency } from "../../lib/format";
import { portfolioColorMap } from "../../lib/chartColors";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { ConfirmDialog } from "./ConfirmDialog";
import { NewPortfolioDialog } from "./NewPortfolioDialog";
import { VIRTUAL_COLOR, VirtualBadge } from "./BacktestMarks";
import { usePortfoliosAlertRules } from "../../hooks/useAlertRules";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";
import type { Portfolio } from "../../models/Portfolio";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";

const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;
const createdLabel = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";

/**
 * MANAGE PORTFOLIOS — All portfolios / Manage portfolios (see WealthSection): every portfolio the user can
 * change, in one list, to rename (right on its row), delete (asking first) or open, and the way to
 * create one. The real portfolios first, the default leading (it can't be deleted: the backend
 * answers 409), then the strategies' backtests. "All portfolios" isn't listed: it's built from the
 * others and can be neither renamed nor deleted, which a line under the list says. Values come
 * from GET /v1/portfolios/comparison, like the hub's. A real portfolio's row counts its alerts (an
 * adopted strategy's included) and leads to them (`onOpenAlerts`: its Alerts tab). Backtests are adopted
 * from Plan / Strategy. A demo account sees the list but can't change anything.
 */
export function ManagePortfolios({ trail, onOpenPortfolio, onOpenAlerts }: {
  trail: Crumb[];
  onOpenPortfolio: (uuid: string) => void;
  // That portfolio's alerts page.
  onOpenAlerts: (uuid: string) => void;
}) {
  const { portfolios, deletePortfolio, client, canManage } = usePortfolio();
  const { isDemo } = useUser();
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Portfolio | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const colorOf = useMemo(() => portfolioColorMap(portfolios), [portfolios]);

  const uuidsKey = portfolios.map((p) => p.uuid).join(",");
  const [entries, setEntries] = useState<{ key: string; byUuid: Map<string, PortfolioComparisonEntry> }>({ key: "", byUuid: new Map() });
  useEffect(() => {
    let cancelled = false;
    portfoliosService.compare([], client?.uuid)
      .then((list) => { if (!cancelled) setEntries({ key: uuidsKey, byUuid: new Map(list.map((e) => [e.portfolio.uuid, e])) }); })
      .catch(() => { if (!cancelled) setEntries({ key: uuidsKey, byUuid: new Map() }); });
    return () => { cancelled = true; };
  }, [uuidsKey, client?.uuid]);
  const loaded = entries.key === uuidsKey;

  const real = portfolios.filter((p) => !p.isVirtual).sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const backtests = portfolios.filter((p) => p.isVirtual && !p.isAggregate);
  const hasAggregate = portfolios.some((p) => p.isAggregate);
  const { rules } = usePortfoliosAlertRules(real.map((p) => p.uuid));

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deletePortfolio(toDelete.uuid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete this portfolio.");
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  const row = (p: Portfolio, color: string) => (
    <ManageRow
      key={p.uuid}
      portfolio={p}
      color={color}
      entry={loaded ? entries.byUuid.get(p.uuid) ?? null : undefined}
      readOnly={isDemo}
      manageable={canManage}
      // Backtests take no alerts; undefined while they load.
      alertCount={p.isVirtual || rules === null ? undefined : rules.filter((r) => r.portfolioUuid === p.uuid).length}
      onOpenAlerts={() => onOpenAlerts(p.uuid)}
      onOpen={() => onOpenPortfolio(p.uuid)}
      onDelete={() => setToDelete(p)}
    />
  );

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb
        trail={trail}
        current="Manage portfolios"
        right={
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={isDemo}
            title={isDemo ? DEMO_DISABLED_TITLE : undefined}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-[#1c1917]"
          >
            <Plus className="h-3.5 w-3.5" /> New portfolio
          </button>
        }
      />
      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}

      <ManageGroup
        title="Portfolios"
        note={canManage
          ? `${real.length} ${real.length === 1 ? "portfolio" : "portfolios"} · the default one can be renamed, not deleted`
          : `${real.length} ${real.length === 1 ? "portfolio" : "portfolios"} · ${client?.name} renames and deletes them`}
      >
        {real.map((p) => row(p, colorOf(p.uuid)))}
      </ManageGroup>

      {backtests.length > 0 && (
        <ManageGroup title="Virtual portfolios" note="Strategies you backtested — simulated, not part of your net worth" tone="virtual">
          {backtests.map((p) => row(p, VIRTUAL_COLOR))}
        </ManageGroup>
      )}

      {hasAggregate && (
        <p className="text-xs text-slate-400 px-1">
          &ldquo;All portfolios&rdquo; isn&apos;t listed: it&apos;s built from your portfolios, so it can be neither renamed nor deleted.
        </p>
      )}

      {creating && <NewPortfolioDialog onClose={() => setCreating(false)} />}
      {toDelete && (
        <ConfirmDialog
          title={`Delete "${toDelete.name}"?`}
          description={toDelete.isVirtual
            ? "This permanently deletes this backtest and everything computed from it. The strategy isn't kept: you'd have to set it up again."
            : "This permanently deletes this portfolio and every transaction, alert and report in it. This can't be undone."}
          confirming={deleting}
          onConfirm={handleDelete}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

function ManageGroup({ title, note, tone, children }: { title: string; note?: string; tone?: "virtual"; children: React.ReactNode }) {
  return (
    <section className={`bg-white rounded-3xl shadow-sm overflow-hidden ${tone === "virtual" ? "border-2 border-dashed border-sky-300" : "border border-slate-200"}`}>
      <div className="px-6 md:px-7 pt-5 pb-4 border-b border-slate-100">
        <h3 className={`text-sm font-black ${tone === "virtual" ? "text-sky-800" : "text-slate-900"}`}>{title}</h3>
        {note && <p className="text-xs text-slate-500 mt-0.5">{note}</p>}
      </div>
      {/* Column heads, from medium screens up: a row reads as one line there. */}
      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_8rem_7rem_9rem] gap-4 px-6 md:px-7 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <span>Name</span>
        <span className="text-right">Value</span>
        <span className="text-right">Created</span>
        <span />
      </div>
      <ul className="divide-y divide-slate-100 pb-1">{children}</ul>
    </section>
  );
}

/**
 * One portfolio in the list: its colour and name (which Rename turns into a field, saved on Enter
 * or the tick), its alerts (a pill leading to them), its value and when it was created,
 * then Open, Rename and Delete. The default portfolio's Delete is disabled,
 * with why. Without `manageable` (a client's, for their advisor), Open only.
 */
function ManageRow({
  portfolio, color, entry, readOnly, manageable, alertCount, onOpenAlerts, onOpen, onDelete,
}: {
  portfolio: Portfolio;
  color: string;
  // undefined while loading, null when there are no figures yet.
  entry: PortfolioComparisonEntry | null | undefined;
  readOnly: boolean;
  manageable: boolean;
  alertCount?: number;
  onOpenAlerts: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { renamePortfolio } = usePortfolio();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(portfolio.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = entry?.value ?? null;

  const startRename = () => {
    setName(portfolio.name);
    setError(null);
    setRenaming(true);
  };
  const saveRename = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === portfolio.name) {
      setRenaming(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await renamePortfolio(portfolio.uuid, trimmed);
      setRenaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rename this portfolio.");
    } finally {
      setSaving(false);
    }
  };

  const iconButton = "w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <li className="px-6 md:px-7 py-3.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_8rem_7rem_9rem] items-center gap-x-4 gap-y-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ background: color }} />
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              maxLength={80}
              aria-label="Portfolio name"
              className="flex-1 min-w-0 h-9 px-3 rounded-xl bg-white border border-[#C49A3C]/50 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-[#C49A3C]/10"
            />
          ) : (
            <>
              <span className="text-[15px] font-black text-slate-900 truncate" style={serif}>{portfolio.name}</span>
              {portfolio.isDefault && (
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500">Default</span>
              )}
              {portfolio.isVirtual && <VirtualBadge portfolio={portfolio} />}
              {alertCount !== undefined && (
                <button
                  type="button"
                  onClick={onOpenAlerts}
                  title={`${portfolio.name}'s alerts`}
                  className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 bg-white text-[10px] font-black uppercase tracking-wider text-slate-500 hover:border-[#C49A3C]/60 hover:text-[#C49A3C] transition-colors"
                >
                  <Bell className="h-2.5 w-2.5" />
                  {alertCount === 0 ? "No alerts" : `${alertCount} ${alertCount === 1 ? "alert" : "alerts"}`}
                </button>
              )}
            </>
          )}
        </div>

        <span className="hidden md:block text-right text-[13px] font-black tabular-nums text-slate-900">
          {entry === undefined ? <Loader2 className="h-3.5 w-3.5 animate-spin inline text-slate-300" /> : value ? formatCurrency(value.marketValue, value.currency, 0) : "—"}
        </span>
        <span className="hidden md:block text-right text-xs font-semibold text-slate-500 tabular-nums">{createdLabel(portfolio.createdAt)}</span>

        <div className="flex items-center justify-end gap-1">
          {renaming ? (
            <>
              <button type="button" onClick={saveRename} disabled={saving || !name.trim()} aria-label="Save name" className={`${iconButton} text-emerald-600 hover:bg-emerald-50`}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => setRenaming(false)} aria-label="Cancel" className={`${iconButton} text-slate-400 hover:bg-slate-100`}>
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onOpen} aria-label={`Open ${portfolio.name}`} title="Open" className={`${iconButton} text-slate-400 hover:text-slate-900 hover:bg-slate-100`}>
                <ArrowUpRight className="h-4 w-4" />
              </button>
              {manageable && <>
              <button
                type="button"
                onClick={startRename}
                disabled={readOnly}
                aria-label={`Rename ${portfolio.name}`}
                title={readOnly ? DEMO_DISABLED_TITLE : "Rename"}
                className={`${iconButton} text-slate-400 hover:text-slate-900 hover:bg-slate-100`}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={readOnly || portfolio.isDefault}
                aria-label={`Delete ${portfolio.name}`}
                title={readOnly ? DEMO_DISABLED_TITLE : portfolio.isDefault ? "The default portfolio can't be deleted" : "Delete"}
                className={`${iconButton} text-rose-500 hover:bg-rose-50`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
              </>}
            </>
          )}
        </div>

        {/* On a small screen, value and date under the name. */}
        <span className="md:hidden col-span-2 pl-5.5 text-xs font-semibold text-slate-500 tabular-nums">
          {value ? formatCurrency(value.marketValue, value.currency, 0) : "—"} · created {createdLabel(portfolio.createdAt)}
        </span>
      </div>
      {error && <p className="mt-1.5 pl-5.5 text-xs font-medium text-rose-600">{error}</p>}
    </li>
  );
}
