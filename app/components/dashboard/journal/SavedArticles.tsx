// components/dashboard/journal/SavedArticles.tsx
"use client";

import { useState } from "react";
import { BookmarkX, Loader2 } from "lucide-react";
import { journalService } from "../../../services/journalService";
import { dateLabel, journalErrorText } from "../../../lib/journal";
import { ArticleCard, EmptyState, ErrorState, JournalHeader, LoadMore, PAGE_SIZE, Spinner, usePaged } from "./JournalKit";

/**
 * SAVED — the reader's saved articles, the last saved first. An article that stops being readable
 * (unpublished, hidden, deleted) drops out on its own.
 */
export function SavedArticles({ onOpen }: { onOpen: (slug: string) => void }) {
  const list = usePaged((offset) => journalService.saved(PAGE_SIZE, offset), "saved");
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unsave = async (uuid: string) => {
    setRemoving(uuid);
    setError(null);
    try {
      await journalService.unsave(uuid);
      list.update((items) => items.filter((s) => s.article.uuid !== uuid));
    } catch (err) {
      setError(journalErrorText(err, "That didn't work. Try again."));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <JournalHeader title="Saved" subtitle="Articles you kept to read again." />
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      {list.error ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : !list.items ? (
        <Spinner />
      ) : list.items.length === 0 ? (
        <EmptyState>Nothing saved yet: save an article from its page to find it here.</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {list.items.map(({ article, savedAt }) => (
              <ArticleCard
                key={article.uuid}
                article={article}
                onOpen={() => article.slug && onOpen(article.slug)}
                footer={
                  <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-400">
                    <span>Saved {dateLabel(savedAt)}</span>
                    <button
                      type="button"
                      onClick={() => void unsave(article.uuid)}
                      disabled={removing === article.uuid}
                      className="flex items-center gap-1 font-bold hover:text-rose-600 disabled:opacity-50"
                    >
                      {removing === article.uuid ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookmarkX className="h-3 w-3" />} Remove
                    </button>
                  </div>
                }
              />
            ))}
          </div>
          {list.hasMore && <LoadMore onClick={() => void list.more()} loading={list.loadingMore} />}
        </>
      )}
    </div>
  );
}
