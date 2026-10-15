"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  notificationService,
  type NotificationResponse,
} from "../services/notificationService";
import { useUser } from "../context/UserContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export type { NotificationResponse };

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  // The live stream waits until we know who's signed in, and a demo account (see lib/demo) never
  // opens it: nothing it can do raises a notification, and the backend refuses its ticket.
  const { user, isDemo } = useUser();
  const canStream = user !== null && !isDemo;

  // ── Load full history from REST ────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await notificationService.listNotifications();
      setNotifications(items);
      setHasUnread(items.some((n) => n.read_at === null));
      return items;
    } catch (err) {
      console.error("[useNotifications] Failed to load notifications:", err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Mark all currently-unread notifications as read ───────────────────────
  // Accepts an optional freshly-fetched list so callers that just awaited
  // loadNotifications() can pass it in directly, instead of relying on the
  // (possibly stale) `notifications` state closure — see handleBellClick.
  const markAllRead = useCallback(async (source?: NotificationResponse[]) => {
    const unread = (source ?? notifications).filter((n) => n.read_at === null);
    if (unread.length === 0) {
      setHasUnread(false);
      return;
    }

    // Optimistic update
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.read_at === null ? { ...n, read_at: now } : n))
    );
    setHasUnread(false);

    // Fire-and-forget — don't block the UI
    await Promise.allSettled(
      unread.map((n) => notificationService.markAsRead(n.notification_id))
    );
  }, [notifications]);

  const dismissAll = useCallback(() => {
    setNotifications([]);
    setHasUnread(false);
  }, []);

  // ── SSE — keeps hasUnread in sync in real-time ────────────────────────────
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
          // A new event arrived: mark badge as unread and always refresh the list in the
          // background, regardless of whether it was ever loaded — consumers other than the
          // notification panel (e.g. a "report in progress" button) rely on `notifications`
          // staying current even when the panel has never been opened.
          setHasUnread(true);
          notificationService
            .listNotifications()
            .then(setNotifications)
            .catch(() => undefined);
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
  }, [canStream]);

  // ── Init: check for unread count on mount ────────────────────────────────
  useEffect(() => {
    notificationService
      .listNotifications(true)
      .then((items) => {
        if (items.length > 0) setHasUnread(true);
      })
      .catch(() => undefined);
  }, []);

  return {
    notifications,
    hasUnread,
    isLoading,
    loadNotifications,
    markAllRead,
    dismissAll,
  };
}
