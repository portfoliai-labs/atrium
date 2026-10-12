// lib/journal.ts
//
// JOURNAL — what every Journal page shares: the names of categories, languages, reasons and
// states, the notices an article is shown with, and where the reading pages read from (a
// JournalSource: the API, or, on a backend without the Journal, the platform's own articles
// written in the code, lib/journalStatic).

import type {
  Article, ArticleAuthor, ArticleCategory, ArticleFilters, ArticleLanguage, ArticleStatus, ArticleSummary, Block,
  Page, ReportReason, ReportStatus, Span,
} from "../models/Journal";
import { ApiError } from "../services/apiClient";
import { journalService } from "../services/journalService";

export const CATEGORY_LABELS: Record<ArticleCategory, string> = {
  performance: "Performance",
  risk: "Risk",
  strategy: "Strategy",
  costs: "Costs",
  markets: "Markets",
  taxes: "Taxes",
  personal_finance: "Personal finance",
  real_estate: "Real estate",
  other: "Other",
};
export const CATEGORIES = Object.keys(CATEGORY_LABELS) as ArticleCategory[];

export const LANGUAGE_LABELS: Record<ArticleLanguage, string> = { en: "English", it: "Italiano" };
export const LANGUAGES = Object.keys(LANGUAGE_LABELS) as ArticleLanguage[];

export const STATUS_LABELS: Record<ArticleStatus, string> = { draft: "Draft", published: "Published", hidden: "Hidden" };

export const REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam or advertising",
  misleading: "Misleading or false",
  market_manipulation: "Market manipulation",
  hate_or_harassment: "Hate or harassment",
  personal_data: "Someone's personal data",
  copyright: "Copyright infringement",
  illegal: "Other illegal content",
  other: "Something else",
};
export const REASONS = Object.keys(REASON_LABELS) as ReportReason[];

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: "Waiting for review",
  article_kept: "Reviewed: article kept",
  article_hidden: "Reviewed: article hidden",
};

// Bounds acta checks (its constants/articles.py), so the fields stop where it would refuse.
export const TITLE_MAX = 160;
export const DEK_MAX = 300;
export const ALT_TEXT_MAX = 300;
export const CAPTION_MAX = 300;
export const ATTRIBUTION_MAX = 200;
export const HEADING_MAX = 200;
export const MAX_INSTRUMENTS = 10;
export const DISCLOSURE_MAX = 2000;
export const NOTE_MAX = 1000;
export const QUERY_MAX = 200;

// The notices an article is shown with. PLACEHOLDERS: their wording is waiting for a legal review
// (forum's service-map, "acta": the notice, the advisors' disclosure, the authors' terms).
export const NOT_ADVICE_NOTICE =
  "This article is its author's own opinion, published on PortfoliAI without review. It is not investment advice, and PortfoliAI doesn't endorse it.";
export const EDITORS_NOTICE = "For education only, not investment advice. Past returns don't predict future ones.";
export const DISCLOSURE_TITLE = "The author's interests in the instruments named";
export const DISCLOSURE_HELP =
  "As an advisor naming instruments, say whether you, your firm or your clients hold them or have other interests in them. It is shown with the article.";

/** Who an article is by, as its byline says it. */
export function authorName(author: ArticleAuthor) {
  if (author.kind === "editor") return "PortfoliAI";
  return author.displayName ?? "A PortfoliAI member";
}

/** "Oct 12, 2026". */
export const dateLabel = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** The reader's language for the lists' preferredLanguage, from the profile's. */
export const readerLanguage = (language: string | null | undefined): ArticleLanguage =>
  language?.toLowerCase().startsWith("it") ? "it" : "en";

export const spansText = (spans: Span[]) => spans.map((s) => s.text).join("");

/** An article's words, block by block (for the static articles' search). */
export function blocksText(blocks: Block[]) {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "paragraph":
        case "quote":
          return spansText(b.spans);
        case "heading":
          return b.text;
        case "list":
          return b.items.map((i) => spansText(i.spans)).join(" ");
        case "image":
          return [b.altText, b.caption].filter(Boolean).join(" ");
      }
    })
    .join(" ");
}

/** Whether `err` is the backend telling it has no Journal: FastAPI's own 404, no error_type. */
export const isJournalMissing = (err: unknown) => err instanceof ApiError && err.status === 404 && !err.errorType;

/** Whether `err` is an article that isn't there, or not the caller's to read. */
export const isArticleNotFound = (err: unknown) => err instanceof ApiError && err.status === 404;

/** The text of an API error, or `fallback`. */
export function journalErrorText(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    if (err.errorType === "AuthorUnavailableError") return "Your profile couldn't be read just now. Try publishing again in a moment.";
    if (err.status === 404) return "This article isn't available anymore.";
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

// ── Where the reading pages read from ──

/**
 * Where the Journal's reading pages read from: the API (apiJournalSource) or, on a backend
 * without the Journal (staging, for now), the platform's own articles written in the code
 * (lib/journalStatic), in the same shapes. Writes, saves and reports go to journalService, and
 * only with the API.
 */
export interface JournalSource {
  list(filters: ArticleFilters): Promise<Page<ArticleSummary>>;
  bySlug(slug: string): Promise<Article>;
}

export const apiJournalSource: JournalSource = {
  list: (filters) => journalService.list(filters),
  bySlug: (slug) => journalService.getBySlug(slug),
};

/** An article's summary, from a whole one. */
export function summaryOf(article: Article): ArticleSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { body, interestDisclosure, moderation, createdAt, updatedAt, ...summary } = article;
  return summary;
}
