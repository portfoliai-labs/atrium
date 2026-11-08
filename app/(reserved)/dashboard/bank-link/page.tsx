// app/(reserved)/dashboard/bank-link/page.tsx
"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Landmark, Loader2 } from "lucide-react";
import { useUser } from "../../../context/UserContext";
import { bankingService } from "../../../services/bankingService";
import { accountService } from "../../../services/accountService";
import { errorText } from "../../../lib/wallets";
import { accountPageUrl, syncTextFor, takeBankWallet, walletPageUrl } from "../../../components/dashboard/wallets/WalletBanks";

// Every account and wallet: where the user goes back to when nothing was linked, or when the
// link's account can't be found.
const WALLETS_PAGE = "/dashboard?section=wallets";

/** The page of the account a bank link makes (arca's, as the link completes), or every account's. */
async function linkPage(linkUuid: string) {
  const accounts = await accountService.list().catch(() => []);
  const account = accounts.find((a) => a.bankLinkUuid === linkUuid);
  return account ? accountPageUrl(account.uuid) : WALLETS_PAGE;
}

/**
 * BANK LINK — the page the bank sends the user back to after the consent (registered with the open
 * banking aggregator: arca's `[banking] REDIRECT_URL`), with `state` and `code`, or an `error` when
 * the consent wasn't given. The link is completed once, then the user lands on the account it made
 * (or renewed), where each of its accounts goes into a wallet of theirs or a new one; or,
 * connected from a wallet's page (takeBankWallet), on that wallet's, its account in it: the only
 * free one of its currency linked and read at once, or, with more, its bank dialog to choose.
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
    const pending = takeBankWallet();
    bankingService.complete(state, code)
      .then(async (link) => {
        if (!pending || pending.linkUuid !== link.uuid) return router.replace(await linkPage(link.uuid));
        const free = link.accounts.filter((a) => !a.walletUuid && a.currency === pending.currency);
        if (free.length !== 1) return router.replace(walletPageUrl(pending.walletUuid, true));
        try {
          await bankingService.linkAccount(free[0].uuid, pending.walletUuid);
          await syncTextFor(link.uuid, free[0].uuid);
          router.replace(walletPageUrl(pending.walletUuid));
        } catch {
          // Linked by hand then, from its dialog.
          router.replace(walletPageUrl(pending.walletUuid, true));
        }
      })
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
            <Link href={WALLETS_PAGE} className="inline-flex px-5 py-3 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors">
              Back to your accounts
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
