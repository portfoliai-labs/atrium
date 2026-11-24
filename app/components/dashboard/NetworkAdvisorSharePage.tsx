"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Globe, Info, Loader2, Save } from "lucide-react";
import { advisorRequestService } from "../../services/advisorRequestService";
import { ApiError } from "../../services/apiClient";
import { clientsKey, useClientsQuery } from "../../context/ClientsContext";
import { usePortfolio } from "../../context/PortfolioContext";
import {
  formatDay, formatMoment, networkAdvisorName, shareStateLine, snapshotErrorMessage,
} from "../../lib/clientSnapshots";
import type { NetworkAdvisor, SnapshotShare } from "../../models/ClientSnapshot";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { ConfirmDialog } from "./ConfirmDialog";

const SERIF = { fontFamily: "'Playfair Display', Georgia, serif" };
const CARD_CLASS = "bg-white p-6 md:p-8 rounded-4xl border border-[rgba(196,154,60,0.2)] shadow-sm";

/** The investor's network advisors, with what they share with each: one read for Find an advisor and this page. */
export const NETWORK_ADVISORS_KEY = ["network-advisors"];
export function useNetworkAdvisors() {
  return useClientsQuery(NETWORK_ADVISORS_KEY, () => advisorRequestService.getMyNetworkAdvisors());
}

/**
 * SHARE PORTFOLIOS WITH A NETWORK ADVISOR — Find an advisor's page for one network advisor who
 * accepted the investor: which of the investor's standard portfolios they receive (none until the
 * investor picks some; All portfolios and backtests can't be), how the sharing stands, and the
 * relation's end. The advisor receives an encrypted copy of the picked portfolios with their whole
 * transaction history, updated at most once a day; stopping deletes the shared file, though the
 * advisor may have kept the last copy.
 */
export function NetworkAdvisorSharePage({ advisorPubkey, trail, onBack }: {
  advisorPubkey: string;
  // The crumbs above it (Find an advisor).
  trail: Crumb[];
  onBack: () => void;
}) {
  const query = useNetworkAdvisors();
  const advisor = query.data?.find((a) => a.advisorPubkey === advisorPubkey || a.npub === advisorPubkey);

  if (query.isPending) {
    return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-[#C49A3C]" /></div>;
  }
  if (!advisor) {
    return (
      <div className="space-y-6">
        <Breadcrumb trail={trail} current="Share portfolios" />
        <div className={`${CARD_CLASS} space-y-4`}>
          <p className="text-sm text-[#44403c]">
            {query.isError
              ? "We couldn't load your advisors. Please try again."
              : "This advisor is no longer yours: the relation was ended."}
          </p>
          <button type="button" onClick={onBack} className="text-sm font-semibold text-[#C49A3C] hover:underline">Back to your advisors</button>
        </div>
      </div>
    );
  }
  return <SharePage key={advisor.advisorPubkey} advisor={advisor} trail={trail} onBack={onBack} />;
}

function SharePage({ advisor, trail, onBack }: { advisor: NetworkAdvisor; trail: Crumb[]; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { portfolios, loading: portfoliosLoading } = usePortfolio();
  // The investor's own standard portfolios: All portfolios, backtests and anything imported never.
  const shareable = useMemo(() => portfolios.filter((p) => !p.isVirtual && !p.imported), [portfolios]);
  const share = advisor.share;
  const sharing = share !== null && !share.ending;
  const initial = useMemo(() => (sharing ? share.portfolioUuids : []), [sharing, share]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dialog, setDialog] = useState<"stop" | "end" | null>(null);
  const name = networkAdvisorName(advisor);

  const changed = picked.size !== initial.length || initial.some((uuid) => !picked.has(uuid));
  const reload = () => queryClient.invalidateQueries({ queryKey: clientsKey() });

  const toggle = (uuid: string) => {
    setSaved(false);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // In the list's order.
      const uuids = shareable.filter((p) => picked.has(p.uuid)).map((p) => p.uuid);
      const next = await advisorRequestService.setShare(advisor.advisorPubkey, uuids);
      queryClient.setQueryData<NetworkAdvisor[]>(
        clientsKey(...NETWORK_ADVISORS_KEY),
        (prev) => prev?.map((a) => (a.advisorPubkey === advisor.advisorPubkey ? { ...a, share: next } : a)),
      );
      setSaved(true);
    } catch (err) {
      console.error(err);
      setError(snapshotErrorMessage(err, "We couldn't save what you share. Please try again."));
      // The relation ended meanwhile: the page says so.
      if (err instanceof ApiError && err.errorType === "NotYourNetworkAdvisorError") void reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Breadcrumb trail={trail} current={`Share portfolios with ${name}`} />

      <div className={`${CARD_CLASS} space-y-4`}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 shrink-0 rounded-2xl bg-[#C49A3C]/15 text-[#C49A3C] flex items-center justify-center">
            <Globe className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[#1c1917] truncate" style={SERIF} title={advisor.npub}>
              Share portfolios with {name}
            </h2>
            <p className="text-xs text-[#78716c]">Network advisor · accepted your request on {formatDay(advisor.acceptedAt)}</p>
          </div>
        </div>
        <p className="flex items-start gap-2.5 rounded-xl bg-[#C49A3C]/10 border border-[#C49A3C]/30 px-4 py-3 text-[13px] text-[#8A6A28]">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {name} receives an encrypted copy of the portfolios you pick, with their full transaction history, updated at most
            once a day after a change. They read it and change nothing. Stopping deletes the shared file, but the advisor may
            have kept the last copy.
          </span>
        </p>
        <ShareStatus share={share} />
      </div>

      <div className={`${CARD_CLASS} space-y-4`}>
        <div>
          <h3 className="text-lg font-bold text-[#1c1917]" style={SERIF}>Your portfolios</h3>
          <p className="text-xs text-[#78716c] mt-0.5">Pick the ones to share. All portfolios and backtests can&apos;t be shared.</p>
        </div>
        {portfoliosLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-[#C49A3C]" /></div>
        ) : shareable.length === 0 ? (
          <p className="text-sm text-[#78716c]">You have no portfolio to share yet.</p>
        ) : (
          <ul className="divide-y divide-[#EEE9DD] border-y border-[#EEE9DD]">
            {shareable.map((p) => (
              <li key={p.uuid}>
                <label className="flex items-center gap-3 py-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={picked.has(p.uuid)}
                    onChange={() => toggle(p.uuid)}
                    disabled={saving}
                    className="accent-[#C49A3C] w-4 h-4"
                  />
                  <span className="text-sm font-semibold text-[#1c1917]">{p.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="flex items-center gap-2 text-sm font-semibold text-red-700 bg-red-50 rounded-2xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}
        {saved && !changed && !error && (
          <p className="text-sm font-semibold text-emerald-700">Saved: the copy goes out within a day.</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {share && !share.ending && (
              <button
                type="button"
                onClick={() => setDialog("stop")}
                disabled={saving}
                className="text-sm font-semibold text-[#78716c] hover:text-red-700 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Stop sharing
              </button>
            )}
            <button
              type="button"
              onClick={() => setDialog("end")}
              disabled={saving}
              className="text-sm font-semibold text-[#78716c] hover:text-red-700 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              End relation
            </button>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving || picked.size === 0 || !changed}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {dialog === "stop" && (
        <StopSharingDialog advisor={advisor} onClose={() => setDialog(null)} onDone={() => { setDialog(null); void reload(); }} />
      )}
      {dialog === "end" && (
        <EndNetworkAdvisorDialog advisor={advisor} onClose={() => setDialog(null)} onEnded={() => { setDialog(null); void reload(); onBack(); }} />
      )}
    </div>
  );
}

function ShareStatus({ share }: { share: SnapshotShare | null }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="sm:col-span-3 text-sm font-semibold text-[#1c1917]">{shareStateLine(share)}</div>
      {share && (
        <>
          <StatusCell label="Last sent" value={share.lastSentAt ? formatMoment(share.lastSentAt) : "Not yet"} />
          <StatusCell label="Pending" value={share.pending ? "Yes, within a day" : "No"} />
          <StatusCell label="Ending" value={share.ending ? "Yes" : "No"} />
          {share.lastError && (
            <p className="sm:col-span-3 flex items-start gap-2 text-xs font-semibold text-red-700 bg-red-50 rounded-xl px-3.5 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> The last attempt failed: {share.lastError}. It&apos;s tried again.
            </p>
          )}
        </>
      )}
    </dl>
  );
}

function StatusCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3.5 py-2.5">
      <dt className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function StopSharingDialog({ advisor, onClose, onDone }: { advisor: NetworkAdvisor; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = networkAdvisorName(advisor);
  const stop = async () => {
    setBusy(true);
    setError(null);
    try {
      await advisorRequestService.stopShare(advisor.advisorPubkey);
      onDone();
    } catch (err) {
      setError(snapshotErrorMessage(err, "We couldn't stop sharing. Please try again."));
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog
      title={`Stop sharing with ${name}?`}
      description={`${name} is told, and the shared file deleted. They may have kept the last copy they received.`}
      confirmLabel="Stop sharing"
      confirming={busy}
      error={error}
      onConfirm={stop}
      onClose={onClose}
    />
  );
}

/** Ends the relation with a network advisor, asking first: sharing stops with it. */
export function EndNetworkAdvisorDialog({ advisor, onClose, onEnded }: { advisor: NetworkAdvisor; onClose: () => void; onEnded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = networkAdvisorName(advisor);
  const end = async () => {
    setBusy(true);
    setError(null);
    try {
      await advisorRequestService.endNetworkAdvisor(advisor.advisorPubkey);
      onEnded();
    } catch (err) {
      setError(snapshotErrorMessage(err, "We couldn't end it. Please try again."));
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog
      title={`End with ${name}?`}
      description={`${name} will no longer be your advisor. If you share portfolios with them, sharing stops and the shared file is deleted (they may have kept the last copy). You can ask them again later.`}
      confirmLabel="End relation"
      confirming={busy}
      error={error}
      onConfirm={end}
      onClose={onClose}
    />
  );
}
