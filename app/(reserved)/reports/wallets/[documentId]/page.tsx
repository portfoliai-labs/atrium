"use client";

import { useParams } from "next/navigation";
import { ReportViewer } from "../../../../components/dashboard/ReportViewer";
import { walletService } from "../../../../services/walletService";

// The wallets' report on its own page (the notifications' and the emails' link). The (reserved)
// layout lets only a signed-in user here, and scriba lets only its owner see it.
export default function WalletReportViewerPage() {
  const { documentId } = useParams<{ documentId: string }>();
  return (
    <ReportViewer
      fileKey={`wallets/${documentId}`}
      fetchUrl={() => walletService.reportDownloadUrl(documentId)}
    />
  );
}
