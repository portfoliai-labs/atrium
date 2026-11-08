// components/dashboard/ClientsSection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BellRing, ChevronRight, Info, Loader2, Settings2, Trash2, Users, X } from "lucide-react";
import { advisorService } from "../../services/advisorService";
import { clientDisplayName, clientInitials, useClients } from "../../context/ClientsContext";
import { PortfolioProvider, usePortfolio, type ClientScope } from "../../context/PortfolioContext";
import { useClientAlertRules } from "../../hooks/useAlertRules";
import { useClientsFigures, totalsByCurrency, type ClientFigures } from "../../hooks/useClientsFigures";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";
import { CLIENTS_SECTION } from "../../lib/dashboardNav";
import { alertState } from "../../lib/alerts";
import { formatCurrency } from "../../lib/format";
import { TAX_REGIME_COUNTRIES, countryName } from "../../lib/taxes";
import type { Client } from "../../models/Advisor";
import type { ClientAlertRuleResponse } from "../../models/Alert";
import { PageHeader, type PageAction } from "./PageHeader";
import { Module, ModuleHead } from "./PerformanceSection";
import { InvestmentsSection } from "./InvestmentsSection";
import { ConfirmDialog } from "./ConfirmDialog";
import { AssetCategoriesEditor } from "./AssetCategoriesEditor";
import { ManualAssetsEditor } from "./ManualAssetsEditor";
import { TONE_STYLES } from "./AlertGauge";

const SECTION = CLIENTS_SECTION;
// The advisor's incoming requests (AdvisorRequestsSection): where a client comes from.
const REQUESTS_SECTION = "requests";

const LANGUAGE_LABELS: Record<string, string> = { it: "Italian", en: "English", fr: "French", de: "German" };

const signedPct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;

/** The client the current history entry is on, if it's this section's. */
const clientFromHistory = (): string | null => {
  const entry = readDashboardEntry();
  const view = entry?.section === SECTION ? (entry.view as { client?: unknown } | undefined) : undefined;
  return typeof view?.client === "string" ? view.client : null;
};

export function ClientAvatar({ client, size = "md" }: { client: Client; size?: "sm" | "md" }) {
  const sizes = { sm: "w-8 h-8 text-[11px] rounded-lg", md: "w-10 h-10 text-xs rounded-xl" };
  return (
    <span className={`${sizes[size]} bg-[#1c1917] flex items-center justify-center font-bold text-[#C49A3C] shrink-0`}>
      {clientInitials(client)}
    </span>
  );
}

/**
 * CLIENTS SECTION (advisor) — the advisor's clients, and each one's page. The list says what each
 * client's investments are worth, how they've done and how their alerts stand, and removes
 * clients; a client comes through their own advisor request, accepted in Requests. The advisor reads
 * a client's data, and only the client changes it (hooks/useReadOnly). A client's page is their investments, the investor's own pages on the client's portfolios (a
 * PortfolioProvider of theirs, see InvestmentsSection): their investments, each portfolio's Insights,
 * Transactions, Alerts (the advisor's), Strategy (adopted from the advisor's backtests, shared or
 * not) and Asset categories, plus the client's details. The client is in each page's history
 * entry (`{ client, ...wealthView }`), so back and forward, and the Sidebar's rows, follow it.
 */
export function ClientsSection({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { clients, loading } = useClients();
  const [clientUuid, setClientUuid] = useState<string | null>(clientFromHistory);

  useEffect(() => {
    const onPopState = () => {
      if (readDashboardEntry()?.section === SECTION) setClientUuid(clientFromHistory());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const openClient = (uuid: string | null) => {
    pushDashboardEntry({ section: SECTION, view: uuid ? { client: uuid } : undefined });
    setClientUuid(uuid);
    window.scrollTo({ top: 0 });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-7 h-7 animate-spin text-[#C49A3C]" /></div>;
  }

  const client = clientUuid ? clients.find((c) => c.uuid === clientUuid) : undefined;
  if (client) {
    return <ClientPage key={client.uuid} client={client} onBack={() => openClient(null)} onNavigate={onNavigate} />;
  }
  return <ClientsList onOpen={openClient} onOpenRequests={() => onNavigate(REQUESTS_SECTION)} />;
}

// ── The list ──────────────────────────────────────────────────────────────────────────────

/** "3 alerts · 1 triggered", or null with no alerts; the tone follows the most pressing one. */
function alertsSummary(rules: ClientAlertRuleResponse[]) {
  if (rules.length === 0) return null;
  const states = rules.map(alertState);
  const triggered = states.filter((st) => st.tone === "danger").length;
  const approaching = states.filter((st) => st.tone === "warn").length;
  const count = `${rules.length} ${rules.length === 1 ? "alert" : "alerts"}`;
  if (triggered > 0) return { text: `${count} · ${triggered} triggered`, tone: "danger" as const };
  if (approaching > 0) return { text: `${count} · ${approaching} approaching`, tone: "warn" as const };
  return { text: count, tone: "ok" as const };
}

function ClientsList({ onOpen, onOpenRequests }: { onOpen: (uuid: string) => void; onOpenRequests: () => void }) {
  const { clients, error, removed } = useClients();
  const { rules } = useClientAlertRules();
  const figures = useClientsFigures(clients);
  const [toRemove, setToRemove] = useState<Client | null>(null);

  const triggered = (rules ?? []).filter((r) => alertState(r).tone === "danger").length;
  const totals = figures ? totalsByCurrency(figures) : null;
  const value = totals === null ? null : totals.length === 0 ? "—" : totals.map((t) => formatCurrency(t.value, t.currency, 0)).join(" + ");
  const sorted = [...clients].sort((a, b) => clientDisplayName(a).localeCompare(clientDisplayName(b)));

  return (
    <div className="space-y-[22px] pb-12">
      <PageHeader
        eyebrow="Advisor"
        title="Clients"
        value={clients.length > 0 ? value : undefined}
        note={clients.length > 0 ? "Their investments together" : undefined}
        figures={clients.length > 0 ? [
          { label: "Clients", value: String(clients.length) },
          { label: "Your alerts", value: rules === null ? "—" : String(rules.length), sub: "On their portfolios" },
          { label: "Triggered", value: rules === null ? "—" : String(triggered), tone: triggered > 0 ? "loss" : undefined },
        ] : []}
        actions={[{ label: "Requests", primary: true, onClick: onOpenRequests }]}
      />

      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}

      {clients.length === 0 ? (
        <button
          type="button"
          onClick={onOpenRequests}
          className="min-h-52 w-full rounded-[1.75rem] border-2 border-dashed border-[#E0DACC] bg-white flex flex-col items-center justify-center gap-2 px-6 text-center hover:border-[#C49A3C]/60 transition-colors"
        >
          <span className="w-12 h-12 rounded-2xl bg-[#1c1917] flex items-center justify-center mb-1"><Users className="w-5 h-5 text-[#C49A3C]" /></span>
          <span className="text-sm font-black text-[#1c1917]">No clients yet</span>
          <span className="text-xs text-[#78716c] max-w-sm">
            A client comes to you by their own request: accept it in Requests, and their portfolios are here to follow.
          </span>
        </button>
      ) : (
        <Module>
          <ModuleHead title="Your clients" desc="Open a client to see their portfolios." />
          <div className="hidden md:grid grid-cols-[minmax(0,1fr)_9rem_6rem_10rem_2rem] gap-4 px-6 pb-2 text-[10px] font-black uppercase tracking-widest text-[#857e78]">
            <span>Client</span>
            <span className="text-right">Investments</span>
            <span className="text-right">Return</span>
            <span>Alerts</span>
            <span />
          </div>
          <ul className="divide-y divide-[#EEE9DD] border-t border-[#EEE9DD]">
            {sorted.map((c) => (
              <ClientRow
                key={c.uuid}
                client={c}
                figures={figures === undefined ? undefined : figures.get(c.uuid) ?? null}
                rules={rules === null ? null : rules.filter((r) => r.clientUuid === c.uuid)}
                onOpen={() => onOpen(c.uuid)}
                onRemove={() => setToRemove(c)}
              />
            ))}
          </ul>
        </Module>
      )}

      {toRemove && (
        <RemoveClientDialog
          client={toRemove}
          onClose={() => setToRemove(null)}
          onRemoved={() => {
            removed(toRemove.uuid);
            setToRemove(null);
          }}
        />
      )}
    </div>
  );
}

function ClientRow({ client, figures, rules, onOpen, onRemove }: {
  client: Client;
  // undefined while loading, null with none yet.
  figures: ClientFigures | null | undefined;
  rules: ClientAlertRuleResponse[] | null;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const summary = rules ? alertsSummary(rules) : null;
  const ret = figures?.totalReturnPct ?? null;
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onOpen}
        className="w-full grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_9rem_6rem_10rem_2rem] items-center gap-x-4 gap-y-1.5 px-6 py-3.5 text-left hover:bg-[#FBFAF6] transition-colors"
      >
        <span className="flex items-center gap-3 min-w-0">
          <ClientAvatar client={client} />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-[#1c1917] truncate">{clientDisplayName(client)}</span>
            <span className="block text-xs text-[#78716c] truncate">
              {client.email}
              {figures && figures.portfolios > 1 ? ` · ${figures.portfolios} portfolios` : ""}
            </span>
          </span>
        </span>
        <span className="text-right text-sm font-black tabular-nums text-[#1c1917]">
          {figures === undefined ? <span className="inline-block h-3 w-16 rounded bg-slate-100 animate-pulse" /> : figures ? formatCurrency(figures.marketValue, figures.currency, 0) : "—"}
        </span>
        <span className={`hidden md:block text-right text-sm font-bold tabular-nums ${ret == null ? "text-[#857e78]" : ret >= 0 ? "text-[#047857]" : "text-[#e11d48]"}`}>
          {ret == null ? "—" : signedPct(ret)}
        </span>
        <span className="col-span-2 md:col-span-1 pl-13 md:pl-0">
          {summary ? (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${TONE_STYLES[summary.tone].chip}`}>
              <BellRing className="w-3 h-3" /> {summary.text}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#857e78]">
              <BellRing className="w-3 h-3" /> {rules === null ? "…" : "No alerts"}
            </span>
          )}
        </span>
        <ChevronRight className="hidden md:block w-4 h-4 text-[#857e78] group-hover:text-[#C49A3C] transition-colors justify-self-end" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${clientDisplayName(client)}`}
        title="Remove client"
        className="absolute right-14 top-1/2 -translate-y-1/2 p-2 rounded-lg text-[#857e78] hover:text-rose-600 hover:bg-rose-50 transition-colors md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 hidden md:block"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </li>
  );
}

// ── A client's page ───────────────────────────────────────────────────────────────────────

/**
 * A client's investments, on their portfolios: the investor's pages (InvestmentsSection) in this section,
 * under Clients › the client, with the client's details and removal among their investments'
 * actions.
 */
function ClientPage({ client, onBack, onNavigate }: { client: Client; onBack: () => void; onNavigate: (section: string) => void }) {
  const name = clientDisplayName(client);
  const scope = useMemo<ClientScope>(() => ({ uuid: client.uuid, name }), [client.uuid, name]);
  return (
    <PortfolioProvider client={scope}>
      <ClientWealth client={client} onBack={onBack} onNavigate={onNavigate} />
    </PortfolioProvider>
  );
}

function ClientWealth({ client, onBack, onNavigate }: { client: Client; onBack: () => void; onNavigate: (section: string) => void }) {
  const { loading, failed } = usePortfolio();
  const { removed } = useClients();
  const [dialog, setDialog] = useState<"settings" | "remove" | null>(null);
  // The Client details tab it opens on.
  const [settingsTab, setSettingsTab] = useState<ClientSettingsTab>("profile");
  const openSettings = (tab: ClientSettingsTab) => {
    setSettingsTab(tab);
    setDialog("settings");
  };
  const scope = useMemo(() => ({ client: client.uuid }), [client.uuid]);
  const trail = useMemo(() => [{ label: "Clients", onClick: onBack }], [onBack]);

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-7 h-7 animate-spin text-[#C49A3C]" /></div>;
  }
  if (failed) {
    return <p className="text-sm font-semibold text-rose-600 py-6">Unable to load {clientDisplayName(client)}&apos;s portfolios.</p>;
  }

  const extraActions: PageAction[] = [
    { label: "Client details", onClick: () => openSettings("profile") },
    { label: "Remove client", danger: true, onClick: () => setDialog("remove") },
  ];

  return (
    <>
      <InvestmentsSection
        onNavigate={onNavigate}
        section={SECTION}
        scope={scope}
        rootTrail={trail}
        extraActions={extraActions}
        onOpenTaxSettings={() => openSettings("profile")}
        onOpenAssetSettings={() => openSettings("assets")}
      />
      {dialog === "settings" && (
        <ClientSettingsDialog client={client} initialTab={settingsTab} onClose={() => setDialog(null)} />
      )}
      {dialog === "remove" && (
        <RemoveClientDialog
          client={client}
          onClose={() => setDialog(null)}
          onRemoved={() => {
            setDialog(null);
            onBack();
            removed(client.uuid);
          }}
        />
      )}
    </>
  );
}

// ── Dialogs ───────────────────────────────────────────────────────────────────────────────

function DialogShell({ icon, title, subtitle, wide, onClose, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  // Room for a list (a client's assets), not just a form.
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Portaled to <body> above the dashboard's sticky header, like the app's other dialogs.
  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-white rounded-4xl shadow-2xl border border-slate-200 ${wide ? "max-w-3xl" : "max-w-lg"} w-full p-6 md:p-8 space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-[#C49A3C]/10 rounded-xl shrink-0 text-[#C49A3C]">{icon}</div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-900 truncate">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

type ClientSettingsTab = "profile" | "assets";
const CLIENT_SETTINGS_TABS: { id: ClientSettingsTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "assets", label: "Assets" },
];

/**
 * CLIENT DETAILS — a client's language, portfolio currency and tax residence (Profile), and their
 * asset categories and manual assets (Assets), to read: the client changes them, in their own
 * Profile and Settings. The residence picks the regime their taxes are computed by (see their
 * investments' Taxes page).
 */
function ClientSettingsDialog({ client, initialTab = "profile", onClose }: {
  client: Client;
  initialTab?: ClientSettingsTab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<ClientSettingsTab>(initialTab);
  const name = clientDisplayName(client);
  const residence = client.tax_residence ?? null;

  return (
    <DialogShell icon={<Settings2 className="h-5 w-5" />} title="Client details" subtitle={`${name} · ${client.email}`} wide={tab === "assets"} onClose={onClose}>
      <div className="inline-flex gap-1 p-1 bg-white rounded-full border border-[rgba(196,154,60,0.2)]">
        {CLIENT_SETTINGS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-colors ${
              t.id === tab ? "bg-[#1c1917] text-white" : "text-[#78716c] hover:text-[#1c1917]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="flex items-start gap-2.5 rounded-xl bg-[#C49A3C]/10 border border-[#C49A3C]/30 px-4 py-3 text-[13px] font-semibold text-[#8A6A28]">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        {name} changes their own data: you see it as it is.
      </p>
      {tab === "assets" ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              The category each of {name}&apos;s securities counts in, across all their portfolios: alerts on a category, and adopting a strategy by category, weigh a portfolio by it.
            </p>
            <AssetCategoriesEditor clientUuid={client.uuid} />
          </div>
          <div className="space-y-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              {name}&apos;s investments with no market price — unlisted shares, private equity, a loan, physical gold — valued by hand. Each counts in the portfolios that hold it by its valuations.
            </p>
            <ManualAssetsEditor clientUuid={client.uuid} />
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Detail label="Language" value={client.language ? LANGUAGE_LABELS[client.language] ?? client.language : "Not set"} />
          <Detail label="Portfolio currency" value={client.currency ?? "Not set"} />
          <Detail label="Tax residence" value={residence ? countryName(residence) : "Not set"} />
          {residence && !TAX_REGIME_COUNTRIES.includes(residence) && (
            <p className="sm:col-span-3 text-xs text-[#78716c]">Taxes are computed for residents of Italy only, for now.</p>
          )}
        </dl>
      )}
    </DialogShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3.5 py-2.5">
      <dt className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function RemoveClientDialog({ client, onClose, onRemoved }: { client: Client; onClose: () => void; onRemoved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await advisorService.deleteClient(client.uuid);
      onRemoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove this client.");
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog
      title={`Remove ${clientDisplayName(client)}?`}
      description="They're no longer your client: your alerts and strategies on their portfolios go. Their account and portfolios stay theirs."
      confirmLabel="Remove"
      confirming={busy}
      error={error}
      onConfirm={remove}
      onClose={onClose}
    />
  );
}

