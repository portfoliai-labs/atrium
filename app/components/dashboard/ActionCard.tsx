// components/dashboard/ActionCard.tsx
"use client";

import { ArrowUpRight } from "lucide-react";

/** ACTION CARD — a way out of a hub page: dark, so it reads apart from the portfolio cards. */
// `children`: a line of live detail under the text (the real estate preview's "2 active"…).
// `badge`: a pill beside the title (the previews' "Preview").
export function ActionCard({
  icon, title, text, onClick, className = "", children, badge,
}: { icon: React.ReactNode; title: string; text: string; onClick?: () => void; className?: string; children?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`group min-h-44 h-full text-left bg-[#1c1917] rounded-3xl p-5 md:p-6 flex flex-col justify-between gap-4 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/60 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="w-10 h-10 rounded-xl bg-[#C49A3C]/15 text-[#C49A3C] flex items-center justify-center">{icon}</span>
        <ArrowUpRight className="h-4 w-4 text-stone-500 group-hover:text-[#C49A3C] transition-colors" />
      </div>
      <div>
        <p className="flex items-center gap-2 text-lg font-black text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{title}{badge}</p>
        <p className="text-[13px] text-stone-400 mt-1 leading-relaxed">{text}</p>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </button>
  );
}
