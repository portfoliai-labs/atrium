"use client";

import { useParams } from "next/navigation";
import { ReportViewer } from "../../../../components/dashboard/ReportViewer";
import { reportService } from "../../../../services/reportService";

// Shareable, auth-gated single-report view: the (reserved) layout's UserProvider
// already redirects unauthenticated visitors before this page can fetch anything,
// and the backend's /download endpoint is expected to scope documentId to its owner
// (or their advisor) within the given portfolioUuid.
export default function ReportViewerPage() {
  const { portfolioUuid, documentId } = useParams<{ portfolioUuid: string; documentId: string }>();
  return (
    <ReportViewer
      fileKey={`${portfolioUuid}/${documentId}`}
      fetchUrl={() => reportService.downloadReport(portfolioUuid, documentId)}
    />
  );
}
