// models/Journal.ts
// Matches ianus' /v1/journal bodies (api/dto/journal.py, acta's contracts): camelCase, enums as
// snake_case strings, times as ISO 8601 UTC. An article's body is typed blocks, never markup.

export type ArticleCategory =
  | "performance" | "risk" | "strategy" | "costs" | "markets" | "taxes" | "personal_finance" | "real_estate" | "other";
export type ArticleLanguage = "it" | "en";
// Told by who the author is, never chosen.
export type AuthorKind = "advisor" | "user";
// `advisor_clients`: an advisor's articles only, for their clients.
export type ArticleAudience = "everyone" | "advisor_clients";
export type ArticleStatus = "draft" | "published";
// Where it was written: on this instance (its author's to edit), or read from the network (Nostr:
// another instance, another client), read-only here (409 NetworkArticleReadOnlyError on a write).
export type ArticleOrigin = "local" | "network";
// The author's own article on the network: `pending` waiting to be sent (after a failure,
// lastError says why and it's tried again later), `published` sent, `withdrawn` its deletion
// request sent, `failed` given up on until it's published or edited again.
export type NetworkState = "pending" | "published" | "withdrawn" | "failed";
export type ListStyle = "bulleted" | "numbered";
export type ImageFormat = "jpeg" | "png" | "webp";
// `top_day` / `top_week`: the most applauded in the last 24 hours / 7 days first, then the newest.
export type ArticleOrder = "newest" | "top_day" | "top_week";
// Hidden by the article's author (the commenter's and theirs only); a hidden comment hides its replies.
export type CommentStatus = "visible" | "hidden_by_author";
// `trusted`: this instance's articles and the network authors in the caller's web of trust (whom
// they follow, and whom those follow). Unset: every article ("All the network").
export type ArticleScope = "trusted";
// A report's reason, as NIP-56 names them.
export type ReportReason = "spam" | "illegal" | "impersonation" | "nudity" | "profanity" | "malware" | "other";
// A report on a network target goes out signed by the reporter: `local` on this instance's only.
export type ReportNetworkState = "local" | "pending" | "published" | "failed";

// ── The body's blocks: the same shape written and read ──

/** A stored image: a short-lived link (the bucket is private), never to be cached; a network article's: its public address, no expiry. */
export interface ImageFile {
  url: string;
  urlExpiresAt: string | null;
}

/** A run of text with its marks; `linkUrl` (absolute http or https) makes it a link. No line breaks. */
export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  linkUrl?: string | null;
  strike?: boolean;
  highlight?: boolean;
}

/**
 * One of the author's completed uploads. `altText` is required to publish; `file` and `url` are
 * read only. A network article's image has no imageUuid (empty) and its public address in `url`.
 */
export interface ArticleImage {
  imageUuid: string;
  altText: string;
  caption?: string | null;
  file?: ImageFile | null;
  url?: string | null;
}

export type Block =
  | { type: "paragraph"; spans: Span[] }
  // 2 or 3 (the title is the 1); unset is 2.
  | { type: "heading"; text: string; level?: 2 | 3 | null }
  // One level; unset style is bulleted.
  | { type: "list"; style?: ListStyle | null; items: { spans: Span[] }[] }
  | { type: "quote"; spans: Span[]; attribution?: string | null }
  | ({ type: "image" } & ArticleImage)
  // Rows of cells, every row as wide as the first (1 to 50 rows of 1 to 10); a cell is its spans,
  // none when empty. `headerRow`: the first row is the columns' headings.
  | { type: "table"; rows: { cells: { spans: Span[] }[] }[]; headerRow?: boolean; caption?: string | null };

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
  // Null on a draft never published. A network author is a user.
  kind: AuthorKind | null;
  // A user of this instance's; null for a network author.
  userUuid: string | null;
  // Null when the names couldn't be read; a network author's from their profile, else their npub shortened.
  displayName: string | null;
  // Their public key on the network (lowercase hex) and the same as an npub: a network author's,
  // a local one's when known. What following takes.
  pubkey?: string | null;
  npub?: string | null;
  // A network author's profile picture.
  pictureUrl?: string | null;
  // Whether the caller follows them.
  followed?: boolean;
  // Whether the caller muted them: their articles and comments are left out of the lists.
  muted?: boolean;
  // A local author always; a network author when in the caller's web of trust. Absent from a
  // backend before moderation: trusted.
  trusted?: boolean;
}

/** Where the author's own article stands on the network; null on anyone else's. */
export interface NetworkStatus {
  state: NetworkState;
  eventId: string | null;
  // The version the network was sent: its publishing or its last edit.
  publishedVersionAt: string | null;
  // Why the last attempt failed; null once one succeeds.
  lastError: string | null;
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
  // Absent from a backend before the network: local.
  origin?: ArticleOrigin;
  network?: NetworkStatus | null;
  // Whether the caller hid it (only one article's page and the saved and hidden lists show those).
  hidden?: boolean;
  // How many people the caller follows reported it or its author (absent from an older backend: 0).
  followedReports?: number;
  // Why it's hidden: the reader's own hide wins over followed reports (absent from an older backend: null).
  hiddenReason?: HiddenReason | null;
}

/** Why an article is hidden for the caller: they hid it, or enough people they follow reported it or its author. */
export type HiddenReason = "reader" | "followed_reports";

export interface Article extends ArticleSummary {
  body: Block[];
  interestDisclosure: string | null;
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
  // This instance's, or the network's; unset: both.
  origin?: ArticleOrigin;
  // Only the authors the caller follows.
  followedOnly?: boolean;
  // One author's by their public key (lowercase hex).
  authorPubkey?: string;
  // Only the reader's network (see ArticleScope); unset: everyone's.
  scope?: ArticleScope;
  limit?: number;
  offset?: number;
}

// ── Saves ──

export interface SavedArticle {
  article: ArticleSummary;
  savedAt: string;
}

// ── Follows ──

/** An author the caller follows (`author.followed` true). */
export interface Follow {
  author: ArticleAuthor;
  followedAt: string;
}

// ── The reader's moderation: mutes, hidden articles, reports (the reader's own) ──

/** An author the caller muted (local only, never published). */
export interface Mute {
  author: ArticleAuthor;
  mutedAt: string;
}

export interface MutePage {
  authors: Mute[];
  total: number;
}

/** An article the caller hid. */
export interface HiddenArticle {
  article: ArticleSummary;
  hiddenAt: string;
}

/**
 * The reader's settings: hide what at least `followedReportsThreshold` people they follow reported
 * (an article, or its author); 0 is off, otherwise 1..10.
 */
export interface ReaderSettings {
  followedReportsThreshold: number;
}

export interface HiddenArticlePage {
  articles: HiddenArticle[];
  total: number;
}

/** What a report is about: exactly one of an article, a comment or an author's key. */
export type ReportTarget = { articleUuid: string } | { commentUuid: string } | { pubkey: string };

export type ReportRequest = ReportTarget & { reason: ReportReason; note?: string | null };

/** A report made: its target is hidden (or, a key, muted) for the reporter. Reporting again answers the first. */
export interface Report {
  reportUuid: string;
  articleUuid?: string | null;
  commentUuid?: string | null;
  pubkey?: string | null;
  reason: ReportReason;
  note?: string | null;
  createdAt: string;
  networkState: ReportNetworkState;
  eventId?: string | null;
}

// ── The caller's network identity (Nostr) ──

/** The caller's public key and npub; nulls while they have none yet. */
export interface NetworkIdentity {
  pubkey: string | null;
  npub: string | null;
}

/** The secret key encrypted with the caller's password (NIP-49, "ncryptsec1..."). */
export interface NetworkKeyExport {
  ncryptsec: string;
  pubkey: string;
  npub: string;
}

// ── Images ──

/** PUT the file to uploadUrl with exactly this contentType, before it expires; then complete it. */
export interface ImageUpload {
  imageUuid: string;
  uploadUrl: string;
  contentType: string;
  uploadUrlExpiresAt: string;
}

// ── Comments ──

/** A comment under an article: a top-level one, or a reply to one (one level only). */
export interface Comment {
  uuid: string;
  articleUuid: string;
  // The top-level comment it replies to; null on a top-level one.
  parentCommentUuid: string | null;
  author: ArticleAuthor;
  // Plain text, line breaks kept.
  text: string;
  status: CommentStatus;
  // The caller wrote it: they can edit and delete it.
  mine: boolean;
  // The article's author wrote it.
  byArticleAuthor: boolean;
  // Its visible replies; 0 on a reply.
  replyCount: number;
  createdAt: string;
  editedAt: string | null;
}
