// components/dashboard/wallets/ManageWallets.tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Landmark, Pencil, RefreshCw, Unlink } from "lucide-react";
import { useWallets } from "../../../context/WalletsContext";
import { bankingService } from "../../../services/bankingService";
import { formatCurrency } from "../../../lib/format";
import { KIND_LABELS, dayLabel, errorText, walletColor } from "../../../lib/wallets";
import type { BankAccount, BankLink } from "../../../models/Banking";
import type { Wallet } from "../../../models/Wallet";
import { DEMO_DISABLED_TITLE } from "../../preview/DemoBanner";
import { IconButton, accountLabel, syncText } from "./WalletBanks";
import { WalletFormDialog } from "./WalletDialogs";

const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;

type Linked = { link: BankLink; account: BankAccount };

/**
 * MANAGE WALLETS — All wallets / Manage wallets, like Manage portfolios: every wallet in one list,
 * to open or edit (a new one is made from the breadcrumb, see WalletNode), the archived ones after,
 * read only. Each wallet's row is also its bank account through open banking: a wallet takes one
 * account of its currency, from a bank connected on the Banks page, linked here and read at once;
 * a linked one can be read now or unlinked (the movements it brought stay). A demo account sees
 * the list but can't change anything.
 */
export function ManageWallets({ onOpenWallet, onOpenBanks }: {
  onOpenWallet: (uuid: string) => void;
  // All wallets' Banks, where a bank is connected.
  onOpenBanks: () => void;
}) {
  const { wallets, sample, version, changed } = useWallets();
  const [links, setLinks] = useState<{ list: BankLink[] | null; error: string | null } | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Wallet | null>(null);

  useEffect(() => {
    let cancelled = false;
    bankingService.links()
      .then((list) => { if (!cancelled) setLinks({ list, error: null }); })
      .catch((err) => { if (!cancelled) setLinks({ list: null, error: errorText(err, "Unable to load your banks.") }); });
    return () => { cancelled = true; };
  }, [version, reload]);

  const list = links?.list ?? [];
  const linkedOf = (w: Wallet): Linked | null => {
    for (const link of list) {
      const account = link.accounts.find((a) => a.walletUuid === w.uuid);
      if (account) return { link, account };
    }
    return null;
  };
  // The accounts a wallet can take: not linked yet, at a bank whose consent holds.
  const free: Linked[] = list.filter((l) => l.status === "active").flatMap((link) => link.accounts.filter((a) => !a.walletUuid).map((account) => ({ link, account })));

  // One wallet's change; `action` answers the note to show under it, if any.
  const act = async (walletUuid: string, action: () => Promise<string | void>, fallback: string) => {
    setBusy(walletUuid);
    setNotes((n) => ({ ...n, [walletUuid]: "" }));
    setErrors((e) => ({ ...e, [walletUuid]: "" }));
    try {
      const note = await action();
      if (note) setNotes((n) => ({ ...n, [walletUuid]: note }));
      changed();
    } catch (err) {
      setErrors((e) => ({ ...e, [walletUuid]: errorText(err, fallback) }));
      setReload((n) => n + 1);
    } finally {
      setBusy(null);
    }
  };
  const readNow = async ({ link, account }: Linked) =>
    syncText((await bankingService.sync(link.uuid)).accounts.filter((a) => a.accountUuid === account.uuid));
  // A linked account is read at once, not at the next of the twice-a-day reads.
  const link = (w: Wallet, chosen: Linked) => act(w.uuid, async () => {
    await bankingService.linkAccount(chosen.account.uuid, w.uuid);
    return readNow(chosen);
  }, "Unable to link this account.");

  const colored = wallets.map((w, i) => ({ wallet: w, color: walletColor(w, i) }));
  const row = ({ wallet, color }: { wallet: Wallet; color: string }) => {
    const linked = linkedOf(wallet);
    return (
      <WalletRow
        key={wallet.uuid}
        wallet={wallet}
        color={color}
        banks={links === null ? undefined : list.length}
        linked={linked}
        choices={free.filter((c) => c.account.currency === wallet.currency)}
        readOnly={sample}
        busy={busy === wallet.uuid}
        note={notes[wallet.uuid]}
        error={errors[wallet.uuid]}
        onOpen={() => onOpenWallet(wallet.uuid)}
        onEdit={() => setEditing(wallet)}
        onOpenBanks={onOpenBanks}
        onLink={(chosen) => void link(wallet, chosen)}
        onRead={() => linked && void act(wallet.uuid, () => readNow(linked), "Unable to read this bank now.")}
        onUnlink={() => linked && void act(wallet.uuid, async () => { await bankingService.unlinkAccount(linked.account.uuid); }, "Unable to unlink this account.")}
      />
    );
  };
  const active = colored.filter((c) => !c.wallet.archived);
  const archived = colored.filter((c) => c.wallet.archived);

  return (
    <>
      {links?.error && <p className="text-sm font-semibold text-rose-600">{links.error}</p>}
      <ManageGroup
        title="Wallets"
        note={`${active.length} ${active.length === 1 ? "wallet" : "wallets"} · each takes one bank account of its currency, read twice a day`}
      >
        {active.length === 0 ? <li className="px-6 md:px-7 py-4 text-[13px] text-slate-500">No wallets yet.</li> : active.map(row)}
      </ManageGroup>
      {archived.length > 0 && (
        <ManageGroup title="Archived" note="Read only: no bank account comes into them">
          {archived.map(row)}
        </ManageGroup>
      )}
      {editing && <WalletFormDialog wallet={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); changed(); }} />}
    </>
  );
}

function ManageGroup({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl shadow-sm overflow-hidden border border-slate-200">
      <div className="px-6 md:px-7 pt-5 pb-4 border-b border-slate-100">
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        {note && <p className="text-xs text-slate-500 mt-0.5">{note}</p>}
      </div>
      <ul className="divide-y divide-slate-100 pb-1">{children}</ul>
    </section>
  );
}

/**
 * One wallet in the list: its colour, name, kind and balance, then Open and Edit; under it, its
 * bank account: the one linked (Read now, Unlink), or a choice among the free ones of its currency
 * (Link), or why there's none.
 */
function WalletRow({
  wallet, color, banks, linked, choices, readOnly, busy, note, error, onOpen, onEdit, onOpenBanks, onLink, onRead, onUnlink,
}: {
  wallet: Wallet;
  color: string;
  // How many banks are connected; undefined while they load.
  banks: number | undefined;
  linked: Linked | null;
  choices: Linked[];
  readOnly: boolean;
  busy: boolean;
  note?: string;
  error?: string;
  onOpen: () => void;
  onEdit: () => void;
  onOpenBanks: () => void;
  onLink: (chosen: Linked) => void;
  onRead: () => void;
  onUnlink: () => void;
}) {
  const [choice, setChoice] = useState("");
  const chosen = choices.find((c) => c.account.uuid === choice);
  const lock = readOnly ? { disabled: true, title: DEMO_DISABLED_TITLE } : {};
  const iconButton = "w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  let bank: React.ReactNode;
  if (linked) {
    const active = linked.link.status === "active";
    const meta = [
      active ? (linked.link.lastSyncedAt ? `read ${dayLabel(linked.link.lastSyncedAt.slice(0, 10))}` : "not read yet") : "Consent ended: renew it on the Banks page",
      linked.account.syncFrom && `from ${dayLabel(linked.account.syncFrom)}`,
    ].filter(Boolean).join(" · ");
    const readLock = readOnly ? DEMO_DISABLED_TITLE : wallet.archived ? "An archived wallet isn't read" : !active ? "The consent ended: renew it on the Banks page" : null;
    bank = (
      <>
        <Landmark className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[#C49A3C]" : "text-rose-600"}`} />
        <span className="min-w-0 flex-1">
          <span className="font-semibold text-slate-700">{linked.link.bankName} · {accountLabel(linked.account)}</span>
          <span className="text-slate-400"> · {meta}</span>
        </span>
        <IconButton label="Read now" onClick={onRead} spinning={busy} disabled={!!readLock} title={readLock ?? undefined}>
          <RefreshCw className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Unlink from the bank account" onClick={onUnlink} {...lock}><Unlink className="h-3.5 w-3.5" /></IconButton>
      </>
    );
  } else if (banks === undefined) {
    bank = <span className="text-slate-400">…</span>;
  } else if (wallet.archived) {
    bank = <span className="text-slate-400">Not linked to a bank account</span>;
  } else if (choices.length === 0) {
    bank = (
      <span className="text-slate-400">
        {banks === 0 ? "No bank connected yet. " : `No ${wallet.currency} account free at your banks. `}
        <button type="button" onClick={onOpenBanks} className="font-semibold text-[#C49A3C] hover:underline">Connect a bank</button>
      </span>
    );
  } else {
    bank = (
      <>
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          disabled={readOnly || busy}
          aria-label="Bank account"
          className="h-8 min-w-0 px-2 rounded-lg bg-white text-[12px] font-semibold text-slate-700 border border-slate-200 outline-none focus:border-[#C49A3C]/60 disabled:opacity-60"
        >
          <option value="">Link a bank account…</option>
          {choices.map((c) => <option key={c.account.uuid} value={c.account.uuid}>{c.link.bankName} · {accountLabel(c.account)}</option>)}
        </select>
        <button
          type="button"
          onClick={() => chosen && onLink(chosen)}
          disabled={!chosen || busy || readOnly}
          title={readOnly ? DEMO_DISABLED_TITLE : undefined}
          className="px-3 py-1.5 rounded-lg text-[11.5px] font-bold bg-[#1c1917] text-white hover:bg-[#C49A3C] transition-colors disabled:opacity-40"
        >
          {busy ? "Linking…" : "Link"}
        </button>
      </>
    );
  }

  return (
    <li className="px-6 md:px-7 py-3.5 space-y-1.5">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 rounded-full shrink-0" style={{ background: color }} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-black text-slate-900 truncate" style={serif}>{wallet.name}</span>
          <span className="block text-[11.5px] text-slate-500">{[KIND_LABELS[wallet.kind], wallet.institution, wallet.currency].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="text-[13px] font-black tabular-nums text-slate-900">{formatCurrency(wallet.balance, wallet.currency, 0)}</span>
        <span className="flex items-center gap-1">
          <button type="button" onClick={onOpen} aria-label={`Open ${wallet.name}`} title="Open" className={`${iconButton} text-slate-400 hover:text-slate-900 hover:bg-slate-100`}>
            <ArrowUpRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={readOnly || wallet.archived}
            aria-label={`Edit ${wallet.name}`}
            title={readOnly ? DEMO_DISABLED_TITLE : wallet.archived ? "An archived wallet is read only" : "Edit"}
            className={`${iconButton} text-slate-400 hover:text-slate-900 hover:bg-slate-100`}
          >
            <Pencil className="h-4 w-4" />
          </button>
        </span>
      </div>
      <div className="pl-6 flex flex-wrap items-center gap-2 text-[12px]">{bank}</div>
      {note && <p className="pl-6 text-[11.5px] font-semibold text-emerald-700">{note}</p>}
      {error && <p className="pl-6 text-[11.5px] font-semibold text-rose-600">{error}</p>}
    </li>
  );
}
