// components/dashboard/wallets/AccountNode.tsx
"use client";

import { Loader2 } from "lucide-react";
import { useWallets } from "../../../context/WalletsContext";
import { useAccounts } from "../../../hooks/useAccounts";
import { formatCurrency } from "../../../lib/format";
import { ALL_WALLETS, KIND_LABELS, dayLabel, errorText, walletColor } from "../../../lib/wallets";
import type { Account } from "../../../models/Account";
import type { BankLink } from "../../../models/Banking";
import { Breadcrumb, type Crumb } from "../Breadcrumb";
import { DonutList, type DonutItem } from "../DonutList";
import { PageHeader, type PageAction, type PageFigure } from "../PageHeader";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import { PreviewBadge } from "../../preview/PreviewKit";
import { useBankLinks } from "./WalletBanks";
import { ArchivedList, type WalletPage } from "./WalletNode";

/**
 * AN ACCOUNT'S PAGE — between All wallets and its wallets: a bank connected, or an on-chain
 * address, with the wallets it brings (one per currency or pot). Its header tells what they hold
 * together (arca's, each at today's rate in the reference currency) and where they come from (the
 * bank's consent and last read, or the chain); under it, its wallets on a donut and in a list,
 * each opening its page, the archived ones after. Its own figures over time (in and out, the
 * categories) aren't read yet: arca reads them for one wallet or for every one.
 */
export function AccountNode({ accountUuid, rootTrail, onOpen }: {
  accountUuid: string;
  rootTrail: Crumb[];
  onOpen: (id: string, page: WalletPage) => void;
}) {
  const { wallets, loading, sample } = useWallets();
  const accounts = useAccounts();
  const account = accounts.data?.find((a) => a.uuid === accountUuid);
  const links = useBankLinks(!!account?.bankLinkUuid);
  const link = account?.bankLinkUuid ? links.data?.find((l) => l.uuid === account.bankLinkUuid) : undefined;

  const allCrumb: Crumb = { label: "Wallets", onClick: () => onOpen(ALL_WALLETS, "insights") };
  const trail = [...rootTrail, allCrumb];

  if (loading || accounts.isPending) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 text-[#C49A3C] animate-spin" /></div>;
  if (!account) {
    return (
      <div className="space-y-6 pb-12">
        <Breadcrumb trail={trail} current="Account" />
        <p className="text-sm font-semibold text-rose-600">
          {accounts.isError ? errorText(accounts.error, "Unable to load your accounts.") : "This account isn't there any more."}
        </p>
      </div>
    );
  }

  const own = wallets.map((w, i) => ({ wallet: w, color: walletColor(w, i) })).filter(({ wallet }) => wallet.accountUuid === account.uuid);
  const active = own.filter(({ wallet }) => !wallet.archived);
  const archived = own.filter(({ wallet }) => wallet.archived);
  // The donut's shares in the wallets' own currency when they share one, else in the reference one
  // (a wallet in another is listed without a share, as on All wallets).
  const currencies = new Set(active.map(({ wallet }) => wallet.currency));
  const donutCurrency = currencies.size === 1 ? [...currencies][0] : account.balanceCurrency ?? active[0]?.wallet.currency ?? "EUR";
  const items: DonutItem[] = active.map(({ wallet, color }) => {
    const counted = wallet.currency === donutCurrency;
    return {
      key: wallet.uuid,
      label: wallet.name,
      sub: [KIND_LABELS[wallet.kind], counted ? null : `in ${wallet.currency}, not in the shares`].filter(Boolean).join(" · "),
      value: wallet.balance,
      currency: wallet.currency,
      counted: counted && wallet.balance > 0,
      color,
      onOpen: () => onOpen(wallet.uuid, "insights"),
    };
  });

  const actions: PageAction[] = [
    // Where its wallets come from: the bank's consent and reads, or the address'.
    ...(account.bankLinkUuid ? [{ label: "Banks", primary: true, plus: false, onClick: () => onOpen(ALL_WALLETS, "banks") }] : []),
    ...(account.tradingAccountUuid ? [{ label: "On-chain", primary: true, plus: false, onClick: () => onOpen(ALL_WALLETS, "addresses") }] : []),
    { label: "Manage wallets", onClick: () => onOpen(ALL_WALLETS, "manage") },
  ];
  const figures: PageFigure[] = [
    { label: "Wallets", value: String(active.length), sub: archived.length ? `${archived.length} archived` : undefined },
    sourceFigure(account, link, links.isPending),
    ...(account.holder ? [{ label: "Holder", value: account.holder }] : []),
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow="Account"
        crumbs={trail}
        badge={sample ? <PreviewBadge label="Sample" /> : undefined}
        title={account.name}
        value={account.balance !== null && account.balanceCurrency ? formatCurrency(account.balance, account.balanceCurrency, 0) : "—"}
        note={account.balance === null ? "Its total can't be told now: an exchange rate is missing." : currencies.size > 1 || donutCurrency !== account.balanceCurrency ? "Its wallets together, at today's rate." : undefined}
        actions={actions}
        figures={figures}
      />
      <Module>
        <ModuleHead title="Wallets" desc="Each wallet's balance and share: open one for its page." />
        <div className={MODULE_BODY}>
          {active.length === 0
            ? <p className="text-[12.5px] text-[#857e78]">No wallets in it now.</p>
            : <DonutList items={items} currency={donutCurrency} />}
        </div>
      </Module>
      <ArchivedList archived={archived} onOpen={(uuid) => onOpen(uuid, "insights")} />
    </div>
  );
}

/** Where its wallets come from: the bank (its consent, its last read) or the chain. */
function sourceFigure(account: Account, link: BankLink | undefined, linksPending: boolean): PageFigure {
  if (account.tradingAccountUuid) return { label: "Source", value: "On-chain address", sub: account.institution ?? undefined };
  if (!account.bankLinkUuid) return { label: "Source", value: account.institution ?? "—" };
  if (!link) return { label: "Bank", value: account.institution ?? (linksPending ? "…" : "—") };
  const read = link.lastSyncedAt ? `read ${dayLabel(link.lastSyncedAt.slice(0, 10))}` : "not read yet";
  return { label: "Bank", value: link.bankName, sub: link.status === "active" ? read : "consent ended: renew it on Banks", tone: link.status === "active" ? undefined : "loss" };
}
