"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  notificationService,
  type NotificationResponse,
} from "../services/notificationService";
import { useUser } from "../context/UserContext";
import { notificationsKey } from "../context/NotificationsContext";
import { accountKey } from "./useAccountQuery";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export type { NotificationResponse };

const isUnread = (n: NotificationResponse) => n.read_at === null;

// The full history, under notificationsKey("list"): read when asked for (the panel, the page) and
// on every event of the stream, not on its own. Functions: NotificationsContext imports this module.
const listKey = () => notificationsKey("list");
const unreadKey = () => notificationsKey("unread");
const NO_NOTIFICATIONS: NotificationResponse[] = [];

export function useNotifications() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: listKey(), queryFn: () => notificationService.listNotifications(), enabled: false });
  // Only the unread ones, once on mount: the badge, before the list is ever read.
  const unread = useQuery({ queryKey: unreadKey(), queryFn: () => notificationService.listNotifications(true) });
  const esRef = useRef<EventSource | null>(null);
  // The live stream waits until we know who's signed in, and a demo account (see lib/demo) never
  // opens it: nothing it can do raises a notification, and the backend refuses its ticket.
  const { user, isDemo } = useUser();
  const canStream = user !== null && !isDemo;

  const notifications = list.data ?? NO_NOTIFICATIONS;
  // The list's say once it's been read, else the unread ones'.
  const hasUnread = list.data ? list.data.some(isUnread) : (unread.data?.length ?? 0) > 0;

  // ── Load full history from REST ────────────────────────────────────────────
  // Always read again (the panel opened shows the list as it is now), shared by whoever asks.
  const fetchList = useCallback(
    () => queryClient.fetchQuery({ queryKey: listKey(), queryFn: () => notificationService.listNotifications(), staleTime: 0 }),
    [queryClient],
  );

  const loadNotifications = useCallback(async () => {
    try {
      return await fetchList();
    } catch (err) {
      console.error("[useNotifications] Failed to load notifications:", err);
      return [];
    }
  }, [fetchList]);

  // ── Mark all currently-unread notifications as read ───────────────────────
  // Accepts an optional freshly-fetched list so callers that just awaited
  // loadNotifications() can pass it in directly, instead of relying on the
  // (possibly stale) `notifications` closure — see handleBellClick.
  const markAllRead = useCallback(async (source?: NotificationResponse[]) => {
    const toMark = (source ?? notifications).filter(isUnread);
    // Optimistic update: the list as read, nothing unread left.
    const now = new Date().toISOString();
    queryClient.setQueryData<NotificationResponse[]>(listKey(), (prev) =>
      prev?.map((n) => (isUnread(n) ? { ...n, read_at: now } : n))
    );
    queryClient.setQueryData<NotificationResponse[]>(unreadKey(), []);
    if (toMark.length === 0) return;

    // Fire-and-forget — don't block the UI
    await Promise.allSettled(
      toMark.map((n) => notificationService.markAsRead(n.notification_id))
    );
  }, [notifications, queryClient]);

  // Here only: the backend keeps them, and the next read brings them back.
  const dismissAll = useCallback(() => {
    queryClient.setQueryData<NotificationResponse[]>(listKey(), []);
    queryClient.setQueryData<NotificationResponse[]>(unreadKey(), []);
  }, [queryClient]);

  // ── SSE — keeps the list and hasUnread in sync in real-time ──────────────
  useEffect(() => {
    if (!canStream) return;
    let cancelled = false;

    async function connect() {
      try {
        const ticket = await notificationService.getTicket();
        if (cancelled) return;

        const url = `${API_BASE_URL}/v1/notifications/stream?ticket=${encodeURIComponent(ticket)}`;
        console.info("[useNotifications] Connecting to SSE with ticket");

        const es = new EventSource(url);
        esRef.current = es;

        es.onopen = () => console.info("[useNotifications] SSE connection opened");

        const handleEvent = () => {
          // A new event arrived: always refresh the list in the background (the badge follows
          // it), regardless of whether it was ever loaded — consumers other than the
          // notification panel (e.g. a "report in progress" button) rely on `notifications`
          // staying current even when the panel has never been opened.
          fetchList().catch(() => undefined);
          // A report's progress arrives as a notification: the reports are read again.
          void queryClient.invalidateQueries({ queryKey: accountKey("reports") });
        };

        es.onmessage = handleEvent;
        es.addEventListener("notification", handleEvent);

        es.onerror = (e) => {
          console.error("[useNotifications] SSE error. readyState:", es.readyState, e);
          es.close();
        };
      } catch (err) {
        console.error("[useNotifications] Failed to obtain ticket:", err);
      }
    }

    connect();

    const handleUnauthorized = () => esRef.current?.close();
    window.addEventListener("auth-unauthorized", handleUnauthorized);

    return () => {
      cancelled = true;
      esRef.current?.close();
      window.removeEventListener("auth-unauthorized", handleUnauthorized);
    };
  }, [canStream, fetchList, queryClient]);

  return {
    notifications,
    hasUnread,
    // Until the first answer only: read again, the list stays up.
    isLoading: list.isFetching && list.data === undefined,
    loadNotifications,
    markAllRead,
    dismissAll,
  };
}
