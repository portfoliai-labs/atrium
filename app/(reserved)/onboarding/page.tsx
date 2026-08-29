// app/(authenticated)/onboarding/page.tsx
"use client";

import { useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowLeft, Check, Loader2, Rocket, User, Briefcase } from "lucide-react";
import { userService } from "../../services/userService";
import { advisorService } from "../../services/advisorService";
import { legalService } from "../../services/legalService";
import { ApiError } from "../../services/apiClient";
import { useUser } from "../../context/UserContext";
import { AcceptanceScreen } from "../../components/legal/LegalGate";
import type { UserRole } from "../../models/User";
import type { LegalDocument } from "../../models/Legal";

import { StepPersonal } from "../../components/onboarding/StepPersonal";
import { StepRiskProfile } from "../../components/onboarding/StepRiskProfile";
import { StepConsultant } from "../../components/onboarding/StepConsultant";
import { StepPreferences } from "../../components/onboarding/StepPreferences";

interface OnboardingFormData {
  // Personal
  first_name: string;
  last_name: string;
  // Investor profile
  currency: string;
  risk_tolerance: 'low' | 'medium' | 'high';
  financial_knowledge_level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  // Consultant profile
  years_of_experience: string;
  specialization: string;
  language: string;
}

function RoleCard({
  icon,
  title,
  description,
  dark,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  dark?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group w-full text-left p-8 rounded-4xl border transition-all duration-200 hover:scale-[1.02] active:scale-[0.99] ${
        dark
          ? "bg-[#1c1917] border-[#C49A3C]/30 hover:border-[#C49A3C]/60"
          : "bg-white border-[rgba(196,154,60,0.25)] hover:border-[#C49A3C]/60 hover:shadow-lg"
      }`}
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${dark ? "bg-[#C49A3C]/15" : "bg-[#F7F5EF]"}`}>
        <span className="text-[#C49A3C]">{icon}</span>
      </div>
      <h3
        className={`text-xl font-bold mb-2 ${dark ? "text-white" : "text-[#1c1917]"}`}
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {title}
      </h3>
      <p className={`text-sm leading-relaxed ${dark ? "text-[#a8a29e]" : "text-[#78716c]"}`}>{description}</p>
      <div className={`mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${dark ? "text-[#C49A3C]" : "text-[#C49A3C]"}`}>
        Get Started <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  );
}

function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser, logout } = useUser();

  const [role, setRole] = useState<UserRole | null>(null);
  const [step, setStep] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  // Set right after POST /users/register succeeds if the newly-created
  // account still has active legal documents to accept. PATCH /users/profile
  // and PATCH /advisor/profile both sit behind the same gate as the rest of
  // the app (get_current_active_user_info), so calling them immediately
  // after register would 403 for any account that hasn't accepted yet.
  // Blocking here — before either PATCH — keeps the form data the user
  // already typed instead of losing it to a remount, and avoids a second,
  // redundant POST /users/register.
  const [pendingLegalDocs, setPendingLegalDocs] = useState<LegalDocument[] | null>(null);
  // Set synchronously in onAccepted below, before the async finalizeProfile()
  // call resolves. Without this, clearing pendingLegalDocs alone would let
  // the wizard fall through to renderStep() for a frame (step/role state is
  // still whatever it was on the last wizard step) before router.push runs,
  // flashing the onboarding form again right before the dashboard redirect.
  const [finalizing, setFinalizing] = useState<boolean>(false);

  const [formData, setFormData] = useState<OnboardingFormData>({
    first_name: searchParams.get("first_name") || "",
    last_name: searchParams.get("last_name") || "",
    currency: "EUR",
    risk_tolerance: "medium",
    financial_knowledge_level: "BEGINNER",
    years_of_experience: "",
    specialization: "",
    language: "it",
  });

  const handleRoleSelect = (selected: 'investor' | 'advisor') => {
    setRole(selected === 'investor' ? 'USER' : 'ADVISOR');
    setStep(1);
  };

  const handleNext = () => setStep((prev) => prev + 1);
  const handlePrev = () => {
    if (step === 1) {
      setStep(0);
      setRole(null);
    } else {
      setStep((prev) => prev - 1);
    }
  };

  const totalSteps = role === 'ADVISOR' ? 3 : 2;

  // Step 2 of each role's flow: the PATCH that actually stores the financial
  // / advisor data collected in the wizard. Runs either right after register
  // (no legal documents pending) or after the user clears the acceptance
  // screen below (documents were pending).
  const finalizeProfile = useCallback(async () => {
    setLoading(true);
    try {
      if (role === 'USER') {
        await userService.updateUserProfile({
          currency: formData.currency || null,
          risk_tolerance: formData.risk_tolerance || null,
          financial_knowledge_level: formData.financial_knowledge_level || null,
        });
      } else {
        await advisorService.updateAdvisorProfile({
          clients_count: null,
          aum: null,
          years_experience: parseInt(formData.years_of_experience) || null,
          specialization: formData.specialization || null,
        });
      }

      await refreshUser();
      router.push("/dashboard");
    } catch (error) {
      console.error("Failed to finalize profile:", error);
      if (error instanceof ApiError && error.status === 403) {
        // By this point pending legal documents were already handled above,
        // so a 403 here almost always means get_current_user_info rejected
        // the Google token itself (no verified email) rather than the legal
        // gate. Retrying or reloading won't fix that — only a fresh sign-in
        // (possibly with a different Google account) will.
        alert(
          "We couldn't verify the email on your Google account, so we can't finish setting up " +
          "your profile. Please make sure your Google account has a verified email address, " +
          "then sign in again."
        );
        logout();
        return;
      }
      alert("An error occurred. Please try again.");
      setFinalizing(false);
    } finally {
      setLoading(false);
    }
  }, [formData, role, refreshUser, router, logout]);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    try {
      await userService.createUserProfile({
        first_name: formData.first_name,
        last_name: formData.last_name,
        language: formData.language || (role === 'ADVISOR' ? "en" : "it"),
        role: role as UserRole,
      });

      // The account now exists, so /legal/pending is safe to call (it 404s
      // before the account exists). Any document returned here still needs
      // accepting before the profile-completing PATCH below is allowed to
      // go through.
      const pending = await legalService.getPendingDocuments();
      if (pending.length > 0) {
        setPendingLegalDocs(pending);
        setLoading(false);
        return;
      }

      await finalizeProfile();
    } catch (error) {
      console.error("Failed to create profile:", error);
      if (error instanceof ApiError && error.status === 403) {
        // The only 403 POST /users/register itself raises (get_current_user_info,
        // auth.py): Google's userinfo call succeeded but returned no email or
        // email_verified: false. Retrying or reloading won't fix this — the
        // Google account itself needs a verified email. Sign the user out so
        // they get a clean re-auth instead of getting stuck on this screen.
        alert(
          "We couldn't verify the email on your Google account, so we can't create your " +
          "profile. Please make sure your Google account has a verified email address, then " +
          "sign in again."
        );
        logout();
        return;
      }
      alert("An error occurred. Please try again.");
      setLoading(false);
    }
  }, [formData, role, finalizeProfile, logout]);

  const isNextDisabled = step === 1 && (!formData.first_name.trim() || !formData.last_name.trim());

  // Account was just created (POST /users/register) but has active legal
  // documents still unaccepted. Block here — ahead of both the wizard steps
  // and LegalGate's own check — so the financial/advisor data already typed
  // in this session survives instead of being lost to a remount.
  if (pendingLegalDocs) {
    return (
      <AcceptanceScreen
        documents={pendingLegalDocs}
        onAccepted={() => {
          setPendingLegalDocs(null);
          setFinalizing(true);
          void finalizeProfile();
        }}
      />
    );
  }

  // finalizeProfile() is still in flight (PATCH + refreshUser + router.push).
  // Render a loader instead of falling through to the wizard steps below,
  // otherwise the last step (with its Next/Get Started footer) would flash
  // on screen for a frame before the redirect to /dashboard lands.
  if (finalizing) {
    return (
      <div className="min-h-screen bg-[#F7F5EF] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C49A3C]" />
      </div>
    );
  }

  // — Step 0: Role selection —
  if (step === 0) {
    return (
      <div className="min-h-screen bg-[#F7F5EF] flex flex-col items-center justify-center p-6">
        <div
          className="text-2xl font-black tracking-tight text-[#1c1917] mb-12"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Portfoli<span className="text-[#C49A3C]">AI</span>
        </div>

        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#C49A3C] mb-3">Welcome</p>
            <h1
              className="text-3xl md:text-4xl font-bold text-[#1c1917] mb-3"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              How will you use PortfoliAI?
            </h1>
            <p className="text-[#78716c] text-sm">
              Select the profile that best fits you. You can always change it later.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <RoleCard
              icon={<User className="w-7 h-7" />}
              title="Private Investor"
              description="Manage your personal wealth, analyze your investments, and get tax reports."
              onClick={() => handleRoleSelect('investor')}
            />
            <RoleCard
              icon={<Briefcase className="w-7 h-7" />}
              title="Financial Advisor"
              description="Manage multiple clients, upload their transactions, and customize the analysis for each."
              dark
              onClick={() => handleRoleSelect('advisor')}
            />
          </div>
        </div>
      </div>
    );
  }

  // — Steps 1–3 —
  const renderStep = () => {
    if (role === 'USER') {
      if (step === 1) return <StepPersonal formData={formData} setFormData={setFormData} showCurrency />;
      if (step === 2) return <StepRiskProfile formData={formData} setFormData={setFormData} />;
    } else {
      if (step === 1) return <StepPersonal formData={formData} setFormData={setFormData} />;
      if (step === 2) return <StepConsultant formData={formData} setFormData={setFormData} />;
      if (step === 3) return <StepPreferences formData={formData} setFormData={setFormData} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5EF] flex flex-col items-center justify-center p-4">
      {/* Progress bar */}
      <div className="w-full max-w-2xl mb-8 flex items-center justify-between relative px-2">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-[rgba(196,154,60,0.2)] -z-10 rounded-full" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#C49A3C] -z-10 rounded-full transition-all duration-500"
          style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
        />

        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((num) => (
          <div
            key={num}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all duration-300 text-sm ${
              step >= num
                ? "bg-[#C49A3C] border-[#C49A3C]/30 text-white"
                : "bg-white border-[rgba(196,154,60,0.3)] text-[#a8a29e]"
            }`}
          >
            {step > num ? <Check className="w-4 h-4" /> : num}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-sm border border-[rgba(196,154,60,0.2)] p-8 md:p-12">
        <div className="min-h-75">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-12 pt-6 border-t border-[rgba(196,154,60,0.15)]">
          <button
            onClick={handlePrev}
            disabled={loading}
            className={`flex items-center gap-2 px-6 py-3 font-bold text-[#78716c] hover:bg-[#F7F5EF] rounded-xl transition-colors ${
              step === 0 ? "invisible" : "visible"
            }`}
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>

          {step < totalSteps ? (
            <button
              onClick={handleNext}
              disabled={isNextDisabled}
              className="flex items-center gap-2 px-8 py-4 bg-[#1c1917] text-white rounded-2xl font-bold hover:bg-[#2a2820] transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-4 bg-[#C49A3C] text-white rounded-2xl font-bold hover:bg-[#d4aa4c] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
              ) : (
                <><Rocket className="w-5 h-5" /> Get Started</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F5EF] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C49A3C]" />
      </div>
    }>
      <OnboardingWizard />
    </Suspense>
  );
}
