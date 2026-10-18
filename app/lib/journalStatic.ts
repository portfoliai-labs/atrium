// lib/journalStatic.ts
//
// THE JOURNAL WITHOUT A BACKEND — PortfoliAI's own articles, written here: what the Journal reads
// on a backend that doesn't serve it yet (staging, for now; see JournalContext). The same four
// were loaded into acta as the editors' articles. Written in a short form (a paragraph, a
// subheading, a bulleted list) and turned into the API's shapes, newest first.

import type { Article, ArticleCategory, ArticleSummary, Block, Page } from "../models/Journal";
import { ApiError } from "../services/apiClient";
import { blocksText, summaryOf, type JournalSource } from "./journal";

type WrittenBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "ul"; items: string[] };

interface WrittenArticle {
  slug: string;
  title: string;
  dek: string;
  category: ArticleCategory;
  publishedAt: string;
  readMinutes: number;
  body: WrittenBlock[];
}

const WRITTEN: WrittenArticle[] = [
  {
    slug: "time-vs-money-weighted-returns",
    title: "Time-weighted or money-weighted: which return is yours?",
    dek: "Two portfolios can hold the same assets and still earn different returns. The difference is when the money went in.",
    category: "performance",
    publishedAt: "2026-09-24",
    readMinutes: 5,
    body: [
      { type: "p", text: "Ask \"how did my portfolio do this year?\" and there are two honest answers. One measures the investments, the other measures the investor. They agree only when no money moves in or out, which, for anyone saving monthly, is never." },
      { type: "h", text: "Time-weighted return: how the holdings did" },
      { type: "p", text: "The time-weighted return (TWR) cuts the period at every deposit and withdrawal, measures the return of each slice, and chains the slices together. Cash flows drop out entirely: it's the return one euro would have earned had it been invested from the first day to the last." },
      { type: "p", text: "That makes it the fair way to compare a portfolio with an index or with another portfolio. It's what fund managers report, because they don't decide when their clients buy in." },
      { type: "h", text: "Money-weighted return: how your money did" },
      { type: "p", text: "The money-weighted return (MWR, or internal rate of return) weights each period by how much was invested in it. A big deposit just before a fall hurts it more than the same fall on a small balance; a deposit just before a rally helps it." },
      { type: "p", text: "It answers the personal question: given what I put in and when, what rate did my money actually grow at? Timing, good or bad, shows up here and only here." },
      { type: "h", text: "Reading the gap" },
      { type: "ul", items: [
        "MWR above TWR: your deposits landed before the good stretches. Luck or skill, the timing added to your result.",
        "MWR below TWR: more money was invested during the weak periods than the strong ones, often after buying in following a run-up.",
        "Roughly equal: steady contributions, or too few cash flows to matter.",
      ] },
      { type: "p", text: "Neither number is the \"real\" one. Use the time-weighted return to judge what you hold, and the money-weighted return to judge what you did with it." },
    ],
  },
  {
    slug: "diversification-is-about-correlation",
    title: "Diversification is about correlation, not count",
    dek: "Twenty stocks that move together are one bet. Two assets that don't can be a portfolio.",
    category: "risk",
    publishedAt: "2026-09-17",
    readMinutes: 4,
    body: [
      { type: "p", text: "It's tempting to measure diversification by the number of holdings. But a portfolio's volatility depends less on how many things it owns than on how they move relative to each other." },
      { type: "h", text: "Why correlation does the work" },
      { type: "p", text: "Correlation runs from +1 (two assets always move in the same direction) to −1 (always opposite). When two holdings are perfectly correlated, combining them averages their risk and nothing more. Below +1, some of each one's swings cancel out, and the mix is less volatile than the weighted average of its parts. That reduction is the only free lunch finance is said to offer." },
      { type: "p", text: "Ten technology stocks, or three ETFs tracking overlapping indices, are highly correlated with each other: they look diversified on a list and behave like one position on a chart." },
      { type: "h", text: "What to check in your own portfolio" },
      { type: "ul", items: [
        "Overlap: do your funds hold the same large companies? A global ETF and a US ETF share most of their top holdings.",
        "Asset classes: equities, bonds, commodities and cash respond to different forces, and tend to diversify each other better than one class does alone.",
        "Currency and region: exposure to one economy can hide behind many different tickers.",
      ] },
      { type: "h", text: "A caveat on crises" },
      { type: "p", text: "Correlations aren't fixed. In a sharp sell-off many risky assets fall together, just when diversification is wanted most. Correlations measured over calm years can overstate how much protection a mix will give in a bad one, which is why it's worth looking at how a portfolio behaved through its worst drawdowns, not only on average." },
    ],
  },
  {
    slug: "rebalancing-without-the-guesswork",
    title: "Rebalancing without the guesswork",
    dek: "Markets quietly change your allocation. A rule for putting it back beats deciding each time.",
    category: "strategy",
    publishedAt: "2026-09-10",
    readMinutes: 5,
    body: [
      { type: "p", text: "Start with 60% equities and 40% bonds, let a strong year for stocks pass, and you may find yourself at 68/32 without having made a single trade. The portfolio now carries more risk than you chose. Rebalancing is the habit of bringing it back." },
      { type: "h", text: "Three common rules" },
      { type: "ul", items: [
        "Calendar: rebalance every quarter, half-year or year, whatever the drift. Simple, predictable, and easy to stick to.",
        "Threshold: rebalance only when an asset strays more than a set margin (say 5 percentage points) from its target. Fewer trades, and they happen when they matter.",
        "Cash flows: steer new deposits (or withdrawals) toward whatever is underweight. Often enough on its own for a saver, and it avoids selling at all.",
      ] },
      { type: "h", text: "What it costs, and what it buys" },
      { type: "p", text: "Every rebalance has costs: commissions, spreads and, when selling at a gain, taxes. Rebalancing too often can cost more than the drift it corrects. Too rarely, and the risk you carry is no longer the one you picked." },
      { type: "p", text: "Rebalancing isn't mainly a way to earn more. By selling what has risen and buying what has fallen, it sometimes adds a little return, and sometimes, in a long trend, costs a little. Its real job is keeping risk where you set it." },
      { type: "h", text: "Test before you commit" },
      { type: "p", text: "The right frequency depends on your assets, your costs and your contributions. Backtesting the same target weights with different rules over past prices shows the trade-off concretely: how much each rule traded, what it cost, and how far the allocation wandered in between. Past prices won't repeat, but they show how a rule behaves." },
    ],
  },
  {
    slug: "costs-compound-too",
    title: "Costs compound too",
    dek: "A fee of 1% a year sounds small. Over thirty years it can take a quarter of what you would have had.",
    category: "costs",
    publishedAt: "2026-09-03",
    readMinutes: 3,
    body: [
      { type: "p", text: "Compounding is usually told as the good news of investing: returns earn returns. The same arithmetic works on costs. A fee isn't charged once; it's charged every year on a balance that includes all previous years' growth." },
      { type: "h", text: "The arithmetic" },
      { type: "p", text: "Take €10,000 growing at 6% a year for 30 years: about €57,000. At 5%, the same return after a 1% annual fee, it ends near €43,000. The one-point difference costs roughly a quarter of the final value, far more than 30 × 1% of the starting sum." },
      { type: "h", text: "Where costs hide" },
      { type: "ul", items: [
        "Ongoing charges (TER) of funds and ETFs, taken from the fund's value rather than billed to you, so they never show as a transaction.",
        "Transaction costs: commissions, currency conversion and the bid-ask spread on every trade.",
        "Advisory or platform fees charged as a percentage of assets.",
        "Taxes realised by trading more often than needed.",
      ] },
      { type: "p", text: "Costs are one of the few parts of investing entirely within your control. Future returns are uncertain; a fee is certain. Knowing what you pay, in total and each year, is the first step to deciding whether it's worth it." },
    ],
  },
];

const toBlock = (b: WrittenBlock): Block =>
  b.type === "p" ? { type: "paragraph", spans: [{ text: b.text }] }
  : b.type === "h" ? { type: "heading", text: b.text, level: 2 }
  : { type: "list", style: "bulleted", items: b.items.map((text) => ({ spans: [{ text }] })) };

const STATIC_ARTICLES: Article[] = WRITTEN.map((a) => ({
  uuid: a.slug,
  author: { kind: "editor", userUuid: null, displayName: null },
  status: "published",
  title: a.title,
  dek: a.dek,
  category: a.category,
  language: "en",
  cover: null,
  instruments: [],
  audience: "everyone",
  slug: a.slug,
  readMinutes: a.readMinutes,
  publishedAt: `${a.publishedAt}T00:00:00Z`,
  editedAt: null,
  saved: false,
  applauseCount: 0,
  applauded: false,
  commentCount: 0,
  body: a.body.map(toBlock),
  interestDisclosure: null,
  moderation: null,
  createdAt: `${a.publishedAt}T00:00:00Z`,
  updatedAt: `${a.publishedAt}T00:00:00Z`,
}));

/** The written articles, filtered as the API would (category, an editor's, words; they name no instrument), a page at a time. */
export const staticJournalSource: JournalSource = {
  async list(filters) {
    const words = filters.q?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
    const matches = STATIC_ARTICLES.filter((a) =>
      (!filters.category || a.category === filters.category)
      && (!filters.authorKind || filters.authorKind === "editor")
      && !filters.authorUuid && !filters.ticker && !filters.isin && !filters.instrumentId && !filters.listingId
      && words.every((w) => `${a.title} ${a.dek} ${blocksText(a.body)}`.toLowerCase().includes(w)),
    );
    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;
    const page: Page<ArticleSummary> = { items: matches.slice(offset, offset + limit).map(summaryOf), total: matches.length, limit, offset };
    return page;
  },
  async bySlug(slug) {
    const article = STATIC_ARTICLES.find((a) => a.slug === slug);
    if (!article) throw new ApiError(404, "Article not found.", "ArticleNotFoundError");
    return article;
  },
};
