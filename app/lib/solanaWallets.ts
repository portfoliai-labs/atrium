// lib/solanaWallets.ts
//
// The user's Solana wallets in the browser (Phantom, Solflare, any other), through the Wallet
// Standard: each extension announces itself, nothing is bundled per wallet. Only what proving an
// address needs (connecting: the wallet's address; signing a message) and an order needs (signing
// the transaction catena prepared, which catena sends). The platform never holds
// a key; the user signs in their wallet.

import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { StandardConnect, type StandardConnectFeature } from "@wallet-standard/features";
import {
  SolanaSignMessage,
  SolanaSignTransaction,
  type SolanaSignMessageFeature,
  type SolanaSignTransactionFeature,
} from "@solana/wallet-standard-features";

// The network the deployment trades on, as the Wallet Standard names it: the wallet signs (and
// shows) the transaction for it. Locally "solana:devnet", where catena's devnet desk is the venue.
const SOLANA_CHAIN = process.env.NEXT_PUBLIC_SOLANA_CHAIN || "solana:mainnet";

/** A transaction on Solscan, on the deployment's network (devnet by its cluster). */
export function transactionUrl(signature: string): string {
  const network = SOLANA_CHAIN.slice("solana:".length);
  return `https://solscan.io/tx/${signature}${network === "mainnet" ? "" : `?cluster=${network}`}`;
}

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

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/** Whether the wallet can sign a transaction (not only a message). */
export const canSignTransactions = (wallet: Wallet) => SolanaSignTransaction in wallet.features;

/**
 * The wallet and its account holding `address`: one already connected to the page first, else
 * each wallet asked in turn (the user approves the connection in it). Null when none holds it.
 */
export async function walletFor(address: string): Promise<{ wallet: Wallet; account: WalletAccount } | null> {
  const wallets = getSolanaWallets().map((w) => w.wallet).filter(canSignTransactions);
  for (const wallet of wallets) {
    const account = wallet.accounts.find((a) => a.address === address);
    if (account) return { wallet, account };
  }
  for (const wallet of wallets) {
    try {
      const connect = (wallet.features as StandardConnectFeature)[StandardConnect];
      const { accounts } = await connect.connect();
      const account = accounts.find((a) => a.address === address);
      if (account) return { wallet, account };
    } catch {
      // Refused, or not this one: the next.
    }
  }
  return null;
}

/**
 * The wallet's signature of the transaction catena prepared (base64 in, base64 out): the wallet
 * shows the user what it does before they approve. Signed only, never sent by the wallet: catena
 * checks it is the one prepared and sends it.
 */
export async function signTransaction(wallet: Wallet, account: WalletAccount, transaction: string): Promise<string> {
  const feature = (wallet.features as SolanaSignTransactionFeature)[SolanaSignTransaction];
  // Never signed for another network: the wallet would simulate it there, where its accounts
  // don't exist (a devnet transaction on mainnet), and reject it.
  const chain = SOLANA_CHAIN as `${string}:${string}`;
  const declared = account.chains.length ? account.chains : wallet.chains;
  if (!declared.includes(chain)) {
    const network = `Solana ${chain.slice("solana:".length)}`;
    throw new Error(
      `Your wallet isn't on ${network}: switch it to ${network} (MetaMask: Settings › Advanced › Show test networks, then pick it; Phantom: Settings › Developer settings › Testnet mode) and try again.`,
    );
  }
  const [output] = await feature.signTransaction({ account, transaction: fromBase64(transaction), chain });
  if (!output) throw new Error("The wallet didn't sign.");
  return toBase64(output.signedTransaction);
}
