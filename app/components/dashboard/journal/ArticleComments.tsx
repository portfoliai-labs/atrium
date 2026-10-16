// components/dashboard/journal/ArticleComments.tsx
"use client";

import { useState } from "react";
import { CornerDownRight, Eye, EyeOff, Flag, Loader2, MessageCircle, PenLine, Trash2 } from "lucide-react";
import { journalService } from "../../../services/journalService";
import type { Article, Comment } from "../../../models/Journal";
import { COMMENT_MAX, REASON_LABELS, authorName, dateLabel, journalErrorText } from "../../../lib/journal";
import { ApiError } from "../../../services/apiClient";
import { AuthorBadge, EmptyState, ErrorState, LoadMore, PAGE_SIZE, Spinner, usePaged } from "./JournalKit";
import { ReportDialog, type ReportTarget } from "./ReportDialog";

/** Where a new comment goes: under the article, or as a reply to a top-level comment. */
function Composer({ articleUuid, parentUuid, initial, placeholder, submitLabel, onDone, onCancel }: {
  articleUuid: string;
  parentUuid?: string;
  // An edit: the comment and its text.
  initial?: Comment;
  placeholder: string;
  submitLabel: string;
  onDone: (comment: Comment) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(initial?.text ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = !text.trim();

  const send = async () => {
    if (empty) return;
    setSending(true);
    setError(null);
    try {
      const comment = initial
        ? await journalService.updateComment(initial.uuid, text.trim())
        : await journalService.comment(articleUuid, text.trim(), parentUuid);
      setText("");
      onDone(comment);
    } catch (err) {
      setError(journalErrorText(err, "The comment couldn't be sent."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        maxLength={COMMENT_MAX}
        onChange={(e) => setText(e.target.value)}
        rows={initial || parentUuid ? 2 : 3}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#C49A3C] resize-y"
      />
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={sending} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={() => void send()}
          disabled={empty || sending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
        >
          {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {submitLabel}
        </button>
      </div>
    </div>
  );
}

const HIDDEN_LABELS = {
  hidden_by_author: "Hidden by the article's author: only you, the author and the editors read it.",
  hidden_by_editors: "Hidden by the editors: only its writer and the editors read it.",
} as const;

/**
 * One comment: its writer, text and actions. The writer edits and deletes theirs (with its
 * replies); the article's author hides one under their article and shows it again; anyone else
 * who writes reports it. A top-level comment opens its replies and takes a reply.
 */
function CommentItem({ article, comment, canWrite, ownArticle, onChange, onRemove, onReport }: {
  article: Article;
  comment: Comment;
  canWrite: boolean;
  ownArticle: boolean;
  onChange: (comment: Comment) => void;
  onRemove: (comment: Comment) => void;
  onReport: (target: ReportTarget) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topLevel = comment.parentCommentUuid === null;

  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError && err.errorType === "CommentModeratedError"
        ? "The editors hid this comment: only they can show it again."
        : journalErrorText(err, "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  };
  const remove = () => act(async () => {
    if (!window.confirm(topLevel && comment.replyCount > 0 ? "Delete this comment and its replies?" : "Delete this comment?")) return;
    await journalService.removeComment(comment.uuid);
    onRemove(comment);
  });
  const toggleHidden = () => act(async () => {
    onChange(comment.status === "visible"
      ? await journalService.hideComment(comment.uuid)
      : await journalService.showComment(comment.uuid));
  });

  const hidden = comment.status !== "visible";
  const action = "flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-700 disabled:opacity-50";
  return (
    <li className={topLevel ? "py-5" : "py-3"}>
      <div className={hidden ? "opacity-70" : undefined}>
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-800">{authorName(comment.author)}</span>
          <AuthorBadge author={comment.author} />
          {comment.byArticleAuthor && (
            <span className="rounded-full bg-[#C49A3C]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#9a7424]">Author</span>
          )}
          <span className="text-slate-400">{dateLabel(comment.createdAt)}{comment.editedAt && " · edited"}</span>
        </p>
        {hidden && comment.status !== "visible" && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
            <EyeOff className="h-3 w-3" /> {HIDDEN_LABELS[comment.status]}
            {comment.moderation && ` (${REASON_LABELS[comment.moderation.reason]})`}
          </p>
        )}
        {comment.moderation?.note && <p className="mt-1 text-[11px] italic text-rose-700 whitespace-pre-line">“{comment.moderation.note}”</p>}
        {editing ? (
          <div className="mt-2">
            <Composer
              articleUuid={article.uuid}
              initial={comment}
              placeholder="Your comment"
              submitLabel="Save"
              onDone={(c) => { onChange(c); setEditing(false); }}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-slate-700 leading-relaxed whitespace-pre-line wrap-break-word">{comment.text}</p>
        )}
      </div>

      {!editing && (
        <div className="mt-2 flex flex-wrap items-center gap-4">
          {topLevel && canWrite && !hidden && (
            <button type="button" onClick={() => setReplying((r) => !r)} className={action}>
              <CornerDownRight className="h-3 w-3" /> Reply
            </button>
          )}
          {comment.mine && canWrite && (
            <>
              <button type="button" onClick={() => setEditing(true)} className={action}><PenLine className="h-3 w-3" /> Edit</button>
              <button type="button" onClick={() => void remove()} disabled={busy} className={action}><Trash2 className="h-3 w-3" /> Delete</button>
            </>
          )}
          {ownArticle && canWrite && comment.status !== "hidden_by_editors" && (
            <button type="button" onClick={() => void toggleHidden()} disabled={busy} className={action}>
              {comment.status === "visible" ? <><EyeOff className="h-3 w-3" /> Hide</> : <><Eye className="h-3 w-3" /> Show</>}
            </button>
          )}
          {!comment.mine && canWrite && !hidden && (
            <button type="button" onClick={() => onReport({ kind: "comment", uuid: comment.uuid })} className={`${action} hover:text-rose-600`}>
              <Flag className="h-3 w-3" /> Report
            </button>
          )}
          {busy && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
        </div>
      )}
      {error && <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}

      {topLevel && (
        <div className="mt-2 ml-4 pl-4 border-l-2 border-slate-100">
          {replying && (
            <div className="py-2">
              <Composer
                articleUuid={article.uuid}
                parentUuid={comment.uuid}
                placeholder={`Reply to ${authorName(comment.author)}`}
                submitLabel="Reply"
                onDone={() => {
                  setReplying(false);
                  setShowReplies(true);
                  onChange({ ...comment, replyCount: comment.replyCount + 1 });
                }}
                onCancel={() => setReplying(false)}
              />
            </div>
          )}
          {comment.replyCount > 0 && !showReplies && (
            <button type="button" onClick={() => setShowReplies(true)} className="py-1 text-[11px] font-bold text-[#9a7424] hover:text-[#C49A3C]">
              {comment.replyCount === 1 ? "View 1 reply" : `View ${comment.replyCount} replies`}
            </button>
          )}
          {showReplies && (
            <CommentThread
              // A reply sent reloads the thread, the newest at its end.
              key={comment.replyCount}
              article={article}
              parentUuid={comment.uuid}
              canWrite={canWrite}
              ownArticle={ownArticle}
              onReport={onReport}
            />
          )}
        </div>
      )}
    </li>
  );
}

/** A page of comments: an article's top-level ones, the newest first, or a comment's replies, the oldest first. */
function CommentThread({ article, parentUuid, canWrite, ownArticle, onReport, onCount }: {
  article: Article;
  parentUuid?: string;
  canWrite: boolean;
  ownArticle: boolean;
  onReport: (target: ReportTarget) => void;
  // The thread's total, as it changes (the article's count is the top-level page's to say).
  onCount?: (delta: number) => void;
}) {
  const list = usePaged(
    (offset) => journalService.comments(article.uuid, parentUuid, PAGE_SIZE, offset),
    `comments:${article.uuid}:${parentUuid ?? ""}`,
  );
  const replace = (next: Comment) => list.update((items) => items.map((c) => (c.uuid === next.uuid ? next : c)));
  const remove = (gone: Comment) => {
    list.update((items) => items.filter((c) => c.uuid !== gone.uuid));
    onCount?.(-(1 + gone.replyCount));
  };

  if (list.error) return <ErrorState message={list.error} onRetry={list.retry} />;
  if (!list.items) return <Spinner />;
  if (list.items.length === 0) return parentUuid ? null : <EmptyState>No comments yet.</EmptyState>;
  return (
    <>
      <ul className={parentUuid ? "divide-y divide-slate-50" : "divide-y divide-slate-100"}>
        {list.items.map((c) => (
          <CommentItem
            key={c.uuid}
            article={article}
            comment={c}
            canWrite={canWrite}
            ownArticle={ownArticle}
            onChange={(next) => {
              if (next.replyCount > c.replyCount) onCount?.(next.replyCount - c.replyCount);
              replace(next);
            }}
            onRemove={remove}
            onReport={onReport}
          />
        ))}
      </ul>
      {list.hasMore && <LoadMore onClick={() => void list.more()} loading={list.loadingMore} />}
    </>
  );
}

/**
 * COMMENTS — under a published article: the top-level comments, the newest first, each with its
 * replies (one level); a box to comment for anyone who writes (a demo account reads only).
 */
export function ArticleComments({ article, canWrite, ownArticle, onCount }: {
  article: Article;
  canWrite: boolean;
  ownArticle: boolean;
  onCount: (delta: number) => void;
}) {
  // A new top-level comment reloads the list, the newest at its top.
  const [version, setVersion] = useState(0);
  const [reporting, setReporting] = useState<ReportTarget | null>(null);

  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm px-6 py-8 md:px-14 md:py-10">
      <div className="max-w-2xl mx-auto space-y-5">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
          <MessageCircle className="h-5 w-5 text-[#C49A3C]" />
          Comments{article.commentCount > 0 && <span className="text-slate-400 font-bold">{article.commentCount}</span>}
        </h2>
        {canWrite && article.status === "published" && (
          <Composer
            articleUuid={article.uuid}
            placeholder="What do you think?"
            submitLabel="Comment"
            onDone={() => { setVersion((v) => v + 1); onCount(1); }}
          />
        )}
        <CommentThread
          key={version}
          article={article}
          canWrite={canWrite}
          ownArticle={ownArticle}
          onReport={setReporting}
          onCount={onCount}
        />
      </div>
      {reporting && <ReportDialog target={reporting} onClose={() => setReporting(null)} />}
    </section>
  );
}
