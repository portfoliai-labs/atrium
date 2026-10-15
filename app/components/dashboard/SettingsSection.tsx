"use client";

import { useState, useEffect } from "react";
import Script from "next/script";
import { Crown, AlertCircle, AlertTriangle, Loader2, Bell, Save, CheckCircle2, FlaskConical, User as UserIcon, Trash2, Globe, ChevronDown, Banknote, Mail, Lock } from "lucide-react";
import { userService } from "../../services/userService";
import { supabase } from "../../lib/supabaseClient";
import type { SubscriptionResponse, NotificationPreferences } from "../../models/User";
import SubscriptionSection from "./SubscriptionSection";
import { DeleteAccountModal } from "./DeleteAccountModal";
import { Toggle } from "./Toggle";
import { useUser } from "../../context/UserContext";

// Tally form used for tester applications: https://tally.so/r/QKWeYg
const TESTER_APPLICATION_FORM_ID = "QKWeYg";

function PreferenceRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-[rgba(196,154,60,0.1)] last:border-0">
      <div>
        <p className="text-sm font-bold text-[#1c1917]">{title}</p>
        <p className="text-xs text-[#78716c] mt-0.5">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function ReadOnlyField({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-bold text-[#78716c] uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={value}
        disabled
        readOnly
        className="w-full h-11 px-3.5 rounded-xl bg-[#F7F5EF] border border-[rgba(196,154,60,0.2)] text-[#1c1917] text-sm font-semibold outline-none cursor-not-allowed"
      />
    </div>
  );
}

const TABS = [
  { id: "subscription", label: "Subscription", icon: Crown },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "preferences", label: "Preferences", icon: Globe },
  { id: "account", label: "Account", icon: UserIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

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

export function SettingsSection() {
  const { user, logout, refreshUser, isDemo } = useUser();
  const [activeTab, setActiveTab] = useState<TabId>("subscription");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [localeForm, setLocaleForm] = useState({ language: "en", currency: "USD" });
  const [localeLoading, setLocaleLoading] = useState(true);
  const [localeSaving, setLocaleSaving] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);

  const [nameForm, setNameForm] = useState({ first_name: "", last_name: "" });
  const [savingName, setSavingName] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    userService.getSubscription()
      .then(setSubscription)
      .catch((error) => console.error("Failed to load subscription:", error))
      .finally(() => setLoading(false));

    userService.getNotificationPreferences()
      .then(setPreferences)
      .catch((error) => console.error("Failed to load notification preferences:", error))
      .finally(() => setPreferencesLoading(false));

    userService.getUserProfile()
      .then((profile) => {
        setLocaleForm({ language: profile.language || "en", currency: profile.currency || "USD" });
        setNameForm({ first_name: profile.first_name ?? "", last_name: profile.last_name ?? "" });
      })
      .catch((error) => console.error("Failed to load locale preferences:", error))
      .finally(() => setLocaleLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loading || !subscription || window.location.hash !== "#pricing") return;

    const pricingSection = document.getElementById("pricing");
    if (!pricingSection) return;

    window.requestAnimationFrame(() => {
      pricingSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loading, subscription]);

  const setPreference = (field: keyof Omit<NotificationPreferences, "updated_at">) => (value: boolean) => {
    setPreferences((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSavePreferences = async () => {
    if (!preferences) return;
    setSaving(true);
    try {
      const updated = await userService.updateNotificationPreferences({
        report_status_email: preferences.report_status_email,
        marketing_email: preferences.marketing_email,
        product_updates_email: preferences.product_updates_email,
        in_app_notifications: preferences.in_app_notifications,
      });
      setPreferences(updated);
      setMessage({ type: "success", text: "Notification preferences updated" });
    } catch (error) {
      console.error("Failed to update notification preferences:", error);
      setMessage({ type: "error", text: "Error saving notification preferences" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleSaveLocale = async () => {
    setLocaleSaving(true);
    try {
      await userService.updateUserProfile({ language: localeForm.language, currency: localeForm.currency });
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

  const handleSaveName = async () => {
    // Backend rejects blank/whitespace-only names outright (422) — checked up front so
    // clearing a field shows a clear error instead of a round-trip failure.
    const firstName = nameForm.first_name.trim();
    const lastName = nameForm.last_name.trim();
    if (!firstName || !lastName) {
      setMessage({ type: "error", text: "First and last name can't be empty" });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setSavingName(true);
    try {
      await userService.updateUserProfile({ first_name: firstName, last_name: lastName });
      localStorage.removeItem("user_profile");
      await refreshUser();
      setMessage({ type: "success", text: "Account information updated" });
    } catch (error) {
      console.error("Failed to update account information:", error);
      setMessage({ type: "error", text: "Error updating account information" });
    } finally {
      setSavingName(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleUpdateEmail = async () => {
    // Supabase, not apiFetch: its read-only guard doesn't cover this one.
    if (isDemo || !newEmail.trim()) return;
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      setMessage({ type: "success", text: "Check your new email inbox to confirm the change" });
      setNewEmail("");
    } catch (error) {
      console.error("Failed to update email:", error);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error updating email" });
    } finally {
      setSavingEmail(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleUpdatePassword = async () => {
    if (isDemo) return;
    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords don't match" });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMessage({ type: "success", text: "Password updated" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Failed to update password:", error);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Error updating password" });
    } finally {
      setSavingPassword(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDeleteAccount = async () => {
    if (isDemo) return;
    await userService.deleteAccount();
    logout();
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      <Script src="https://tally.so/widgets/embed.js" strategy="lazyOnload" />

      {/* Tab bar — a full-width 2-column grid on mobile (so the selector never
          scrolls sideways), the original inline pill row from sm and up. */}
      <div className="grid grid-cols-2 sm:inline-flex gap-1 p-1 bg-white rounded-2xl sm:rounded-full border border-[rgba(196,154,60,0.2)]">
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-5 py-2.5 sm:py-2 rounded-xl sm:rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider transition-colors ${
                active ? "bg-[#1c1917] text-white" : "text-[#78716c] hover:text-[#1c1917]"
              }`}
            >
              <tab.icon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {isDemo && (
        <p className="text-xs font-semibold text-[#78716c]">
          Settings can be looked at but not changed on a demo account: profile, email, password, preferences and the account itself are locked.
        </p>
      )}

      {/* Every field and button below is disabled for a demo account (see lib/demo). */}
      <fieldset disabled={isDemo} className="contents">
      {activeTab === "subscription" && (
        <div className="space-y-8">
          {/* Current plan */}
          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-[rgba(196,154,60,0.15)] pb-4">
              <div className="p-2.5 bg-[#F7F5EF] text-[#C49A3C] rounded-xl">
                <Crown className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-[#1c1917]">Current Plan</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-[#C49A3C]" />
              </div>
            ) : !subscription ? (
              <p className="text-sm text-[#78716c]">Unable to load subscription.</p>
            ) : (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] mb-1">Plan</p>
                <p className="text-xl font-bold text-[#1c1917]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {subscription.plan_name}
                </p>
              </div>
            )}
          </div>

          {/* Tester program CTA — only relevant while still on the free tier */}
          {!loading && subscription?.tier === "FREE" && (
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#C49A3C]/10 shrink-0">
                <FlaskConical className="w-6 h-6 text-[#C49A3C]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#1c1917]">Want to become a tester?</p>
                <p className="text-xs text-[#78716c] mt-0.5">
                  Fill out a short form and we&apos;ll review your request for early, unlimited access.
                </p>
              </div>
              <button
                data-tally-open={TESTER_APPLICATION_FORM_ID}
                data-tally-layout="modal"
                data-tally-width="600"
                data-tally-emoji-text="🧪"
                data-tally-emoji-animation="wave"
                className="shrink-0 px-5 py-2.5 bg-[#1c1917] text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#C49A3C] transition-colors"
              >
                Apply Now
              </button>
            </div>
          )}

          {/* Available plans — testers already have the best available access, nothing to upgrade to.
              Waits on `loading` too: subscription is null until the fetch resolves, so checking
              tier alone would flash the table on for a moment before hiding it for testers. */}
          {/* A demo account (see lib/demo) can't change plan either. */}
          {!loading && subscription?.tier !== "TESTER" && subscription?.tier !== "DEMO" && <SubscriptionSection />}
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-4 border-b border-[rgba(196,154,60,0.15)] pb-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#F7F5EF] text-[#C49A3C] rounded-xl">
                <Bell className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-[#1c1917]">Notifications</span>
            </div>
            <button
              onClick={handleSavePreferences}
              disabled={saving || preferencesLoading || !preferences}
              className="flex items-center gap-2 px-4 py-2 bg-[#1c1917] text-white rounded-xl font-bold text-xs hover:bg-[#C49A3C] transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? "Saving..." : "Save"}
            </button>
          </div>

          {preferencesLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-[#C49A3C]" />
            </div>
          ) : !preferences ? (
            <p className="text-sm text-[#78716c]">Unable to load notification preferences.</p>
          ) : (
            <div>
              <PreferenceRow
                title="Report status emails"
                description="Get an email when a report finishes processing or fails"
                checked={preferences.report_status_email}
                onChange={setPreference("report_status_email")}
              />
              <PreferenceRow
                title="Product updates"
                description="Hear about new features and improvements"
                checked={preferences.product_updates_email}
                onChange={setPreference("product_updates_email")}
              />
              <PreferenceRow
                title="Marketing emails"
                description="Tips, offers and news from PortfoliAI"
                checked={preferences.marketing_email}
                onChange={setPreference("marketing_email")}
              />
              <PreferenceRow
                title="In-app notifications"
                description="Show notifications in the bell icon within the app"
                checked={preferences.in_app_notifications}
                onChange={setPreference("in_app_notifications")}
              />
            </div>
          )}
        </div>
      )}


      {activeTab === "preferences" && (
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
            </div>
          )}
        </div>
      )}

      {activeTab === "account" && (
        <div className="space-y-8">
          {/* Account information */}
          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm space-y-5">
            <div className="flex items-center justify-between gap-4 border-b border-[rgba(196,154,60,0.15)] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#F7F5EF] text-[#C49A3C] rounded-xl">
                  <UserIcon className="w-5 h-5" />
                </div>
                <span className="font-bold text-sm text-[#1c1917]">Account Information</span>
              </div>
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="flex items-center gap-2 px-4 py-2 bg-[#1c1917] text-white rounded-xl font-bold text-xs hover:bg-[#C49A3C] transition-colors disabled:opacity-50"
              >
                {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {savingName ? "Saving..." : "Save"}
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#78716c] uppercase tracking-wider mb-1.5">
                  First name
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={nameForm.first_name}
                  onChange={(e) => setNameForm({ ...nameForm, first_name: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl bg-white border border-[rgba(196,154,60,0.25)] text-[#1c1917] text-sm font-semibold outline-none focus:border-[#C49A3C] focus:ring-4 focus:ring-[#C49A3C]/10 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#78716c] uppercase tracking-wider mb-1.5">
                  Last name
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={nameForm.last_name}
                  onChange={(e) => setNameForm({ ...nameForm, last_name: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl bg-white border border-[rgba(196,154,60,0.25)] text-[#1c1917] text-sm font-semibold outline-none focus:border-[#C49A3C] focus:ring-4 focus:ring-[#C49A3C]/10 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm space-y-5">
            <div className="flex items-center gap-3 border-b border-[rgba(196,154,60,0.15)] pb-4">
              <div className="p-2.5 bg-[#F7F5EF] text-[#C49A3C] rounded-xl">
                <Mail className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-[#1c1917]">Email Address</span>
            </div>
            <ReadOnlyField label="Current email" value={user?.email ?? "—"} />
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-[#78716c] uppercase tracking-wider mb-1.5">
                  New email
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-white border border-[rgba(196,154,60,0.25)] text-[#1c1917] text-sm font-semibold outline-none focus:border-[#C49A3C] focus:ring-4 focus:ring-[#C49A3C]/10 transition-all"
                />
              </div>
              <button
                onClick={handleUpdateEmail}
                disabled={savingEmail || !newEmail.trim()}
                className="h-11 shrink-0 flex items-center justify-center gap-2 px-5 bg-[#1c1917] text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#C49A3C] transition-colors disabled:opacity-50"
              >
                {savingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Update email"}
              </button>
            </div>
            <p className="text-xs text-[#78716c]">
              We&apos;ll send a confirmation link to the new address before the change takes effect.
            </p>
          </div>

          {/* Password */}
          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm space-y-5">
            <div className="flex items-center gap-3 border-b border-[rgba(196,154,60,0.15)] pb-4">
              <div className="p-2.5 bg-[#F7F5EF] text-[#C49A3C] rounded-xl">
                <Lock className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-[#1c1917]">Password</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#78716c] uppercase tracking-wider mb-1.5">
                  New password
                </label>
                <input
                  type="password"
                  minLength={6}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-white border border-[rgba(196,154,60,0.25)] text-[#1c1917] text-sm font-semibold outline-none focus:border-[#C49A3C] focus:ring-4 focus:ring-[#C49A3C]/10 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#78716c] uppercase tracking-wider mb-1.5">
                  Confirm password
                </label>
                <input
                  type="password"
                  minLength={6}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-white border border-[rgba(196,154,60,0.25)] text-[#1c1917] text-sm font-semibold outline-none focus:border-[#C49A3C] focus:ring-4 focus:ring-[#C49A3C]/10 transition-all"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleUpdatePassword}
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1c1917] text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#C49A3C] transition-colors disabled:opacity-50"
              >
                {savingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Update password"}
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-rose-200 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-rose-100 pb-4">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-rose-600">Danger Zone</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div>
                <p className="text-sm font-bold text-[#1c1917]">Delete account</p>
                <p className="text-xs text-[#78716c] mt-0.5">
                  Permanently delete your account and all associated data. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-rose-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      </fieldset>

      {message && (
        <div className={`fixed bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 px-6 md:px-8 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 z-50 ${message.type === 'success' ? 'bg-[#1c1917] text-white' : 'bg-rose-500 text-white'}`}>
          {message.type === 'success'
            ? <CheckCircle2 className="w-5 h-5 text-[#C49A3C]" />
            : <AlertCircle className="w-5 h-5" />
          }
          <span className="font-semibold text-sm md:text-base">{message.text}</span>
        </div>
      )}

      {showDeleteModal && user && (
        <DeleteAccountModal
          email={user.email}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteAccount}
        />
      )}
    </div>
  );
}
