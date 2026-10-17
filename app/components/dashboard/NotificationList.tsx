"use client";

import { CheckCircle2, XCircle, Loader2, Clock, Bell, MessagesSquare } from "lucide-react";
import type { NotificationResponse } from "../../services/notificationService";

interface NotificationListProps {
  notifications: NotificationResponse[];
  isLoading: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type JobStatus = "QUEUED" | "PROCESSING" | "SUCCESS" | "FAILED";

const STATUS_CONFIG: Record<JobStatus, {
  label: string;
  icon: React.ReactNode;
  pill: string;
}> = {
  SUCCESS: {
    label: "Completed",
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  FAILED: {
    label: "Failed",
    icon: <XCircle className="w-5 h-5 text-rose-500 shrink-0" />,
    pill: "bg-rose-50 text-rose-700 border-rose-200",
  },
  PROCESSING: {
    label: "Processing",
    icon: <Loader2 className="w-5 h-5 text-amber-500 shrink-0 animate-spin" />,
    pill: "bg-amber-50 text-amber-700 border-amber-200",
  },
  QUEUED: {
    label: "Queued",
    icon: <Clock className="w-5 h-5 text-[#a8a29e] shrink-0" />,
    pill: "bg-stone-50 text-stone-600 border-stone-200",
  },
};

const DEFAULT_STATUS_CONFIG = {
  label: "Notification",
  icon: <Bell className="w-5 h-5 text-[#C49A3C] shrink-0" />,
  pill: "bg-[#F7F5EF] text-[#78716c] border-[rgba(196,154,60,0.25)]",
};

// New chat messages in one of the user's conversations (type MESSAGE_RECEIVED), one per
// conversation until they read it in Messages. Payload: conversation_uuid, message_uuid,
// sender_uuid.
const MESSAGE_RECEIVED_CONFIG = {
  label: "Messages",
  icon: <MessagesSquare className="w-5 h-5 text-[#C49A3C] shrink-0" />,
  pill: "bg-[#C49A3C]/10 text-[#8A6A28] border-[#C49A3C]/30",
};

function getJobStatus(n: NotificationResponse) {
  const status = n.payload?.status as string | undefined;
  if (status && status in STATUS_CONFIG) return STATUS_CONFIG[status as JobStatus];
  return DEFAULT_STATUS_CONFIG;
}

function getJobId(n: NotificationResponse): string | undefined {
  return n.payload?.job_id as string | undefined;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────

// Shared body markup for the notifications list — used by both the desktop
// header dropdown (NotificationPanel) and the full-page mobile view
// (NotificationsSection), so the two stay visually and behaviorally in sync.
export function NotificationList({ notifications, isLoading }: NotificationListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-[#C49A3C]" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-[#a8a29e]">
        <Bell className="w-8 h-8 opacity-30" />
        <p className="text-sm font-medium">No notifications yet</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[rgba(196,154,60,0.1)]">
      {notifications.map((n) => {
        const isMessage = n.type === "MESSAGE_RECEIVED";
        const cfg = isMessage ? MESSAGE_RECEIVED_CONFIG : getJobStatus(n);
        const jobId = getJobId(n);
        const isUnread = n.read_at === null;

        return (
          <li
            key={n.notification_id}
            className={`flex items-start gap-3 px-5 py-4 transition-colors ${
              isUnread ? "bg-white/50" : "hover:bg-white/40"
            }`}
          >
            {cfg.icon}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-[#1c1917] truncate flex items-center gap-1.5">
                  {isUnread && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C49A3C] shrink-0" />
                  )}
                  {isMessage ? "New message" : "Report job"}
                </span>
                <span className="text-[10px] text-[#a8a29e] shrink-0">
                  {formatDate(n.created_at)}
                </span>
              </div>
              {isMessage && (
                <p className="text-[11px] text-[#78716c] mb-2">You have new messages: read them in Messages.</p>
              )}
              {jobId && (
                <p className="text-[11px] text-[#78716c] truncate mb-2">
                  ID: {jobId}
                </p>
              )}
              <span
                className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.pill}`}
              >
                {cfg.label}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
