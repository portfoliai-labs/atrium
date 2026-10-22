"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Download, FileText, Loader2, PieChart, Wallet } from "lucide-react";
import { usePortfolio } from "../../../context/PortfolioContext";
import { useWallets } from "../../../context/WalletsContext";
import { useRealEstate } from "../../../context/RealEstateContext";
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
  // The portfolio, wallet or property it's about.
  subject: string;
  createdAt: string;
  download: () => Promise<{ url: string }>;
}

const KINDS: Record<ReportKind, { label: string; icon: typeof PieChart }> = {
  portfolio: { label: "Portfolio", icon: PieChart },
  wallet: { label: "Wallet", icon: Wallet },
  property: { label: "Property", icon: Building2 },
};

/**
 * The collection's media: every report the user has, newest first: their portfolios' (ready ones only), their wallets' and
 * their properties', each read from its own route. A route that fails leaves its reports out
 * rather than the whole list, read again as `reload` moves (a report the assistant just made).
 * undefined while loading; `failed` when none could be read.
 */
export function useCollection(enabled = true, reload = 0) {
  const { portfolios } = usePortfolio();
  const { wallets, available: hasWallets } = useWallets();
  const { properties, available: hasProperties } = useRealEstate();
  const real = useMemo(() => portfolios.filter((p) => !p.isVirtual && !p.isAggregate), [portfolios]);
  const key = real.map((p) => p.uuid).join(",");
  const [state, setState] = useState<{ key: string; items: CollectionItem[]; failed: boolean } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const portfolioName = (uuid: string) => real.find((p) => p.uuid === uuid)?.name ?? "A portfolio";
    const walletName = (uuid: string) => wallets.find((w) => w.uuid === uuid)?.name ?? "A wallet";
    const propertyName = (uuid: string) => properties.find((p) => p.uuid === uuid)?.name ?? "A property";
    const reads: Promise<CollectionItem[]>[] = [
      ...real.map((p) => reportService.getAllDocuments(p.uuid).then((docs) => docs
        .filter((d) => d.status === "UPLOADED")
        .map((d): CollectionItem => ({
          key: `portfolio:${d.document_id}`, kind: "portfolio", name: d.name, subject: portfolioName(d.portfolio_uuid), createdAt: d.created_at,
          download: () => reportService.downloadReport(d.portfolio_uuid, d.document_id),
        })))),
      ...(hasWallets ? [walletService.reports().then((list) => list.map((r): CollectionItem => ({
        key: `wallet:${r.documentId}`, kind: "wallet", name: r.name, subject: walletName(r.walletUuid), createdAt: r.createdAt,
        download: () => walletService.reportDownloadUrl(r.walletUuid, r.documentId),
      })))] : []),
      ...(hasProperties ? [realEstateService.reports().then((list) => list.map((r): CollectionItem => ({
        key: `property:${r.documentId}`, kind: "property", name: r.name, subject: propertyName(r.propertyUuid), createdAt: r.createdAt,
        download: () => realEstateService.reportDownloadUrl(r.propertyUuid, r.documentId),
      })))] : []),
    ];
    Promise.allSettled(reads).then((results) => {
      if (!live) return;
      const read = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      setState({
        key,
        items: read.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        failed: results.length > 0 && results.every((r) => r.status === "rejected"),
      });
    });
    return () => { live = false; };
    // The names are read as they are when the list loads; `key` follows the portfolios.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, hasWallets, hasProperties, reload]);

  return state?.key === key ? state : undefined;
}

/**
 * COLLECTION — the assistant's media, beside the chats (as Gemini keeps what it made): for now the
 * reports the user has (the ones the assistant made among them), newest first, filtered by what
 * they're about, each downloaded from here.
 */
export function AssistantCollection({ library }: { library: ReturnType<typeof useCollection> }) {
  const [kind, setKind] = useState<ReportKind | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
                  Report · {KINDS[report.kind].label} · {report.subject} · {new Date(report.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
