// components/dashboard/AdvisorDashboardOverview.tsx
"use client";

import { ArrowRight, BellRing, ChevronRight, History, Loader2, Users } from "lucide-react";
import { useUser } from "../../context/UserContext";
import { usePortfolio } from "../../context/PortfolioContext";
import { clientDisplayName, useClients } from "../../context/ClientsContext";
import { useClientAlertRules } from "../../hooks/useAlertRules";
import { useClientsFigures, totalsByCurrency } from "../../hooks/useClientsFigures";
import { alertFigures, alertState, alertUrgency, describeAlert, type AlertTone } from "../../lib/alerts";
import { CLIENTS_SECTION, openBacktestPage, openClientPage, openPlanPage } from "../../lib/dashboardNav";
import { formatCurrency } from "../../lib/format";
import { isBacktest } from "../../models/Portfolio";
import { PageHeader } from "./PageHeader";
import { Module, ModuleHead } from "./PerformanceSection";
import { ClientAvatar } from "./ClientsSection";
import { TONE_STYLES } from "./AlertGauge";

// How many of each list the dashboard shows before pointing to the rest.
const ALERTS_SHOWN = 6;
const CLIENTS_SHOWN = 5;
const STRATEGIES_SHOWN = 4;

const BAR_COLOR: Record<AlertTone, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-red-500",
  muted: "bg-slate-300",
};

const signedPct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
const dateLabel = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "");

function LinkButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 text-xs font-bold text-[#C49A3C] hover:text-[#a8822f] transition-colors">
      {children} <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );
}

function EmptyRow({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="px-6 pb-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <span className="w-11 h-11 rounded-2xl bg-[#1c1917] text-[#C49A3C] flex items-center justify-center shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-[#1c1917]">{title}</span>
        <span className="block text-xs text-[#78716c] mt-0.5 leading-relaxed">{text}</span>
      </span>
      {action}
    </div>
  );
}

/**
 * ADVISOR DASHBOARD — the advisor's day at a glance: what their clients' investments add up to,
 * the alerts on them that need a look (triggered first, then the closest to their threshold, each
 * opening that portfolio's Alerts page in the client's Wealth), their clients by what they hold,
 * and their own strategies (Plan's Strategy). The alerts refresh every minute: the backend checks
 * the rules about every 5 minutes.
 */
export default function AdvisorDashboardOverview({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { user } = useUser();
  const { clients, loading } = useClients();
  const { portfolios } = usePortfolio();
  const { rules, loading: rulesLoading, error: rulesError } = useClientAlertRules(60_000);
  const figures = useClientsFigures(clients);

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-7 h-7 animate-spin text-[#C49A3C]" /></div>;
  }

  const byUuid = new Map(clients.map((c) => [c.uuid, c]));
  const sortedRules = [...(rules ?? [])].filter((r) => byUuid.has(r.clientUuid)).sort((a, b) => alertUrgency(b) - alertUrgency(a));
  const triggered = sortedRules.filter((r) => alertState(r).tone === "danger").length;
  const totals = figures ? totalsByCurrency(figures) : null;
  const aum = totals === null ? null : totals.length === 0 ? "—" : totals.map((t) => formatCurrency(t.value, t.currency, 0)).join(" + ");
  const topClients = [...clients]
    .sort((a, b) => (figures?.get(b.uuid)?.marketValue ?? -1) - (figures?.get(a.uuid)?.marketValue ?? -1))
    .slice(0, CLIENTS_SHOWN);
  const strategies = portfolios.filter(isBacktest).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const greeting = user?.first_name ? `Hello, ${user.first_name}` : "Dashboard";

  return (
    <div className="space-y-[22px] pb-12">
      <PageHeader
        eyebrow="Advisor"
        title={greeting}
        value={clients.length > 0 ? aum : undefined}
        note={clients.length > 0 ? `Your ${clients.length} ${clients.length === 1 ? "client's" : "clients'"} investments together` : "Add your first client to get started"}
        actions={[
          { label: "Clients", primary: true, plus: false, onClick: () => onNavigate(CLIENTS_SECTION) },
          { label: "New strategy", onClick: () => openPlanPage(onNavigate, "strategy") },
        ]}
        figures={[
          { label: "Clients", value: String(clients.length) },
          { label: "Your alerts", value: rules === null ? "—" : String(sortedRules.length), sub: "On their portfolios" },
          { label: "Triggered", value: rules === null ? "—" : String(triggered), tone: triggered > 0 ? "loss" : undefined },
          { label: "Strategies", value: String(strategies.length), sub: "Your backtests" },
        ]}
      />

      <Module>
        <ModuleHead
          title="Alerts to look at"
          icon={<BellRing className="w-3.5 h-3.5 text-[#78716c]" />}
          right={triggered > 0 ? (
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${TONE_STYLES.danger.chip}`}>{triggered} triggered</span>
          ) : undefined}
        />
        {rulesLoading ? (
          <div className="flex justify-center pb-8"><Loader2 className="w-6 h-6 animate-spin text-[#C49A3C]" /></div>
        ) : rulesError ? (
          <p className="px-6 pb-6 text-sm text-[#78716c]">Unable to load your clients&apos; alerts.</p>
        ) : sortedRules.length === 0 ? (
          <EmptyRow
            icon={<BellRing className="w-5 h-5" />}
            title="No alerts on your clients yet"
            text="Open a client's portfolio, then Alerts: be told when it moves by a set amount, or when a holding or an asset class leaves a range you choose."
            action={clients.length > 0 ? <LinkButton onClick={() => onNavigate(CLIENTS_SECTION)}>Open a client</LinkButton> : undefined}
          />
        ) : (
          <>
            <ul className="divide-y divide-[#EEE9DD] border-t border-[#EEE9DD]">
              {sortedRules.slice(0, ALERTS_SHOWN).map((rule) => {
                const client = byUuid.get(rule.clientUuid)!;
                const name = clientDisplayName(client);
                const state = alertState(rule);
                const figs = alertFigures(rule);
                const { title } = describeAlert(rule, name);
                return (
                  <li key={rule.ruleId}>
                    <button
                      type="button"
                      onClick={() => openClientPage(onNavigate, client.uuid, { kind: "portfolio", uuid: rule.portfolioUuid, page: "alerts" })}
                      className="w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-[#FBFAF6] transition-colors"
                    >
                      <ClientAvatar client={client} size="sm" />
                      <span className="flex-1 min-w-0">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-bold text-[#1c1917] truncate">{name}</span>
                          <span className="text-xs text-[#a8a29e] truncate">{rule.portfolioName}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TONE_STYLES[state.tone].chip}`}>{state.label}</span>
                        </span>
                        <span className="block text-xs text-[#78716c] truncate">{title}</span>
                        {state.progressPct !== null && (
                          <span className="mt-1.5 flex items-center gap-2">
                            <span className="h-1.5 flex-1 max-w-56 rounded-full bg-slate-100 overflow-hidden">
                              <span className={`block h-full rounded-full ${BAR_COLOR[state.tone]}`} style={{ width: `${Math.max(2, Math.min(100, state.progressPct))}%` }} />
                            </span>
                            {figs && <span className="text-[11px] font-bold text-[#78716c] whitespace-nowrap tabular-nums">{figs.current} / {figs.limit}</span>}
                          </span>
                        )}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#a8a29e] shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {sortedRules.length > ALERTS_SHOWN && (
              <p className="px-6 py-3 border-t border-[#EEE9DD] text-xs text-[#78716c]">
                {sortedRules.length - ALERTS_SHOWN} more, on each client&apos;s portfolios.
              </p>
            )}
          </>
        )}
      </Module>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-[22px]">
        <Module className="xl:col-span-3">
          <ModuleHead
            title="Clients"
            icon={<Users className="w-3.5 h-3.5 text-[#78716c]" />}
            right={clients.length > 0 ? <LinkButton onClick={() => onNavigate(CLIENTS_SECTION)}>All clients</LinkButton> : undefined}
          />
          {clients.length === 0 ? (
            <EmptyRow
              icon={<Users className="w-5 h-5" />}
              title="No clients yet"
              text="Add a client by their email: a new one gets an account, someone already on PortfoliAI is linked to you."
              action={<LinkButton onClick={() => onNavigate(CLIENTS_SECTION)}>Add a client</LinkButton>}
            />
          ) : (
            <ul className="divide-y divide-[#EEE9DD] border-t border-[#EEE9DD]">
              {topClients.map((c) => {
                const f = figures?.get(c.uuid);
                const ret = f?.totalReturnPct ?? null;
                return (
                  <li key={c.uuid}>
                    <button
                      type="button"
                      onClick={() => openClientPage(onNavigate, c.uuid)}
                      className="w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-[#FBFAF6] transition-colors"
                    >
                      <ClientAvatar client={c} size="sm" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-[#1c1917] truncate">{clientDisplayName(c)}</span>
                        <span className="block text-xs text-[#78716c] truncate">{c.email}</span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block text-sm font-black tabular-nums text-[#1c1917]">
                          {figures === undefined ? <span className="inline-block h-3 w-16 rounded bg-slate-100 animate-pulse" /> : f ? formatCurrency(f.marketValue, f.currency, 0) : "—"}
                        </span>
                        {ret != null && (
                          <span className={`block text-[11px] font-bold tabular-nums ${ret >= 0 ? "text-[#047857]" : "text-[#e11d48]"}`}>{signedPct(ret)}</span>
                        )}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#a8a29e] shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Module>

        <Module className="xl:col-span-2">
          <ModuleHead
            title="Your strategies"
            icon={<History className="w-3.5 h-3.5 text-[#78716c]" />}
            right={strategies.length > 0 ? <LinkButton onClick={() => openPlanPage(onNavigate, "strategy")}>Strategy</LinkButton> : undefined}
          />
          {strategies.length === 0 ? (
            <EmptyRow
              icon={<History className="w-5 h-5" />}
              title="No strategies yet"
              text="Backtest a strategy, adopt it on a client's portfolio and share it with them, or publish it to Explore."
              action={<LinkButton onClick={() => openPlanPage(onNavigate, "strategy")}>New strategy</LinkButton>}
            />
          ) : (
            <ul className="divide-y divide-[#EEE9DD] border-t border-[#EEE9DD]">
              {strategies.slice(0, STRATEGIES_SHOWN).map((p) => (
                <li key={p.uuid}>
                  <button
                    type="button"
                    onClick={() => openBacktestPage(onNavigate, p.uuid)}
                    className="w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-[#FBFAF6] transition-colors"
                  >
                    <span className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0"><History className="w-4 h-4" /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-[#1c1917] truncate">{p.name}</span>
                      <span className="block text-xs text-[#78716c]">Created {dateLabel(p.createdAt)}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#a8a29e] shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Module>
      </div>
    </div>
  );
}
