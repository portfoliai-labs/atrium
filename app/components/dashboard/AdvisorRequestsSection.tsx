"use client";

import { useState } from "react";
import { AlertCircle, Check, ClipboardList, Inbox, Loader2, X } from "lucide-react";
import { advisorRequestService } from "../../services/advisorRequestService";
import { ApiError } from "../../services/apiClient";
import { useClients, useClientsQuery, useClientsRead } from "../../context/ClientsContext";
import { policySections } from "../../lib/ips";
import type { AdvisorRequest, AdvisorRequestStatus } from "../../models/AdvisorRequest";
import type { InvestorPolicy } from "../../models/InvestorPolicy";
import { TextArea } from "./ips/fields";

const SERIF = { fontFamily: "'Playfair Display', Georgia, serif" };
const CARD_CLASS = "bg-white p-6 md:p-8 rounded-4xl border border-[rgba(196,154,60,0.2)] shadow-sm";

const NO_REQUESTS: AdvisorRequest[] = [];

const STATUS_LABELS: Record<AdvisorRequestStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn by the investor",
  expired: "Expired",
};

/**
 * REQUESTS — the advisor's side of advisor matching: the investors who picked them among their
 * suggestions. Each request carries a first message and the investor's policy as they shared
 * it; accepting makes the investor a client (they then appear under Clients), declining keeps the
 * advisor out of that investor's suggestions. A request left unanswered expires after a week.
 */
export function AdvisorRequestsSection() {
  const query = useClientsQuery(["requests", "incoming"], () => advisorRequestService.getIncomingRequests());
  // Read again after an answer, with the clients (an accepted investor is one now).
  const { reload } = useClients();
  const [actionError, setActionError] = useState<string | null>(null);
  const [reading, setReading] = useState<AdvisorRequest | null>(null);
  const [declining, setDeclining] = useState<AdvisorRequest | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const requests = query.data ?? NO_REQUESTS;
  const loading = query.isPending;
  const error = actionError ?? (query.isError ? "We couldn't load your requests. Please try again." : null);

  const act = async (request: AdvisorRequest, action: () => Promise<unknown>) => {
    setBusy(request.requestUuid);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      console.error(err);
      setActionError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
      void reload();
    }
  };

  const pending = requests.filter((r) => r.status === "pending");
  const past = requests.filter((r) => r.status !== "pending");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-[#C49A3C]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-[#1c1917] tracking-tight flex items-center gap-2.5" style={SERIF}>
          <Inbox className="w-6 h-6 text-[#C49A3C]" />
          Requests
          {pending.length > 0 && (
            <span className="text-xs font-bold bg-[#C49A3C] text-white rounded-full px-2 py-0.5 leading-none">{pending.length}</span>
          )}
        </h2>
        <p className="text-sm text-[#78716c] mt-1">
          Investors who chose you among the advisors we suggested to them. You are suggested while your profile is verified
          and you take on new clients.
        </p>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm font-semibold text-red-700 bg-red-50 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      {pending.length === 0 ? (
        <p className={`${CARD_CLASS} text-sm text-[#78716c]`}>No requests waiting for an answer.</p>
      ) : (
        <div className="space-y-4">
          {pending.map((request) => (
            <div key={request.requestUuid} className={`${CARD_CLASS} space-y-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-[#1c1917]">{fullName(request.investor)}</p>
                <p className="text-xs text-[#78716c]">
                  Received on {formatDate(request.createdAt)} · expires on {formatDate(request.expiresAt)}
                </p>
              </div>
              <blockquote className="text-sm text-[#44403c] bg-[#F7F5EF] rounded-2xl px-4 py-3 whitespace-pre-line">
                {request.message}
              </blockquote>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setReading(request)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-[#1c1917] border border-[rgba(196,154,60,0.3)] hover:bg-[#F7F5EF] transition-colors"
                >
                  <ClipboardList className="w-4 h-4" /> Read their Investment Policy
                </button>
                <button
                  onClick={() => act(request, () => advisorRequestService.acceptRequest(request.requestUuid))}
                  disabled={busy !== null}
                  className="flex items-center gap-2 bg-[#1c1917] text-white px-4 py-2.5 rounded-2xl text-sm font-semibold hover:bg-[#292524] transition-colors disabled:opacity-40"
                >
                  {busy === request.requestUuid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Accept as client
                </button>
                <button
                  onClick={() => setDeclining(request)}
                  disabled={busy !== null}
                  className="px-4 py-2.5 rounded-2xl text-sm font-semibold text-[#78716c] hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-[#1c1917]" style={SERIF}>Answered</h3>
          {past.map((request) => (
            <div key={request.requestUuid} className="bg-white rounded-2xl border border-[rgba(196,154,60,0.15)] px-5 py-4 flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-sm text-[#1c1917]">{fullName(request.investor)}</span>
              <span className="text-xs font-semibold text-[#78716c]">
                {request.status ? STATUS_LABELS[request.status] : "—"} · {formatDate(request.closedAt ?? request.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {reading && <SharedPolicyDialog request={reading} onClose={() => setReading(null)} />}
      {declining && (
        <DeclineDialog
          request={declining}
          onClose={() => setDeclining(null)}
          onDecline={(reply) => {
            const request = declining;
            setDeclining(null);
            act(request, () => advisorRequestService.declineRequest(request.requestUuid, reply));
          }}
        />
      )}
    </div>
  );
}

/** The investor's policy as they shared it with the request, read-only. */
function SharedPolicyDialog({ request, onClose }: { request: AdvisorRequest; onClose: () => void }) {
  const policy = useClientsRead<InvestorPolicy | null>(
    ["requests", request.requestUuid, "policy"],
    () => advisorRequestService.getSharedPolicy(request.requestUuid).catch((err) => {
      console.error(err);
      return null;
    }),
  );

  return (
    <Dialog title={`${fullName(request.investor)}'s Investment Policy`} onClose={onClose} wide>
      <p className="text-xs text-[#78716c]">Version {request.investorPolicyVersion}, as shared with the request.</p>
      {policy === undefined ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#C49A3C]" /></div>
      ) : policy === null ? (
        <p className="text-sm text-[#78716c]">The policy is no longer available.</p>
      ) : (
        <div className="space-y-6">
          {policySections(policy, { currency: "EUR", riskTolerance: null }).map((section, i) => (
            <section key={section.title} className="space-y-2">
              <h3 className="font-bold text-[#1c1917]" style={SERIF}>{i + 1}. {section.title}</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-1.5 text-sm">
                {section.rows.map((row) => (
                  <div key={row.label} className="contents">
                    <dt className="text-[#78716c]">{row.label}</dt>
                    <dd className="text-[#1c1917] whitespace-pre-line">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </Dialog>
  );
}

function DeclineDialog({
  request, onClose, onDecline,
}: { request: AdvisorRequest; onClose: () => void; onDecline: (reply: string) => void }) {
  const [reply, setReply] = useState("");
  return (
    <Dialog title={`Decline ${fullName(request.investor)}`} onClose={onClose}>
      <p className="text-sm text-[#44403c]">
        You won&apos;t be suggested to this investor again. A short reply helps them find the right advisor.
      </p>
      <TextArea value={reply} onChange={setReply} maxLength={2000} placeholder="Optional: why, or who could help them." />
      <button
        onClick={() => onDecline(reply.trim())}
        className="w-full bg-red-700 text-white px-5 py-3 rounded-2xl text-sm font-semibold hover:bg-red-800 transition-colors"
      >
        Decline the request
      </button>
    </Dialog>
  );
}

function Dialog({
  title, onClose, wide = false, children,
}: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className={`relative w-full ${wide ? "max-w-3xl" : "max-w-lg"} bg-white rounded-[2rem] shadow-2xl border border-[rgba(196,154,60,0.2)] p-8 max-h-[90vh] overflow-y-auto space-y-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-[#1c1917]" style={SERIF}>{title}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#F7F5EF] text-[#78716c] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim() || "An investor";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
