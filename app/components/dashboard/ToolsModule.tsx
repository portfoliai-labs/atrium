// components/dashboard/ToolsModule.tsx
"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import { MODULE_BODY, Module, ModuleHead } from "./PerformanceSection";

export interface Tool {
  key: string;
  icon: LucideIcon;
  title: string;
  text: string;
  onClick: () => void;
}

/**
 * TOOLS MODULE — the pages a page's header leads to besides its own (a portfolio's Plan: taxes,
 * stress test, projection, strategies; the wallets' budgets and banks), a tile each, in one card
 * under the header: as many to a row as there are, up to four.
 */
export function ToolsModule({ title, tools }: { title: string; tools: Tool[] }) {
  const columns = tools.length >= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : tools.length === 3 ? "md:grid-cols-3" : "sm:grid-cols-2";
  return (
    <Module>
      <ModuleHead title={title} />
      <div className={`${MODULE_BODY} grid grid-cols-1 ${columns} gap-3`}>
        {tools.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={t.onClick}
            className="group flex items-start gap-3 p-4 rounded-2xl border border-[#EEE9DD] text-left hover:border-[#C49A3C]/60 hover:bg-[#FBFAF6] transition-colors"
          >
            <span className="w-9 h-9 rounded-xl bg-[#F7F5EF] text-[#78716c] flex items-center justify-center shrink-0 group-hover:bg-[#C49A3C]/15 group-hover:text-[#C49A3C] transition-colors">
              <t.icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold text-[#1c1917]">{t.title}</span>
              <span className="block mt-0.5 text-xs text-[#78716c] leading-relaxed">{t.text}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-[#857e78] mt-2.5 shrink-0" />
          </button>
        ))}
      </div>
    </Module>
  );
}
