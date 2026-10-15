"use client";

import { useEffect, useRef } from "react";
import { Bell, Trash2 } from "lucide-react";
import type { NotificationResponse } from "../../services/notificationService";
import { NotificationList } from "./NotificationList";

interface NotificationPanelProps {
  notifications: NotificationResponse[];
  isLoading: boolean;
  onClose: () => void;
  onDismissAll: () => void;
  onOpenPage?: (section: string, view: unknown) => void;
}

// Desktop-only dropdown (see DashboardHeader: hidden below md, where the bell
// instead links to the full-page NotificationsSection). Widths are still
// clamped defensively so it never overflows the viewport at the md breakpoint.
export function NotificationPanel({
  notifications,
  isLoading,
  onClose,
  onDismissAll,
  onOpenPage,
}: NotificationPanelProps) {
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

  const unreadCount = notifications.filter((n) => n.read_at === null).length;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-3 w-80 max-w-[calc(100vw-2rem)] z-50 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="bg-[#F7F5EF] border border-[rgba(196,154,60,0.25)] rounded-[1.5rem] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(196,154,60,0.15)]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#C49A3C]" />
            <span
              className="font-bold text-sm text-[#1c1917]"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Notifications
            </span>
            {unreadCount > 0 && (
              <span className="ml-1 text-[10px] font-bold bg-[#C49A3C] text-white rounded-full px-1.5 py-0.5 leading-none">
                {unreadCount}
              </span>
            )}
          </div>

          {notifications.length > 0 && (
            <button
              onClick={onDismissAll}
              className="flex items-center gap-1 text-[10px] font-semibold text-[#a8a29e] hover:text-rose-500 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear all
            </button>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[22rem] overflow-y-auto">
          <NotificationList notifications={notifications} isLoading={isLoading} onOpenPage={onOpenPage} />
        </div>
      </div>
    </div>
  );
}
