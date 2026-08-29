"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowRight, ArrowLeft, UploadCloud, FileText,
  LayoutDashboard, Settings, BarChart3, Download, Eye,
  ChevronRight, Sparkles, Search, Plus, Receipt, PlusCircle,
  User2, Globe, ShieldAlert, Wallet, Save, GraduationCap, Percent,
} from "lucide-react";

interface DemoTourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    activeNav: "upload",
    title: "Import your transactions",
    description: "Upload a CSV or Excel export from any broker, or add transactions manually — one at a time.",
  },
  {
    activeNav: "profile",
    title: "Set your investor profile",
    description: "Language, currency, risk tolerance, financial knowledge and long-term goals — kept on your account to personalize the AI analysis.",
  },
  {
    activeNav: "reports",
    title: "Download your report",
    description: "A professional institutional-grade PDF — 5 chapters, every metric. Share with clients, archive for taxes, or present in a meeting.",
  },
];

const SPOTLIGHT: React.CSSProperties = {
  outline: "2px solid #C49A3C",
  outlineOffset: "3px",
  boxShadow: "0 0 0 5px rgba(196,154,60,0.1), 0 4px 24px rgba(0,0,0,0.06)",
};

const FAKE_PDF_URL = "https://pub-cece637ec06c4770af51867735ef74de.r2.dev/files/report_full_real.pdf";

export default function DemoTourModal({ isOpen, onClose }: DemoTourModalProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 lg:p-8">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
      />

      <motion.div
        className="relative w-full max-w-5xl flex flex-col rounded-md overflow-hidden"
        style={{ height: "85vh", background: "#F7F5EF", boxShadow: "0 32px 80px rgba(0,0,0,0.45)" }}
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 z-20" style={{ background: "#e7e5e0" }}>
          <motion.div
            className="h-full"
            style={{ background: "#C49A3C" }}
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* Dashboard shell */}
        <div className="flex flex-1 overflow-hidden">
          <DemoSidebar activeNav={current.activeNav} />

          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Fake top bar */}
            <div className="h-12 border-b flex items-center px-5 gap-2.5 shrink-0" style={{ background: "#FDFCF8", borderColor: "#e7e5e0" }}>
              <div className="w-5 h-5 rounded-[3px] flex items-center justify-center" style={{ background: "#1c1917" }}>
                <BarChart3 className="w-3 h-3" style={{ stroke: "#C49A3C" }} />
              </div>
              <span className="text-sm font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>PortfoliAI</span>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-stone-200" />
                <span className="text-[11px]" style={{ color: "#a8a29e" }}>demo@portfoliai.com</span>
              </div>
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {step === 0 && <ScreenTransactions />}
                  {step === 1 && <ScreenProfile />}
                  {step === 2 && <ScreenReportReady />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Bottom tour bar */}
        <div className="shrink-0 border-t px-6 py-4 flex items-center gap-6" style={{ background: "#FDFCF8", borderColor: "#e7e5e0" }}>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-medium mb-0.5" style={{ color: "#8A6A28" }}>
              Step {step + 1} / {STEPS.length}
            </div>
            <div className="font-bold text-[14px] truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>
              {current.title}
            </div>
            <div className="text-[12px] leading-snug mt-0.5 hidden sm:block" style={{ color: "#78716c" }}>
              {current.description}
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={isFirst}
              className="flex items-center gap-1 text-[12px] font-medium px-4 py-2 rounded-[3px] border transition-colors disabled:opacity-30"
              style={{ borderColor: "#e7e5e0", color: "#78716c", background: "#fff" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            {isLast ? (
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 text-[12px] font-semibold px-5 py-2 rounded-[3px] transition-colors"
                style={{ background: "#1c1917", color: "#fafaf9" }}
              >
                Get started <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="flex items-center gap-1.5 text-[12px] font-semibold px-5 py-2 rounded-[3px] transition-colors"
                style={{ background: "#C49A3C", color: "#1c1917" }}
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function DemoSidebar({ activeNav }: { activeNav: string }) {
  const items = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "upload", label: "Transactions", icon: Receipt },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "profile", label: "Profile", icon: User2 },
    { id: "settings", label: "Settings", icon: Settings },
  ];
  return (
    <aside className="w-48 lg:w-56 shrink-0 flex flex-col" style={{ background: "#1c1917" }}>
      <nav className="flex-1 px-3 pt-14 space-y-0.5">
        {items.map(({ id, label, icon: Icon }) => {
          const active = id === activeNav;
          return (
            <div
              key={id}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-[12px] font-semibold border ${
                active ? "text-[#C49A3C] border-[#C49A3C]/30" : "text-[#a8a29e] border-transparent"
              }`}
              style={active ? { background: "rgba(196,154,60,0.1)" } : {}}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </div>
              {active && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
            </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        <div className="rounded-3xl p-3 border border-[#C49A3C]/20" style={{ background: "#131210" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="h-3 w-3 text-[#C49A3C]" />
            <span className="text-[9px] font-black uppercase tracking-widest text-[#C49A3C]">Pro</span>
          </div>
          <p className="text-[11px] text-[#a8a29e] mb-2 leading-snug">Unlock unlimited analysis and tax insights.</p>
          <div className="w-full py-1.5 rounded-lg text-[10px] font-bold text-center uppercase tracking-wider" style={{ background: "#C49A3C", color: "#131210" }}>
            Upgrade Now
          </div>
        </div>
      </div>
    </aside>
  );
}

// ── Step screens ──────────────────────────────────────────────────────────────

const FAKE_TRANSACTIONS = [
  { date: "2024-01-15, 08:30:22", type: "BUY",  ticker: "AAPL", qty: "10", price: "182.50", currency: "USD" },
  { date: "2024-02-03, 14:12:07", type: "BUY",  ticker: "MSFT", qty: "5",  price: "415.20", currency: "USD" },
  { date: "2024-03-12, 09:45:33", type: "SELL", ticker: "AAPL", qty: "5",  price: "178.30", currency: "USD" },
  { date: "2024-04-08, 11:20:15", type: "BUY",  ticker: "NVDA", qty: "3",  price: "859.40", currency: "USD" },
  { date: "2024-05-21, 15:05:44", type: "BUY",  ticker: "VOO",  qty: "8",  price: "488.90", currency: "USD" },
];

function ScreenTransactions() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-0.5">Transactions</h2>
        <p className="text-sm text-slate-500 font-medium">Import a file or add trades manually to generate a report.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          className="p-5 border-2 border-dashed rounded-3xl bg-white/50 cursor-pointer flex items-center gap-4 group"
          style={{ borderColor: "#e7e5e0", ...SPOTLIGHT }}
        >
          <div className="bg-slate-100 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
            <UploadCloud className="h-5 w-5 text-slate-500 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="text-left overflow-hidden">
            <span className="text-sm font-bold text-slate-700 block">Browse Files</span>
            <p className="text-xs text-slate-400 truncate">CSV or Excel formats</p>
          </div>
        </div>

        <div className="p-5 rounded-3xl border border-slate-200 bg-white flex items-center gap-4">
          <div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0">
            <PlusCircle className="h-5 w-5 text-blue-600" />
          </div>
          <div className="overflow-hidden">
            <span className="text-sm font-bold text-slate-700 block">Add transaction</span>
            <p className="text-xs text-slate-400 truncate">Insert a single row manually</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-4xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-140">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["date", "type", "ticker", "quantity", "price", "currency"].map((col) => (
                  <th key={col} className="px-5 py-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{col}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {FAKE_TRANSACTIONS.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-600">{row.date}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      row.type === "BUY" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}>{row.type}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-slate-900">{row.ticker}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-600">{row.qty}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-600">{row.price}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-600">{row.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ScreenProfile() {
  const knowledgeLevels = [
    { label: "Beginner", active: false },
    { label: "Intermediate", active: true },
    { label: "Advanced", active: false },
  ];

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-0.5">Profile</h2>
          <p className="text-sm text-slate-500 font-medium">Manage your preferences and financial profile.</p>
        </div>
        <button className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-slate-900 text-white shadow-sm shrink-0">
          <Save className="h-4 w-4" /> Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-4xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3">
            <Globe className="h-4 w-4" style={{ color: "#C49A3C" }} /> Preferences
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Language</span>
              <div className="p-2.5 bg-slate-50 rounded-xl text-sm font-semibold text-slate-700">🇬🇧 English</div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Currency</span>
              <div className="p-2.5 bg-slate-50 rounded-xl text-sm font-semibold text-slate-700">EUR (€)</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-4xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3">
            <ShieldAlert className="h-4 w-4" style={{ color: "#C49A3C" }} /> Risk Profile
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Risk Tolerance</span>
            <div className="p-2.5 bg-slate-50 rounded-xl text-sm font-bold text-amber-600">Moderate</div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-5 rounded-4xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3">
            <GraduationCap className="h-4 w-4" style={{ color: "#C49A3C" }} /> Financial Knowledge
          </div>
          <div className="grid grid-cols-3 gap-3">
            {knowledgeLevels.map((k) => (
              <div
                key={k.label}
                className={`text-center py-3 rounded-2xl border-2 text-sm font-bold ${
                  k.active ? "border-[#C49A3C] bg-[#C49A3C] text-[#131210]" : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                {k.label}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-5 rounded-4xl border border-slate-200 shadow-sm space-y-4" style={SPOTLIGHT}>
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3">
            <Wallet className="h-4 w-4" style={{ color: "#C49A3C" }} /> Financial Data
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Estimated Wealth (EUR)</span>
              <div className="p-2.5 bg-slate-50 rounded-xl text-sm font-semibold text-slate-700">€ 120,000</div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Annual Income, Net (EUR)</span>
              <div className="p-2.5 bg-slate-50 rounded-xl text-sm font-semibold text-slate-700">€ 45,000</div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <Percent className="h-3 w-3" /> Income Invested
              </span>
              <div className="p-2.5 bg-slate-50 rounded-xl text-sm font-semibold text-slate-700">15%</div>
            </div>
            <div className="sm:col-span-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Financial Goals</span>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center px-4 py-2 rounded-full border border-[#e7e1d3] bg-white text-[13px] font-semibold text-slate-700">
                  I want to retire in 20 years and withdraw €1,500 per month from my portfolio.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScreenReportReady() {
  const handleDownload = () => window.open(FAKE_PDF_URL, "_blank");

  return (
    <div className="space-y-6 pb-4">
      {/* Header & controls */}
      <div className="flex flex-col xl:flex-row justify-between gap-4 xl:items-end">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Reports</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Manage, download, and organize your generated analyses.</p>
          <div className="relative w-full md:w-80 mt-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              readOnly
              value=""
              placeholder="Search by name..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-medium outline-none shadow-sm text-slate-900 cursor-default"
            />
          </div>
        </div>
        <div className="flex bg-slate-100/80 p-1.5 rounded-xl border border-slate-200 w-fit shrink-0">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-white shadow-sm text-blue-600">
            List View
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-slate-500">
            Grouped
          </button>
        </div>
      </div>

      {/* Document Card — faithful replica */}
      <div
        className="group flex flex-col md:flex-row md:items-center justify-between p-5 md:p-6 bg-white border border-slate-200/80 rounded-4xl hover:shadow-xl hover:shadow-slate-200/50 hover:border-blue-200 transition-all duration-300 gap-5 md:gap-0"
        style={SPOTLIGHT}
      >
        <div className="flex items-start md:items-center gap-4 md:gap-6 w-full md:w-auto">
          <div className="bg-slate-50/80 text-slate-400 group-hover:bg-blue-600 group-hover:text-white p-4 md:p-5 rounded-2xl md:rounded-3xl transition-colors duration-300 shrink-0">
            <FileText className="h-6 w-6 md:h-8 md:w-8" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-lg md:text-xl text-slate-900 group-hover:text-blue-600 transition-colors truncate">
              Portfolio Analysis — 2022–2024
            </h3>
            <div className="flex flex-wrap gap-2 mt-2 items-center">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100">
                Interactive Brokers
              </span>
              <button className="text-[10px] font-black text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-blue-200 transition-all flex items-center gap-1">
                <Plus className="h-3 w-3" /> ADD TAG
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 md:gap-3 w-full md:w-auto mt-2 md:mt-0">
          <button
            onClick={handleDownload}
            className="flex-1 md:flex-none flex justify-center items-center px-6 py-3.5 text-sm font-bold uppercase tracking-wide bg-slate-50 text-slate-600 border border-slate-200 rounded-xl hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 md:flex-none flex justify-center items-center gap-2 px-6 py-3.5 text-sm font-bold uppercase tracking-wide bg-slate-900 text-white rounded-xl hover:bg-blue-600 shadow-md shadow-slate-200 hover:shadow-blue-200 transition-all"
          >
            <Download className="h-4 w-4" />
            <span className="md:hidden lg:inline">Download</span>
          </button>
        </div>
      </div>
    </div>
  );
}
