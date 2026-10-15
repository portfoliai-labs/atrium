// components/preview/WalletPages.tsx
"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileText, Lightbulb, Plus, Search } from "lucide-react";
import { PortfolioGroupCard } from "../dashboard/PortfolioGroupCard";
import { ReportFileTile } from "../dashboard/ReportFileTile";
import { GenerateReportDialog } from "../dashboard/GenerateReportDialog";
import { TONE_STYLES } from "../dashboard/AlertGauge";
import { Toggle } from "../dashboard/Toggle";
import { CategoryChip } from "../dashboard/wallets/WalletTransactions";
import { formatCompact, formatCurrency } from "../../lib/format";
import { CATEGORY_LABELS, KIND_LABELS, categoryLabel, monthName } from "../../lib/wallets";
import {
  BUDGETS, CURRENT_MONTH, DEMO_WALLETS, RECURRING, WALLET_ALERTS, WALLET_REPORTS, spentThisMonth, topMerchants,
  type WalletAlert,
} from "../../lib/mock/wallets";
import { AXIS_TICK, ComingSoonButton, Panel, PreviewBadge, PreviewBanner, TOOLTIP_STYLE, formatPct, serif } from "./PreviewKit";

/**
 * WALLET PREVIEWS — what the Wallets don't have from the API yet, shown to a demo account only, on
 * its sample data (lib/mock/wallets): Budgets, Reports and Alerts as pages of their own, and on
 * Insights what PortfoliAI noticed, the top merchants and the recurring payments. Everything else
 * on a wallet's pages is the real thing (components/dashboard/wallets), which a demo account reads
 * on the same sample data.
 */

const eur = (v: number, d = 0) => formatCurrency(v, "EUR", d);
// Day 28 of September's 30: how far into the month budgets should be.
const MONTH_ELAPSED = 28 / 30;
const walletOf = (uuid: string) => DEMO_WALLETS.find((w) => w.uuid === uuid)!;

// ── Insights' extras ─────────────────────────────────────────────────────────────────────────

export function DemoInsightExtras({ scope }: { scope: string | null }) {
  const merchants = useMemo(() => topMerchants(scope), [scope]);
  const restaurantsNow = spentThisMonth(scope, "restaurants");
  const subscriptions = RECURRING.filter((r) => ["Netflix", "Spotify", "iCloud+"].includes(r.name)).reduce((s, r) => s + r.amount, 0);
  const groceries = spentThisMonth(scope, "groceries");

  return (
    <>
      <div className="bg-[#1c1917] rounded-3xl p-5 md:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-[#C49A3C]" />
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C]">What PortfoliAI noticed</p>
          <PreviewBadge dark />
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            `Groceries are at ${eur(groceries)} this month, ${formatPct(((groceries / 320) - 1) * 100, 0)} on your budget.`,
            `Eating out is at ${eur(restaurantsNow)} this month.`,
            `Streaming and cloud subscriptions cost ${eur(subscriptions * 12)} a year. Investing it monthly instead would be a ${eur(subscriptions, 2)} PAC.`,
          ].map((text) => (
            <li key={text} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-[13px] text-stone-300 leading-relaxed">{text}</li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Top merchants" subtitle="Last 12 months." right={<PreviewBadge />}>
          <ul className="px-6 md:px-7 py-4 divide-y divide-slate-100">
            {merchants.map((m) => (
              <li key={m.name} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-800 truncate">{m.name}</p>
                  <p className="text-[11px] font-semibold text-slate-400">{m.count} {m.count === 1 ? "payment" : "payments"} · {categoryLabel(m.category)}</p>
                </div>
                <span className="text-[13px] font-black tabular-nums text-slate-900">{eur(m.amount)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Recurring payments" subtitle="Detected from repeating charges." right={<PreviewBadge />}>
          <ul className="px-6 md:px-7 py-4 divide-y divide-slate-100">
            {RECURRING.map((r) => (
              <li key={r.name} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-800 truncate">{r.name}</p>
                  <p className="text-[11px] font-semibold text-slate-400">{r.every}</p>
                </div>
                <span className="text-[13px] font-black tabular-nums text-slate-900">{eur(r.amount, 2)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

// ── Budgets ──────────────────────────────────────────────────────────────────────────────────

export function WalletBudgets({ scope }: { scope: string | null }) {
  const rows = useMemo(() => BUDGETS.map((b) => ({ ...b, spent: spentThisMonth(scope, b.category) })), [scope]);
  const totalLimit = rows.reduce((s, b) => s + b.limit, 0);
  const totalSpent = rows.reduce((s, b) => s + b.spent, 0);
  const chart = rows.map((b) => ({ name: CATEGORY_LABELS[b.category], spent: Math.round(b.spent), limit: b.limit }));

  return (
    <>
      <PreviewBanner feature="Budgets" />
      <section className="bg-white rounded-4xl border border-slate-200 shadow-sm p-6 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">{monthName(CURRENT_MONTH)} · day 28 of 30</p>
            <p className="text-3xl font-black text-slate-900 tabular-nums" style={serif}>
              {eur(totalSpent)} <span className="text-lg text-slate-400">of {eur(totalLimit)}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-[13px] font-bold text-slate-500">
              {totalSpent <= totalLimit ? `${eur(totalLimit - totalSpent)} left for the month` : `${eur(totalSpent - totalLimit)} over budget`}
            </p>
            <ComingSoonButton icon={<Plus className="h-3.5 w-3.5" />}>New budget</ComingSoonButton>
          </div>
        </div>
        <BudgetBar spent={totalSpent} limit={totalLimit} big />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.map((b) => {
          const pct = (b.spent / b.limit) * 100;
          const status = pct > 100 ? "Over budget" : pct > MONTH_ELAPSED * 100 + 5 ? "Ahead of pace" : pct >= 90 ? "Almost used" : "On track";
          const tone = pct > 100 ? "text-rose-600 bg-rose-50" : status === "On track" ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50";
          return (
            <div key={b.category} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between gap-3">
                <CategoryChip category={b.category} />
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${tone}`}>{status}</span>
              </div>
              <p className="text-lg font-black tabular-nums text-slate-900 mt-3">
                {eur(b.spent)} <span className="text-sm text-slate-400 font-bold">/ {eur(b.limit)}</span>
              </p>
              <BudgetBar spent={b.spent} limit={b.limit} />
            </div>
          );
        })}
      </div>

      <Panel title="Spent vs budget, this month">
        <div className="p-4 md:p-6 h-72">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 280 }}>
            <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={48} />
              <YAxis tickFormatter={formatCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} formatter={(v, n) => [eur(Number(v)), n === "spent" ? "Spent" : "Budget"]} />
              <Bar dataKey="limit" fill="#e2e8f0" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
              <Bar dataKey="spent" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false}>
                {chart.map((c) => <Cell key={c.name} fill={c.spent > c.limit ? "#f43f5e" : "#C49A3C"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </>
  );
}

// The pace marker shows where spending "should" be this far into the month.
function BudgetBar({ spent, limit, big }: { spent: number; limit: number; big?: boolean }) {
  const pct = Math.min(100, (spent / limit) * 100);
  const over = spent > limit;
  return (
    <div className={`relative ${big ? "h-3 mt-5" : "h-2 mt-3"} rounded-full bg-slate-100`}>
      <div className={`h-full rounded-full ${over ? "bg-rose-500" : pct > MONTH_ELAPSED * 100 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
      <span className="absolute -top-1 -bottom-1 w-0.5 bg-slate-400 rounded" style={{ left: `${MONTH_ELAPSED * 100}%` }} title="Where spending should be by today" />
    </div>
  );
}

// ── Reports ──────────────────────────────────────────────────────────────────────────────────

const WALLET_REPORT_KINDS = {
  monthly: { cover: "periodic" as const, label: "Monthly statement", description: "One wallet's month: what came in, what went out, and the closing balance." },
  yearly: { cover: "full" as const, label: "Yearly summary", description: "One wallet's year: income, spending by category, savings rate." },
};

/**
 * Every wallet's reports as files, as on Investments (ReportFileTile): each with its kind's cover,
 * its wallet and its tags (changed on this page only), one search by file, wallet, kind or tag,
 * and "Generate report" opening the same dialog (GenerateReportDialog), which can't send yet.
 */
export function WalletReports() {
  const [files, setFiles] = useState(WALLET_REPORTS);
  const [query, setQuery] = useState("");
  const [generating, setGenerating] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files
      .filter((f) => !q || [f.name, walletOf(f.walletUuid).name, WALLET_REPORT_KINDS[f.kind].label, ...f.tags].join(" ").toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [files, query]);
  const setTags = (id: string, change: (tags: string[]) => string[]) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, tags: change(f.tags) } : f)));

  return (
    <>
      <PreviewBanner feature="Wallet reports">Sample statements. Tags change on this page only and aren&apos;t saved; opening, downloading and generating are on the way.</PreviewBanner>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-[#C49A3C] transition-colors" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by file, wallet or tag…"
            aria-label="Search reports"
            className="w-full h-12 pl-11 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-medium outline-none focus:ring-4 focus:ring-[#C49A3C]/10 focus:border-[#C49A3C]/50 transition-all shadow-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setGenerating(true)}
          className="h-12 flex items-center justify-center gap-2 px-5 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors shrink-0"
        >
          <FileText className="h-4 w-4" />
          Generate report
        </button>
      </div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
        {shown.length} {shown.length === 1 ? "file" : "files"}{query.trim() && ` matching "${query.trim()}"`}
      </p>
      {shown.length === 0 ? (
        <p className="text-sm font-semibold text-slate-500 px-1">Nothing matches your search.</p>
      ) : (
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-5">
          {shown.map((f) => {
            const wallet = walletOf(f.walletUuid);
            return (
              <ReportFileTile
                key={f.id}
                name={f.name}
                cover={WALLET_REPORT_KINDS[f.kind].cover}
                kindLabel={WALLET_REPORT_KINDS[f.kind].label}
                ownerName={wallet.name}
                color={wallet.color!}
                createdAt={f.createdAt}
                tags={f.tags}
                readOnly={false}
                onAddTag={(tag) => setTags(f.id, (tags) => [...tags, tag])}
                onRemoveTag={(tag) => setTags(f.id, (tags) => tags.filter((t) => t !== tag))}
              />
            );
          })}
        </div>
      )}
      {generating && (
        <GenerateReportDialog
          kinds={(Object.keys(WALLET_REPORT_KINDS) as (keyof typeof WALLET_REPORT_KINDS)[]).map((id) => ({ id, available: true, ...WALLET_REPORT_KINDS[id] }))}
          targets={DEMO_WALLETS.map((w) => ({ id: w.uuid, name: w.name, color: w.color! }))}
          targetLabel="Wallet"
          readOnly
          readOnlyTitle="Coming soon: wallet reports are a preview"
          onGenerate={() => setGenerating(false)}
          onClose={() => setGenerating(false)}
        />
      )}
    </>
  );
}

// ── Alerts ───────────────────────────────────────────────────────────────────────────────────

const ALERT_BAR: Record<"danger" | "warn" | "ok" | "muted", string> = {
  danger: "bg-rose-500", warn: "bg-amber-500", ok: "bg-emerald-500", muted: "bg-slate-300",
};

// A sample rule's state, worded as the investments' are (see lib/alerts).
function walletAlertState(a: WalletAlert): { label: string; tone: keyof typeof ALERT_BAR } {
  if (!a.enabled) return { label: "Off", tone: "muted" };
  if (a.triggered) return { label: "Triggered", tone: "danger" };
  if (a.progressPct === undefined) return { label: "Watching", tone: "ok" };
  return a.progressPct >= 60 ? { label: "Approaching", tone: "warn" } : { label: "Within range", tone: "ok" };
}

/**
 * The sample rules, as on Investments' Alerts: a card per wallet (PortfolioGroupCard) with its
 * count, its rules by state and its (not yet available) "New alert", then one row per rule across
 * the card — what it watches; where it stands (now against the limit, how far along the way);
 * its switch, which works on this page only.
 */
export function WalletAlerts() {
  const [alerts, setAlerts] = useState(WALLET_ALERTS);
  return (
    <>
      <PreviewBanner feature="Wallet alerts">Sample rules. Switching them on or off works on this page only and isn&apos;t saved.</PreviewBanner>
      {DEMO_WALLETS.map((w) => {
        const own = alerts.filter((a) => a.walletUuid === w.uuid);
        const counts = (["danger", "warn", "ok", "muted"] as const)
          .map((tone) => ({ tone, count: own.filter((a) => walletAlertState(a).tone === tone).length }))
          .filter((t) => t.count > 0);
        return (
          <PortfolioGroupCard
            key={w.uuid}
            name={w.name}
            eyebrow="Wallet"
            color={w.color!}
            subtitle={<>{own.length === 0 ? "No alerts yet" : `${own.length} ${own.length === 1 ? "alert" : "alerts"}`}<span className="text-[#a8a29e]"> · {KIND_LABELS[w.kind]}</span></>}
            right={<>
              {counts.map((t) => (
                <span key={t.tone} className={`px-3 py-1 rounded-full text-xs font-bold tabular-nums ${TONE_STYLES[t.tone].chip}`}>
                  {t.count} {TONE_WORD[t.tone]}
                </span>
              ))}
              <ComingSoonButton icon={<Plus className="h-4 w-4" />}>New alert</ComingSoonButton>
            </>}
          >
            {own.length === 0 ? (
              <p className="px-6 md:px-8 py-5 border-t border-[rgba(196,154,60,0.12)] text-sm text-[#a8a29e]">
                Nothing watched on this wallet. Alerts will tell you about a low balance, a large payment or a budget running out.
              </p>
            ) : (
              <ul className="px-6 md:px-8 border-t border-[rgba(196,154,60,0.12)] divide-y divide-[rgba(196,154,60,0.1)]">
                {own.map((a) => {
                  const state = walletAlertState(a);
                  const progress = a.enabled ? a.progressPct : undefined;
                  return (
                    <li key={a.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-x-8 gap-y-4 py-5">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[15px] font-black text-[#1c1917]">{a.title}<PreviewBadge label="Sample" /></p>
                        <p className="text-[13px] text-[#78716c] mt-1">{a.detail}</p>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${TONE_STYLES[state.tone].chip}`}>{state.label}</span>
                          {a.enabled && a.now && (
                            <span className="text-[13px] font-bold tabular-nums text-[#1c1917]">
                              {a.now} <span className="text-[#a8a29e] font-semibold">of {a.limit}</span>
                            </span>
                          )}
                        </div>
                        <div className="mt-2.5 h-2 rounded-full bg-[#F1EEE6] overflow-hidden">
                          {progress !== undefined && <div className={`h-full rounded-full ${ALERT_BAR[state.tone]}`} style={{ width: `${Math.max(3, progress)}%` }} />}
                        </div>
                        <p className="text-[11px] font-semibold text-[#a8a29e] mt-1.5">
                          {progress !== undefined ? `${progress}% of the way to the limit` : a.enabled ? "Fires on the event itself" : "Not being checked"}
                        </p>
                      </div>
                      <div className="md:justify-self-end">
                        <Toggle
                          checked={a.enabled}
                          label={a.title}
                          onChange={(v) => setAlerts((list) => list.map((x) => (x.id === a.id ? { ...x, enabled: v } : x)))}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </PortfolioGroupCard>
        );
      })}
    </>
  );
}

const TONE_WORD: Record<keyof typeof ALERT_BAR, string> = {
  danger: "triggered", warn: "approaching", ok: "within range", muted: "off",
};
