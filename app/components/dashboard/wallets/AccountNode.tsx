// components/dashboard/wallets/AccountNode.tsx
"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { useWallets } from "../../../context/WalletsContext";
import { useAccounts, useCards } from "../../../hooks/useAccounts";
import { useChainHoldings, useTradingAccounts } from "../../../hooks/useChainHoldings";
import { LIQUIDITY } from "../../../lib/dashboardNav";
import { formatCurrency } from "../../../lib/format";
import { ALL_WALLETS, dayLabel, errorText, walletColor } from "../../../lib/wallets";
import { bankingService } from "../../../services/bankingService";
import { tradingService } from "../../../services/tradingService";
import type { Account } from "../../../models/Account";
import type { BankLink } from "../../../models/Banking";
import type { BrokerAccount, ChainHolding, OnchainAddress } from "../../../models/Trading";
import { Breadcrumb, type Crumb } from "../Breadcrumb";
import { ConfirmDialog } from "../ConfirmDialog";
import { PageHeader, type PageAction, type PageFigure } from "../PageHeader";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";
import {
  BankAccountRow, ConnectBankDialog, NEW_WALLET, daysLeft, linkNewWallet, renewable, syncText, useBankLinks, useSourcedWallets,
} from "./WalletBanks";
import { AddFunds, HoldingRow, SETTLE_DELAYS_MS, shortAddress, useOnchainAddresses } from "./WalletAddresses";
import { BROKERS, SessionChip, sessionHint, useBrokerAccounts, useBrokerSession } from "./WalletBrokers";
import { OnchainOrders } from "./OnchainOrders";
import { OrderDetails } from "./OrderDetails";
import { ArchivedList, type WalletPage } from "./WalletNode";

type Dialog = "renew" | "remove";

/**
 * AN ACCOUNT'S PAGE — under Cash, accounts and cards, above its wallets: a bank connected, an
 * on-chain address, or an account at a broker (its cash per currency, as an address' stablecoins,
 * and the deployment's session with the broker). Not its wallets' figures (those are each wallet's, and every wallet's
 * together): where they come from and whether they are right. Its header tells what they hold
 * together (arca's, each at today's rate in the reference currency), its source (the bank's
 * consent, renewed from here, or the chain) and its last read (read again from here). Under it,
 * the bank's accounts (or the address' stablecoins), each going into a wallet: one of the user's
 * of its currency, or a new one, then its balance checked against the bank's (or the chain's);
 * the cards of its wallets; for an address, its funding and its orders. Once its bank link or
 * address is removed, it keeps its wallets and says so.
 */
export function AccountNode({ accountUuid, rootTrail, onOpen }: {
  accountUuid: string;
  rootTrail: Crumb[];
  onOpen: (id: string, page: WalletPage) => void;
}) {
  const { wallets, loading, changed } = useWallets();
  const accounts = useAccounts();
  const account = accounts.data?.find((a) => a.uuid === accountUuid);
  const bank = !!account?.bankLinkUuid;
  const chain = !!account?.tradingAccountUuid;
  const links = useBankLinks(bank);
  const link = bank ? links.data?.find((l) => l.uuid === account!.bankLinkUuid) : undefined;
  const trading = useTradingAccounts(chain);
  const addresses = useOnchainAddresses();
  const holdings = useChainHoldings(chain);
  const tradingAccount = chain ? trading.data?.find((t) => t.uuid === account!.tradingAccountUuid) : undefined;
  const atBroker = tradingAccount?.kind === "broker_account";
  const address = tradingAccount && !atBroker ? addresses.data?.find((a) => a.uuid === tradingAccount.reference) : undefined;
  const brokerAccounts = useBrokerAccounts(atBroker);
  const brokerAccount = atBroker ? brokerAccounts.data?.find((b) => b.uuid === tradingAccount.reference) : undefined;
  const session = useBrokerSession(brokerAccount?.broker ?? "", !!brokerAccount);
  const coins = chain ? (holdings.data ?? []).filter((h) => h.tradingAccountUuid === account!.tradingAccountUuid) : [];
  const cards = useCards(!!account);
  const taken = useSourcedWallets();

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [funding, setFunding] = useState(false);
  // An order opened as its own page (the account › Order), back to the account when closed.
  const [order, setOrder] = useState<string | null>(null);

  const allCrumb: Crumb = { label: LIQUIDITY, onClick: () => onOpen(ALL_WALLETS, "insights") };
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

  if (order) {
    return (
      <div className="space-y-6 pb-12">
        <Breadcrumb trail={[...trail, { label: account.name, onClick: () => setOrder(null) }]} current="Order" />
        <OrderDetails orderUuid={order} />
      </div>
    );
  }

  const own = wallets.map((w, i) => ({ wallet: w, color: walletColor(w, i) })).filter(({ wallet }) => wallet.accountUuid === account.uuid);
  const active = own.filter(({ wallet }) => !wallet.archived);
  const archived = own.filter(({ wallet }) => wallet.archived);
  const ownCards = (cards.data ?? []).filter((c) => own.some(({ wallet }) => wallet.uuid === c.walletUuid));
  const openWallet = (uuid: string) => onOpen(uuid, "insights");

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
  const readBank = async (l: BankLink) => syncText((await bankingService.sync(l.uuid)).accounts);
  const readAddress = async (a: OnchainAddress) => {
    const { movements } = await tradingService.read(a.uuid);
    SETTLE_DELAYS_MS.forEach((ms) => setTimeout(changed, ms));
    return movements === 0 ? "Read: nothing new." : `Read: ${movements} new movement${movements === 1 ? "" : "s"}, in its wallets in a moment.`;
  };
  const readBroker = async (b: BrokerAccount) => {
    const { balancesSeen } = await tradingService.readBrokerAccount(b.uuid);
    SETTLE_DELAYS_MS.forEach((ms) => setTimeout(changed, ms));
    return balancesSeen === 0 ? "Read: nothing new." : `Read: ${balancesSeen} new balance${balancesSeen === 1 ? "" : "s"}, here in a moment.`;
  };
  const remove = async () => {
    await act("remove", async () => {
      if (link) await bankingService.remove(link.uuid);
      else if (address) await tradingService.remove(address.uuid);
      else if (brokerAccount) await tradingService.removeBrokerAccount(brokerAccount.uuid);
      setDialog(null);
    }, link ? "Unable to remove this bank." : brokerAccount ? "Unable to remove this account." : "Unable to remove this address.");
  };

  // ── What can be done with it ──
  const actions: PageAction[] = [];
  if (link) {
    if (link.status === "active") actions.push({ label: "Read now", primary: true, plus: false, onClick: () => void act("read", () => readBank(link), "Unable to read this bank now."), disabled: busy === "read" });
    if (renewable(link)) actions.push({ label: "Renew the consent", primary: link.status !== "active", plus: false, onClick: () => setDialog("renew") });
    actions.push({ label: "Remove the bank", danger: true, onClick: () => { setError(null); setDialog("remove"); } });
  } else if (address) {
    actions.push({ label: "Read now", primary: true, plus: false, onClick: () => void act("read", () => readAddress(address), "Unable to read this address now."), disabled: busy === "read" });
    actions.push({ label: funding ? "Hide Add funds" : "Add funds", onClick: () => setFunding((f) => !f) });
    actions.push({ label: "Remove the address", danger: true, onClick: () => { setError(null); setDialog("remove"); } });
  } else if (brokerAccount) {
    actions.push({ label: "Read now", primary: true, plus: false, onClick: () => void act("read", () => readBroker(brokerAccount), "Unable to read this account now."), disabled: busy === "read" });
    actions.push({ label: "Remove the account", danger: true, onClick: () => { setError(null); setDialog("remove"); } });
  }

  const figures: PageFigure[] = [
    brokerAccount ? brokerSourceFigure(brokerAccount)
      : atBroker ? { label: "Broker", value: account.institution ?? "…" }
      : sourceFigure(account, link, address, links.isPending || addresses.isPending),
    brokerAccount ? brokerReadFigure(brokerAccount) : lastReadFigure(link, address),
    { label: "Wallets", value: String(active.length), sub: archived.length ? `${archived.length} archived` : undefined },
    ...(account.holder ? [{ label: "Holder", value: account.holder }] : []),
  ].filter((f): f is PageFigure => !!f);

  const left = link ? daysLeft(link) : null;
  const badge = (
    <>
      {link && link.status !== "active" && <Chip tone="loss">Consent ended</Chip>}
      {link && link.status === "active" && left !== null && renewable(link) && <Chip tone="warn">{left <= 1 ? "Ends today" : `${left} days left`}</Chip>}
      {!bank && !chain && <Chip>Not connected</Chip>}
      {brokerAccount && <SessionChip state={session.data?.state ?? "unknown"} />}
    </>
  );
  const currencies = new Set(active.map(({ wallet }) => wallet.currency));

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow="Account"
        crumbs={trail}
        badge={badge}
        title={account.name}
        value={account.balance !== null && account.balanceCurrency ? formatCurrency(account.balance, account.balanceCurrency, 0) : "—"}
        note={account.balance === null
          ? "Its total can't be told now: an exchange rate is missing."
          : currencies.size > 1 || (account.balanceCurrency && [...currencies].some((c) => c !== account.balanceCurrency)) ? "Its wallets together, at today's rate." : undefined}
        actions={actions}
        figures={figures}
      />
      {note && <p className="text-[12.5px] font-semibold text-emerald-700">{note}</p>}
      {error && !dialog && <p className="text-[12.5px] font-semibold text-rose-600">{error}</p>}
      {funding && address && <AddFunds address={address.address} />}

      {link && (
        <Module>
          <ModuleHead
            title={`Accounts at ${link.bankName}`}
            desc="Each comes into one wallet of its currency, read twice a day: one of yours, or a new one that takes the bank's history and balance. Read only, through open banking: nothing here can move money."
          />
          <div className={MODULE_BODY}>
            {link.accounts.length === 0 ? (
              <p className="text-[12.5px] text-[#857e78]">The bank gave no account with this consent.</p>
            ) : (
              <ul className="space-y-2">
                {link.accounts.map((a) => (
                  <BankAccountRow
                    key={a.uuid}
                    link={link}
                    account={a}
                    wallets={wallets}
                    taken={taken}
                    busy={busy === a.uuid}
                    error={rowErrors[a.uuid]}
                    onOpenWallet={openWallet}
                    // Linked, it's read at once, not at the next of the twice-a-day reads.
                    onLink={(choice) => void act(a.uuid, async () => {
                      if (choice === NEW_WALLET) await linkNewWallet(link, a);
                      else await bankingService.linkAccount(a.uuid, choice);
                      return syncText((await bankingService.sync(link.uuid)).accounts.filter((s) => s.accountUuid === a.uuid));
                    }, "Unable to link this account.", true)}
                    onUnlink={() => void act(a.uuid, async () => { await bankingService.unlinkAccount(a.uuid); }, "Unable to unlink this account.", true)}
                  />
                ))}
              </ul>
            )}
          </div>
        </Module>
      )}
      {bank && !link && links.isError && <p className="text-sm font-semibold text-rose-600">{errorText(links.error, "Unable to load your banks.")}</p>}

      {brokerAccount && session.data && session.data.state !== "connected" && (
        <p className="text-[12.5px] font-semibold text-amber-700">{sessionHint(session.data.state)} Reads and orders wait for it.</p>
      )}
      {chain && atBroker && (
        <Module>
          <ModuleHead
            title="Cash"
            desc="Each currency comes into one wallet of its own, read from the broker: one of yours, or a new one named after it. Read only: nothing here can move money."
          />
          <div className={MODULE_BODY}>
            {coins.length === 0 ? (
              <p className="text-[12.5px] text-[#857e78]">{brokerAccount?.readAt ? "No cash read yet." : "Its cash shows here after its first read."}</p>
            ) : (
              <ul className="space-y-2">
                {coins.map((h: ChainHolding) => (
                  <HoldingRow
                    key={h.uuid}
                    holding={h}
                    wallets={wallets}
                    taken={taken}
                    busy={busy === h.uuid}
                    error={rowErrors[h.uuid]}
                    source="the broker"
                    onOpenWallet={openWallet}
                    onLink={(walletUuid) => void act(h.uuid, async () => { await tradingService.linkHolding(h.uuid, walletUuid); }, "Unable to link this currency.", true)}
                    onUnlink={() => void act(h.uuid, async () => { await tradingService.unlinkHolding(h.uuid); }, "Unable to unlink this currency.", true)}
                  />
                ))}
              </ul>
            )}
          </div>
        </Module>
      )}
      {chain && !atBroker && (
        <Module>
          <ModuleHead
            title="Stablecoins"
            desc="Each comes into one wallet of its currency, read from the chain: one of yours, or a new one named after it. Your keys stay in your wallet: nothing here can move money."
          />
          <div className={MODULE_BODY}>
            {coins.length === 0 ? (
              <p className="text-[12.5px] text-[#857e78]">{address?.readAt ? "No stablecoin read yet." : "Its stablecoins show here after its first read."}</p>
            ) : (
              <ul className="space-y-2">
                {coins.map((h: ChainHolding) => (
                  <HoldingRow
                    key={h.uuid}
                    holding={h}
                    wallets={wallets}
                    taken={taken}
                    busy={busy === h.uuid}
                    error={rowErrors[h.uuid]}
                    onOpenWallet={openWallet}
                    onLink={(walletUuid) => void act(h.uuid, async () => { await tradingService.linkHolding(h.uuid, walletUuid); }, "Unable to link this stablecoin.", true)}
                    onUnlink={() => void act(h.uuid, async () => { await tradingService.unlinkHolding(h.uuid); }, "Unable to unlink this stablecoin.", true)}
                  />
                ))}
              </ul>
            )}
          </div>
        </Module>
      )}
      {tradingAccount && !atBroker && <OnchainOrders accounts={[tradingAccount]} onOpen={setOrder} />}

      {/* Detached (its link or address removed): its wallets, each to open. */}
      {!bank && !chain && (
        <Module>
          <ModuleHead title="Wallets" desc="No longer connected: its wallets keep their movements, added by hand or from a statement from now on." />
          <div className={MODULE_BODY}>
            {active.length === 0 ? <p className="text-[12.5px] text-[#857e78]">No wallets in it now.</p> : (
              <ul className="divide-y divide-[#EEE9DD]">
                {active.map(({ wallet, color }) => (
                  <li key={wallet.uuid}>
                    <button type="button" onClick={() => openWallet(wallet.uuid)} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-[#F7F5EF] rounded-lg px-2 transition-colors">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
                      <span className="flex-1 min-w-0 text-[13px] font-bold text-slate-700 truncate">{wallet.name}</span>
                      <span className="text-[13px] font-bold tabular-nums text-slate-600">{formatCurrency(wallet.balance, wallet.currency, 0)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Module>
      )}

      {ownCards.length > 0 && (
        <Module>
          <ModuleHead title="Cards" desc="The cards of its wallets: open one's wallet for its cards." />
          <div className={MODULE_BODY}>
            <ul className="divide-y divide-[#EEE9DD]">
              {ownCards.map((c) => {
                const wallet = own.find(({ wallet: w }) => w.uuid === c.walletUuid)?.wallet;
                return (
                  <li key={c.uuid}>
                    <button type="button" onClick={() => onOpen(c.walletUuid, "cards")} className="w-full flex items-center gap-3 py-2.5 px-2 rounded-lg text-left hover:bg-[#F7F5EF] transition-colors">
                      <CreditCard className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-bold text-slate-700 truncate">{c.name ?? `•••• ${c.lastDigits}`}</span>
                        <span className="block text-[11px] text-slate-500 capitalize">{[c.kind, c.network, `•••• ${c.lastDigits}`, wallet?.name].filter(Boolean).join(" · ")}</span>
                      </span>
                      {c.expired && <Chip tone="loss">Expired</Chip>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </Module>
      )}

      <ArchivedList archived={archived} onOpen={openWallet} />

      {dialog === "renew" && link && <ConnectBankDialog renew={link} onClose={() => setDialog(null)} />}
      {dialog === "remove" && (
        <ConfirmDialog
          title={link ? `Remove ${link.bankName}?` : brokerAccount ? `Remove ${account.name}?` : `Remove Solana ${address ? shortAddress(address.address) : ""}?`}
          description={link
            ? "The consent at the bank ends, and its accounts stop coming into their wallets. The account and its wallets stay, with the movements already there."
            : brokerAccount
              ? "It is no longer read here. Its portfolio, this account and its wallets stay, with their history; the account at the broker is untouched."
              : "Its movements stop coming in. Its portfolio, this account and its wallets stay, with their history; the wallet itself is untouched."}
          confirmLabel="Remove"
          confirming={busy === "remove"}
          error={error}
          onConfirm={() => void remove()}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

/** Where its wallets come from: the bank (its consent) or the chain (its address). */
function sourceFigure(account: Account, link: BankLink | undefined, address: OnchainAddress | undefined, pending: boolean): PageFigure {
  if (account.tradingAccountUuid) {
    return { label: "Source", value: address ? `Solana ${shortAddress(address.address)}` : pending ? "…" : "On-chain address", sub: address ? "read from the chain" : undefined };
  }
  if (!account.bankLinkUuid) return { label: "Source", value: account.institution ?? "—", sub: "no longer connected" };
  if (!link) return { label: "Bank", value: account.institution ?? (pending ? "…" : "—") };
  return {
    label: "Bank",
    value: link.bankName,
    sub: link.status === "active" && link.validUntil ? `consent until ${dayLabel(link.validUntil.slice(0, 10))}` : "consent ended: renew it",
    tone: link.status === "active" ? undefined : "loss",
  };
}

/** Where a broker account's wallets come from: the broker, by the account's id there. */
function brokerSourceFigure(b: BrokerAccount): PageFigure {
  const broker = BROKERS.find((x) => x.id === b.broker)?.label ?? b.broker;
  return { label: "Broker", value: broker, sub: `account ${b.brokerAccountId}` };
}

function brokerReadFigure(b: BrokerAccount): PageFigure {
  return { label: "Last read", value: b.readAt ? dayLabel(b.readAt.slice(0, 10)) : "Not yet", sub: "every hour, and on request" };
}

function lastReadFigure(link: BankLink | undefined, address: OnchainAddress | undefined): PageFigure | null {
  const at = link ? link.lastSyncedAt : address ? address.readAt : undefined;
  if (at === undefined) return null;
  return { label: "Last read", value: at ? dayLabel(at.slice(0, 10)) : "Not yet", sub: link ? "twice a day, and on request" : "every few minutes, and on request" };
}

function Chip({ tone, children }: { tone?: "loss" | "warn"; children: React.ReactNode }) {
  const colors = tone === "loss" ? "bg-rose-50 text-rose-600" : tone === "warn" ? "bg-amber-50 text-amber-700" : "bg-[#EEE9DD] text-[#78716c]";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colors}`}>{children}</span>;
}
