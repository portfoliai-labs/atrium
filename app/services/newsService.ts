// services/newsService.ts
import type { NewsItem, DailyArticle } from "../models/News";
import { apiFetch } from "./apiClient";
import { stripHtml } from "../lib/sanitizeText";

const buildQuery = (params: Record<string, string | number | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

const sanitizeNewsItem = (item: NewsItem): NewsItem => ({
  ...item,
  title: stripHtml(item.title),
  description: stripHtml(item.description),
});

const sanitizeDailyArticle = (article: DailyArticle): DailyArticle => ({
  ...article,
  title: stripHtml(article.title),
  summary: stripHtml(article.summary),
});

export const newsService = {
  // GET /v1/news — news for a given calendar month (year+month, must be passed together), or
  // for today when both are omitted. Not portfolio-scoped: one section covering the period's
  // news plus the news on assets/asset classes held across ALL of the caller's portfolios
  // together. `limit` caps how many stories come back.
  async getNews(year?: number, month?: number, limit?: number): Promise<NewsItem[]> {
    const items = await apiFetch<NewsItem[]>(`/v1/news${buildQuery({ year, month, limit })}`);
    return items.map(sanitizeNewsItem);
  },

  // GET /v1/news/daily-article — the global "article of the day", same for every user.
  async getDailyArticle(): Promise<DailyArticle> {
    const article = await apiFetch<DailyArticle>(`/v1/news/daily-article`);
    return sanitizeDailyArticle(article);
  },
};
