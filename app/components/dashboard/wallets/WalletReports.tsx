// components/dashboard/wallets/WalletReports.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, FileText, Loader2, Search, X } from "lucide-react";
import { ReportFileTile } from "../ReportFileTile";
import { GenerateReportDialog } from "../GenerateReportDialog";
import { saveReportFile } from "../ReportsList";
import { useWallets } from "../../../context/WalletsContext";
import { ALL_WALLETS, errorText, walletColor } from "../../../lib/wallets";
import { walletService } from "../../../services/walletService";
import { ApiError } from "../../../services/apiClient";
import type { WalletReport, WalletReportKind, WalletReportRequest } from "../../../models/Wallet";

const KINDS: Record<WalletReportKind, { cover: "periodic" | "full"; label: string; description: string }> = {
  MONTHLY: { cover: "periodic", label: "Monthly statement", description: "A month: what came in, what went out, every movement, the budgets." },
  YEARLY: { cover: "full", label: "Yearly summary", description: "A year: its months, spending by category against the year before, what repeats." },
};
const ALL_COLOR = "#1c1917";

type RequestState = { kind: "idle" } | { kind: "sending" } | { kind: "queued" } | { kind: "conflict"; request: WalletReportRequest } | { kind: "error"; message: string };

const monthName = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

/** Last month, as YYYY-MM: the statement most often asked for. */
function lastMonth(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * WALLET REPORTS — the wallets' Reports page (WalletNode): every wallet's reports and those on
 * all of them, as files (ReportFileTile), newest first; on one wallet's page, that wallet's only.
 * One search by file, wallet, kind or tag; tags are saved. "Generate report" opens
 * GenerateReportDialog: a monthly statement or a yearly summary, of a wallet or all of them, for a
 * month or a year. The report is made in the background: a notification says when it's ready.
 */
export function WalletReports({ walletUuid, readOnly }: { walletUuid?: string; readOnly: boolean }) {
  const { wallets } = useWallets();
  const [files, setFiles] = useState<WalletReport[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [state, setState] = useState<RequestState>({ kind: "idle" });
  const [month, setMonth] = useState(lastMonth);
  const [year, setYear] = useState(new Date().getFullYear() - 1);

  const load = useCallback(() => {
    walletService.reports()
      .then((all) => { setFiles(all); setFailed(null); })
      .catch((err) => setFailed(errorText(err, "Failed to load the reports")));
  }, []);
  useEffect(load, [load]);

  // A confirmation clears itself; a question or an error waits for the user.
  useEffect(() => {
    if (state.kind !== "queued") return;
    const timer = setTimeout(() => setState({ kind: "idle" }), 6000);
    return () => clearTimeout(timer);
  }, [state]);

  const walletOf = (uuid: string | null) => (uuid ? wallets.find((w) => w.uuid === uuid) : undefined);
  const nameOf = (r: WalletReport) => (r.walletUuid ? walletOf(r.walletUuid)?.name ?? "A deleted wallet" : "All wallets");
  const colorOf = (r: WalletReport) => {
    const index = wallets.findIndex((w) => w.uuid === r.walletUuid);
    return index < 0 ? ALL_COLOR : walletColor(wallets[index], index);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (files ?? [])
      .filter((f) => !walletUuid || f.walletUuid === walletUuid)
      .filter((f) => !q || [f.name, nameOf(f), KINDS[f.kind].label, ...f.tags].join(" ").toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, query, walletUuid, wallets]);

  const download = async (file: WalletReport) => {
    setDownloading(file.documentId);
    try {
      const { url } = await walletService.reportDownloadUrl(file.subject, file.documentId);
      await saveReportFile(url, file.name);
    } catch (err) {
      alert(errorText(err, "Download failed"));
    } finally {
      setDownloading(null);
    }
  };
  const setTags = (id: string, tags: string[]) => setFiles((prev) => prev && prev.map((f) => (f.documentId === id ? { ...f, tags } : f)));
  const addTag = async (file: WalletReport, tag: string) => {
    try {
      await walletService.addReportTag(file.subject, file.documentId, tag);
      setTags(file.documentId, [...file.tags, tag]);
    } catch (err) {
      alert(errorText(err, "Error adding tag"));
    }
  };
  const removeTag = async (file: WalletReport, tag: string) => {
    try {
      await walletService.removeReportTag(file.subject, file.documentId, tag);
      setTags(file.documentId, file.tags.filter((t) => t !== tag));
    } catch (err) {
      alert(errorText(err, "Error removing tag"));
    }
  };

  const send = async (request: WalletReportRequest) => {
    setState({ kind: "sending" });
    try {
      await walletService.requestReport(request);
      setState({ kind: "queued" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && !request.force) setState({ kind: "conflict", request });
      else setState({ kind: "error", message: errorText(err, "Couldn't generate the report.") });
    }
  };
  const generate = (kind: WalletReportKind, targetId: string) => {
    setGenerating(false);
    const target = targetId === ALL_WALLETS ? "All wallets" : walletOf(targetId)?.name ?? "Wallet";
    const [y, m] = month.split("-").map(Number);
    void send({
      kind,
      walletUuid: targetId === ALL_WALLETS ? undefined : targetId,
      year: kind === "MONTHLY" ? y : year,
      month: kind === "MONTHLY" ? m : undefined,
      name: kind === "MONTHLY" ? `${target} — ${monthName(y, m)} statement` : `${target} — ${year} summary`,
    });
  };

  const active = wallets.filter((w) => !w.archived);
  const targets = [
    ...(walletUuid ? [] : [{ id: ALL_WALLETS, name: "All wallets", color: ALL_COLOR }]),
    ...active.map((w, i) => ({ id: w.uuid, name: w.name, color: walletColor(w, i) })).filter((t) => !walletUuid || t.id === walletUuid),
  ];
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => thisYear - i);

  return (
    <>
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
          // A demo account can open the dialog to see it; the dialog won't send anything.
          onClick={() => setGenerating(true)}
          disabled={state.kind === "sending" || targets.length === 0}
          className="h-12 flex items-center justify-center gap-2 px-5 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1c1917] shrink-0"
        >
          {state.kind === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Generate report
        </button>
      </div>

      {files === null && !failed ? (
        <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-[#C49A3C]" /></div>
      ) : failed ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">{failed}</p>
        </div>
      ) : shown.length === 0 && !query.trim() ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white border border-dashed border-slate-300 rounded-4xl">
          <FileText className="h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">No reports yet</h3>
          <p className="text-sm text-slate-500 mt-1">Generate a monthly statement or a yearly summary as a PDF.</p>
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
              {shown.map((f) => (
                <ReportFileTile
                  key={f.documentId}
                  name={f.name}
                  cover={KINDS[f.kind].cover}
                  kindLabel={KINDS[f.kind].label}
                  ownerName={nameOf(f)}
                  color={colorOf(f)}
                  createdAt={f.createdAt}
                  tags={f.tags}
                  href={`/reports/wallets/${f.subject}/${f.documentId}`}
                  downloading={downloading === f.documentId}
                  readOnly={readOnly}
                  onDownload={() => download(f)}
                  onAddTag={(tag) => addTag(f, tag)}
                  onRemoveTag={(tag) => removeTag(f, tag)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {generating && (
        <GenerateReportDialog
          kinds={(Object.keys(KINDS) as WalletReportKind[]).map((id) => ({ id, available: true, ...KINDS[id] }))}
          targets={targets}
          targetLabel="Wallet"
          readOnly={readOnly}
          period={(kind) => kind === "MONTHLY"
            ? {
              ready: /^\d{4}-\d{2}$/.test(month),
              picker: (
                <input
                  type="month"
                  value={month}
                  max={`${thisYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
                  onChange={(e) => setMonth(e.target.value)}
                  aria-label="Month"
                  className="h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-[#C49A3C]/50"
                />
              ),
            }
            : {
              ready: true,
              picker: (
                <div className="flex flex-wrap gap-2">
                  {years.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setYear(y)}
                      aria-pressed={y === year}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors ${
                        y === year ? "bg-[#1c1917] border-[#1c1917] text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {y}{y === thisYear && " (so far)"}
                    </button>
                  ))}
                </div>
              ),
            }}
          onClose={() => setGenerating(false)}
          onGenerate={(kind, target) => generate(kind as WalletReportKind, target.id)}
        />
      )}

      {state.kind !== "idle" && (
        <WalletReportToast
          state={state}
          onForce={() => state.kind === "conflict" && send({ ...state.request, force: true })}
          onClose={() => { setState({ kind: "idle" }); load(); }}
        />
      )}
    </>
  );
}

/** How a request went, bottom-centred as Investments' report toast. */
function WalletReportToast({ state, onForce, onClose }: { state: Exclude<RequestState, { kind: "idle" }>; onForce: () => void; onClose: () => void }) {
  const isError = state.kind === "error";
  const title = state.kind === "sending" ? "Requesting your report…"
    : state.kind === "queued" ? "Report on its way"
      : state.kind === "conflict" ? "A report is already in progress"
        : "Couldn't generate the report";
  const body = state.kind === "sending" ? "Hang on a moment."
    : state.kind === "queued" ? "You'll get a notification when it's ready, and you'll find it here."
      : state.kind === "conflict" ? "One is still being generated for this wallet. Wait for it, or start a new one anyway."
        : state.message;
  return createPortal(
    <div
      role="status"
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-100 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl w-[calc(100%-2rem)] max-w-lg ${
        isError ? "bg-rose-500 text-white" : "bg-slate-900 text-white"
      }`}
    >
      {state.kind === "sending" ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#C49A3C]" />
        : state.kind === "queued" ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          : <AlertCircle className={`h-5 w-5 shrink-0 ${isError ? "text-rose-200" : "text-amber-400"}`} />}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-bold">{title}</span>
        <span className="text-xs opacity-80">{body}</span>
      </div>
      {state.kind === "conflict" && (
        <button onClick={onForce} className="shrink-0 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold transition-colors">
          Generate anyway
        </button>
      )}
      {state.kind !== "sending" && (
        <button onClick={onClose} aria-label="Dismiss" className="shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>,
    document.body,
  );
}
