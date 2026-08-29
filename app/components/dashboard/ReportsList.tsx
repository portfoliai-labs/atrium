"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FileText, Download, Search, Tag as TagIcon,
  Loader2, AlertCircle, X, Eye, Plus, Check, Calendar, LayoutGrid,
  Sparkles, ArrowRight, CalendarRange, PlusCircle,
} from "lucide-react";
import { reportService } from "../../services/reportService";
import { userService } from "../../services/userService";
import { transactionService } from "../../services/transactionService";
import { useNotificationsContext } from "../../context/NotificationsContext";
import { buildReportName } from "../../lib/format";
import type { Document, ReportType } from "../../models/Report";
import type { UserMetrics, SubscriptionResponse } from "../../models/User";

// What the archive shows instead of a raw filename/timestamp: the period a report
// actually covers, plus a coarse type badge inferred from that period's length (the
// backend only tells us report_type FULL/PERIODIC + exact dates, not "monthly" vs
// "quarterly" — that bucketing is derived here). Returns null when report_type/period
// are unknown (old records without a resolvable job), so callers can fall back to
// created_at-based display for those.
function describeReportPeriod(report: Document): { title: string; badge: string } | null {
  if (report.report_type === "FULL") {
    return { title: "Full analysis", badge: "Full" };
  }
  if (report.report_type === "PERIODIC" && report.period_start && report.period_end) {
    const start = new Date(report.period_start);
    const end = new Date(report.period_end);
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);

    const lastDayOfStartMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const isFullCalendarMonth =
      start.getDate() === 1 &&
      end.getFullYear() === start.getFullYear() &&
      end.getMonth() === start.getMonth() &&
      end.getDate() === lastDayOfStartMonth;
    if (isFullCalendarMonth) {
      return { title: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }), badge: "Monthly" };
    }

    if (start.getDate() === 1 && days >= 89 && days <= 92) {
      return { title: `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`, badge: "Quarterly" };
    }

    if (start.getMonth() === 0 && start.getDate() === 1 && days >= 364 && days <= 366) {
      return { title: `${start.getFullYear()}`, badge: "Yearly" };
    }

    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return { title: `${fmt(start)} – ${fmt(end)}`, badge: "Custom range" };
  }
  return null;
}

type Preset = "LAST_MONTH" | "LAST_QUARTER" | "CURRENT_YEAR" | "FULL" | "CUSTOM";

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

// Turns a generation preset into the actual request shape processReport() expects.
// Month/quarter math relies on the Date constructor normalizing out-of-range values
// (e.g. month -1 rolls back into the previous year), so no special-casing is needed
// at year boundaries.
function presetToPeriod(
  preset: Preset,
  custom: { start: string; end: string },
): { reportType: ReportType; periodStart?: string; periodEnd?: string } {
  const today = new Date();

  if (preset === "FULL") return { reportType: "FULL" };
  if (preset === "CUSTOM") return { reportType: "PERIODIC", periodStart: custom.start, periodEnd: custom.end };

  if (preset === "LAST_MONTH") {
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return { reportType: "PERIODIC", periodStart: toISODate(start), periodEnd: toISODate(end) };
  }

  if (preset === "LAST_QUARTER") {
    const currentQuarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    const start = new Date(today.getFullYear(), currentQuarterStartMonth - 3, 1);
    const end = new Date(today.getFullYear(), currentQuarterStartMonth, 0);
    return { reportType: "PERIODIC", periodStart: toISODate(start), periodEnd: toISODate(end) };
  }

  // CURRENT_YEAR
  const start = new Date(today.getFullYear(), 0, 1);
  return { reportType: "PERIODIC", periodStart: toISODate(start), periodEnd: toISODate(today) };
}

const PRESET_OPTIONS: { value: Preset; label: string }[] = [
  { value: "LAST_MONTH", label: "Last month" },
  { value: "LAST_QUARTER", label: "Last quarter" },
  { value: "CURRENT_YEAR", label: "Current year" },
  { value: "FULL", label: "Full history" },
  { value: "CUSTOM", label: "Custom range" },
];

// --- INTERFACES ---

/**
 * Props for the individual Document Card component
 */
interface DocumentCardProps {
  report: Document;
  onDownload: (docId: string, fileName: string) => void;
  onView: (docId: string) => void;
  onRemoveTag: (docId: string, tagName: string) => void;
  onAddTag: (docId: string) => void;
  taggingDocId: string | null;
  setTaggingDocId: (docId: string | null) => void;
  newTagName: string;
  setNewTagName: (name: string) => void;
}

export function ReportsList({
  forUserUuid,
  onNavigate,
}: {
  forUserUuid?: string | null;
  onNavigate?: (section: string) => void;
} = {}) {
  const [reports, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // UI & Filtering States
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grouped">("list");

  // Tagging Logic States
  const [taggingDocId, setTaggingDocId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState<string>("");

  // Report-generation state — only relevant for a user's own archive (forUserUuid
  // unset), never when an advisor is browsing a client's reports.
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [hasTransactions, setHasTransactions] = useState<boolean | null>(null);
  // Optimistic client-side flag: flips true the instant a SUCCESS notification arrives, so
  // regular users see the trigger disappear immediately without waiting on a metrics
  // refetch (which may lag the notification by a beat). Ignored for testers, who keep it.
  const [firstReportGenerated, setFirstReportGenerated] = useState(false);
  const [isReportPending, setIsReportPending] = useState(false);
  const [pendingKind, setPendingKind] = useState<"FULL" | "PERIODIC" | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  // "+ New report" opens a modal instead of a permanently docked panel — the trigger
  // itself is used rarely (a handful of times a year at most once auto-generation is
  // in place), so it shouldn't cost a full card's worth of vertical space at all times.
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [preset, setPreset] = useState<Preset>("LAST_MONTH");
  // Custom time range, only used when preset === "CUSTOM" — defaults to the last 30 days
  // so the fields aren't empty, but either end can be adjusted before generating.
  const [rangeStart, setRangeStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [rangeEnd, setRangeEnd] = useState(() => new Date().toISOString().slice(0, 10));
  // Only notifications created at/after this instant count as "ours" — avoids reacting to
  // a stale, already-read notification from a previous job.
  const watchSinceRef = useRef<number>(0);
  const { notifications } = useNotificationsContext();

  /**
   * Fetches all documents from the backend on component mount
   */
  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reportService.getAllDocuments(forUserUuid);
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sync with server";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (forUserUuid) return;
    const fetchPanelData = async () => {
      try {
        const [userMetrics, userSubscription, transactions] = await Promise.all([
          userService.getUserMetrics(),
          userService.getSubscription(),
          transactionService.getUserTransactions(undefined, 1, 0),
        ]);
        setMetrics(userMetrics);
        setSubscription(userSubscription);
        setHasTransactions(transactions.total > 0);
        // A report was already kicked off before this component mounted (e.g. page reload
        // mid-generation) — start watching for its completion notification too.
        if (userMetrics.report_in_progress > 0) {
          watchSinceRef.current = Date.now();
          setIsReportPending(true);
        }
      } catch (err) {
        console.error("Failed to fetch report generation panel data:", err);
      }
    };
    fetchPanelData();
  }, [forUserUuid]);

  // Unlocks as soon as a job-status notification (success or failure) shows up for the
  // report we're watching — no reliance on re-fetching /users/metrics. On success, also
  // refreshes the archive so the freshly generated report shows up right away.
  useEffect(() => {
    if (!isReportPending) return;
    const completed = notifications.find(n => {
      const jobStatus = (n.payload as Record<string, unknown> | undefined)?.status;
      if (jobStatus !== "SUCCESS" && jobStatus !== "FAILED") return false;
      return new Date(n.created_at).getTime() >= watchSinceRef.current;
    });
    if (!completed) return;
    setIsReportPending(false);
    setPendingKind(null);
    const jobStatus = (completed.payload as Record<string, unknown> | undefined)?.status;
    if (jobStatus === "SUCCESS") {
      setFirstReportGenerated(true);
      loadDocuments();
    } else {
      setReportError("Report generation failed. Please try again.");
    }
  }, [notifications, isReportPending]);

  const handleGenerateReport = async (selectedPreset: Preset) => {
    if (isReportPending) return;
    const period = presetToPeriod(selectedPreset, { start: rangeStart, end: rangeEnd });
    if (period.reportType === "PERIODIC" && (!period.periodStart || !period.periodEnd || period.periodStart > period.periodEnd)) return;
    watchSinceRef.current = Date.now();
    setIsReportPending(true);
    setPendingKind(period.reportType);
    setReportError(null);
    try {
      if (period.reportType === "FULL") {
        await reportService.processReport(buildReportName(), forUserUuid);
      } else {
        await reportService.processReport(buildReportName(), forUserUuid, {
          reportType: "PERIODIC",
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
        });
      }
      setShowGenerateModal(false);
    } catch (err) {
      setIsReportPending(false);
      setPendingKind(null);
      setReportError(err instanceof Error ? err.message : "Failed to start report generation.");
    }
  };

  const isTester = subscription?.tier === "TESTER";
  const hasEverGeneratedReport = firstReportGenerated || (metrics?.report_generated ?? 0) > 0;
  // `metrics === null` (fetch still in flight, failed, or this is an advisor viewing a
  // client's archive) deliberately keeps the trigger hidden rather than flashing it.
  const showGenerateTrigger = !forUserUuid && metrics !== null && (isTester || !hasEverGeneratedReport);
  // Testers (and any other unlimited-report plan) never hit the monthly cap, regardless of
  // what reports_remaining happens to read — matches the exhausted check already used in
  // SettingsSection/SubscriptionPopover.
  const unlimitedReports = subscription?.has_unlimited_reports ?? false;
  const reportsExhausted = !unlimitedReports && metrics?.reports_remaining !== null && metrics?.reports_remaining !== undefined && metrics.reports_remaining <= 0;

  // --- ACTIONS ---

  // Opens the standalone viewer route (app/(reserved)/reports/[documentId])
  // instead of a throwaway blob URL.
  const handleView = (docId: string) => {
    window.open(`/reports/${docId}`, "_blank");
  };

  const handleDownload = async (docId: string, fileName: string) => {
    try {
      // Step 1: Request the short-lived signed URL from the backend
      const { url } = await reportService.downloadReport(docId);

      if (!url) throw new Error("Invalid URL received from server");

      // Step 2: Fetch the file data
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not fetch file data from storage");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Step 3: Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      link.download = cleanFileName;
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup DOM and Memory
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Download failed";
      alert(`Error: ${msg}`);
    }
  };

  const handleAddTag = async (docId: string) => {
    if (!newTagName.trim()) return;
    try {
      await reportService.addTag(docId, newTagName.trim());
      setDocuments(prev => prev.map(r => 
        r.document_id === docId ? { ...r, tags: [...(r.tags || []), newTagName.trim()] } : r
      ));
      setNewTagName("");
      setTaggingDocId(null);
    } catch (err: unknown) { 
      const errorMessage = err instanceof Error ? err.message : "Error adding tag";
      alert(errorMessage); 
    }
  };

  const handleRemoveTag = async (docId: string, tagName: string) => {
    try {
      await reportService.removeTag(docId, tagName);
      setDocuments(prev => prev.map(r => 
        r.document_id === docId ? { ...r, tags: (r.tags ?? []).filter((t: string) => t !== tagName) } : r
      ));
    } catch (err: unknown) { 
      const errorMessage = err instanceof Error ? err.message : "Error removing tag";
      alert(errorMessage); 
    }
  };

  // --- FILTERING & GROUPING LOGIC ---

  /**
   * Filters the reports based on the search input and selected tag. Matches against both
   * the raw filename and the computed period title ("July 2026", "Q2 2026", ...) — the
   * filename alone is often just a generation timestamp and rarely what someone searches for.
   */
  const filteredList = useMemo(() => {
    return reports.filter(r => {
      const haystack = `${r.name ?? ""} ${describeReportPeriod(r)?.title ?? ""}`.toLowerCase();
      const matchesSearch = haystack.includes(searchTerm.toLowerCase());
      const matchesTag = selectedTag ? r.tags?.includes(selectedTag) : true;
      return matchesSearch && matchesTag;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [reports, searchTerm, selectedTag]);

  /**
   * Groups filtered reports by their tags for the "By Tag" view
   */
  const groupedDocuments = useMemo(() => {
    const groups: Record<string, Document[]> = {};
    filteredList.forEach(report => {
      if (!report.tags || report.tags.length === 0) {
        groups["Untagged"] = [...(groups["Untagged"] || []), report];
      } else {
        report.tags.forEach((tag: string) => {
          groups[tag] = [...(groups[tag] || []), report];
        });
      }
    });
    return groups;
  }, [filteredList]);

  /**
   * Groups filtered reports for the default "By Period" view — by the period each report
   * actually covers, not by when it happened to be generated. Those two diverge as soon as
   * someone regenerates something or backfills old history, so grouping by created_at (the
   * previous behavior) would scatter a single year's reports across unrelated date buckets.
   * FULL reports get their own bucket first (no single period to sort them into); PERIODIC
   * ones are grouped by the year their period falls in, newest year first, newest period
   * first within a year. Reports with no resolvable report_type/period (old records) fall
   * back to a flat "Other reports" bucket, sorted by created_at like before.
   */
  const groupedByPeriod = useMemo(() => {
    const full: Document[] = [];
    const byYear = new Map<number, Document[]>();
    const unknown: Document[] = [];

    filteredList.forEach(report => {
      if (report.report_type === "FULL") {
        full.push(report);
      } else if (report.report_type === "PERIODIC" && report.period_start) {
        const year = new Date(report.period_start).getFullYear();
        const arr = byYear.get(year);
        if (arr) arr.push(report); else byYear.set(year, [report]);
      } else {
        unknown.push(report);
      }
    });

    const groups: { key: string; label: string; docs: Document[] }[] = [];
    if (full.length > 0) groups.push({ key: "full", label: "Full analyses", docs: full });
    [...byYear.keys()].sort((a, b) => b - a).forEach(year => {
      const docs = [...byYear.get(year)!].sort((a, b) => (b.period_start ?? "").localeCompare(a.period_start ?? ""));
      groups.push({ key: `year-${year}`, label: String(year), docs });
    });
    if (unknown.length > 0) groups.push({ key: "unknown", label: "Other reports", docs: unknown });
    return groups;
  }, [filteredList]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* Error Feedback */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row justify-between gap-6 xl:items-end">
        <div className="w-full xl:w-auto">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Reports</h2>
          <p className="text-sm md:text-base text-slate-500 font-medium mt-1">Manage, download, and organize your generated analyses.</p>

          <div className="flex items-center gap-3 mt-4">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="Search by name or period..."
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-300 transition-all shadow-sm text-slate-900"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* "+ New report" — a rarely-used action (a handful of times a year once
                auto-generation is in place) gets a compact trigger, not a docked panel.
                The modal closes as soon as generation starts (it can take minutes), so
                this button is the only persistent indicator left — it has to carry the
                pending state itself rather than just sitting there looking clickable. */}
            {showGenerateTrigger && (
              <button
                onClick={() => setShowGenerateModal(true)}
                disabled={isReportPending}
                className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-colors shadow-sm shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900"
              >
                {isReportPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                {isReportPending ? "Generating…" : "New report"}
              </button>
            )}
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex bg-slate-100/80 p-1.5 rounded-xl border border-slate-200 shrink-0 w-full md:w-auto">
          <button
            onClick={() => setViewMode("list")}
            className={`flex-1 md:flex-none flex justify-center items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "list" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Calendar className="h-4 w-4" /> By Period
          </button>
          <button
            onClick={() => setViewMode("grouped")}
            className={`flex-1 md:flex-none flex justify-center items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "grouped" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <LayoutGrid className="h-4 w-4" /> By Tag
          </button>
        </div>
      </div>

      {showGenerateModal && (
        <ReportGenerationModal
          isTester={isTester}
          hasTransactions={hasTransactions}
          isPending={isReportPending}
          pendingKind={pendingKind}
          isExhausted={reportsExhausted}
          error={reportError}
          preset={preset}
          onPresetChange={setPreset}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onRangeStartChange={setRangeStart}
          onRangeEndChange={setRangeEnd}
          onGenerate={() => handleGenerateReport(isTester ? preset : "FULL")}
          onNavigate={onNavigate}
          onClose={() => setShowGenerateModal(false)}
        />
      )}

      {/* Main List Rendering */}
      <div className="space-y-8">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white border border-slate-200 border-dashed rounded-[2rem]">
            <FileText className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">No reports found</h3>
            <p className="text-slate-500 mt-1">Upload files and generate a report to see it here.</p>
          </div>
        ) : viewMode === "list" ? (
          groupedByPeriod.map(({ key, label, docs }) => (
            <div key={key} className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                  <Calendar className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">{label}</h3>
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                  {docs.length} items
                </span>
              </div>
              <div className="grid gap-4">
                {docs.map(report => (
                  <DocumentCard
                    key={`${key}-${report.document_id}`}
                    report={report}
                    onDownload={handleDownload}
                    onView={handleView}
                    onRemoveTag={handleRemoveTag}
                    onAddTag={handleAddTag}
                    taggingDocId={taggingDocId}
                    setTaggingDocId={setTaggingDocId}
                    newTagName={newTagName}
                    setNewTagName={setNewTagName}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          Object.entries(groupedDocuments).map(([tag, docs]) => (
            <div key={`group-${tag}`} className="space-y-4 bg-slate-50/50 p-4 md:p-6 rounded-[2.5rem] border border-slate-100">
              <div className="flex items-center gap-3 px-2">
                <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                  <TagIcon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">{tag}</h3>
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                  {docs.length} items
                </span>
              </div>
              <div className="grid gap-4">
                {docs.map(report => (
                  <DocumentCard
                    key={`grouped-${tag}-${report.document_id}`}
                    report={report}
                    onDownload={handleDownload}
                    onView={handleView}
                    onRemoveTag={handleRemoveTag}
                    onAddTag={handleAddTag}
                    taggingDocId={taggingDocId}
                    setTaggingDocId={setTaggingDocId}
                    newTagName={newTagName}
                    setNewTagName={setNewTagName}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * REPORT GENERATION MODAL — replaces what used to be a permanently docked panel. The
 * trigger is used rarely (a handful of times a year once auto-generation is in place),
 * so it lives behind a compact "+ New report" button instead of sitting on screen at
 * all times. Regular users get a single one-shot confirmation (their first report is
 * always FULL); testers get the full preset picker plus a custom range, since they need
 * to trigger reports repeatedly to test the flow.
 */
function ReportGenerationModal({
  isTester, hasTransactions, isPending, pendingKind, isExhausted, error,
  preset, onPresetChange, rangeStart, rangeEnd, onRangeStartChange, onRangeEndChange,
  onGenerate, onNavigate, onClose,
}: {
  isTester: boolean;
  hasTransactions: boolean | null;
  isPending: boolean;
  pendingKind: "FULL" | "PERIODIC" | null;
  isExhausted: boolean;
  error: string | null;
  preset: Preset;
  onPresetChange: (value: Preset) => void;
  rangeStart: string;
  rangeEnd: string;
  onRangeStartChange: (value: string) => void;
  onRangeEndChange: (value: string) => void;
  onGenerate: () => void;
  onNavigate?: (section: string) => void;
  onClose: () => void;
}) {
  const canGenerate = hasTransactions === true;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const rangeInvalid = preset === "CUSTOM" && (!rangeStart || !rangeEnd || rangeStart > rangeEnd);

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-md w-full p-6 md:p-8 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#C49A3C]/10 rounded-xl">
              <Sparkles className="h-5 w-5 text-[#C49A3C]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {!canGenerate ? "Add your transactions first" : isTester ? "New report" : "Generate your first report"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {!isTester && canGenerate && "After this one, reports keep coming automatically."}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}

        {!canGenerate ? (
          <>
            <p className="text-sm text-slate-500 leading-relaxed">
              Record your transactions first so there&apos;s something to analyze, then come back here to generate a report.
            </p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => { onClose(); onNavigate?.("upload"); }}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-blue-600 transition-colors shadow-md shadow-slate-200"
              >
                Add transactions <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : isTester ? (
          <>
            <div className="space-y-2">
              {PRESET_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                    preset === opt.value ? "border-[#C49A3C] bg-[#C49A3C]/5" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="report-preset"
                    checked={preset === opt.value}
                    onChange={() => onPresetChange(opt.value)}
                    className="accent-[#C49A3C]"
                  />
                  <span className="text-sm font-bold text-slate-900">{opt.label}</span>
                </label>
              ))}
            </div>

            {preset === "CUSTOM" && (
              <div className="flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">From</label>
                  <input
                    type="date"
                    value={rangeStart}
                    max={rangeEnd || today}
                    onChange={(e) => onRangeStartChange(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-300 transition-all"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">To</label>
                  <input
                    type="date"
                    value={rangeEnd}
                    min={rangeStart}
                    max={today}
                    onChange={(e) => onRangeEndChange(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-300 transition-all"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors">
                Cancel
              </button>
              <button
                onClick={onGenerate}
                disabled={isPending || isExhausted || rangeInvalid}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-blue-600 transition-colors shadow-md shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarRange className="h-4 w-4" />}
                {isPending ? (pendingKind === "FULL" ? "Generating…" : "Generating…") : isExhausted ? "Monthly limit reached" : "Generate"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500 leading-relaxed">
              You&apos;ve recorded your transactions — generate your first report now. After this one, PortfoliAI takes over and keeps your reports up to date automatically, no action needed.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors">
                Cancel
              </button>
              <button
                onClick={onGenerate}
                disabled={isPending || isExhausted}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-blue-600 transition-colors shadow-md shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isPending ? "Generating…" : isExhausted ? "Monthly limit reached" : "Generate first report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

/**
 * DocumentCard: UI component for each document item
 */
function DocumentCard({
  report,
  onDownload,
  onView,
  onRemoveTag,
  onAddTag,
  taggingDocId,
  setTaggingDocId,
  newTagName,
  setNewTagName
}: DocumentCardProps) {
  const period = describeReportPeriod(report);
  const title = period?.title ?? report.name ?? "Untitled Document";
  const generatedAt = new Date(report.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="group flex flex-col md:flex-row md:items-center justify-between p-5 md:p-6 bg-white border border-slate-200/80 rounded-[2rem] hover:shadow-xl hover:shadow-slate-200/50 hover:border-blue-200 transition-all duration-300 gap-5 md:gap-0">

      {/* Visual Identity & Name */}
      <div className="flex items-start md:items-center gap-4 md:gap-6 w-full md:w-auto">
        <div className="bg-slate-50/80 text-slate-400 group-hover:bg-blue-600 group-hover:text-white p-4 md:p-5 rounded-2xl md:rounded-3xl transition-colors duration-300 shrink-0">
          <FileText className="h-6 w-6 md:h-8 md:w-8" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black text-lg md:text-xl text-slate-900 group-hover:text-blue-600 transition-colors truncate">
              {title}
            </h3>
            {period?.badge && (
              <span className="shrink-0 text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                {period.badge}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Generated {generatedAt}</p>

          {/* Tags List */}
          <div className="flex flex-wrap gap-2 mt-2 items-center">
            {report.tags?.map((tag: string, index: number) => (
              <span key={`${report.document_id}-${tag}-${index}`} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100">
                {tag}
                <X 
                  className="h-3 w-3 cursor-pointer text-blue-400 hover:text-rose-500 transition-colors" 
                  onClick={() => onRemoveTag(report.document_id, tag)} 
                />
              </span>
            ))}
            
            {/* Inline Add Tag Input */}
            {taggingDocId === report.document_id ? (
              <div className="flex items-center gap-1.5 animate-in fade-in zoom-in duration-200">
                <input 
                  autoFocus 
                  placeholder="Tag name..."
                  className="text-[10px] font-bold border border-blue-200 bg-blue-50/50 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/20 w-24" 
                  value={newTagName} 
                  onChange={(e) => setNewTagName(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && onAddTag(report.document_id)} 
                />
                <button 
                  onClick={() => onAddTag(report.document_id)} 
                  className="p-1.5 bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors"
                >
                  <Check className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setTaggingDocId(report.document_id)} 
                className="text-[10px] font-black text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-blue-200 transition-all flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> ADD TAG
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Primary Actions */}
      <div className="flex gap-2 md:gap-3 w-full md:w-auto mt-2 md:mt-0">
        <button
          onClick={() => onView(report.document_id)}
          className="flex-1 md:flex-none flex justify-center items-center px-6 py-3.5 text-sm font-bold uppercase tracking-wide bg-slate-50 text-slate-600 border border-slate-200 rounded-xl hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          // Trigger the secure download workflow
          onClick={() => onDownload(report.document_id, report.name)} 
          className="flex-1 md:flex-none flex justify-center items-center gap-2 px-6 py-3.5 text-sm font-bold uppercase tracking-wide bg-slate-900 text-white rounded-xl hover:bg-blue-600 shadow-md shadow-slate-200 hover:shadow-blue-200 transition-all"
        >
          <Download className="h-4 w-4" /> 
          <span className="md:hidden lg:inline">Download</span>
        </button>
      </div>
      
    </div>
  );
}