// components/dashboard/journal/MutedAndHidden.tsx
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { EyeOff, Flag, Loader2, VolumeX } from "lucide-react";
import { journalKey, useJournal, useJournalQuery } from "../../../context/JournalContext";
import { journalService } from "../../../services/journalService";
import { authorKey, authorName, dateLabel, isJournalMissing, journalErrorText } from "../../../lib/journal";
import type { ReaderSettings } from "../../../models/Journal";
import { AuthorAvatar, AuthorBadge, EmptyState, ErrorState, LoadMore, NetworkBadge, NpubChip, PAGE_SIZE, Spinner, usePaged } from "./JournalKit";

const cardClass = "bg-white p-6 md:p-8 rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm space-y-4";
const rowButton = "shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[rgba(196,154,60,0.3)] text-xs font-bold text-[#57534e] hover:border-[#C49A3C] hover:text-[#1c1917] disabled:opacity-50";

function CardHead({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 border-b border-[rgba(196,154,60,0.15)] pb-4">
      <div className="p-2.5 bg-[#F7F5EF] text-[#C49A3C] rounded-xl">{icon}</div>
      <span className="font-bold text-sm text-[#1c1917]">{title}</span>
      {!!count && <span className="text-xs font-bold text-[#C49A3C]">{count}</span>}
    </div>
  );
}

/** A row's undo: the API call, then the row off the list. */
function useRowAction() {
  const { changed } = useJournal();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (key: string, action: () => Promise<void>, done: () => void) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      done();
      changed();
    } catch (err) {
      setError(journalErrorText(err, "That didn't work. Try again."));
    } finally {
      setBusy(null);
    }
  };
  return { busy, error, run };
}

function MutedAuthors() {
  const list = usePaged(["mutes"], (offset) => journalService.mutes(PAGE_SIZE, offset));
  const { busy, error, run } = useRowAction();
  return (
    <div className={cardClass}>
      <CardHead icon={<VolumeX className="w-5 h-5" />} title="Muted authors" count={list.total} />
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      {list.error ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : !list.items ? (
        <Spinner />
      ) : list.items.length === 0 ? (
        <EmptyState>You haven&apos;t muted anyone.</EmptyState>
      ) : (
        <>
          <ul className="divide-y divide-[rgba(196,154,60,0.1)]">
            {list.items.map(({ author, mutedAt }) => {
              const key = authorKey(author) ?? "";
              return (
                <li key={key} className="flex flex-wrap items-center gap-3 py-3">
                  <AuthorAvatar author={author} size={28} />
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#1c1917]">
                      {authorName(author)}
                      <AuthorBadge author={author} />
                    </span>
                    <span className="block text-[11px] font-semibold text-[#a8a29e]">Muted {dateLabel(mutedAt)}</span>
                  </span>
                  {author.npub && <NpubChip npub={author.npub} />}
                  <button
                    type="button"
                    disabled={busy === key}
                    onClick={() => void run(key, () => journalService.unmute(key), () => list.update((items) => items.filter((m) => authorKey(m.author) !== key)))}
                    className={rowButton}
                  >
                    {busy === key && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Unmute
                  </button>
                </li>
              );
            })}
          </ul>
          {list.hasMore && <LoadMore onClick={() => void list.more()} loading={list.loadingMore} />}
        </>
      )}
    </div>
  );
}

// 0 is off; the backend takes 1..10.
const THRESHOLD_CHOICES = [0, 1, 2, 3, 5];

/** Hide what at least N people the reader follows reported (an article, or its author). */
function FollowedReports() {
  const { changed } = useJournal();
  const queryClient = useQueryClient();
  const settings = useJournalQuery(["reader-settings"], () => journalService.readerSettings());
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A backend without the setting answers its route with a bare 404: nothing to show.
  if (settings.isError && isJournalMissing(settings.error)) return null;

  const current = settings.data?.followedReportsThreshold;
  // A value set elsewhere, outside the choices, still shows.
  const choices = current !== undefined && !THRESHOLD_CHOICES.includes(current)
    ? [...THRESHOLD_CHOICES, current].sort((a, b) => a - b)
    : THRESHOLD_CHOICES;
  const choose = async (threshold: number) => {
    if (threshold === current) return;
    setSaving(threshold);
    setError(null);
    try {
      const saved = await journalService.updateReaderSettings({ followedReportsThreshold: threshold });
      queryClient.setQueryData<ReaderSettings>(journalKey("reader-settings"), saved);
      // The lists change with it.
      changed();
    } catch (err) {
      setError(journalErrorText(err, "That didn't work. Try again."));
    } finally {
      setSaving(null);
    }
  };
  return (
    <div className={cardClass}>
      <CardHead icon={<Flag className="w-5 h-5" />} title="Hide what people you follow reported" />
      <p className="text-[13px] text-[#78716c] leading-relaxed">
        {current
          ? `Articles and comments are hidden when at least ${current} ${current === 1 ? "person" : "people"} you follow reported them or their author.`
          : "Off: what people you follow report doesn't hide anything for you."}{" "}
        Only reports by people you follow directly count. You can still open a hidden article and show it anyway.
      </p>
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      {settings.isError ? (
        <ErrorState message={journalErrorText(settings.error, "This setting couldn't be loaded.")} onRetry={() => void settings.refetch()} />
      ) : current === undefined ? (
        <Spinner />
      ) : (
        <div role="radiogroup" aria-label="Hide what people you follow reported" className="flex flex-wrap gap-2">
          {choices.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === current}
              disabled={saving !== null}
              onClick={() => void choose(n)}
              title={n ? `When at least ${n} ${n === 1 ? "person" : "people"} you follow reported it or its author` : "Never"}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold disabled:opacity-60 ${
                n === current
                  ? "border-[#C49A3C] bg-[#C49A3C]/15 text-[#9a7424]"
                  : "border-[rgba(196,154,60,0.3)] text-[#57534e] hover:border-[#C49A3C] hover:text-[#1c1917]"
              }`}
            >
              {saving === n && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {n ? n : "Off"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HiddenArticles() {
  const list = usePaged(["hidden"], (offset) => journalService.hiddenArticles(PAGE_SIZE, offset));
  const { busy, error, run } = useRowAction();
  return (
    <div className={cardClass}>
      <CardHead icon={<EyeOff className="w-5 h-5" />} title="Hidden articles" count={list.total} />
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      {list.error ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : !list.items ? (
        <Spinner />
      ) : list.items.length === 0 ? (
        <EmptyState>You haven&apos;t hidden any article.</EmptyState>
      ) : (
        <>
          <ul className="divide-y divide-[rgba(196,154,60,0.1)]">
            {list.items.map(({ article, hiddenAt }) => {
              // The list holds the reader's own hides; one hidden by followed reports, should it come, says so.
              const byReports = article.hiddenReason === "followed_reports";
              return (
                <li key={article.uuid} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-[#1c1917] truncate">{article.title || "Untitled"}</span>
                    <span className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#a8a29e]">
                      By {authorName(article.author)}
                      {article.origin === "network" && <NetworkBadge />}
                      <span>
                        · {byReports
                          ? `Hidden: ${article.followedReports ?? 0} people you follow reported it or its author`
                          : `Hidden ${dateLabel(hiddenAt)}`}
                      </span>
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={busy === article.uuid}
                    onClick={() => void run(
                      article.uuid,
                      () => journalService.unhideArticle(article.uuid),
                      () => list.update((items) => items.filter((h) => h.article.uuid !== article.uuid)),
                    )}
                    className={rowButton}
                  >
                    {busy === article.uuid && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {byReports ? "Show anyway" : "Unhide"}
                  </button>
                </li>
              );
            })}
          </ul>
          {list.hasMore && <LoadMore onClick={() => void list.more()} loading={list.loadingMore} />}
        </>
      )}
    </div>
  );
}

/**
 * MUTED AND HIDDEN — the Journal's reader moderation, kept on this instance and never published:
 * the authors muted (their articles and comments out of the lists) and the articles hidden, each
 * taken back here. A report hides or mutes its target too, so reported ones are here as well.
 */
export function MutedAndHidden() {
  return (
    <div className="space-y-6">
      <p className="text-[13px] text-[#78716c] leading-relaxed max-w-3xl">
        What you took out of your Journal: muted authors&apos; articles and comments, and the articles you hid (or reported), don&apos;t
        show in your lists. Only you see this, and nothing here goes to the network.
      </p>
      <FollowedReports />
      <MutedAuthors />
      <HiddenArticles />
    </div>
  );
}
