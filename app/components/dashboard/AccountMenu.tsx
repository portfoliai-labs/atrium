"use client";

import { useEffect, useRef } from "react";
import { Crown, Loader2, ArrowRight, MessagesSquare, Settings, UserRound } from "lucide-react";
import { PROFILE_SECTION } from "../../lib/dashboardNav";
import type { SubscriptionResponse } from "../../models/User";

interface AccountMenuProps {
  subscription: SubscriptionResponse | null;
  isLoading: boolean;
  onClose: () => void;
  // Opens one of the account's sections (Profile, Messages, Settings).
  onNavigate?: (section: string) => void;
  onManage?: () => void;
}

const ENTRIES = [
  { section: PROFILE_SECTION, label: "Profile", icon: UserRound },
  { section: "messages", label: "Messages", icon: MessagesSquare },
  { section: "settings", label: "Settings", icon: Settings },
];

/**
 * ACCOUNT MENU — what opens from the profile pill in the top bar: the user's plan on top (a
 * button to manage it), then their own sections (Profile, Messages, Settings, out of the Sidebar).
 */
export function AccountMenu({ subscription, isLoading, onClose, onNavigate, onManage }: AccountMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-3 w-72 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="bg-[#F7F5EF] border border-[rgba(196,154,60,0.25)] rounded-3xl shadow-2xl overflow-hidden">
        {/* The current plan, the way to manage it. */}
        <div className="p-2 pb-0">
          <button
            type="button"
            onClick={onManage}
            disabled={!onManage}
            className="flex items-center justify-between gap-2 w-full px-4 py-3 rounded-2xl bg-[#1c1917] text-white text-sm font-bold enabled:hover:bg-[#2a2622] transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Crown className="w-4 h-4 shrink-0 text-[#C49A3C]" />
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#C49A3C]" />
              ) : (
                <span className="truncate">{subscription?.plan_name ?? "Your plan"}</span>
              )}
            </span>
            {onManage && <ArrowRight className="w-4 h-4 shrink-0 text-[#857e78]" />}
          </button>
        </div>

        {onNavigate && (
          <nav role="menu" className="p-2 flex flex-col">
            {ENTRIES.map((e) => (
              <button
                key={e.section}
                type="button"
                role="menuitem"
                onClick={() => {
                  onClose();
                  onNavigate(e.section);
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#1c1917] hover:bg-white transition-colors"
              >
                <e.icon className="h-4 w-4 text-[#857e78]" />
                {e.label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
