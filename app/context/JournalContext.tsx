// app/context/JournalContext.tsx
"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { keepPreviousData, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useUser } from "./UserContext";
import { journalService } from "../services/journalService";
import { apiJournalSource, isJournalMissing, readerLanguage, type JournalSource } from "../lib/journal";
import { staticJournalSource } from "../lib/journalStatic";
import type { ArticleLanguage } from "../models/Journal";

/**
 * JOURNAL CONTEXT — where the Journal reads from, and what the signed-in user can do in it,
 * asked once: the Sidebar and the Journal's pages read it.
 * - `api`: the backend serves the Journal (ianus' /v1/journal): every investor and advisor reads
 *   and writes; a demo account reads only.
 * - `static`: the backend has no Journal yet (it answers FastAPI's own 404): everyone reads the
 *   platform's own articles written in the code (lib/journalStatic), without writing, saving or
 *   reporting. Unlike other backend-less features it isn't a demo account's preview (Matteo,
 *   2026-10-12): the articles are real ones.
 * - `loading` until the first answer.
 * Every Journal read is in the query cache (context/QueryContext) under a ["journal", ...] key
 * (useJournalQuery, usePaged), shared by the pages and modules that ask for it. A write patches
 * what's on screen in place, then `changed()` marks every other Journal read stale: each is read
 * again when it's next shown.
 */
type JournalMode = "loading" | "api" | "static";

interface JournalContextType {
  mode: JournalMode;
  source: JournalSource;
  // Writing, saving and reporting: the API's, never a demo account's (read-only).
  canWrite: boolean;
  // An editor of the Journal: the moderation pages are theirs.
  editor: boolean;
  // The reader's language: the lists put its articles first, and a new article starts in it.
  language: ArticleLanguage;
  changed: () => void;
}

const JournalContext = createContext<JournalContextType | undefined>(undefined);

/** A Journal read's key in the query cache: everything under it goes stale with `changed()`. */
export const journalKey = (...parts: unknown[]) => ["journal", ...parts];

export function JournalProvider({ children }: { children: React.ReactNode }) {
  const { user, isDemo } = useUser();
  const signedIn = !!user;
  const queryClient = useQueryClient();

  const probe = useQuery({
    queryKey: journalKey("mode"),
    queryFn: async (): Promise<{ mode: JournalMode; editor: boolean }> => {
      try {
        await journalService.list({ limit: 1 });
      } catch (err) {
        // A Journal that failed to answer is still there: its pages say what went wrong.
        return { mode: isJournalMissing(err) ? "static" : "api", editor: false };
      }
      // Only an editor sees the moderation pages; anyone else's answer is false.
      if (isDemo) return { mode: "api", editor: false };
      const status = await journalService.editorStatus().catch(() => ({ editor: false }));
      return { mode: "api", editor: status.editor };
    },
    enabled: signedIn,
  });
  const mode = probe.data?.mode ?? "loading";
  const editor = probe.data?.editor ?? false;

  // What's on screen was patched by the write itself: the rest is only marked stale, not read again now.
  const changed = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: journalKey(), refetchType: "none" });
  }, [queryClient]);

  const value = useMemo<JournalContextType>(() => ({
    mode,
    source: mode === "static" ? staticJournalSource : apiJournalSource,
    canWrite: mode === "api" && !isDemo,
    editor: mode === "api" && editor,
    language: readerLanguage(user?.language),
    changed,
  }), [mode, isDemo, editor, user?.language, changed]);
  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export const useJournal = (): JournalContextType => {
  const context = useContext(JournalContext);
  if (context === undefined) throw new Error("useJournal must be used within a JournalProvider");
  return context;
};

/**
 * A Journal read through the query cache, under `journalKey(...key)`: asked for once however many
 * modules want it, and again once stale (30s, or a write's `changed()`). Off until the Journal's
 * mode is known. With `keepPrevious`, a new key keeps the last answer up until its own.
 */
export function useJournalQuery<T>(
  key: unknown[], read: (source: JournalSource) => Promise<T>, { enabled = true, keepPrevious = false } = {},
): UseQueryResult<T> {
  const { source, mode } = useJournal();
  return useQuery({
    queryKey: journalKey(...key),
    queryFn: () => read(source),
    enabled: mode !== "loading" && enabled,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  });
}

/** useJournalQuery's answer alone: undefined while loading, null when it couldn't be read. */
export function useJournalRead<T>(key: unknown[], read: (source: JournalSource) => Promise<T>, enabled = true): T | null | undefined {
  const query = useJournalQuery(key, read, { enabled });
  return query.isError ? null : query.data;
}
