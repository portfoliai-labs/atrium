// lib/solanaWallets.ts
//
// The user's Solana wallets in the browser (Phantom, Solflare, any other), through the Wallet
// Standard: each extension announces itself, nothing is bundled per wallet. Only what proving an
// address needs: connecting (the wallet's address) and signing a message. The platform never holds
// a key; the user signs in their wallet.

import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { StandardConnect, type StandardConnectFeature } from "@wallet-standard/features";
import { SolanaSignMessage, type SolanaSignMessageFeature } from "@solana/wallet-standard-features";

// Where to get one when none is installed.
export const WALLET_DOWNLOADS: { name: string; url: string }[] = [
  { name: "Phantom", url: "https://phantom.com/download" },
  { name: "Solflare", url: "https://www.solflare.com/download/" },
];

export interface SolanaWallet {
  name: string;
  icon: string;
  wallet: Wallet;
}

const canProve = (wallet: Wallet) =>
  StandardConnect in wallet.features && SolanaSignMessage in wallet.features && wallet.chains.some((c) => c.startsWith("solana:"));

// The last list read, kept while the registry's wallets are the same ones: a stable snapshot for
// useSyncExternalStore.
let snapshot: { source: readonly Wallet[]; wallets: SolanaWallet[] } = { source: [], wallets: [] };

/** The wallets that can prove a Solana address, the same array while none registers or goes. */
export function getSolanaWallets(): SolanaWallet[] {
  const source = getWallets().get();
  const same = source.length === snapshot.source.length && source.every((w, i) => w === snapshot.source[i]);
  if (!same) {
    snapshot = { source, wallets: source.filter(canProve).map((wallet) => ({ name: wallet.name, icon: wallet.icon, wallet })) };
  }
  return snapshot.wallets;
}

/** Hears of a wallet registering (an extension loading or installed) or going; returns the unsubscribe. */
export function subscribeSolanaWallets(onChange: () => void): () => void {
  const registry = getWallets();
  const offRegister = registry.on("register", onChange);
  const offUnregister = registry.on("unregister", onChange);
  return () => { offRegister(); offUnregister(); };
}

const NO_WALLETS: SolanaWallet[] = [];
/** On the server: none (the extensions live in the browser). */
export const getServerSolanaWallets = () => NO_WALLETS;

/** Asks the wallet for its account (the user approves in the wallet): its address. */
export async function connectWallet(wallet: Wallet): Promise<WalletAccount> {
  const connect = (wallet.features as StandardConnectFeature)[StandardConnect];
  const { accounts } = await connect.connect();
  const account = accounts.find((a) => a.chains.some((c) => c.startsWith("solana:"))) ?? accounts[0];
  if (!account) throw new Error("The wallet gave no address.");
  return account;
}

/** The wallet's signature of the message (the user approves in the wallet), base64. */
export async function signMessage(wallet: Wallet, account: WalletAccount, message: string): Promise<string> {
  const sign = (wallet.features as SolanaSignMessageFeature)[SolanaSignMessage];
  const [output] = await sign.signMessage({ account, message: new TextEncoder().encode(message) });
  if (!output) throw new Error("The wallet didn't sign.");
  let binary = "";
  output.signature.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}
