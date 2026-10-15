// components/dashboard/ReportFileTile.tsx
"use client";

import { useState } from "react";
import { Check, Download, Loader2, Plus, X } from "lucide-react";
import { ReportCover, type ReportKindId } from "./ReportKinds";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * REPORT FILE TILE — a report as a file (Investments' and Wallets' Reports): its kind's cover
 * (ReportKinds) with the kind's name, then its name, what it belongs to (a portfolio, a wallet, in
 * its colour), the day it was generated and its tags. With `href`, the cover and the name open
 * it; with `onDownload`, the button on the cover downloads it (without, the button says it's
 * coming soon). `readOnly`: tags shown only.
 */
export function ReportFileTile({
  name, cover, kindLabel, ownerName, color, createdAt, tags, href, downloading = false, readOnly, onDownload, onAddTag, onRemoveTag,
}: {
  name: string;
  cover: ReportKindId;
  kindLabel: string;
  ownerName: string;
  color: string;
  createdAt: string;
  tags: string[];
  href?: string;
  downloading?: boolean;
  readOnly: boolean;
  onDownload?: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}) {
  const [tagging, setTagging] = useState(false);
  const [newTag, setNewTag] = useState("");

  const submitTag = () => {
    const tag = newTag.trim();
    if (tag && !tags.includes(tag)) onAddTag(tag);
    setNewTag("");
    setTagging(false);
  };

  // The cover and the name, as links when there's something to open.
  const opener = (className: string, children: React.ReactNode, label?: string) =>
    href ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={label} title={label ? undefined : name}>
        {children}
      </a>
    ) : (
      <div className={className} title={label ? undefined : name}>{children}</div>
    );

  return (
    <div className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all overflow-hidden flex flex-col">
      <div className="relative">
        {opener("block h-36 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C49A3C]/60", <ReportCover kind={cover} />, `Open ${name}`)}
        <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded-md bg-black/45 backdrop-blur-sm text-[10px] font-black uppercase tracking-wider text-white pointer-events-none">
          {kindLabel}
        </span>
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading || !onDownload}
          aria-label={`Download ${name}`}
          title={onDownload ? undefined : "Coming soon"}
          className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-white/95 text-slate-600 flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-slate-900 transition-all disabled:cursor-not-allowed disabled:text-slate-300"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin text-slate-600" /> : <Download className="h-4 w-4" />}
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-2">
        {opener(
          `text-sm font-bold text-slate-900 leading-snug line-clamp-2 wrap-break-word ${href ? "hover:text-[#C49A3C] transition-colors" : ""}`,
          name,
        )}
        <div className="space-y-0.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="truncate">{ownerName}</span>
          </p>
          <p className="text-[11px] font-medium text-slate-400">Generated {formatDate(createdAt)}</p>
        </div>

        {/* Tags, at the bottom of the tile. */}
        <div className="mt-auto pt-2 flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-md bg-[#C49A3C]/10 text-[#8a6a22] text-[11px] font-bold">
              {tag}
              {!readOnly && (
                <button type="button" onClick={() => onRemoveTag(tag)} aria-label={`Remove tag ${tag}`} className="text-[#C49A3C] hover:text-rose-600 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {!readOnly && (tagging ? (
            <span className="flex items-center gap-1">
              <input
                autoFocus
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitTag();
                  if (e.key === "Escape") { setNewTag(""); setTagging(false); }
                }}
                onBlur={() => { if (!newTag.trim()) setTagging(false); }}
                placeholder="Tag…"
                aria-label="New tag"
                className="w-24 px-2 py-0.5 rounded-md border border-[#C49A3C]/40 text-[11px] font-bold outline-none focus:ring-2 focus:ring-[#C49A3C]/20"
              />
              <button type="button" onClick={submitTag} aria-label="Add tag" className="p-1 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors">
                <Check className="h-3 w-3" />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setTagging(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-dashed border-slate-300 text-[11px] font-bold text-slate-400 hover:text-slate-700 hover:border-slate-400 transition-colors"
            >
              <Plus className="h-3 w-3" /> Tag
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
