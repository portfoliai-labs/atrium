// services/journalService.ts
import type {
  Article, ArticleContent, ArticleFilters, ArticleStatus, ArticleSummary, ArticleUpdate, Comment, Follow, ImageFile, ImageFormat,
  HiddenArticle, HiddenArticlePage, ImageUpload, Mute, MutePage, NetworkIdentity, NetworkKeyExport, Page, ReaderSettings, Report, ReportRequest, SavedArticle,
} from "../models/Journal";
import { apiFetch } from "./apiClient";

// Errors come back as ApiError with the backend's `detail` as the message, its `error_type`, and
// (in `metadata`) the field at fault: InvalidArticleError (422, `field` and the block's `index`),
// DisclosureRequiredError (422), InvalidImageError (422, `problem`: missing, too_large,
// unsupported_format), ArticleNotFoundError / ImageNotFoundError (404: not there, or not the
// caller's to read or write), ArticleChangedError (409, a stale expectedUpdatedAt),
// ArticleNotDraftError, OwnArticleError (409), InvalidCommentError (422, `field`),
// CommentNotFoundError (404), AuthorUnavailableError (503, publishing: retry),
// NetworkArticleReadOnlyError (409, a write to an article read from the network), InvalidFieldError
// (422, `field` pubkey: following what isn't a key, or oneself); the network identity's
// PasswordTooShortError / KeyNotDecryptedError (422), KeyTakenError (409). A backend without the
// Journal answers its routes with FastAPI's own 404, without an error_type.

const BASE = "/v1/journal";

function query(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "" && value !== false) search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : "";
}

const pageQuery = (limit?: number, offset?: number) => query({ limit, offset });

export const journalService = {
  // ── Reading ──

  // GET /articles — the published articles the caller can read: a search's matches by relevance,
  // else the newest first.
  async list(filters: ArticleFilters = {}): Promise<Page<ArticleSummary>> {
    return apiFetch<Page<ArticleSummary>>(`${BASE}/articles${query({ ...filters, q: filters.q?.trim() })}`);
  },

  async getBySlug(slug: string): Promise<Article> {
    return apiFetch<Article>(`${BASE}/articles/by-slug/${encodeURIComponent(slug)}`);
  },

  async get(articleUuid: string): Promise<Article> {
    return apiFetch<Article>(`${BASE}/articles/${articleUuid}`);
  },

  // GET /articles/mine — the caller's own, in any state (or one), the last updated first.
  async mine(status?: ArticleStatus, limit?: number, offset?: number): Promise<Page<ArticleSummary>> {
    return apiFetch<Page<ArticleSummary>>(`${BASE}/articles/mine${query({ status, limit, offset })}`);
  },

  // ── Writing (the author's) ──

  // POST /articles — a draft, which may be incomplete.
  async create(content: ArticleContent): Promise<Article> {
    return apiFetch<Article>(`${BASE}/articles`, { method: "POST", body: JSON.stringify(content) });
  },

  // PUT /articles/{a} — the content replaced whole; a published article is checked as publishing.
  async update(articleUuid: string, content: ArticleUpdate): Promise<Article> {
    return apiFetch<Article>(`${BASE}/articles/${articleUuid}`, { method: "PUT", body: JSON.stringify(content) });
  },

  async remove(articleUuid: string): Promise<void> {
    await apiFetch(`${BASE}/articles/${articleUuid}`, { method: "DELETE" });
  },

  // POST .../publish — a draft gets its slug, its day and its author's kind.
  async publish(articleUuid: string): Promise<Article> {
    return apiFetch<Article>(`${BASE}/articles/${articleUuid}/publish`, { method: "POST" });
  },

  // POST .../unpublish — back to a draft, keeping its slug.
  async unpublish(articleUuid: string): Promise<Article> {
    return apiFetch<Article>(`${BASE}/articles/${articleUuid}/unpublish`, { method: "POST" });
  },

  // ── Saves ──

  async save(articleUuid: string): Promise<{ savedAt: string }> {
    return apiFetch<{ savedAt: string }>(`${BASE}/articles/${articleUuid}/saved`, { method: "PUT" });
  },

  async unsave(articleUuid: string): Promise<void> {
    await apiFetch(`${BASE}/articles/${articleUuid}/saved`, { method: "DELETE" });
  },

  // GET /saved — the saved articles still readable, the last saved first.
  async saved(limit?: number, offset?: number): Promise<Page<SavedArticle>> {
    return apiFetch<Page<SavedArticle>>(`${BASE}/saved${pageQuery(limit, offset)}`);
  },

  // ── Applause: one per reader, not on their own article (OwnArticleError) ──

  async applaud(articleUuid: string): Promise<{ applaudedAt: string; applauseCount: number }> {
    return apiFetch<{ applaudedAt: string; applauseCount: number }>(`${BASE}/articles/${articleUuid}/applause`, { method: "PUT" });
  },

  async withdrawApplause(articleUuid: string): Promise<void> {
    await apiFetch(`${BASE}/articles/${articleUuid}/applause`, { method: "DELETE" });
  },

  // ── Comments ──

  // GET .../comments — the top-level comments, the newest first, or (parentCommentUuid) a
  // comment's replies, the oldest first; hidden ones only for whom may read them.
  async comments(articleUuid: string, parentCommentUuid?: string, limit?: number, offset?: number): Promise<Page<Comment>> {
    return apiFetch<Page<Comment>>(`${BASE}/articles/${articleUuid}/comments${query({ parentCommentUuid, limit, offset })}`);
  },

  // POST .../comments — on a published article; a reply to a reply goes under its top-level comment.
  async comment(articleUuid: string, text: string, parentCommentUuid?: string): Promise<Comment> {
    return apiFetch<Comment>(`${BASE}/articles/${articleUuid}/comments`, {
      method: "POST",
      body: JSON.stringify({ text, parentCommentUuid: parentCommentUuid ?? null }),
    });
  },

  async updateComment(commentUuid: string, text: string): Promise<Comment> {
    return apiFetch<Comment>(`${BASE}/comments/${commentUuid}`, { method: "PUT", body: JSON.stringify({ text }) });
  },

  // DELETE /comments/{c} — the caller's, with its replies.
  async removeComment(commentUuid: string): Promise<void> {
    await apiFetch(`${BASE}/comments/${commentUuid}`, { method: "DELETE" });
  },

  // POST .../hide, .../show — the article's author, on a comment under their article.
  async hideComment(commentUuid: string): Promise<Comment> {
    return apiFetch<Comment>(`${BASE}/comments/${commentUuid}/hide`, { method: "POST" });
  },

  async showComment(commentUuid: string): Promise<Comment> {
    return apiFetch<Comment>(`${BASE}/comments/${commentUuid}/show`, { method: "POST" });
  },

  // ── Follows: by public key (hex or npub); the caller's contact list goes to the network ──

  async follows(limit?: number, offset?: number): Promise<Page<Follow>> {
    return apiFetch<Page<Follow>>(`${BASE}/follows${pageQuery(limit, offset)}`);
  },

  async follow(pubkey: string): Promise<Follow> {
    return apiFetch<Follow>(`${BASE}/follows/${encodeURIComponent(pubkey)}`, { method: "PUT" });
  },

  async unfollow(pubkey: string): Promise<void> {
    await apiFetch(`${BASE}/follows/${encodeURIComponent(pubkey)}`, { method: "DELETE" });
  },

  // ── The reader's moderation: theirs only; mutes and hides never leave this instance ──

  // GET /mutes — the authors the caller muted, as a page.
  async mutes(limit?: number, offset?: number): Promise<Page<Mute>> {
    const page = await apiFetch<MutePage>(`${BASE}/mutes${pageQuery(limit, offset)}`);
    return { items: page.authors, total: page.total, limit: limit ?? page.authors.length, offset: offset ?? 0 };
  },

  // PUT /mutes/{key} — hex or npub; one's own key is InvalidFieldError.
  async mute(pubkey: string): Promise<Mute> {
    return apiFetch<Mute>(`${BASE}/mutes/${encodeURIComponent(pubkey)}`, { method: "PUT" });
  },

  async unmute(pubkey: string): Promise<void> {
    await apiFetch(`${BASE}/mutes/${encodeURIComponent(pubkey)}`, { method: "DELETE" });
  },

  // PUT /articles/{a}/hidden — hidden for the caller: out of every list.
  async hideArticle(articleUuid: string): Promise<{ hiddenAt: string }> {
    return apiFetch<{ hiddenAt: string }>(`${BASE}/articles/${articleUuid}/hidden`, { method: "PUT" });
  },

  // DELETE on an article hidden by followed reports records "shown anyway": back in the lists,
  // and visible even if more reports arrive.
  async unhideArticle(articleUuid: string): Promise<void> {
    await apiFetch(`${BASE}/articles/${articleUuid}/hidden`, { method: "DELETE" });
  },

  // GET /hidden — the articles the caller hid, as a page.
  async hiddenArticles(limit?: number, offset?: number): Promise<Page<HiddenArticle>> {
    const page = await apiFetch<HiddenArticlePage>(`${BASE}/hidden${pageQuery(limit, offset)}`);
    return { items: page.articles, total: page.total, limit: limit ?? page.articles.length, offset: offset ?? 0 };
  },

  // GET /reader-settings — a reader who never set it gets the default threshold (2).
  async readerSettings(): Promise<ReaderSettings> {
    return apiFetch<ReaderSettings>(`${BASE}/reader-settings`);
  },

  // PUT /reader-settings — 0 off, else 1..10 (InvalidFieldError on `followedReportsThreshold` outside).
  async updateReaderSettings(settings: ReaderSettings): Promise<ReaderSettings> {
    return apiFetch<ReaderSettings>(`${BASE}/reader-settings`, { method: "PUT", body: JSON.stringify(settings) });
  },

  // PUT /comments/{c}/hidden — hidden for the caller (not the article author's hide, for everyone).
  async hideCommentForMe(commentUuid: string): Promise<{ hiddenAt: string }> {
    return apiFetch<{ hiddenAt: string }>(`${BASE}/comments/${commentUuid}/hidden`, { method: "PUT" });
  },

  async unhideCommentForMe(commentUuid: string): Promise<void> {
    await apiFetch(`${BASE}/comments/${commentUuid}/hidden`, { method: "DELETE" });
  },

  // POST /reports — the target is hidden (a key muted) for the caller; on a network target the
  // report goes out to the network as a public NIP-56 event signed with the caller's key.
  async report(request: ReportRequest): Promise<Report> {
    return apiFetch<Report>(`${BASE}/reports`, { method: "POST", body: JSON.stringify(request) });
  },

  // ── Images: the file goes from the browser to the bucket, never through ianus ──

  async createImageUpload(format: ImageFormat): Promise<ImageUpload> {
    return apiFetch<ImageUpload>(`${BASE}/images`, { method: "POST", body: JSON.stringify({ format }) });
  },

  // POST /images/{i}/complete — checks the file (≤5 MB, a JPEG, PNG or WebP by its bytes); a
  // refused one is gone (InvalidImageError).
  async completeImageUpload(imageUuid: string): Promise<ImageFile> {
    return apiFetch<ImageFile>(`${BASE}/images/${imageUuid}/complete`, { method: "POST" });
  },
};

/**
 * Uploads an image for an article: asks for a signed link, PUTs the file straight to the bucket
 * (with exactly the signed Content-Type and no Authorization header), then has it checked.
 */
export async function uploadArticleImage(file: File): Promise<{ imageUuid: string; file: ImageFile }> {
  const format = imageFormatOf(file);
  if (!format) throw new Error("Use a JPEG, PNG or WebP image.");
  if (file.size > IMAGE_MAX_BYTES) throw new Error("The image is larger than 5 MB.");
  const upload = await journalService.createImageUpload(format);
  const put = await fetch(upload.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": upload.contentType } });
  if (!put.ok) throw new Error("The image couldn't be uploaded. Try again.");
  return { imageUuid: upload.imageUuid, file: await journalService.completeImageUpload(upload.imageUuid) };
}

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

function imageFormatOf(file: File): ImageFormat | null {
  if (file.type === "image/jpeg") return "jpeg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return null;
}

/** The caller's identity on the network (ianus' /v1/network, pons' keys). */
export const networkService = {
  async identity(): Promise<NetworkIdentity> {
    return apiFetch<NetworkIdentity>("/v1/network/identity");
  },

  // The secret key encrypted with `password` (8 characters at least); makes the key if there's none.
  async exportKey(password: string): Promise<NetworkKeyExport> {
    return apiFetch<NetworkKeyExport>("/v1/network/identity/export", { method: "POST", body: JSON.stringify({ password }) });
  },

  // Replaces the caller's key with one exported elsewhere.
  async importKey(ncryptsec: string, password: string): Promise<NetworkIdentity> {
    return apiFetch<NetworkIdentity>("/v1/network/identity/import", { method: "POST", body: JSON.stringify({ ncryptsec, password }) });
  },
};
