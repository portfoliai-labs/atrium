// models/Journal.ts
// Matches ianus' /v1/journal bodies (api/dto/journal.py, acta's contracts): camelCase, enums as
// snake_case strings, times as ISO 8601 UTC. An article's body is typed blocks, never markup.

export type ArticleCategory =
  | "performance" | "risk" | "strategy" | "costs" | "markets" | "taxes" | "personal_finance" | "real_estate" | "other";
export type ArticleLanguage = "it" | "en";
// Told by who the author is, never chosen: an editor's article is signed by PortfoliAI.
export type AuthorKind = "editor" | "advisor" | "user";
// `advisor_clients`: an advisor's articles only, for their clients.
export type ArticleAudience = "everyone" | "advisor_clients";
// `hidden`: by the editors, its author's and theirs only.
export type ArticleStatus = "draft" | "published" | "hidden";
export type ListStyle = "bulleted" | "numbered";
export type ImageFormat = "jpeg" | "png" | "webp";
// Why a reader reports an article or a comment, and why an editor hides one.
export type ReportReason =
  | "spam" | "misleading" | "market_manipulation" | "hate_or_harassment" | "personal_data" | "copyright" | "illegal" | "other";
// `comment_*`: a report on a comment.
export type ReportStatus = "open" | "article_kept" | "article_hidden" | "comment_kept" | "comment_hidden";
// `top_day` / `top_week`: the most applauded in the last 24 hours / 7 days first, then the newest.
export type ArticleOrder = "newest" | "top_day" | "top_week";
// Hidden by the article's author (the commenter's, theirs and the editors'), or by the editors on
// a report (the commenter's and the editors'); a hidden comment hides its replies.
export type CommentStatus = "visible" | "hidden_by_author" | "hidden_by_editors";
export type Decision = "keep" | "hide";

// ── The body's blocks: the same shape written and read ──

/** A stored image: a short-lived link (the bucket is private), never to be cached. */
export interface ImageFile {
  url: string;
  urlExpiresAt: string;
}

/** A run of text with its marks; `linkUrl` (absolute http or https) makes it a link. No line breaks. */
export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  linkUrl?: string | null;
}

/** One of the author's completed uploads. `altText` is required to publish; `file` is read only. */
export interface ArticleImage {
  imageUuid: string;
  altText: string;
  caption?: string | null;
  file?: ImageFile | null;
}

export type Block =
  | { type: "paragraph"; spans: Span[] }
  // 2 or 3 (the title is the 1); unset is 2.
  | { type: "heading"; text: string; level?: 2 | 3 | null }
  // One level; unset style is bulleted.
  | { type: "list"; style?: ListStyle | null; items: { spans: Span[] }[] }
  | { type: "quote"; spans: Span[]; attribution?: string | null }
  | ({ type: "image" } & ArticleImage);

/**
 * An instrument an article names: census' listing (listingId, as /v1/listings gives it), with the
 * ticker, ISIN, instrument and name acta takes from census. One saved before listings names a
 * market-data ticker alone (listingId, instrumentId and name null).
 */
export interface ArticleInstrument {
  listingId?: string | null;
  instrumentId?: string | null;
  name?: string | null;
  ticker: string;
  isin: string | null;
}

/** An instrument as a request names it: its listing, or the ticker and ISIN of one saved before listings. */
export type ArticleInstrumentRef = { listingId: string } | { ticker: string; isin: string | null };

export const instrumentRef = (i: ArticleInstrument): ArticleInstrumentRef =>
  i.listingId ? { listingId: i.listingId } : { ticker: i.ticker, isin: i.isin };

// ── Articles ──

/**
 * An article's content, whole: what is absent is empty. A draft may be incomplete; publishing
 * needs a title, category, language, a body, every image's altText, and an advisor's
 * interestDisclosure when it names instruments.
 */
export interface ArticleContent {
  title?: string | null;
  dek?: string | null;
  category?: ArticleCategory | null;
  language?: ArticleLanguage | null;
  cover?: ArticleImage | null;
  body: Block[];
  instruments: ArticleInstrumentRef[];
  audience?: ArticleAudience | null;
  // An advisor's interests in the instruments they write about (MAR, art. 20).
  interestDisclosure?: string | null;
}

/** `expectedUpdatedAt`: the updatedAt last read; a newer article answers 409 ArticleChangedError. */
export interface ArticleUpdate extends ArticleContent {
  expectedUpdatedAt?: string | null;
}

export interface ArticleAuthor {
  // Null on a draft never published.
  kind: AuthorKind | null;
  // Null on an editor's article (signed by PortfoliAI), unless the caller is an editor.
  userUuid: string | null;
  // Null on an editor's article, or when the names couldn't be read.
  displayName: string | null;
}

/** Why the editors hid an article: for its author and the editors. */
export interface ArticleModeration {
  reason: ReportReason;
  note: string | null;
  hiddenAt: string;
  // The author asked for a review, not decided yet.
  reviewRequested: boolean;
}

/** An article as a list shows it: everything but its body. */
export interface ArticleSummary {
  uuid: string;
  author: ArticleAuthor;
  status: ArticleStatus;
  title: string | null;
  dek: string | null;
  category: ArticleCategory | null;
  language: ArticleLanguage | null;
  cover: ArticleImage | null;
  instruments: ArticleInstrument[];
  audience: ArticleAudience;
  // Given at the first publishing, kept after.
  slug: string | null;
  readMinutes: number;
  publishedAt: string | null;
  // The last edit after the first publishing.
  editedAt: string | null;
  // Whether the caller saved it.
  saved: boolean;
  // How many readers applaud it (one each), and whether the caller does.
  applauseCount: number;
  applauded: boolean;
  // Its visible comments, replies included.
  commentCount: number;
}

export interface Article extends ArticleSummary {
  body: Block[];
  interestDisclosure: string | null;
  moderation: ArticleModeration | null;
  createdAt: string;
  // What an update's expectedUpdatedAt takes.
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  // Across every page.
  total: number;
  limit: number;
  offset: number;
}

/** GET /v1/journal/articles' filters: every one given must match. */
export interface ArticleFilters {
  category?: ArticleCategory;
  authorKind?: AuthorKind;
  authorUuid?: string;
  // An instrument across its listings, or one listing.
  instrumentId?: string;
  listingId?: string;
  // An article saved before listings, by its ticker across its listings (with isin, either).
  ticker?: string;
  isin?: string;
  // Words to find: matches by relevance, else the newest first.
  q?: string;
  // The reader's language: its articles first.
  preferredLanguage?: ArticleLanguage;
  // Unset: a search's matches by relevance, else the newest first.
  order?: ArticleOrder;
  limit?: number;
  offset?: number;
}

// ── Saves ──

export interface SavedArticle {
  article: ArticleSummary;
  savedAt: string;
}

// ── Images ──

/** PUT the file to uploadUrl with exactly this contentType, before it expires; then complete it. */
export interface ImageUpload {
  imageUuid: string;
  uploadUrl: string;
  contentType: string;
  uploadUrlExpiresAt: string;
}

// ── Reports ──

export interface ArticleReport {
  uuid: string;
  articleUuid: string;
  // The title when it was reported.
  articleTitle: string;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  createdAt: string;
  decidedAt: string | null;
  // Set on a report on a comment (under articleUuid).
  commentUuid: string | null;
}

// ── Comments ──

/** A comment under an article: a top-level one, or a reply to one (one level only). */
export interface Comment {
  uuid: string;
  articleUuid: string;
  // The top-level comment it replies to; null on a top-level one.
  parentCommentUuid: string | null;
  // As an article's author: an editor's comment is signed by PortfoliAI.
  author: ArticleAuthor;
  // Plain text, line breaks kept.
  text: string;
  status: CommentStatus;
  // While the editors hide it, for its commenter and the editors (reviewRequested is always false).
  moderation: ArticleModeration | null;
  // The caller wrote it: they can edit and delete it.
  mine: boolean;
  // The article's author wrote it.
  byArticleAuthor: boolean;
  // Its visible replies; 0 on a reply.
  replyCount: number;
  createdAt: string;
  editedAt: string | null;
}

// ── Moderation (the editors') ──

/** What waits on one article. */
export interface ModerationCase {
  article: ArticleSummary;
  openReports: number;
  reviewRequested: boolean;
  reviewNote: string | null;
  // Its oldest open report, or the author's ask.
  waitingSince: string;
}

/** A report as the editors see it: without who made it. */
export interface CaseReport {
  uuid: string;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  createdAt: string;
}

export interface ModerationCaseDetail {
  article: Article;
  // Null when nothing waits on it.
  openCase: ModerationCase | null;
  // The newest first.
  reports: CaseReport[];
}

/** What waits on one comment: its open reports. */
export interface CommentCase {
  comment: Comment;
  // The article it is under.
  article: ArticleSummary;
  openReports: number;
  // Its oldest open report.
  waitingSince: string;
  // The newest first.
  reports: CaseReport[];
}
