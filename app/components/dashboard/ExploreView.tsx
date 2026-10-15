"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, ArrowDown } from "lucide-react";

export interface ExploreHeader {
  title: string;
  onClose: () => void;
}

/**
 * EXPLORE HOST — what the Insights page (PerformanceSection) provides to its modules so one of
 * them can take the page over with its detail view, the way a month from the heatmap does:
 * `slot` is where the detail is drawn, `show` tells the page which detail is open (so it can
 * hide the rest, and the browser's back button can close it), or that none is.
 */
export const ExploreHostContext = createContext<{ slot: HTMLElement | null; show: (header: ExploreHeader | null) => void } | null>(null);

/**
 * EXPLORE VIEW — a module's detail view: everything behind its summary (the full tables, the
 * longer charts, the secondary figures), drawn in place of the Insights page while it's
 * mounted. The module renders it from its own state, so the detail keeps the module's live
 * data (a stale document that finishes rebuilding updates it too), and the page underneath is
 * only hidden, not unmounted: going back lands where the user left off. Esc goes back too.
 */
export function ExploreView({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const host = useContext(ExploreHostContext);

  // Callers pass an inline arrow, so keep the latest one in a ref rather than re-announcing
  // the view on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const show = host?.show;
  useEffect(() => {
    if (!show) return;
    show({ title, onClose: () => onCloseRef.current() });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      show(null);
    };
  }, [show, title]);

  if (!host?.slot) return null;
  return createPortal(children, host.slot);
}

/**
 * EXPLORE PANEL — one block of a detail view, in the same card and heading as the modules on
 * the page (see Module and ModuleHead in PerformanceSection): the title in small capitals, what it
 * shows on hovering it, and `right` beside it (a headline figure). (`eyebrow` is no longer drawn.)
 */
export function ExplorePanel({
  title, desc, right, children,
}: { eyebrow?: string; title: string; desc?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="group/module @container relative bg-white rounded-[1.75rem] border border-[#EEE9DD] overflow-hidden">
      <div className="px-6 pt-[22px] pb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
        <h2 title={desc} className="text-[10px] font-black uppercase tracking-[0.14em] text-[#78716c]">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export interface DataColumn<T> {
  key: string;
  label: string;
  // What the column sorts by; a column without one can't be sorted. null sorts last.
  sortValue?: (row: T) => number | string | null;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right";
  // Takes the width the other columns leave, its content cut short at the table's edge.
  grow?: boolean;
}

/**
 * DATA TABLE — a sortable table for the detail views' "every row" lists (holdings, payers,
 * platforms…). Click a column header to sort by it, again to flip the order; numbers start
 * largest first, text A to Z. `highlight` marks the row the detail was opened from (a click on
 * that row in the module) and scrolls it into view. Scrolls sideways inside its card on a
 * narrow screen rather than squeezing the columns.
 */
export function DataTable<T>({
  columns, rows, rowKey, initialSort, highlight,
}: {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  initialSort?: { key: string; desc: boolean };
  highlight?: string | null;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const highlightRef = useRef<HTMLTableRowElement>(null);

  const sorted = useMemo(() => {
    const column = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !column?.sortValue) return rows;
    const value = column.sortValue;
    return [...rows].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va === null) return vb === null ? 0 : 1;
      if (vb === null) return -1;
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sort.desc ? -cmp : cmp;
    });
  }, [rows, columns, sort]);

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlight]);

  const toggle = (column: DataColumn<T>) => {
    if (!column.sortValue) return;
    setSort((current) =>
      current?.key === column.key
        ? { key: column.key, desc: !current.desc }
        : { key: column.key, desc: typeof column.sortValue!(rows[0]) === "number" },
    );
  };

  return (
    <div className="overflow-x-auto">
      {/* Coloured explicitly: the cards are always white, but the page's own text colour turns
          near-white in dark mode (see globals.css), which a cell without a colour would inherit. */}
      <table className="w-full text-[13px] text-slate-700">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const right = c.align === "right";
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort!.desc ? "descending" : "ascending") : undefined}
                  className={`px-4 first:pl-6 last:pr-6 py-3 whitespace-nowrap ${right ? "text-right" : "text-left"} ${c.grow ? "w-full" : ""}`}
                >
                  {c.sortValue ? (
                    <button
                      onClick={() => toggle(c)}
                      className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-colors ${
                        active ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
                      } ${right ? "flex-row-reverse" : ""}`}
                    >
                      {c.label}
                      {active && (sort!.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                    </button>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{c.label}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((row) => {
            const key = rowKey(row);
            const isHighlighted = highlight != null && key === highlight;
            return (
              <tr key={key} ref={isHighlighted ? highlightRef : undefined} className={isHighlighted ? "bg-[#C49A3C]/10" : "hover:bg-slate-50/70"}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 first:pl-6 last:pr-6 py-3 ${
                      c.align === "right" ? "text-right tabular-nums whitespace-nowrap" : "text-left"
                    } ${c.grow ? "w-full max-w-0 min-w-32" : ""}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
