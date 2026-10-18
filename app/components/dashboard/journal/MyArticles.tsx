// components/dashboard/journal/MyArticles.tsx
"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { journalService } from "../../../services/journalService";
import type { ArticleStatus } from "../../../models/Journal";
import { CATEGORY_LABELS, dateLabel } from "../../../lib/journal";
import { Pills, serif } from "../../preview/PreviewKit";
import { ActionButton } from "../PageHeader";
import { EmptyState, ErrorState, JournalHeader, LoadMore, PAGE_SIZE, Spinner, StatusChip, usePaged } from "./JournalKit";

type Filter = "all" | ArticleStatus;

/** YOUR ARTICLES — the caller's own, in any state, the last updated first; each opens its editor. */
export function MyArticles({ onOpen, onNew }: { onOpen: (uuid: string) => void; onNew: () => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const list = usePaged(
    (offset) => journalService.mine(filter === "all" ? undefined : filter, PAGE_SIZE, offset),
    filter,
  );

  return (
    <div className="space-y-6 pb-12">
      <JournalHeader
        title="Your articles"
        subtitle="Drafts only you can read, and what you've published."
        actions={<ActionButton action={{ label: "New article", onClick: onNew, primary: true }} />}
      />
      <Pills<Filter>
        options={[
          { value: "all", label: "All" },
          { value: "draft", label: "Drafts" },
          { value: "published", label: "Published" },
          { value: "hidden", label: "Hidden" },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {list.error ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : !list.items ? (
        <Spinner />
      ) : list.items.length === 0 ? (
        <EmptyState>{filter === "all" ? "You haven't written anything yet." : "Nothing here."}</EmptyState>
      ) : (
        <>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {list.items.map((a) => (
              <button
                key={a.uuid}
                type="button"
                onClick={() => onOpen(a.uuid)}
                className="group w-full flex items-center gap-4 px-5 py-4 md:px-6 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip status={a.status} />
                    {a.category && <span className="text-[10px] font-black uppercase tracking-wider text-[#C49A3C]">{CATEGORY_LABELS[a.category]}</span>}
                    {a.audience === "advisor_clients" && <span className="text-[10px] font-bold text-slate-400">Clients only</span>}
                  </div>
                  <p className={`mt-1.5 text-base font-black leading-snug truncate ${a.title ? "text-slate-900" : "text-slate-400"}`} style={serif}>
                    {a.title || "Untitled draft"}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                    {a.publishedAt ? `Published ${dateLabel(a.publishedAt)}` : "Never published"}
                    {a.editedAt && ` · Updated ${dateLabel(a.editedAt)}`}
                    {` · ${a.readMinutes} min read`}
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
