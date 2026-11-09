"use client";

import { useEffect } from "react";
import { Crown, Loader2 } from "lucide-react";
import { userService } from "../../services/userService";
import { useAccountRead } from "../../hooks/useAccountQuery";
import { PageHeader } from "./PageHeader";
import SubscriptionSection from "./SubscriptionSection";

/**
 * SUBSCRIPTION — the user's plan, a section of its own (once Settings' first tab), opened from the
 * plan's button in the top bar's account menu and from the Sidebar's upgrade: the current plan
 * and the plans to move to. A link with `#pricing` scrolls down to the plans.
 */
export function SubscriptionPage() {
  // Shared with the top bar's account menu.
  const read = useAccountRead(["subscription"], () => userService.getSubscription());
  const loading = read === undefined;
  const subscription = read ?? null;

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

      {/* Available plans — nothing to upgrade to on a self-hosted install (every feature). Waits on
          `loading` too: subscription is null until the fetch resolves, so checking tier alone would
          flash the table on for a moment before hiding it. */}
      {!loading && subscription?.tier !== "SELF_HOSTED" && <SubscriptionSection />}
    </div>
  );
}
