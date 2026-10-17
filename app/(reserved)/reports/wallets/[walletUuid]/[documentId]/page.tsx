"use client";

import { useParams } from "next/navigation";
import { ReportViewer } from "../../../../../components/dashboard/ReportViewer";
import { walletService } from "../../../../../services/walletService";

// A wallet's report on its own page (the notifications' and the emails' link). The (reserved)
// layout lets only a signed-in user here, and arca lets only the wallet's owner see it.
export default function WalletReportViewerPage() {
  const { walletUuid, documentId } = useParams<{ walletUuid: string; documentId: string }>();
  return (
    <ReportViewer
      fileKey={`${walletUuid}/${documentId}`}
      fetchUrl={() => walletService.reportDownloadUrl(walletUuid, documentId)}
    />
  );
}
