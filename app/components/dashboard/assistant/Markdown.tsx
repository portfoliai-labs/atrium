"use client";

import type { ReactNode } from "react";

/**
 * MARKDOWN — an AI answer's text. Built as React elements, never as HTML: raw HTML in it shows as
 * the text it is. Images show as their alt text, and a link only when it stays on the platform
 * (the server strips the others, this is the defence behind it): anywhere else, its text alone.
 * Covers what answers use: paragraphs (a single line break kept), headings, lists (nested by
 * indentation), quotes, code, rules and tables; bold, italic, strikethrough, inline code.
 */
export function Markdown({ text }: { text: string }) {
  return <div className="space-y-3 text-sm leading-relaxed text-[#1c1917] wrap-break-word">{blocks(text, "b")}</div>;
}

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

const indentOf = (s: string) => s.replace(/\t/g, "    ").length;
const isTableStart = (lines: string[], i: number) => lines[i].includes("|") && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1]);
const startsBlock = (lines: string[], i: number) =>
  FENCE.test(lines[i]) || HEADING.test(lines[i]) || RULE.test(lines[i]) || QUOTE.test(lines[i]) || LIST_ITEM.test(lines[i]) || isTableStart(lines, i);

function blocks(source: string, key: string): ReactNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  const k = () => `${key}.${out.length}`;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = line.match(FENCE);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) code.push(lines[i++]);
      i++;
      out.push(
        <pre key={k()} className="rounded-xl bg-[#F7F5EF] px-4 py-3 text-xs overflow-x-auto"><code>{code.join("\n")}</code></pre>,
      );
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      const level = heading[1].length;
      const content = inline(heading[2], k());
      out.push(
        level === 1 ? <h3 key={k()} className="text-lg font-bold">{content}</h3>
          : level === 2 ? <h4 key={k()} className="text-base font-bold">{content}</h4>
            : <h5 key={k()} className="text-sm font-bold">{content}</h5>,
      );
      i++;
      continue;
    }

    if (RULE.test(line)) {
      out.push(<hr key={k()} className="border-[rgba(196,154,60,0.25)]" />);
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) quoted.push(lines[i++].replace(QUOTE, ""));
      out.push(
        <blockquote key={k()} className="border-l-2 border-[#C49A3C] pl-3 text-[#57534e] space-y-2">{blocks(quoted.join("\n"), k())}</blockquote>,
      );
      continue;
    }

    if (isTableStart(lines, i)) {
      const head = cells(lines[i]);
      const align = cells(lines[i + 1]).map((c) => (c.endsWith(":") ? (c.startsWith(":") ? "center" : "right") : "left") as "left" | "center" | "right");
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) rows.push(cells(lines[i++]));
      const tk = k();
      out.push(
        <div key={tk} className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>{head.map((c, j) => <th key={j} style={{ textAlign: align[j] }} className="px-3 py-2 font-bold border-b border-[rgba(196,154,60,0.3)]">{inline(c, `${tk}.h${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-b border-[rgba(196,154,60,0.1)]">
                  {head.map((_, j) => <td key={j} style={{ textAlign: align[j] }} className="px-3 py-2">{inline(row[j] ?? "", `${tk}.${r}.${j}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const first = line.match(LIST_ITEM);
    if (first) {
      const base = indentOf(first[1]);
      const ordered = /\d/.test(first[2]);
      const items: string[][] = [];
      while (i < lines.length) {
        const current = lines[i];
        const item = current.match(LIST_ITEM);
        if (item && indentOf(item[1]) <= base + 1) {
          if (/\d/.test(item[2]) !== ordered) break;
          items.push([item[3]]);
          i++;
          continue;
        }
        if (!current.trim()) {
          // A blank line: the list goes on only if what follows is in it.
          let next = i + 1;
          while (next < lines.length && !lines[next].trim()) next++;
          const after = lines[next];
          const afterItem = after?.match(LIST_ITEM);
          const inList = after !== undefined && (indentOf(after.match(/^\s*/)![0]) > base + 1 || (afterItem && indentOf(afterItem[1]) <= base + 1 && /\d/.test(afterItem[2]) === ordered));
          if (!inList) break;
          items[items.length - 1].push("");
          i++;
          continue;
        }
        const indent = indentOf(current.match(/^\s*/)![0]);
        if (indent > base + 1) {
          items[items.length - 1].push(current.replace(/\t/g, "    ").slice(Math.min(indent, base + 2)));
          i++;
          continue;
        }
        // Lazy continuation of the item's last line.
        if (lines[i - 1]?.trim() && !startsBlock(lines, i)) {
          items[items.length - 1].push(current.trim());
          i++;
          continue;
        }
        break;
      }
      const lk = k();
      const children = items.map((item, j) => <li key={j} className="[&>p]:my-0 space-y-1">{blocks(item.join("\n"), `${lk}.${j}`)}</li>);
      out.push(
        ordered
          ? <ol key={lk} start={parseInt(first[2], 10)} className="list-decimal pl-5 space-y-1">{children}</ol>
          : <ul key={lk} className="list-disc pl-5 space-y-1">{children}</ul>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && (paragraph.length === 0 || !startsBlock(lines, i))) paragraph.push(lines[i++].trim());
    const pk = k();
    out.push(
      <p key={pk}>
        {paragraph.map((l, j) => <span key={j}>{j > 0 && <br />}{inline(l, `${pk}.${j}`)}</span>)}
      </p>,
    );
  }
  return out;
}

function cells(row: string): string[] {
  const trimmed = row.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  return trimmed.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

// Code; an image (its alt text); a link; bold; strikethrough; italic; an escaped character.
const INLINE = /(`+)([\s\S]*?[^`])\1(?!`)|!\[([^\]]*)\]\([^)]*\)|\[([^\]]+)\]\(\s*<?([^)\s>]*)>?(?:\s+"[^"]*")?\s*\)|\*\*([\s\S]+?)\*\*|(?<!\w)__([\s\S]+?)__(?!\w)|~~([\s\S]+?)~~|\*([^*\s](?:[^*]*[^*\s])?)\*|(?<!\w)_([^_\s](?:[^_]*[^_\s])?)_(?!\w)|\\([\\`*_{}[\]()#+\-.!~|>])/g;

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const k = `${key}.${out.length}`;
    if (m[1]) out.push(<code key={k} className="rounded bg-[#F7F5EF] px-1 py-0.5 text-[0.85em]">{m[2]}</code>);
    else if (m[3] !== undefined) { if (m[3]) out.push(m[3]); }
    else if (m[4] !== undefined) {
      const href = internalHref(m[5]);
      out.push(href
        ? <a key={k} href={href} className="text-[#C49A3C] font-semibold underline underline-offset-2">{inline(m[4], k)}</a>
        : <span key={k}>{inline(m[4], k)}</span>);
    }
    else if (m[6] !== undefined || m[7] !== undefined) out.push(<strong key={k}>{inline(m[6] ?? m[7], k)}</strong>);
    else if (m[8] !== undefined) out.push(<del key={k}>{inline(m[8], k)}</del>);
    else if (m[9] !== undefined || m[10] !== undefined) out.push(<em key={k}>{inline(m[9] ?? m[10], k)}</em>);
    else if (m[11] !== undefined) out.push(m[11]);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The link's address when it stays on the platform (a path, an anchor, this origin); else null. */
function internalHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  if (href.startsWith("#")) return href;
  if (href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\")) return href;
  try {
    const url = new URL(href);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : null;
  } catch {
    return null;
  }
}
