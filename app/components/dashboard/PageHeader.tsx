// components/dashboard/PageHeader.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";

const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;

export interface PageAction {
  label: string;
  onClick: () => void;
  // The page's main action: dark, with a plus unless `plus` is false (one that opens a page).
  primary?: boolean;
  plus?: boolean;
  danger?: boolean;
  disabled?: boolean;
  // Why it's disabled, or what it does.
  title?: string;
}

export interface PageCounter {
  key: string;
  label: string;
  // null while loading; left out for a link with nothing to count.
  count?: number | null;
  // Some of them need a look (alerts triggered): drawn before the count, in red.
  attention?: { count: number; label: string };
  onClick: () => void;
}

export interface PageFigure {
  label: string;
  value: string;
  sub?: string;
  tone?: "gain" | "loss";
  // Scrolls down to the module the figure comes from.
  onClick?: () => void;
}

// Actions shown as buttons; the rest go under "More".
const VISIBLE_ACTIONS = 3;

/**
 * PAGE HEADER — the top of a page in Wealth (Wealth itself, All portfolios, a portfolio): what it
 * is, its value and how it moved, its activity as counters that open its Transactions, Alerts and
 * Reports pages, its actions (the first few as buttons, the rest under More), and a row of key
 * figures, each leading down to the module it comes from. The actions always act on this page's
 * portfolio, so nothing on the pages under it asks which one.
 */
export function PageHeader({
  eyebrow, badge, notice, title, value, change, note, counters = [], actions = [], figures = [],
}: {
  eyebrow: string;
  badge?: React.ReactNode;
  // Above it all, across the page: what the page is, when it needs saying (a backtest's banner).
  notice?: React.ReactNode;
  title: string;
  // null while loading; undefined to leave it out.
  value?: string | null;
  change?: { text: string; tone?: "gain" | "loss" } | null;
  note?: string;
  counters?: PageCounter[];
  actions?: PageAction[];
  figures?: PageFigure[];
}) {
  const shown = actions.slice(0, VISIBLE_ACTIONS);
  const more = actions.slice(VISIBLE_ACTIONS);

  return (
    <div className="space-y-[22px]">
      {notice}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0 flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C]">
            {eyebrow}
            {badge}
          </p>
          <h1 className="text-[30px] md:text-[40px] font-bold text-[#1c1917] leading-[1.05] text-balance" style={serif}>{title}</h1>
          {(value !== undefined || note) && (
            <p className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5">
              {value !== undefined && (
                value === null
                  ? <span className="h-7 w-32 rounded-lg bg-[#EEE9DD] animate-pulse" />
                  : <span className="text-[26px] font-bold tracking-[-0.01em] text-[#1c1917] tabular-nums">{value}</span>
              )}
              {change && (
                <span className={`text-[13px] font-bold tabular-nums ${change.tone === "gain" ? "text-[#047857]" : change.tone === "loss" ? "text-[#e11d48]" : "text-[#78716c]"}`}>
                  {change.text}
                </span>
              )}
              {note && <span className="text-[12.5px] text-[#78716c]">{note}</span>}
            </p>
          )}
          {counters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {counters.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={c.onClick}
                  className="inline-flex items-center gap-[7px] px-[11px] py-[5px] rounded-full border border-[#E0DACC] text-xs font-semibold text-[#78716c] hover:border-[#C49A3C] hover:text-[#1c1917] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40"
                >
                  {c.attention && c.attention.count > 0 && (
                    <>
                      <span className="h-[7px] w-[7px] rounded-full bg-[#e11d48]" />
                      <b className="text-[#e11d48] tabular-nums">{c.attention.count}</b>
                      <span className="text-[#e11d48]">{c.attention.label} ·</span>
                    </>
                  )}
                  {c.count !== undefined && <b className="text-[#1c1917] tabular-nums">{c.count ?? "…"}</b>}
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {shown.map((a) => <ActionButton key={a.label} action={a} />)}
            {more.length > 0 && <MoreMenu actions={more} />}
          </div>
        )}
      </div>

      {figures.length > 0 && (
        <div className={`grid grid-cols-2 gap-3.5 ${figures.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          {figures.map((f) => {
            const body = (
              <>
                <span className="flex items-center justify-between gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#78716c]">
                  {f.label}
                  {f.onClick && <i className="not-italic normal-case tracking-normal font-semibold text-[#a8a29e] group-hover:text-[#C49A3C] transition-colors">↓</i>}
                </span>
                <span className={`block text-[22px] font-bold tracking-[-0.01em] tabular-nums truncate ${f.tone === "gain" ? "text-[#047857]" : f.tone === "loss" ? "text-[#e11d48]" : "text-[#1c1917]"}`}>
                  {f.value}
                </span>
                {f.sub && <span className="block text-xs text-[#78716c] truncate">{f.sub}</span>}
              </>
            );
            const card = "group min-w-0 flex flex-col gap-[5px] text-left bg-white rounded-[20px] border border-[#EEE9DD] px-[18px] py-4";
            return f.onClick ? (
              <button key={f.label} type="button" onClick={f.onClick} className={`${card} hover:border-[#C49A3C] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40`}>
                {body}
              </button>
            ) : (
              <div key={f.label} className={card}>{body}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionButton({ action }: { action: PageAction }) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      title={action.title}
      className={`inline-flex items-center gap-[7px] px-[15px] py-2.5 rounded-xl border text-[12.5px] font-bold transition-[border-color,background-color,transform] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${
        action.primary
          ? "bg-[#1c1917] border-[#1c1917] text-white hover:bg-[#131210]"
          : "bg-white border-[#E0DACC] text-[#1c1917] hover:border-[#C49A3C]"
      }`}
    >
      {action.primary && action.plus !== false && <Plus className="h-3.5 w-3.5" />}
      {action.label}
    </button>
  );
}

function MoreMenu({ actions }: { actions: PageAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        aria-expanded={open}
        className="flex items-center justify-center h-[41px] w-[41px] rounded-xl bg-white border border-[#E0DACC] text-[#1c1917] hover:border-[#C49A3C] transition-colors"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1.5 z-30 min-w-[200px] p-1.5 bg-white rounded-[14px] border border-[#E0DACC] shadow-[0_18px_40px_-16px_rgba(28,25,23,0.25)] flex flex-col">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              disabled={a.disabled}
              title={a.title}
              onClick={() => {
                setOpen(false);
                a.onClick();
              }}
              className={`text-left px-3 py-[9px] rounded-[9px] font-medium hover:bg-[#F7F5EF] disabled:opacity-50 disabled:cursor-not-allowed ${a.danger ? "text-[#e11d48]" : "text-[#1c1917]"}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
