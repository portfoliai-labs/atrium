"use client";

import { useState } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Building2, Download, FileText, Loader2, PieChart, Trash2, Wallet } from "lucide-react";
import { ConfirmDialog } from "../ConfirmDialog";
import { usePortfolio } from "../../../context/PortfolioContext";
import { useWallets, walletKey } from "../../../context/WalletsContext";
import { realEstateKey, useRealEstate } from "../../../context/RealEstateContext";
import { accountKey } from "../../../hooks/useAccountQuery";
import { reportService } from "../../../services/reportService";
import { walletService } from "../../../services/walletService";
import { realEstateService } from "../../../services/realEstateService";
import { saveReportFile } from "../ReportsList";

// What a report is about.
export type ReportKind = "portfolio" | "wallet" | "property";

// One medium of the collection (for now always a report), whatever it's about: what the list shows
// and how its file is reached.
export interface CollectionItem {
  key: string;
  kind: ReportKind;
  name: string;
  // The portfolio, wallet or property it's about: its name now, or as it was when the report was
  // made once it's deleted (`deleted`).
  subject: string;
  deleted: boolean;
  createdAt: string;
  download: () => Promise<{ url: string }>;
  remove: () => Promise<void>;
}

const KINDS: Record<ReportKind, { label: string; icon: typeof PieChart }> = {
  portfolio: { label: "Portfolio", icon: PieChart },
  wallet: { label: "Wallets", icon: Wallet },
  property: { label: "Property", icon: Building2 },
};

/** After a report the assistant made: every list read again (which one has it isn't said). */
export function collectionChanged(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: accountKey("reports") });
  void queryClient.invalidateQueries({ queryKey: walletKey("reports") });
  void queryClient.invalidateQueries({ queryKey: realEstateKey("reports") });
}

/**
 * The collection's media: every report the user has (theirs alone, who asked for them: an
 * advisor's on their clients too), newest first: their portfolios' (ready ones only), their
 * wallets' and their properties', the deleted ones' included (a report outlives what it's about),
 * each read from its own route, in the query cache under its own key. A route that fails leaves
 * its reports out rather than the whole list; all are read again with `collectionChanged` (a
 * report the assistant just made, or one deleted). undefined while loading; `failed` when none
 * could be read.
 */
export function useCollection(enabled = true) {
  const { portfolios } = usePortfolio();
  const { available: hasWallets } = useWallets();
  const { properties, available: hasProperties } = useRealEstate();
  const portfolioReports = useQuery({ queryKey: accountKey("reports", "own"), queryFn: () => reportService.ownReports(), enabled });
  const walletReports = useQuery({ queryKey: walletKey("reports"), queryFn: () => walletService.reports(), enabled: enabled && hasWallets });
  const propertyReports = useQuery({ queryKey: realEstateKey("reports"), queryFn: () => realEstateService.reports(), enabled: enabled && hasProperties });

  const reads = [portfolioReports, ...(hasWallets ? [walletReports] : []), ...(hasProperties ? [propertyReports] : [])];
  if (!enabled || reads.some((r) => r.isPending)) return undefined;

  // Its name now; once it's deleted, as it was when the report was made.
  const named = (current: string | undefined, kept: string | null, fallback: string) => current ?? kept ?? fallback;
  const items: CollectionItem[] = [
    ...(portfolioReports.data ?? [])
      .filter((d) => d.status === "UPLOADED")
      .map((d): CollectionItem => ({
        key: `portfolio:${d.document_id}`, kind: "portfolio", name: d.name, createdAt: d.created_at,
        subject: named(portfolios.find((p) => p.uuid === d.portfolio_uuid)?.name, d.subject_name, "A portfolio"),
        deleted: d.subject_deleted,
        download: () => reportService.downloadReport(d.portfolio_uuid, d.document_id),
        remove: () => reportService.deleteReport(d.portfolio_uuid, d.document_id),
      })),
    ...(hasWallets ? walletReports.data ?? [] : []).map((r): CollectionItem => ({
      key: `wallet:${r.documentId}`, kind: "wallet", name: r.name, createdAt: r.createdAt,
      // On all the wallets together: no one wallet's name.
      subject: "All wallets",
      deleted: false,
      download: () => walletService.reportDownloadUrl(r.documentId),
      remove: () => walletService.deleteReport(r.documentId),
    })),
    ...(hasProperties ? propertyReports.data ?? [] : []).map((r): CollectionItem => ({
      key: `property:${r.documentId}`, kind: "property", name: r.name, createdAt: r.createdAt,
      subject: named(properties.find((p) => p.uuid === r.propertyUuid)?.name, r.subjectName, "A property"),
      deleted: r.subjectDeleted,
      download: () => realEstateService.reportDownloadUrl(r.propertyUuid, r.documentId),
      remove: () => realEstateService.deleteReport(r.propertyUuid, r.documentId),
    })),
  ];
  return {
    items: items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    failed: reads.length > 0 && reads.every((r) => r.isError),
  };
}

/**
 * COLLECTION — the assistant's media, beside the chats (as Gemini keeps what it made): for now the
 * reports the user has (the ones the assistant made among them), newest first, filtered by what
 * they're about, each downloaded or deleted from here.
 */
export function AssistantCollection({ library }: { library: ReturnType<typeof useCollection> }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<ReportKind | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CollectionItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (library === undefined) return <Loader2 className="w-5 h-5 animate-spin text-[#C49A3C] mx-auto my-10" />;
  if (library.failed) return <p className="text-sm text-[#b91c1c] text-center py-10">Your collection couldn&apos;t be loaded. Please try again.</p>;

  const present = (Object.keys(KINDS) as ReportKind[]).filter((k) => library.items.some((r) => r.kind === k));
  const shown = library.items.filter((r) => kind === "all" || r.kind === kind);

  const download = async (report: CollectionItem) => {
    setBusy(report.key);
    setError(null);
    try {
      const { url } = await report.download();
      await saveReportFile(url, report.name);
    } catch {
      setError("The report couldn't be downloaded. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await toDelete.remove();
      collectionChanged(queryClient);
      setToDelete(null);
    } catch {
      setDeleteError("The report couldn't be deleted. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  if (library.items.length === 0) {
    return (
      <div className="text-center py-10 px-6 space-y-2">
        <FileText className="w-8 h-8 text-[#C49A3C] mx-auto" />
        <p className="text-sm font-bold text-[#1c1917]">Nothing here yet</p>
        <p className="text-sm text-[#78716c] max-w-sm mx-auto">Ask the assistant for a report, on a portfolio or the year so far: it&apos;s kept here once it&apos;s made.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {present.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...present] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                kind === k ? "bg-[#1c1917] border-[#1c1917] text-white" : "bg-white border-[rgba(196,154,60,0.3)] text-[#57534e] hover:border-[#C49A3C]"
              }`}
            >
              {k === "all" ? "All" : `${KINDS[k].label}s`}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-[#b91c1c]">{error}</p>}
      <ul className="space-y-2">
        {shown.map((report) => {
          const Icon = KINDS[report.kind].icon;
          return (
            <li key={report.key} className="flex items-center gap-3 rounded-2xl border border-[rgba(196,154,60,0.2)] bg-white px-4 py-3">
              <span className="w-9 h-9 rounded-xl bg-[#C49A3C]/10 text-[#C49A3C] flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[#1c1917] truncate">{report.name}</span>
                <span className="block text-xs text-[#78716c] truncate">
                  Report · {KINDS[report.kind].label} · {report.subject}{report.deleted ? " (deleted)" : ""} · {new Date(report.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void download(report)}
                disabled={busy !== null}
                aria-label={`Download ${report.name}`}
                title="Download"
                className="p-2 rounded-lg text-[#857e78] hover:text-[#C49A3C] hover:bg-[#C49A3C]/10 transition-colors disabled:opacity-50"
              >
                {busy === report.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => { setDeleteError(null); setToDelete(report); }}
                disabled={busy !== null}
                aria-label={`Delete ${report.name}`}
                title="Delete"
                className="p-2 rounded-lg text-[#857e78] hover:text-[#b91c1c] hover:bg-[#b91c1c]/10 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          );
        })}
      </ul>
      {toDelete && (
        <ConfirmDialog
          title={`Delete "${toDelete.name}"?`}
          description="The report and its file are deleted. This can't be undone."
          confirming={deleting}
          error={deleteError}
          onConfirm={() => void remove()}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
