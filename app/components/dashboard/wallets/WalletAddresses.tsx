// components/dashboard/wallets/WalletAddresses.tsx
"use client";

import { useState, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ExternalLink, TriangleAlert, Unlink, Wallet as WalletIcon } from "lucide-react";
import { useWalletQuery } from "../../../context/WalletsContext";
import { tradingService } from "../../../services/tradingService";
import { accountService } from "../../../services/accountService";
import {
  WALLET_DOWNLOADS,
  connectWallet,
  getServerSolanaWallets,
  getSolanaWallets,
  signMessage,
  subscribeSolanaWallets,
} from "../../../lib/solanaWallets";
import { formatCurrency } from "../../../lib/format";
import { dayLabel, errorText } from "../../../lib/wallets";
import type { ChainHolding, OnchainAddress } from "../../../models/Trading";
import type { Wallet } from "../../../models/Wallet";
import { DialogShell } from "./WalletDialogs";
import { BalanceCheck, IconButton, LinkedSourceRow, NEW_WALLET } from "./WalletBanks";

// The chains an address can be proved on: Solana's, for now (forum's service map, "Buying from the app").
const SOLANA = "solana";
const CHAINS = [{ id: SOLANA, label: "Solana" }];

/**
 * The caller's addresses, oldest first: one read for the page and the dialog, read again with the
 * rest of the wallets after `changed()`.
 */
export function useOnchainAddresses() {
  return useWalletQuery(["onchainAddresses"], () => tradingService.addresses());
}

// A read's balances and movements reach the wallets by events (catena → mercatura → arca), a moment
// after the read answers: the wallets are read again now and after each of these delays.
export const SETTLE_DELAYS_MS = [2_000, 6_000];

/** "7xKX…gAsU": an address' ends, as the trading account names it. */
export const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

/**
 * The account an address just added makes (arca's, on mercatura's event: a moment after the
 * address is registered): looked for now and after each of SETTLE_DELAYS_MS, null if it isn't
 * there by then.
 */
export async function findAddressAccount(addressUuid: string): Promise<string | null> {
  for (const wait of [0, ...SETTLE_DELAYS_MS]) {
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    const [trading, accounts] = await Promise.all([tradingService.tradingAccounts(), accountService.list()]).catch(() => [[], []] as const);
    const own = trading.find((t) => t.reference === addressUuid);
    const account = own && accounts.find((a) => a.tradingAccountUuid === own.uuid);
    if (account) return account.uuid;
  }
  return null;
}

// The stablecoins an address' account counts as cash (catena's stablecoins), as the user picks them
// in their wallet or exchange.
const STABLECOINS = "USDC or EURC";

/**
 * One stablecoin of an address, on its account's page, as a bank's account: its balance read from
 * the chain; linked, the wallet it comes into (the whole row opening it, its balance checked
 * against the chain's, Unlink); not yet, a choice among the user's wallets of its currency free of another
 * source, or a new one named after it.
 */
export function HoldingRow({ holding, wallets, taken, busy, error, onLink, onUnlink, onOpenWallet }: {
  holding: ChainHolding;
  wallets: Wallet[];
  taken: Set<string | null>;
  busy: boolean;
  error?: string;
  onLink: (walletUuid: string | null) => void;
  onUnlink: () => void;
  onOpenWallet: (uuid: string) => void;
}) {
  const linked = holding.walletUuid ? wallets.find((w) => w.uuid === holding.walletUuid) : undefined;
  const choices = wallets.filter((w) => !w.archived && w.currency === holding.currency && !taken.has(w.uuid));
  const [choice, setChoice] = useState("");
  const meta = [
    holding.currency,
    `balance ${formatCurrency(holding.balance, holding.currency, 2)}`,
    holding.walletUuid && holding.syncFrom && `from ${dayLabel(holding.syncFrom)}`,
  ].filter(Boolean).join(" · ");
  if (holding.walletUuid) {
    return (
      <LinkedSourceRow
        title={holding.symbol}
        meta={meta}
        wallet={linked}
        check={linked && <BalanceCheck wallet={linked} reported={holding.balance} on={null} source="the chain" />}
        aside={<IconButton label="Unlink from the wallet" onClick={onUnlink} spinning={busy}><Unlink className="h-3.5 w-3.5" /></IconButton>}
        error={error}
        onOpen={onOpenWallet}
      />
    );
  }
  return (
    <li className="rounded-xl border border-[#EEE9DD] px-3 py-2.5 space-y-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-bold text-slate-700">{holding.symbol}</span>
          <span className="block text-[11px] text-slate-500">{meta}</span>
        </span>
        <span className="flex items-center gap-2">
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            aria-label="Wallet"
            className="h-9 px-2.5 rounded-lg bg-white text-[12px] font-semibold text-slate-700 border border-slate-200 outline-none focus:border-[#C49A3C]/60"
          >
            <option value="">Choose a wallet…</option>
            <option value={NEW_WALLET}>New wallet: {holding.symbol}</option>
            {choices.map((w) => <option key={w.uuid} value={w.uuid}>{w.name}</option>)}
          </select>
          <button
            type="button"
            onClick={() => choice && onLink(choice === NEW_WALLET ? null : choice)}
            disabled={!choice || busy}
            className="px-3 py-2 rounded-lg text-[11.5px] font-bold bg-[#1c1917] text-white hover:bg-[#C49A3C] transition-colors disabled:opacity-40"
          >
            {busy ? "Linking…" : "Link"}
          </button>
        </span>
      </div>
      {error && <p className="text-[11.5px] font-medium text-rose-600">{error}</p>}
    </li>
  );
}

/**
 * ADD FUNDS — how money reaches an address without the platform selling anything (forum's service
 * map, "Funding an address"): the user buys a stablecoin in their own wallet, or at an exchange, and
 * sends it here on Solana. The QR code holds the plain address, which any wallet or exchange reads.
 * Its arrival comes into the address' account with the chain's reads.
 */
export function AddFunds({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the address stays on screen to copy by hand */ }
  };
  return (
    <div className="rounded-2xl border border-[#EEE9DD] bg-[#FAF8F3] p-4 flex flex-col sm:flex-row gap-5">
      <div className="shrink-0 self-center rounded-xl bg-white p-3 border border-[#EEE9DD]">
        <QRCodeSVG value={address} size={132} level="M" />
      </div>
      <div className="min-w-0 space-y-3 text-[12.5px] text-slate-600">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Your Solana address</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 break-all text-[12px] font-semibold text-slate-800">{address}</code>
            <IconButton label={copied ? "Copied" : "Copy the address"} onClick={() => void copy()}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            </IconButton>
          </div>
        </div>
        <ol className="list-decimal pl-4 space-y-1">
          <li>Buy {STABLECOINS} in your wallet (Phantom and Solflare have a Buy button), or at an exchange where you have an account.</li>
          <li>From an exchange, withdraw it to this address, choosing the <strong>Solana</strong> network.</li>
          <li>It shows under this address once the chain is read, in the wallet you link it to; the card or bank payment can then be linked to it as a transfer.</li>
        </ol>
        <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11.5px] font-medium text-amber-800">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Send only {STABLECOINS} on the Solana network: funds sent on another network, or another token, may be lost. The
          platform never holds them: the purchase is between you and your wallet&apos;s or exchange&apos;s provider.
        </p>
      </div>
    </div>
  );
}

type Step = "connect" | "sign" | "register";

const STEP_LABELS: Record<Step, string> = {
  connect: "Approve the connection in your wallet…",
  sign: "Sign the message in your wallet…",
  register: "Adding the address…",
};

/**
 * CONNECT A WALLET — as Connect a bank: a chain (Solana's, for now), a wallet of it found in the
 * browser, then its address proved: the wallet gives it, the backend composes the message
 * (Sign-In With Solana, valid 5 minutes), the wallet signs it, the backend checks the signature and
 * adds the address, read at once so that its stablecoins show, each to link to a wallet.
 */
export function ConnectWalletDialog({ onClose, onConnected }: { onClose: () => void; onConnected: (address: OnchainAddress) => void }) {
  // The extensions announce themselves as the page loads, and later when one is installed.
  const wallets = useSyncExternalStore(subscribeSolanaWallets, getSolanaWallets, getServerSolanaWallets);
  const [chain, setChain] = useState(SOLANA);
  const [picked, setPicked] = useState<string | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The only wallet there is is the one meant.
  const chosen = picked ?? (wallets.length === 1 ? wallets[0].name : null);

  const prove = async () => {
    const wallet = wallets.find((w) => w.name === chosen);
    if (!wallet) return;
    setError(null);
    try {
      setStep("connect");
      const account = await connectWallet(wallet.wallet);
      const proof = await tradingService.startProof(chain, account.address);
      setStep("sign");
      const signature = await signMessage(wallet.wallet, account, proof.message);
      setStep("register");
      const added = await tradingService.register(proof.nonce, signature);
      // Its first read tells its stablecoins; the job would, within 5 minutes.
      await tradingService.read(added.uuid).catch(() => undefined);
      onConnected(added);
    } catch (err) {
      setError(errorText(err, "Unable to connect this wallet."));
      setStep(null);
    }
  };

  return (
    <DialogShell
      icon={<WalletIcon className="h-5 w-5" />}
      title="Connect a wallet"
      subtitle="Your wallet signs a message to prove the address is yours. It moves no funds and costs nothing; its stablecoins then show, each to link to a wallet."
      busy={step !== null}
      error={error}
      submitLabel="Connect and sign"
      canSubmit={chosen !== null}
      onSubmit={() => void prove()}
      onClose={onClose}
    >
      <label className="block space-y-1.5">
        <span className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Chain</span>
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value)}
          disabled={step !== null}
          className="w-full h-10 px-3 rounded-xl bg-white text-[13px] font-semibold text-slate-700 border border-slate-200 outline-none focus:border-[#C49A3C]/60"
        >
          {CHAINS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      {wallets.length === 0 ? (
        <div className="space-y-3">
          <p className="text-[12.5px] text-slate-600">No Solana wallet found in this browser. Install one, then open this again:</p>
          <ul className="flex flex-wrap gap-2">
            {WALLET_DOWNLOADS.map((download) => (
              <li key={download.name}>
                <a
                  href={download.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-bold text-slate-700 hover:border-[#C49A3C]/60"
                >
                  {download.name} <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="space-y-2">
          {wallets.map((w) => (
            <li key={w.name}>
              <button
                type="button"
                onClick={() => setPicked(w.name)}
                disabled={step !== null}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${chosen === w.name ? "border-[#C49A3C] bg-[#C49A3C]/5" : "border-slate-200 hover:border-[#C49A3C]/60"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- the wallet's own icon, a data URI */}
                <img src={w.icon} alt="" className="h-7 w-7 rounded-lg" />
                <span className="text-[13px] font-bold text-slate-800">{w.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {step && <p className="text-[12px] font-semibold text-[#C49A3C]">{STEP_LABELS[step]}</p>}
    </DialogShell>
  );
}
