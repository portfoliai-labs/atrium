// app/context/JournalContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
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
}

const JournalContext = createContext<JournalContextType | undefined>(undefined);

export function JournalProvider({ children }: { children: React.ReactNode }) {
  const { user, isDemo } = useUser();
  const signedIn = !!user;
  const [mode, setMode] = useState<JournalMode>("loading");
  const [editor, setEditor] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    (async () => {
      try {
        await journalService.list({ limit: 1 });
        if (cancelled) return;
        setMode("api");
        // Only an editor sees the moderation pages; anyone else's answer is false.
        if (!isDemo) {
          const status = await journalService.editorStatus().catch(() => ({ editor: false }));
          if (!cancelled) setEditor(status.editor);
        }
      } catch (err) {
        if (cancelled) return;
        // A Journal that failed to answer is still there: its pages say what went wrong.
        setMode(isJournalMissing(err) ? "static" : "api");
      }
    })();
    return () => { cancelled = true; };
  }, [signedIn, isDemo]);

  const value = useMemo<JournalContextType>(() => ({
    mode,
    source: mode === "static" ? staticJournalSource : apiJournalSource,
    canWrite: mode === "api" && !isDemo,
    editor: mode === "api" && editor,
    language: readerLanguage(user?.language),
  }), [mode, isDemo, editor, user?.language]);
  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export const useJournal = (): JournalContextType => {
  const context = useContext(JournalContext);
  if (context === undefined) throw new Error("useJournal must be used within a JournalProvider");
  return context;
};
