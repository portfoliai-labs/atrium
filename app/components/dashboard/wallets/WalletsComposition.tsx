// components/dashboard/wallets/WalletsComposition.tsx
"use client";

import { useMemo } from "react";
import { Blocks, Landmark } from "lucide-react";
import { useWallets } from "../../../context/WalletsContext";
import { useAccounts } from "../../../hooks/useAccounts";
import { formatCurrency } from "../../../lib/format";
import { KIND_LABELS, walletColor } from "../../../lib/wallets";
import type { Wallet, WalletKind } from "../../../models/Wallet";
import { DonutList, type DonutItem, type DonutPart } from "../DonutList";
import type { Account } from "../../../models/Account";
import { HBars, MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";

const KIND_COLORS: Record<WalletKind, string> = {
  current_account: "#2a78d6", credit_card: "#e34948", savings: "#1baf7a", cash: "#eda100", crypto: "#7c5cd6",
};

/**
 * The rates into `currency` the accounts' totals tell: an account with one other currency (its
 * total is arca's, each wallet at today's rate) gives that currency's, and a rate found makes
 * another account's next unknown one findable. A currency no account tells stays unknown.
 */
function impliedRates(accounts: Account[], wallets: Wallet[], currency: string): Map<string, number> {
  const rates = new Map<string, number>([[currency, 1]]);
  for (let found = true; found;) {
    found = false;
    for (const a of accounts) {
      if (a.balance === null || a.balanceCurrency !== currency) continue;
      const own = wallets.filter((w) => w.accountUuid === a.uuid);
      const unknown = [...new Set(own.map((w) => w.currency))].filter((c) => !rates.has(c));
      if (unknown.length !== 1) continue;
      const known = own.filter((w) => rates.has(w.currency)).reduce((s, w) => s + w.balance * rates.get(w.currency)!, 0);
      const foreign = own.filter((w) => w.currency === unknown[0]).reduce((s, w) => s + w.balance, 0);
      if (foreign === 0) continue;
      const rate = (a.balance - known) / foreign;
      if (rate > 0) { rates.set(unknown[0], rate); found = true; }
    }
  }
  return rates;
}

// An account with no wallet yet (just connected), listed without a slice.
const UNLINKED_COLOR = "#A8A29E";

/** A wallet in no account, by itself: in another currency, at the rate the accounts tell. */
function walletItem(w: Wallet, color: string, currency: string, rate: number | undefined, onOpen: () => void): DonutItem {
  const sameCurrency = w.currency === currency;
  return {
    key: w.uuid,
    label: w.name,
    sub: [KIND_LABELS[w.kind], w.institution, sameCurrency ? null : rate === undefined ? `in ${w.currency}, not in the total` : `in ${w.currency}`].filter(Boolean).join(" · "),
    value: w.balance,
    currency: w.currency,
    counted: rate !== undefined && w.balance > 0,
    inTotal: rate === undefined || sameCurrency ? undefined : w.balance * rate,
    color,
    onOpen,
  };
}

/**
 * CASH, ACCOUNTS AND CARDS' COMPOSITION — what is under the section: every account (a bank's or
 * an address', its own page) and every wallet in none, on a donut and in a list, each with its
 * balance and share, a slice or a row opening its page. An account is marked by its source's icon
 * (a bank, the chain), a wallet by itself by its colour's square. An account's balance is arca's,
 * every wallet of it at today's rate in `currency`; around the ring, a thinner one splits it into
 * its wallets (in `currency`, at the rates the accounts' totals tell: impliedRates), its slice as
 * wide as they are there together. One just connected, with no wallet yet, is listed to be opened
 * and its wallets chosen. While the accounts are read (or when they can't be), each wallet is by
 * itself. A wallet in no account in another currency counts at the rate an account tells, or,
 * with none, is listed in its own without a share; a card in debt takes none either. Beside it, to
 * read only, the balances by kind (current accounts, cards, savings, cash).
 */
export function WalletsComposition({ currency, onOpen, onOpenAccount }: {
  currency: string;
  onOpen: (uuid: string) => void;
  onOpenAccount: (uuid: string) => void;
}) {
  const { wallets } = useWallets();
  const accounts = useAccounts();

  const active = useMemo(() => wallets.map((w, i) => ({ w, color: walletColor(w, i) })).filter(({ w }) => !w.archived), [wallets]);
  const items = useMemo((): DonutItem[] => {
    const listed = accounts.data ?? [];
    const own = (uuid: string) => active.filter(({ w }) => w.accountUuid === uuid);
    const rates = impliedRates(listed, active.map(({ w }) => w), currency);
    // An account's wallets on the outer ring, in `currency`: those worth something (a card in debt
    // takes no part, as it takes no share). None when one's rate isn't known: the account is
    // drawn whole there too.
    const parts = (uuid: string): DonutPart[] | undefined => {
      const held = own(uuid).filter(({ w }) => w.balance > 0);
      if (held.some(({ w }) => !rates.has(w.currency))) return undefined;
      return held.map(({ w, color }) => ({ key: w.uuid, label: w.name, value: w.balance * rates.get(w.currency)!, color, onOpen: () => onOpen(w.uuid) }));
    };
    // Those with a wallet, and those still connected with none yet.
    const shown = listed.filter((a) => own(a.uuid).length > 0 || a.bankLinkUuid || a.tradingAccountUuid);
    const accountItems = shown.map((a): DonutItem => {
      const count = own(a.uuid).length;
      return {
        key: a.uuid,
        label: a.name,
        sub: [
          a.tradingAccountUuid ? "On-chain" : a.institution !== a.name ? a.institution : "Bank",
          count === 0 ? "no wallet yet: open it to choose" : `${count} ${count === 1 ? "wallet" : "wallets"}`,
          count > 0 && a.balance === null ? "its total can't be told now" : null,
        ].filter(Boolean).join(" · "),
        value: count === 0 ? null : a.balance,
        currency: a.balanceCurrency ?? currency,
        counted: count > 0 && a.balance !== null && a.balanceCurrency === currency && a.balance > 0,
        color: own(a.uuid)[0]?.color ?? UNLINKED_COLOR,
        icon: a.tradingAccountUuid ? <Blocks className="h-3.5 w-3.5" /> : <Landmark className="h-3.5 w-3.5" />,
        onOpen: () => onOpenAccount(a.uuid),
        parts: parts(a.uuid),
      };
    });
    const loose = active.filter(({ w }) => !listed.some((a) => a.uuid === w.accountUuid));
    return [...accountItems, ...loose.map(({ w, color }) => walletItem(w, color, currency, rates.get(w.currency), () => onOpen(w.uuid)))];
  }, [accounts.data, active, currency, onOpen, onOpenAccount]);

  // Every kind, a crypto wallet's too (WALLET_KINDS are those made by hand).
  const kinds = (Object.keys(KIND_LABELS) as WalletKind[]).map((kind) => {
    const own = active.filter(({ w }) => w.kind === kind && w.currency === currency);
    return { kind, count: own.length, value: own.reduce((s, { w }) => s + w.balance, 0) };
  }).filter((k) => k.count > 0);
  const kindsTotal = kinds.reduce((s, k) => s + Math.max(k.value, 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-[22px]">
      <div className={kinds.length > 1 ? "lg:col-span-8" : "lg:col-span-12"}>
        <Module>
          <ModuleHead title="Accounts and wallets" desc="Your banks' and addresses' accounts, with their wallets around them, and the wallets of your own: open one for its page." />
          <div className={MODULE_BODY}><DonutList items={items} currency={currency} /></div>
        </Module>
      </div>
      {kinds.length > 1 && (
        <div className="lg:col-span-4">
          <Module>
            <ModuleHead title="By kind" desc={`Your wallets in ${currency} by kind, to read.`} />
            <div className={MODULE_BODY}>
              <HBars
                rows={kinds.map((k) => ({
                  key: k.kind,
                  label: KIND_LABELS[k.kind],
                  value: kindsTotal > 0 ? (Math.max(k.value, 0) / kindsTotal) * 100 : 0,
                  figure: formatCurrency(k.value, currency, 0),
                  color: KIND_COLORS[k.kind],
                  tone: k.value < 0 ? "loss" : undefined,
                  title: `${KIND_LABELS[k.kind]} · ${k.count} ${k.count === 1 ? "wallet" : "wallets"}`,
                }))}
              />
            </div>
          </Module>
        </div>
      )}
    </div>
  );
}
