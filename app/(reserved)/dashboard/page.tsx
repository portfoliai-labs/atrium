// app/(reserved)/dashboard/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
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
import { AdvisorMatchSection } from "../../components/dashboard/AdvisorMatchSection";
import { AdvisorRequestsSection } from "../../components/dashboard/AdvisorRequestsSection";
import DashboardOverview from "../../components/dashboard/DashboardOverview";
import AdvisorDashboardOverview from "../../components/dashboard/AdvisorDashboardOverview";
import { SettingsSection } from "../../components/dashboard/SettingsSection";
import { NotificationsSection } from "../../components/dashboard/NotificationsSection";
import { NewsPageSection } from "../../components/dashboard/NewsSection";
import { WealthSection } from "../../components/dashboard/WealthSection";
import { PlanSection } from "../../components/dashboard/PlanSection";
import { JournalSection } from "../../components/dashboard/JournalSection";
import { AssetSection } from "../../components/dashboard/AssetSection";
import { SectionTrailProvider } from "../../components/dashboard/SectionTrail";
import { Loader2 } from "lucide-react";
import { DemoBanner } from "../../components/preview/DemoBanner";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";
import { ASSET_SECTION, CLIENTS_SECTION, EXPLORE_SECTION, JOURNAL_SECTION, PLAN_SECTION, WEALTH_SECTION, openPortfolioPage } from "../../lib/dashboardNav";

// 'reports' and 'profile' are omitted here on purpose: neither investors nor advisors have a
// sidebar entry for them anymore (Reports and Profile are hidden for now, Profile's
// language/currency moved into Settings), so a stale deep link should fall back to overview
// rather than open them.
// 'performance' is the investor's Wealth (an advisor's Insights).
// 'discover' is gone (its News, Journal and Explore are sections, or Plan's, again): kept so a link
// or history entry to it lands on where its page went, see below.
const VALID_SECTIONS = ['overview', 'clients', 'requests', 'advisor', 'upload', 'performance', 'plan', 'news', EXPLORE_SECTION, JOURNAL_SECTION, ASSET_SECTION, 'discover', 'settings', 'notifications'];
// Sections that became part of another: the Wallets are Wealth's. A link or a history entry to the
// old one lands on the new. (An investor's Explore is Plan's, see below.)
const MOVED_SECTIONS: Record<string, string> = { blog: JOURNAL_SECTION, wallets: WEALTH_SECTION };
const resolveSection = (section: string | null | undefined) => (section ? MOVED_SECTIONS[section] ?? section : section);

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
  // Bumped when the section already open is opened again (from the sidebar, or a link to one of
  // its pages), so a section with pages of its own (Portfolios' hub and what's under it) starts
  // over, as a fresh visit would.
  const [sectionVisit, setSectionVisit] = useState(0);

  // The browser's back and forward buttons move between sections too: each section opened is a
  // history entry, and landing on one shows its section (the section's own pages follow the
  // same entry, see WealthSection).
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

  // Where an old section's pages went: Discover's (an advisor's was Explore only) and Explore,
  // under Plan's Strategy, the strategy open in it staying open; an advisor's Transactions and
  // Insights, each client's own pages now (the Clients section).
  useEffect(() => {
    if (!user) return;
    if (isAdvisor && (activeSection === 'upload' || activeSection === 'performance')) {
      pushDashboardEntry({ section: CLIENTS_SECTION }, true);
      setActiveSection(CLIENTS_SECTION);
      return;
    }
    const isExplore = activeSection === EXPLORE_SECTION;
    if (activeSection !== 'discover' && !isExplore) return;
    const view = readDashboardEntry()?.view as { page?: string; publicationId?: string; slug?: string } | undefined;
    const page = isExplore || isAdvisor ? 'explore' : view?.page;
    const publicationId = typeof view?.publicationId === 'string' ? view.publicationId : undefined;
    const [section, next]: [string, unknown] =
      page === 'explore'
        ? [PLAN_SECTION, { page: 'explore', ...(publicationId ? { publicationId } : {}) }]
        : page === 'journal' ? [JOURNAL_SECTION, view] : ['news', undefined];
    pushDashboardEntry({ section, view: next }, true);
    setActiveSection(section);
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
        return isAdvisor ? null : <AdvisorMatchSection onNavigate={navigate} />;
      case 'upload':
        // Every portfolio at once: the list filters by portfolio, and new rows say where they go.
        // An advisor's is each client's portfolio's, see above.
        return isAdvisor ? null : <FileUploader />;
      case 'reports':
        return isAdvisor ? <AdvisorDashboardOverview onNavigate={navigate} /> : <ReportsList portfolioUuid={portfolio!.uuid} />;
      case 'performance':
        // An advisor's Insights are each client's portfolio's, see above.
        return isAdvisor ? null : <WealthSection key={sectionVisit} onNavigate={navigate} />;
      case 'plan':
        // An advisor's is Strategy only: their backtests, to adopt on clients' portfolios or publish.
        return <PlanSection key={sectionVisit} onNavigate={navigate} />;
      case 'news':
        return <NewsPageSection />;
      case EXPLORE_SECTION:
        // Until it lands on Plan's, see above.
        return null;
      case JOURNAL_SECTION:
        return <JournalSection key={sectionVisit} />;
      case ASSET_SECTION:
        // The investor's position in the portfolio selected, when they hold it there; an advisor
        // has none of their own to read it in.
        return <AssetSection portfolioUuid={isAdvisor ? undefined : portfolio?.uuid} />;
      case 'discover':
        // Until it lands where its page went, see above.
        return null;
      case 'profile':
        return isAdvisor ? <AdvisorProfileSection /> : <ProfileSection />;
      case 'settings':
        return <SettingsSection />;
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
          onOpenPage={openPage}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          role={user?.role}
          subscriptionTier={user.subscription_tier}
        />

        <main className="flex-1 min-w-0 lg:ml-80 bg-[#F7F5EF] p-4 md:p-8 transition-all duration-300">
          <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            {isDemo && <DemoBanner />}
            {renderContent}
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