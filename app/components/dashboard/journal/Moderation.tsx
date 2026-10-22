// components/dashboard/journal/Moderation.tsx
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, EyeOff, Flag, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { journalKey, useJournal, useJournalQuery } from "../../../context/JournalContext";
import { journalService } from "../../../services/journalService";
import type { CommentCase, Decision, ModerationCaseDetail, ReportReason } from "../../../models/Journal";
import { NOTE_MAX, REASONS, REASON_LABELS, REPORT_STATUS_LABELS, authorName, dateLabel, journalErrorText } from "../../../lib/journal";
import { serif } from "../../preview/PreviewKit";
import { ArticleDocument } from "./ArticleReader";
import { Breadcrumb } from "../Breadcrumb";
import { EmptyState, ErrorState, JournalHeader, LoadMore, PAGE_SIZE, Spinner, StatusChip, usePaged } from "./JournalKit";

/**
 * MODERATION — the editors' (NotAnEditorError for anyone else): the articles waiting for a
 * decision, the oldest first (published ones with open reports, hidden ones whose author asked for
 * a review), then the reported comments, each decided in place.
 */
export function ModerationCases({ onOpen }: { onOpen: (articleUuid: string) => void }) {
  const list = usePaged(["cases"], (offset) => journalService.cases(PAGE_SIZE, offset));

  return (
    <div className="space-y-6 pb-12">
      <JournalHeader title="Moderation" subtitle="Reported articles, hidden ones whose authors asked for a review, and reported comments. The oldest first." />
      {list.error ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : !list.items ? (
        <Spinner />
      ) : list.items.length === 0 ? (
        <EmptyState>Nothing is waiting for a decision.</EmptyState>
      ) : (
        <>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {list.items.map((c) => (
              <button
                key={c.article.uuid}
                type="button"
                onClick={() => onOpen(c.article.uuid)}
                className="group w-full flex items-center gap-4 px-5 py-4 md:px-6 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip status={c.article.status} />
                    {c.openReports > 0 && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-rose-600">
                        <Flag className="h-3 w-3" /> {c.openReports} open report{c.openReports === 1 ? "" : "s"}
                      </span>
                    )}
                    {c.reviewRequested && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700"><RotateCcw className="h-3 w-3" /> Review asked</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-base font-black text-slate-900 leading-snug truncate" style={serif}>{c.article.title || "Untitled"}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                    By {authorName(c.article.author)} · waiting since {dateLabel(c.waitingSince)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#C49A3C] shrink-0" />
              </button>
            ))}
          </div>
          {list.hasMore && <LoadMore onClick={() => void list.more()} loading={list.loadingMore} />}
        </>
      )}
      <CommentCases />
    </div>
  );
}

/** One reported comment: its text, its article, its reports, and the decision taken in place. */
function CommentCaseCard({ item, onDecided }: { item: CommentCase; onDecided: (uuid: string) => void }) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [note, setNote] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { comment, article, reports } = item;
  const canDecide = decision === "keep" || (decision === "hide" && !!reason);

  const decide = async () => {
    if (!decision || !canDecide) return;
    setDeciding(true);
    setError(null);
    try {
      await journalService.decideComment(comment.uuid, decision, reason || undefined, note.trim());
      onDecided(comment.uuid);
    } catch (err) {
      setError(journalErrorText(err, "The decision couldn't be saved."));
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div className="px-5 py-5 md:px-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
        <span className="flex items-center gap-1 text-rose-600">
          <Flag className="h-3 w-3" /> {item.openReports} open report{item.openReports === 1 ? "" : "s"}
        </span>
        <span className="text-slate-400">· waiting since {dateLabel(item.waitingSince)}</span>
      </div>
      <p className="text-[11px] font-semibold text-slate-400">
        {authorName(comment.author)} on <span className="text-slate-600" style={serif}>{article.title || "Untitled"}</span>
      </p>
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">{comment.text}</p>
      <ul className="space-y-1.5">
        {reports.map((r) => (
          <li key={r.uuid} className="text-xs text-slate-500">
            <span className="font-bold text-slate-700">{REASON_LABELS[r.reason]}</span> · {dateLabel(r.createdAt)} · {REPORT_STATUS_LABELS[r.status]}
            {r.note && <span className="block text-slate-500 whitespace-pre-line">{r.note}</span>}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setDecision("keep")}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold ${decision === "keep" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
        >
          <ShieldCheck className="h-3.5 w-3.5" /> {comment.status === "hidden_by_editors" ? "Show again" : "Keep"}
        </button>
        <button
          type="button"
          onClick={() => setDecision("hide")}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold ${decision === "hide" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
        >
          <EyeOff className="h-3.5 w-3.5" /> Hide
        </button>
        {decision === "hide" && (
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as ReportReason | "")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#C49A3C]"
          >
            <option value="">Why (its writer reads it)</option>
            {REASONS.map((r) => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}
          </select>
        )}
      </div>
      {decision && (
        <>
          <textarea
            value={note}
            maxLength={NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="A note to its writer (optional)"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#C49A3C] resize-none"
          />
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
          <button
            type="button"
            onClick={() => void decide()}
            disabled={!canDecide || deciding}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
          >
            {deciding && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
          </button>
        </>
      )}
    </div>
  );
}

/** The comments with open reports, the longest waiting first; a decided one leaves the list. */
function CommentCases() {
  const { changed } = useJournal();
  const list = usePaged(["commentCases"], (offset) => journalService.commentCases(PAGE_SIZE, offset));
  const decided = (uuid: string) => {
    list.update((items) => items.filter((c) => c.comment.uuid !== uuid));
    changed();
  };

  return (
    <section className="space-y-3 pt-4">
      <h2 className="text-lg font-black text-slate-900" style={serif}>Reported comments</h2>
      {list.error ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : !list.items ? (
        <Spinner />
      ) : list.items.length === 0 ? (
        <EmptyState>No comment is waiting for a decision.</EmptyState>
      ) : (
        <>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {list.items.map((c) => <CommentCaseCard key={c.comment.uuid} item={c} onDecided={decided} />)}
          </div>
          {list.hasMore && <LoadMore onClick={() => void list.more()} loading={list.loadingMore} />}
        </>
      )}
    </section>
  );
}

/**
 * One case: the article whole, what waits on it, every report on it (never who made it), and the
 * decision: keep it (a hidden one is shown again) or hide it with a reason its author reads.
 * Either closes its open reports and the author's ask.
 */
export function ModerationCasePage({ uuid, onBack }: { uuid: string; onBack: () => void }) {
  const { changed } = useJournal();
  const queryClient = useQueryClient();
  const read = useJournalQuery(["case", uuid], () => journalService.getCase(uuid));
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [note, setNote] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [decideError, setDecideError] = useState<string | null>(null);
  const [decided, setDecided] = useState<Decision | null>(null);

  const detail = read.data;
  const back = <Breadcrumb trail={[{ label: "Moderation", onClick: onBack }]} current={detail?.article.title || "Case"} />;
  if (read.isError) {
    const message = journalErrorText(read.error, "This case couldn't be loaded.");
    return <div className="pb-12 space-y-5">{back}<ErrorState message={message} onRetry={() => void read.refetch()} /></div>;
  }
  if (!detail) return <div className="pb-12 space-y-5">{back}<Spinner /></div>;

  const { article, openCase, reports } = detail;
  const canDecide = decision === "keep" || (decision === "hide" && !!reason);

  const decide = async () => {
    if (!decision || !canDecide) return;
    setDeciding(true);
    setDecideError(null);
    try {
      const next = await journalService.decide(uuid, decision, reason || undefined, note.trim());
      queryClient.setQueryData<ModerationCaseDetail>(journalKey("case", uuid), {
        ...detail, article: next, openCase: null,
        reports: reports.map((r) => (r.status === "open" ? { ...r, status: decision === "hide" ? "article_hidden" : "article_kept" } : r)),
      });
      // The cases' list, the article's page and the lists it's in are read again when next shown.
      changed();
      setDecided(decision);
      setDecision(null);
    } catch (err) {
      setDecideError(journalErrorText(err, "The decision couldn't be saved."));
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div className="pb-12 space-y-5">
      {back}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] items-start">
        <ArticleDocument article={article} />

        <aside className="space-y-4 xl:sticky xl:top-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 text-sm">
            <div className="flex items-center gap-2"><StatusChip status={article.status} /></div>
            {openCase ? (
              <>
                <p className="text-xs text-slate-500">Waiting since {dateLabel(openCase.waitingSince)}</p>
                {openCase.reviewRequested && (
                  <div className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                    <p className="font-bold">The author asked for a review.</p>
                    {openCase.reviewNote && <p className="mt-1 whitespace-pre-line">{openCase.reviewNote}</p>}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500">Nothing is waiting on it.</p>
            )}
            {article.moderation && (
              <p className="text-xs text-slate-500">
                Hidden {dateLabel(article.moderation.hiddenAt)}: {REASON_LABELS[article.moderation.reason]}
                {article.moderation.note && <span className="block mt-1 italic">“{article.moderation.note}”</span>}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Reports ({reports.length})</p>
            {reports.length === 0 ? (
              <p className="text-xs text-slate-400">None.</p>
            ) : (
              <ul className="space-y-3">
                {reports.map((r) => (
                  <li key={r.uuid} className="text-xs">
                    <p className="font-bold text-slate-800">{REASON_LABELS[r.reason]}</p>
                    <p className="text-slate-400">{dateLabel(r.createdAt)} · {REPORT_STATUS_LABELS[r.status]}</p>
                    {r.note && <p className="mt-1 text-slate-600 whitespace-pre-line">{r.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Decision</p>
            {decided && (
              <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800">
                {decided === "hide" ? "Hidden: the author can read why." : "Kept: it's in the Journal."}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDecision("keep")}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold ${decision === "keep" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> {article.status === "hidden" ? "Show again" : "Keep"}
              </button>
              <button
                type="button"
                onClick={() => setDecision("hide")}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold ${decision === "hide" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
              >
                <EyeOff className="h-3.5 w-3.5" /> Hide
              </button>
            </div>
            {decision === "hide" && (
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason | "")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#C49A3C]"
              >
                <option value="">Why (the author reads it)</option>
                {REASONS.map((r) => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}
              </select>
            )}
            {decision && (
              <textarea
                value={note}
                maxLength={NOTE_MAX}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="A note to the author (optional)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#C49A3C] resize-none"
              />
            )}
            {decideError && <p className="text-xs font-medium text-rose-600">{decideError}</p>}
            {decision && (
              <button
                type="button"
                onClick={() => void decide()}
                disabled={!canDecide || deciding}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
              >
                {deciding && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
