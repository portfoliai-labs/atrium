// components/dashboard/wallets/WalletBanks.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Landmark, Link2, Plus, RefreshCw, Search, Trash2, Unlink } from "lucide-react";
import { useWallets } from "../../../context/WalletsContext";
import { bankingService } from "../../../services/bankingService";
import { formatCurrency } from "../../../lib/format";
import { dayLabel, errorText } from "../../../lib/wallets";
import type { AccountSync, Bank, BankAccount, BankLink } from "../../../models/Banking";
import type { Wallet } from "../../../models/Wallet";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { ConfirmDialog } from "../ConfirmDialog";
import { DialogShell, Field, INPUT } from "./WalletDialogs";
import { DEMO_DISABLED_TITLE } from "../../preview/DemoBanner";

// The countries a bank can be picked in, Italy first (the aggregator reaches the EEA's).
const COUNTRIES: { code: string; name: string }[] = [
  { code: "IT", name: "Italy" }, { code: "AT", name: "Austria" }, { code: "BE", name: "Belgium" }, { code: "FI", name: "Finland" },
  { code: "FR", name: "France" }, { code: "DE", name: "Germany" }, { code: "IE", name: "Ireland" }, { code: "LU", name: "Luxembourg" },
  { code: "NL", name: "Netherlands" }, { code: "PT", name: "Portugal" }, { code: "ES", name: "Spain" },
];
// A consent ending within these many days can be renewed before it does.
const RENEW_WITHIN_DAYS = 14;

// The wallet a bank is being connected for, kept across the trip to the bank's page (this tab's
// session): back on /dashboard/bank-link, its account goes into that wallet.
const PENDING_KEY = "atrium.bankLink.wallet";

export interface PendingBankWallet {
  walletUuid: string;
  currency: string;
  // The link started, as POST /v1/banking/links answered it.
  linkUuid: string;
}

function rememberBankWallet(pending: PendingBankWallet) {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch { /* the account is then chosen on the Banks page */ }
}

/** The wallet a bank was being connected for, once: it's forgotten as it's read. */
export function takeBankWallet(): PendingBankWallet | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingBankWallet) : null;
  } catch {
    return null;
  }
}

/** Reads a link now, worded for one of its accounts. */
export const syncTextFor = async (linkUuid: string, accountUuid: string) =>
  syncText((await bankingService.sync(linkUuid)).accounts.filter((a) => a.accountUuid === accountUuid));

/**
 * Whether a wallet takes its movements from a bank account: undefined while the links load (and for
 * none), then true or false. A read that fails says false: the way to link one stays offered.
 */
export function useWalletLinked(walletUuid: string | undefined) {
  const { version } = useWallets();
  const [state, setState] = useState<{ key: string; linked: boolean } | null>(null);
  const key = `${walletUuid ?? ""}:${version}`;
  useEffect(() => {
    if (!walletUuid) return;
    let cancelled = false;
    bankingService.links()
      .then((links) => { if (!cancelled) setState({ key, linked: links.some((l) => l.accounts.some((a) => a.walletUuid === walletUuid)) }); })
      .catch(() => { if (!cancelled) setState({ key, linked: false }); });
    return () => { cancelled = true; };
  }, [walletUuid, key]);
  return state?.key === key ? state.linked : undefined;
}

/** A wallet's page, from outside the dashboard; `connect` opens its bank dialog (WalletBankDialog). */
export const walletPageUrl = (walletUuid: string, connect = false) =>
  `/dashboard?section=wallets&wallet=${encodeURIComponent(walletUuid)}${connect ? "&connectBank=1" : ""}`;

const daysLeft = (link: BankLink) =>
  link.validUntil ? Math.ceil((new Date(link.validUntil).getTime() - Date.now()) / 86_400_000) : 0;

export const accountLabel = (a: BankAccount) => [a.name ?? "Account", a.ibanLast4 ? `•••• ${a.ibanLast4}` : null].filter(Boolean).join(" ");

// What a read brought: what's new, what was there already, and what was left out (booked before
// the day the account is read from, or in another currency).
export const syncText = (accounts: AccountSync[]) => {
  const imported = accounts.reduce((s, a) => s + a.imported, 0);
  const duplicates = accounts.reduce((s, a) => s + a.duplicates, 0);
  const skipped = accounts.reduce((s, a) => s + a.skipped, 0);
  return [
    imported === 0 ? "Nothing new" : `${imported} new ${imported === 1 ? "movement" : "movements"}`,
    duplicates ? `${duplicates} already there` : null,
    skipped ? `${skipped} left out (before the day it's read from, or in another currency)` : null,
  ].filter(Boolean).join(", ") + ".";
};

/**
 * WALLET BANKS — the banks linked through open banking, read only: a link is the consent given at
 * the bank (for up to 180 days, then given again), each of its accounts coming into one wallet of
 * its currency. Linked accounts are read twice a day, and on request; their movements come in
 * uncategorised, the older months by a statement's import. Nothing here can move money. A demo
 * account's link is to a sample bank, read only.
 */
export function WalletBanks() {
  const { wallets, sample, version, changed } = useWallets();
  const [state, setState] = useState<{ links: BankLink[] | null; error: string | null } | null>(null);
  const [reload, setReload] = useState(0);
  const [connecting, setConnecting] = useState<{ renew?: BankLink } | null>(null);
  const [removing, setRemoving] = useState<BankLink | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    bankingService.links()
      .then((links) => { if (!cancelled) setState({ links, error: null }); })
      .catch((err) => { if (!cancelled) setState({ links: null, error: errorText(err, "Unable to load your banks.") }); });
    return () => { cancelled = true; };
  }, [version, reload]);

  const links = state?.links;
  // A wallet takes one account: those linked already aren't offered again.
  const taken = useMemo(() => new Set((links ?? []).flatMap((l) => l.accounts.map((a) => a.walletUuid)).filter(Boolean)), [links]);

  const act = async (key: string, action: () => Promise<unknown>, fallback: string) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      setReload((n) => n + 1);
      changed();
    } catch (err) {
      setError(errorText(err, fallback));
      setReload((n) => n + 1);
    } finally {
      setBusy(null);
    }
  };
  const readNow = async (link: BankLink) => {
    const result = await bankingService.sync(link.uuid);
    setNotes((n) => ({ ...n, [link.uuid]: syncText(result.accounts) }));
  };
  const sync = (link: BankLink) => act(link.uuid, () => readNow(link), "Unable to read this bank now.");
  // A linked account is read at once, not at the next of the twice-a-day reads.
  const linkAccount = (link: BankLink, account: BankAccount, walletUuid: string) => act(account.uuid, async () => {
    await bankingService.linkAccount(account.uuid, walletUuid);
    await readNow(link);
  }, "Unable to link this account.");
  const remove = async () => {
    if (!removing) return;
    await act(removing.uuid, () => bankingService.remove(removing.uuid), "Unable to remove this bank.");
    setRemoving(null);
  };

  if (links === undefined) return <p className="text-[13px] text-[#857e78]">Loading…</p>;
  if (links === null) return <p className="text-[13px] font-semibold text-rose-600">{state?.error}</p>;

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setConnecting({})}
          disabled={sample}
          title={sample ? DEMO_DISABLED_TITLE : undefined}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#1c1917] text-white hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:hover:bg-[#1c1917] disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" /> Connect a bank
        </button>
      </div>

      <Module>
        <ModuleHead
          title="Banks"
          desc="Read only, through open banking: your accounts' movements come into their wallets twice a day. Nothing here can move money."
        />
        <div className={MODULE_BODY}>
          {links.length === 0 ? (
            <p className="text-[12.5px] text-[#857e78]">
              No bank connected yet. Connect one to have your current account&apos;s movements come in on their own: you give the
              consent at your bank, for up to 180 days, and can end it here at any time. Older months come by importing a statement.
            </p>
          ) : (
            <ul className="divide-y divide-[#EEE9DD]">
              {links.map((link) => (
                <BankLinkRow
                  key={link.uuid}
                  link={link}
                  wallets={wallets}
                  taken={taken}
                  readOnly={sample}
                  busy={busy}
                  note={notes[link.uuid]}
                  onSync={() => void sync(link)}
                  onRenew={() => setConnecting({ renew: link })}
                  onRemove={() => { setError(null); setRemoving(link); }}
                  onLink={(account, walletUuid) => void linkAccount(link, account, walletUuid)}
                  onUnlink={(account) => void act(account.uuid, () => bankingService.unlinkAccount(account.uuid), "Unable to unlink this account.")}
                />
              ))}
            </ul>
          )}
          {error && !removing && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}
        </div>
      </Module>

      {connecting && <ConnectBankDialog renew={connecting.renew} onClose={() => setConnecting(null)} />}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.bankName}?`}
          description="The consent at the bank ends, and its accounts stop coming into their wallets. The movements already there stay."
          confirmLabel="Remove"
          confirming={busy === removing.uuid}
          error={error}
          onConfirm={() => void remove()}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}

function BankLinkRow({ link, wallets, taken, readOnly, busy, note, onSync, onRenew, onRemove, onLink, onUnlink }: {
  link: BankLink;
  wallets: Wallet[];
  taken: Set<string | null>;
  readOnly: boolean;
  busy: string | null;
  note?: string;
  onSync: () => void;
  onRenew: () => void;
  onRemove: () => void;
  onLink: (account: BankAccount, walletUuid: string) => void;
  onUnlink: (account: BankAccount) => void;
}) {
  const active = link.status === "active";
  const left = daysLeft(link);
  const meta = [
    active && link.validUntil ? `Consent until ${dayLabel(link.validUntil.slice(0, 10))}` : "Consent ended: connect it again",
    link.lastSyncedAt ? `read ${dayLabel(link.lastSyncedAt.slice(0, 10))}` : "not read yet",
  ].join(" · ");
  const lock = readOnly ? { disabled: true, title: DEMO_DISABLED_TITLE } : {};
  return (
    <li className="py-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${active ? "bg-[#C49A3C]/10 text-[#C49A3C]" : "bg-rose-50 text-rose-600"}`}>
          <Landmark className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold text-slate-800">
            {link.bankName}
            {!active && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-rose-50 text-[9px] font-black uppercase tracking-wider text-rose-600 align-middle">Expired</span>}
            {active && left <= RENEW_WITHIN_DAYS && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-50 text-[9px] font-black uppercase tracking-wider text-amber-700 align-middle">
                {left <= 1 ? "Ends today" : `${left} days left`}
              </span>
            )}
          </span>
          <span className="block text-[11.5px] text-slate-500">{meta}</span>
        </span>
        <span className="flex gap-1">
          {active && (
            <IconButton label="Read now" onClick={onSync} spinning={busy === link.uuid} {...lock}><RefreshCw className="h-3.5 w-3.5" /></IconButton>
          )}
          {(!active || left <= RENEW_WITHIN_DAYS) && (
            <IconButton label="Renew the consent" onClick={onRenew} {...lock}><Link2 className="h-3.5 w-3.5" /></IconButton>
          )}
          <IconButton label="Remove" danger onClick={onRemove} {...lock}><Trash2 className="h-3.5 w-3.5" /></IconButton>
        </span>
      </div>
      {note && <p className="pl-12 text-[11.5px] font-semibold text-emerald-700">{note}</p>}
      <ul className="pl-12 space-y-2">
        {link.accounts.map((account) => (
          <BankAccountRow
            key={account.uuid}
            account={account}
            wallets={wallets}
            taken={taken}
            readOnly={readOnly}
            busy={busy === account.uuid}
            onLink={(walletUuid) => onLink(account, walletUuid)}
            onUnlink={() => onUnlink(account)}
          />
        ))}
      </ul>
    </li>
  );
}

function BankAccountRow({ account, wallets, taken, readOnly, busy, onLink, onUnlink }: {
  account: BankAccount;
  wallets: Wallet[];
  taken: Set<string | null>;
  readOnly: boolean;
  busy: boolean;
  onLink: (walletUuid: string) => void;
  onUnlink: () => void;
}) {
  const linked = account.walletUuid ? wallets.find((w) => w.uuid === account.walletUuid) : undefined;
  const choices = wallets.filter((w) => !w.archived && w.currency === account.currency && !taken.has(w.uuid));
  const [choice, setChoice] = useState("");
  const balance = account.reportedBalance === null ? null : formatCurrency(account.reportedBalance, account.currency, 2);
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-[#EEE9DD] px-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-bold text-slate-700">{accountLabel(account)}</span>
        <span className="block text-[11px] text-slate-500">
          {[account.currency, balance && `bank balance ${balance}`, account.syncFrom && linked && `from ${dayLabel(account.syncFrom)}`].filter(Boolean).join(" · ")}
        </span>
      </span>
      {account.walletUuid ? (
        <span className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-slate-600">→ {linked?.name ?? "A wallet"}</span>
          {!readOnly && (
            <IconButton label="Unlink from the wallet" onClick={onUnlink} spinning={busy}><Unlink className="h-3.5 w-3.5" /></IconButton>
          )}
        </span>
      ) : readOnly ? (
        <span className="text-[11.5px] text-slate-400">Not linked to a wallet</span>
      ) : choices.length === 0 ? (
        <span className="text-[11.5px] text-slate-400">No {account.currency} wallet free: add one to link it</span>
      ) : (
        <span className="flex items-center gap-2">
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            aria-label="Wallet"
            className="h-9 px-2.5 rounded-lg bg-white text-[12px] font-semibold text-slate-700 border border-slate-200 outline-none focus:border-[#C49A3C]/60"
          >
            <option value="">Choose a wallet…</option>
            {choices.map((w) => <option key={w.uuid} value={w.uuid}>{w.name}</option>)}
          </select>
          <button
            type="button"
            onClick={() => choice && onLink(choice)}
            disabled={!choice || busy}
            className="px-3 py-2 rounded-lg text-[11.5px] font-bold bg-[#1c1917] text-white hover:bg-[#C49A3C] transition-colors disabled:opacity-40"
          >
            Link
          </button>
        </span>
      )}
    </li>
  );
}

/**
 * WALLET BANK SYNC — in a wallet's settings: the bank account it's linked to, if any, and reading
 * it now. Linking and unlinking stay on the Banks page; a read here is the whole link's, its note
 * this account's.
 */
export function WalletBankSync({ wallet }: { wallet: Wallet }) {
  const { sample, version, changed } = useWallets();
  const [state, setState] = useState<{ found: { link: BankLink; account: BankAccount } | null; error: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    bankingService.links()
      .then((links) => {
        if (cancelled) return;
        const link = links.find((l) => l.accounts.some((a) => a.walletUuid === wallet.uuid));
        const account = link?.accounts.find((a) => a.walletUuid === wallet.uuid);
        setState({ found: link && account ? { link, account } : null, error: null });
      })
      .catch((err) => { if (!cancelled) setState({ found: null, error: errorText(err, "Unable to load your banks.") }); });
    return () => { cancelled = true; };
  }, [wallet.uuid, version]);

  if (state === null) return null;
  const found = state.found;
  if (!found) {
    return state.error ? <p className="text-[11.5px] font-semibold text-rose-600">{state.error}</p> : null;
  }

  const { link, account } = found;
  const active = link.status === "active";
  const lock = sample ? DEMO_DISABLED_TITLE : wallet.archived ? "An archived wallet isn't read" : !active ? "The consent ended: renew it on the Banks page" : null;
  const balance = account.reportedBalance === null ? null : formatCurrency(account.reportedBalance, account.currency, 2);
  const meta = [
    link.lastSyncedAt ? `read ${dayLabel(link.lastSyncedAt.slice(0, 10))}` : "not read yet",
    balance && `bank balance ${balance}`,
    account.syncFrom && `from ${dayLabel(account.syncFrom)}`,
  ].filter(Boolean).join(" · ");

  const readNow = async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const result = await bankingService.sync(link.uuid);
      setNote(syncText(result.accounts.filter((a) => a.accountUuid === account.uuid)));
      changed();
    } catch (err) {
      setError(errorText(err, "Unable to read this bank now."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <span className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Bank</span>
      <div className="flex items-center gap-3 rounded-xl border border-[#EEE9DD] px-3 py-2.5">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-[#C49A3C]/10 text-[#C49A3C]" : "bg-rose-50 text-rose-600"}`}>
          <Landmark className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-bold text-slate-700">{link.bankName} · {accountLabel(account)}</span>
          <span className="block text-[11px] text-slate-500">{meta}</span>
        </span>
        <IconButton label="Read now" onClick={() => void readNow()} spinning={busy} disabled={!!lock} title={lock ?? undefined}>
          <RefreshCw className="h-3.5 w-3.5" />
        </IconButton>
      </div>
      {note && <p className="text-[11.5px] font-semibold text-emerald-700">{note}</p>}
      {error && <p className="text-[11.5px] font-semibold text-rose-600">{error}</p>}
    </div>
  );
}

export function IconButton({ label, onClick, danger, spinning, disabled, title, children }: {
  label: string; onClick: () => void; danger?: boolean; spinning?: boolean; disabled?: boolean; title?: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || spinning}
      aria-label={label}
      title={title ?? label}
      className={`p-1.5 rounded-lg text-slate-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${danger ? "hover:text-rose-600 hover:bg-rose-50" : "hover:text-slate-700 hover:bg-slate-100"} ${spinning ? "animate-spin" : ""}`}
    >
      {children}
    </button>
  );
}

/**
 * CONNECT A BANK — a country, a bank of it, then off to the bank's own page to give the consent;
 * the bank sends the caller back to /dashboard/bank-link. Renewing a link goes straight to its bank.
 * For a wallet (`wallet`, from its page), its account goes into that wallet once back.
 */
function ConnectBankDialog({ renew, wallet, onClose }: { renew?: BankLink; wallet?: Wallet; onClose: () => void }) {
  const [country, setCountry] = useState(renew?.country ?? "IT");
  const [banks, setBanks] = useState<{ country: string; list: Bank[] | null; error: string | null } | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(renew?.bankName ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (renew) return;
    let cancelled = false;
    bankingService.banks(country)
      .then((list) => { if (!cancelled) setBanks({ country, list, error: null }); })
      .catch((err) => { if (!cancelled) setBanks({ country, list: null, error: errorText(err, "Unable to load the banks.") }); });
    return () => { cancelled = true; };
  }, [country, renew]);

  const list = banks?.country === country ? banks.list : undefined;
  const shown = (list ?? []).filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()));

  const submit = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const started = await bankingService.start(picked, renew?.country ?? country, renew?.uuid);
      if (wallet) rememberBankWallet({ walletUuid: wallet.uuid, currency: wallet.currency, linkUuid: started.uuid });
      window.location.assign(started.authorizationUrl);
    } catch (err) {
      setError(errorText(err, "Unable to reach the bank now."));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      icon={<Landmark className="h-5 w-5" />}
      title={renew ? `Renew ${renew.bankName}` : wallet ? `Connect a bank to ${wallet.name}` : "Connect a bank"}
      subtitle="You give the consent on your bank's own page: read only, for up to 180 days."
      busy={busy}
      error={error ?? (banks?.country === country ? banks.error : null)}
      submitLabel="Continue to the bank"
      canSubmit={!!picked}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      {renew ? (
        <p className="text-[13px] text-slate-600">
          Its accounts keep their wallets: once the bank sends you back, they go on coming in where they did.
        </p>
      ) : (
        <>
          {wallet && (
            <p className="text-[13px] text-slate-600">
              Once the bank sends you back, its {wallet.currency} account comes into {wallet.name}; with more than one, you choose which.
            </p>
          )}
          <Field label="Country">
            <select value={country} onChange={(e) => { setCountry(e.target.value); setPicked(null); }} className={INPUT}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Bank">
            <span className="relative block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your bank" className={`${INPUT} pl-9`} />
            </span>
          </Field>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
            {list === undefined ? (
              <p className="px-3 py-3 text-[12.5px] text-slate-400">Loading…</p>
            ) : shown.length === 0 ? (
              <p className="px-3 py-3 text-[12.5px] text-slate-400">{list === null ? "No bank to show." : "No bank matches."}</p>
            ) : shown.map((bank) => (
              <button
                type="button"
                key={bank.name}
                onClick={() => setPicked(bank.name)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${picked === bank.name ? "bg-[#C49A3C]/10" : "hover:bg-slate-50"}`}
              >
                {bank.logoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={bank.logoUrl} alt="" className="h-6 w-6 rounded object-contain shrink-0" />
                  : <Landmark className="h-5 w-5 text-slate-400 shrink-0" />}
                <span className="text-[13px] font-semibold text-slate-800">{bank.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </DialogShell>
  );
}

/**
 * A WALLET'S BANK — from a wallet's page: the bank account it takes its movements from. Linked,
 * the account and reading it now, or unlinking it; not yet, every account at the banks connected,
 * the one picked going straight into this wallet and read at once (only a free one of the wallet's
 * currency, at a bank whose consent holds, can be), or another bank to connect for it
 * (ConnectBankDialog, its account coming into this wallet once back).
 */
export function WalletBankDialog({ wallet, onClose }: { wallet: Wallet; onClose: () => void }) {
  const { wallets, changed } = useWallets();
  const [links, setLinks] = useState<BankLink[] | null | undefined>(undefined);
  const [reload, setReload] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    bankingService.links()
      .then((list) => { if (!cancelled) setLinks(list); })
      .catch((err) => {
        if (cancelled) return;
        setLinks(null);
        setError(errorText(err, "Unable to load your banks."));
      });
    return () => { cancelled = true; };
  }, [reload]);

  const linkOf = (account: BankAccount) => links?.find((l) => l.uuid === account.linkUuid);
  const own = links?.flatMap((l) => l.accounts).find((a) => a.walletUuid === wallet.uuid);
  // Why an account can't go into this wallet; null when it can.
  const blocked = (account: BankAccount) => {
    if (account.walletUuid) return `In ${wallets.find((w) => w.uuid === account.walletUuid)?.name ?? "another wallet"}`;
    if (account.currency !== wallet.currency) return `In ${account.currency}, the wallet's in ${wallet.currency}`;
    if (linkOf(account)?.status !== "active") return "Consent ended: renew it on the Banks page";
    return null;
  };

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setReload((n) => n + 1);
      changed();
    } catch (err) {
      setError(errorText(err, fallback));
    } finally {
      setBusy(false);
    }
  };
  const read = async (account: BankAccount) => {
    const result = await bankingService.sync(account.linkUuid);
    setNote(syncText(result.accounts.filter((a) => a.accountUuid === account.uuid)));
  };
  // Linked, it's read at once, not at the next of the twice-a-day reads.
  const link = () => run(async () => {
    const account = links?.flatMap((l) => l.accounts).find((a) => a.uuid === picked);
    if (!account) return;
    await bankingService.linkAccount(account.uuid, wallet.uuid);
    setPicked(null);
    await read(account);
  }, "Unable to link this account.");

  if (connecting) return <ConnectBankDialog wallet={wallet} onClose={() => setConnecting(false)} />;

  const ownLink = own ? linkOf(own) : undefined;
  return (
    <DialogShell
      icon={<Landmark className="h-5 w-5" />}
      title={`${wallet.name}'s bank`}
      subtitle="Read only, through open banking: the account's movements come into the wallet twice a day."
      busy={busy}
      error={error}
      submitLabel={own ? "Done" : `Link to ${wallet.name}`}
      canSubmit={own ? true : !!picked}
      onSubmit={() => (own ? onClose() : void link())}
      onClose={onClose}
      wide
    >
      {links === undefined ? (
        <p className="text-[12.5px] text-slate-400">Loading…</p>
      ) : own && ownLink ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-xl border border-[#EEE9DD] px-3 py-2.5">
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ownLink.status === "active" ? "bg-[#C49A3C]/10 text-[#C49A3C]" : "bg-rose-50 text-rose-600"}`}>
              <Landmark className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-bold text-slate-700">{ownLink.bankName} · {accountLabel(own)}</span>
              <span className="block text-[11px] text-slate-500">
                {[
                  ownLink.lastSyncedAt ? `read ${dayLabel(ownLink.lastSyncedAt.slice(0, 10))}` : "not read yet",
                  own.syncFrom && `from ${dayLabel(own.syncFrom)}`,
                ].filter(Boolean).join(" · ")}
              </span>
            </span>
            {ownLink.status === "active" && (
              <IconButton label="Read now" onClick={() => void run(() => read(own), "Unable to read this bank now.")} spinning={busy}>
                <RefreshCw className="h-3.5 w-3.5" />
              </IconButton>
            )}
            <IconButton label="Unlink from the wallet" onClick={() => void run(async () => { await bankingService.unlinkAccount(own.uuid); setNote(null); }, "Unable to unlink this account.")} disabled={busy}>
              <Unlink className="h-3.5 w-3.5" />
            </IconButton>
          </div>
          {note && <p className="text-[11.5px] font-semibold text-emerald-700">{note}</p>}
          <p className="text-[11.5px] text-slate-500">A wallet takes one account: unlink it to link another. The movements it brought stay.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(links ?? []).length === 0 ? (
            <p className="text-[13px] text-slate-600">No bank connected yet: connect yours, and choose the account to bring into {wallet.name}.</p>
          ) : (
            <div className="space-y-3">
              <span className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Which account</span>
              {(links ?? []).map((l) => (
                <div key={l.uuid} className="space-y-1.5">
                  <p className="text-[12px] font-bold text-slate-600">{l.bankName}</p>
                  <ul className="space-y-1.5">
                    {l.accounts.map((account) => {
                      const why = blocked(account);
                      const on = picked === account.uuid;
                      const balance = account.reportedBalance === null ? null : formatCurrency(account.reportedBalance, account.currency, 2);
                      return (
                        <li key={account.uuid}>
                          <button
                            type="button"
                            onClick={() => setPicked(account.uuid)}
                            disabled={!!why}
                            aria-pressed={on}
                            className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              on ? "border-[#C49A3C] bg-[#C49A3C]/5" : "border-[#EEE9DD] enabled:hover:border-[#C49A3C]/50"
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? "bg-[#C49A3C] border-[#C49A3C] text-white" : "border-slate-300 text-transparent"}`}>
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[12.5px] font-bold text-slate-700">{accountLabel(account)}</span>
                              <span className="block text-[11px] text-slate-500">{why ?? [account.currency, balance && `bank balance ${balance}`].filter(Boolean).join(" · ")}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {note && <p className="text-[11.5px] font-semibold text-emerald-700">{note}</p>}
          <button
            type="button"
            onClick={() => setConnecting(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-bold text-slate-600 hover:border-slate-300 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> {(links ?? []).length === 0 ? "Connect a bank" : "Connect another bank"}
          </button>
        </div>
      )}
    </DialogShell>
  );
}
