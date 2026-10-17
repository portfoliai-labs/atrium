"use client";

import { useParams } from "next/navigation";
import { ReportViewer } from "../../../../../components/dashboard/ReportViewer";
import { walletService } from "../../../../../services/walletService";

// A wallet's report on its own page (the notifications' and the emails' link): `subject` is the
// wallet's uuid, or "all" (or the owner's own uuid, as the email has it) for all their wallets.
// The (reserved) layout lets only a signed-in user here, and arca lets only the owner see it.
export default function WalletReportViewerPage() {
  const { subject, documentId } = useParams<{ subject: string; documentId: string }>();
  return (
    <ReportViewer
      fileKey={`${subject}/${documentId}`}
      fetchUrl={() => walletService.reportDownloadUrl(subject, documentId)}
    />
  );
}
