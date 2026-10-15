// models/News.ts
// Matches NewsItemResponse (GET /v1/news/) — news for a given calendar month, or for today
// when no month is requested. `imageUrl` is nullable — not every story has one — and
// NewsSection falls back to a generated placeholder derived from `topic`/`title` (see
// themeFor there) whenever it's absent or its URL fails to load.

interface NewsItem {
  topic: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  url: string | null;
  source: string | null;
  imageUrl?: string | null;
}

// Matches DailyArticleResponse (GET /v1/news/daily-article) — the global "article of the
// day", the same one read-only for every user (not scoped by for_user_uuid), warmed by a
// cron rather than fetched live. No `topic` field like NewsItem, but the same nullable
// `imageUrl` — NewsSection's card falls back to the generated placeholder when it's absent
// or fails to load.
interface DailyArticle {
  title: string;
  url: string;
  publishedAt: string | null;
  source: string;
  summary: string | null;
  imageUrl?: string | null;
}

export type { NewsItem, DailyArticle };
