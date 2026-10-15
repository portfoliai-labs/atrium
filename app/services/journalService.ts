// services/journalService.ts
import type {
  Article, ArticleContent, ArticleFilters, ArticleReport, ArticleStatus, ArticleSummary, ArticleUpdate, Decision,
  ImageFile, ImageFormat, ImageUpload, ModerationCase, ModerationCaseDetail, Page, ReportReason, SavedArticle,
} from "../models/Journal";
import { apiFetch } from "./apiClient";

// Errors come back as ApiError with the backend's `detail` as the message, its `error_type`, and
// (in `metadata`) the field at fault: InvalidArticleError (422, `field` and the block's `index`),
// DisclosureRequiredError (422), InvalidImageError (422, `problem`: missing, too_large,
// unsupported_format), InvalidReportError / InvalidDecisionError (422, `field`),
// ArticleNotFoundError / ImageNotFoundError (404: not there, or not the caller's to read or
// write), ArticleChangedError (409, a stale expectedUpdatedAt), ArticleNotDraftError,
// ArticleHiddenError, ArticleNotHiddenError, ReviewAlreadyRequestedError, OwnArticleError (409),
// NotAnEditorError (403), AuthorUnavailableError (503, publishing: retry). A backend without the
// Journal answers its routes with FastAPI's own 404, without an error_type. A demo account's
// writes are refused before they leave (see lib/demo).

const BASE = "/v1/journal";

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") search.set(key, String(value));
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

  // POST .../review — a hidden article, edited: asks the editors to look again.
  async requestReview(articleUuid: string, note?: string): Promise<Article> {
    return apiFetch<Article>(`${BASE}/articles/${articleUuid}/review`, { method: "POST", body: JSON.stringify({ note: note || null }) });
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

  // ── Reports ──

  // POST .../reports — `note` required with "other"; reporting again while open replaces it.
  async report(articleUuid: string, reason: ReportReason, note?: string): Promise<ArticleReport> {
    return apiFetch<ArticleReport>(`${BASE}/articles/${articleUuid}/reports`, {
      method: "POST",
      body: JSON.stringify({ reason, note: note || null }),
    });
  },

  async reports(limit?: number, offset?: number): Promise<Page<ArticleReport>> {
    return apiFetch<Page<ArticleReport>>(`${BASE}/reports${pageQuery(limit, offset)}`);
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

  // ── Moderation: the editors' ──

  async editorStatus(): Promise<{ editor: boolean }> {
    return apiFetch<{ editor: boolean }>(`${BASE}/moderation/editor`);
  },

  // GET /moderation/cases — waiting for a decision, the oldest first.
  async cases(limit?: number, offset?: number): Promise<Page<ModerationCase>> {
    return apiFetch<Page<ModerationCase>>(`${BASE}/moderation/cases${pageQuery(limit, offset)}`);
  },

  async getCase(articleUuid: string): Promise<ModerationCaseDetail> {
    return apiFetch<ModerationCaseDetail>(`${BASE}/moderation/cases/${articleUuid}`);
  },

  // POST .../decision — keep (a hidden one is shown again) or hide with a reason; closes the open
  // reports and the author's ask.
  async decide(articleUuid: string, decision: Decision, reason?: ReportReason, note?: string): Promise<Article> {
    return apiFetch<Article>(`${BASE}/moderation/cases/${articleUuid}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, reason: reason ?? null, note: note || null }),
    });
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
