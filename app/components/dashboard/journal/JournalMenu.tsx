// components/dashboard/journal/JournalMenu.tsx
"use client";

import { createContext, useContext } from "react";
import { useJournal } from "../../../context/JournalContext";
import { ActionButton, MoreMenu, type PageAction } from "../PageHeader";
import type { JournalView } from "../JournalSection";

/** The Journal's page open now, and the way to another: JournalSection gives them to its pages. */
export const JournalNavContext = createContext<{ view: JournalView; go: (next: JournalView) => void } | null>(null);

type Entry = { key: string; label: string; view: JournalView; here: (view: JournalView) => boolean };

const ENTRIES: Entry[] = [
  { key: "journal", label: "All articles", view: { page: "journal" }, here: (v) => v.page === "journal" },
  { key: "saved", label: "Saved", view: { page: "saved" }, here: (v) => v.page === "saved" },
  { key: "mine", label: "Your articles", view: { page: "mine" }, here: (v) => v.page === "mine" },
  { key: "reports", label: "Your reports", view: { page: "reports" }, here: (v) => v.page === "reports" },
];
const MODERATION: Entry = {
  key: "moderation", label: "Moderation", view: { page: "moderation" }, here: (v) => v.page === "moderation" || v.page === "case",
};

// Pages shown as buttons; the rest go under the dots.
const VISIBLE = 2;

/**
 * JOURNAL MENU — the Journal's other pages at the top right of each page's header, the way other
 * pages show their actions (see PageHeader): the first two as buttons, the rest (Your reports, the
 * editors' Moderation, a new article) under the dots. The page open now isn't among them. The
 * API's only: a demo account and a backend without the Journal have just the articles.
 */
export function JournalMenu() {
  const nav = useContext(JournalNavContext);
  const { canWrite, editor } = useJournal();
  if (!nav || !canWrite) return null;

  const pages: PageAction[] = (editor ? [...ENTRIES, MODERATION] : ENTRIES)
    .filter((e) => !e.here(nav.view))
    .map((e) => ({ label: e.label, onClick: () => nav.go(e.view) }));
  // Your articles has its own New article button.
  const writing = nav.view.page === "mine" || nav.view.page === "write";
  const more = [...pages.slice(VISIBLE), ...(writing ? [] : [{ label: "New article", onClick: () => nav.go({ page: "write" }) }])];

  return (
    <>
      {pages.slice(0, VISIBLE).map((a) => <ActionButton key={a.label} action={a} />)}
      {more.length > 0 && <MoreMenu actions={more} />}
    </>
  );
}
