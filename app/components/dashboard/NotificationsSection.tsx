"use client";

import { useEffect } from "react";
import { Trash2 } from "lucide-react";
import { useNotificationsContext } from "../../context/NotificationsContext";
import { NotificationList } from "./NotificationList";

// Full-page notifications view. On mobile the header bell routes here instead
// of opening NotificationPanel's dropdown, since a fixed-width absolutely
// positioned panel has nowhere to sit without overflowing a narrow viewport.
export function NotificationsSection({ onOpenPage }: { onOpenPage?: (section: string, view: unknown) => void }) {
  const {
    notifications,
    isLoading,
    loadNotifications,
    markAllRead,
    dismissAll,
  } = useNotificationsContext();

  useEffect(() => {
    loadNotifications().then((items) => markAllRead(items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      {notifications.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={dismissAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#a8a29e] hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear all
          </button>
        </div>
      )}

      <div className="bg-white border border-[rgba(196,154,60,0.2)] rounded-[1.5rem] shadow-sm overflow-hidden">
        <NotificationList notifications={notifications} isLoading={isLoading} onOpenPage={onOpenPage} />
      </div>
    </div>
  );
}
