// components/dashboard/NewsSection.tsx
"use client";

import { useState } from "react";
import {
  Loader2, AlertCircle, ExternalLink,
  Newspaper, TrendingUp, Globe2, LineChart, Landmark, Coins,
} from "lucide-react";
import { useNews, useDailyArticle } from "../../hooks/useNews";
import type { NewsItem, DailyArticle } from "../../models/News";

/**
 * NEWS SECTION — today's headlines as the sidebar's News page (NewsPageSection), and the
 * article of the day (DailyArticleModule), which lives on the investor Dashboard instead. Each
 * card shows the backend's `imageUrl` when the story has one; otherwise (or if that URL fails
 * to load) it falls back to a stylized placeholder derived from the story's own topic/title
 * (see themeFor below).
 */

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// PLACEHOLDER THEMES — a fixed palette of brand-consistent gradients + icon, picked
// deterministically per story (same topic/title always renders the same card art) rather than
// randomly, so a re-render or refetch doesn't make cards flicker between looks.
const PLACEHOLDER_THEMES: { gradient: string; icon: typeof Newspaper }[] = [
  { gradient: "linear-gradient(135deg, #C49A3C 0%, #8A6A28 100%)", icon: TrendingUp },
  { gradient: "linear-gradient(135deg, #1e293b 0%, #475569 100%)", icon: Newspaper },
  { gradient: "linear-gradient(135deg, #0f766e 0%, #134e4a 100%)", icon: Globe2 },
  { gradient: "linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)", icon: LineChart },
  { gradient: "linear-gradient(135deg, #b45309 0%, #78350f 100%)", icon: Landmark },
  { gradient: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)", icon: Coins },
];

// The News page shows every story at once as a grid, so this is a roomier cap than a
// one-at-a-time carousel would need.
const INSIGHTS_NEWS_LIMIT = 10;

function themeFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_THEMES[hash % PLACEHOLDER_THEMES.length];
}

/**
 * MODULE / MODULE HEAD — same card shell + header used across DashboardOverview.tsx and
 * PerformanceSection.tsx, kept as its own local copy here (those two files each already carry
 * their own copy rather than sharing one) so this file has no dependency on either.
 */
function Module({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
      {children}
    </section>
  );
}

function ModuleHead({ eyebrow, title, desc, right }: { eyebrow: string; title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="p-6 md:p-7 pb-5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-6">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">{eyebrow}</p>
        <h2 className="text-lg md:text-xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {title}
        </h2>
        {desc && <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

/**
 * NEWS CARD — grid variant used by NewsModule. Clickable (opens the article in a new tab)
 * only when the backend supplied a url; otherwise renders as a plain, non-interactive card
 * rather than a dead link.
 */
function NewsCard({ item }: { item: NewsItem }) {
  const theme = themeFor(item.topic || item.title);
  const Icon = theme.icon;
  const published = item.publishedAt ? dateLabel(item.publishedAt) : null;
  const clickable = !!item.url;
  // Falls back to the placeholder on a missing URL as well as a broken/expired one — `onError`
  // alone only catches the latter.
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!item.imageUrl && !imageFailed;

  const inner = (
    <>
      <div
        className="h-28 flex items-center justify-center relative shrink-0 overflow-hidden"
        style={showImage ? undefined : { backgroundImage: theme.gradient }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl!}
            alt=""
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <Icon className="h-9 w-9 text-white/85" />
        )}
        <span className="absolute top-2.5 left-2.5 text-[9px] font-black uppercase tracking-wider text-white px-2 py-1 rounded-full bg-black/25 backdrop-blur-sm">
          {item.topic}
        </span>
        {clickable && <ExternalLink className="absolute top-2.5 right-2.5 h-3.5 w-3.5 text-white/70" />}
      </div>
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{item.title}</h3>
        {item.description && <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{item.description}</p>}
        <div className="flex items-center justify-between gap-2 pt-1.5 mt-auto">
          <span className="text-[11px] font-semibold text-slate-400 truncate">{item.source ?? "—"}</span>
          {published && <span className="text-[11px] text-slate-400 shrink-0">{published}</span>}
        </div>
      </div>
    </>
  );

  const className = "flex flex-col h-full rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md hover:border-slate-300 transition-all";

  return clickable ? (
    <a href={item.url!} target="_blank" rel="noreferrer" className={className}>{inner}</a>
  ) : (
    <div className={className}>{inner}</div>
  );
}

function NewsGridBody({ items }: { items: NewsItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400 p-6 md:p-7">No news for this period.</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6 md:p-7 pt-5">
      {items.map((item, i) => <NewsCard key={item.url ?? `${item.title}-${i}`} item={item} />)}
    </div>
  );
}

/**
 * NEWS PAGE SECTION — the sidebar's own "News" tab: today's headlines as a full page rather
 * than a small supplementary module. Used to live embedded in Today's overview and in each
 * month's detail page as NewsModule; both call sites are gone now (a news-shaped page of its
 * own reads better than the same grid repeated across Insights), so this replaces it outright
 * rather than sitting alongside an unused twin. Unlike the module it replaces, this needs a
 * real empty state — a lone supplementary module on a busier page can just disappear on a
 * newsless day, but a page someone navigated to on purpose can't render nothing with no
 * explanation.
 */
export function NewsPageSection() {
  const { items, loading, error, notFound } = useNews(undefined, undefined, INSIGHTS_NEWS_LIMIT);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      <Module>
        <ModuleHead eyebrow="Market News" title="Today's Headlines" desc="Market news published today." />
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="animate-spin h-6 w-6 text-[#C49A3C]" />
          </div>
        ) : error ? (
          <div className="p-6 md:p-7 flex items-center gap-3 text-rose-600">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        ) : notFound || items.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-center px-6">
            <div className="p-4 bg-slate-50 rounded-2xl mb-3">
              <Newspaper className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-slate-600 font-semibold">No news today</p>
            <p className="text-slate-400 text-sm mt-1">Check back later for new market headlines.</p>
          </div>
        ) : (
          <NewsGridBody items={items} />
        )}
      </Module>
    </div>
  );
}

/**
 * DAILY ARTICLE CARD — a large featured layout (image-or-placeholder art beside the full
 * title/description/meta), the same treatment NewsCard's compact grid card can't fit.
 * DailyArticle has no `topic`, so the placeholder is seeded by the article's title instead.
 */
function DailyArticleCard({ article }: { article: DailyArticle }) {
  const theme = themeFor(article.title);
  const Icon = theme.icon;
  const published = article.publishedAt ? dateLabel(article.publishedAt) : null;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!article.imageUrl && !imageFailed;

  return (
    <a href={article.url} target="_blank" rel="noreferrer" className="group block hover:bg-slate-50/60 transition-colors">
      <div className="flex flex-col sm:flex-row">
        <div
          className="sm:w-72 h-48 sm:h-auto shrink-0 flex items-center justify-center relative overflow-hidden"
          style={showImage ? undefined : { backgroundImage: theme.gradient }}
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.imageUrl!}
              alt=""
              onError={() => setImageFailed(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <Icon className="h-14 w-14 text-white/85" />
          )}
        </div>
        <div className="flex-1 p-7 md:p-8 flex flex-col gap-3 min-w-0 justify-center">
          <h3 className="text-xl md:text-2xl font-black text-slate-900 leading-snug" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {article.title}
          </h3>
          {article.summary && <p className="text-sm md:text-base text-slate-500 leading-relaxed line-clamp-3">{article.summary}</p>}
          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold mt-1">
            <span>{article.source}</span>
            {published && <span>·</span>}
            {published && <span>{published}</span>}
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#C49A3C] mt-1 group-hover:underline w-fit">
            Read article <ExternalLink className="h-4 w-4" />
          </span>
        </div>
      </div>
    </a>
  );
}

/**
 * DAILY ARTICLE MODULE — the day's featured read, same article for every user (not a
 * per-user or per-portfolio pick), at the bottom of the investor Dashboard. Renders nothing at
 * all — not an empty card — when loading fails or there's nothing to show, so it never
 * clutters the Dashboard with an empty slot on a day with no pick.
 */
export function DailyArticleModule() {
  const { article, loading, error, notFound } = useDailyArticle();

  if (loading) {
    return (
      <Module>
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="animate-spin h-6 w-6 text-[#C49A3C]" />
        </div>
      </Module>
    );
  }

  if (notFound || error || !article) return null;

  return (
    <Module>
      <ModuleHead eyebrow="Daily Read" title="Article of the Day" desc="One story worth your time today." />
      <DailyArticleCard article={article} />
    </Module>
  );
}
