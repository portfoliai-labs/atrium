"use client";

import { Sparkles } from "lucide-react";
import { useUser } from "../../../context/UserContext";
import { readDashboardEntry } from "../../../lib/dashboardHistory";
import { ASSET_SECTION, INVESTMENTS_SECTION, REAL_ESTATE_SECTION, WALLETS_SECTION, aiChatView, useOpenDashboardPage } from "../../../lib/dashboardNav";

// The page a widget is on, for the question: the sections whose widgets show the user's own data.
const PAGE_NAMES: Record<string, string> = {
  overview: "Dashboard",
  [INVESTMENTS_SECTION]: "Investments",
  [WALLETS_SECTION]: "Wallets",
  [REAL_ESTATE_SECTION]: "Real estate",
  [ASSET_SECTION]: "security",
};

/**
 * AI HELP — on a widget's heading: asks the AI assistant what the widget is saying, in a new chat
 * in Messages, sent at once. The assistant reads the user's data itself; the question names the
 * widget, the page it's on and what it shows. Only in the dashboard, and only for an investor's
 * own data: not on a demo account (no assistant), nor an advisor's (a client's pages aren't
 * theirs to read).
 */
export function AiHelpButton({ title, desc, className = "" }: { title: string; desc?: string; className?: string }) {
  const openPage = useOpenDashboardPage();
  const { user, isDemo } = useUser();
  if (!openPage || isDemo || user?.role === "ADVISOR") return null;

  const ask = (e: React.MouseEvent) => {
    // A heading that opens the widget's detail view stays put.
    e.stopPropagation();
    const page = PAGE_NAMES[readDashboardEntry()?.section ?? ""];
    const question = `Help me understand the "${title}" widget${page ? ` on my ${page} page` : ""}`
      + `${desc ? ` (what it shows: ${desc.replace(/\.$/, "")})` : ""}. `
      + "What is it telling me about my data, and what should I pay attention to?";
    openPage("messages", aiChatView(question));
  };

  return (
    <button
      type="button"
      onClick={ask}
      title="Ask the AI about this"
      aria-label={`Ask the AI about ${title}`}
      className={`shrink-0 h-6 w-6 rounded-full inline-flex items-center justify-center text-[#C49A3C] hover:bg-[#C49A3C]/10 outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40 transition-colors ${className}`}
    >
      <Sparkles className="h-3.5 w-3.5" />
    </button>
  );
}
