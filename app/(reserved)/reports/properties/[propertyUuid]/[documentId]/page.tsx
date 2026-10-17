"use client";

import { useParams } from "next/navigation";
import { ReportViewer } from "../../../../../components/dashboard/ReportViewer";
import { realEstateService } from "../../../../../services/realEstateService";

// A property's report on its own page (the notifications' and the emails' link). The (reserved)
// layout lets only a signed-in user here, and praedium lets only the property's owner see it.
export default function PropertyReportViewerPage() {
  const { propertyUuid, documentId } = useParams<{ propertyUuid: string; documentId: string }>();
  return (
    <ReportViewer
      fileKey={`${propertyUuid}/${documentId}`}
      fetchUrl={() => realEstateService.reportDownloadUrl(propertyUuid, documentId)}
    />
  );
}
