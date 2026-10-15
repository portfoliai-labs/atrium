// components/dashboard/JournalSection.tsx
"use client";

import { useEffect, useState } from "react";
import { useJournal } from "../../context/JournalContext";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";
import { JOURNAL_SECTION } from "../../lib/dashboardNav";
import type { ArticleCategory } from "../../models/Journal";
import { Spinner } from "./journal/JournalKit";
import { ArticleList } from "./journal/ArticleList";
import { ArticleReader } from "./journal/ArticleReader";
import { ArticleEditor } from "./journal/ArticleEditor";
import { MyArticles } from "./journal/MyArticles";
import { SavedArticles } from "./journal/SavedArticles";
import { MyReports } from "./journal/MyReports";
import { ModerationCases, ModerationCasePage } from "./journal/Moderation";

const SECTION = JOURNAL_SECTION;

/** What the articles' list is narrowed to; kept in its history entry, so going back finds it. */
export interface JournalFilters {
  category?: ArticleCategory;
  q?: string;
  author?: { uuid: string; name: string };
  // By census' instrument; one saved before listings by its ticker and ISIN.
  instrument?: { ticker: string; isin: string | null; instrumentId?: string | null };
}

/**
 * The Journal's pages, as its history entries hold them. `journal` with a `slug` is an article's
 * entry from before the Journal had pages of its own.
 */
export type JournalView =
  | { page: "journal"; filters?: JournalFilters; slug?: string }
  | { page: "article"; slug: string }
  | { page: "saved" }
  | { page: "reports" }
  | { page: "mine" }
  // The editor: one of the caller's articles, or a new one.
  | { page: "write"; uuid?: string }
  | { page: "moderation" }
  | { page: "case"; uuid: string };

const LIST: JournalView = { page: "journal" };

function viewFromHistory(): JournalView {
  const entry = readDashboardEntry();
  const view = entry?.section === SECTION ? (entry.view as JournalView | undefined) : undefined;
  if (!view?.page) return LIST;
  if (view.page === "journal" && view.slug) return { page: "article", slug: view.slug };
  return view;
}

/** The Sidebar row a page is under (see Sidebar). */
export function journalRowOf(view: JournalView | undefined): "journal" | "saved" | "mine" | "moderation" {
  switch (view?.page) {
    case "saved":
    case "reports":
      return "saved";
    case "mine":
    case "write":
      return "mine";
    case "moderation":
    case "case":
      return "moderation";
    default:
      return "journal";
  }
}

/**
 * JOURNAL — articles on investing by PortfoliAI's editors, advisors and users (acta, through
 * ianus' /v1/journal): the latest, searchable and narrowed by category, author or instrument;
 * each article; the reader's saved articles and reports; the author's own articles and their
 * editor; the editors' moderation. On a backend without the Journal everyone reads the
 * platform's own articles written in the code (see JournalContext). Each page is a history
 * entry, so the browser's back button walks through them (see lib/dashboardHistory).
 */
export function JournalSection() {
  const { mode, canWrite, editor } = useJournal();
  const [view, setView] = useState<JournalView>(viewFromHistory);

  useEffect(() => {
    const onPopState = () => {
      if (readDashboardEntry()?.section === SECTION) setView(viewFromHistory());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /** Moves to `next`: a new history entry, or (`replace`) in place of this one. */
  const go = (next: JournalView, replace = false) => {
    pushDashboardEntry({ section: SECTION, view: next }, replace);
    setView(next);
    if (!replace) window.scrollTo({ top: 0 });
  };
  const openArticle = (slug: string) => go({ page: "article", slug });
  const openEditor = (uuid?: string) => go(uuid ? { page: "write", uuid } : { page: "write" });

  if (mode === "loading") return <Spinner />;

  // The reader's and the author's pages are the API's only, and moderation the editors'.
  const allowed =
    view.page === "journal" || view.page === "article"
    || ((view.page === "moderation" || view.page === "case") ? editor : canWrite);
  const page = allowed ? view : LIST;

  switch (page.page) {
    case "article":
      return (
        <ArticleReader
          key={page.slug}
          slug={page.slug}
          onBack={() => go(LIST)}
          onEdit={(uuid) => openEditor(uuid)}
          onFilter={(filters) => go({ page: "journal", filters })}
        />
      );
    case "saved":
      return <SavedArticles onOpen={openArticle} onReports={() => go({ page: "reports" })} />;
    case "reports":
      return <MyReports onBack={() => go({ page: "saved" })} />;
    case "mine":
      return <MyArticles onOpen={openEditor} onNew={() => openEditor()} />;
    case "write":
      return (
        <ArticleEditor
          // The same editor on: a new article's first save gives it a uuid, in the same entry.
          key="write"
          uuid={page.uuid}
          onCreated={(uuid) => go({ page: "write", uuid }, true)}
          onBack={() => go({ page: "mine" })}
          onRead={openArticle}
        />
      );
    case "moderation":
      return <ModerationCases onOpen={(uuid) => go({ page: "case", uuid })} />;
    case "case":
      return <ModerationCasePage key={page.uuid} uuid={page.uuid} onBack={() => go({ page: "moderation" })} />;
    default:
      return (
        <ArticleList
          filters={page.page === "journal" ? page.filters ?? {} : {}}
          onFilters={(filters) => go({ page: "journal", filters }, true)}
          onOpen={openArticle}
        />
      );
  }
}
