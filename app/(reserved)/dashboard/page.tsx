// app/(reserved)/dashboard/page.tsx
"use client";

import { useEffect, useState, useSyncExternalStore, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "../../context/UserContext";
import { usePortfolio } from "../../context/PortfolioContext";
import { DashboardHeader } from "../../components/dashboard/DashboardHeader";
import { Sidebar } from "../../components/dashboard/Sidebar";
import { FileUploader } from "../../components/dashboard/FileUploader";
import { ProfileSection } from "../../components/dashboard/ProfileSection";
import { AdvisorProfileSection } from "../../components/dashboard/AdvisorProfileSection";
import { ReportsList } from "../../components/dashboard/ReportsList";
import { ClientsSection } from "../../components/dashboard/ClientsSection";
import { AdvisorRequestsSection } from "../../components/dashboard/AdvisorRequestsSection";
import { MessagesSection } from "../../components/dashboard/MessagesSection";
import DashboardOverview from "../../components/dashboard/DashboardOverview";
import AdvisorDashboardOverview from "../../components/dashboard/AdvisorDashboardOverview";
import { SettingsSection } from "../../components/dashboard/SettingsSection";
import { SubscriptionPage } from "../../components/dashboard/SubscriptionPage";
import { MyProfileSection } from "../../components/dashboard/MyProfileSection";
import { NotificationsSection } from "../../components/dashboard/NotificationsSection";
import { InvestmentsSection } from "../../components/dashboard/InvestmentsSection";
import { StrategiesSection, isStrategiesView, strategiesViewOf } from "../../components/dashboard/StrategiesSection";
import { JournalSection } from "../../components/dashboard/JournalSection";
import { NewsPageSection } from "../../components/dashboard/NewsSection";
import { WalletsSection } from "../../components/dashboard/wallets/WalletsSection";
import { RealEstateSection } from "../../components/dashboard/realEstate/RealEstateSection";
import { AssetSection } from "../../components/dashboard/AssetSection";
import { SectionTrailProvider } from "../../components/dashboard/SectionTrail";
import { Loader2 } from "lucide-react";
import { DemoBanner } from "../../components/preview/DemoBanner";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";
import {
  ASSET_SECTION, CLIENTS_SECTION, EXPLORE_SECTION, INVESTMENTS_SECTION, JOURNAL_SECTION, NEWS_SECTION, PLAN_SECTION,
  PROFILE_SECTION, REAL_ESTATE_SECTION, STRATEGIES_SECTION, WALLETS_SECTION, SUBSCRIPTION_SECTION, DashboardPageContext, openPortfolioPage,
} from "../../lib/dashboardNav";

// 'reports' and 'profile' are omitted here on purpose: neither investors nor advisors have a
// sidebar entry for them anymore (Reports and Profile are hidden for now, Profile's
// language/currency moved into Settings), so a stale deep link should fall back to overview
// rather than open them.
// 'performance' is the investor's Investments (once Wealth; an advisor's Insights).
// Some are gone, kept so a link or history entry to them lands on where their pages went (see
// relocate, below): 'discover' (its News, Journal and Explore), 'plan' (its Projection and Stress
// test are each portfolio's, its Strategy is Strategies), 'explore' (the strategies catalog, once,
// then the Journal and News together).
// Whether the Sidebar is drawn as its icons only (see Sidebar): kept on this browser, the page
// drawn again as it changes. Unreadable storage leaves it whole, and a change for this visit only.
const SIDEBAR_COLLAPSED_KEY = "atrium.sidebar.collapsed";
const sidebarListeners = new Set<() => void>();
let sidebarFallback = false;
const subscribeSidebar = (listener: () => void) => {
  sidebarListeners.add(listener);
  return () => { sidebarListeners.delete(listener); };
};
const readSidebarCollapsed = () => {
  try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"; } catch { return sidebarFallback; }
};
const writeSidebarCollapsed = (collapsed: boolean) => {
  sidebarFallback = collapsed;
  try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0"); } catch { /* sidebarFallback holds it */ }
  sidebarListeners.forEach((listener) => listener());
};

const VALID_SECTIONS = [
  'overview', 'clients', 'requests', 'advisor', 'messages', 'upload', INVESTMENTS_SECTION, WALLETS_SECTION, REAL_ESTATE_SECTION, STRATEGIES_SECTION, JOURNAL_SECTION,
  NEWS_SECTION, ASSET_SECTION, PROFILE_SECTION, SUBSCRIPTION_SECTION, 'settings', 'notifications', PLAN_SECTION, EXPLORE_SECTION, 'discover',
];
// Sections that became another, under a new name. A link or a history entry to the old one lands
// on the new.
const MOVED_SECTIONS: Record<string, string> = { blog: JOURNAL_SECTION };
const resolveSection = (section: string | null | undefined) => (section ? MOVED_SECTIONS[section] ?? section : section);

/**
 * Where a page of a section that's gone (or that's another's for this account) went: the section
 * and the page to open in place of the entry, or null when it's where it should be.
 * - Plan: its Projection and Stress test, the portfolio's own (the investments when it named none);
 *   the rest, Strategies.
 * - Strategies, and the old Explore's catalog pages: an advisor's own section; an investor's, under
 *   Investments.
 * - Explore: Strategies for its catalog's pages, the Journal or the News for theirs. Discover: the
 *   Journal or the News, or Strategies for its old Explore.
 * - Wealth's wallets and real estate: their own sections.
 * - An advisor's Transactions and Insights: each client's own pages (Clients); they have no
 *   wallets or real estate.
 */
function relocate(section: string, raw: unknown, isAdvisor: boolean): { section: string; view: unknown } | null {
  const view = (typeof raw === "object" && raw !== null ? raw : {}) as { kind?: string; page?: string; portfolio?: unknown };
  const strategies = (v: unknown) => isAdvisor
    ? { section: STRATEGIES_SECTION, view: strategiesViewOf(v) }
    : { section: INVESTMENTS_SECTION, view: { kind: "strategies", ...strategiesViewOf(v) } };
  switch (section) {
    case 'advisor':
      // Find an advisor is a page under Profile (an investor's).
      return isAdvisor ? { section: 'overview', view: undefined } : { section: PROFILE_SECTION, view: { page: "advisor" } };
    case 'upload':
      return isAdvisor ? { section: CLIENTS_SECTION, view: undefined } : null;
    case INVESTMENTS_SECTION:
      if (isAdvisor) return { section: CLIENTS_SECTION, view: undefined };
      if (view.kind === "wallet") return { section: WALLETS_SECTION, view };
      if (view.kind === "realEstate") return { section: REAL_ESTATE_SECTION, view };
      return null;
    case WALLETS_SECTION:
    case REAL_ESTATE_SECTION:
      return isAdvisor ? { section: 'overview', view: undefined } : null;
    case PLAN_SECTION:
      if (!isAdvisor && (view.page === "projection" || view.page === "stress")) {
        return { section: INVESTMENTS_SECTION, view: { kind: "portfolio", uuid: typeof view.portfolio === "string" ? view.portfolio : "", page: view.page } };
      }
      return strategies(view);
    case STRATEGIES_SECTION:
      return isAdvisor ? null : strategies(view);
    case EXPLORE_SECTION:
      if (isStrategiesView(view)) return strategies(view);
      return view.page === "news" ? { section: NEWS_SECTION, view: undefined } : { section: JOURNAL_SECTION, view: raw };
    case 'discover':
      if (isAdvisor || view.page === "explore") return strategies(view);
      return view.page === "journal" ? { section: JOURNAL_SECTION, view: raw } : { section: NEWS_SECTION, view: undefined };
    default:
      return null;
  }
}

/**
 * DashboardPage - Main protected dashboard view.
 * It consumes UserContext to manage profile data and global loading states.
 * A demo account (see lib/demo) gets it read-only, with the preview features.
 */
function DashboardPageContent() {
  const { user, loading, logout, isDemo } = useUser();
  // Only meaningful for role USER (see PortfolioContext) — advisor sections resolve a
  // client's portfolio locally instead, so `current` stays null for an advisor and that's fine.
  const { current: portfolio, portfolios, loading: portfolioLoading } = usePortfolio();
  const searchParams = useSearchParams();
  // Lets links into the dashboard land on a specific tab via `?section=...` instead of
  // always resetting to overview.
  const requestedSection = resolveSection(searchParams.get('section'));

  // A reload keeps the history entry, and with it the section it was on (see lib/dashboardHistory).
  const [activeSection, setActiveSection] = useState<string>(() => {
    if (requestedSection && VALID_SECTIONS.includes(requestedSection)) return requestedSection;
    const fromHistory = resolveSection(readDashboardEntry()?.section);
    return fromHistory && VALID_SECTIONS.includes(fromHistory) ? fromHistory : 'overview';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  // On a wide screen, the Sidebar drawn as its icons only: the user's choice, kept on this browser.
  const sidebarCollapsed = useSyncExternalStore(subscribeSidebar, readSidebarCollapsed, () => false);
  const toggleSidebar = () => writeSidebarCollapsed(!sidebarCollapsed);
  // Bumped when the section already open is opened again (from the sidebar, or a link to one of
  // its pages), so a section with pages of its own (Portfolios' hub and what's under it) starts
  // over, as a fresh visit would.
  const [sectionVisit, setSectionVisit] = useState(0);

  // The browser's back and forward buttons move between sections too: each section opened is a
  // history entry, and landing on one shows its section (the section's own pages follow the
  // same entry, see InvestmentsSection).
  useEffect(() => {
    if (readDashboardEntry()?.section !== activeSection) pushDashboardEntry({ section: activeSection }, true);
    const onPopState = () => {
      const section = resolveSection(readDashboardEntry()?.section);
      if (section && VALID_SECTIONS.includes(section)) setActiveSection(section);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // Only the first entry is recorded here; later ones are pushed by showSection/openSection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showSection = (section: string) => {
    if (readDashboardEntry()?.section !== section) pushDashboardEntry({ section });
    setActiveSection(section);
  };
  const openSection = (section: string) => {
    if (section !== activeSection) {
      showSection(section);
      return;
    }
    // Opened again from where it already is: back to its first page, as a new entry unless
    // it's already there.
    const entry = readDashboardEntry();
    if (entry?.view || entry?.overlay) pushDashboardEntry({ section });
    setSectionVisit((n) => n + 1);
  };

  // A section on one of its pages, from its row in the Sidebar: a new entry holding the page,
  // which the section reads as it mounts afresh.
  const openPage = (section: string, view: unknown) => {
    pushDashboardEntry({ section, view });
    setActiveSection(section);
    setSectionVisit((n) => n + 1);
  };

  const isAdvisor = user?.role === 'ADVISOR';

  // Where an old section's page went, in place of its entry (see relocate).
  useEffect(() => {
    if (!user) return;
    const moved = relocate(activeSection, readDashboardEntry()?.view, isAdvisor);
    if (!moved) return;
    pushDashboardEntry({ section: moved.section, view: moved.view }, true);
    setActiveSection(moved.section);
  }, [user, isAdvisor, activeSection]);

  // An investor's transactions live in each portfolio's page now, so a link to the old
  // Transactions section (an "add transactions" empty state) opens the selected portfolio's (the
  // default's while a backtest or All portfolios is selected, where nothing can be added).
  const navigate = (section: string) => {
    if (section === 'upload' && !isAdvisor) {
      const target = portfolio && !portfolio.isVirtual ? portfolio : portfolios.find((p) => p.isDefault);
      if (target) openPortfolioPage(openSection, target.uuid, 'transactions');
      return;
    }
    showSection(resolveSection(section) ?? section);
  };

  const renderContent = (() => {
    // Every investor-facing case below needs a resolved portfolio; advisor cases never read
    // `portfolio` (a client's pages have a PortfolioProvider of that client's, see ClientsSection),
    // so this guard only ever blocks the investor branches while PortfolioContext is still loading.
    if (!isAdvisor && !portfolio) return null;

    switch (activeSection) {
      case 'overview':
        return isAdvisor
          ? <AdvisorDashboardOverview onNavigate={navigate} />
          : <DashboardOverview onNavigate={navigate} />;
      case 'clients':
        return isAdvisor ? <ClientsSection key={sectionVisit} onNavigate={navigate} /> : <DashboardOverview onNavigate={navigate} />;
      case 'requests':
        return isAdvisor ? <AdvisorRequestsSection /> : null;
      case 'advisor':
        // Until it lands on its page under Profile (see relocate).
        return null;
      case PROFILE_SECTION:
        return <MyProfileSection key={sectionVisit} />;
      case 'messages':
        return <MessagesSection key={sectionVisit} />;
      case 'upload':
        // Every portfolio at once: the list filters by portfolio, and new rows say where they go.
        // An advisor's is each client's portfolio's, see above.
        return isAdvisor ? null : <FileUploader />;
      case 'reports':
        return isAdvisor ? <AdvisorDashboardOverview onNavigate={navigate} /> : <ReportsList portfolioUuid={portfolio!.uuid} />;
      case INVESTMENTS_SECTION:
        // An advisor's Insights are each client's portfolio's (see relocate).
        return isAdvisor ? null : <InvestmentsSection key={sectionVisit} onNavigate={navigate} />;
      case WALLETS_SECTION:
        return isAdvisor ? null : <WalletsSection key={sectionVisit} />;
      case REAL_ESTATE_SECTION:
        return isAdvisor ? null : <RealEstateSection key={sectionVisit} />;
      case STRATEGIES_SECTION:
        // An advisor's: their strategies, to adopt on clients' portfolios or publish, and the
        // catalog. An investor's is Investments', where it lands (see relocate).
        return isAdvisor ? <StrategiesSection key={sectionVisit} onNavigate={navigate} /> : null;
      case JOURNAL_SECTION:
        return <JournalSection key={sectionVisit} />;
      case NEWS_SECTION:
        return <NewsPageSection />;
      case PLAN_SECTION:
      case EXPLORE_SECTION:
        // Until it lands where its pages went (see relocate).
        return null;
      case ASSET_SECTION:
        // The investor's position in the portfolio selected, when they hold it there; an advisor
        // has none of their own to read it in.
        return <AssetSection portfolioUuid={isAdvisor ? undefined : portfolio?.uuid} />;
      case 'discover':
        // Until it lands where its page went (see relocate).
        return null;
      case 'profile':
        return isAdvisor ? <AdvisorProfileSection /> : <ProfileSection />;
      case 'settings':
        return <SettingsSection />;
      case SUBSCRIPTION_SECTION:
        return <SubscriptionPage />;
      case 'notifications':
        return <NotificationsSection onOpenPage={openPage} />;
      default:
        return <DashboardOverview onNavigate={navigate} />;
    }
  })();

  // An advisor's own portfolios are their backtests, which the Dashboard and Strategy list.
  if (loading || portfolioLoading) {
    return (
      <div className="min-h-screen bg-[#F7F5EF] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#C49A3C]" />
          <p className="text-[#78716c] font-medium animate-pulse">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // If loading is finished but there is no user, the layout/context 
  // protection will typically handle the redirect.
  if (!user) return null;

  return (
    // SectionTrailProvider: a section's inner pages show up in the Sidebar (see SectionTrail).
    <SectionTrailProvider>
    <div className="min-h-screen bg-[#F7F5EF] flex flex-col selection:bg-[#C49A3C]/20 selection:text-[#1c1917]">
      <DashboardHeader
        onLogout={logout}
        isMenuOpen={isSidebarOpen}
        onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        subscriptionTier={user.subscription_tier}
        onNavigate={navigate}
        onOpenPage={openPage}
      />

      {/* The window scrolls the page (the header above is sticky to it), so nothing between it
          and the content may be a scroll container: one that never scrolls would pin every
          sticky element inside it (Insights' section timeline) in place.
          Hence overflow-x-clip here rather than overflow-hidden, and no overflow on <main>. */}
      <div className="flex flex-1 overflow-x-clip">
        <Sidebar
          activeSection={activeSection}
          setActiveSection={openSection}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          role={user?.role}
          subscriptionTier={user.subscription_tier}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
        />

        <main className={`flex-1 min-w-0 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-80"} bg-[#F7F5EF] p-4 md:p-8 transition-all duration-300`}>
          {/* As wide again as the Sidebar gives up when it's narrow (15rem): the modules grow with it. */}
          <div className={`${sidebarCollapsed ? "lg:max-w-[79rem]" : ""} max-w-5xl mx-auto transition-[max-width] animate-in fade-in slide-in-from-bottom-4 duration-700`}>
            {isDemo && <DemoBanner />}
            <DashboardPageContext.Provider value={openPage}>{renderContent}</DashboardPageContext.Provider>
          </div>
        </main>
      </div>
    </div>
    </SectionTrailProvider>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F7F5EF] flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#C49A3C]" />
        </div>
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}