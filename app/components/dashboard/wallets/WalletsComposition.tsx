// components/dashboard/wallets/WalletsComposition.tsx
"use client";

import { useMemo } from "react";
import { useWallets } from "../../../context/WalletsContext";
import { formatCurrency } from "../../../lib/format";
import { KIND_LABELS, WALLET_KINDS, walletColor } from "../../../lib/wallets";
import type { WalletKind } from "../../../models/Wallet";
import { DonutList, type DonutItem } from "../DonutList";
import { HBars, MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";

const KIND_COLORS: Record<WalletKind, string> = {
  current_account: "#2a78d6", credit_card: "#e34948", savings: "#1baf7a", cash: "#eda100",
};

/**
 * WALLETS COMPOSITION — All wallets' Composition, as All portfolios' Portfolios: every wallet
 * (not archived) on a donut and in a list, each with its balance and share, a slice or a row
 * opening that wallet — the way to each wallet's page. Beside it, to read only, the balances by
 * kind (current accounts, cards, savings, cash). Shares are of the total in `currency` (the
 * user's reference one): a wallet in another currency is listed in its own but takes no share,
 * and neither does a card in debt.
 */
export function WalletsComposition({ currency, onOpen }: { currency: string; onOpen: (uuid: string) => void }) {
  const { wallets } = useWallets();

  const active = useMemo(() => wallets.map((w, i) => ({ w, color: walletColor(w, i) })).filter(({ w }) => !w.archived), [wallets]);
  const items = useMemo((): DonutItem[] => active.map(({ w, color }) => {
    const sameCurrency = w.currency === currency;
    return {
      key: w.uuid,
      label: w.name,
      sub: [KIND_LABELS[w.kind], w.institution, sameCurrency ? null : `in ${w.currency}, not in the total`].filter(Boolean).join(" · "),
      value: w.balance,
      currency: w.currency,
      counted: sameCurrency && w.balance > 0,
      color,
      onOpen: () => onOpen(w.uuid),
    };
  }), [active, currency, onOpen]);

  const kinds = WALLET_KINDS.map((kind) => {
    const own = active.filter(({ w }) => w.kind === kind && w.currency === currency);
    return { kind, count: own.length, value: own.reduce((s, { w }) => s + w.balance, 0) };
  }).filter((k) => k.count > 0);
  const kindsTotal = kinds.reduce((s, k) => s + Math.max(k.value, 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-[22px]">
      <div className={kinds.length > 1 ? "lg:col-span-8" : "lg:col-span-12"}>
        <Module>
          <ModuleHead title="Wallets" desc="Each wallet's balance and share: open one for its page." />
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
