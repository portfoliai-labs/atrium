"use client";

import { LayoutDashboard, Settings, ChevronRight, Sparkles, Users, Newspaper, BookOpen, LineChart, Wallet, Building2, History, Handshake, Inbox, MessagesSquare } from "lucide-react";
import { PreviewBadge } from "../preview/PreviewKit";
import { useUser } from "../../context/UserContext";
import { usePortfolio } from "../../context/PortfolioContext";
import { useDashboardEntry } from "../../lib/dashboardHistory";
import { CLIENTS_SECTION, INVESTMENTS_SECTION, JOURNAL_SECTION, NEWS_SECTION, REAL_ESTATE_SECTION, STRATEGIES_SECTION, WALLETS_SECTION } from "../../lib/dashboardNav";
import { clientDisplayName, useClients } from "../../context/ClientsContext";
import { useClientPortfolios } from "../../hooks/useClientPortfolios";
import { CATEGORICAL_PALETTE, portfolioColorMap } from "../../lib/chartColors";
import { useWallets } from "../../context/WalletsContext";
import { useRealEstate } from "../../context/RealEstateContext";
import { ALL_WALLETS, KIND_LABELS, walletColor } from "../../lib/wallets";
import { journalRowOf, type JournalView } from "./JournalSection";
import { useJournal } from "../../context/JournalContext";
import { UserRole, SubscriptionTier } from "../../models/User";

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  // Opens a section on one of its pages (a row under it: a portfolio, a wallet, Saved articles…).
  onOpenPage?: (section: string, view: unknown) => void;
  isOpen?: boolean;
  onClose?: () => void;
  role?: UserRole;
  subscriptionTier?: SubscriptionTier | null;
}

// A row under a section: one of its pages. `active`: the page open now. `depth`: 1 for a row
// under another (a portfolio under All portfolios), with `color` its dot.
type SubItem = { key: string; label: string; view: unknown; active: boolean; preview?: boolean; depth?: number; color?: string };
// `preview`: a feature shown on sample data, not available yet (see components/preview).
type NavItem = { id: string; label: string; icon: typeof LayoutDashboard; preview?: boolean; subs?: SubItem[] };

export function Sidebar({ activeSection, setActiveSection, onOpenPage, isOpen = false, onClose, role, subscriptionTier }: SidebarProps) {
  const isAdvisor = role === 'ADVISOR';
  const { isDemo } = useUser();
  // An investor's wallets: a demo account's are sample data.
  const { wallets, available: walletsAvailable, sample } = useWallets();
  // Their real estate: a demo account's is sample data too.
  const { available: realEstateAvailable, properties, sample: realEstateSample } = useRealEstate();
  const { portfolios } = usePortfolio();
  // Which page the open section is on, to mark its row.
  const entry = useDashboardEntry();
  const view = (entry?.section === activeSection ? entry.view : undefined) as
    { kind?: string; uuid?: string; id?: string; page?: string; client?: string; property?: string } | undefined;
  // An advisor's: their clients under Clients, and the open one's portfolios under it.
  const { clients } = useClients();
  const openClient = isAdvisor && activeSection === CLIENTS_SECTION ? view?.client ?? null : null;
  const { portfolios: clientPortfolios } = useClientPortfolios(openClient);

  // Investor: the sections, and under the open one its pages. Under Investments, All portfolios and
  // each real portfolio under it (the only portfolio, while there's one), then Strategies. Under
  // Wallets and Real estate, all of them and each one (not archived), once there's one: the first
  // is added from the section's own page. Each of the two only where the user has it (a backend
  // with wallets, a demo account's sample data).
  const colorOf = portfolioColorMap(portfolios);
  const aggregate = portfolios.find((p) => p.isAggregate);
  const real = portfolios.filter((p) => !p.isVirtual).sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const portfolioRow = (p: (typeof portfolios)[number], depth: number): SubItem => ({
    key: p.uuid,
    label: p.name,
    view: { kind: 'portfolio', uuid: p.uuid, page: 'overview' },
    active: view?.kind === 'portfolio' && view.uuid === p.uuid,
    depth,
    color: p.isAggregate ? undefined : colorOf(p.uuid),
  });
  // Its pages too: a backtest, a published strategy, the form for a new one.
  const strategiesRow: SubItem = { key: 'strategies', label: 'Strategies', view: { kind: 'strategies', page: 'home' }, active: view?.kind === 'strategies' };
  const investmentRows: SubItem[] = [
    ...(aggregate ? [portfolioRow(aggregate, 0)] : []),
    ...real.map((p) => portfolioRow(p, aggregate ? 1 : 0)),
    strategiesRow,
  ];

  const hasWallets = isDemo || walletsAvailable;
  // Two wallets listed under the same name are told apart by their bank (their kind without one).
  const listedWallets = wallets.filter((w) => !w.archived);
  const nameKey = (name: string) => name.trim().toLowerCase();
  const walletLabel = (w: (typeof wallets)[number]) =>
    listedWallets.filter((x) => nameKey(x.name) === nameKey(w.name)).length > 1
      ? `${w.name} – ${w.institution?.trim() || KIND_LABELS[w.kind]}`
      : w.name;
  const walletRows: SubItem[] = wallets.length > 0 ? [
    { key: ALL_WALLETS, label: 'All wallets', view: { id: ALL_WALLETS, page: 'insights' }, active: (view?.id ?? ALL_WALLETS) === ALL_WALLETS },
    ...wallets.map((w, i) => ({ wallet: w, color: walletColor(w, i) })).filter(({ wallet: w }) => !w.archived).map(({ wallet: w, color }) => ({
      key: w.uuid,
      label: walletLabel(w),
      view: { id: w.uuid, page: 'insights' },
      active: view?.id === w.uuid,
      depth: 1,
      color,
    })),
  ] : [];
  const listedProperties = properties.filter((p) => !p.archived);
  const propertyRows: SubItem[] = listedProperties.length > 0 ? [
    { key: 'all', label: 'All properties', view: { page: 'home' }, active: !view?.property },
    ...listedProperties.map((p, i) => ({
      key: p.uuid,
      label: p.name,
      view: { page: 'property', property: p.uuid },
      active: view?.property === p.uuid,
      depth: 1,
      color: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length],
    })),
  ] : [];

  // The Journal, for everyone (the written articles where the backend doesn't have it yet); under
  // it the reader's and the author's pages, and the editors' moderation.
  const journal = useJournal();
  const journalRow = activeSection === JOURNAL_SECTION ? journalRowOf(view as JournalView | undefined) : null;
  const journalRows: SubItem[] = journal.canWrite ? [
    { key: 'journal', label: 'Articles', view: { page: 'journal' }, active: journalRow === 'journal' },
    { key: 'saved', label: 'Saved', view: { page: 'saved' }, active: journalRow === 'saved' },
    { key: 'mine', label: 'Your articles', view: { page: 'mine' }, active: journalRow === 'mine' },
    ...(journal.editor ? [{ key: 'moderation', label: 'Moderation', view: { page: 'moderation' }, active: journalRow === 'moderation' }] : []),
  ] : [];
  const journalItem: NavItem = { id: JOURNAL_SECTION, label: 'Journal', icon: BookOpen, subs: journalRows };
  const newsItem: NavItem = { id: NEWS_SECTION, label: 'News', icon: Newspaper };

  const investorItems: NavItem[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: INVESTMENTS_SECTION, label: 'Investments', icon: LineChart, subs: investmentRows },
    ...(realEstateAvailable ? [{ id: REAL_ESTATE_SECTION, label: 'Real estate', icon: Building2, preview: realEstateSample, subs: propertyRows }] : []),
    ...(hasWallets ? [{ id: WALLETS_SECTION, label: 'Wallets', icon: Wallet, preview: sample, subs: walletRows }] : []),
    { id: 'advisor', label: 'Find an advisor', icon: Handshake },
    { id: 'messages', label: 'Messages', icon: MessagesSquare },
    journalItem,
    newsItem,
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Each client, and under the open one their portfolios while they have more than one (as an
  // investor's are under Investments), each opening that page of the client's investments.
  const clientRealPortfolios = clientPortfolios.filter((p) => !p.isVirtual);
  const clientRows: SubItem[] = [...clients]
    .sort((a, b) => clientDisplayName(a).localeCompare(clientDisplayName(b)))
    .flatMap((c) => {
      const listed = openClient === c.uuid && clientRealPortfolios.length >= 2;
      // The client's own row, unless one of their portfolios' rows is the page open.
      const onPortfolioRow = listed && clientRealPortfolios.some((p) => p.uuid === view?.uuid);
      const row: SubItem = { key: c.uuid, label: clientDisplayName(c), view: { client: c.uuid }, active: openClient === c.uuid && !onPortfolioRow };
      if (!listed) return [row];
      const colorOf = portfolioColorMap(clientPortfolios);
      return [row, ...clientRealPortfolios.map((p) => ({
        key: `${c.uuid}:${p.uuid}`,
        label: p.name,
        view: { client: c.uuid, kind: 'portfolio', uuid: p.uuid, page: 'overview' },
        active: view?.uuid === p.uuid,
        depth: 1,
        color: colorOf(p.uuid),
      }))];
    });

  // A client's pages are the investor's, on the client's portfolios (see ClientsSection); the
  // advisor's strategies and the catalog are Strategies, a section of its own.
  const consultantItems: NavItem[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: CLIENTS_SECTION, label: 'Clients', icon: Users, subs: clientRows },
    { id: 'requests', label: 'Requests', icon: Inbox },
    { id: 'messages', label: 'Messages', icon: MessagesSquare },
    { id: STRATEGIES_SECTION, label: 'Strategies', icon: History },
    journalItem,
    newsItem,
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    if (onClose) onClose();
  };

  const handleSubClick = (section: string, sub: SubItem) => {
    onOpenPage?.(section, sub.view);
    if (onClose) onClose();
  };

  const renderItem = (item: NavItem) => {
    const isActive = activeSection === item.id;
    const subs = isActive && onOpenPage ? item.subs ?? [] : [];
    return (
      <div key={item.id} className="flex flex-col">
        <button
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
            {item.preview && <PreviewBadge dark />}
          </div>
          {isActive && <ChevronRight className="h-4 w-4 opacity-50" />}
        </button>
        {subs.length > 0 && (
          <div className="flex flex-col gap-0.5 mt-1 mb-2 ml-5 pl-1 border-l border-white/10">
            {subs.map((sub) => (
              <button
                key={sub.key}
                type="button"
                onClick={() => handleSubClick(item.id, sub)}
                aria-current={sub.active ? "page" : undefined}
                className={`flex items-center gap-2 min-h-9 px-2.5 rounded-lg text-left text-[13px] transition-colors ${sub.depth ? "pl-5 text-[12.5px]" : ""} ${
                  sub.active ? "bg-white/10 text-white font-bold" : "text-[#a8a29e] font-medium hover:text-white hover:bg-white/5"
                }`}
              >
                {sub.color && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: sub.color }} />}
                <span className="truncate">{sub.label}</span>
                {sub.preview && <PreviewBadge dark />}
              </button>
            ))}
          </div>
        )}
      </div>
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
                  onClick={() => handleNavClick('settings')}
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
