// components/dashboard/wallets/WalletBanks.tsx
"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Landmark, Plus, RefreshCw, Search, Unlink } from "lucide-react";
import { useWalletQuery, useWallets } from "../../../context/WalletsContext";
import { bankingService } from "../../../services/bankingService";
import { walletService } from "../../../services/walletService";
import { formatCurrency } from "../../../lib/format";
import { dayLabel, errorText } from "../../../lib/wallets";
import { useChainHoldings } from "../../../hooks/useChainHoldings";
import type { AccountSync, BankAccount, BankLink } from "../../../models/Banking";
import type { Wallet } from "../../../models/Wallet";
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
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch { /* the account is then chosen on its account's page */ }
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
  const links = useBankLinks(!!walletUuid);
  if (!walletUuid || links.isPending) return undefined;
  return !!links.data?.some((l) => l.accounts.some((a) => a.walletUuid === walletUuid));
}

/**
 * The bank links, oldest first, each with its accounts: one read for every module and dialog that
 * wants them, read again with the rest of the wallets after `changed()`.
 */
export function useBankLinks(enabled = true) {
  return useWalletQuery(["bankLinks"], () => bankingService.links(), { enabled });
}

/** An account's page, from outside the dashboard (read by WalletsSection). */
export const accountPageUrl = (accountUuid: string) => `/dashboard?section=wallets&account=${encodeURIComponent(accountUuid)}`;

/** A wallet's page, from outside the dashboard; `connect` opens its bank dialog (WalletBankDialog). */
export const walletPageUrl = (walletUuid: string, connect = false) =>
  `/dashboard?section=wallets&wallet=${encodeURIComponent(walletUuid)}${connect ? "&connectBank=1" : ""}`;

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
 * The wallets that take a bank account's or a stablecoin's movements already: one source each, so
 * they aren't offered to another.
 */
export function useSourcedWallets(): Set<string | null> {
  const links = useBankLinks();
  const holdings = useChainHoldings();
  return useMemo(() => new Set([
    ...(links.data ?? []).flatMap((l) => l.accounts.map((a) => a.walletUuid)),
    ...(holdings.data ?? []).map((h) => h.walletUuid),
  ].filter(Boolean)), [links.data, holdings.data]);
}

/** Days left of a link's consent (0 once it ended). */
export const daysLeft = (link: BankLink) =>
  link.validUntil ? Math.ceil((new Date(link.validUntil).getTime() - Date.now()) / 86_400_000) : 0;

/** A consent ending within these many days (or ended) is offered to be renewed. */
export const renewable = (link: BankLink) => link.status !== "active" || daysLeft(link) <= RENEW_WITHIN_DAYS;

// The choice of a new wallet, beside the user's own, for an account (or a stablecoin) not linked yet.
export const NEW_WALLET = "new";

/**
 * A new wallet for a bank's account, linked to it: a current account in its currency, named after
 * it, empty, so that the bank's history and balance come into it at its first read (arca takes a
 * linked empty wallet's opening from the bank). If the link fails, the wallet made for it goes.
 */
export async function linkNewWallet(link: BankLink, account: BankAccount): Promise<string> {
  const created = await walletService.create({
    name: account.name ?? `${link.bankName} ${account.currency}`,
    kind: "current_account",
    currency: account.currency,
    institution: link.bankName,
  });
  try {
    await bankingService.linkAccount(account.uuid, created.uuid);
  } catch (err) {
    await walletService.remove(created.uuid).catch(() => undefined);
    throw err;
  }
  return created.uuid;
}

/**
 * The wallet's balance beside the one its source tells (the bank's at its last read, or the
 * chain's): equal, or how far off, a missing or doubled movement being the usual why.
 */
export function BalanceCheck({ wallet, reported, on, source }: { wallet: Wallet; reported: number | null; on: string | null; source: string }) {
  if (reported === null) return <span className="text-[11px] text-slate-400">{source} hasn&apos;t told its balance yet</span>;
  const off = wallet.balance - reported;
  const when = on ? ` on ${dayLabel(on.slice(0, 10))}` : "";
  if (Math.abs(off) < 0.005) {
    return <span className="text-[11px] font-semibold text-emerald-700">Balance matches {source}&apos;s{when}</span>;
  }
  return (
    <span className="text-[11px] font-semibold text-amber-700" title="A movement missing, or there twice: check the wallet's movements">
      {formatCurrency(Math.abs(off), wallet.currency, 2)} {off > 0 ? "more" : "less"} than {source}&apos;s {formatCurrency(reported, wallet.currency, 2)}{when}
    </span>
  );
}

/**
 * A bank's account (or a stablecoin) linked to a wallet: the whole row opens the wallet, a chevron
 * saying so; beside it, apart, what undoes the link.
 */
export function LinkedSourceRow({ title, meta, wallet, check, aside, error, onOpen }: {
  title: string;
  meta: string;
  wallet: Wallet | undefined;
  check: React.ReactNode;
  aside: React.ReactNode;
  error?: string;
  onOpen: (uuid: string) => void;
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block text-[12.5px] font-bold text-slate-700">{title}</span>
        <span className="block text-[11px] text-slate-500">{meta}</span>
        {check && <span className="block">{check}</span>}
      </span>
      <span className="shrink-0 text-[12px] font-semibold text-slate-600">→ {wallet?.name ?? "A wallet"}</span>
      {wallet && <ChevronRight className="h-4 w-4 shrink-0 text-[#857e78]" />}
    </>
  );
  const row = "min-w-0 flex-1 flex items-center gap-3 px-3 py-2.5 text-left rounded-xl";
  return (
    <li className="rounded-xl border border-[#EEE9DD] transition-colors hover:border-[#C49A3C]/50">
      <div className="flex items-center gap-1 pr-2">
        {wallet ? (
          <button type="button" onClick={() => onOpen(wallet.uuid)} aria-label={`Open ${wallet.name}`} className={`${row} hover:bg-[#F7F5EF] outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40`}>
            {body}
          </button>
        ) : <div className={row}>{body}</div>}
        {aside}
      </div>
      {error && <p className="px-3 pb-2 text-[11.5px] font-medium text-rose-600">{error}</p>}
    </li>
  );
}

/**
 * One account at a bank, on its account's page: the bank's balance; linked, the wallet it comes
 * into (the whole row opening it, its balance checked against the bank's, Unlink); not yet, a choice among
 * the user's wallets of its currency free of another source, or a new one named after it.
 */
export function BankAccountRow({ link, account, wallets, taken, readOnly, busy, error, onLink, onUnlink, onOpenWallet }: {
  link: BankLink;
  account: BankAccount;
  wallets: Wallet[];
  taken: Set<string | null>;
  readOnly: boolean;
  busy: boolean;
  error?: string;
  // A wallet's uuid, or NEW_WALLET.
  onLink: (choice: string) => void;
  onUnlink: () => void;
  onOpenWallet: (uuid: string) => void;
}) {
  const linked = account.walletUuid ? wallets.find((w) => w.uuid === account.walletUuid) : undefined;
  const choices = wallets.filter((w) => !w.archived && w.currency === account.currency && !taken.has(w.uuid));
  const [choice, setChoice] = useState("");
  const active = link.status === "active";
  const balance = account.reportedBalance === null ? null : formatCurrency(account.reportedBalance, account.currency, 2);
  if (account.walletUuid) {
    return (
      <LinkedSourceRow
        title={accountLabel(account)}
        meta={[account.currency, balance && `bank balance ${balance}`, account.syncFrom && `read from ${dayLabel(account.syncFrom)}`].filter(Boolean).join(" · ")}
        wallet={linked}
        check={linked && <BalanceCheck wallet={linked} reported={account.reportedBalance} on={account.reportedBalanceOn} source="the bank" />}
        aside={!readOnly && <IconButton label="Unlink from the wallet" onClick={onUnlink} spinning={busy}><Unlink className="h-3.5 w-3.5" /></IconButton>}
        error={error}
        onOpen={onOpenWallet}
      />
    );
  }
  return (
    <li className="rounded-xl border border-[#EEE9DD] px-3 py-2.5 space-y-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-bold text-slate-700">{accountLabel(account)}</span>
          <span className="block text-[11px] text-slate-500">
            {[account.currency, balance && `bank balance ${balance}`].filter(Boolean).join(" · ")}
          </span>
        </span>
        {readOnly ? (
          <span className="text-[11.5px] text-slate-400">Not linked to a wallet</span>
        ) : !active ? (
          <span className="text-[11.5px] text-slate-400">Renew the consent to link it</span>
        ) : (
          <span className="flex items-center gap-2">
            <select
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              aria-label="Wallet"
              className="h-9 px-2.5 rounded-lg bg-white text-[12px] font-semibold text-slate-700 border border-slate-200 outline-none focus:border-[#C49A3C]/60"
            >
              <option value="">Choose a wallet…</option>
              <option value={NEW_WALLET}>New wallet: {account.name ?? `${link.bankName} ${account.currency}`}</option>
              {choices.map((w) => <option key={w.uuid} value={w.uuid}>{w.name}</option>)}
            </select>
            <button
              type="button"
              onClick={() => choice && onLink(choice)}
              disabled={!choice || busy}
              className="px-3 py-2 rounded-lg text-[11.5px] font-bold bg-[#1c1917] text-white hover:bg-[#C49A3C] transition-colors disabled:opacity-40"
            >
              {busy ? "Linking…" : "Link"}
            </button>
          </span>
        )}
      </div>
      {error && <p className="text-[11.5px] font-medium text-rose-600">{error}</p>}
    </li>
  );
}

/**
 * WALLET BANK SYNC — in a wallet's settings: the bank account it's linked to, if any, and reading
 * it now. Linking and unlinking stay on its account's page; a read here is the whole link's, its note
 * this account's.
 */
export function WalletBankSync({ wallet }: { wallet: Wallet }) {
  const { sample, changed } = useWallets();
  const read = useBankLinks();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (read.isPending) return null;
  const link = read.data?.find((l) => l.accounts.some((a) => a.walletUuid === wallet.uuid));
  const account = link?.accounts.find((a) => a.walletUuid === wallet.uuid);
  if (!link || !account) {
    return read.isError ? <p className="text-[11.5px] font-semibold text-rose-600">{errorText(read.error, "Unable to load your banks.")}</p> : null;
  }

  const active = link.status === "active";
  const lock = sample ? DEMO_DISABLED_TITLE : wallet.archived ? "An archived wallet isn't read" : !active ? "The consent ended: renew it on its account's page" : null;
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
export function ConnectBankDialog({ renew, wallet, onClose }: { renew?: BankLink; wallet?: Wallet; onClose: () => void }) {
  const [country, setCountry] = useState(renew?.country ?? "IT");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(renew?.bankName ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A country's banks; none read to renew a link.
  const banks = useWalletQuery(["banks", country], () => bankingService.banks(country), { enabled: !renew });
  const list = banks.isError ? null : banks.data;
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
      error={error ?? (banks.isError ? errorText(banks.error, "Unable to load the banks.") : null)}
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
  const linksRead = useBankLinks();
  const links = linksRead.isError ? null : linksRead.data;
  const [picked, setPicked] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const linkOf = (account: BankAccount) => links?.find((l) => l.uuid === account.linkUuid);
  const own = links?.flatMap((l) => l.accounts).find((a) => a.walletUuid === wallet.uuid);
  // Why an account can't go into this wallet; null when it can.
  const blocked = (account: BankAccount) => {
    if (account.walletUuid) return `In ${wallets.find((w) => w.uuid === account.walletUuid)?.name ?? "another wallet"}`;
    if (account.currency !== wallet.currency) return `In ${account.currency}, the wallet's in ${wallet.currency}`;
    if (linkOf(account)?.status !== "active") return "Consent ended: renew it on its account's page";
    return null;
  };

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
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
      error={error ?? (linksRead.isError ? errorText(linksRead.error, "Unable to load your banks.") : null)}
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
