// components/dashboard/journal/ArticleBody.tsx
"use client";

import { createContext, useContext, useMemo } from "react";
import type { ArticleImage, ArticleInstrument, Block, Span } from "../../../models/Journal";
import { splitTags, tagPattern } from "../../../lib/journal";
import { serif, serifText } from "../../preview/PreviewKit";

// The article's instruments, for the tags in its text: what "#" and a ticker names, and where it leads.
const Tags = createContext<{ instruments: ArticleInstrument[]; pattern: RegExp | null; onInstrument?: (i: ArticleInstrument) => void }>({
  instruments: [], pattern: null,
});

/** A span's text with its tags: each the instrument's ticker, opening its articles where it can. */
function Tagged({ text }: { text: string }) {
  const { instruments, pattern, onInstrument } = useContext(Tags);
  return splitTags(text, pattern).map((part, i) => {
    if ("text" in part) return <span key={i}>{part.text}</span>;
    const instrument = instruments.find((x) => x.ticker === part.ticker)!;
    const className = "font-semibold text-[#8A6A28]";
    return onInstrument ? (
      <button key={i} type="button" onClick={() => onInstrument(instrument)} title={`More articles about ${instrument.name ?? instrument.ticker}`} className={`${className} hover:underline underline-offset-2`}>
        #{part.ticker}
      </button>
    ) : (
      <span key={i} title={instrument.name ?? undefined} className={className}>#{part.ticker}</span>
    );
  });
}

/** A run of text with its marks: an author's link opens elsewhere, and vouches for nothing. */
function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) => {
        // A tag inside a link is the link's text.
        let node: React.ReactNode = s.linkUrl ? s.text : <Tagged text={s.text} />;
        if (s.italic) node = <em>{node}</em>;
        if (s.strike) node = <s className="decoration-slate-400">{node}</s>;
        if (s.highlight) node = <mark className="rounded-sm bg-[#C49A3C]/25 px-0.5 text-inherit">{node}</mark>;
        if (s.bold) node = <strong className="font-bold text-[#1c1917]">{node}</strong>;
        if (s.linkUrl) {
          node = (
            <a href={s.linkUrl} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-[#8A6A28] underline decoration-[#C49A3C]/60 underline-offset-[3px] hover:decoration-[#C49A3C]">
              {node}
            </a>
          );
        }
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

/** An image of the article, from its short-lived link; its caption under it. */
export function ArticleFigure({ image, className = "" }: { image: ArticleImage; className?: string }) {
  if (!image.file?.url) return null;
  return (
    <figure className={className}>
      {/* A signed link to a private bucket: next/image can't optimise it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.file.url} alt={image.altText} className="w-full rounded-2xl border border-slate-100" />
      {image.caption && <figcaption className="mt-2.5 text-[13px] italic text-[#78716c] text-center leading-relaxed" style={serifText}>{image.caption}</figcaption>}
    </figure>
  );
}

/** A table, as wide as it needs: wider than the page, it scrolls on its own. */
function ArticleTable({ table }: { table: Extract<Block, { type: "table" }> }) {
  const head = table.headerRow ? table.rows[0] : null;
  const rest = table.headerRow ? table.rows.slice(1) : table.rows;
  return (
    <figure className="py-1">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[16px] leading-relaxed">
          {head && (
            <thead>
              <tr>
                {head.cells.map((c, j) => <th key={j} className="border-b-2 border-[#C49A3C] px-3 py-2 text-left align-bottom font-bold text-[#1c1917]"><Spans spans={c.spans} /></th>)}
              </tr>
            </thead>
          )}
          <tbody>
            {rest.map((r, i) => (
              <tr key={i} className="border-b border-[#E7E1D3]">
                {r.cells.map((c, j) => <td key={j} className="px-3 py-2 align-top"><Spans spans={c.spans} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.caption && <figcaption className="mt-2.5 text-[13px] italic text-[#78716c] text-center leading-relaxed">{table.caption}</figcaption>}
    </figure>
  );
}

/**
 * An article's body, block by block. Nothing an author writes is markup: only these blocks. A
 * ticker among its `instruments` after "#" is a tag, opening the instrument's articles with
 * `onInstrument`.
 */
export function ArticleBody({ blocks, instruments = [], onInstrument }: {
  blocks: Block[];
  instruments?: ArticleInstrument[];
  onInstrument?: (instrument: ArticleInstrument) => void;
}) {
  const tags = useMemo(() => ({ instruments, pattern: tagPattern(instruments), onInstrument }), [instruments, onInstrument]);
  return (
    <Tags.Provider value={tags}>
      <div className="space-y-[1.4rem] text-[19px] text-[#292524] leading-[1.75]" style={serifText}>
        {blocks.map((block, i) => {
          switch (block.type) {
            case "paragraph":
              return <p key={i}><Spans spans={block.spans} /></p>;
            case "heading":
              return block.level === 3
                ? <h3 key={i} className="text-[1.3rem] leading-snug font-bold text-[#1c1917] pt-2" style={serif}>{block.text}</h3>
                : <h2 key={i} className="text-[1.65rem] leading-tight tracking-[-0.01em] font-black text-[#1c1917] pt-4" style={serif}>{block.text}</h2>;
            case "list": {
              const items = block.items.map((item, j) => <li key={j}><Spans spans={item.spans} /></li>);
              return block.style === "numbered"
                ? <ol key={i} className="space-y-2 pl-[1.4rem] list-decimal marker:text-[#C49A3C] marker:font-bold">{items}</ol>
                : <ul key={i} className="space-y-2 pl-[1.4rem] list-disc marker:text-[#C49A3C] marker:font-bold">{items}</ul>;
            }
            case "quote":
              return (
                <blockquote key={i} className="border-l-[3px] border-[#C49A3C] pl-6 py-1 my-2">
                  <p className="text-[22px] text-[#44403c] italic leading-snug"><Spans spans={block.spans} /></p>
                  {block.attribution && <footer className="mt-2 text-xs font-bold not-italic text-[#a8a29e]" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>— {block.attribution}</footer>}
                </blockquote>
              );
            case "image":
              return <ArticleFigure key={i} image={block} className="py-2" />;
            case "table":
              return <ArticleTable key={i} table={block} />;
          }
        })}
      </div>
    </Tags.Provider>
  );
}
