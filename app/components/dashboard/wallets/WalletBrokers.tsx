// components/dashboard/wallets/WalletBrokers.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { useWalletQuery } from "../../../context/WalletsContext";
import { tradingService } from "../../../services/tradingService";
import { errorText } from "../../../lib/wallets";
import type { BrokerAccount, BrokerSessionState } from "../../../models/Trading";
import { DialogShell } from "./WalletDialogs";

// The brokers a self-hosted deployment links accounts at (forum's service map, "Brokers:
// negotiator"): Interactive Brokers, through the deployment's own IB Gateway.
export const INTERACTIVE_BROKERS = "interactive_brokers";
export const BROKERS = [{ id: INTERACTIVE_BROKERS, label: "Interactive Brokers" }];

// How often the session's state is asked while a page shows it: the watchdog looks every 30 s.
const SESSION_EVERY_MS = 30_000;

/**
 * The caller's linked broker accounts, oldest first: one read for the page and the dialog, read
 * again with the rest of the wallets after `changed()`.
 */
export function useBrokerAccounts(enabled = true) {
  return useWalletQuery(["brokerAccounts"], () => tradingService.brokerAccounts(), { enabled });
}

/** The deployment's session with the broker, asked again every 30 s while shown. */
export function useBrokerSession(broker: string, enabled = true) {
  return useQuery({
    queryKey: ["brokerSession", broker],
    queryFn: () => tradingService.brokerSession(broker),
    enabled,
    refetchInterval: SESSION_EVERY_MS,
  });
}

const SESSION_TEXT: Record<BrokerSessionState, { label: string; hint: string; tone: "gain" | "warn" | "loss" | "muted" }> = {
  connected: { label: "Connected", hint: "The session with the broker is up.", tone: "gain" },
  cut_off: { label: "Reconnecting", hint: "The broker's servers are out of reach for now; the gateway reconnects on its own.", tone: "warn" },
  recovering: { label: "Recovering", hint: "The gateway is being reconnected or restarted.", tone: "warn" },
  down: {
    label: "Down",
    hint: "The gateway is restarting or logging in. On a live account, confirm the login on the broker's app if it asks.",
    tone: "loss",
  },
  unknown: { label: "Checking…", hint: "The session's state comes in a moment.", tone: "muted" },
};

/** The session's state as a chip, its explanation on hover. */
export function SessionChip({ state }: { state: BrokerSessionState }) {
  const text = SESSION_TEXT[state];
  const colors = {
    gain: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    loss: "bg-rose-50 text-rose-600",
    muted: "bg-[#EEE9DD] text-[#78716c]",
  }[text.tone];
  return (
    <span title={text.hint} className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colors}`}>
      {text.label}
    </span>
  );
}

/** What the session's state means for the user, in a sentence. */
export const sessionHint = (state: BrokerSessionState) => SESSION_TEXT[state].hint;

/**
 * CONNECT A BROKER — as Connect a wallet: a broker (Interactive Brokers, for now), whose session
 * the deployment keeps with its own login; linking gives the user the accounts that login
 * manages, read at once so that their cash shows, each currency to link to a wallet. Nothing to
 * sign: the platform runs on the user's own deployment, logged in as them.
 */
export function ConnectBrokerDialog({ onClose, onConnected }: { onClose: () => void; onConnected: (accounts: BrokerAccount[]) => void }) {
  const [broker, setBroker] = useState(INTERACTIVE_BROKERS);
  const session = useBrokerSession(broker);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state: BrokerSessionState = session.data?.state ?? "unknown";

  const link = async () => {
    setBusy(true);
    setError(null);
    try {
      onConnected(await tradingService.linkBroker(broker));
    } catch (err) {
      setError(errorText(err, "Unable to link the broker's account."));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      icon={<Landmark className="h-5 w-5" />}
      title="Connect a broker"
      subtitle="This platform's gateway is logged in at the broker with your own login: linking makes its accounts yours here, read only for now. Its cash then shows, each currency to link to a wallet."
      busy={busy}
      error={error ?? (session.isError ? errorText(session.error, "Unable to reach the broker's session.") : null)}
      submitLabel={busy ? "Linking…" : "Link my accounts"}
      canSubmit={state === "connected" && !busy}
      onSubmit={() => void link()}
      onClose={onClose}
    >
      <label className="block space-y-1.5">
        <span className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Broker</span>
        <select
          value={broker}
          onChange={(e) => setBroker(e.target.value)}
          disabled={busy}
          className="w-full h-10 px-3 rounded-xl bg-white text-[13px] font-semibold text-slate-700 border border-slate-200 outline-none focus:border-[#C49A3C]/60"
        >
          {BROKERS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </label>
      <div className="flex items-start gap-2.5 rounded-xl bg-[#FAF8F3] border border-[#EEE9DD] px-3 py-2.5">
        <SessionChip state={state} />
        <p className="text-[12px] text-slate-600">
          {state === "connected" ? "Ready: the accounts of the gateway's login will be linked to you." : sessionHint(state)}
        </p>
      </div>
    </DialogShell>
  );
}
