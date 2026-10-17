"use client";

import { useState, useEffect } from "react";
import Script from "next/script";
import { Crown, Infinity as InfinityIcon, FileText, AlertCircle, AlertTriangle, Loader2, Bell, Save, CheckCircle2, FlaskConical, User as UserIcon, Trash2 } from "lucide-react";
import { userService } from "../../services/userService";
import type { SubscriptionResponse, UserMetrics, NotificationPreferences } from "../../models/User";
import SubscriptionSection from "./SubscriptionSection";
import { DeleteAccountModal } from "./DeleteAccountModal";
import { useUser } from "../../context/UserContext";

// Tally form used for tester applications: https://tally.so/r/QKWeYg
const TESTER_APPLICATION_FORM_ID = "QKWeYg";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${checked ? "bg-[#C49A3C]" : "bg-[#E0DACC]"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

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
  { id: "account", label: "Account", icon: UserIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SettingsSection() {
  const { user, logout } = useUser();
  const [activeTab, setActiveTab] = useState<TabId>("subscription");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    Promise.all([userService.getSubscription(), userService.getUserMetrics()])
      .then(([sub, m]) => {
        setSubscription(sub);
        setMetrics(m);
      })
      .catch((error) => console.error("Failed to load subscription:", error))
      .finally(() => setLoading(false));

    userService.getNotificationPreferences()
      .then(setPreferences)
      .catch((error) => console.error("Failed to load notification preferences:", error))
      .finally(() => setPreferencesLoading(false));
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

  const remaining = metrics?.reports_remaining ?? null;
  const used = metrics?.report_generated_this_month ?? 0;
  const unlimited = subscription?.has_unlimited_reports ?? false;
  const exhausted = !unlimited && remaining !== null && remaining <= 0;

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

  const handleDeleteAccount = async () => {
    await userService.deleteAccount();
    logout();
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <Script src="https://tally.so/widgets/embed.js" strategy="lazyOnload" />

      <div>
        <h2
          className="text-2xl md:text-3xl font-bold text-[#1c1917] tracking-tight"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Settings
        </h2>
        <p className="text-sm md:text-base text-[#78716c] font-medium mt-1">
          Manage your subscription and notification preferences
        </p>
      </div>

      {/* Tab bar — a full-width 3-column grid on mobile (so the selector never
          scrolls sideways), the original inline pill row from sm and up. */}
      <div className="grid grid-cols-3 sm:inline-flex gap-1 p-1 bg-white rounded-2xl sm:rounded-full border border-[rgba(196,154,60,0.2)]">
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] mb-1">Plan</p>
                  <p className="text-xl font-bold text-[#1c1917]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {subscription.plan_name}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    exhausted ? "bg-rose-50" : "bg-[#C49A3C]/10"
                  }`}>
                    {unlimited ? (
                      <InfinityIcon className="w-5 h-5 text-[#C49A3C]" />
                    ) : exhausted ? (
                      <AlertCircle className="w-5 h-5 text-rose-500" />
                    ) : (
                      <FileText className="w-5 h-5 text-[#C49A3C]" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${exhausted ? "text-rose-600" : "text-[#1c1917]"}`}>
                      {unlimited ? "Unlimited reports" : `${used} of ${subscription.monthly_reports_limit ?? 0} reports generated`}
                    </p>
                    <p className={`text-xs ${exhausted ? "text-rose-500 font-semibold" : "text-[#78716c]"}`}>
                      {unlimited
                        ? "No monthly limit"
                        : exhausted
                        ? "Monthly limit reached"
                        : `${remaining} remaining this month`}
                    </p>
                  </div>
                </div>
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
          {!loading && subscription?.tier !== "TESTER" && <SubscriptionSection />}
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

      {activeTab === "account" && (
        <div className="space-y-8">
          {/* Account information — read-only for now, editing is not supported yet */}
          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm space-y-5">
            <div className="flex items-center gap-3 border-b border-[rgba(196,154,60,0.15)] pb-4">
              <div className="p-2.5 bg-[#F7F5EF] text-[#C49A3C] rounded-xl">
                <UserIcon className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-[#1c1917]">Account Information</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <ReadOnlyField label="First name" value={user?.first_name ?? "—"} />
              <ReadOnlyField label="Last name" value={user?.last_name ?? "—"} />
              <ReadOnlyField label="Email" value={user?.email ?? "—"} className="sm:col-span-2" />
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
