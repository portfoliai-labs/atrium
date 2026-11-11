// components/dashboard/journal/ArticleComments.tsx
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CornerDownRight, Eye, EyeOff, Loader2, PenLine, Trash2 } from "lucide-react";
import { journalKey, useJournal } from "../../../context/JournalContext";
import { journalService } from "../../../services/journalService";
import type { Article, Comment } from "../../../models/Journal";
import { COMMENT_MAX, authorKey, authorName, dateLabel, journalErrorText } from "../../../lib/journal";
import { AuthorBadge, ErrorState, LoadMore, PAGE_SIZE, Spinner, usePaged } from "./JournalKit";
import { ItemMenu, ReportDialog, UndoBar, reportedMessage, useIsMe, type MenuItem, type Undoable } from "./Moderation";
import { serif, serifText } from "../../preview/PreviewKit";

/** Who wrote a comment, as a round of their initials. */
function Initials({ name, small = false }: { name: string; small?: boolean }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  return (
    <span
      aria-hidden
      className={`shrink-0 flex items-center justify-center rounded-full bg-[#F1EADB] font-bold text-[#8A6A28] ${small ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs"}`}
    >
      {letters}
    </span>
  );
}

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
    <div className="rounded-2xl border border-[#E7E1D3] bg-white/70 px-4 pt-3 pb-2.5 transition-colors focus-within:border-[#C49A3C] focus-within:bg-white">
      <textarea
        value={text}
        maxLength={COMMENT_MAX}
        onChange={(e) => setText(e.target.value)}
        rows={initial || parentUuid ? 2 : 3}
        placeholder={placeholder}
        style={serifText}
        className="w-full bg-transparent text-[17px] leading-relaxed text-[#292524] placeholder:italic placeholder:text-[#b5ad9e] outline-none resize-none field-sizing-content min-h-[3.2em]"
      />
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={sending} className="px-4 py-1.5 rounded-full text-xs font-bold text-[#78716c] hover:text-[#1c1917]">
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={() => void send()}
          disabled={empty || sending}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white bg-[#C49A3C] hover:bg-[#B08932] disabled:opacity-40"
        >
          {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {submitLabel}
        </button>
      </div>
    </div>
  );
}

const HIDDEN_LABEL = "Hidden by the article's author: only its writer and the author read it.";

/**
 * One comment: its writer, text and actions. The writer edits and deletes theirs (with its
 * replies); the article's author hides one under their article and shows it again. A top-level comment opens its replies and takes a reply.
 */
function CommentItem({ article, comment, canWrite, ownArticle, menu, onChange, onRemove }: {
  article: Article;
  comment: Comment;
  canWrite: boolean;
  ownArticle: boolean;
  // The reader's moderation of someone else's comment.
  menu?: React.ReactNode;
  onChange: (comment: Comment) => void;
  onRemove: (comment: Comment) => void;
}) {
  const queryClient = useQueryClient();
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
      setError(journalErrorText(err, "That didn't work. Try again."));
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
  const action = "flex items-center gap-1 text-[11px] font-bold text-[#a8a29e] hover:text-[#1c1917] disabled:opacity-50";
  const name = authorName(comment.author);
  return (
    <li className={`flex gap-3 ${topLevel ? "py-6" : "py-3"}`}>
      <Initials name={name} small={!topLevel} />
      <div className="min-w-0 flex-1">
        <div className={hidden ? "opacity-70" : undefined}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-[#1c1917]">{name}</span>
            <AuthorBadge author={comment.author} />
            {comment.byArticleAuthor && (
              <span className="rounded-full bg-[#C49A3C]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#8A6A28]">Author</span>
            )}
            <span className="text-[#a8a29e]">{dateLabel(comment.createdAt)}{comment.editedAt && " · edited"}</span>
            {menu && <span className="ml-auto">{menu}</span>}
          </div>
          {hidden && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
              <EyeOff className="h-3 w-3" /> {HIDDEN_LABEL}
            </p>
          )}
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
            <p className="mt-1.5 text-[17px] text-[#292524] leading-relaxed whitespace-pre-line wrap-break-word" style={serifText}>{comment.text}</p>
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
            {ownArticle && canWrite && (
              <button type="button" onClick={() => void toggleHidden()} disabled={busy} className={action}>
                {comment.status === "visible" ? <><EyeOff className="h-3 w-3" /> Hide</> : <><Eye className="h-3 w-3" /> Show</>}
              </button>
            )}
            {busy && <Loader2 className="h-3 w-3 animate-spin text-[#a8a29e]" />}
          </div>
        )}
        {error && <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}

        {topLevel && (
          <div className="mt-2 -ml-px pl-4 border-l-2 border-[#EEE9DD]">
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
                    // The thread is read again, the newest reply at its end.
                    void queryClient.invalidateQueries({ queryKey: journalKey("comments", article.uuid, comment.uuid) });
                    onChange({ ...comment, replyCount: comment.replyCount + 1 });
                  }}
                  onCancel={() => setReplying(false)}
                />
              </div>
            )}
            {comment.replyCount > 0 && !showReplies && (
              <button type="button" onClick={() => setShowReplies(true)} className="py-1 text-[11px] font-bold text-[#8A6A28] hover:text-[#C49A3C]">
                {comment.replyCount === 1 ? "View 1 reply" : `View ${comment.replyCount} replies`}
              </button>
            )}
            {showReplies && (
              <CommentThread
                article={article}
                parentUuid={comment.uuid}
                canWrite={canWrite}
                ownArticle={ownArticle}
              />
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** A page of comments: an article's top-level ones, the newest first, or a comment's replies, the oldest first. */
function CommentThread({ article, parentUuid, canWrite, ownArticle, onCount }: {
  article: Article;
  parentUuid?: string;
  canWrite: boolean;
  ownArticle: boolean;
  // The thread's total, as it changes (the article's count is the top-level page's to say).
  onCount?: (delta: number) => void;
}) {
  const { changed } = useJournal();
  const isMe = useIsMe();
  const list = usePaged(
    ["comments", article.uuid, parentUuid ?? null],
    (offset) => journalService.comments(article.uuid, parentUuid, PAGE_SIZE, offset),
  );
  // What the reader hid, muted or reported: off the thread at once.
  const [goneComments, setGoneComments] = useState<ReadonlySet<string>>(new Set());
  const [goneAuthors, setGoneAuthors] = useState<ReadonlySet<string>>(new Set());
  const [last, setLast] = useState<Undoable | null>(null);
  const [reporting, setReporting] = useState<Comment | null>(null);
  const toggle = (set: ReadonlySet<string>, key: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(key);
    else next.delete(key);
    return next;
  };

  const hideForMe = async (comment: Comment) => {
    setGoneComments((s) => toggle(s, comment.uuid, true));
    try {
      await journalService.hideCommentForMe(comment.uuid);
      changed();
      setLast({
        message: "Comment hidden for you.",
        undo: async () => {
          await journalService.unhideCommentForMe(comment.uuid);
          setGoneComments((s) => toggle(s, comment.uuid, false));
          changed();
        },
      });
    } catch (err) {
      setGoneComments((s) => toggle(s, comment.uuid, false));
      setLast({ message: journalErrorText(err, "The comment couldn't be hidden. Try again.") });
    }
  };
  const mute = async (comment: Comment) => {
    const key = authorKey(comment.author);
    if (!key) return;
    setGoneAuthors((s) => toggle(s, key, true));
    try {
      await journalService.mute(key);
      changed();
      setLast({
        message: `${authorName(comment.author)} muted: their articles and comments are hidden for you.`,
        undo: async () => {
          await journalService.unmute(key);
          setGoneAuthors((s) => toggle(s, key, false));
          changed();
        },
      });
    } catch (err) {
      setGoneAuthors((s) => toggle(s, key, false));
      setLast({ message: journalErrorText(err, "The author couldn't be muted. Try again.") });
    }
  };
  const menuFor = (comment: Comment) => {
    if (!canWrite || comment.mine || isMe(comment.author)) return undefined;
    const items: MenuItem[] = [{ label: "Hide comment", onClick: () => void hideForMe(comment) }];
    if (authorKey(comment.author)) items.push({ label: `Mute ${authorName(comment.author)}`, onClick: () => void mute(comment) });
    items.push({ label: "Report…", danger: true, onClick: () => setReporting(comment) });
    return <ItemMenu items={items} label="Comment options" />;
  };
  const visible = (c: Comment) => {
    const key = authorKey(c.author);
    return !goneComments.has(c.uuid) && !(key && goneAuthors.has(key));
  };
  const replace = (next: Comment) => {
    list.update((items) => items.map((c) => (c.uuid === next.uuid ? next : c)));
    changed();
  };
  const remove = (gone: Comment) => {
    list.update((items) => items.filter((c) => c.uuid !== gone.uuid));
    changed();
    onCount?.(-(1 + gone.replyCount));
  };

  const moderation = (
    <>
      {last && <div className="py-2"><UndoBar action={last} onClose={() => setLast(null)} /></div>}
      {reporting && (
        <ReportDialog
          target={{ commentUuid: reporting.uuid }}
          what="this comment"
          onClose={() => setReporting(null)}
          onDone={(report) => {
            setGoneComments((s) => toggle(s, reporting.uuid, true));
            setReporting(null);
            setLast({ message: reportedMessage(report, "the comment is hidden for you") });
          }}
        />
      )}
    </>
  );

  if (list.error) return <ErrorState message={list.error} onRetry={list.retry} />;
  if (!list.items) return <Spinner />;
  const items = list.items.filter(visible);
  if (items.length === 0 && !list.hasMore) {
    return (
      <>
        {moderation}
        {parentUuid ? null : <p className="py-6 text-center text-[17px] italic text-[#a8a29e]" style={serifText}>No comments yet.</p>}
      </>
    );
  }
  return (
    <>
      {moderation}
      <ul className={parentUuid ? "divide-y divide-[#F1EADB]" : "divide-y divide-[#E7E1D3]"}>
        {items.map((c) => (
          <CommentItem
            key={c.uuid}
            article={article}
            comment={c}
            canWrite={canWrite}
            ownArticle={ownArticle}
            menu={menuFor(c)}
            onChange={(next) => {
              if (next.replyCount > c.replyCount) onCount?.(next.replyCount - c.replyCount);
              replace(next);
            }}
            onRemove={remove}
          />
        ))}
      </ul>
      {list.hasMore && <LoadMore onClick={() => void list.more()} loading={list.loadingMore} />}
    </>
  );
}

/**
 * COMMENTS — under a published article: the top-level comments, the newest first, each with its
 * replies (one level); a box to comment for anyone who writes (`canWrite`).
 */
export function ArticleComments({ article, canWrite, ownArticle, onCount }: {
  article: Article;
  canWrite: boolean;
  ownArticle: boolean;
  onCount: (delta: number) => void;
}) {
  const queryClient = useQueryClient();

  return (
    <section className="pt-6">
      <div className="max-w-2xl mx-auto space-y-6 pt-10 border-t border-[#E0DACC]">
        <h2 className="flex items-baseline gap-2.5 text-[26px] font-black text-[#1c1917]" style={serif}>
          Comments{article.commentCount > 0 && <span className="text-lg font-bold text-[#C49A3C]">{article.commentCount}</span>}
        </h2>
        {canWrite && article.status === "published" && (
          <Composer
            articleUuid={article.uuid}
            placeholder="What do you think?"
            submitLabel="Comment"
            onDone={() => {
              // The list is read again, the new comment at its top.
              void queryClient.invalidateQueries({ queryKey: journalKey("comments", article.uuid, null) });
              onCount(1);
            }}
          />
        )}
        <CommentThread
          article={article}
          canWrite={canWrite}
          ownArticle={ownArticle}
          onCount={onCount}
        />
      </div>
    </section>
  );
}
