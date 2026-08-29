"use client";

import { useState, useEffect, useRef } from "react";
import {
  Globe, ShieldAlert, Save,
  Loader2, CheckCircle2, AlertCircle, ChevronDown, Banknote,
  GraduationCap, Info,
  // Wallet, Coins, Percent, // used by the hidden "Financial Data" section below
} from "lucide-react";
import { userService } from "../../services/userService";
import { useUser } from "../../context/UserContext";
import type { FinancialKnowledgeLevel } from "../../models/User";

type GoalTemplatePart = { type: "text"; text: string } | { type: "number"; key: string; placeholder: string };

interface GoalTemplate {
  id: string;
  parts: GoalTemplatePart[];
}

function numberParts(t: GoalTemplate) {
  return t.parts.filter((p): p is Extract<GoalTemplatePart, { type: "number" }> => p.type === "number");
}

function buildGoalText(t: GoalTemplate, values: Record<string, string>) {
  return t.parts.map((p) => (p.type === "text" ? p.text : values[p.key].trim())).join("");
}

const goalTemplates: GoalTemplate[] = [
  {
    id: "portfolio_survival_withdrawal",
    parts: [
      { type: "text", text: "I want to retire in " },
      { type: "number", key: "years", placeholder: "20" },
      { type: "text", text: " years and withdraw €" },
      { type: "number", key: "amount", placeholder: "1500" },
      { type: "text", text: " per month from my portfolio." },
    ],
  },
  {
    id: "portfolio_survival_topup",
    parts: [
      { type: "text", text: "I need a pension top-up of about €" },
      { type: "number", key: "amount", placeholder: "1200" },
      { type: "text", text: " per month for " },
      { type: "number", key: "years", placeholder: "30" },
      { type: "text", text: " years." },
    ],
  },
  {
    id: "fire_swr_basic",
    parts: [
      { type: "text", text: "I want to reach FIRE as soon as possible and live off my portfolio for the next " },
      { type: "number", key: "years", placeholder: "40" },
      { type: "text", text: " years." },
    ],
  },
  {
    id: "buy_house",
    parts: [
      { type: "text", text: "I plan to buy a house in the next " },
      { type: "number", key: "years", placeholder: "4" },
      { type: "text", text: " years, with an estimated cost of around €" },
      { type: "number", key: "amount", placeholder: "300000" },
      { type: "text", text: "." },
    ],
  },
];

export function ProfileSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { refreshUser } = useUser();

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [isRiskOpen, setIsRiskOpen] = useState(false);

  const [formData, setFormData] = useState({
    language: "en",
    currency: "USD",
    estimated_wealth: "0",
    annual_income: "0",
    savings_rate: "0",
    risk_tolerance: "medium",
    financial_knowledge_level: "BEGINNER",
  });

  const [goals, setGoals] = useState<{ text: string; templateId?: string }[]>([]);
  const [goalInput, setGoalInput] = useState("");
  const [isAddingCustomGoal, setIsAddingCustomGoal] = useState(false);
  const customGoalInputRef = useRef<HTMLInputElement>(null);
  const [templateValues, setTemplateValues] = useState<Record<string, Record<string, string>>>(
    Object.fromEntries(goalTemplates.map((t) => [t.id, Object.fromEntries(numberParts(t).map((p) => [p.key, ""]))]))
  );

  const languages = [
    { code: "en", label: "English", flag: "🇬🇧" },
    { code: "it", label: "Italian", flag: "🇮🇹" },
    { code: "es", label: "Spanish", flag: "🇪🇸" },
    { code: "fr", label: "French", flag: "🇫🇷" },
  ];

  const currencies = [
    { code: "USD", label: "Dollar ($)" },
    { code: "EUR", label: "Euro (€)" },
    { code: "GBP", label: "Pound (£)" }
  ];

  const riskLevels = [
    { code: "low", label: "Conservative", color: "text-emerald-600" },
    { code: "medium", label: "Moderate", color: "text-amber-600" },
    { code: "high", label: "Aggressive", color: "text-rose-600" }
  ];

  const knowledgeLevels = [
    {
      code: "BEGINNER",
      label: "Beginner",
      description: "New to investing. Familiar with basic concepts like stocks and funds, but little to no hands-on experience.",
      unselectedClass: "border-teal-200 bg-teal-50 text-teal-700 hover:border-teal-400",
      selectedClass: "border-teal-500 bg-teal-500 text-white shadow-md shadow-teal-500/20"
    },
    {
      code: "INTERMEDIATE",
      label: "Intermediate",
      description: "Comfortable with markets. Has traded before and understands risk, diversification and asset classes.",
      unselectedClass: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-400",
      selectedClass: "border-indigo-500 bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
    },
    {
      code: "ADVANCED",
      label: "Advanced",
      description: "Highly experienced. Deep understanding of financial instruments, strategies and market dynamics.",
      unselectedClass: "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400",
      selectedClass: "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/20"
    }
  ];

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const user = await userService.getUserProfile();
        setFormData({
          language: user.language || "en",
          currency: user.currency || "USD",
          estimated_wealth: String(user.estimated_wealth || 0),
          annual_income: String(user.annual_income || 0),
          savings_rate: user.savings_rate != null ? String(Math.round(user.savings_rate * 100)) : "0",
          risk_tolerance: user.risk_tolerance || "medium",
          financial_knowledge_level: user.financial_knowledge_level || "BEGINNER",
        });

        setGoals((user.financial_goals || []).map((text) => ({ text })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const pendingGoal = goalInput.trim();
      const allGoals = pendingGoal ? [...goals, { text: pendingGoal }] : goals;
      const financial_goals = allGoals.map((g) => g.text);

      await userService.updateUserProfile({
        language: formData.language,
        currency: formData.currency || null,
        estimated_wealth: formData.estimated_wealth ? parseFloat(formData.estimated_wealth) : null,
        annual_income: formData.annual_income ? parseFloat(formData.annual_income) : null,
        savings_rate: formData.savings_rate ? parseFloat(formData.savings_rate) / 100 : null,
        financial_goals: financial_goals.length ? financial_goals : null,
        risk_tolerance: formData.risk_tolerance || null,
        financial_knowledge_level: (formData.financial_knowledge_level || null) as FinancialKnowledgeLevel | null,
      });

      localStorage.removeItem("user_profile");
      await refreshUser();

      setMessage({ type: "success", text: "Profile updated successfully" });
    } catch (err) {
      console.error("Update error:", err);
      setMessage({ type: "error", text: "Error saving profile" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="animate-spin text-[#C49A3C]" />
    </div>
  );

  const inputClass = "w-full p-3.5 bg-white border border-[rgba(196,154,60,0.25)] rounded-xl font-medium text-[#1c1917] outline-none focus:border-[#C49A3C] focus:ring-4 focus:ring-[#C49A3C]/10 transition-all";
  const dropdownBtnClass = "w-full flex items-center justify-between p-3.5 bg-white border border-[rgba(196,154,60,0.25)] rounded-xl font-medium text-[#1c1917] hover:border-[#C49A3C] transition-all focus:ring-4 focus:ring-[#C49A3C]/10";

  return (
    <div className="space-y-6 md:space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2
            className="text-2xl md:text-3xl font-bold text-[#1c1917] tracking-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Profile
          </h2>
          <p className="text-sm md:text-base text-[#78716c] font-medium mt-1">
            Manage your preferences and financial profile
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-6 py-3.5 bg-[#1c1917] text-white rounded-xl font-bold hover:bg-[#C49A3C] transition-colors shadow-sm disabled:opacity-50 w-full md:w-auto"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Preferences */}
        <div className="bg-white p-6 md:p-8 rounded-4xl border border-[rgba(196,154,60,0.2)] shadow-sm space-y-6">
          <SectionHeader icon={<Globe className="w-5 h-5" />} title="Preferences" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] ml-1">Language</label>
              <div className="relative">
                <button onClick={() => setIsLangOpen(!isLangOpen)} className={dropdownBtnClass}>
                  <span className="flex items-center gap-2">
                    <span className="text-lg leading-none">{languages.find(l => l.code === formData.language)?.flag}</span>
                    {languages.find(l => l.code === formData.language)?.label}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-[#a8a29e] transition-transform ${isLangOpen ? 'rotate-180' : ''}`} />
                </button>
                {isLangOpen && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-[rgba(196,154,60,0.2)] rounded-xl shadow-xl overflow-hidden">
                    {languages.map(l => (
                      <button key={l.code} onClick={() => { setFormData({ ...formData, language: l.code }); setIsLangOpen(false); }} className="w-full p-3.5 text-left font-medium hover:bg-[#F7F5EF] text-[#1c1917] flex items-center gap-2">
                        <span className="text-lg leading-none">{l.flag}</span> {l.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] ml-1">Currency</label>
              <div className="relative">
                <button onClick={() => setIsCurrencyOpen(!isCurrencyOpen)} className={dropdownBtnClass}>
                  <span className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-[#a8a29e]" /> {formData.currency}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-[#a8a29e] transition-transform ${isCurrencyOpen ? 'rotate-180' : ''}`} />
                </button>
                {isCurrencyOpen && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-[rgba(196,154,60,0.2)] rounded-xl shadow-xl overflow-hidden">
                    {currencies.map(c => (
                      <button key={c.code} onClick={() => { setFormData({ ...formData, currency: c.code }); setIsCurrencyOpen(false); }} className="w-full p-3.5 text-left font-medium hover:bg-[#F7F5EF] text-[#1c1917]">
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Risk Profile */}
        <div className="bg-white p-6 md:p-8 rounded-4xl border border-[rgba(196,154,60,0.2)] shadow-sm space-y-6">
          <SectionHeader icon={<ShieldAlert className="w-5 h-5" />} title="Risk Profile" />
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] ml-1">Risk Tolerance</label>
            <div className="relative">
              <button onClick={() => setIsRiskOpen(!isRiskOpen)} className={dropdownBtnClass}>
                <span className={riskLevels.find(r => r.code === formData.risk_tolerance)?.color}>
                  {riskLevels.find(r => r.code === formData.risk_tolerance)?.label}
                </span>
                <ChevronDown className={`w-4 h-4 text-[#a8a29e] transition-transform ${isRiskOpen ? 'rotate-180' : ''}`} />
              </button>
              {isRiskOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-[rgba(196,154,60,0.2)] rounded-xl shadow-xl overflow-hidden">
                  {riskLevels.map(r => (
                    <button key={r.code} onClick={() => { setFormData({ ...formData, risk_tolerance: r.code }); setIsRiskOpen(false); }} className={`w-full p-3.5 text-left font-bold hover:bg-[#F7F5EF] ${r.color}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Financial Knowledge */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-4xl border border-[rgba(196,154,60,0.2)] shadow-sm space-y-6">
          <SectionHeader icon={<GraduationCap className="w-5 h-5" />} title="Financial Knowledge" />
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {knowledgeLevels.map(k => (
                <div key={k.code} className="relative group/tip">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, financial_knowledge_level: k.code })}
                    className={`w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 font-bold text-sm transition-all ${
                      formData.financial_knowledge_level === k.code ? k.selectedClass : k.unselectedClass
                    }`}
                  >
                    <span>{k.label}</span>
                    <Info className={`w-4 h-4 ${formData.financial_knowledge_level === k.code ? "opacity-80" : "opacity-50"}`} />
                  </button>
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 opacity-0 group-hover/tip:opacity-100 transition-opacity z-20">
                    <div className="bg-[#1c1917] text-white text-[11px] font-medium leading-snug rounded-lg p-3 shadow-xl text-left">
                      {k.description}
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-[#1c1917] rotate-45" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Financial Data section (net worth, income, savings rate, financial goals) temporarily
            hidden from the profile UI. State/logic and handleSave payload are left untouched;
            un-comment this block to restore it. */}
        {/*
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-4xl border border-[rgba(196,154,60,0.2)] shadow-sm space-y-6 md:space-y-8">
          <SectionHeader icon={<Wallet className="w-5 h-5" />} title="Financial Data" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] ml-1">
                Estimated Wealth ({formData.currency})
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a8a29e]"><Coins className="w-5 h-5" /></div>
                <input
                  type="text"
                  className={`${inputClass} pl-12`}
                  value={formData.estimated_wealth}
                  onChange={(e) => setFormData({ ...formData, estimated_wealth: e.target.value.replace(/[^0-9.]/g, '') })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] ml-1">
                Annual Income, Net ({formData.currency})
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a8a29e]"><Banknote className="w-5 h-5" /></div>
                <input
                  type="text"
                  className={`${inputClass} pl-12`}
                  value={formData.annual_income}
                  onChange={(e) => setFormData({ ...formData, annual_income: e.target.value.replace(/[^0-9.]/g, '') })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] ml-1">
                Income Invested (%)
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a8a29e]"><Percent className="w-5 h-5" /></div>
                <input
                  type="text"
                  className={`${inputClass} pl-12`}
                  value={formData.savings_rate}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9.]/g, '');
                    if (digits !== '' && parseFloat(digits) > 100) return;
                    setFormData({ ...formData, savings_rate: digits });
                  }}
                />
              </div>
            </div>
            <div className="md:col-span-3 space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] ml-1">Financial Goals</label>

              <div className="flex flex-wrap gap-2">
                {goalTemplates
                  .filter((t) => !goals.some((g) => g.templateId === t.id))
                  .map((t) => {
                    const nParts = numberParts(t);
                    const values = templateValues[t.id];

                    const commit = () => {
                      if (nParts.some((p) => !values[p.key]?.trim())) return;
                      setGoals([...goals, { text: buildGoalText(t, values), templateId: t.id }]);
                      setTemplateValues({
                        ...templateValues,
                        [t.id]: Object.fromEntries(nParts.map((p) => [p.key, ""])),
                      });
                    };

                    return (
                      <div
                        key={t.id}
                        className="flex flex-wrap items-baseline gap-1 w-full sm:w-auto px-4 py-3 rounded-2xl border border-dashed border-[#d6cdb8] bg-white text-[13px] font-semibold tracking-tight text-[#44403c] transition-all focus-within:border-[#C49A3C] focus-within:border-solid"
                      >
                        {t.parts.map((p, i) =>
                          p.type === "text" ? (
                            <span key={i}>{p.text}</span>
                          ) : (
                            <input
                              key={i}
                              type="number"
                              min="0"
                              size={Math.max(p.placeholder.length, (values[p.key] || "").length, 2)}
                              value={values[p.key] || ""}
                              placeholder={p.placeholder}
                              onChange={(e) =>
                                setTemplateValues({
                                  ...templateValues,
                                  [t.id]: { ...values, [p.key]: e.target.value },
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  commit();
                                }
                              }}
                              className="text-center bg-transparent border-0 outline-none font-bold text-[#1c1917] placeholder-[#a8a29e] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0"
                            />
                          )
                        )}
                      </div>
                    );
                  })}
              </div>

              {isAddingCustomGoal ? (
                <input
                  ref={customGoalInputRef}
                  type="text"
                  className={inputClass}
                  placeholder="Describe your own goal and press Enter…"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && goalInput.trim()) {
                      e.preventDefault();
                      setGoals([...goals, { text: goalInput.trim() }]);
                      setGoalInput("");
                    }
                    if (e.key === "Escape") {
                      setGoalInput("");
                      setIsAddingCustomGoal(false);
                    }
                  }}
                  onBlur={() => {
                    if (!goalInput.trim()) setIsAddingCustomGoal(false);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCustomGoal(true);
                    setTimeout(() => customGoalInputRef.current?.focus(), 0);
                  }}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-dashed border-[#d6cdb8] bg-white text-[13px] font-semibold tracking-tight text-[#78716c] hover:border-[#C49A3C] hover:text-[#C49A3C] transition-all"
                >
                  + Add custom goal
                </button>
              )}

              {goals.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-4">
                  {goals.map((goal, index) => (
                    <span
                      key={index}
                      className="flex items-start gap-2 w-full sm:w-auto sm:max-w-md px-4 py-2.5 rounded-2xl border border-[#e7e1d3] bg-white text-[13px] font-semibold tracking-tight text-[#44403c]"
                    >
                      <span className="flex-1">{goal.text}</span>
                      <button
                        type="button"
                        onClick={() => setGoals(goals.filter((_, i) => i !== index))}
                        className="text-[#a8a29e] hover:text-rose-500 leading-none shrink-0 mt-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        */}
      </div>

      {message && (
        <div className={`fixed bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 px-6 md:px-8 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 z-50 ${message.type === 'success' ? 'bg-[#1c1917] text-white' : 'bg-rose-500 text-white'}`}>
          {message.type === 'success'
            ? <CheckCircle2 className="w-5 h-5 text-[#C49A3C]" />
            : <AlertCircle className="w-5 h-5" />
          }
          <span className="font-semibold text-sm md:text-base">{message.text}</span>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-[rgba(196,154,60,0.15)] pb-4">
      <div className="p-2.5 bg-[#F7F5EF] text-[#C49A3C] rounded-xl">{icon}</div>
      <span className="font-bold text-sm text-[#1c1917]">{title}</span>
    </div>
  );
}
