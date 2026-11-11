// components/dashboard/journal/FollowingAuthors.tsx
"use client";

import { ChevronRight } from "lucide-react";
import { journalService } from "../../../services/journalService";
import { authorName, dateLabel } from "../../../lib/journal";
import type { JournalFilters } from "../JournalSection";
import {
  AuthorAvatar, AuthorBadge, EmptyState, ErrorState, FollowButton, JournalHeader, LoadMore, NpubChip, PAGE_SIZE, Spinner, usePaged,
} from "./JournalKit";

/**
 * FOLLOWING — the authors the reader follows (on this instance or the network, by their public
 * key), the latest first: each opens their articles, and can be unfollowed here. Following is
 * public: it goes to the network as the reader's contact list.
 */
export function FollowingAuthors({ onAuthor }: { onAuthor: (author: NonNullable<JournalFilters["author"]>) => void }) {
  const list = usePaged(["follows"], (offset) => journalService.follows(PAGE_SIZE, offset));

  return (
    <div className="space-y-6 pb-12">
      <JournalHeader
        title="Following"
        subtitle="The authors whose articles you follow, here and on the network. Whom you follow is public on the network."
      />
      {list.error ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : !list.items ? (
        <Spinner />
      ) : list.items.length === 0 ? (
        <EmptyState>You don&apos;t follow anyone yet: follow an author from one of their articles.</EmptyState>
      ) : (
        <>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {list.items.map(({ author, followedAt }) => {
              const key = author.pubkey ?? author.npub ?? "";
              const open = () => onAuthor(author.userUuid
                ? { uuid: author.userUuid, name: authorName(author) }
                : { pubkey: author.pubkey ?? undefined, name: authorName(author) });
              return (
                <div key={key} className="flex flex-wrap items-center gap-3 px-5 py-4 md:px-6">
                  <button type="button" onClick={open} className="group flex-1 min-w-0 flex items-center gap-3 text-left">
                    <AuthorAvatar author={author} size={32} />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-900 group-hover:text-[#9a7424]">
                        {authorName(author)}
                        <AuthorBadge author={author} />
                      </span>
                      <span className="block text-[11px] font-semibold text-slate-400">Followed {dateLabel(followedAt)}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#C49A3C] shrink-0" />
                  </button>
                  {author.npub && <NpubChip npub={author.npub} />}
                  <FollowButton
                    author={author}
                    // Unfollowed: off the list.
                    onChange={(followed) => { if (!followed) list.update((items) => items.filter((f) => (f.author.pubkey ?? f.author.npub) !== key)); }}
                  />
                </div>
              );
            })}
          </div>
          {list.hasMore && <LoadMore onClick={() => void list.more()} loading={list.loadingMore} />}
        </>
      )}
    </div>
  );
}
