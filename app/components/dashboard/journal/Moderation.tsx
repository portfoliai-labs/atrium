// components/dashboard/journal/Moderation.tsx
"use client";

import { useEffect, useState } from "react";
import { ChevronRight, EyeOff, Flag, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { journalService } from "../../../services/journalService";
import type { Decision, ModerationCaseDetail, ReportReason } from "../../../models/Journal";
import { NOTE_MAX, REASONS, REASON_LABELS, REPORT_STATUS_LABELS, authorName, dateLabel, journalErrorText } from "../../../lib/journal";
import { serif } from "../../preview/PreviewKit";
import { ArticleDocument } from "./ArticleReader";
import { BackLink, EmptyState, ErrorState, JournalHeader, LoadMore, PAGE_SIZE, Spinner, StatusChip, usePaged } from "./JournalKit";

/**
 * MODERATION — the editors' (NotAnEditorError for anyone else): the articles waiting for a
 * decision, the oldest first: published ones with open reports, hidden ones whose author asked for
 * a review.
 */
export function ModerationCases({ onOpen }: { onOpen: (articleUuid: string) => void }) {
  const list = usePaged((offset) => journalService.cases(PAGE_SIZE, offset), "cases");

  return (
    <div className="space-y-6 pb-12">
      <JournalHeader title="Moderation" subtitle="Reported articles, and hidden ones whose authors asked for a review. The oldest first." />
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
    </div>
  );
}

/**
 * One case: the article whole, what waits on it, every report on it (never who made it), and the
 * decision: keep it (a hidden one is shown again) or hide it with a reason its author reads.
 * Either closes its open reports and the author's ask.
 */
export function ModerationCasePage({ uuid, onBack }: { uuid: string; onBack: () => void }) {
  const [detail, setDetail] = useState<ModerationCaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [note, setNote] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [decideError, setDecideError] = useState<string | null>(null);
  const [decided, setDecided] = useState<Decision | null>(null);

  useEffect(() => {
    let cancelled = false;
    journalService.getCase(uuid)
      .then((d) => { if (!cancelled) { setDetail(d); setError(null); } })
      .catch((err) => { if (!cancelled) setError(journalErrorText(err, "This case couldn't be loaded.")); });
    return () => { cancelled = true; };
  }, [uuid, attempt]);

  const back = <BackLink label="Moderation" onClick={onBack} />;
  if (error) return <div className="pb-12 space-y-5">{back}<ErrorState message={error} onRetry={() => setAttempt((n) => n + 1)} /></div>;
  if (!detail) return <div className="pb-12 space-y-5">{back}<Spinner /></div>;

  const { article, openCase, reports } = detail;
  const canDecide = decision === "keep" || (decision === "hide" && !!reason);

  const decide = async () => {
    if (!decision || !canDecide) return;
    setDeciding(true);
    setDecideError(null);
    try {
      const next = await journalService.decide(uuid, decision, reason || undefined, note.trim());
      setDetail({ ...detail, article: next, openCase: null, reports: reports.map((r) => (r.status === "open" ? { ...r, status: decision === "hide" ? "article_hidden" : "article_kept" } : r)) });
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
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#C49A3C] resize-none"
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
