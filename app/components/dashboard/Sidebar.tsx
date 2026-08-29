"use client";

import { LayoutDashboard, FileText, Settings, Receipt, ChevronRight, Sparkles, Users, User2Icon } from "lucide-react";
import { UserRole, SubscriptionTier } from "../../models/User";

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  role?: UserRole;
  subscriptionTier?: SubscriptionTier | null;
}

export function Sidebar({ activeSection, setActiveSection, isOpen = false, onClose, role, subscriptionTier }: SidebarProps) {
  const investorItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Transactions', icon: Receipt },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'profile', label: 'Profile', icon: User2Icon },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const consultantItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'upload', label: 'Transactions', icon: Receipt },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'profile', label: 'Profile', icon: User2Icon },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const menuItems = role === 'ADVISOR' ? consultantItems : investorItems;

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    if (onClose) onClose();
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
        w-72 bg-[#1c1917]
        flex flex-col h-screen
        transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        ${isOpen ? "pointer-events-auto" : "pointer-events-none lg:pointer-events-auto"}
      `}>

        <nav className="flex flex-col gap-1 p-5 pt-[100px] flex-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`group relative flex items-center justify-between px-4 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] ${
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
          })}
        </nav>

        {subscriptionTier !== 'TESTER' && (
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
