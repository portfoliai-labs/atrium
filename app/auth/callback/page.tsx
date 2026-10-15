"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, ShieldCheck, Copy, Check } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/app/lib/supabaseClient";
import { completeAuth } from "@/app/lib/completeAuth";

function TokenDisplay({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="w-full max-w-sm"
    >
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-5 h-px" style={{ background: "#C49A3C" }} />
          <span className="text-[10px] font-medium tracking-[0.14em] uppercase" style={{ color: "#8A6A28" }}>
            Authentication token
          </span>
        </div>
        <h2
          className="text-[clamp(26px,3vw,36px)] font-black leading-tight tracking-tight mb-3"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
        >
          Token generated.
        </h2>
        <p className="text-[14px] font-light" style={{ color: "#78716c" }}>
          Copy this token and paste it into the extension to authenticate.
        </p>
      </div>

      <div
        className="rounded-[3px] p-4 mb-4 font-mono text-[11px] break-all leading-relaxed select-all"
        style={{
          background: "#1c1917",
          color: "#E8C97A",
          border: "1px solid rgba(196,154,60,0.25)",
          wordBreak: "break-all",
        }}
      >
        {token}
      </div>

      <button
        onClick={handleCopy}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-[3px] transition-all duration-200 text-[13px] font-semibold tracking-[0.04em] uppercase"
        style={{
          background: copied ? "rgba(34,197,94,0.12)" : "#1c1917",
          color: copied ? "#16a34a" : "#fafaf9",
          border: copied ? "1px solid rgba(34,197,94,0.35)" : "1px solid #1c1917",
        }}
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copy token
          </>
        )}
      </button>

      <div
        className="rounded-[3px] px-4 py-3 flex items-start gap-3 mt-6"
        style={{ background: "rgba(196,154,60,0.06)", border: "1px solid rgba(196,154,60,0.15)" }}
      >
        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#8A6A28" }} strokeWidth={1.5} />
        <p className="text-[11px] leading-relaxed" style={{ color: "#8A6A28" }}>
          This token grants access to your PortfoliAI account. Keep it private and do not share it.
        </p>
      </div>
    </motion.div>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const destination = searchParams.get("next") || "/dashboard";
  const isAddon = searchParams.get("source") === "addon";
  const oauthError = searchParams.get("error_description") || searchParams.get("error");

  const [status, setStatus] = useState("Completing sign-in...");
  const [isError, setIsError] = useState(false);
  const [addonToken, setAddonToken] = useState<string | null>(null);
  // Supabase can fire onAuthStateChange more than once (e.g. INITIAL_SESSION then
  // SIGNED_IN) for the same session — only act on the first one.
  const handledRef = useRef(false);

  useEffect(() => {
    // Google/Supabase already reported a failure via the redirect's query params
    // (e.g. the user denied consent) — nothing to wait on, `oauthError` itself is
    // rendered below.
    if (oauthError) return;

    const completeLogin = async (token: string) => {
      if (handledRef.current) return;
      handledRef.current = true;

      const outcome = await completeAuth(token, isAddon ? "addon" : "default", destination);
      if (outcome.kind === "addon-token") {
        setAddonToken(outcome.token);
      } else if (outcome.kind === "redirect") {
        router.replace(outcome.to);
      } else {
        setIsError(true);
        setStatus(outcome.message);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) completeLogin(session.access_token);
    });

    // Covers the case where Supabase has already resolved the redirect's session by
    // the time this effect runs, so the state-change listener above never fires.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) completeLogin(session.access_token);
    });

    return () => subscription.unsubscribe();
  }, [destination, isAddon, oauthError, router]);

  if (addonToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "#F7F5EF" }}>
        <TokenDisplay token={addonToken} />
      </div>
    );
  }

  const displayError = Boolean(oauthError) || isError;
  const displayStatus = oauthError ?? status;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8" style={{ background: "#F7F5EF" }}>
      {displayError ? (
        <div className="max-w-sm text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "#9B2226" }} />
          <p className="text-sm font-semibold mb-4" style={{ color: "#9B2226" }}>{displayStatus}</p>
          <a href="/login" className="text-sm underline" style={{ color: "#78716c" }}>
            Back to login
          </a>
        </div>
      ) : (
        <>
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#C49A3C" }} />
          <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#C49A3C" }}>
            {status}
          </p>
        </>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: "#F7F5EF" }}>
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#C49A3C" }} />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
