// components/dashboard/realEstate/RealEstateReports.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, FileText, Loader2, Search } from "lucide-react";
import { ReportFileTile } from "../ReportFileTile";
import { GenerateReportDialog } from "../GenerateReportDialog";
import { saveReportFile } from "../ReportsList";
import { ReportRequestToast, type ReportRequestState } from "../wallets/WalletReports";
import { useRealEstate } from "../../../context/RealEstateContext";
import { CATEGORICAL_PALETTE } from "../../../lib/chartColors";
import { errorText } from "../../../lib/wallets";
import { realEstateService } from "../../../services/realEstateService";
import { ApiError } from "../../../services/apiClient";
import type { PropertyReport, PropertyReportRequest } from "../../../models/RealEstate";

// A property has one report: its full one, over its whole history.
const FULL_REPORT = {
  id: "FULL",
  cover: "full" as const,
  label: "Full report",
  description: "The property's whole history: its value against what was put in, rents and costs, the mortgage, the taxes.",
  available: true,
};
// A deleted property's reports, until they go with it.
const NO_PROPERTY_COLOR = "#1c1917";

/**
 * REAL ESTATE REPORTS — the real estate's Reports page (RealEstateNode), as the wallets'
 * (WalletReports): every property's reports as files, newest first; on one property's, that
 * property's only. One search by file, property or tag; tags are saved. "Generate report" opens
 * GenerateReportDialog: a property's full report, its whole history (on every property's page, the
 * property is picked there). The report is made in the background: a notification says when it's
 * ready.
 */
export function RealEstateReports({ propertyUuid, readOnly }: { propertyUuid?: string; readOnly: boolean }) {
  const { properties } = useRealEstate();
  const [files, setFiles] = useState<PropertyReport[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [state, setState] = useState<ReportRequestState<PropertyReportRequest>>({ kind: "idle" });

  const load = useCallback(() => {
    realEstateService.reports()
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

  const propertyOf = (uuid: string) => properties.find((p) => p.uuid === uuid);
  const colorAt = (index: number) => CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length];
  const nameOf = (r: PropertyReport) => propertyOf(r.propertyUuid)?.name ?? "A deleted property";
  const colorOf = (r: PropertyReport) => {
    const index = properties.findIndex((p) => p.uuid === r.propertyUuid);
    return index < 0 ? NO_PROPERTY_COLOR : colorAt(index);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (files ?? [])
      .filter((f) => !propertyUuid || f.propertyUuid === propertyUuid)
      .filter((f) => !q || [f.name, nameOf(f), ...f.tags].join(" ").toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, query, propertyUuid, properties]);

  const download = async (file: PropertyReport) => {
    setDownloading(file.documentId);
    try {
      const { url } = await realEstateService.reportDownloadUrl(file.propertyUuid, file.documentId);
      await saveReportFile(url, file.name);
    } catch (err) {
      alert(errorText(err, "Download failed"));
    } finally {
      setDownloading(null);
    }
  };
  const setTags = (id: string, tags: string[]) => setFiles((prev) => prev && prev.map((f) => (f.documentId === id ? { ...f, tags } : f)));
  const addTag = async (file: PropertyReport, tag: string) => {
    try {
      await realEstateService.addReportTag(file.propertyUuid, file.documentId, tag);
      setTags(file.documentId, [...file.tags, tag]);
    } catch (err) {
      alert(errorText(err, "Error adding tag"));
    }
  };
  const removeTag = async (file: PropertyReport, tag: string) => {
    try {
      await realEstateService.removeReportTag(file.propertyUuid, file.documentId, tag);
      setTags(file.documentId, file.tags.filter((t) => t !== tag));
    } catch (err) {
      alert(errorText(err, "Error removing tag"));
    }
  };

  const send = async (request: PropertyReportRequest) => {
    setState({ kind: "sending" });
    try {
      await realEstateService.requestReport(request);
      setState({ kind: "queued" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && !request.force) setState({ kind: "conflict", request });
      else setState({ kind: "error", message: errorText(err, "Couldn't generate the report.") });
    }
  };
  const generate = (targetId: string) => {
    setGenerating(false);
    const target = propertyOf(targetId)?.name ?? "Property";
    const today = new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
    void send({ propertyUuid: targetId, name: `${target} — full report, ${today}` });
  };

  // An archived property takes no writes: no new report of it.
  const targets = properties
    .map((p, i) => ({ id: p.uuid, name: p.name, color: colorAt(i), archived: p.archived }))
    .filter((t) => !t.archived && (!propertyUuid || t.id === propertyUuid))
    .map(({ id, name, color }) => ({ id, name, color }));

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-[#C49A3C] transition-colors" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by file, property or tag…"
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
          <p className="text-sm text-slate-500 mt-1">Generate a property&apos;s full report, its whole history, as a PDF.</p>
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
                  cover={FULL_REPORT.cover}
                  kindLabel={FULL_REPORT.label}
                  ownerName={nameOf(f)}
                  color={colorOf(f)}
                  createdAt={f.createdAt}
                  tags={f.tags}
                  href={`/reports/properties/${f.propertyUuid}/${f.documentId}`}
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
          kinds={[FULL_REPORT]}
          targets={targets}
          targetLabel="Property"
          readOnly={readOnly}
          onClose={() => setGenerating(false)}
          onGenerate={(_, target) => generate(target.id)}
        />
      )}

      {state.kind !== "idle" && (
        <ReportRequestToast
          state={state}
          subject="property"
          onForce={() => state.kind === "conflict" && send({ ...state.request, force: true })}
          onClose={() => { setState({ kind: "idle" }); load(); }}
        />
      )}
    </>
  );
}
