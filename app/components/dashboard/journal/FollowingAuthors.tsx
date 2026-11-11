// components/dashboard/journal/FollowingAuthors.tsx
"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useJournal } from "../../../context/JournalContext";
import { journalService } from "../../../services/journalService";
import { authorKey, authorName, dateLabel, journalErrorText } from "../../../lib/journal";
import type { ArticleAuthor } from "../../../models/Journal";
import type { JournalFilters } from "../JournalSection";
import {
  AuthorAvatar, AuthorBadge, EmptyState, ErrorState, FollowButton, JournalHeader, LoadMore, NpubChip, PAGE_SIZE, Spinner, usePaged,
} from "./JournalKit";
import { ItemMenu, ReportDialog, UndoBar, reportedMessage, type Undoable } from "./Moderation";

/**
 * FOLLOWING — the authors the reader follows (on this instance or the network, by their public
 * key), the latest first: each opens their articles, and can be unfollowed here. Following is
 * public: it goes to the network as the reader's contact list. Each can be muted (here only) or
 * reported.
 */
export function FollowingAuthors({ onAuthor }: { onAuthor: (author: NonNullable<JournalFilters["author"]>) => void }) {
  const { changed } = useJournal();
  const list = usePaged(["follows"], (offset) => journalService.follows(PAGE_SIZE, offset));
  const [last, setLast] = useState<Undoable | null>(null);
  const [reporting, setReporting] = useState<ArticleAuthor | null>(null);

  const setMuted = (key: string, muted: boolean) =>
    list.update((items) => items.map((f) => (authorKey(f.author) === key ? { ...f, author: { ...f.author, muted } } : f)));
  const toggleMute = async (author: ArticleAuthor) => {
    const key = authorKey(author);
    if (!key) return;
    const muted = !author.muted;
    try {
      if (muted) await journalService.mute(key);
      else await journalService.unmute(key);
      setMuted(key, muted);
      changed();
      setLast({ message: muted ? `${authorName(author)} muted: their articles and comments are hidden for you.` : `${authorName(author)} unmuted.` });
    } catch (err) {
      setLast({ message: journalErrorText(err, "That didn't work. Try again.") });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <JournalHeader
        title="Following"
        subtitle="The authors whose articles you follow, here and on the network. Whom you follow is public on the network."
      />
      <UndoBar action={last} onClose={() => setLast(null)} />
      {reporting && authorKey(reporting) && (
        <ReportDialog
          target={{ pubkey: authorKey(reporting)! }}
          what={authorName(reporting)}
          onClose={() => setReporting(null)}
          onDone={(report) => {
            setMuted(authorKey(reporting)!, true);
            setLast({ message: reportedMessage(report, `${authorName(reporting)} is muted for you`) });
            setReporting(null);
          }}
        />
      )}
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
                  {author.muted && <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Muted</span>}
                  <FollowButton
                    author={author}
                    // Unfollowed: off the list.
                    onChange={(followed) => { if (!followed) list.update((items) => items.filter((f) => (f.author.pubkey ?? f.author.npub) !== key)); }}
                  />
                  <ItemMenu
                    label="Author options"
                    items={[
                      { label: author.muted ? "Unmute" : "Mute", onClick: () => void toggleMute(author) },
                      { label: "Report…", danger: true, onClick: () => setReporting(author) },
                    ]}
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
