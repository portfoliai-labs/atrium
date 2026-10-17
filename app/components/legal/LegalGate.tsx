"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, ShieldCheck, X } from "lucide-react";
import { legalService } from "../../services/legalService";
import { ApiError } from "../../services/apiClient";
import { useUser } from "../../context/UserContext";
import type { LegalDocument } from "../../models/Legal";

function formatDocumentLabel(code: string): string {
  return code
    .replace(/[_-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Renders a document's `url` inline instead of sending the user away from the
 * acceptance flow. Most storage backends serve these as plain PDF/HTML, which
 * an iframe displays natively — no fetch/blob dance needed since the /legal
 * endpoints (and the URLs they return) are public, unlike the presigned,
 * short-lived report downloads. If the host blocks framing (X-Frame-Options),
 * the "Open in new tab" fallback below still works since it bypasses the iframe.
 */
function DocumentPreviewModal({ doc, onClose }: { doc: LegalDocument; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 lg:p-8">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl h-[85vh] bg-white rounded-3xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[rgba(196,154,60,0.2)]">
          <h2 className="font-bold text-[#1c1917] text-sm">
            {formatDocumentLabel(doc.code)}{" "}
            <span className="text-[#a8a29e] font-normal">v{doc.version}</span>
          </h2>
          <div className="flex items-center gap-1">
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#78716c] hover:text-[#1c1917] hover:bg-[#F7F5EF] rounded-xl transition-colors"
            >
              Open in new tab <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-[#78716c] hover:text-[#1c1917] hover:bg-[#F7F5EF] rounded-xl transition-colors"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <iframe
          src={doc.url}
          title={`${formatDocumentLabel(doc.code)} v${doc.version}`}
          className="flex-1 w-full"
        />
      </div>
    </div>
  );
}

export function AcceptanceScreen({ documents, onAccepted }: { documents: LegalDocument[]; onAccepted: () => void }) {
  const { logout, refreshUser } = useUser();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<LegalDocument | null>(null);

  const allChecked = documents.every((doc) => checked[doc.code]);

  const handleToggle = (code: string) => {
    setChecked((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await legalService.acceptDocuments(documents.map((doc) => ({ code: doc.code, version: doc.version })));
      // If GET /users/profile had been refused because of exactly these
      // unaccepted documents (needsLegalAcceptance), it will now succeed —
      // re-fetch so UserContext.user gets populated instead of staying null.
      await refreshUser();
      onAccepted();
    } catch {
      setError("Something went wrong while recording your acceptance. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5EF] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-sm border border-[rgba(196,154,60,0.2)] p-8 md:p-12">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[#C49A3C]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <ShieldCheck className="w-7 h-7 text-[#C49A3C]" />
          </div>
          <h1
            className="text-2xl md:text-3xl font-bold text-[#1c1917]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Before you continue
          </h1>
          <p className="text-[#78716c] mt-2 text-sm">
            {documents.length === 1
              ? "There is a document you need to review and accept to keep using PortfoliAI."
              : "There are documents you need to review and accept to keep using PortfoliAI."}
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {documents.map((doc) => (
            <label
              key={doc.code}
              className="flex items-start gap-3 p-4 rounded-2xl border border-[rgba(196,154,60,0.2)] bg-[#F7F5EF] cursor-pointer hover:border-[#C49A3C]/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={!!checked[doc.code]}
                onChange={() => handleToggle(doc.code)}
                className="mt-0.5 w-4 h-4 accent-[#C49A3C] shrink-0"
              />
              <span className="text-sm text-[#1c1917] leading-relaxed">
                I have read and accept the{" "}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreviewDoc(doc); }}
                  className="font-semibold underline inline-flex items-center gap-1 align-baseline"
                >
                  {formatDocumentLabel(doc.code)}
                  <ExternalLink className="w-3 h-3" />
                </button>
                <span className="text-[#a8a29e]"> (v{doc.version})</span>
              </span>
            </label>
          ))}
        </div>

        <p className="text-[11px] text-[#a8a29e] leading-relaxed mb-6">
          By accepting, you also confirm that you are at least 18 years old. PortfoliAI reports —
          including AI-generated analysis — are informational only and do not constitute
          financial advice.
        </p>

        {error && <p className="text-sm text-rose-600 mb-4">{error}</p>}

        <div className="flex items-center justify-between gap-4">
          <button
            onClick={logout}
            className="text-sm font-semibold text-[#78716c] hover:text-[#1c1917] transition-colors"
          >
            Log out
          </button>
          <button
            onClick={handleSubmit}
            disabled={!allChecked || submitting}
            className="flex items-center gap-2 px-8 py-3.5 bg-[#C49A3C] text-white rounded-2xl font-bold hover:bg-[#d4aa4c] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> Continue</>
            )}
          </button>
        </div>
      </div>

      {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}

/**
 * Gates dashboard/reports access behind acceptance of any legal document
 * version the user hasn't accepted yet.
 *
 * It deliberately does NOT gate brand-new signups still in onboarding:
 * /legal/pending looks the user up by their account record, which doesn't
 * exist yet until POST /users/register creates it — checking any earlier
 * than that 404s every time ("User '<email>' not found"), so onboarding
 * would never render. `user` stays null in that case, but so does
 * `needsLegalAcceptance` (from UserContext), which is how this tells a
 * brand-new signup apart from an existing account whose GET /users/profile
 * came back 403 specifically because it hasn't accepted the current
 * documents yet — that 403 is also what UserContext.fetchProfile hits, so it
 * can't populate `user` either, but /legal/pending is safe to call (the
 * account does exist) and is what actually resolves the deadlock.
 */
export function LegalGate({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading, needsLegalAcceptance, logout } = useUser();
  // A primitive to depend on instead of `user` itself: `user` is a new object on every
  // fetch (including a silent one, e.g. after a Profile save), which would otherwise re-run
  // the effect below on every such refresh — re-hitting /legal/pending and, worse, dropping
  // `checking` back to true, which tears down and rebuilds the whole gated page (losing
  // scroll position, open menus, an on-screen "saved" toast, anything local to it).
  const userId = user?.uuid ?? null;
  const [pending, setPending] = useState<LegalDocument[] | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState<ApiError | Error | null>(null);

  const checkPending = useCallback(async () => {
    setChecking(true);
    setCheckError(null);
    try {
      const docs = await legalService.getPendingDocuments();
      setPending(docs.length > 0 ? docs : null);
    } catch (err) {
      // Do NOT fail open here: silently proceeding trades a clear "please
      // accept this" screen for a confusing failure deeper in the flow.
      // A 401 is already handled globally (auth-unauthorized -> logout).
      setCheckError(err instanceof ApiError ? err : new Error("Network error"));
      setPending(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!token) {
      // No token: nothing to gate here, let the page-level route protection
      // (useProtectedRoute) handle redirecting to /login.
      setChecking(false);
      return;
    }
    if (userLoading) {
      // Still resolving whether a profile exists — wait before deciding
      // anything, otherwise we'd race UserContext's own fetch.
      return;
    }
    if (!userId && !needsLegalAcceptance) {
      // No profile yet: brand-new account still going through onboarding.
      // Nothing to check against server-side yet — let onboarding render.
      setChecking(false);
      setPending(null);
      return;
    }
    // Either a real profile loaded, or the profile fetch told us explicitly
    // that legal acceptance is required — either way /legal/pending is safe
    // (and necessary) to call now.
    checkPending();
  }, [userId, userLoading, needsLegalAcceptance, checkPending]);

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F7F5EF] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C49A3C]" />
      </div>
    );
  }

  if (checkError) {
    // The auth dependency this endpoint shares with the rest of the API
    // (get_current_user_info) returns 403 specifically when Google's userinfo
    // call succeeds but the account has no verified email. That isn't
    // transient — retrying with the same session won't help, only signing in
    // again (possibly with a different Google account) will.
    const isUnverifiedEmail = checkError instanceof ApiError && checkError.status === 403;
    return (
      <div className="min-h-screen bg-[#F7F5EF] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-sm border border-[rgba(196,154,60,0.2)] p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-[#1c1917] mb-2">
            {isUnverifiedEmail ? "Google account email not verified" : "Couldn't verify your account"}
          </h1>
          <p className="text-sm text-[#78716c] mb-1">
            {isUnverifiedEmail
              ? "We can't confirm your identity because your Google account has no verified email. Please sign in again, ideally with an account that has a verified email address."
              : "Something went wrong on our end. This is usually temporary — please try again in a moment."}
          </p>
          <p className="text-[11px] text-[#a8a29e] mb-6 font-mono">
            {checkError instanceof ApiError ? `${checkError.status} ${checkError.message}` : checkError.message}
          </p>
          {isUnverifiedEmail ? (
            <button
              onClick={logout}
              className="px-6 py-3 bg-[#C49A3C] text-white rounded-2xl font-bold hover:bg-[#d4aa4c] transition-colors"
            >
              Log out
            </button>
          ) : (
            <button
              onClick={checkPending}
              className="px-6 py-3 bg-[#C49A3C] text-white rounded-2xl font-bold hover:bg-[#d4aa4c] transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (pending && pending.length > 0) {
    return <AcceptanceScreen documents={pending} onAccepted={() => setPending(null)} />;
  }

  return <>{children}</>;
}
