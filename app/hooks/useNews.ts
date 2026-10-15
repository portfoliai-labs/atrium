// app/hooks/useNews.ts
"use client";

import { useEffect, useState } from "react";
import { newsService } from "../services/newsService";
import { ApiError } from "../services/apiClient";
import type { NewsItem, DailyArticle } from "../models/News";

const isNotFound = (err: unknown) => err instanceof ApiError && err.status === 404;

// Fetches news for a given calendar month (year+month), or today's news when both are
// omitted — re-fetches whenever year/month/limit change. A 404 means the backend found no
// articles to show: reported as `notFound` (not `error`) so callers can hide just their
// section instead of showing a failure.
export function useNews(year?: number, month?: number, limit?: number) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const data = await newsService.getNews(year, month, limit);
        if (!cancelled) setItems(data);
      } catch (err) {
        if (!cancelled) {
          if (isNotFound(err)) {
            setItems([]);
            setNotFound(true);
          } else {
            setError(err instanceof Error ? err.message : "Failed to load news");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [year, month, limit]);

  return { items, loading, error, notFound };
}

// Fetches the global "article of the day" — same for every user, no params to vary by. A
// 404 (no article picked today) is reported as `notFound`, same as useNews.
export function useDailyArticle() {
  const [article, setArticle] = useState<DailyArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const data = await newsService.getDailyArticle();
        if (!cancelled) setArticle(data);
      } catch (err) {
        if (!cancelled) {
          if (isNotFound(err)) {
            setArticle(null);
            setNotFound(true);
          } else {
            setError(err instanceof Error ? err.message : "Failed to load the daily article");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return { article, loading, error, notFound };
}
