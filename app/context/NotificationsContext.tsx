"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useNotifications } from "../hooks/useNotifications";
import type { NotificationResponse } from "../services/notificationService";

interface NotificationsContextType {
  notifications: NotificationResponse[];
  hasUnread: boolean;
  isLoading: boolean;
  loadNotifications: () => Promise<NotificationResponse[]>;
  markAllRead: (source?: NotificationResponse[]) => Promise<void>;
  dismissAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

/** A notifications read's key in the query cache (context/QueryContext): ["notifications", ...]. */
export const notificationsKey = (...parts: unknown[]) => ["notifications", ...parts];

// Single shared SSE connection + notification list for the whole (reserved)/dashboard
// subtree, so components other than the header (e.g. FileUploader) can react to
// job-status events without opening a second EventSource. The list is in the query
// cache, under notificationsKey("list"): the header's panel and the page show the same one.
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const value = useNotifications();
  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext(): NotificationsContextType {
  const ctx = useContext(NotificationsContext);
  if (ctx === undefined) {
    throw new Error("useNotificationsContext must be used within a NotificationsProvider");
  }
  return ctx;
}
