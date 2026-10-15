"use client";

import { useState, useEffect, useRef } from "react";
import {
  Building2, Palette, Award, Save, Loader2, CheckCircle2, AlertCircle,
  ImagePlus, Trash2, Briefcase
} from "lucide-react";
import { advisorService } from "../../services/advisorService";

const DEFAULT_BRAND_COLOR = "#C49A3C";

export function AdvisorProfileSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    company_name: "",
    specialization: "",
    years_experience: "",
    brand_color: DEFAULT_BRAND_COLOR,
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const loadProfile = async () => {
    const profile = await advisorService.getAdvisorProfile();
    setFormData({
      company_name: profile.company_name || "",
      specialization: profile.specialization || "",
      years_experience: profile.years_experience != null ? String(profile.years_experience) : "",
      brand_color: profile.brand_color || DEFAULT_BRAND_COLOR,
    });
    setLogoUrl(profile.logo_url || null);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadProfile();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await advisorService.updateAdvisorProfile({
        company_name: formData.company_name.trim() || null,
        specialization: formData.specialization.trim() || null,
        years_experience: formData.years_experience !== "" ? parseInt(formData.years_experience, 10) : null,
        clients_count: null,
        aum: null,
        brand_color: formData.brand_color || null,
      });
      showMessage("success", "Profile updated successfully");
    } catch (err) {
      console.error("Update error:", err);
      showMessage("error", "Error saving profile");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingLogo(true);
    try {
      await advisorService.uploadAdvisorLogo(file);
      await loadProfile();
      showMessage("success", "Logo updated successfully");
    } catch (err) {
      console.error("Logo upload error:", err);
      showMessage("error", "Error uploading logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoDelete = async () => {
    setUploadingLogo(true);
    try {
      await advisorService.deleteAdvisorLogo();
      setLogoUrl(null);
      showMessage("success", "Logo removed");
    } catch (err) {
      console.error("Logo delete error:", err);
      showMessage("error", "Error removing logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="animate-spin text-[#C49A3C]" />
    </div>
  );

  const inputClass = "w-full p-3.5 bg-white border border-[rgba(196,154,60,0.25)] rounded-xl font-medium text-[#1c1917] outline-none focus:border-[#C49A3C] focus:ring-4 focus:ring-[#C49A3C]/10 transition-all";

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
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

        {/* Company & Branding */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-4xl border border-[rgba(196,154,60,0.2)] shadow-sm space-y-6">
          <SectionHeader icon={<Building2 className="w-5 h-5" />} title="Company & Branding" />

          <div className="flex flex-col sm:flex-row gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] ml-1">Logo</label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="relative w-20 h-20 rounded-2xl border border-dashed border-[rgba(196,154,60,0.4)] bg-[#F7F5EF] flex items-center justify-center overflow-hidden hover:border-[#C49A3C] transition-colors disabled:opacity-60"
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-5 h-5 animate-spin text-[#C49A3C]" />
                  ) : logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Company logo" className="w-full h-full object-contain" />
                  ) : (
                    <ImagePlus className="w-6 h-6 text-[#a8a29e]" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoSelect}
                  className="hidden"
                />
                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleLogoDelete}
                    disabled={uploadingLogo}
                    className="flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-600 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] ml-1">Company Name</label>
              <input
                type="text"
                maxLength={200}
                className={inputClass}
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Your firm's name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] ml-1 flex items-center gap-1.5">
                <Palette className="w-3 h-3" /> Brand Color
              </label>
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-13 shrink-0 rounded-xl border border-[rgba(196,154,60,0.25)] overflow-hidden">
                  <input
                    type="color"
                    value={formData.brand_color}
                    onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })}
                    className="absolute -top-1 -left-1 w-[calc(100%+8px)] h-[calc(100%+8px)] cursor-pointer border-0 p-0"
                  />
                </div>
                <input
                  type="text"
                  className={`${inputClass} flex-1 uppercase`}
                  value={formData.brand_color}
                  onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })}
                  placeholder="#C49A3C"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Professional Profile */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-4xl border border-[rgba(196,154,60,0.2)] shadow-sm space-y-6">
          <SectionHeader icon={<Award className="w-5 h-5" />} title="Professional Profile" />

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] ml-1">Specialization</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a8a29e]"><Briefcase className="w-5 h-5" /></div>
              <input
                type="text"
                maxLength={200}
                className={`${inputClass} pl-12`}
                value={formData.specialization}
                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                placeholder="e.g. Retirement planning, ESG investing"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] ml-1">Years of Experience</label>
              <input
                type="text"
                className={inputClass}
                value={formData.years_experience}
                onChange={(e) => setFormData({ ...formData, years_experience: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="0"
              />
            </div>
          </div>
        </div>
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

      <Palette className="hidden" />
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
