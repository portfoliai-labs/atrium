"use client";

import React, { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, ShieldCheck, Zap, Loader2, AlertCircle, Mail, Lock, MailCheck, User, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAuthFlow } from "@/app/hooks/useAuthFlow";

const loginFeatures: Array<{ icon: React.ElementType; title: string; description: string }> = [
  {
    icon: Zap,
    title: "Instant AI Analysis",
    description: "Get your portfolio parsed and analysed in seconds.",
  },
  {
    icon: ShieldCheck,
    title: "Secure & Private",
    description: "Your data is encrypted and access-controlled — retained only while your account is active, deletable anytime.",
  },
];

function LoginContent() {
  const searchParams = useSearchParams();
  const isAddon = searchParams.get("source") === "addon";
  const next = searchParams.get("next");

  const {
    login,
    loginWithPassword,
    signUpWithPassword,
    resendConfirmation,
    status,
    isError,
    needsEmailConfirmation,
  } = useAuthFlow(isAddon ? "addon" : "default", next);

  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Which specific action is in flight, not just whether one is — every button below shares
  // `isLoading` (derived below) to stay disabled while any of them runs, but each button's own
  // loading look (Google's spinner-for-icon swap, the submit button's "Please wait…") must key
  // off pendingAction being ITS action specifically, or triggering one action makes every
  // other button visually look like it's the one running too.
  const [pendingAction, setPendingAction] = useState<
    "google" | "password" | "resend" | "demo-investor" | "demo-advisor" | null
  >(null);

  const handleGoogle = async () => {
    setPendingAction("google");
    await login();
    setPendingAction(null);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPendingAction("password");
    if (authMode === "signin") {
      await loginWithPassword(email, password);
    } else {
      await signUpWithPassword(email, password);
    }
    setPendingAction(null);
  };

  const handleResend = async () => {
    if (!needsEmailConfirmation) return;
    setPendingAction("resend");
    await resendConfirmation(needsEmailConfirmation);
    setPendingAction(null);
  };

  // Two separate demo accounts, kept as separate handlers (rather than one that takes an
  // email/password pair) so each button below is an unambiguous, one-purpose click target —
  // which account a click signs into is never implicit from shared state.
  const handleInvestorDemoLogin = async () => {
    setPendingAction("demo-investor");
    await loginWithPassword("demo@portfoliai.app", "demoportfoliai");
    setPendingAction(null);
  };

  const handleAdvisorDemoLogin = async () => {
    setPendingAction("demo-advisor");
    await loginWithPassword("advisor-demo@portfoliai.app", "demoportfoliai");
    setPendingAction(null);
  };

  const isLoading = pendingAction !== null;

  return (
    <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 lg:p-20" style={{ background: "#F7F5EF" }}>
      {/* Mobile logo */}
      <div className="md:hidden flex items-center gap-2.5 mb-12">
        <div className="w-7 h-7 flex items-center justify-center rounded-[4px]" style={{ background: "#1c1917" }}>
          <BarChart3 className="w-[14px] h-[14px]" style={{ stroke: "#C49A3C" }} strokeWidth={2} />
        </div>
        <span className="text-[20px] font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>
          PortfoliAI
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="w-full max-w-sm"
      >
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-5 h-px" style={{ background: "#C49A3C" }} />
              <span className="text-[10px] font-medium tracking-[0.14em] uppercase" style={{ color: "#8A6A28" }}>
                {isAddon ? "Extension sign in" : authMode === "signup" ? "Create account" : "Sign in"}
              </span>
            </div>
            <h2
              className="text-[clamp(28px,3vw,40px)] font-black leading-tight tracking-tight mb-3"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
            >
              {isAddon ? "Authenticate extension." : authMode === "signup" ? "Create your account." : "Welcome back."}
            </h2>
            <p className="text-[14px] font-light" style={{ color: "#78716c" }}>
              {isAddon
                ? "Sign in to generate your authentication token."
                : authMode === "signup"
                ? "Sign up to start analysing your portfolio."
                : "Sign in to access your portfolio dashboard."}
            </p>
          </div>

          {isError && (
            <div
              className="mb-6 p-4 rounded-[3px] flex items-start gap-3"
              style={{ background: "rgba(155,34,38,0.06)", border: "1px solid rgba(155,34,38,0.2)" }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#9B2226" }} />
              <span className="text-[12px] font-medium" style={{ color: "#9B2226" }}>{status}</span>
            </div>
          )}

          {needsEmailConfirmation ? (
            <div className="text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: "rgba(196,154,60,0.1)" }}
              >
                <MailCheck className="w-6 h-6" style={{ color: "#C49A3C" }} />
              </div>
              <p className="text-[14px] font-medium mb-1" style={{ color: "#1c1917" }}>
                Check your inbox
              </p>
              <p className="text-[13px] font-light leading-relaxed mb-6" style={{ color: "#78716c" }}>
                We sent a confirmation link to <strong>{needsEmailConfirmation}</strong>. Click it to finish
                creating your account.
              </p>
              <button
                onClick={handleResend}
                disabled={isLoading}
                className="text-[12px] font-semibold underline disabled:opacity-60"
                style={{ color: "#78716c" }}
              >
                {pendingAction === "resend" ? "Resending…" : "Resend confirmation email"}
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleGoogle}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-[3px] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: "#1c1917", color: "#fafaf9", border: "1px solid #1c1917" }}
                onMouseEnter={(e) => { if (!isLoading) (e.currentTarget.style.background = "#2a2820"); }}
                onMouseLeave={(e) => { if (!isLoading) (e.currentTarget.style.background = "#1c1917"); }}
              >
                {pendingAction === "google" ? (
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#C49A3C" }} />
                ) : (
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    <path d="M1 1h22v22H1z" fill="none" />
                  </svg>
                )}
                <span className="text-[13px] font-semibold tracking-[0.04em] uppercase">
                  Continue with Google
                </span>
              </button>

              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px" style={{ background: "#E0DACC" }} />
                <span className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "#c4bdb5" }}>or</span>
                <div className="flex-1 h-px" style={{ background: "#E0DACC" }} />
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#a8a29e" }} />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-[3px] text-[14px] outline-none"
                    style={{ background: "#fff", border: "1px solid #E0DACC", color: "#1c1917" }}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#a8a29e" }} />
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-[3px] text-[14px] outline-none"
                    style={{ background: "#fff", border: "1px solid #E0DACC", color: "#1c1917" }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-6 rounded-[3px] text-[13px] font-semibold tracking-[0.04em] uppercase transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: "#fff", color: "#1c1917", border: "1px solid #1c1917" }}
                >
                  {pendingAction === "password" ? "Please wait…" : authMode === "signup" ? "Create account" : "Sign in"}
                </button>
              </form>

              {!isError && isLoading && (
                <p className="text-center text-[11px] font-medium mt-4 animate-pulse tracking-wider uppercase" style={{ color: "#C49A3C" }}>
                  {status}
                </p>
              )}

              <p className="text-center text-[12px] font-medium mt-6" style={{ color: "#78716c" }}>
                {authMode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === "signup" ? "signin" : "signup")}
                  className="underline font-semibold"
                  style={{ color: "#1c1917" }}
                >
                  {authMode === "signup" ? "Sign in" : "Sign up"}
                </button>
              </p>

              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.1em] mt-6 mb-2" style={{ color: "#a8a29e" }}>
                Or try a demo account
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleInvestorDemoLogin}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-[3px] text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: "transparent", color: "#8A6A28", border: "1px dashed rgba(196,154,60,0.4)" }}
                >
                  <User className="w-3.5 h-3.5 flex-shrink-0" />
                  Investor
                </button>
                <button
                  type="button"
                  onClick={handleAdvisorDemoLogin}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-[3px] text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: "transparent", color: "#8A6A28", border: "1px dashed rgba(196,154,60,0.4)" }}
                >
                  <Users className="w-3.5 h-3.5 flex-shrink-0" />
                  Advisor
                </button>
              </div>
            </>
          )}

          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px" style={{ background: "#E0DACC" }} />
            <span className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "#c4bdb5" }}>secure login</span>
            <div className="flex-1 h-px" style={{ background: "#E0DACC" }} />
          </div>

          <p className="text-center text-[11px] mt-8 leading-relaxed" style={{ color: "#a8a29e" }}>
            By continuing, you agree to our{" "}
            <a href="#" className="underline transition-colors" style={{ color: "#78716c" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#1c1917")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#78716c")}
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="underline transition-colors" style={{ color: "#78716c" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#1c1917")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#78716c")}
            >
              Privacy Policy
            </a>.
          </p>
        </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "#F7F5EF" }}>

      {/* ── LEFT — branding ── */}
      <div
        className="hidden md:flex md:w-1/2 flex-col justify-between p-14 lg:p-20 border-r relative overflow-hidden"
        style={{ background: "#131210", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-80px", left: "-80px",
            width: "480px", height: "480px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(196,154,60,0.07) 0%, transparent 70%)",
            filter: "blur(32px)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2.5"
        >
          <div className="w-7 h-7 flex items-center justify-center rounded-[4px]" style={{ background: "#fafaf9" }}>
            <BarChart3 className="w-[14px] h-[14px]" style={{ stroke: "#131210" }} strokeWidth={2} />
          </div>
          <span className="text-[20px] font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fafaf9" }}>
            PortfoliAI
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
        >
          <div className="flex items-center gap-2 mb-8">
            <span className="w-5 h-px" style={{ background: "rgba(196,154,60,0.5)" }} />
            <span className="text-[10px] font-medium tracking-[0.14em] uppercase" style={{ color: "rgba(196,154,60,0.6)" }}>
              AI Portfolio Intelligence
            </span>
          </div>
          <h1
            className="text-[clamp(34px,3.8vw,52px)] font-black leading-[1.06] tracking-tight mb-6"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fafaf9" }}
          >
            Master your<br />
            wealth with<br />
            <em style={{ fontStyle: "italic", color: "#8A6A28" }}>absolute</em> clarity.
          </h1>
          <p className="text-[14px] font-light leading-[1.75] max-w-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            Join investors and advisors who use PortfoliAI to uncover
            hidden costs and understand their real returns.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="flex flex-col gap-6"
        >
          {loginFeatures.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div key={i} className="flex items-start gap-4">
                <div
                  className="w-9 h-9 flex items-center justify-center rounded-[4px] border flex-shrink-0"
                  style={{ borderColor: "rgba(196,154,60,0.22)" }}
                >
                  <Icon className="w-4 h-4" style={{ color: "#E8C97A" }} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold mb-0.5" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fafaf9" }}>
                    {feature.title}
                  </h3>
                  <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}

          <div className="flex gap-0 mt-4 pt-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            {[{ num: "€ 0", label: "to start" }, { num: "100%", label: "private" }, { num: "1", label: "click away" }].map((s, i) => (
              <div key={i} className={`flex-1 ${i > 0 ? "pl-4 border-l" : ""} ${i < 2 ? "pr-4" : ""}`} style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="text-[22px] font-bold leading-none mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fafaf9" }}>{s.num}</div>
                <div className="text-[9px] uppercase tracking-[0.09em]" style={{ color: "rgba(255,255,255,0.22)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── RIGHT — auth form ── */}
      <Suspense fallback={
        <div className="w-full md:w-1/2 flex items-center justify-center" style={{ background: "#F7F5EF" }}>
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#C49A3C" }} />
        </div>
      }>
        <LoginContent />
      </Suspense>
    </div>
  );
}
