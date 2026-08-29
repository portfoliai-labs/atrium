import { ShieldAlert } from "lucide-react";

interface StepRiskProfileProps {
  formData: any;
  setFormData: (data: any) => void;
}

const riskConfig = {
  low: { label: "Conservative", sub: "Capital preservation" },
  medium: { label: "Moderate", sub: "Balanced growth" },
  high: { label: "Aggressive", sub: "Maximum growth" },
} as const;

const knowledgeConfig = {
  BEGINNER: {
    label: "Beginner",
    sub: "New to investing",
    unselectedClass: "border-teal-200 bg-teal-50 text-teal-700 hover:border-teal-400",
    selectedClass: "border-teal-500 bg-teal-500 text-white shadow-md shadow-teal-500/20",
  },
  INTERMEDIATE: {
    label: "Intermediate",
    sub: "Some trading experience",
    unselectedClass: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-400",
    selectedClass: "border-indigo-500 bg-indigo-500 text-white shadow-md shadow-indigo-500/20",
  },
  ADVANCED: {
    label: "Advanced",
    sub: "Deep market knowledge",
    unselectedClass: "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400",
    selectedClass: "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/20",
  },
} as const;

export function StepRiskProfile({ formData, setFormData }: StepRiskProfileProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-[#C49A3C]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <ShieldAlert className="w-8 h-8 text-[#C49A3C]" />
        </div>
        <h1
          className="text-3xl font-bold text-[#1c1917]"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Your Strategy
        </h1>
        <p className="text-[#78716c] mt-2 text-sm">Define your risk appetite and experience level.</p>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-[#78716c] ml-1">Risk Tolerance</label>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(riskConfig) as Array<keyof typeof riskConfig>).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setFormData({ ...formData, risk_tolerance: level })}
              className={`p-4 rounded-2xl font-bold border-2 transition-all text-left ${
                formData.risk_tolerance === level
                  ? 'border-[#C49A3C] bg-[#C49A3C]/10 text-[#1c1917]'
                  : 'border-[rgba(196,154,60,0.2)] bg-[#F7F5EF] text-[#78716c] hover:border-[#C49A3C]/50'
              }`}
            >
              <p className="text-sm">{riskConfig[level].label}</p>
              <p className="text-[10px] font-normal mt-0.5 opacity-70">{riskConfig[level].sub}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 mt-6">
        <label className="text-[10px] font-black uppercase tracking-widest text-[#78716c] ml-1">Financial Knowledge</label>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(knowledgeConfig) as Array<keyof typeof knowledgeConfig>).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setFormData({ ...formData, financial_knowledge_level: level })}
              className={`p-4 rounded-2xl font-bold border-2 transition-all text-left ${
                formData.financial_knowledge_level === level
                  ? knowledgeConfig[level].selectedClass
                  : knowledgeConfig[level].unselectedClass
              }`}
            >
              <p className="text-sm">{knowledgeConfig[level].label}</p>
              <p className="text-[10px] font-normal mt-0.5 opacity-70">{knowledgeConfig[level].sub}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
