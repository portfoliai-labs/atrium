"use client";

import { useState } from "react";
import { LogOut, Bell, Menu, X } from "lucide-react";
import Image from "next/image";
import { useUser } from "../../context/UserContext";
import { useNotificationsContext } from "../../context/NotificationsContext";
import { NotificationPanel } from "./NotificationPanel";
import { SubscriptionPopover } from "./SubscriptionPopover";
import { userService } from "../../services/userService";
import { BetaBadge } from "../common/BetaBadge";
import type { SubscriptionTier, SubscriptionResponse } from "../../models/User";

const TIER_LABEL: Record<SubscriptionTier, string> = {
  FREE: 'Free Plan',
  TESTER: 'Tester',
  DEMO: 'Demo',
};

interface DashboardHeaderProps {
  onLogout: () => void;
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
  subscriptionTier?: SubscriptionTier | null;
  onNavigate?: (section: string) => void;
  // A section on one of its pages (a notification's link), as the Sidebar's rows open them.
  onOpenPage?: (section: string, view: unknown) => void;
}

export function DashboardHeader({ onLogout, onMenuToggle, isMenuOpen, subscriptionTier, onNavigate, onOpenPage }: DashboardHeaderProps) {
  const {
    notifications,
    hasUnread,
    isLoading,
    loadNotifications,
    markAllRead,
    dismissAll,
  } = useNotificationsContext();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);

  const { user } = useUser();

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  const initials = `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? "U"}`.toUpperCase();

  async function handleBellClick() {
    const opening = !isPanelOpen;
    setIsPanelOpen(opening);
    if (opening) {
      const items = await loadNotifications();
      markAllRead(items);
    }
  }

  function handleProfileClick() {
    const opening = !isSubscriptionOpen;
    setIsSubscriptionOpen(opening);
    if (opening) {
      setIsSubscriptionLoading(true);
      userService.getSubscription()
        .then(setSubscription)
        .catch((error) => console.error("Failed to fetch subscription:", error))
        .finally(() => setIsSubscriptionLoading(false));
    }
  }

  return (
    <header className="sticky top-0 z-[60] w-full bg-[#F7F5EF] border-b border-[rgba(196,154,60,0.2)] px-4 md:px-8 py-4 flex justify-between items-center transition-all">
      {/* LEFT: Hamburger + Logo */}
      <div className="flex items-center gap-3 md:gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 -ml-2 text-[#78716c] hover:text-[#1c1917] rounded-xl hover:bg-[#E0DACC] transition-colors"
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        <div className="flex items-center gap-2">
          <div
            className="text-xl md:text-2xl font-black tracking-tight text-[#1c1917]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Portfoli<span className="text-[#C49A3C]">AI</span>
          </div>
          <BetaBadge />
        </div>

        {user?.first_name && (
          <div className="hidden lg:flex items-center gap-2 ml-4 px-4 py-1.5 bg-white/70 rounded-full border border-[rgba(196,154,60,0.25)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-bold text-[#78716c]">
              Welcome back, {user.first_name}!
            </span>
          </div>
        )}
      </div>

      {/* RIGHT: Actions */}
      <div className="flex items-center gap-2 md:gap-3">

        {/* Bell (mobile) — a fixed-width absolute dropdown has nowhere to sit on a
            narrow viewport without overflowing it, so mobile routes to the
            full-page NotificationsSection instead. */}
        <button
          onClick={() => onNavigate?.("notifications")}
          className="relative md:hidden p-2 text-[#a8a29e] hover:text-[#1c1917] hover:bg-[#E0DACC] rounded-xl transition-all"
        >
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <span className="absolute top-2 right-2 h-2 w-2 bg-rose-500 rounded-full border-2 border-[#F7F5EF]" />
          )}
        </button>

        {/* Bell + panel (desktop dropdown) */}
        <div className="relative hidden md:block">
          <button
            onClick={handleBellClick}
            className="relative p-2.5 text-[#a8a29e] hover:text-[#1c1917] hover:bg-[#E0DACC] rounded-2xl transition-all"
          >
            <Bell className="h-5 w-5" />
            {hasUnread && (
              <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-rose-500 rounded-full border-2 border-[#F7F5EF]" />
            )}
          </button>

          {isPanelOpen && (
            <NotificationPanel
              notifications={notifications}
              isLoading={isLoading}
              onClose={() => setIsPanelOpen(false)}
              onDismissAll={() => { dismissAll(); setIsPanelOpen(false); }}
              onOpenPage={onOpenPage ? (section, view) => { setIsPanelOpen(false); onOpenPage(section, view); } : undefined}
            />
          )}
        </div>

        <div className="hidden md:block h-8 w-px bg-[#E0DACC] mx-2" />

        {/* Profile pill */}
        <div className="relative">
          <button
            onClick={handleProfileClick}
            className="flex items-center gap-3 p-1 md:p-1.5 md:pr-4 rounded-full md:rounded-[1.25rem] bg-white/70 border border-[rgba(196,154,60,0.25)] hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="relative h-8 w-8 md:h-9 md:w-9 rounded-full md:rounded-xl bg-[#1c1917] flex items-center justify-center text-white shadow-inner overflow-hidden">
              {user?.profile_picture ? (
                <Image
                  src={user.profile_picture}
                  alt="Profile"
                  fill
                  sizes="36px"
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="font-bold text-xs">{initials}</span>
              )}
            </div>

            <div className="hidden md:flex flex-col">
              <span className="text-sm font-bold text-[#1c1917] leading-none mb-1">
                {fullName || "User Account"}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-[#C49A3C] uppercase tracking-wide">
                  {subscriptionTier ? TIER_LABEL[subscriptionTier] : 'Free Plan'}
                </span>
              </div>
            </div>
          </button>

          {isSubscriptionOpen && (
            <SubscriptionPopover
              subscription={subscription}
              isLoading={isSubscriptionLoading}
              onClose={() => setIsSubscriptionOpen(false)}
              onManage={onNavigate ? () => {
                setIsSubscriptionOpen(false);
                onNavigate("settings");
                if (typeof window !== "undefined") {
                  window.location.hash = "pricing";
                }
              } : undefined}
            />
          )}
        </div>

        <button
          onClick={onLogout}
          className="ml-1 md:ml-2 p-2 md:p-2.5 text-[#a8a29e] hover:text-rose-600 hover:bg-rose-50 rounded-xl md:rounded-2xl transition-all group"
          title="Sign Out"
        >
          <LogOut className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </header>
  );
}
