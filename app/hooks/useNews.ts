"use client";

import { useQuery } from "@tanstack/react-query";
import { newsService } from "../services/newsService";
import { ApiError } from "../services/apiClient";
import type { NewsItem } from "../models/News";

const isNotFound = (err: unknown) => err instanceof ApiError && err.status === 404;

/** A news read's key in the query cache (context/QueryContext): the same news, one read. */
export const newsKey = (...parts: unknown[]) => ["news", ...parts];

const NO_NEWS: NewsItem[] = [];

// Fetches news for a given calendar month (year+month), or today's news when both are
// omitted — through the query cache, by year/month/limit. A 404 means the backend found no
// articles to show: reported as `notFound` (not `error`) so callers can hide just their
// section instead of showing a failure.
export function useNews(year?: number, month?: number, limit?: number) {
  const query = useQuery({
    queryKey: newsKey("list", year ?? null, month ?? null, limit ?? null),
    queryFn: () => newsService.getNews(year, month, limit),
  });
  const notFound = query.isError && isNotFound(query.error);
  return {
    items: query.data ?? NO_NEWS,
    loading: query.isPending,
    error: query.isError && !notFound ? (query.error instanceof Error ? query.error.message : "Failed to load news") : null,
    notFound,
  };
}

// Fetches the global "article of the day" — same for every user, no params to vary by. A
// 404 (no article picked today) is reported as `notFound`, same as useNews.
export function useDailyArticle() {
  const query = useQuery({ queryKey: newsKey("daily"), queryFn: () => newsService.getDailyArticle() });
  const notFound = query.isError && isNotFound(query.error);
  return {
    article: query.data ?? null,
    loading: query.isPending,
    error: query.isError && !notFound ? (query.error instanceof Error ? query.error.message : "Failed to load the daily article") : null,
    notFound,
  };
}
