// components/dashboard/wallets/WalletAddresses.tsx
"use client";

import { useState, useSyncExternalStore } from "react";
import { ExternalLink, Plus, Trash2, Wallet as WalletIcon } from "lucide-react";
import { useWalletQuery, useWallets } from "../../../context/WalletsContext";
import { tradingService } from "../../../services/tradingService";
import {
  WALLET_DOWNLOADS,
  connectWallet,
  getServerSolanaWallets,
  getSolanaWallets,
  signMessage,
  subscribeSolanaWallets,
} from "../../../lib/solanaWallets";
import { dayLabel, errorText } from "../../../lib/wallets";
import type { OnchainAddress } from "../../../models/Trading";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { ConfirmDialog } from "../ConfirmDialog";
import { DialogShell } from "./WalletDialogs";
import { IconButton } from "./WalletBanks";
import { DEMO_DISABLED_TITLE } from "../../preview/DemoBanner";

// The chain an address is proved on: Solana's, for now (forum's service map, "Buying from the app").
const SOLANA = "solana";

/** "7xKX…gAsU": an address' ends, as the trading account names it. */
const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

/**
 * The caller's addresses, oldest first: one read for the page and the dialog, read again with the
 * rest of the wallets after `changed()`.
 */
export function useOnchainAddresses() {
  return useWalletQuery(["onchainAddresses"], () => tradingService.addresses());
}

/**
 * ON-CHAIN ADDRESSES — the user's own wallets on a blockchain (Solana's: Phantom, Solflare), each
 * proved theirs by signing a message in it. Nothing is ever sent of the wallet but its address and
 * that signature; no key is kept, and nothing here can move money. Each address becomes a portfolio
 * (what it holds) and an account among the wallets (its stablecoins), which stay with their history
 * when the address is removed. A demo account's are read only.
 */
export function WalletAddresses() {
  const { sample, changed } = useWallets();
  const read = useOnchainAddresses();
  const [connecting, setConnecting] = useState(false);
  const [removing, setRemoving] = useState<OnchainAddress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addresses = read.isError ? null : read.data;

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setError(null);
    try {
      await tradingService.remove(removing.uuid);
      setRemoving(null);
      changed();
    } catch (err) {
      setError(errorText(err, "Unable to remove this address."));
    } finally {
      setBusy(false);
      void read.refetch();
    }
  };

  if (addresses === undefined) return <p className="text-[13px] text-[#857e78]">Loading…</p>;
  if (addresses === null) return <p className="text-[13px] font-semibold text-rose-600">{errorText(read.error, "Unable to load your addresses.")}</p>;

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setConnecting(true)}
          disabled={sample}
          title={sample ? DEMO_DISABLED_TITLE : undefined}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#1c1917] text-white hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:hover:bg-[#1c1917] disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" /> Connect a wallet
        </button>
      </div>

      <Module>
        <ModuleHead
          title="On-chain"
          desc="Your own wallets on Solana, proved yours by a signature. Each one gets a portfolio for what it holds and an account for its stablecoins. Your keys stay in your wallet: nothing here can move money."
        />
        <div className={MODULE_BODY}>
          {addresses.length === 0 ? (
            <p className="text-[12.5px] text-[#857e78]">
              No wallet connected yet. Connect Phantom, Solflare or another Solana wallet: you sign a short message in it, which
              moves nothing and costs nothing, and its address is added here.
            </p>
          ) : (
            <ul className="divide-y divide-[#EEE9DD]">
              {addresses.map((address) => (
                <li key={address.uuid} className="py-4 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[#C49A3C]/10 text-[#C49A3C]">
                    <WalletIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-slate-800">Solana {shortAddress(address.address)}</span>
                    <span className="block text-[11.5px] text-slate-500 truncate" title={address.address}>
                      {address.address} · added {dayLabel(address.registeredAt.slice(0, 10))}
                    </span>
                  </span>
                  <IconButton
                    label="Remove"
                    danger
                    onClick={() => { setError(null); setRemoving(address); }}
                    disabled={sample}
                    title={sample ? DEMO_DISABLED_TITLE : undefined}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          {error && !removing && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}
        </div>
      </Module>

      {connecting && (
        <ConnectWalletDialog
          onClose={() => setConnecting(false)}
          onConnected={() => { setConnecting(false); changed(); void read.refetch(); }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Remove Solana ${shortAddress(removing.address)}?`}
          description="Its movements stop coming in. Its portfolio and its account stay, with their history; the wallet itself is untouched."
          confirmLabel="Remove"
          confirming={busy}
          error={error}
          onConfirm={() => void remove()}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}

type Step = "connect" | "sign" | "register";

const STEP_LABELS: Record<Step, string> = {
  connect: "Approve the connection in your wallet…",
  sign: "Sign the message in your wallet…",
  register: "Adding the address…",
};

/**
 * Connects a Solana wallet found in the browser and proves its address: the wallet gives it, the
 * backend composes the message (Sign-In With Solana, valid 5 minutes), the wallet signs it, the
 * backend checks the signature and adds the address.
 */
function ConnectWalletDialog({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  // The extensions announce themselves as the page loads, and later when one is installed.
  const wallets = useSyncExternalStore(subscribeSolanaWallets, getSolanaWallets, getServerSolanaWallets);
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
      const proof = await tradingService.startProof(SOLANA, account.address);
      setStep("sign");
      const signature = await signMessage(wallet.wallet, account, proof.message);
      setStep("register");
      await tradingService.register(proof.nonce, signature);
      onConnected();
    } catch (err) {
      setError(errorText(err, "Unable to connect this wallet."));
      setStep(null);
    }
  };

  return (
    <DialogShell
      icon={<WalletIcon className="h-5 w-5" />}
      title="Connect a wallet"
      subtitle="Solana: your wallet signs a message to prove the address is yours. It moves no funds and costs nothing."
      busy={step !== null}
      error={error}
      submitLabel="Connect and sign"
      canSubmit={chosen !== null}
      onSubmit={() => void prove()}
      onClose={onClose}
    >
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
