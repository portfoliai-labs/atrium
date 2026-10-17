// components/dashboard/ExploreSection.tsx
"use client";

import { useJournal } from "../../context/JournalContext";
import { useSectionView } from "../../lib/dashboardHistory";
import { EXPLORE_SECTION, JOURNAL_SECTION, NEWS_SECTION } from "../../lib/dashboardNav";
import type { ArticleCategory } from "../../models/Journal";
import { Spinner } from "./journal/JournalKit";
import { ArticleList } from "./journal/ArticleList";
import { ArticleReader } from "./journal/ArticleReader";
import { ArticleEditor } from "./journal/ArticleEditor";
import { MyArticles } from "./journal/MyArticles";
import { SavedArticles } from "./journal/SavedArticles";
import { MyReports } from "./journal/MyReports";
import { ModerationCases, ModerationCasePage } from "./journal/Moderation";
import { NewsPageSection } from "./NewsSection";

const SECTION = EXPLORE_SECTION;

/** What the articles' list is narrowed to; kept in its history entry, so going back finds it. */
export interface JournalFilters {
  category?: ArticleCategory;
  q?: string;
  author?: { uuid: string; name: string };
  // By census' instrument; one saved before listings by its ticker and ISIN.
  instrument?: { ticker: string; isin: string | null; instrumentId?: string | null };
}

/**
 * Explore's pages, as its history entries hold them: the News, and the Journal's. `journal` with a
 * `slug` is an article's entry from before the Journal had pages of its own.
 */
export type ExploreView =
  | { page: "news" }
  | { page: "journal"; filters?: JournalFilters; slug?: string }
  | { page: "article"; slug: string }
  | { page: "saved" }
  | { page: "reports" }
  | { page: "mine" }
  // The editor: one of the caller's articles, or a new one.
  | { page: "write"; uuid?: string }
  | { page: "moderation" }
  | { page: "case"; uuid: string };

const LIST: ExploreView = { page: "journal" };
const NEWS: ExploreView = { page: "news" };

// The pages a history entry can hold.
const PAGES = ["news", "journal", "article", "saved", "reports", "mine", "write", "moderation", "case"];

/**
 * Explore's page for a history entry's view: one of its own, the articles when it's none (or a
 * page of the strategies catalog that was Explore's, which lands on Strategies first, see the
 * dashboard page).
 */
export function exploreViewOf(raw: unknown): ExploreView {
  const view = (typeof raw === "object" && raw !== null ? raw : {}) as ExploreView;
  if (!PAGES.includes(view.page)) return LIST;
  if (view.page === "journal" && view.slug) return { page: "article", slug: view.slug };
  return view;
}

/**
 * Where a page of a section that's gone lands in Explore: the Journal's own, the News' its page
 * (see the dashboard page).
 */
export const exploreViewFrom = (section: string, view: unknown): ExploreView =>
  section === NEWS_SECTION ? NEWS : section === JOURNAL_SECTION ? exploreViewOf(view) : LIST;

/** The Sidebar row a page is under (see Sidebar). */
export function exploreRowOf(view: ExploreView | undefined): "news" | "journal" | "saved" | "mine" | "moderation" {
  switch (view?.page) {
    case "news":
      return "news";
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
 * EXPLORE — what there is to read: the News, today's market headlines (NewsPageSection), and the
 * Journal, with a switch between the two on top of their pages.
 *
 * The Journal: articles on investing by PortfoliAI's editors, advisors and users (acta, through
 * ianus' /v1/journal): the latest, searchable and narrowed by category, author or instrument;
 * each article; the reader's saved articles and reports; the author's own articles and their
 * editor; the editors' moderation. On a backend without the Journal everyone reads the
 * platform's own articles written in the code (see JournalContext). Each page is a history
 * entry, so the browser's back button walks through them (see lib/dashboardHistory).
 */
export function ExploreSection() {
  const { mode, canWrite, editor } = useJournal();
  const [view, go] = useSectionView(SECTION, exploreViewOf);
  const openArticle = (slug: string) => go({ page: "article", slug });
  const openEditor = (uuid?: string) => go(uuid ? { page: "write", uuid } : { page: "write" });

  if (view.page === "news") {
    return (
      <>
        <ExploreTabs page="news" onGo={go} />
        <NewsPageSection />
      </>
    );
  }
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
        <>
          <ExploreTabs page="journal" onGo={go} />
          <ArticleList
            filters={page.page === "journal" ? page.filters ?? {} : {}}
            onFilters={(filters) => go({ page: "journal", filters }, true)}
            onOpen={openArticle}
          />
        </>
      );
  }
}

/** The switch between Explore's two lists, on top of each: the articles and the News. */
function ExploreTabs({ page, onGo }: { page: "journal" | "news"; onGo: (view: ExploreView) => void }) {
  const tabs = [
    { view: LIST, label: "Articles" },
    { view: NEWS, label: "News" },
  ];
  return (
    <nav aria-label="Explore" className="flex gap-2 mb-6">
      {tabs.map((t) => (
        <button
          key={t.view.page}
          type="button"
          onClick={() => t.view.page !== page && onGo(t.view)}
          aria-current={t.view.page === page ? "page" : undefined}
          className={`min-h-9 px-4 rounded-full text-[13px] font-bold transition-colors ${
            t.view.page === page ? "bg-[#1c1917] text-white" : "bg-white border border-[#E0DACC] text-[#78716c] hover:text-[#1c1917]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
