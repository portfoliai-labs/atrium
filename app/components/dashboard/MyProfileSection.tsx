"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Download, Loader2, Save } from "lucide-react";
import { userService } from "../../services/userService";
import { accountKey, useAccountRead } from "../../hooks/useAccountQuery";
import type { UserProfile } from "../../models/User";
import { useSectionView } from "../../lib/dashboardHistory";
import { PROFILE_SECTION } from "../../lib/dashboardNav";
import { TAX_REGIME_COUNTRIES, residenceOptions } from "../../lib/taxes";
import { IPS_STEPS, completedSteps, policyToMarkdown } from "../../lib/ips";
import { useInvestorPolicy } from "../../hooks/useInvestorPolicy";
import { useUser } from "../../context/UserContext";
import { usePortfolio } from "../../context/PortfolioContext";
import { AdvisorMatchSection } from "./AdvisorMatchSection";
import { InvestorPolicyEditor, riskToleranceLabel } from "./InvestorPolicyDialog";
import { PROFILE_GRID, PolicyCards, ProfileCard, ProfileDialog, ProfileRows } from "./ips/PolicyCards";
import { Breadcrumb } from "./Breadcrumb";

// Profile's own page (the preferences), an investor's Investment Policy (set up step by step, then
// its cards) or Find an advisor, each opened from the account menu (an older entry's `page:
// "setup"`, `tab: "policy"` and `tab: "advisor"` too).
export type ProfilePage = "home" | "policy" | "advisor";

const parseView = (raw: unknown): { page: ProfilePage } => {
  const v = raw as { page?: string; tab?: string } | undefined;
  if (v?.page === "advisor" || v?.tab === "advisor") return { page: "advisor" };
  if (v?.page === "policy" || v?.page === "setup" || v?.tab === "policy") return { page: "policy" };
  return { page: "home" };
};

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
 * their taxes are computed by), once Settings' tab, and two pages of an investor's, each an entry
 * of the account menu: the Investment Policy and Find an advisor. The first time, the policy is
 * set up step by step (InvestorPolicyEditor); once it's complete, its page shows it as cards, a
 * step each, each edited on its own (PolicyCards). Advisors are matched on it, so Find an advisor
 * asks for it first (see AdvisorMatchSection). The page is in the section's history entry
 * (`{ page }`), so back and forward follow it. A demo account sees the preferences but can't
 * change them.
 */
export function MyProfileSection() {
  const { user } = useUser();
  const isAdvisor = user?.role === "ADVISOR";
  const [view, open] = useSectionView(PROFILE_SECTION, parseView);
  const page: ProfilePage = isAdvisor ? "home" : view.page;
  // An investor's, on its page: an advisor has no Investment Policy of their own.
  const { policy, status, update } = useInvestorPolicy(isAdvisor || page !== "policy" ? undefined : user?.uuid);
  const done = policy ? completedSteps(policy).length : 0;

  const complete = !!policy && done === IPS_STEPS.length;
  // Once set up, the policy is the cards for the rest of the visit, even should an edit leave a
  // step incomplete (its card says what's missing); until then, the guided setup.
  const [settled, setSettled] = useState(false);
  if (complete && !settled) setSettled(true);
  const asCards = complete || settled;
  const currency = user?.currency || "USD";
  const riskTolerance = riskToleranceLabel(user?.risk_tolerance);

  const download = () => {
    if (!policy) return;
    const url = URL.createObjectURL(new Blob([policyToMarkdown(policy, { currency, riskTolerance })], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "investor-policy-statement.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (page === "advisor") {
    return (
      <div className="space-y-6 pb-12">
        <Breadcrumb trail={[]} current="Find an advisor" hidden />
        {/* Without a policy there's nothing to match on: it's set up on its own page. */}
        <AdvisorMatchSection onOpenPolicy={() => open({ page: "policy" })} />
      </div>
    );
  }

  if (page === "policy") {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-500">
        <Breadcrumb
          trail={[]}
          current="Investment Policy"
          right={policy && asCards ? (
            <button
              type="button"
              onClick={download}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[rgba(196,154,60,0.3)] bg-white text-xs font-bold text-[#1c1917] hover:border-[#C49A3C] transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Download policy
            </button>
          ) : undefined}
        />
        {!policy
          ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#C49A3C]" /></div>
          : asCards
            ? <PolicyCards policy={policy} status={status} update={update} currency={currency} riskTolerance={riskTolerance} />
            // Saved as it's filled in: leaving at any step loses nothing. Once complete, its cards.
            : <InvestorPolicyEditor policy={policy} status={status} update={update} />}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      <div className={PROFILE_GRID}><PreferencesCard /></div>
    </div>
  );
}

/**
 * PREFERENCES — Profile's first card: the language, the currency and, for an investor, the tax
 * residence their taxes are computed by (see the investments' Taxes), edited in a dialog. A demo
 * account sees them but can't change them.
 */
function PreferencesCard() {
  const { user, refreshUser, isDemo } = useUser();
  const { changed } = usePortfolio();
  const isAdvisor = user?.role === "ADVISOR";
  const queryClient = useQueryClient();
  // The profile, as Settings reads it too.
  const profile = useAccountRead(["profile"], () => userService.getUserProfile());
  // The tax residence ("" until set) picks the regime the investor's taxes are computed by.
  const saved = profile
    ? { language: profile.language || "en", currency: profile.currency || "USD", taxResidence: profile.tax_residence ?? "" }
    : null;
  const [form, setForm] = useState({ language: "en", currency: "USD", taxResidence: "" });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const edit = () => {
    if (!saved) return;
    setForm(saved);
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    if (!saved) return;
    setSaving(true);
    setError(null);
    try {
      // The residence only when picked: once set it's changed, not cleared.
      const residence = form.taxResidence && form.taxResidence !== saved.taxResidence ? { tax_residence: form.taxResidence } : {};
      await userService.updateUserProfile({ language: form.language, currency: form.currency, ...residence });
      localStorage.removeItem("user_profile");
      await refreshUser({ silent: true });
      // The figures in the reference currency, the taxes by the residence's regime.
      changed();
      // The profile as saved, here and wherever else it's read.
      queryClient.setQueryData<UserProfile>(accountKey("profile"), (prev) => prev && {
        ...prev, language: form.language, currency: form.currency, tax_residence: form.taxResidence || saved.taxResidence || null,
      });
      setEditing(false);
    } catch (err) {
      console.error("Failed to update locale preferences:", err);
      setError("Couldn't save your preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const language = (code: string) => {
    const l = LANGUAGES.find((x) => x.code === code);
    return l ? `${l.flag} ${l.label}` : code;
  };
  const currencyLabel = (code: string) => CURRENCIES.find((c) => c.code === code)?.label ?? code;
  const residence = (code: string) =>
    code ? residenceOptions(saved?.taxResidence || null).find((o) => o.code === code)?.label ?? code : "Not specified";
  const select = "w-full h-11 appearance-none px-3.5 pr-10 bg-white border border-[rgba(196,154,60,0.25)] rounded-xl text-sm font-semibold text-[#1c1917] hover:border-[#C49A3C] transition-all outline-none focus:ring-4 focus:ring-[#C49A3C]/10 disabled:opacity-60";
  const label = "block text-[10px] font-bold uppercase tracking-wider text-[#78716c] mb-1.5";

  return (
    <>
      <ProfileCard
        title="Preferences"
        description={isAdvisor ? "Your language and currency." : "Your language, currency and where you pay taxes."}
        onEdit={edit}
        editDisabled={isDemo ? "Preferences can't be changed on a demo account" : saved ? undefined : "Loading…"}
      >
        {saved ? (
          <ProfileRows rows={[
            { label: "Language", value: language(saved.language) },
            { label: "Currency", value: currencyLabel(saved.currency) },
            ...(isAdvisor ? [] : [{ label: "Tax residence", value: residence(saved.taxResidence) }]),
          ]} />
        ) : (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-[#C49A3C]" /></div>
        )}
      </ProfileCard>

      {editing && (
        <ProfileDialog
          title="Preferences"
          description={isAdvisor ? "Your language and currency." : "Your language, currency and where you pay taxes."}
          onClose={() => !saving && setEditing(false)}
          footer={(
            <>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="px-5 py-3 rounded-xl text-sm font-bold text-[#78716c] hover:bg-[#F7F5EF] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          )}
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="pref-language" className={label}>Language</label>
              <div className="relative">
                <select id="pref-language" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} disabled={saving} className={select}>
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#857e78]" />
              </div>
            </div>
            <div>
              <label htmlFor="pref-currency" className={label}>Currency</label>
              <div className="relative">
                <select id="pref-currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} disabled={saving} className={select}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#857e78]" />
              </div>
            </div>
            {!isAdvisor && (
              <div>
                <label htmlFor="pref-residence" className={label}>Tax residence</label>
                <div className="relative">
                  <select id="pref-residence" value={form.taxResidence} onChange={(e) => setForm({ ...form, taxResidence: e.target.value })} disabled={saving} className={select}>
                    {!form.taxResidence && <option value="" disabled>Not set</option>}
                    {residenceOptions(saved?.taxResidence || null).map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#857e78]" />
                </div>
                <p className="text-[11px] text-[#78716c] mt-1.5">
                  {form.taxResidence && !TAX_REGIME_COUNTRIES.includes(form.taxResidence)
                    ? "Taxes are computed for residents of Italy only, for now."
                    : "Your investments' taxes are estimated by its rules."}
                </p>
              </div>
            )}
            {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          </div>
        </ProfileDialog>
      )}
    </>
  );
}
