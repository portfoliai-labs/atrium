// app/(reserved)/dashboard/bank-link/page.tsx
"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Landmark, Loader2 } from "lucide-react";
import { useUser } from "../../../context/UserContext";
import { bankingService } from "../../../services/bankingService";
import { errorText } from "../../../lib/wallets";

// Where the user goes once the link is done: Settings' Banks, to choose each account's wallet.
const BANKS_PAGE = "/dashboard?section=settings&settingsTab=banks";

/**
 * BANK LINK — the page the bank sends the user back to after the consent (registered with the open
 * banking aggregator: arca's `[banking] REDIRECT_URL`), with `state` and `code`, or an `error` when
 * the consent wasn't given. The link is completed once, then the user lands on the Banks page.
 */
function BankLinkContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, loading } = useUser();
  const [failure, setFailure] = useState<string | null>(null);
  // The code is single use: completed once, React's double effect in development included.
  const sent = useRef(false);

  const state = params.get("state");
  const code = params.get("code");
  const refused = params.get("error");

  useEffect(() => {
    if (loading || !user || sent.current) return;
    if (refused || !state || !code) return;
    sent.current = true;
    bankingService.complete(state, code)
      .then(() => router.replace(BANKS_PAGE))
      .catch((err) => setFailure(errorText(err, "Unable to finish linking the bank.")));
  }, [loading, user, state, code, refused, router]);

  const problem = refused
    ? "The bank didn't give the consent, so nothing was linked."
    : !state || !code
      ? "This page is where your bank sends you back: nothing to link here."
      : failure;

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FBFAF6] p-6">
      <section className="w-full max-w-md bg-white rounded-4xl border border-[#EEE9DD] p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#C49A3C]/10 text-[#C49A3C] flex items-center justify-center">
          <Landmark className="h-6 w-6" />
        </div>
        {problem ? (
          <>
            <p className="text-lg font-black text-slate-900">Bank not linked</p>
            <p className="text-[13px] text-slate-500">{problem}</p>
            <Link href={BANKS_PAGE} className="inline-flex px-5 py-3 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors">
              Back to your banks
            </Link>
          </>
        ) : (
          <>
            <p className="text-lg font-black text-slate-900">Linking your bank…</p>
            <Loader2 className="mx-auto h-6 w-6 text-[#C49A3C] animate-spin" />
          </>
        )}
      </section>
    </main>
  );
}

export default function BankLinkPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><Loader2 className="h-8 w-8 text-[#C49A3C] animate-spin" /></div>}>
      <BankLinkContent />
    </Suspense>
  );
}
