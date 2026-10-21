// components/dashboard/wallets/WalletNode.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, Landmark, Loader2, Plus } from "lucide-react";
import { useWallets, useWalletSummary } from "../../../context/WalletsContext";
// The retired hub's (see below): import { useWalletSummaries } from "../../../context/WalletsContext";
import { walletService } from "../../../services/walletService";
import { formatCurrency } from "../../../lib/format";
import { ALL_WALLETS, KIND_LABELS, currentAlertFindings, errorText, savingsRate, walletColor } from "../../../lib/wallets";
import type { Wallet } from "../../../models/Wallet";
// The retired hub's (see below): import type { WalletSummary } from "../../../models/Wallet";
import { Breadcrumb, type Crumb } from "../Breadcrumb";
import { PageHeader, type PageAction, type PageFigure } from "../PageHeader";
import { ConfirmDialog } from "../ConfirmDialog";
import { ExploreHost } from "../ExploreView";
// The retired hub's (see below):
// import { FeaturedCard, PortfolioHolder, type HolderItem } from "../PortfolioHolder";
// import { VIRTUAL_COLOR } from "../BacktestMarks";
import { WalletsComposition } from "./WalletsComposition";
import { DEMO_DISABLED_TITLE } from "../../preview/DemoBanner";
import { PreviewBadge } from "../../preview/PreviewKit";
import { WalletAlerts } from "./WalletAlerts";
import { WalletBanks } from "./WalletBanks";
import { WalletBudgets } from "./WalletBudgets";
import { AddMovementDialog, WalletFormDialog } from "./WalletDialogs";
import { ManageWallets } from "./ManageWallets";
import { WalletImportDialog } from "./WalletImportDialog";
import { WalletInsights } from "./WalletInsights";
import { WalletReports } from "./WalletReports";
import { WalletTransactions } from "./WalletTransactions";

export type WalletPage = "insights" | "transactions" | "budgets" | "reports" | "alerts" | "banks" | "manage";

export const WALLET_PAGE_LABELS: Record<WalletPage, string> = {
  insights: "Insights", transactions: "Transactions", budgets: "Budgets", reports: "Reports", alerts: "Alerts", banks: "Banks", manage: "Manage wallets",
};

const ARCHIVED_TITLE = "An archived wallet is read only";

type Dialog = "new" | "edit" | "movement" | "import" | "archive" | "delete";

/**
 * WALLET NODE — every wallet together (ALL_WALLETS), or one, in Wealth, built like a portfolio's
 * page, All wallets standing to its wallets as All portfolios to its portfolios: a header with its
 * balance, its activity (each count opening its page), what can be done with it and its year in
 * figures; under it, on All wallets, its Composition, a row per wallet going down to that wallet
 * (the archived ones listed after it), then the Insights. Its Transactions, Budgets, Reports and Alerts are pages of
 * their own, and All wallets' Banks (the banks connected through open banking) and Manage wallets (each
 * wallet's bank account linked there). A wallet that's gone (deleted, or from an old link) opens all
 * of them. Archived wallets are read only, and so is everything for a demo account.
 */
export function WalletNode({ id, page, rootTrail, onOpen }: {
  id: string;
  page: WalletPage;
  rootTrail: Crumb[];
  onOpen: (id: string, page: WalletPage) => void;
}) {
  const { wallets, loading, error, sample, version, changed } = useWallets();
  const wallet = id === ALL_WALLETS ? undefined : wallets.find((w) => w.uuid === id);
  const all = !wallet;
  const scope = wallet?.uuid ?? null;
  const summary = useWalletSummary(scope, !loading);
  const active = useMemo(() => wallets.filter((w) => !w.archived), [wallets]);
  const archivedWallets = useMemo(() => wallets.map((w, i) => ({ wallet: w, color: walletColor(w, i) })).filter(({ wallet: w }) => w.archived), [wallets]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const count = useMovementCount(scope, version);
  const attention = useAttention(scope, version);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 text-[#C49A3C] animate-spin" /></div>;

  const title = wallet ? wallet.name : "All wallets";
  const readOnly = sample || !!wallet?.archived;
  const locked = sample ? { disabled: true, title: DEMO_DISABLED_TITLE } : wallet?.archived ? { disabled: true, title: ARCHIVED_TITLE } : {};
  const sampleLock = sample ? { disabled: true, title: DEMO_DISABLED_TITLE } : {};
  const allCrumb: Crumb = { label: "Wallets", onClick: () => onOpen(ALL_WALLETS, "insights") };
  const trail = all ? rootTrail : [...rootTrail, allCrumb];
  const nodeCrumb: Crumb = { label: title, onClick: () => onOpen(id, "insights") };
  const close = () => { setDialog(null); setDialogError(null); };
  const done = () => { close(); changed(); };

  const run = async (action: () => Promise<unknown>, fallback: string, after?: () => void) => {
    setBusy(true);
    setDialogError(null);
    try {
      await action();
      close();
      changed();
      after?.();
    } catch (err) {
      setDialogError(errorText(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  // ── What can be done with it ──
  const actions: PageAction[] = wallet
    ? [
        { label: "Add movement", primary: true, onClick: () => setDialog("movement"), ...locked },
        { label: "Reports", onClick: () => onOpen(id, "reports") },
        // Budgets are across the wallets, but they can be set from any wallet's page.
        { label: "Budgets", onClick: () => onOpen(id, "budgets") },
        { label: "Import statement", onClick: () => setDialog("import"), ...locked },
        { label: "Edit wallet", onClick: () => setDialog("edit"), ...locked },
        { label: wallet.archived ? "Unarchive" : "Archive", onClick: () => setDialog("archive"), ...sampleLock },
        { label: "Delete wallet", danger: true, onClick: () => setDialog("delete"), ...sampleLock },
      ]
    : [
        // Manage wallets is where a wallet is added, and where each one's bank account is linked.
        { label: "Manage wallets", primary: true, onClick: () => onOpen(ALL_WALLETS, "manage") },
        { label: "Budgets", onClick: () => onOpen(ALL_WALLETS, "budgets") },
        // Its page lists the banks connected, a demo account's sample one included.
        { label: "Connect a bank", onClick: () => onOpen(ALL_WALLETS, "banks") },
      ];

  const counters = [
    { key: "transactions", label: "transactions", count, onClick: () => onOpen(id, "transactions") },
    {
      key: "budgets", label: "budgets", count: attention?.budgets ?? null, onClick: () => onOpen(id, "budgets"),
      attention: attention?.over ? { count: attention.over, label: "over" } : undefined,
    },
    {
      key: "alerts", label: "alerts", count: attention?.rules ?? null, onClick: () => onOpen(id, "alerts"),
      attention: attention?.found ? { count: attention.found, label: "found" } : undefined,
    },
    // A report is one wallet's: its Reports are on its own page only.
    ...(wallet ? [{ key: "reports", label: "reports", count: null, onClick: () => onOpen(id, "reports") }] : []),
  ];

  const currency = wallet?.currency ?? summary?.currency ?? "EUR";
  const money = (v: number) => formatCurrency(v, currency, 0);
  const value = wallet
    ? formatCurrency(wallet.balance, wallet.currency, 0)
    : summary === undefined ? null : summary ? money(summary.months.at(-1)?.closingBalance ?? 0) : "—";
  const rate = summary ? savingsRate(summary.months) : null;
  const figures: PageFigure[] = summary ? [
    { label: "In, 12 months", value: money(summary.months.reduce((s, m) => s + m.income, 0)), tone: "gain" },
    { label: "Out, 12 months", value: money(summary.months.reduce((s, m) => s + m.spending, 0)), tone: "loss" },
    { label: "Savings rate", value: rate === null ? "—" : `${rate.toFixed(0)}%`, tone: rate === null || rate === 0 ? undefined : rate > 0 ? "gain" : "loss" },
    ...(wallet ? [{ label: "Opened", value: `${formatCurrency(wallet.openingBalance, wallet.currency, 0)}`, sub: `on ${wallet.openingDate}` }] : []),
  ] : [];
  const note = wallet
    ? [KIND_LABELS[wallet.kind], wallet.institution, wallet.currency].filter(Boolean).join(" · ")
    : sample ? "Sample data" : `${active.length} ${active.length === 1 ? "wallet" : "wallets"}`;

  const dialogs = (
    <>
      {dialog === "new" && (
        <WalletFormDialog
          takenColors={wallets.map((w) => w.color ?? "")}
          onClose={close}
          onSaved={(created) => { close(); changed(); onOpen(created.uuid, "insights"); }}
        />
      )}
      {dialog === "edit" && wallet && <WalletFormDialog wallet={wallet} onClose={close} onSaved={done} />}
      {/* A transfer is a tab of it, from this wallet to another. */}
      {/* From All wallets (its Transactions), the wallet is asked. */}
      {dialog === "movement" && (wallet ?? active[0]) && (
        <AddMovementDialog wallet={wallet ?? active[0]} wallets={active} pick={!wallet} onClose={close} onSaved={done} />
      )}
      {dialog === "import" && (wallet ?? active[0]) && (
        <WalletImportDialog wallet={wallet ?? active[0]} wallets={wallet ? undefined : active} onClose={close} onImported={changed} />
      )}
      {dialog === "archive" && wallet && (
        <ConfirmDialog
          title={wallet.archived ? `Unarchive "${wallet.name}"?` : `Archive "${wallet.name}"?`}
          description={wallet.archived
            ? "It takes movements again, and counts in the figures across your wallets."
            : "It keeps its movements, but takes no new ones and is left out of the figures across your wallets. You can unarchive it any time."}
          confirmLabel={wallet.archived ? "Unarchive" : "Archive"}
          confirming={busy}
          error={dialogError}
          onConfirm={() => run(() => walletService.setArchived(wallet.uuid, !wallet.archived), "Unable to change this wallet.")}
          onClose={close}
        />
      )}
      {dialog === "delete" && wallet && (
        <ConfirmDialog
          title={`Delete "${wallet.name}"?`}
          description="Its movements are deleted with it, and a transfer with another wallet loses that wallet's side too. To keep its history, archive it instead. This can't be undone."
          confirming={busy}
          error={dialogError}
          onConfirm={() => run(() => walletService.remove(wallet.uuid), "Unable to delete this wallet.", () => onOpen(ALL_WALLETS, "insights"))}
          onClose={close}
        />
      )}
    </>
  );

  if (page !== "insights") {
    const scopeKey = wallet?.uuid ?? ALL_WALLETS;
    const right = page === "manage" ? (
      <div className="flex gap-2">
        <SmallButton icon={<Landmark className="h-3.5 w-3.5" />} onClick={() => onOpen(ALL_WALLETS, "banks")}>Connect a bank</SmallButton>
        <SmallButton icon={<Plus className="h-3.5 w-3.5" />} dark onClick={() => setDialog("new")} {...sampleLock}>New wallet</SmallButton>
      </div>
    ) : undefined;
    return (
      <div className="space-y-6 pb-12">
        <Breadcrumb trail={[...trail, nodeCrumb]} current={WALLET_PAGE_LABELS[page]} right={right} />
        {wallet?.archived && <ArchivedNote />}
        {page === "transactions" && (
          <WalletTransactions
            key={scopeKey}
            initial={scopeKey}
            readOnly={sample}
            lock={sample ? DEMO_DISABLED_TITLE : wallet?.archived ? ARCHIVED_TITLE : active.length === 0 ? "Add a wallet first" : undefined}
            onAdd={() => setDialog("movement")}
            onImport={() => setDialog("import")}
          />
        )}
        {page === "budgets" && <WalletBudgets scope={scope} onManage={() => onOpen(ALL_WALLETS, "budgets")} />}
        {page === "reports" && <WalletReports key={scopeKey} walletUuid={wallet?.uuid} readOnly={sample} />}
        {page === "alerts" && <WalletAlerts scope={scope} />}
        {page === "banks" && <WalletBanks />}
        {page === "manage" && <ManageWallets onOpenWallet={(uuid) => onOpen(uuid, "insights")} onOpenBanks={() => onOpen(ALL_WALLETS, "banks")} />}
        {dialogs}
      </div>
    );
  }

  const header = (
    <PageHeader
      eyebrow={wallet ? (wallet.archived ? "Wallet · Archived" : "Wallet") : "Wallets"}
      // Wallets › the wallet, in place of the eyebrow; an archived one says so beside it.
      crumbs={trail}
      badge={(
        <>
          {wallet?.archived && <span className="rounded-full bg-[#EEE9DD] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#78716c]">Archived</span>}
          {sample && <PreviewBadge label="Sample" />}
        </>
      )}
      title={title}
      value={value}
      note={note}
      counters={counters}
      actions={actions}
      figures={figures}
    />
  );

  return (
    <div className="space-y-6 pb-12">
      {/* The modules' detail views (see WalletInsights) take the page over, its header hidden. */}
      <ExploreHost trail={[...trail, nodeCrumb]} top={header}>
        {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
        {wallet?.archived && <ArchivedNote />}
        {all && (active.length === 0
          ? <NoWallets readOnly={readOnly} onAdd={() => setDialog("new")} />
          : <WalletsComposition currency={summary?.currency ?? active[0].currency} onOpen={(uuid) => onOpen(uuid, "insights")} />)}
        {all && <ArchivedList archived={archivedWallets} onOpen={(uuid) => onOpen(uuid, "insights")} />}
        {(wallet || active.length > 0) && <WalletInsights scope={scope} summary={summary} />}
      </ExploreHost>
      {dialogs}
    </div>
  );
}

/** How many movements there are (one wallet's, or every wallet's): undefined → null while loading. */
function useMovementCount(walletUuid: string | null, version: number) {
  const { source } = useWallets();
  const key = `${walletUuid ?? "all"}:${version}`;
  const [state, setState] = useState<{ key: string; total: number | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    source.movements(walletUuid, { limit: 1 })
      .then((list) => { if (!cancelled) setState({ key, total: list.total }); })
      .catch(() => { if (!cancelled) setState({ key, total: null }); });
    return () => { cancelled = true; };
  }, [source, walletUuid, key]);
  return state?.key === key ? state.total : null;
}

/**
 * What the header's Budgets and Alerts counters show: how many budgets (across the wallets) and how
 * many over this month, how many rules (the wallet's and those on every wallet) and what they find
 * today. null while loading; a read that fails counts nothing rather than failing the page.
 */
function useAttention(walletUuid: string | null, version: number) {
  const { source } = useWallets();
  const key = `${walletUuid ?? "all"}:${version}`;
  const [state, setState] = useState<{ key: string; budgets: number; over: number; rules: number; found: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([source.budgetMonth().catch(() => null), source.alertRules(walletUuid).catch(() => null)]).then(([month, rules]) => {
      if (cancelled) return;
      const budgets = month?.budgets ?? [];
      // A wallet's page counts only the budgets it spent in.
      const counted = walletUuid ? budgets.filter((b) => b.wallets.some((w) => w.walletUuid === walletUuid)) : budgets;
      setState({
        key,
        budgets: month ? budgets.length : 0,
        over: counted.filter((b) => b.status === "over").length,
        rules: rules?.length ?? 0,
        found: rules ? currentAlertFindings(rules).filter((f) => !walletUuid || f.walletUuid === walletUuid || f.walletUuid === null).length : 0,
      });
    });
    return () => { cancelled = true; };
  }, [source, walletUuid, key]);
  return state?.key === key ? state : null;
}

function ArchivedNote() {
  return (
    <p className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-semibold text-slate-600">
      <Archive className="h-4 w-4 shrink-0" />
      Archived: read only, and left out of the figures across your wallets. Unarchive it to add movements again.
    </p>
  );
}

function SmallButton({ icon, children, onClick, dark, disabled, title }: {
  icon: React.ReactNode; children: React.ReactNode; onClick: () => void; dark?: boolean; disabled?: boolean; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        dark ? "bg-[#1c1917] text-white hover:bg-[#C49A3C]" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

/** All wallets with none yet (archived aside): the way to add the first. */
function NoWallets({ readOnly, onAdd }: { readOnly: boolean; onAdd: () => void }) {
  return (
    <section className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 md:p-10 text-center space-y-3">
      <p className="text-lg font-black text-slate-900">No wallets yet</p>
      <p className="text-[13px] text-slate-500 max-w-md mx-auto">
        Add your current account, a card, savings or cash: what comes in and goes out, by hand or from your bank&apos;s statements,
        next to your investments.
      </p>
      {!readOnly && (
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors">
          <Plus className="h-4 w-4" /> Add a wallet
        </button>
      )}
    </section>
  );
}

// ── The hub (retired) ────────────────────────────────────────────────────────────────────────
// The card-holder hub that All wallets used to open with, kept for reference: All wallets now
// opens like All portfolios, on a Composition of its wallets (WalletsComposition).
//
//
// const signed = (v: number, currency: string) => `${v >= 0 ? "+" : "−"}${formatCurrency(Math.abs(v), currency, 0)}`;
//
// /**
//  * WALLETS HUB — on every wallet's page, above their Insights: the wallet with the largest balance
//  * on a big card (FeaturedCard), the others in a card holder (PortfolioHolder) with at its front the
//  * card that adds one, and all of them together in a holder of their own, in the virtual blue, like
//  * "All portfolios". Each card opens its wallet. The archived ones are listed under it; with no
//  * wallet yet, the way to add the first.
//  */
// function WalletsHub({ readOnly, total, onOpen, onAdd }: {
//   readOnly: boolean;
//   total: WalletSummary | null | undefined;
//   onOpen: (uuid: string) => void;
//   onAdd: () => void;
// }) {
//   const { wallets, sample } = useWallets();
//   const colored = useMemo(() => wallets.map((w, i) => ({ wallet: w, color: walletColor(w, i) })), [wallets]);
//   const active = colored.filter((c) => !c.wallet.archived);
//   const archived = colored.filter((c) => c.wallet.archived);
//   const summaries = useWalletSummaries(useMemo(() => active.map((c) => c.wallet.uuid), [active]));
//
//   if (active.length === 0) {
//     return (
//       <>
//         <section className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 md:p-10 text-center space-y-3">
//           <p className="text-lg font-black text-slate-900">No wallets yet</p>
//           <p className="text-[13px] text-slate-500 max-w-md mx-auto">
//             Add your current account, a card, savings or cash: what comes in and goes out, by hand or from your bank&apos;s statements,
//             next to your investments.
//           </p>
//           {!readOnly && (
//             <button type="button" onClick={onAdd} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors">
//               <Plus className="h-4 w-4" /> Add a wallet
//             </button>
//           )}
//         </section>
//         <ArchivedList archived={archived} onOpen={onOpen} />
//       </>
//     );
//   }
//
//   const figuresOf = (w: Wallet) => {
//     const s = summaries?.[w.uuid];
//     const months = s?.months ?? [];
//     return {
//       points: months.map((m) => ({ value: m.closingBalance })),
//       month: months.at(-1),
//       year: months.reduce((acc, m) => ({ income: acc.income + m.income, spending: acc.spending + m.spending }), { income: 0, spending: 0 }),
//     };
//   };
//   const featured = active.reduce((best, c) => (c.wallet.balance > best.wallet.balance ? c : best));
//   const featuredFigures = figuresOf(featured.wallet);
//
//   const items: HolderItem[] = [
//     ...active.filter((c) => c !== featured).map(({ wallet, color }) => {
//       const f = figuresOf(wallet);
//       return {
//         key: wallet.uuid,
//         name: wallet.name,
//         color,
//         value: formatCurrency(wallet.balance, wallet.currency, 0),
//         headline: f.month ? signed(f.month.net, wallet.currency) : null,
//         caption: "this month",
//         points: f.points,
//         empty: summaries === undefined ? "" : "No movements this year.",
//         onOpen: () => onOpen(wallet.uuid),
//       };
//     }),
//     ...(readOnly ? [] : [{
//       key: "add-wallet",
//       name: "Add a wallet",
//       color: "",
//       add: true,
//       value: null,
//       headline: null,
//       points: [],
//       empty: "An account, a card, savings or cash, by hand or from your bank's statements.",
//       cta: "Add",
//       onOpen: onAdd,
//     }]),
//   ];
//   const last = total?.months.at(-1);
//   const combined: HolderItem[] = [{
//     key: ALL_WALLETS,
//     name: "All wallets",
//     color: VIRTUAL_COLOR,
//     badge: <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-white/15 text-[9px] font-black uppercase tracking-wider">Combined</span>,
//     value: total === undefined ? undefined : total && last ? formatCurrency(last.closingBalance, total.currency, 0) : null,
//     headline: total && last ? signed(last.net, total.currency) : null,
//     caption: "this month",
//     points: (total?.months ?? []).map((m) => ({ value: m.closingBalance })),
//     empty: total === null ? "Can't be added up right now: an exchange rate is missing." : "",
//     onOpen: () => window.scrollTo({ top: 0, behavior: "smooth" }),
//   }];
//
//   return (
//     <>
//       {/* The same row as Investments': the largest as tall as the row, the holders' sleeves on one line. */}
//       <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 items-end">
//         <FeaturedCard
//           eyebrow="Largest wallet"
//           name={featured.wallet.name}
//           badge={sample ? <PreviewBadge label="Sample" /> : undefined}
//           color={featured.color}
//           value={formatCurrency(featured.wallet.balance, featured.wallet.currency, 0)}
//           line={
//             <>
//               {featuredFigures.month && (
//                 <span className={featuredFigures.month.net >= 0 ? "text-emerald-600" : "text-rose-600"}>{signed(featuredFigures.month.net, featured.wallet.currency)}</span>
//               )}
//               <span className="text-slate-400 font-semibold">{featuredFigures.month ? " this month · " : ""}{KIND_LABELS[featured.wallet.kind]}</span>
//             </>
//           }
//           figures={[
//             { label: "In, 12 months", value: formatCurrency(featuredFigures.year.income, featured.wallet.currency, 0), tone: "gain" },
//             { label: "Out, 12 months", value: formatCurrency(featuredFigures.year.spending, featured.wallet.currency, 0), tone: "loss" },
//           ]}
//           points={featuredFigures.points}
//           empty={summaries === undefined ? "" : "No movements this year."}
//           onOpen={() => onOpen(featured.wallet.uuid)}
//         />
//         {items.length > 0 ? <PortfolioHolder items={items} label={`${items.length - (readOnly ? 0 : 1)} more`} /> : <span className="hidden xl:block" />}
//         <PortfolioHolder items={combined} label="Combined" tone="virtual" />
//       </div>
//       <ArchivedList archived={archived} onOpen={onOpen} />
//     </>
//   );
// }

function ArchivedList({ archived, onOpen }: { archived: { wallet: Wallet; color: string }[]; onOpen: (uuid: string) => void }) {
  if (archived.length === 0) return null;
  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm">
      <p className="px-6 pt-4 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Archived</p>
      <ul className="divide-y divide-slate-100">
        {archived.map(({ wallet, color }) => (
          <li key={wallet.uuid}>
            <button type="button" onClick={() => onOpen(wallet.uuid)} className="w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-slate-50 transition-colors">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="flex-1 min-w-0 text-[13px] font-bold text-slate-700 truncate">{wallet.name}</span>
              <span className="text-[13px] font-bold tabular-nums text-slate-500">{formatCurrency(wallet.balance, wallet.currency, 0)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
