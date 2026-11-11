// lib/journal.ts
//
// JOURNAL — what every Journal page shares: the names of categories, languages and states, the notices an article is shown with, and where the reading pages read from (a
// JournalSource: the API, or, on a backend without the Journal, no articles).

import type {
  Article, ArticleAuthor, ArticleCategory, ArticleFilters, ArticleImage, ArticleInstrument, ArticleLanguage, ArticleStatus,
  ArticleSummary, NetworkState, Page, Span,
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

export const STATUS_LABELS: Record<ArticleStatus, string> = { draft: "Draft", published: "Published" };

// Bounds acta checks (its constants/articles.py), so the fields stop where it would refuse.
export const TITLE_MAX = 160;
export const DEK_MAX = 300;
export const ALT_TEXT_MAX = 300;
export const CAPTION_MAX = 300;
export const ATTRIBUTION_MAX = 200;
export const HEADING_MAX = 200;
export const MAX_INSTRUMENTS = 10;
export const MAX_TABLE_ROWS = 50;
export const MAX_TABLE_COLUMNS = 10;
export const DISCLOSURE_MAX = 2000;
export const COMMENT_MAX = 2000;
export const QUERY_MAX = 200;

// The notices an article is shown with (reviewed 2026-11-11: the project hosts nothing and an
// article may come from anyone on the network; the disclosure follows MAR art. 20 and its
// Delegated Regulation 2016/958, arts. 5-6).
export const NOT_ADVICE_NOTICE =
  "This article is its author's own opinion. Nobody has reviewed it, and it is neither investment advice nor a personal recommendation: read it critically and talk to an authorised advisor before you invest.";
export const DISCLOSURE_TITLE = "The author's interests in the instruments named";
export const DISCLOSURE_HELP =
  "Required by the EU's market abuse rules (MAR, art. 20; Delegated Regulation 2016/958, arts. 5-6) when you, as an advisor, write about instruments. Say whether you, your firm or the people working with you hold positions in them or in their issuers (long or short), are paid by an issuer, or have any other interest that could affect your objectivity, or write that you have none. It is shown with the article.";

// ── The network (Nostr) ──

// What the author confirms before a draft goes out: a published article is on the network.
export const NETWORK_PUBLISH_TITLE = "Publish to the network?";
export const NETWORK_PUBLISH_NOTICE =
  "Your article becomes public: it goes out signed with your network identity, and anyone can read and copy it, on other PortfoliAI installs and in any Nostr app. You can edit it and ask for its deletion later, but the servers that received it decide whether to honour that, and copies may remain.";
// Under a published article's editor: saving sends the edit out too, without asking again.
export const NETWORK_EDIT_NOTE = "This article is on the network: your saved edits go out to it too.";

export const NETWORK_STATE_LABELS: Record<NetworkState, string> = {
  pending: "Sending to the network",
  published: "On the network",
  withdrawn: "Withdrawn from the network",
  failed: "Not sent to the network",
};

/** Whether an article was read from the network: read-only here. */
export const isNetworkArticle = (article: Pick<ArticleSummary, "origin">) => article.origin === "network";

/** "npub1abcd…wxyz": an npub short enough for a byline. */
export const shortNpub = (npub: string) => (npub.length > 20 ? `${npub.slice(0, 10)}…${npub.slice(-4)}` : npub);

/** Where an image is fetched from: a network article's public address, else the stored file's link. */
export const imageSrc = (image: ArticleImage | null | undefined) => image?.url ?? image?.file?.url ?? null;

/** Who an article is by, as its byline says it. */
export function authorName(author: ArticleAuthor) {
  return author.displayName ?? "A PortfoliAI member";
}

/** "Oct 12, 2026". */
export const dateLabel = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** The reader's language for the lists' preferredLanguage, from the profile's. */
export const readerLanguage = (language: string | null | undefined): ArticleLanguage =>
  language?.toLowerCase().startsWith("it") ? "it" : "en";

// What an article's new drafts are filed under, the category and language being off the editor for now.
export const DEFAULT_CATEGORY: ArticleCategory = "other";

/**
 * An instrument tagged in the text: "#" and its ticker, kept as plain text in a span (acta's spans
 * have no tags). The ticker is one of the article's instruments, ending where no letter, digit, or
 * "." or "-" followed by one, comes next: "#VWCE.MI" whole, "#VWCE." a tag and a full stop. Null
 * when the article names none. Its one group is the ticker.
 */
export function tagPattern(instruments: Pick<ArticleInstrument, "ticker">[]): RegExp | null {
  const tickers = [...new Set(instruments.map((i) => i.ticker))].sort((a, b) => b.length - a.length);
  if (!tickers.length) return null;
  const escaped = tickers.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`#(${escaped.join("|")})(?![\\p{L}\\p{N}]|[.-][\\p{L}\\p{N}])`, "gu");
}

/** `text` cut at its tags: the text between them, and each tag's ticker. */
export function splitTags(text: string, pattern: RegExp | null): ({ text: string } | { ticker: string })[] {
  if (!pattern) return [{ text }];
  const parts: ({ text: string } | { ticker: string })[] = [];
  let at = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > at) parts.push({ text: text.slice(at, match.index) });
    parts.push({ ticker: match[1] });
    at = match.index + match[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

export const spansText = (spans: Span[]) => spans.map((s) => s.text).join("");

/** Whether `err` is the backend telling it has no Journal: FastAPI's own 404, no error_type. */
export const isJournalMissing = (err: unknown) => err instanceof ApiError && err.status === 404 && !err.errorType;

/** Whether `err` is an article that isn't there, or not the caller's to read. */
export const isArticleNotFound = (err: unknown) => err instanceof ApiError && err.status === 404;

/** The text of an API error, or `fallback`. */
export function journalErrorText(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    if (err.errorType === "AuthorUnavailableError") return "Your profile couldn't be read just now. Try publishing again in a moment.";
    if (err.errorType === "CommentNotFoundError") return "This comment isn't available anymore.";
    if (err.errorType === "NetworkArticleReadOnlyError") return "This article comes from the network: only its author can change it, where they wrote it.";
    if (err.status === 404) return "This article isn't available anymore.";
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

// ── Where the reading pages read from ──

/**
 * Where the Journal's reading pages read from: the API (apiJournalSource) or, on a backend
 * without the Journal, nothing (emptyJournalSource: the pages show their empty state). Writes
 * and saves go to journalService, and only with the API.
 */
export interface JournalSource {
  list(filters: ArticleFilters): Promise<Page<ArticleSummary>>;
  bySlug(slug: string): Promise<Article>;
}

export const apiJournalSource: JournalSource = {
  list: (filters) => journalService.list(filters),
  bySlug: (slug) => journalService.getBySlug(slug),
};

/** A backend without the Journal: no articles, and none to open. */
export const emptyJournalSource: JournalSource = {
  list: async (filters) => ({ items: [], total: 0, limit: filters.limit ?? 0, offset: filters.offset ?? 0 }),
  bySlug: async () => {
    throw new ApiError(404, "Article not found.", "ArticleNotFoundError");
  },
};
