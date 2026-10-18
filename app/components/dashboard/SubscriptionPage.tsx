"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { Crown, FlaskConical, Loader2 } from "lucide-react";
import { userService } from "../../services/userService";
import type { SubscriptionResponse } from "../../models/User";
import { PageHeader } from "./PageHeader";
import SubscriptionSection from "./SubscriptionSection";

// Tally form used for tester applications: https://tally.so/r/QKWeYg
const TESTER_APPLICATION_FORM_ID = "QKWeYg";

/**
 * SUBSCRIPTION — the user's plan, a section of its own (once Settings' first tab), opened from the
 * plan's button in the top bar's account menu and from the Sidebar's upgrade: the current plan,
 * the way to become a tester while on the free one, and the plans to move to. A link with
 * `#pricing` scrolls down to the plans.
 */
export function SubscriptionPage() {
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userService.getSubscription()
      .then(setSubscription)
      .catch((error) => console.error("Failed to load subscription:", error))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || !subscription || window.location.hash !== "#pricing") return;
    const pricingSection = document.getElementById("pricing");
    if (!pricingSection) return;
    window.requestAnimationFrame(() => {
      pricingSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loading, subscription]);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <Script src="https://tally.so/widgets/embed.js" strategy="lazyOnload" />
      <PageHeader eyebrow="Account" title="Subscription" note="Your plan, and the plans you can move to." />

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
          tier alone would flash the table on for a moment before hiding it for testers. A demo
          account (see lib/demo) can't change plan either. */}
      {!loading && subscription?.tier !== "TESTER" && subscription?.tier !== "DEMO" && <SubscriptionSection />}
    </div>
  );
}
