"use client";

import { LayoutDashboard, ChevronRight, Sparkles, Users, Newspaper, BookOpen, LineChart, Wallet, Building2, History, Inbox } from "lucide-react";
import { useUser } from "../../context/UserContext";
import { CLIENTS_SECTION, INVESTMENTS_SECTION, JOURNAL_SECTION, NEWS_SECTION, REAL_ESTATE_SECTION, STRATEGIES_SECTION, SUBSCRIPTION_SECTION, WALLETS_SECTION } from "../../lib/dashboardNav";
import { useWallets } from "../../context/WalletsContext";
import { useRealEstate } from "../../context/RealEstateContext";
import { UserRole, SubscriptionTier } from "../../models/User";

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  role?: UserRole;
  subscriptionTier?: SubscriptionTier | null;
}

type NavItem = { id: string; label: string; icon: typeof LayoutDashboard };

/**
 * SIDEBAR — the dashboard's sections, one row each. Nothing under them: a section's own pages
 * (a portfolio, a wallet, a property, a client) are opened from its page (All portfolios'
 * Portfolios, All wallets' Wallets, the properties' table, the clients' list).
 */
export function Sidebar({ activeSection, setActiveSection, isOpen = false, onClose, role, subscriptionTier }: SidebarProps) {
  const isAdvisor = role === 'ADVISOR';
  const { isDemo } = useUser();
  const { available: walletsAvailable } = useWallets();
  const { available: realEstateAvailable } = useRealEstate();
  // Wallets and Real estate only where the user has them (a backend with them, a demo account's
  // sample data).
  const hasWallets = isDemo || walletsAvailable;

  const journalItem: NavItem = { id: JOURNAL_SECTION, label: 'Journal', icon: BookOpen };
  const newsItem: NavItem = { id: NEWS_SECTION, label: 'News', icon: Newspaper };

  const investorItems: NavItem[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: INVESTMENTS_SECTION, label: 'Investments', icon: LineChart },
    ...(realEstateAvailable ? [{ id: REAL_ESTATE_SECTION, label: 'Real estate', icon: Building2 }] : []),
    ...(hasWallets ? [{ id: WALLETS_SECTION, label: 'Wallets', icon: Wallet }] : []),
    journalItem,
    newsItem,
  ];

  // A client's pages are the investor's, on the client's portfolios (see ClientsSection); the
  // advisor's strategies and the catalog are Strategies, a section of its own.
  const consultantItems: NavItem[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: CLIENTS_SECTION, label: 'Clients', icon: Users },
    { id: 'requests', label: 'Requests', icon: Inbox },
    { id: STRATEGIES_SECTION, label: 'Strategies', icon: History },
    journalItem,
    newsItem,
  ];

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    if (onClose) onClose();
  };

  const renderItem = (item: NavItem) => {
    const isActive = activeSection === item.id;
    return (
      <button
        key={item.id}
        onClick={() => handleNavClick(item.id)}
        className={`group relative flex items-center justify-between rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] px-4 py-3 ${
          isActive
            ? "bg-[#C49A3C]/15 text-[#C49A3C] border border-[#C49A3C]/30"
            : "text-[#a8a29e] hover:bg-white/5 hover:text-white border border-transparent"
        }`}
      >
        <div className="flex items-center gap-3">
          <item.icon className={`h-5 w-5 transition-transform duration-200 ${isActive ? "" : "group-hover:scale-110"}`} />
          <span className="text-sm">{item.label}</span>
        </div>
        {isActive && <ChevronRight className="h-4 w-4 opacity-50" />}
      </button>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-0 left-0 z-40
        w-80 bg-[#1c1917]
        flex flex-col h-screen
        transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        ${isOpen ? "pointer-events-auto" : "pointer-events-none lg:pointer-events-auto"}
      `}>

        <nav className="flex flex-col gap-1 p-5 pt-[100px] flex-1 overflow-y-auto custom-scrollbar">
          {(isAdvisor ? consultantItems : investorItems).map((item) => renderItem(item))}
        </nav>

        {/* Nothing to upgrade for a tester, nor for a demo account (see lib/demo). */}
        {subscriptionTier !== 'TESTER' && subscriptionTier !== 'DEMO' && (
          <div className="p-5 border-t border-white/10">
            <div className="bg-[#131210] p-5 rounded-[1.5rem] border border-[#C49A3C]/20 text-white relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#C49A3C]/10 blur-2xl rounded-full" />

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-[#C49A3C]" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#C49A3C]">Pro Version</p>
                </div>
                <p className="text-[13px] font-medium text-[#a8a29e] leading-tight mb-4">
                  Unlock unlimited analysis and a more advanced AI model.
                </p>
                <button
                  onClick={() => handleNavClick(SUBSCRIPTION_SECTION)}
                  className="w-full py-2.5 bg-[#C49A3C] text-[#131210] rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-[#d4aa4c] transition-colors"
                >
                  Upgrade Now
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
