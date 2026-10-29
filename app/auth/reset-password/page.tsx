"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, AlertCircle, Lock } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";
import { completeAuth } from "@/app/lib/completeAuth";
import { MIN_PASSWORD_LENGTH, newPasswordError } from "@/app/lib/password";

type Stage = "checking" | "ready" | "invalid";

/**
 * Where a password reset email's link lands (see useAuthFlow's requestPasswordReset): Supabase
 * signs the user in from the link (its tokens in the URL, or a code to exchange should the client
 * move to PKCE: the client reads either as it starts, firing PASSWORD_RECOVERY), and the page asks
 * for the new password. Once it's set, in as any sign-in is (completeAuth). A link that's expired
 * or already used comes back with an error in the URL instead, and asks for a new one.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The link's own outcome: its error, should it carry one, even over a session already open
      // in this browser (Supabase keeps that one when a link fails).
      const { error: linkError } = await supabase.auth.initialize();
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) setStage(!linkError && session ? "ready" : "invalid");
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = newPasswordError(password, confirmation);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      console.error("Failed to reset password:", updateError);
      setError(updateError.message);
      setSaving(false);
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    const outcome = await completeAuth(session.access_token, "default", "/dashboard");
    if (outcome.kind === "redirect") {
      router.replace(outcome.to);
    } else {
      setError(outcome.kind === "error" ? outcome.message : "Authentication failed.");
      setSaving(false);
    }
  };

  if (stage === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F7F5EF" }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#C49A3C" }} />
      </div>
    );
  }

  const inputStyle = { background: "#fff", border: "1px solid #E0DACC", color: "#1c1917" };

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "#F7F5EF" }}>
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
              Reset password
            </span>
          </div>
          <h2
            className="text-[clamp(26px,3vw,36px)] font-black leading-tight tracking-tight mb-3"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
          >
            {stage === "invalid" ? "This link no longer works." : "Set a new password."}
          </h2>
          <p className="text-[14px] font-light" style={{ color: "#78716c" }}>
            {stage === "invalid"
              ? "Reset links work once, and only for a while. Ask for a new one and use the latest email."
              : "Choose the password you'll sign in with from now on."}
          </p>
        </div>

        {stage === "invalid" ? (
          <div className="flex flex-col gap-4">
            <a
              href="/login?mode=reset"
              className="w-full text-center py-3.5 px-6 rounded-[3px] text-[13px] font-semibold tracking-[0.04em] uppercase"
              style={{ background: "#1c1917", color: "#fafaf9", border: "1px solid #1c1917" }}
            >
              Send a new link
            </a>
            <a href="/login" className="text-center text-[12px] font-semibold underline" style={{ color: "#78716c" }}>
              Back to login
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div
                className="mb-3 p-4 rounded-[3px] flex items-start gap-3"
                style={{ background: "rgba(155,34,38,0.06)", border: "1px solid rgba(155,34,38,0.2)" }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#9B2226" }} />
                <span className="text-[12px] font-medium" style={{ color: "#9B2226" }}>{error}</span>
              </div>
            )}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#857e78" }} />
              <input
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={saving}
                className="w-full pl-11 pr-4 py-3.5 rounded-[3px] text-[14px] outline-none"
                style={inputStyle}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#857e78" }} />
              <input
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                placeholder="Confirm password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                disabled={saving}
                className="w-full pl-11 pr-4 py-3.5 rounded-[3px] text-[14px] outline-none"
                style={inputStyle}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-[3px] text-[13px] font-semibold tracking-[0.04em] uppercase transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "#1c1917", color: "#fafaf9", border: "1px solid #1c1917" }}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#C49A3C" }} />}
              {saving ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
