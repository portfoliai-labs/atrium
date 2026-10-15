"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { reportService } from "../../../../services/reportService";
import { DisclaimerBanner } from "../../../../components/legal/DisclaimerBanner";

// Shareable, auth-gated single-report view: the (reserved) layout's UserProvider
// already redirects unauthenticated visitors before this page can fetch anything,
// and the backend's /download endpoint is expected to scope documentId to its owner
// (or their advisor) within the given portfolioUuid.
export default function ReportViewerPage() {
  const { portfolioUuid, documentId } = useParams<{ portfolioUuid: string; documentId: string }>();
  const router = useRouter();

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { url } = await reportService.downloadReport(portfolioUuid, documentId);
        if (!url) throw new Error("Invalid URL received from server");

        const response = await fetch(url);
        if (!response.ok) throw new Error("Could not fetch file data from storage");

        const blob = await response.blob();
        if (cancelled) return;

        objectUrl = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        setBlobUrl(objectUrl);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Report not found or access denied");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [portfolioUuid, documentId]);

  return (
    <div className="min-h-screen bg-[#F7F5EF] flex flex-col">
      <DisclaimerBanner compact />

      <div className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-[rgba(196,154,60,0.2)] bg-white/60">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-white border border-transparent hover:border-[rgba(196,154,60,0.2)] text-[#78716c] hover:text-[#1c1917] font-bold text-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {blobUrl && (
          <a
            href={blobUrl}
            download="report.pdf"
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1c1917] text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#C49A3C] transition-colors"
          >
            <Download className="w-4 h-4" /> Download
          </a>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {loading && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-[#C49A3C]" />
            <p className="text-[#78716c] font-medium animate-pulse">Loading report...</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 text-center max-w-md">
            <AlertCircle className="w-10 h-10 text-rose-500" />
            <h1 className="text-lg font-bold text-[#1c1917]">Unable to open this report</h1>
            <p className="text-sm text-[#78716c]">{error}</p>
          </div>
        )}

        {!loading && !error && blobUrl && (
          <>
            {/* Desktop: inline preview — desktop browsers' built-in PDF viewer
                supports scrolling/zooming fine inside an iframe. */}
            <iframe
              src={blobUrl}
              title="Report preview"
              className="hidden md:block w-full h-[calc(100vh-96px)] rounded-2xl border border-[rgba(196,154,60,0.2)] bg-white shadow-sm"
            />

            {/* Mobile: iOS/Android iframe-embedded PDFs render a static first-page
                snapshot with no scroll/zoom, so open the file in its own tab
                instead, where the device's native PDF viewer handles it properly. */}
            <div className="md:hidden flex flex-col items-center gap-4 text-center bg-white rounded-2xl border border-[rgba(196,154,60,0.2)] shadow-sm p-8 w-full max-w-sm">
              <FileText className="w-10 h-10 text-[#C49A3C]" />
              <div>
                <h2 className="text-base font-bold text-[#1c1917] mb-1">Report ready</h2>
                <p className="text-sm text-[#78716c]">Open it in a new tab to scroll, zoom and read the full report.</p>
              </div>
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-[#1c1917] text-white rounded-xl text-sm font-bold hover:bg-[#C49A3C] transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Open report
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
