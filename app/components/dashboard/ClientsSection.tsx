// components/dashboard/ClientsSection.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, BellRing, Check, ChevronRight, Info, Loader2, Settings2, Trash2, UserPlus, Users, X } from "lucide-react";
import { advisorService } from "../../services/advisorService";
import { clientDisplayName, clientInitials, useClients } from "../../context/ClientsContext";
import { PortfolioProvider, usePortfolio, type ClientScope } from "../../context/PortfolioContext";
import { useClientAlertRules } from "../../hooks/useAlertRules";
import { useClientsFigures, totalsByCurrency, type ClientFigures } from "../../hooks/useClientsFigures";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";
import { CLIENTS_SECTION } from "../../lib/dashboardNav";
import { alertState } from "../../lib/alerts";
import { formatCurrency } from "../../lib/format";
import { UserRole } from "../../models/Advisor";
import type { Client, ClientCreatePayload, ClientProfileUpdatePayload } from "../../models/Advisor";
import type { ClientAlertRuleResponse } from "../../models/Alert";
import { PageHeader, type PageAction } from "./PageHeader";
import { Module, ModuleHead } from "./PerformanceSection";
import { WealthSection } from "./WealthSection";
import { ConfirmDialog } from "./ConfirmDialog";
import { TONE_STYLES } from "./AlertGauge";

const SECTION = CLIENTS_SECTION;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CURRENCY_OPTIONS = ["EUR", "USD", "GBP", "CHF"];
const LANGUAGE_OPTIONS = [
  { value: "it", label: "Italian" },
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
];

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
 * client's investments are worth, how they've done and how their alerts stand, and adds or removes
 * clients. A client's page is their Wealth, the investor's own pages on the client's portfolios (a
 * PortfolioProvider of theirs, see WealthSection): their investments, each portfolio's Insights,
 * Transactions, Alerts (the advisor's), Strategy (adopted from the advisor's backtests, shared or
 * not) and Asset categories, plus the client's settings. The client is in each page's history
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
  return <ClientsList onOpen={openClient} />;
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

function ClientsList({ onOpen }: { onOpen: (uuid: string) => void }) {
  const { clients, error, added, removed } = useClients();
  const { rules } = useClientAlertRules();
  const figures = useClientsFigures(clients);
  const [adding, setAdding] = useState(false);
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
        actions={[{ label: "Add client", primary: true, onClick: () => setAdding(true) }]}
      />

      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}

      {clients.length === 0 ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="min-h-52 w-full rounded-[1.75rem] border-2 border-dashed border-[#E0DACC] bg-white flex flex-col items-center justify-center gap-2 px-6 text-center hover:border-[#C49A3C]/60 transition-colors"
        >
          <span className="w-12 h-12 rounded-2xl bg-[#1c1917] flex items-center justify-center mb-1"><Users className="w-5 h-5 text-[#C49A3C]" /></span>
          <span className="text-sm font-black text-[#1c1917]">No clients yet</span>
          <span className="text-xs text-[#78716c] max-w-sm">
            Add a client by their email: a new one gets an account, someone already on PortfoliAI is linked to you.
          </span>
        </button>
      ) : (
        <Module>
          <ModuleHead title="Your clients" desc="Open a client to see their portfolios." />
          <div className="hidden md:grid grid-cols-[minmax(0,1fr)_9rem_6rem_10rem_2rem] gap-4 px-6 pb-2 text-[10px] font-black uppercase tracking-widest text-[#a8a29e]">
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

      {adding && (
        <AddClientDialog
          onClose={() => setAdding(false)}
          onCreated={(client) => {
            added(client);
            setAdding(false);
          }}
        />
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
        <span className={`hidden md:block text-right text-sm font-bold tabular-nums ${ret == null ? "text-[#a8a29e]" : ret >= 0 ? "text-[#047857]" : "text-[#e11d48]"}`}>
          {ret == null ? "—" : signedPct(ret)}
        </span>
        <span className="col-span-2 md:col-span-1 pl-13 md:pl-0">
          {summary ? (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${TONE_STYLES[summary.tone].chip}`}>
              <BellRing className="w-3 h-3" /> {summary.text}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#a8a29e]">
              <BellRing className="w-3 h-3" /> {rules === null ? "…" : "No alerts"}
            </span>
          )}
        </span>
        <ChevronRight className="hidden md:block w-4 h-4 text-[#a8a29e] group-hover:text-[#C49A3C] transition-colors justify-self-end" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${clientDisplayName(client)}`}
        title="Remove client"
        className="absolute right-14 top-1/2 -translate-y-1/2 p-2 rounded-lg text-[#a8a29e] hover:text-rose-600 hover:bg-rose-50 transition-colors md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 hidden md:block"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </li>
  );
}

// ── A client's page ───────────────────────────────────────────────────────────────────────

/**
 * A client's Wealth, on their portfolios: the investor's pages (WealthSection) in this section,
 * under Clients › the client, with the client's settings and removal among their investments'
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
  const { loading, portfolios } = usePortfolio();
  const { updated, removed } = useClients();
  const [dialog, setDialog] = useState<"settings" | "remove" | null>(null);
  const scope = useMemo(() => ({ client: client.uuid }), [client.uuid]);
  const trail = useMemo(() => [{ label: "Clients", onClick: onBack }], [onBack]);

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-7 h-7 animate-spin text-[#C49A3C]" /></div>;
  }
  if (portfolios.length === 0) {
    return <p className="text-sm font-semibold text-rose-600 py-6">Unable to load {clientDisplayName(client)}&apos;s portfolios.</p>;
  }

  const extraActions: PageAction[] = [
    { label: "Client settings", onClick: () => setDialog("settings") },
    { label: "Remove client", danger: true, onClick: () => setDialog("remove") },
  ];

  return (
    <>
      <WealthSection onNavigate={onNavigate} section={SECTION} scope={scope} rootTrail={trail} extraActions={extraActions} />
      {dialog === "settings" && (
        <ClientSettingsDialog
          client={client}
          onClose={() => setDialog(null)}
          onSaved={(next) => {
            updated(next);
            setDialog(null);
          }}
        />
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

const fieldClass = "w-full h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal focus:border-[#C49A3C]/60 focus:ring-4 focus:ring-[#C49A3C]/10";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function DialogShell({ icon, title, subtitle, busy, onClose, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  busy?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Portaled to <body> above the dashboard's sticky header, like the app's other dialogs.
  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 md:p-8 space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200"
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
          <button onClick={onClose} disabled={busy} aria-label="Close" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0 disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function DialogButtons({ busy, disabled, label, onCancel, onConfirm }: { busy: boolean; disabled?: boolean; label: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-1">
      <button onClick={onCancel} disabled={busy} className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50">
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={busy || disabled}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#1c1917] hover:bg-[#C49A3C] transition-colors disabled:opacity-50 disabled:hover:bg-[#1c1917]"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {label}
      </button>
    </div>
  );
}

type LookupStatus = "idle" | "checking" | "new" | "existing_client" | "existing_other";

/**
 * ADD CLIENT — by email: as it's typed, the backend says whether someone has it (GET
 * /v1/advisor/clients/lookup). Someone already on PortfoliAI as an investor is linked as they are;
 * anyone else needs a name, a language and a currency for the account made for them.
 */
function AddClientDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (client: Client) => void }) {
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", language: "it", currency: "EUR" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lookup, setLookup] = useState<{ status: LookupStatus; firstName?: string | null; lastName?: string | null }>({ status: "idle" });
  const lookupRequestId = useRef(0);

  const set = (field: keyof typeof form) => (v: string) => setForm((prev) => ({ ...prev, [field]: v }));

  useEffect(() => {
    const email = form.email.trim();
    if (!EMAIL_RE.test(email)) {
      setLookup({ status: "idle" });
      return;
    }
    const requestId = ++lookupRequestId.current;
    setLookup({ status: "checking" });
    const timer = setTimeout(async () => {
      try {
        const result = await advisorService.lookupClient(email);
        if (lookupRequestId.current !== requestId) return;
        if (!result.exists) {
          setLookup({ status: "new" });
        } else if (result.role === UserRole.USER) {
          setLookup({ status: "existing_client", firstName: result.first_name, lastName: result.last_name });
          setForm((prev) => ({ ...prev, first_name: result.first_name ?? prev.first_name, last_name: result.last_name ?? prev.last_name }));
        } else {
          setLookup({ status: "existing_other" });
        }
      } catch {
        if (lookupRequestId.current === requestId) setLookup({ status: "idle" });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.email]);

  const linking = lookup.status === "existing_client";
  const isValid = lookup.status === "existing_other"
    ? false
    : linking ? Boolean(form.email.trim()) : Boolean(form.email.trim() && form.first_name.trim() && form.last_name.trim());

  const submit = async () => {
    if (!isValid) return;
    setBusy(true);
    setError("");
    try {
      // Existing users may have no name on record; the backend ignores these fields for them
      // anyway, but the payload still requires non-empty values.
      const payload: ClientCreatePayload = {
        email: form.email.trim(),
        first_name: form.first_name.trim() || "Client",
        last_name: form.last_name.trim() || "-",
        language: form.language,
        currency: form.currency || undefined,
      };
      onCreated(await advisorService.createClient(payload));
    } catch {
      setError("Unable to add this client. Please try again.");
      setBusy(false);
    }
  };

  const existingName = `${lookup.firstName ?? ""} ${lookup.lastName ?? ""}`.trim();

  return (
    <DialogShell icon={<UserPlus className="h-5 w-5" />} title="Add client" subtitle="By their email" busy={busy} onClose={onClose}>
      <div className="space-y-4">
        <div className="relative">
          <Field label="Email" required>
            <input autoFocus type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} placeholder="name@example.com" className={fieldClass} />
          </Field>
          {lookup.status === "checking" && <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3.5 top-[34px]" />}
        </div>

        {linking && (
          <p className="flex items-start gap-2.5 rounded-xl bg-[#C49A3C]/10 border border-[#C49A3C]/30 px-4 py-3 text-[13px] font-semibold text-[#8A6A28]">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            {existingName || "This person"} is already on PortfoliAI: they&apos;re linked to you as they are, with nothing to fill in.
          </p>
        )}
        {lookup.status === "existing_other" && (
          <p className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-[13px] font-semibold text-rose-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            This email belongs to another kind of account and can&apos;t be added as a client.
          </p>
        )}

        {!linking && lookup.status !== "existing_other" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="First name" required>
                <input value={form.first_name} onChange={(e) => set("first_name")(e.target.value)} className={fieldClass} />
              </Field>
              <Field label="Last name" required>
                <input value={form.last_name} onChange={(e) => set("last_name")(e.target.value)} className={fieldClass} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Language">
                <select value={form.language} onChange={(e) => set("language")(e.target.value)} className={fieldClass}>
                  {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Portfolio currency">
                <select value={form.currency} onChange={(e) => set("currency")(e.target.value)} className={fieldClass}>
                  {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          </>
        )}

        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <DialogButtons busy={busy} disabled={!isValid} label={linking ? "Link client" : "Add client"} onCancel={onClose} onConfirm={submit} />
      </div>
    </DialogShell>
  );
}

/**
 * CLIENT SETTINGS — a client's language and portfolio currency. Changing the currency makes the
 * backend recompute the client's whole history in it.
 */
function ClientSettingsDialog({ client, onClose, onSaved }: { client: Client; onClose: () => void; onSaved: (client: Client) => void }) {
  const [form, setForm] = useState({ currency: client.currency ?? "EUR", language: client.language ?? "it" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = form.currency !== (client.currency ?? "EUR") || form.language !== (client.language ?? "it");
  const currencyChanged = form.currency !== (client.currency ?? "EUR");

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload: ClientProfileUpdatePayload = { currency: form.currency || null, language: form.language || null };
      await advisorService.updateClientProfile(client.uuid, payload);
      onSaved({ ...client, currency: payload.currency ?? client.currency, language: payload.language ?? client.language });
    } catch {
      setError("Unable to save the client's settings. Please try again.");
      setBusy(false);
    }
  };

  return (
    <DialogShell icon={<Settings2 className="h-5 w-5" />} title="Client settings" subtitle={`${clientDisplayName(client)} · ${client.email}`} busy={busy} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Language">
            <select value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} className={fieldClass}>
              {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Portfolio currency">
            <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className={fieldClass}>
              {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        {currencyChanged && (
          <p className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs font-semibold text-amber-800">
            Every figure of {clientDisplayName(client)}&apos;s is recomputed in {form.currency}: it can take a few minutes.
          </p>
        )}
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <DialogButtons busy={busy} disabled={!dirty} label="Save" onCancel={onClose} onConfirm={save} />
      </div>
    </DialogShell>
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

