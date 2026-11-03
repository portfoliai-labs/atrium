// components/dashboard/wallets/WalletsComposition.tsx
"use client";

import { useMemo } from "react";
import { useWallets } from "../../../context/WalletsContext";
import { useAccounts } from "../../../hooks/useAccounts";
import { formatCurrency } from "../../../lib/format";
import { KIND_LABELS, walletColor } from "../../../lib/wallets";
import type { Wallet, WalletKind } from "../../../models/Wallet";
import { DonutList, type DonutItem } from "../DonutList";
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

/**
 * LIQUIDITY'S COMPOSITION — every wallet that isn't archived on a donut and in a list, each with
 * its balance and share, a slice or a row opening its page. A bank's or an address' wallets sit
 * together, under a thin arc naming their account (DonutList's groups): accounts have no page of
 * their own. Shares are of the total in `currency` (the user's reference one): a wallet in
 * another currency counts at the rate its account's total tells (impliedRates), or, with none,
 * is listed in its own without a share; a card in debt takes none either. Beside it, to read
 * only, the balances by kind (current accounts, cards, savings, cash).
 */
export function WalletsComposition({ currency, onOpen }: { currency: string; onOpen: (uuid: string) => void }) {
  const { wallets } = useWallets();
  const accounts = useAccounts();

  const active = useMemo(() => wallets.map((w, i) => ({ w, color: walletColor(w, i) })).filter(({ w }) => !w.archived), [wallets]);
  const items = useMemo((): DonutItem[] => {
    const listed = accounts.data ?? [];
    const rates = impliedRates(listed, active.map(({ w }) => w), currency);
    return active.map(({ w, color }) => {
      const account = listed.find((a) => a.uuid === w.accountUuid);
      const rate = rates.get(w.currency);
      const sameCurrency = w.currency === currency;
      return {
        key: w.uuid,
        label: w.name,
        sub: [
          account?.name, KIND_LABELS[w.kind], account ? null : w.institution,
          sameCurrency ? null : rate === undefined ? `in ${w.currency}, not in the total` : `in ${w.currency}`,
        ].filter(Boolean).join(" · "),
        value: w.balance,
        currency: w.currency,
        counted: rate !== undefined && w.balance > 0,
        inTotal: rate === undefined || sameCurrency ? undefined : w.balance * rate,
        color,
        onOpen: () => onOpen(w.uuid),
        group: account ? { key: account.uuid, label: account.name } : undefined,
      };
    });
  }, [accounts.data, active, currency, onOpen]);

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
          <ModuleHead title="Wallets" desc="Each wallet's balance and share, a bank's together under its name: open one for its page." />
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
