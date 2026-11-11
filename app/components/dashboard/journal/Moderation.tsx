// components/dashboard/journal/Moderation.tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Image as ImageIcon, MoreHorizontal, Undo2, X } from "lucide-react";
import { useUser } from "../../../context/UserContext";
import { useJournal } from "../../../context/JournalContext";
import { useAccountRead } from "../../../hooks/useAccountQuery";
import { journalService, networkService } from "../../../services/journalService";
import type { ArticleAuthor, ArticleSummary, Report, ReportReason, ReportTarget } from "../../../models/Journal";
import {
  REPORT_NOTE_MAX, REPORT_NOTICE, REPORT_REASONS, REPORT_REASON_LABELS, authorKey, authorName, journalErrorText,
} from "../../../lib/journal";
import { ConfirmDialog } from "../ConfirmDialog";

/**
 * Whether an author is the caller: their account here, or their key on the network (read once,
 * shared with Settings → Network identity). Nobody hides, mutes or reports themselves.
 */
export function useIsMe() {
  const { user } = useUser();
  const { canWrite } = useJournal();
  const identity = useAccountRead(["network-identity"], () => networkService.identity(), canWrite);
  return (author: ArticleAuthor) =>
    (!!user && !!author.userUuid && author.userUuid === user.uuid)
    || (!!identity?.pubkey && author.pubkey === identity.pubkey)
    || (!!identity?.npub && author.npub === identity.npub);
}

export interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

/** A small "…" menu on an article, a comment or an author: the reader's own moderation. Nothing when empty. */
export function ItemMenu({ items, label = "More", dark = false }: { items: MenuItem[]; label?: string; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (items.length === 0) return null;
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        title={label}
        aria-expanded={open}
        className={`flex items-center justify-center h-7 w-7 rounded-lg transition-colors ${
          dark ? "bg-black/30 text-stone-200 hover:bg-black/50" : "bg-white/85 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        }`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-30 min-w-[180px] p-1.5 bg-white rounded-[14px] border border-[#E0DACC] shadow-[0_18px_40px_-16px_rgba(28,25,23,0.25)] flex flex-col">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`text-left px-3 py-2 rounded-[9px] text-[13px] font-medium hover:bg-[#F7F5EF] ${item.danger ? "text-[#e11d48]" : "text-[#1c1917]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * REPORT — why the reader reports an article, a comment or an author, with a note: the target is
 * hidden (an author muted) for them, and a report on network content goes out on the network,
 * public and signed with their identity, as the dialog says. `onDone` once the API took it.
 */
export function ReportDialog({ target, what, onClose, onDone }: {
  target: ReportTarget;
  // "this article", "this comment", "Name".
  what: string;
  onClose: () => void;
  onDone: (report: Report) => void;
}) {
  const { changed } = useJournal();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!reason) {
      setError("Pick a reason.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const report = await journalService.report({ ...target, reason, note: note.trim() || null });
      changed();
      onDone(report);
    } catch (err) {
      setError(journalErrorText(err, "The report couldn't be sent. Try again."));
      setSending(false);
    }
  };

  return (
    <ConfirmDialog
      title={`Report ${what}`}
      description={REPORT_NOTICE}
      confirmLabel="Report"
      tone="danger"
      confirming={sending}
      error={error}
      onConfirm={() => void send()}
      onClose={onClose}
    >
      <fieldset className="space-y-1.5">
        <legend className="text-[10px] font-bold text-[#78716c] uppercase tracking-wider mb-1.5">Reason</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
            <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[#C49A3C]" />
            {REPORT_REASON_LABELS[r]}
          </label>
        ))}
      </fieldset>
      <label className="block">
        <span className="block text-[10px] font-bold text-[#78716c] uppercase tracking-wider mb-1.5">Note (optional)</span>
        <textarea
          value={note}
          maxLength={REPORT_NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Anything that helps understand the report"
          className="w-full px-4 py-3 bg-[#F7F5EF] border border-[rgba(196,154,60,0.2)] rounded-xl text-sm text-[#1c1917] outline-none focus:ring-2 focus:ring-[#C49A3C]/40 resize-none"
        />
        <span className="block text-right text-[10px] text-slate-400">{note.length}/{REPORT_NOTE_MAX}</span>
      </label>
    </ConfirmDialog>
  );
}

/** What the reader just did to a list ("Article hidden"), with a way to take it back when there is one. */
export interface Undoable {
  message: string;
  undo?: () => Promise<void>;
}

/** The last moderation action on a list, with its Undo. */
export function UndoBar({ action, onClose }: { action: Undoable | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!action) return null;
  const undo = async () => {
    if (!action.undo) return;
    setBusy(true);
    setError(null);
    try {
      await action.undo();
      onClose();
    } catch (err) {
      setError(journalErrorText(err, "That couldn't be undone. Try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#1c1917] text-white px-4 py-3 text-xs font-semibold">
      <span className="flex-1 min-w-0">{action.message}</span>
      {error && <span className="text-rose-300">{error}</span>}
      {action.undo && (
        <button type="button" onClick={() => void undo()} disabled={busy} className="flex items-center gap-1.5 font-bold text-[#E2C27A] hover:text-white disabled:opacity-50">
          <Undo2 className="h-3.5 w-3.5" /> Undo
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="Dismiss" className="p-0.5 text-stone-400 hover:text-white">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Where an image of an author outside the reader's network would be: loaded only when asked. */
export function ImagesHidden({ onShow, className = "" }: { onShow: () => void; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-xs text-slate-500 ${className}`}>
      <ImageIcon className="h-4 w-4 text-slate-400" />
      <span>Images from authors outside your network aren&apos;t loaded.</span>
      <button type="button" onClick={onShow} className="font-bold text-[#9a7424] hover:text-[#C49A3C]">Show images</button>
    </div>
  );
}

/** What a report made says, once sent; `effect`: what it did for the reader ("the article is hidden for you"). */
export const reportedMessage = (report: Report, effect: string) =>
  report.networkState === "local"
    ? `Reported: ${effect}.`
    : `Reported: the report is published on the network, signed with your identity, and ${effect}.`;

/**
 * The reader's moderation on a list of articles: each card's menu (hide, mute its author, report;
 * none on the reader's own), what they took off the list (`visible`, at once and before the API
 * answers back), the last action with its Undo (`bar`) and the report's dialog (`dialog`).
 */
export function useArticleModeration() {
  const { canWrite, changed } = useJournal();
  const isMe = useIsMe();
  const [goneArticles, setGoneArticles] = useState<ReadonlySet<string>>(new Set());
  const [goneAuthors, setGoneAuthors] = useState<ReadonlySet<string>>(new Set());
  const [last, setLast] = useState<Undoable | null>(null);
  const [reporting, setReporting] = useState<ArticleSummary | null>(null);

  const add = (set: ReadonlySet<string>, key: string) => new Set(set).add(key);
  const drop = (set: ReadonlySet<string>, key: string) => {
    const next = new Set(set);
    next.delete(key);
    return next;
  };

  const hide = async (article: ArticleSummary) => {
    setGoneArticles((s) => add(s, article.uuid));
    try {
      await journalService.hideArticle(article.uuid);
      changed();
      setLast({
        message: "Article hidden. You'll find it in Settings → Muted and hidden.",
        undo: async () => {
          await journalService.unhideArticle(article.uuid);
          setGoneArticles((s) => drop(s, article.uuid));
          changed();
        },
      });
    } catch (err) {
      setGoneArticles((s) => drop(s, article.uuid));
      setLast({ message: journalErrorText(err, "The article couldn't be hidden. Try again.") });
    }
  };

  const mute = async (author: ArticleAuthor) => {
    const key = authorKey(author);
    if (!key) return;
    setGoneAuthors((s) => add(s, key));
    try {
      await journalService.mute(key);
      changed();
      setLast({
        message: `${authorName(author)} muted: their articles and comments are hidden for you.`,
        undo: async () => {
          await journalService.unmute(key);
          setGoneAuthors((s) => drop(s, key));
          changed();
        },
      });
    } catch (err) {
      setGoneAuthors((s) => drop(s, key));
      setLast({ message: journalErrorText(err, "The author couldn't be muted. Try again.") });
    }
  };

  const visible = (article: ArticleSummary) => {
    const key = authorKey(article.author);
    return !goneArticles.has(article.uuid) && !(key && goneAuthors.has(key));
  };

  const menuFor = (article: ArticleSummary, dark = false): ReactNode => {
    if (!canWrite || isMe(article.author)) return null;
    const items: MenuItem[] = [{ label: "Hide article", onClick: () => void hide(article) }];
    if (authorKey(article.author)) items.push({ label: `Mute ${authorName(article.author)}`, onClick: () => void mute(article.author) });
    items.push({ label: "Report…", onClick: () => setReporting(article), danger: true });
    return <ItemMenu items={items} label="Article options" dark={dark} />;
  };

  const bar = <UndoBar action={last} onClose={() => setLast(null)} />;
  const dialog = reporting && (
    <ReportDialog
      target={{ articleUuid: reporting.uuid }}
      what="this article"
      onClose={() => setReporting(null)}
      onDone={(report) => {
        setGoneArticles((s) => add(s, reporting.uuid));
        setReporting(null);
        setLast({ message: reportedMessage(report, "the article is hidden for you") });
      }}
    />
  );
  return { visible, menuFor, bar, dialog };
}
