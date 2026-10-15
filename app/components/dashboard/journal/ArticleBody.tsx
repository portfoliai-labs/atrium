// components/dashboard/journal/ArticleBody.tsx
"use client";

import type { ArticleImage, Block, Span } from "../../../models/Journal";
import { serif } from "../../preview/PreviewKit";

/** A run of text with its marks: an author's link opens elsewhere, and vouches for nothing. */
function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) => {
        let node: React.ReactNode = s.text;
        if (s.italic) node = <em>{node}</em>;
        if (s.bold) node = <strong className="font-bold text-slate-900">{node}</strong>;
        if (s.linkUrl) {
          node = (
            <a href={s.linkUrl} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-[#9a7424] underline decoration-[#C49A3C]/50 underline-offset-2 hover:decoration-[#C49A3C]">
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
      {image.caption && <figcaption className="mt-2 text-xs text-slate-400 text-center leading-relaxed">{image.caption}</figcaption>}
    </figure>
  );
}

/** An article's body, block by block. Nothing an author writes is markup: only these blocks. */
export function ArticleBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-5 text-[15px] text-slate-700 leading-[1.8]">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            return <p key={i}><Spans spans={block.spans} /></p>;
          case "heading":
            return block.level === 3
              ? <h3 key={i} className="text-lg font-black text-slate-900 pt-2" style={serif}>{block.text}</h3>
              : <h2 key={i} className="text-xl font-black text-slate-900 pt-3" style={serif}>{block.text}</h2>;
          case "list": {
            const items = block.items.map((item, j) => <li key={j}><Spans spans={item.spans} /></li>);
            return block.style === "numbered"
              ? <ol key={i} className="space-y-2 pl-5 list-decimal marker:text-[#C49A3C] marker:font-bold">{items}</ol>
              : <ul key={i} className="space-y-2 pl-5 list-disc marker:text-[#C49A3C]">{items}</ul>;
          }
          case "quote":
            return (
              <blockquote key={i} className="border-l-2 border-[#C49A3C] pl-5 py-1">
                <p className="text-[17px] text-slate-800 italic leading-relaxed" style={serif}><Spans spans={block.spans} /></p>
                {block.attribution && <footer className="mt-2 text-xs font-bold text-slate-400">— {block.attribution}</footer>}
              </blockquote>
            );
          case "image":
            return <ArticleFigure key={i} image={block} className="py-2" />;
        }
      })}
    </div>
  );
}
