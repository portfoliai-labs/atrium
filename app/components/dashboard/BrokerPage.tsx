// components/dashboard/BrokerPage.tsx
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useWallets } from "../../context/WalletsContext";
import { useAccounts } from "../../hooks/useAccounts";
import { useChainHoldings, useTradingAccounts } from "../../hooks/useChainHoldings";
import { WALLETS_SECTION, useOpenDashboardPage } from "../../lib/dashboardNav";
import { accountView, dayLabel, errorText } from "../../lib/wallets";
import { tradingService } from "../../services/tradingService";
import type { Portfolio } from "../../models/Portfolio";
import type { ChainHolding } from "../../models/Trading";
import type { Crumb } from "./Breadcrumb";
import { ConfirmDialog } from "./ConfirmDialog";
import { PageHeader, type PageAction, type PageFigure } from "./PageHeader";
import { MODULE_BODY, Module, ModuleHead } from "./PerformanceSection";
import { HoldingRow, SETTLE_DELAYS_MS } from "./wallets/WalletAddresses";
import { useSourcedWallets } from "./wallets/WalletBanks";
import { BROKERS, SessionChip, sessionHint, useBrokerAccounts, useBrokerSession } from "./wallets/WalletBrokers";

/**
 * A BROKER'S ACCOUNT — a portfolio's page (Investments › the portfolio › Broker) when the portfolio
 * holds an account at a broker (forum's service map, "Brokers: negotiator"): the deployment's
 * session with the broker, the account (its id there, its last read, read again from here or
 * removed), and its cash per currency, each going into a wallet of the user's (its account's
 * wallets are under Wallets, opened from here). Its positions are the portfolio itself.
 */
export function BrokerPage({ portfolio, trail, onRemoved }: {
  portfolio: Portfolio;
  trail: Crumb[];
  onRemoved: () => void;
}) {
  const { wallets, changed } = useWallets();
  const openPage = useOpenDashboardPage();
  const trading = useTradingAccounts();
  const tradingAccount = trading.data?.find((t) => t.uuid === portfolio.tradingAccountUuid);
  const brokerAccounts = useBrokerAccounts(!!tradingAccount);
  const brokerAccount = brokerAccounts.data?.find((b) => b.uuid === tradingAccount?.reference);
  const session = useBrokerSession(brokerAccount?.broker ?? "", !!brokerAccount);
  const holdings = useChainHoldings(!!tradingAccount);
  const cash = (holdings.data ?? []).filter((h) => h.tradingAccountUuid === portfolio.tradingAccountUuid);
  const accounts = useAccounts();
  const account = accounts.data?.find((a) => a.tradingAccountUuid === portfolio.tradingAccountUuid);
  const taken = useSourcedWallets();

  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState(false);

  if (trading.isPending || brokerAccounts.isPending) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 text-[#C49A3C] animate-spin" /></div>;
  }
  if (!brokerAccount) {
    return (
      <div className="space-y-6 pb-12">
        <PageHeader eyebrow="Portfolio" crumbs={trail} title="Broker" />
        <p className="text-[12.5px] font-semibold text-[#857e78]">
          This portfolio isn&apos;t linked to an account at a broker any more: it keeps its history.
        </p>
      </div>
    );
  }

  // One change; a row's (`row`) error goes under it, the page's under the header.
  const act = async (key: string, action: () => Promise<string | void>, fallback: string, row = false) => {
    setBusy(key);
    setError(null);
    setRowErrors((e) => ({ ...e, [key]: "" }));
    try {
      const said = await action();
      if (said) setNote(said);
      changed();
    } catch (err) {
      if (row) setRowErrors((e) => ({ ...e, [key]: errorText(err, fallback) }));
      else setError(errorText(err, fallback));
    } finally {
      setBusy(null);
    }
  };
  const read = async () => {
    const { balancesSeen } = await tradingService.readBrokerAccount(brokerAccount.uuid);
    SETTLE_DELAYS_MS.forEach((ms) => setTimeout(changed, ms));
    return balancesSeen === 0 ? "Read: nothing new." : `Read: ${balancesSeen} new balance${balancesSeen === 1 ? "" : "s"}, here in a moment.`;
  };
  const remove = () => void act("remove", async () => {
    await tradingService.removeBrokerAccount(brokerAccount.uuid);
    setRemoving(false);
    onRemoved();
  }, "Unable to remove this account.");

  const broker = BROKERS.find((b) => b.id === brokerAccount.broker)?.label ?? brokerAccount.broker;
  const state = session.data?.state ?? "unknown";
  const actions: PageAction[] = [
    { label: "Read now", primary: true, plus: false, onClick: () => void act("read", read, "Unable to read this account now."), disabled: busy === "read" },
    ...(account && openPage ? [{ label: "Its wallets", onClick: () => openPage(WALLETS_SECTION, { id: accountView(account.uuid), page: "insights" }) }] : []),
    { label: "Remove the account", danger: true, onClick: () => { setError(null); setRemoving(true); } },
  ];
  const figures: PageFigure[] = [
    { label: "Broker", value: broker, sub: `account ${brokerAccount.brokerAccountId}` },
    { label: "Last read", value: brokerAccount.readAt ? dayLabel(brokerAccount.readAt.slice(0, 10)) : "Not yet", sub: "every hour, and on request" },
    { label: "Linked", value: dayLabel(brokerAccount.linkedAt.slice(0, 10)) },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow="Portfolio"
        crumbs={trail}
        badge={<SessionChip state={state} />}
        title="Broker"
        value={broker}
        actions={actions}
        figures={figures}
      />
      {state !== "connected" && state !== "unknown" && (
        <p className="text-[12.5px] font-semibold text-amber-700">{sessionHint(state)} Reads and orders wait for it.</p>
      )}
      {note && <p className="text-[12.5px] font-semibold text-emerald-700">{note}</p>}
      {error && !removing && <p className="text-[12.5px] font-semibold text-rose-600">{error}</p>}

      <Module>
        <ModuleHead
          title="Cash"
          desc="Each currency comes into one wallet of its own, read from the broker: one of yours, or a new one named after it. Read only: nothing here can move money."
        />
        <div className={MODULE_BODY}>
          {cash.length === 0 ? (
            <p className="text-[12.5px] text-[#857e78]">{brokerAccount.readAt ? "No cash read yet." : "Its cash shows here after its first read."}</p>
          ) : (
            <ul className="space-y-2">
              {cash.map((h: ChainHolding) => (
                <HoldingRow
                  key={h.uuid}
                  holding={h}
                  wallets={wallets}
                  taken={taken}
                  busy={busy === h.uuid}
                  error={rowErrors[h.uuid]}
                  source="the broker"
                  onOpenWallet={(uuid) => openPage?.(WALLETS_SECTION, { id: uuid, page: "insights" })}
                  onLink={(walletUuid) => void act(h.uuid, async () => { await tradingService.linkHolding(h.uuid, walletUuid); }, "Unable to link this currency.", true)}
                  onUnlink={() => void act(h.uuid, async () => { await tradingService.unlinkHolding(h.uuid); }, "Unable to unlink this currency.", true)}
                />
              ))}
            </ul>
          )}
        </div>
      </Module>

      {removing && (
        <ConfirmDialog
          title={`Remove ${portfolio.name}?`}
          description="It is no longer read here. This portfolio, its account and its wallets stay, with their history; the account at the broker is untouched."
          confirmLabel="Remove"
          confirming={busy === "remove"}
          error={error}
          onConfirm={remove}
          onClose={() => setRemoving(false)}
        />
      )}
    </div>
  );
}
