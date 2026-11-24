// components/dashboard/journal/FollowingRail.tsx
"use client";

import { ChevronRight, UserCheck } from "lucide-react";
import { journalService } from "../../../services/journalService";
import { authorName } from "../../../lib/journal";
import type { ArticleAuthor } from "../../../models/Journal";
import type { JournalFilters } from "../JournalSection";
import { AuthorAvatar, AuthorBadge, PAGE_SIZE, usePaged } from "./JournalKit";

// The authors shown in the rail; the rest on Following.
const SHOWN = 8;

type Author = NonNullable<JournalFilters["author"]>;

/** The list's narrowing to `author`: a local one by their account, a network one by their key. */
export function authorFilter(author: ArticleAuthor): Author {
  return author.userUuid
    ? { uuid: author.userUuid, name: authorName(author) }
    : { pubkey: author.pubkey ?? undefined, name: authorName(author) };
}

const sameAuthor = (a: Author | undefined, b: Author) => !!a && (a.uuid ? a.uuid === b.uuid : !!a.pubkey && a.pubkey === b.pubkey);

/**
 * FOLLOWING RAIL — beside the Journal's feed, the authors the reader follows, the latest first
 * (the same read as Following's page, so an unfollow there shows here): one opens their articles
 * (`onAuthor`), the one open now marked; "Their articles" narrows the feed to all of them
 * (`onFollowing`); "See all" opens Following. Read-only: following and unfollowing are on an
 * article's page and on Following.
 */
export function FollowingRail({ author, following, onAuthor, onFollowing, onSeeAll }: {
  author?: Author;
  following: boolean;
  onAuthor: (author: Author) => void;
  onFollowing: () => void;
  onSeeAll: () => void;
}) {
  const list = usePaged(["follows"], (offset) => journalService.follows(PAGE_SIZE, offset));
  const items = list.items;

  return (
    <section aria-label="Following" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-900">Following</h2>
        {items && items.length > 0 && (
          <button
            type="button"
            onClick={onFollowing}
            aria-pressed={following}
            title="The latest articles of everyone you follow"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
              following ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            <UserCheck className="h-3 w-3" /> Their articles
          </button>
        )}
      </div>

      {list.error ? (
        <p className="text-xs text-slate-500">
          Whom you follow couldn&apos;t be loaded.{" "}
          <button type="button" onClick={list.retry} className="font-bold text-[#9a7424] hover:text-[#C49A3C]">Try again</button>
        </p>
      ) : !items ? (
        <ul className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="h-8 w-8 rounded-full bg-slate-200/70 animate-pulse" />
              <span className="h-3 w-28 rounded bg-slate-200/70 animate-pulse" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500 leading-relaxed">
          You don&apos;t follow anyone yet. Follow an author from one of their articles: their latest articles,
          and those of whom they follow, make up Your network.
        </p>
      ) : (
        <>
          <ul className="-mx-2 space-y-0.5">
            {items.slice(0, SHOWN).map(({ author: a }) => {
              const filter = authorFilter(a);
              const here = sameAuthor(author, filter);
              return (
                <li key={a.pubkey ?? a.npub ?? a.userUuid ?? authorName(a)}>
                  <button
                    type="button"
                    onClick={() => onAuthor(filter)}
                    aria-current={here || undefined}
                    className={`group w-full flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${here ? "bg-[#C49A3C]/12" : "hover:bg-white"}`}
                  >
                    {a.pictureUrl ? (
                      <AuthorAvatar author={a} size={32} />
                    ) : (
                      <span className="h-8 w-8 shrink-0 rounded-full bg-[#1c1917] text-[#E2C27A] text-xs font-black flex items-center justify-center">
                        {authorName(a).charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[13px] font-bold ${here ? "text-[#9a7424]" : "text-slate-800 group-hover:text-[#9a7424]"}`}>
                        {authorName(a)}
                      </span>
                      {(a.kind === "advisor" || a.muted) && (
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <AuthorBadge author={a} />
                          {a.muted && <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Muted</span>}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={onSeeAll} className="flex items-center gap-1 text-xs font-bold text-[#9a7424] hover:text-[#C49A3C]">
            {list.total > SHOWN ? `See all ${list.total}` : "Manage"} <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </section>
  );
}
