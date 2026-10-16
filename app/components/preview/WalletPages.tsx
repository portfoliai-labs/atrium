// components/preview/WalletPages.tsx
"use client";

import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { ReportFileTile } from "../dashboard/ReportFileTile";
import { GenerateReportDialog } from "../dashboard/GenerateReportDialog";
import { DEMO_WALLETS, WALLET_REPORTS } from "../../lib/mock/wallets";
import { PreviewBanner } from "./PreviewKit";

/**
 * WALLET PREVIEWS — what the Wallets don't have from the API yet, shown to a demo account only, on
 * its sample data (lib/mock/wallets): Reports, as a page of its own. Everything else on a wallet's
 * pages is the real thing (components/dashboard/wallets), which a demo account reads
 * on the same sample data.
 */

const walletOf = (uuid: string) => DEMO_WALLETS.find((w) => w.uuid === uuid)!;

// ── Reports ──────────────────────────────────────────────────────────────────────────────────

const WALLET_REPORT_KINDS = {
  monthly: { cover: "periodic" as const, label: "Monthly statement", description: "One wallet's month: what came in, what went out, and the closing balance." },
  yearly: { cover: "full" as const, label: "Yearly summary", description: "One wallet's year: income, spending by category, savings rate." },
};

/**
 * Every wallet's reports as files, as on Investments (ReportFileTile): each with its kind's cover,
 * its wallet and its tags (changed on this page only), one search by file, wallet, kind or tag,
 * and "Generate report" opening the same dialog (GenerateReportDialog), which can't send yet.
 */
export function WalletReports() {
  const [files, setFiles] = useState(WALLET_REPORTS);
  const [query, setQuery] = useState("");
  const [generating, setGenerating] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files
      .filter((f) => !q || [f.name, walletOf(f.walletUuid).name, WALLET_REPORT_KINDS[f.kind].label, ...f.tags].join(" ").toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [files, query]);
  const setTags = (id: string, change: (tags: string[]) => string[]) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, tags: change(f.tags) } : f)));

  return (
    <>
      <PreviewBanner feature="Wallet reports">Sample statements. Tags change on this page only and aren&apos;t saved; opening, downloading and generating are on the way.</PreviewBanner>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-[#C49A3C] transition-colors" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by file, wallet or tag…"
            aria-label="Search reports"
            className="w-full h-12 pl-11 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-medium outline-none focus:ring-4 focus:ring-[#C49A3C]/10 focus:border-[#C49A3C]/50 transition-all shadow-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setGenerating(true)}
          className="h-12 flex items-center justify-center gap-2 px-5 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors shrink-0"
        >
          <FileText className="h-4 w-4" />
          Generate report
        </button>
      </div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
        {shown.length} {shown.length === 1 ? "file" : "files"}{query.trim() && ` matching "${query.trim()}"`}
      </p>
      {shown.length === 0 ? (
        <p className="text-sm font-semibold text-slate-500 px-1">Nothing matches your search.</p>
      ) : (
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-5">
          {shown.map((f) => {
            const wallet = walletOf(f.walletUuid);
            return (
              <ReportFileTile
                key={f.id}
                name={f.name}
                cover={WALLET_REPORT_KINDS[f.kind].cover}
                kindLabel={WALLET_REPORT_KINDS[f.kind].label}
                ownerName={wallet.name}
                color={wallet.color!}
                createdAt={f.createdAt}
                tags={f.tags}
                readOnly={false}
                onAddTag={(tag) => setTags(f.id, (tags) => [...tags, tag])}
                onRemoveTag={(tag) => setTags(f.id, (tags) => tags.filter((t) => t !== tag))}
              />
            );
          })}
        </div>
      )}
      {generating && (
        <GenerateReportDialog
          kinds={(Object.keys(WALLET_REPORT_KINDS) as (keyof typeof WALLET_REPORT_KINDS)[]).map((id) => ({ id, available: true, ...WALLET_REPORT_KINDS[id] }))}
          targets={DEMO_WALLETS.map((w) => ({ id: w.uuid, name: w.name, color: w.color! }))}
          targetLabel="Wallet"
          readOnly
          readOnlyTitle="Coming soon: wallet reports are a preview"
          onGenerate={() => setGenerating(false)}
          onClose={() => setGenerating(false)}
        />
      )}
    </>
  );
}
