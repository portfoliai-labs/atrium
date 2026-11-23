"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle, BadgeCheck, Check, ClipboardList, Clock, Handshake, Loader2, Send, X,
} from "lucide-react";
import { advisorRequestService } from "../../services/advisorRequestService";
import { ApiError } from "../../services/apiClient";
import { clientsKey, useClientsQuery } from "../../context/ClientsContext";
import {
  ASSET_CLASS_OPTIONS, FEE_OPTIONS, HORIZON_OPTIONS, INSTRUMENT_OPTIONS, LANGUAGE_OPTIONS, PURPOSE_OPTIONS, REVIEW_OPTIONS,
  RISK_PROFILE_OPTIONS, TOPIC_OPTIONS, type Option,
} from "../../lib/ips";
import type { IpsPurpose, IpsReviewFrequency } from "../../models/InvestorPolicy";
import type { AdvisorCard, AdvisorMatch, AdvisorRequest, AdvisorRequestStatus, MatchReasons } from "../../models/AdvisorRequest";
import { TextArea } from "./ips/fields";
import { ConfirmDialog } from "./ConfirmDialog";

const SERIF = { fontFamily: "'Playfair Display', Georgia, serif" };
const CARD_CLASS = "bg-white p-6 md:p-8 rounded-4xl border border-[rgba(196,154,60,0.2)] shadow-sm";

const NO_REQUESTS: AdvisorRequest[] = [];
const NO_MATCHES: AdvisorMatch[] = [];
const NO_ADVISORS: AdvisorCard[] = [];

const STATUS_LABELS: Record<AdvisorRequestStatus, string> = {
  pending: "Waiting for an answer",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

/**
 * FIND AN ADVISOR — the investor's side of advisor matching. The platform suggests up to three
 * verified advisors from what the investor said they look for (the last step of their Investment
 * Policy), with the reasons; the investor asks one of them, with a first message and their
 * consent to share the policy. One request is pending at a time; the advisor accepts or declines,
 * and an unanswered request expires after a week. An advisor who accepted reads the investor's
 * data (never changes it) until the investor ends it, from "Your advisor" at the top.
 */
// `onOpenPolicy`: where the Investment Policy is filled in (Profile's).
export function AdvisorMatchSection({ onOpenPolicy }: { onOpenPolicy: () => void }) {
  const [asking, setAsking] = useState<AdvisorCard | null>(null);
  const [ending, setEnding] = useState<AdvisorCard | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // The investor's advisors, their requests and their suggested advisors (null: no policy to match
  // on yet), read together; again after a request, and after a save of the policy (useInvestorPolicy).
  const query = useClientsQuery(["matches"], async () => {
    const [advisors, mine, found] = await Promise.all([
      advisorRequestService.getMyAdvisors(),
      advisorRequestService.getMyRequests(),
      advisorRequestService.getMatches().catch((err: unknown) => {
        if (err instanceof ApiError && err.errorType === "InvestorPolicyRequiredError") return null;
        throw err;
      }),
    ]);
    return { advisors, requests: mine, matches: found };
  });
  const queryClient = useQueryClient();
  const reload = () => { void queryClient.invalidateQueries({ queryKey: clientsKey("matches") }); };

  const loading = query.isPending;
  const advisors = query.data?.advisors ?? NO_ADVISORS;
  const requests = query.data?.requests ?? NO_REQUESTS;
  const matches = query.data?.matches ?? NO_MATCHES;
  const needsPolicy = query.data?.matches === null;
  const error = actionError ?? (query.isError ? "We couldn't load your advisors. Please try again." : null);

  const pending = requests.find((r) => r.status === "pending") ?? null;
  // An accepted request is past once its advisor no longer is the investor's (it was ended).
  const current = new Set(advisors.map((a) => a.advisorUuid));
  const past = requests.filter((r) => r !== pending && !(r.status === "accepted" && current.has(r.advisor.advisorUuid)));

  const withdraw = async (request: AdvisorRequest) => {
    setActionError(null);
    try {
      await advisorRequestService.withdrawRequest(request.requestUuid);
    } catch (err) {
      console.error(err);
      setActionError(err instanceof ApiError ? err.message : "We couldn't withdraw the request.");
    }
    reload();
  };

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
          <Handshake className="w-6 h-6 text-[#C49A3C]" />
          Find an advisor
        </h2>
        <p className="text-sm text-[#78716c] mt-1">
          Advisors registered on the OCF register and verified by us, matched on what you look for in your Investment Policy.
        </p>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm font-semibold text-red-700 bg-red-50 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      {advisors.length > 0 && (
        <div className={`${CARD_CLASS} space-y-4`}>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
            <Check className="w-4 h-4" /> {advisors.length === 1 ? "Your advisor" : "Your advisors"}
          </p>
          <ul className="space-y-4">
            {advisors.map((advisor) => (
              <li key={advisor.advisorUuid} className="flex flex-wrap items-center justify-between gap-3">
                <AdvisorHeader advisor={advisor} />
                <button
                  onClick={() => { setActionError(null); setEnding(advisor); }}
                  className="text-sm font-semibold text-[#78716c] hover:text-red-700 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors"
                >
                  End
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[#78716c]">
            {advisors.length === 1 ? "Your advisor sees" : "Your advisors see"} your data to advise you; only you change it.
          </p>
        </div>
      )}

      {pending && (
        <div className={`${CARD_CLASS} space-y-4`}>
          <p className="text-xs font-bold uppercase tracking-wider text-[#C49A3C] flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Your request
          </p>
          <AdvisorHeader advisor={pending.advisor} />
          <AdvisorOffer advisor={pending.advisor} />
          <blockquote className="text-sm text-[#44403c] bg-[#F7F5EF] rounded-2xl px-4 py-3 whitespace-pre-line">
            {pending.message}
          </blockquote>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#78716c]">
              Sent on {formatDate(pending.createdAt)} with your Investment Policy (version {pending.investorPolicyVersion}).
              {" "}It expires on {formatDate(pending.expiresAt)} if unanswered.
            </p>
            <button
              onClick={() => withdraw(pending)}
              className="text-sm font-semibold text-[#78716c] hover:text-red-700 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors"
            >
              Withdraw
            </button>
          </div>
        </div>
      )}

      {needsPolicy ? (
        <div className={`${CARD_CLASS} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
          <div>
            <p className="font-semibold text-[#1c1917]">Fill in your Investment Policy first</p>
            <p className="text-sm text-[#78716c] mt-1">
              We match advisors on your objectives and on what you look for in an advisor (its last step).
            </p>
          </div>
          <button
            onClick={onOpenPolicy}
            className="flex items-center gap-2 bg-[#1c1917] text-white px-5 py-3 rounded-2xl text-sm font-semibold hover:bg-[#292524] transition-colors shrink-0"
          >
            <ClipboardList className="w-4 h-4" /> Fill it in
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[#1c1917]" style={SERIF}>Suggested for you</h3>
            <p className="text-xs text-[#78716c] mt-0.5">The closest to your whole Investment Policy first.</p>
          </div>
          {matches.length === 0 ? (
            <p className={`${CARD_CLASS} text-sm text-[#78716c]`}>
              No advisor matches what you look for yet. Try widening the languages, meetings or fees in the last step of your
              Investment Policy, or come back later: new advisors join every week. An advisor isn&apos;t suggested when they
              don&apos;t manage a class you put 10% or more in, handle none of the instruments you allow, follow risk profiles
              at the opposite end of yours, or review less often than you ask.
            </p>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {matches.map((match) => (
                <MatchCard
                  key={match.advisor.advisorUuid}
                  match={match}
                  disabled={pending !== null}
                  onAsk={() => setAsking(match.advisor)}
                />
              ))}
            </div>
          )}
          {pending && matches.length > 0 && (
            <p className="text-xs text-[#78716c]">You can ask another advisor once your request is answered or withdrawn.</p>
          )}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-[#1c1917]" style={SERIF}>Past requests</h3>
          {past.map((request) => (
            <div key={request.requestUuid} className="bg-white rounded-2xl border border-[rgba(196,154,60,0.15)] px-5 py-4 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-sm text-[#1c1917]">{fullName(request.advisor)}</span>
                <span className="text-xs font-semibold text-[#78716c]">
                  {request.status ? STATUS_LABELS[request.status] : "—"} · {formatDate(request.closedAt ?? request.createdAt)}
                </span>
              </div>
              {request.reply && <p className="text-sm text-[#44403c] whitespace-pre-line">“{request.reply}”</p>}
            </div>
          ))}
        </div>
      )}

      {ending && <EndAdvisorDialog advisor={ending} onClose={() => setEnding(null)} onEnded={() => { setEnding(null); reload(); }} />}

      {asking && (
        <RequestDialog
          advisor={asking}
          onClose={() => setAsking(null)}
          onSent={() => { setAsking(null); reload(); }}
        />
      )}
    </div>
  );
}

/** Ends the relation with one of the investor's advisors, asking first. */
function EndAdvisorDialog({ advisor, onClose, onEnded }: { advisor: AdvisorCard; onClose: () => void; onEnded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = async () => {
    setBusy(true);
    setError(null);
    try {
      await advisorRequestService.endAdvisor(advisor.advisorUuid);
      onEnded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't end it. Please try again.");
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog
      title={`End with ${fullName(advisor)}?`}
      description={`${fullName(advisor)} will no longer be your advisor, and will no longer see your data.`}
      confirmLabel="End"
      confirming={busy}
      error={error}
      onConfirm={end}
      onClose={onClose}
    />
  );
}

function MatchCard({ match, disabled, onAsk }: { match: AdvisorMatch; disabled: boolean; onAsk: () => void }) {
  const { advisor, reasons } = match;
  return (
    <div className={`${CARD_CLASS} flex flex-col gap-5`}>
      <AdvisorHeader advisor={advisor} />
      {advisor.bio && <p className="text-sm text-[#44403c] line-clamp-5 whitespace-pre-line">{advisor.bio}</p>}
      <ul className="space-y-2">
        {reasonLines(reasons, advisor).map((line) => (
          <li key={line} className="flex items-start gap-2 text-sm text-[#1c1917]">
            <Check className="w-4 h-4 text-[#C49A3C] mt-0.5 shrink-0" /> {line}
          </li>
        ))}
      </ul>
      <AdvisorOffer advisor={advisor} />
      <button
        onClick={onAsk}
        disabled={disabled}
        className="mt-auto flex items-center justify-center gap-2 bg-[#1c1917] text-white px-5 py-3 rounded-2xl text-sm font-semibold hover:bg-[#292524] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Send className="w-4 h-4" /> Ask {advisor.firstName || "this advisor"}
      </button>
    </div>
  );
}

function AdvisorHeader({ advisor }: { advisor: AdvisorCard }) {
  const details = [
    advisor.specialization,
    advisor.yearsExperience != null ? `${advisor.yearsExperience} years of experience` : null,
  ].filter(Boolean);
  return (
    <div className="flex items-center gap-4">
      {advisor.profilePicture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={advisor.profilePicture} alt="" className="w-14 h-14 rounded-2xl object-cover" />
      ) : (
        <div className="w-14 h-14 rounded-2xl bg-[#C49A3C]/15 text-[#C49A3C] flex items-center justify-center font-bold text-lg">
          {(advisor.firstName[0] ?? "") + (advisor.lastName[0] ?? "")}
        </div>
      )}
      <div className="min-w-0">
        <p className="font-bold text-[#1c1917] truncate">{fullName(advisor)}</p>
        {details.length > 0 && <p className="text-sm text-[#78716c] truncate">{details.join(" · ")}</p>}
        <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1 mt-0.5">
          <BadgeCheck className="w-3.5 h-3.5" /> OCF register no. {advisor.registerNumber}
        </p>
      </div>
    </div>
  );
}

function RequestDialog({ advisor, onClose, onSent }: { advisor: AdvisorCard; onClose: () => void; onSent: () => void }) {
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await advisorRequestService.createRequest({
        advisorUuid: advisor.advisorUuid, message: message.trim(), shareInvestorPolicy: consent,
      });
      onSent();
    } catch (err) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "We couldn't send your request.");
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border border-[rgba(196,154,60,0.2)] p-8 max-h-[90vh] overflow-y-auto space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#1c1917]" style={SERIF}>Ask {fullName(advisor)}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#F7F5EF] text-[#78716c] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#1c1917]">Your message</p>
          <TextArea
            value={message}
            onChange={setMessage}
            maxLength={2000}
            placeholder="Introduce yourself: what you need help with, and anything the advisor should know."
          />
        </div>
        <label className="flex items-start gap-3 text-sm text-[#44403c] cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 accent-[#C49A3C]"
          />
          <span>
            I agree to share my Investment Policy with {advisor.firstName || "the advisor"}, as it is now. They will read it
            to decide whether to take me on.
          </span>
        </label>
        <p className="text-xs text-[#78716c]">
          You can chat once the advisor accepts. If they don&apos;t answer within a week, the request expires and you can ask another advisor.
        </p>
        {error && (
          <p className="flex items-center gap-2 text-sm font-semibold text-red-700 bg-red-50 rounded-2xl px-4 py-3">
            <AlertCircle className="w-4 h-4" /> {error}
          </p>
        )}
        <button
          onClick={send}
          disabled={sending || !consent || message.trim() === ""}
          className="w-full flex items-center justify-center gap-2 bg-[#1c1917] text-white px-5 py-3 rounded-2xl text-sm font-semibold hover:bg-[#292524] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send request
        </button>
      </div>
    </div>
  );
}

const label = <T extends string>(options: Option<T>[], value: T) => options.find((o) => o.value === value)?.label ?? value;
const labels = <T extends string>(options: Option<T>[], values: T[]) => values.map((v) => label(options, v));
const lower = (words: string[]) => words.map((w) => w.toLowerCase());

/** "a", "a and b", "a, b and c". */
function joinWords(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

// A purpose as what the advisor works on (the policy's labels speak as the investor).
const PURPOSE_WORK: Record<IpsPurpose, string | null> = {
  growth: "growing wealth",
  income: "generating income",
  preservation: "preserving capital",
  retirement: "funding retirement",
  purchase: "saving for a purchase",
  other: null,
};

const REVIEW_WORDS: Record<IpsReviewFrequency, string> = {
  monthly: "monthly reviews",
  quarterly: "quarterly reviews",
  semiannual: "reviews every 6 months",
  annual: "yearly reviews",
};

/**
 * The reasons of a match, in words, the policy's first. The score only orders the suggestions:
 * it isn't shown.
 */
function reasonLines(reasons: MatchReasons, advisor: AdvisorCard): string[] {
  const lines: string[] = [];
  if (reasons.assetClasses.length > 0) {
    lines.push(`Manages ${joinWords(lower(labels(ASSET_CLASS_OPTIONS, reasons.assetClasses)))} as in your policy`);
  }
  if (reasons.riskProfile) {
    const profile = label(RISK_PROFILE_OPTIONS, reasons.riskProfile).toLowerCase();
    lines.push(reasons.riskExact ? `Follows ${profile} profiles like yours` : `Follows ${profile} profiles, close to yours`);
  }
  if (reasons.horizon) lines.push(`Works with horizons of ${label(HORIZON_OPTIONS, reasons.horizon).toLowerCase()}, like yours`);
  if (reasons.purpose) {
    const work = PURPOSE_WORK[reasons.purpose];
    lines.push(work ? `Works on ${work}, your purpose` : "Works on your portfolio's purpose");
  }
  if (reasons.instruments.length > 0) {
    lines.push(`Handles ${joinWords(labels(INSTRUMENT_OPTIONS, reasons.instruments))}, which you allow`);
  }
  if (reasons.leverage) lines.push("Advises on leverage, which you allow");
  if (reasons.reviewFrequency) lines.push(`Offers ${REVIEW_WORDS[reasons.reviewFrequency]}, as often as you ask`);
  if (reasons.topics.length > 0) {
    lines.push(`Helps with ${lower(labels(TOPIC_OPTIONS, reasons.topics)).join(", ")}`);
  }
  if (reasons.sameCity) lines.push(`Meets in person in ${advisor.city}`);
  else if (reasons.meetingModes.includes("remote")) lines.push("Meets remotely");
  if (reasons.languages.length > 0) {
    lines.push(`Speaks ${reasons.languages.map((l) => label(LANGUAGE_OPTIONS, l.split("-")[0])).join(", ")}`);
  }
  if (reasons.feeModels.length > 0) lines.push(`Paid: ${lower(labels(FEE_OPTIONS, reasons.feeModels)).join(", ")}`);
  if (advisor.minClientWealth != null) {
    lines.push(`Takes on clients from ${new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(advisor.minClientWealth)}`);
  }
  return lines;
}

/** What an advisor manages, as they stated it; folded, under their card. */
function AdvisorOffer({ advisor }: { advisor: AdvisorCard }) {
  const rows: [string, string][] = [
    ["Asset classes", labels(ASSET_CLASS_OPTIONS, advisor.assetClasses ?? []).join(", ")],
    ["Instruments", labels(INSTRUMENT_OPTIONS, advisor.instruments ?? []).join(", ")],
    ["Leverage", advisor.leverage ? "Advises on it" : "No"],
    ["Purposes", labels(PURPOSE_OPTIONS, advisor.purposes ?? []).join(", ")],
    ["Risk profiles", labels(RISK_PROFILE_OPTIONS, advisor.riskProfiles ?? []).join(", ")],
    ["Horizons", labels(HORIZON_OPTIONS, advisor.horizons ?? []).join(", ")],
    ["Reviews", advisor.reviewFrequency ? `Up to ${label(REVIEW_OPTIONS, advisor.reviewFrequency).toLowerCase()}` : ""],
  ];
  return (
    <details className="group text-sm">
      <summary className="cursor-pointer select-none text-xs font-bold uppercase tracking-wider text-[#78716c] hover:text-[#1c1917]">
        What {advisor.firstName || "they"} manage{advisor.firstName ? "s" : ""}
      </summary>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {rows.map(([name, value]) => (
          <div key={name} className="contents">
            <dt className="text-[#78716c]">{name}</dt>
            <dd className="text-[#1c1917]">{value || "Not said"}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim() || "Advisor";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
