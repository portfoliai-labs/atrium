// components/dashboard/NetworkStrategy.tsx
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Network } from "lucide-react";
import { useUser } from "../../context/UserContext";
import { useJournal } from "../../context/JournalContext";
import { investmentsKey } from "../../context/PortfolioContext";
import { publicationService } from "../../services/publicationService";
import { journalService } from "../../services/journalService";
import { journalErrorText, shortNpub } from "../../lib/journal";
import {
  NETWORK_STATE_LABELS, RECOMPUTE_LABELS, isHiddenByYou, isNetworkStrategy, isNewStrategyAuthor, type PublishedStrategy,
} from "../../models/PublishedStrategy";
import { ReportDialog, UndoBar, reportedMessage, type MenuItem, type Undoable } from "./journal/Moderation";
import { NewAuthorBadge } from "./journal/JournalKit";
import type { PageAction } from "./PageHeader";

/**
 * The strategies catalog's network parts (tabella's network_strategy_widgets): the "From the
 * network" badge, the author as the Journal names them, where a network strategy's figures stand,
 * one's own publication on the network, and the reader's moderation (hide, mute its author, report).
 */

/** The author as a byline names them: their name, else their npub's short form. */
export const authorLabel = (s: Pick<PublishedStrategy, "authorName" | "authorNpub">) =>
  s.authorName ?? (s.authorNpub ? shortNpub(s.authorNpub) : "an author");

/** "FROM THE NETWORK", on a strategy read from the network. */
export function NetworkBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F1EEE6] border border-[#E0DACC] text-[10px] font-black uppercase tracking-wider text-[#78716c]">
      <Network className="h-3 w-3" /> From the network
    </span>
  );
}

/** Where one of the reader's own publications stands on the network; nothing on anyone else's. */
export function NetworkStateBadge({ strategy: s }: { strategy: Pick<PublishedStrategy, "networkState"> }) {
  if (!s.networkState) return null;
  const tone = s.networkState === "sent"
    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
    : s.networkState === "failed" ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-slate-50 border-slate-200 text-slate-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wide ${tone}`}>
      {NETWORK_STATE_LABELS[s.networkState]}
    </span>
  );
}

/**
 * "New author" (tabella's, beside "From the network"): someone else's network strategy whose author
 * is outside the reader's web of trust, as ianus says (`authorTrusted`); nothing otherwise.
 */
export function StrategyNewAuthorBadge({ strategy: s }: { strategy: Pick<PublishedStrategy, "source" | "networkState" | "authorTrusted"> }) {
  return isNewStrategyAuthor(s) ? <NewAuthorBadge /> : null;
}

/** A network strategy whose figures aren't in: where they stand (null when computed, or not a network one). */
export const recomputeNote = (s: Pick<PublishedStrategy, "source" | "recompute">) =>
  isNetworkStrategy(s) && s.recompute && s.recompute !== "computed" ? RECOMPUTE_LABELS[s.recompute] : null;

/** Whether its figures are on their way here (its page reads it again meanwhile). */
export const isRecomputing = (s: Pick<PublishedStrategy, "source" | "recompute"> | undefined) =>
  !!s && isNetworkStrategy(s) && (s.recompute === "running" || s.recompute === "on_open");

/** A thesis in a line: its Markdown's text without the marks. */
export const plainThesis = (markdown: string) =>
  markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "")
    .replace(/[*_~`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Whether it's the reader's own: theirs on this instance, or one with their network state. */
export function useIsOwnStrategy() {
  const { user } = useUser();
  return (s: Pick<PublishedStrategy, "authorUuid" | "networkState">) =>
    !!s.networkState || (!!user && !!s.authorUuid && s.authorUuid === user.uuid);
}

/**
 * The reader's moderation on the catalog's strategies, theirs only: hide one (or show it again),
 * mute its author (the Journal's mute, which hides their articles too), report it (NIP-56, public
 * on the network). Never on their own, nor on one whose author has no key. Whether it offers
 * "Show strategy" or "Hide strategy" is ianus' `hiddenByYou`. What they took away leaves the list
 * at once (`visible`), the last action with its Undo (`bar`), the report's `dialog`; `menuFor` a
 * card's "…" items, `actionsFor` a strategy page's. The catalog and the strategy's page are read
 * again after each.
 */
export function useStrategyModeration() {
  const { canWrite, changed } = useJournal();
  const isOwn = useIsOwnStrategy();
  const queryClient = useQueryClient();
  const [goneIds, setGoneIds] = useState<ReadonlySet<string>>(new Set());
  const [goneAuthors, setGoneAuthors] = useState<ReadonlySet<string>>(new Set());
  const [last, setLast] = useState<Undoable | null>(null);
  const [reporting, setReporting] = useState<PublishedStrategy | null>(null);

  const add = (set: ReadonlySet<string>, key: string) => new Set(set).add(key);
  const drop = (set: ReadonlySet<string>, key: string) => {
    const next = new Set(set);
    next.delete(key);
    return next;
  };
  // The catalog, and the strategy's page (its `hiddenByYou`).
  const reread = (publicationId: string) => {
    void queryClient.invalidateQueries({ queryKey: investmentsKey("publications", "catalog") });
    void queryClient.invalidateQueries({ queryKey: investmentsKey("publications", publicationId) });
  };

  const hide = async (s: PublishedStrategy) => {
    setGoneIds((g) => add(g, s.publicationId));
    try {
      await publicationService.hide(s.publicationId);
      reread(s.publicationId);
      setLast({
        message: "Strategy hidden: it's out of your catalog.",
        undo: async () => {
          await publicationService.unhide(s.publicationId);
          setGoneIds((g) => drop(g, s.publicationId));
          reread(s.publicationId);
        },
      });
    } catch (err) {
      setGoneIds((g) => drop(g, s.publicationId));
      setLast({ message: journalErrorText(err, "The strategy couldn't be hidden. Try again.") });
    }
  };

  const unhide = async (s: PublishedStrategy) => {
    try {
      await publicationService.unhide(s.publicationId);
      setGoneIds((g) => drop(g, s.publicationId));
      reread(s.publicationId);
      setLast({ message: "Strategy shown again in your catalog." });
    } catch (err) {
      setLast({ message: journalErrorText(err, "The strategy couldn't be shown again. Try again.") });
    }
  };

  const mute = async (s: PublishedStrategy) => {
    const key = s.authorPubkey;
    if (!key) return;
    const name = authorLabel(s);
    setGoneAuthors((g) => add(g, key));
    try {
      await journalService.mute(key);
      changed();
      reread(s.publicationId);
      setLast({
        message: `${name} muted: their strategies, articles and comments are hidden for you.`,
        undo: async () => {
          await journalService.unmute(key);
          setGoneAuthors((g) => drop(g, key));
          changed();
          reread(s.publicationId);
        },
      });
    } catch (err) {
      setGoneAuthors((g) => drop(g, key));
      setLast({ message: journalErrorText(err, "The author couldn't be muted. Try again.") });
    }
  };

  /** Whether the reader may moderate it: the Journal's there, it isn't theirs, its author has a key. */
  const moderates = (s: PublishedStrategy) => canWrite && !isOwn(s) && !!s.authorPubkey;
  const gone = (s: PublishedStrategy) => goneIds.has(s.publicationId);
  const muted = (s: PublishedStrategy) => !!s.authorPubkey && goneAuthors.has(s.authorPubkey);
  const visible = (s: PublishedStrategy) => !gone(s) && !muted(s);

  const items = (s: PublishedStrategy): MenuItem[] => {
    if (!moderates(s)) return [];
    return [
      isHiddenByYou(s)
        ? { label: "Show strategy", onClick: () => void unhide(s) }
        : { label: "Hide strategy", onClick: () => void hide(s) },
      ...(muted(s) ? [] : [{ label: `Mute ${authorLabel(s)}`, onClick: () => void mute(s) }]),
      { label: "Report strategy…", onClick: () => setReporting(s), danger: true },
    ];
  };
  const actionsFor = (s: PublishedStrategy): PageAction[] => items(s).map((i) => ({ label: i.label, onClick: i.onClick, danger: i.danger }));

  const bar = <UndoBar action={last} onClose={() => setLast(null)} />;
  const dialog = reporting && (
    <ReportDialog
      what="this strategy"
      send={(reason, note) => publicationService.report(reporting.publicationId, { reason, note })}
      onClose={() => setReporting(null)}
      onDone={(report) => {
        setGoneIds((g) => add(g, reporting.publicationId));
        setReporting(null);
        reread(reporting.publicationId);
        setLast({ message: reportedMessage(report, "the strategy is hidden for you") });
      }}
    />
  );
  return { visible, menuFor: items, actionsFor, bar, dialog };
}
