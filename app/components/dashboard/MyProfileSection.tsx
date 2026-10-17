"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Banknote, CheckCircle2, ChevronDown, ClipboardList, Globe, Handshake, Loader2, Lock, Save } from "lucide-react";
import { userService } from "../../services/userService";
import { useSectionView } from "../../lib/dashboardHistory";
import { PROFILE_SECTION } from "../../lib/dashboardNav";
import { TAX_REGIME_COUNTRIES, residenceOptions } from "../../lib/taxes";
import { IPS_STEPS, completedSteps } from "../../lib/ips";
import { useInvestorPolicy } from "../../hooks/useInvestorPolicy";
import { useUser } from "../../context/UserContext";
import { AdvisorMatchSection } from "./AdvisorMatchSection";
import { InvestorPolicyEditor } from "./InvestorPolicyDialog";
import { Breadcrumb } from "./Breadcrumb";

// Profile's own page, on one of its tabs, or Find an advisor under it (`tab: "advisor"`: an older
// entry's).
export type ProfilePage = "home" | "advisor";
export type ProfileTab = "preferences" | "policy";
type ProfileView = { page: ProfilePage; tab?: ProfileTab };

const parseView = (raw: unknown): ProfileView => {
  const v = raw as { page?: string; tab?: string } | undefined;
  if (v?.page === "advisor" || v?.tab === "advisor") return { page: "advisor" };
  return { page: "home", tab: v?.tab === "policy" ? "policy" : "preferences" };
};

const TABS: { id: ProfileTab; label: string; icon: typeof Globe }[] = [
  { id: "preferences", label: "Preferences", icon: Globe },
  { id: "policy", label: "Investment Policy", icon: ClipboardList },
];

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
];

const CURRENCIES = [
  { code: "USD", label: "Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "Pound (£)" },
];

/**
 * PROFILE — the user's Preferences (language, currency and, for an investor, the tax residence
 * their taxes are computed by), once Settings' tab, and an investor's Investment Policy, filled in
 * right here (InvestorPolicyEditor). Once it's complete, a button opens Find an advisor, matched on
 * it: a page under Profile, for those who want one. The page is in the section's history entry (`{ page }`), so back and forward
 * follow it. A demo account sees the preferences but can't change them.
 */
export function MyProfileSection() {
  const { user, refreshUser, isDemo } = useUser();
  const isAdvisor = user?.role === "ADVISOR";
  const [view, open] = useSectionView(PROFILE_SECTION, parseView);
  const page: ProfilePage = isAdvisor ? "home" : view.page;
  // An advisor has Preferences only.
  const tab: ProfileTab = isAdvisor ? "preferences" : view.tab ?? "preferences";
  // An investor's: an advisor has no Investment Policy of their own.
  const { policy, status, update } = useInvestorPolicy(isAdvisor ? undefined : user?.uuid);
  const done = policy ? completedSteps(policy).length : 0;

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // The tax residence ("" until set) picks the regime the investor's taxes are computed by.
  const [localeForm, setLocaleForm] = useState({ language: "en", currency: "USD", taxResidence: "" });
  const [savedResidence, setSavedResidence] = useState<string | null>(null);
  const [localeLoading, setLocaleLoading] = useState(true);
  const [localeSaving, setLocaleSaving] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);

  useEffect(() => {
    userService.getUserProfile()
      .then((profile) => {
        setLocaleForm({ language: profile.language || "en", currency: profile.currency || "USD", taxResidence: profile.tax_residence ?? "" });
        setSavedResidence(profile.tax_residence ?? null);
      })
      .catch((error) => console.error("Failed to load locale preferences:", error))
      .finally(() => setLocaleLoading(false));
  }, []);

  const handleSaveLocale = async () => {
    setLocaleSaving(true);
    try {
      // The residence only when picked: once set it's changed, not cleared.
      const residence = localeForm.taxResidence && localeForm.taxResidence !== savedResidence ? { tax_residence: localeForm.taxResidence } : {};
      await userService.updateUserProfile({ language: localeForm.language, currency: localeForm.currency, ...residence });
      if (residence.tax_residence) setSavedResidence(residence.tax_residence);
      localStorage.removeItem("user_profile");
      await refreshUser();
      setMessage({ type: "success", text: "Preferences updated" });
    } catch (error) {
      console.error("Failed to update locale preferences:", error);
      setMessage({ type: "error", text: "Error saving preferences" });
    } finally {
      setLocaleSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Advisors are matched on the whole policy: the way to them opens once it's complete.
  const complete = !!policy && done === IPS_STEPS.length;

  if (page === "advisor") {
    return (
      <div className="space-y-6 pb-12">
        <Breadcrumb trail={[{ label: "Profile", onClick: () => open({ page: "home" }) }]} current="Find an advisor" />
        {/* Without a policy there's nothing to match on: it's filled in on Profile. */}
        <AdvisorMatchSection onOpenPolicy={() => open({ page: "home", tab: "policy" })} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      {!isAdvisor && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid grid-cols-2 sm:inline-flex gap-1 p-1 bg-white rounded-2xl sm:rounded-full border border-[rgba(196,154,60,0.2)]">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => open({ page: "home", tab: t.id }, true)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-5 py-2.5 sm:py-2 rounded-xl sm:rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider transition-colors ${
                  t.id === tab ? "bg-[#1c1917] text-white" : "text-[#78716c] hover:text-[#1c1917]"
                }`}
              >
                <t.icon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => open({ page: "advisor" })}
            disabled={!complete}
            title={complete ? undefined : "Complete your Investment Policy first"}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[rgba(196,154,60,0.3)] bg-white text-xs font-bold text-[#1c1917] hover:border-[#C49A3C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[rgba(196,154,60,0.3)]"
          >
            {complete ? <Handshake className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />} Find an advisor
          </button>
        </div>
      )}

      {tab === "preferences" && (

      <>
          {isDemo && (
            <p className="text-xs font-semibold text-[#78716c]">
              Your preferences can be looked at but not changed on a demo account.
            </p>
          )}
          {/* Every field and button below is disabled for a demo account (see lib/demo). */}
          <fieldset disabled={isDemo} className="contents">
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm space-y-6">
              <div className="flex items-center justify-between gap-4 border-b border-[rgba(196,154,60,0.15)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#F7F5EF] text-[#C49A3C] rounded-xl">
                    <Globe className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-sm text-[#1c1917]">Preferences</span>
                </div>
                <button
                  onClick={handleSaveLocale}
                  disabled={localeSaving || localeLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1c1917] text-white rounded-xl font-bold text-xs hover:bg-[#C49A3C] transition-colors disabled:opacity-50"
                >
                  {localeSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {localeSaving ? "Saving..." : "Save"}
                </button>
              </div>

              {localeLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-[#C49A3C]" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] ml-1">Language</label>
                    <div className="relative">
                      <button
                        onClick={() => setIsLangOpen(!isLangOpen)}
                        className="w-full flex items-center justify-between p-3.5 bg-white border border-[rgba(196,154,60,0.25)] rounded-xl font-medium text-[#1c1917] hover:border-[#C49A3C] transition-all focus:ring-4 focus:ring-[#C49A3C]/10"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-lg leading-none">{LANGUAGES.find(l => l.code === localeForm.language)?.flag}</span>
                          {LANGUAGES.find(l => l.code === localeForm.language)?.label}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-[#a8a29e] transition-transform ${isLangOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isLangOpen && (
                        <div className="absolute z-10 w-full mt-2 bg-white border border-[rgba(196,154,60,0.2)] rounded-xl shadow-xl overflow-hidden">
                          {LANGUAGES.map(l => (
                            <button
                              key={l.code}
                              onClick={() => { setLocaleForm({ ...localeForm, language: l.code }); setIsLangOpen(false); }}
                              className="w-full p-3.5 text-left font-medium hover:bg-[#F7F5EF] text-[#1c1917] flex items-center gap-2"
                            >
                              <span className="text-lg leading-none">{l.flag}</span> {l.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] ml-1">Currency</label>
                    <div className="relative">
                      <button
                        onClick={() => setIsCurrencyOpen(!isCurrencyOpen)}
                        className="w-full flex items-center justify-between p-3.5 bg-white border border-[rgba(196,154,60,0.25)] rounded-xl font-medium text-[#1c1917] hover:border-[#C49A3C] transition-all focus:ring-4 focus:ring-[#C49A3C]/10"
                      >
                        <span className="flex items-center gap-2">
                          <Banknote className="w-4 h-4 text-[#a8a29e]" /> {localeForm.currency}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-[#a8a29e] transition-transform ${isCurrencyOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isCurrencyOpen && (
                        <div className="absolute z-10 w-full mt-2 bg-white border border-[rgba(196,154,60,0.2)] rounded-xl shadow-xl overflow-hidden">
                          {CURRENCIES.map(c => (
                            <button
                              key={c.code}
                              onClick={() => { setLocaleForm({ ...localeForm, currency: c.code }); setIsCurrencyOpen(false); }}
                              className="w-full p-3.5 text-left font-medium hover:bg-[#F7F5EF] text-[#1c1917]"
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* An investor's taxes are computed by their residence's regime (see the investments' Taxes). */}
                  {user?.role !== "ADVISOR" && (
                    <div className="space-y-2">
                      <label htmlFor="tax-residence" className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] ml-1">Tax residence</label>
                      <div className="relative">
                        <select
                          id="tax-residence"
                          value={localeForm.taxResidence}
                          onChange={(e) => setLocaleForm({ ...localeForm, taxResidence: e.target.value })}
                          className="w-full appearance-none p-3.5 pr-10 bg-white border border-[rgba(196,154,60,0.25)] rounded-xl font-medium text-[#1c1917] hover:border-[#C49A3C] transition-all outline-none focus:ring-4 focus:ring-[#C49A3C]/10"
                        >
                          {!localeForm.taxResidence && <option value="" disabled>Not set</option>}
                          {residenceOptions(savedResidence).map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a8a29e]" />
                      </div>
                      <p className="text-[11px] text-[#78716c] ml-1">
                        {localeForm.taxResidence && !TAX_REGIME_COUNTRIES.includes(localeForm.taxResidence)
                          ? "Taxes are computed for residents of Italy only, for now."
                          : "Where you pay taxes: your investments' taxes are estimated by its rules."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </fieldset>
      </>
      )}

      {/* Saved as it's filled in, step by step. */}
      {tab === "policy" && (policy
        ? <InvestorPolicyEditor policy={policy} status={status} update={update} />
        : <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#C49A3C]" /></div>)}
      {tab === "policy" && policy && !complete && (
        <p className="text-xs font-semibold text-[#78716c]">Complete it to find an advisor matched on it.</p>
      )}

      {message && (
        <div className={`fixed bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 px-6 md:px-8 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 z-50 ${message.type === 'success' ? 'bg-[#1c1917] text-white' : 'bg-rose-500 text-white'}`}>
          {message.type === 'success'
            ? <CheckCircle2 className="w-5 h-5 text-[#C49A3C]" />
            : <AlertCircle className="w-5 h-5" />
          }
          <span className="font-semibold text-sm md:text-base">{message.text}</span>
        </div>
      )}
    </div>
  );
}
