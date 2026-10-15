"use client";

import { useEffect, useRef } from "react";
import { Crown, Loader2, ArrowRight } from "lucide-react";
import type { SubscriptionResponse } from "../../models/User";

interface SubscriptionPopoverProps {
  subscription: SubscriptionResponse | null;
  isLoading: boolean;
  onClose: () => void;
  onManage?: () => void;
}

export function SubscriptionPopover({ subscription, isLoading, onClose, onManage }: SubscriptionPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-3 w-72 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="bg-[#F7F5EF] border border-[rgba(196,154,60,0.25)] rounded-[1.5rem] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[rgba(196,154,60,0.15)]">
          <Crown className="w-4 h-4 text-[#C49A3C]" />
          <span
            className="font-bold text-sm text-[#1c1917]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Subscription
          </span>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-[#C49A3C]" />
            </div>
          ) : !subscription ? (
            <p className="text-sm text-[#78716c] py-2">Unable to load subscription.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a8a29e] mb-1">Plan</p>
                <p className="text-sm font-bold text-[#1c1917]">{subscription.plan_name}</p>
              </div>
              {onManage && (
                <button
                  onClick={onManage}
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[#1c1917] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#C49A3C] transition-colors"
                >
                  Manage Subscription <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
