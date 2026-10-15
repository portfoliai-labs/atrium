// components/dashboard/ReportsBrowser.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, FileText, Loader2, Search } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";
import { useUser } from "../../context/UserContext";
import { portfolioColorMap } from "../../lib/chartColors";
import { reportService } from "../../services/reportService";
import { downloadReportFile } from "./ReportsList";
import { useGenerateReport } from "./GenerateReport";
import { GenerateReportDialog } from "./GenerateReportDialog";
import { REPORT_KINDS, reportKindOf } from "./ReportKinds";
import { ReportFileTile } from "./ReportFileTile";
import type { Document } from "../../models/Report";

/**
 * REPORTS BROWSER — a portfolio's Reports tab (PortfolioPage, with `portfolioUuid`), or every real
 * portfolio's reports without it: as files, in one grid, newest first. Each shows its kind's cover (ReportKinds), its name, the portfolio it
 * belongs to (in its colour), when it was generated and its tags, which can be added and removed
 * there. Clicking a file opens it; its button downloads it. One search filters by file, portfolio,
 * kind or tag. "Generate report" opens GenerateReportDialog (which kind, which portfolio). The
 * backend makes no reports for the virtual portfolios ("All portfolios", the backtests), so
 * they aren't here.
 */
export function ReportsBrowser({ portfolioUuid }: { portfolioUuid?: string } = {}) {
  const { portfolios } = usePortfolio();
  const { isDemo } = useUser();
  const { generate, sending, toast } = useGenerateReport();
  const real = useMemo(
    () => portfolios.filter((p) => !p.isVirtual && (!portfolioUuid || p.uuid === portfolioUuid)),
    [portfolios, portfolioUuid],
  );
  const colorOf = useMemo(() => portfolioColorMap(portfolios), [portfolios]);
  const byUuid = useMemo(() => new Map(real.map((p) => [p.uuid, p])), [real]);

  const [files, setFiles] = useState<Document[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Every real portfolio's reports; one failing to load doesn't hide the others'.
  const uuidsKey = real.map((p) => p.uuid).join(",");
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled(real.map((p) => reportService.getAllDocuments(p.uuid))).then((results) => {
      if (cancelled) return;
      const loaded = results.filter((r) => r.status === "fulfilled");
      setFailed(loaded.length === 0 && results.length > 0);
      setFiles(loaded.flatMap((r) => (Array.isArray(r.value) ? r.value : [])));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuidsKey]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (files ?? [])
      .filter((f) => {
        if (!q) return true;
        const haystack = [f.name, byUuid.get(f.portfolio_uuid)?.name, reportKindOf(f).label, ...(f.tags ?? [])].join(" ").toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [files, query, byUuid]);

  const download = async (file: Document) => {
    setDownloading(file.document_id);
    try {
      await downloadReportFile(file.portfolio_uuid, file.document_id, file.name);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Download failed"}`);
    } finally {
      setDownloading(null);
    }
  };

  const setTags = (docId: string, tags: string[]) =>
    setFiles((prev) => prev && prev.map((f) => (f.document_id === docId ? { ...f, tags } : f)));
  const addTag = async (file: Document, tag: string) => {
    try {
      await reportService.addTag(file.portfolio_uuid, file.document_id, tag);
      setTags(file.document_id, [...(file.tags ?? []), tag]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error adding tag");
    }
  };
  const removeTag = async (file: Document, tag: string) => {
    try {
      await reportService.removeTag(file.portfolio_uuid, file.document_id, tag);
      setTags(file.document_id, (file.tags ?? []).filter((t) => t !== tag));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error removing tag");
    }
  };

  return (
    <div className="space-y-5">
      {toast}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-[#C49A3C] transition-colors" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by file, portfolio or tag…"
            aria-label="Search reports"
            className="w-full h-12 pl-11 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-medium outline-none focus:ring-4 focus:ring-[#C49A3C]/10 focus:border-[#C49A3C]/50 transition-all shadow-sm"
          />
        </div>
        <button
          type="button"
          // A demo account can open the dialog to see it; the dialog won't send anything.
          onClick={() => setGenerating(true)}
          disabled={sending || real.length === 0}
          className="h-12 flex items-center justify-center gap-2 px-5 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1c1917] shrink-0"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Generate report
        </button>
      </div>

      {files === null ? (
        <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-[#C49A3C]" /></div>
      ) : failed ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">Failed to load the reports</p>
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white border border-dashed border-slate-300 rounded-4xl">
          <FileText className="h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">No reports yet</h3>
          <p className="text-sm text-slate-500 mt-1">Generate one for a full-history PDF of a portfolio.</p>
        </div>
      ) : (
        <>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
            {shown.length} {shown.length === 1 ? "file" : "files"}{query.trim() && ` matching "${query.trim()}"`}
          </p>
          {shown.length === 0 ? (
            <p className="text-sm font-semibold text-slate-500 px-1">Nothing matches your search.</p>
          ) : (
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-5">
              {shown.map((file) => (
                <ReportFileTile
                  key={file.document_id}
                  name={file.name}
                  cover={reportKindOf(file).id}
                  kindLabel={reportKindOf(file).label}
                  ownerName={byUuid.get(file.portfolio_uuid)?.name ?? "Portfolio"}
                  color={colorOf(file.portfolio_uuid)}
                  createdAt={file.created_at}
                  tags={file.tags ?? []}
                  href={`/reports/${file.portfolio_uuid}/${file.document_id}`}
                  downloading={downloading === file.document_id}
                  readOnly={isDemo}
                  onDownload={() => download(file)}
                  onAddTag={(tag) => addTag(file, tag)}
                  onRemoveTag={(tag) => removeTag(file, tag)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {generating && (
        <GenerateReportDialog
          kinds={Object.values(REPORT_KINDS).filter((k) => k.generate !== null).map((k) => ({
            id: k.id, cover: k.id, label: k.label, description: k.description, available: k.generate === true,
          }))}
          targets={real.map((p) => ({ id: p.uuid, name: p.name, color: colorOf(p.uuid) }))}
          targetLabel="Portfolio"
          readOnly={isDemo}
          onClose={() => setGenerating(false)}
          // Only full-history reports exist for now (see ReportKinds).
          onGenerate={(_kind, target) => {
            setGenerating(false);
            const portfolio = byUuid.get(target.id);
            if (portfolio) generate(portfolio);
          }}
        />
      )}
    </div>
  );
}
