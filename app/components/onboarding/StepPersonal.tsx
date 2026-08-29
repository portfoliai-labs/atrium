import { User } from "lucide-react";

interface StepPersonalProps {
  formData: any;
  setFormData: (data: any) => void;
  showCurrency?: boolean;
}

export function StepPersonal({ formData, setFormData, showCurrency }: StepPersonalProps) {
  const inputClass = "w-full p-4 bg-[#F7F5EF] border border-[rgba(196,154,60,0.3)] rounded-2xl font-bold text-[#1c1917] focus:bg-white focus:border-[#C49A3C] focus:ring-4 focus:ring-[#C49A3C]/10 outline-none transition-all placeholder:text-[#a8a29e] placeholder:font-normal";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-[#C49A3C]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <User className="w-8 h-8 text-[#C49A3C]" />
        </div>
        <h1
          className="text-3xl font-bold text-[#1c1917]"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Welcome! What&apos;s your name?
        </h1>
        <p className="text-[#78716c] mt-2 text-sm">Let&apos;s personalize your experience.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-[#78716c] ml-1">First Name</label>
          <input
            type="text"
            autoFocus
            className={inputClass}
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            placeholder="E.g. John"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-[#78716c] ml-1">Last Name</label>
          <input
            type="text"
            className={inputClass}
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            placeholder="E.g. Doe"
          />
        </div>
      </div>

      <div className={`grid grid-cols-1 ${showCurrency ? "md:grid-cols-2" : ""} gap-4 mt-6`}>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-[#78716c] ml-1">Preferred Language</label>
          <select
            className="w-full p-4 bg-[#F7F5EF] border border-[rgba(196,154,60,0.3)] rounded-2xl font-bold text-[#1c1917] focus:bg-white focus:border-[#C49A3C] outline-none transition-all appearance-none cursor-pointer"
            value={formData.language || "it"}
            onChange={(e) => setFormData({ ...formData, language: e.target.value })}
          >
            <option value="it">🇮🇹 Italian</option>
            <option value="en">🇬🇧 English</option>
          </select>
        </div>
        {showCurrency && (
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#78716c] ml-1">Reference Currency</label>
            <select
              className="w-full p-4 bg-[#F7F5EF] border border-[rgba(196,154,60,0.3)] rounded-2xl font-bold text-[#1c1917] focus:bg-white focus:border-[#C49A3C] outline-none transition-all appearance-none cursor-pointer"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            >
              <option value="EUR">Euro (€)</option>
              <option value="USD">US Dollar ($)</option>
              <option value="GBP">British Pound (£)</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
