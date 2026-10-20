import { Briefcase } from "lucide-react";

interface StepConsultantProps {
  formData: any;
  setFormData: (data: any) => void;
}

export function StepConsultant({ formData, setFormData }: StepConsultantProps) {
  const handleNumericChange = (field: string, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    setFormData({ ...formData, [field]: cleaned });
  };

  const inputClass = "w-full p-4 bg-[#F7F5EF] border border-[rgba(196,154,60,0.3)] rounded-2xl font-bold text-[#1c1917] focus:bg-white focus:border-[#C49A3C] focus:ring-4 focus:ring-[#C49A3C]/10 outline-none transition-all placeholder:text-[#857e78] placeholder:font-normal";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-[#C49A3C]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Briefcase className="w-8 h-8 text-[#C49A3C]" />
        </div>
        <h1
          className="text-3xl font-bold text-[#1c1917]"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Your client portfolio
        </h1>
        <p className="text-[#78716c] mt-2 text-sm">
          This data helps us size the service to your needs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-[#78716c] ml-1">
            Years of experience
          </label>
          <input
            type="text"
            className={inputClass}
            value={formData.years_of_experience || ""}
            onChange={(e) => handleNumericChange('years_of_experience', e.target.value)}
            placeholder="E.g. 10"
          />
        </div>
        <div className="md:col-span-2 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-[#78716c] ml-1">
            Specialization (optional)
          </label>
          <input
            type="text"
            className={inputClass}
            value={formData.specialization || ""}
            onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
            placeholder="E.g. Retirement, ETFs, Real Estate..."
          />
        </div>
      </div>
    </div>
  );
}
