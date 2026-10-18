// components/dashboard/journal/MyReports.tsx
"use client";

import { journalService } from "../../../services/journalService";
import type { ReportStatus } from "../../../models/Journal";
import { REASON_LABELS, REPORT_STATUS_LABELS, dateLabel } from "../../../lib/journal";
import { EmptyState, ErrorState, JournalHeader, LoadMore, PAGE_SIZE, Spinner, usePaged } from "./JournalKit";

const STATUS_TONES: Record<ReportStatus, string> = {
  open: "bg-amber-50 text-amber-700",
  article_kept: "bg-slate-100 text-slate-600",
  article_hidden: "bg-emerald-50 text-emerald-700",
  comment_kept: "bg-slate-100 text-slate-600",
  comment_hidden: "bg-emerald-50 text-emerald-700",
};

/** YOUR REPORTS — the reader's reports on articles and comments, the newest first, each with the editors' decision. */
export function MyReports() {
  const list = usePaged((offset) => journalService.reports(PAGE_SIZE, offset), "reports");

  return (
    <div className="space-y-6 pb-12">
      <JournalHeader title="Your reports" subtitle="What you reported to the editors, and what they decided." />
      {list.error ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : !list.items ? (
        <Spinner />
      ) : list.items.length === 0 ? (
        <EmptyState>You haven&apos;t reported any article or comment.</EmptyState>
      ) : (
        <>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {list.items.map((r) => (
              <div key={r.uuid} className="px-5 py-4 md:px-6 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">
                    {r.commentUuid && <span className="font-semibold text-slate-500">A comment on </span>}
                    {r.articleTitle}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {REASON_LABELS[r.reason]} · reported {dateLabel(r.createdAt)}
                    {r.decidedAt && ` · decided ${dateLabel(r.decidedAt)}`}
                  </p>
                  {r.note && <p className="mt-1.5 text-xs text-slate-400 italic line-clamp-2">“{r.note}”</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${STATUS_TONES[r.status]}`}>
                  {REPORT_STATUS_LABELS[r.status]}
                </span>
              </div>
            ))}
          </div>
          {list.hasMore && <LoadMore onClick={() => void list.more()} loading={list.loadingMore} />}
        </>
      )}
    </div>
  );
}
