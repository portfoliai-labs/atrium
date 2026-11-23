"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2, Palette, Award, Save, Loader2, CheckCircle2, AlertCircle,
  ImagePlus, Trash2, Briefcase, BadgeCheck, Handshake, Clock, Compass,
} from "lucide-react";
import { advisorService } from "../../services/advisorService";
import { clientsKey, useClientsQuery } from "../../context/ClientsContext";
import { ApiError } from "../../services/apiClient";
import {
  ASSET_CLASS_OPTIONS, FEE_OPTIONS, HORIZON_OPTIONS, INSTRUMENT_OPTIONS, LANGUAGE_OPTIONS, MEETING_OPTIONS,
  PURPOSE_OPTIONS, REVIEW_OPTIONS, RISK_PROFILE_OPTIONS, TOPIC_OPTIONS,
} from "../../lib/ips";
import type { AdvisorProfile, AdvisorStatement, AdvisorStatementPayload } from "../../models/Advisor";
import { ChoiceCards, ChipSelect, Field, FieldGroup, NumberInput, TextArea, TextInput, YesNo } from "./ips/fields";

const DEFAULT_BRAND_COLOR = "#C49A3C";

const EMPTY_STATEMENT: AdvisorStatementPayload = {
  languages: [], meetingModes: [], city: "", feeModels: [], topics: [], minClientWealth: null,
  acceptingClients: false, bio: "", registerNumber: "",
  assetClasses: [], instruments: [], leverage: false, purposes: [], riskProfiles: [], horizons: [], reviewFrequency: null,
};

const readProfile = () => advisorService.getAdvisorProfile();

/** The form's fields, from the profile as read (empty without one). */
const profileForm = (profile: AdvisorProfile | undefined) => ({
  company_name: profile?.company_name || "",
  specialization: profile?.specialization || "",
  years_experience: profile?.years_experience != null ? String(profile.years_experience) : "",
  brand_color: profile?.brand_color || DEFAULT_BRAND_COLOR,
});

/** What the advisor offers, as the form edits it. */
const statementForm = (saved: AdvisorStatement): AdvisorStatementPayload => ({
  languages: saved.languages, meetingModes: saved.meetingModes, city: saved.city, feeModels: saved.feeModels,
  topics: saved.topics, minClientWealth: saved.minClientWealth, acceptingClients: saved.acceptingClients,
  bio: saved.bio, registerNumber: saved.registerNumber,
  assetClasses: saved.assetClasses ?? [], instruments: saved.instruments ?? [], leverage: saved.leverage ?? false,
  purposes: saved.purposes ?? [], riskProfiles: saved.riskProfiles ?? [], horizons: saved.horizons ?? [],
  reviewFrequency: saved.reviewFrequency ?? null,
});

// A refusal of the statement names its field as a camelCase path (e.g. "assetClasses.0"): its
// first part is the form's field.
interface StatementRefusal {
  field: string;
  message: string;
}

const statementRefusalOf = (err: unknown): StatementRefusal | null =>
  err instanceof ApiError && err.errorType === "InvalidFieldError" && err.metadata.field
    ? { field: err.metadata.field.split(".")[0], message: err.message }
    : null;

/**
 * The advisor's profile and statement, in the query cache under ["clients", "advisorProfile"] and
 * ["clients", "advisorStatement"]; the form starts from them once both are read (empty where one
 * couldn't be).
 */
export function AdvisorProfileSection() {
  const profile = useClientsQuery(["advisorProfile"], readProfile);
  const statement = useClientsQuery(["advisorStatement"], () => advisorService.getAdvisorStatement());

  if (profile.isPending || statement.isPending) return (
    <div className="flex justify-center py-20">
      <Loader2 className="animate-spin text-[#C49A3C]" />
    </div>
  );
  return <AdvisorProfileForm profile={profile.data} statement={statement.data ?? null} />;
}

function AdvisorProfileForm({ profile, statement: initialStatement }: { profile: AdvisorProfile | undefined; statement: AdvisorStatement | null }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState(() => profileForm(profile));
  const [logoUrl, setLogoUrl] = useState<string | null>(profile?.logo_url || null);
  // What the advisor offers (investors are matched on it) and their OCF register number.
  const [statement, setStatement] = useState<AdvisorStatementPayload>(() => (initialStatement ? statementForm(initialStatement) : EMPTY_STATEMENT));
  const [verifiedAt, setVerifiedAt] = useState<string | null>(initialStatement?.verifiedAt ?? null);
  const [savedRegisterNumber, setSavedRegisterNumber] = useState(initialStatement?.registerNumber ?? "");
  const [refusal, setRefusal] = useState<StatementRefusal | null>(null);
  const setOffer = (patch: Partial<AdvisorStatementPayload>) => {
    setStatement((s) => ({ ...s, ...patch }));
    // Changing the refused field clears its refusal.
    setRefusal((r) => (r && r.field in patch ? null : r));
  };
  const errorOf = (field: keyof AdvisorStatementPayload) => (refusal?.field === field ? refusal.message : null);

  const applyStatement = (saved: AdvisorStatement) => {
    setStatement(statementForm(saved));
    setVerifiedAt(saved.verifiedAt);
    setSavedRegisterNumber(saved.registerNumber);
  };

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // The profile read again, into the form.
  const loadProfile = async () => {
    const loaded = await queryClient.fetchQuery({ queryKey: clientsKey("advisorProfile"), queryFn: readProfile, staleTime: 0 });
    setFormData(profileForm(loaded));
    setLogoUrl(loaded.logo_url || null);
  };

  const handleSave = async () => {
    setSaving(true);
    setRefusal(null);
    try {
      await advisorService.updateAdvisorProfile({
        company_name: formData.company_name.trim() || null,
        specialization: formData.specialization.trim() || null,
        years_experience: formData.years_experience !== "" ? parseInt(formData.years_experience, 10) : null,
        clients_count: null,
        aum: null,
        brand_color: formData.brand_color || null,
      });
      void queryClient.invalidateQueries({ queryKey: clientsKey("advisorProfile") });
      const saved = await advisorService.saveAdvisorStatement(statement);
      queryClient.setQueryData(clientsKey("advisorStatement"), saved);
      applyStatement(saved);
      showMessage("success", "Profile updated successfully");
    } catch (err) {
      console.error("Update error:", err);
      const refused = statementRefusalOf(err);
      setRefusal(refused);
      showMessage("error", refused ? refused.message : "Error saving profile");
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
      queryClient.setQueryData<AdvisorProfile>(clientsKey("advisorProfile"), (prev) => prev && { ...prev, logo_url: null });
      showMessage("success", "Logo removed");
    } catch (err) {
      console.error("Logo delete error:", err);
      showMessage("error", "Error removing logo");
    } finally {
      setUploadingLogo(false);
    }
  };

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
                    <ImagePlus className="w-6 h-6 text-[#857e78]" />
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
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#857e78]"><Briefcase className="w-5 h-5" /></div>
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
        {/* Verification */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-4xl border border-[rgba(196,154,60,0.2)] shadow-sm space-y-6">
          <SectionHeader icon={<BadgeCheck className="w-5 h-5" />} title="Verification" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
            <Field label="OCF register number" hint="Your number on the albo unico dei consulenti finanziari. We check it before suggesting you to investors." error={errorOf("registerNumber")}>
              <TextInput value={statement.registerNumber} onChange={(registerNumber) => setOffer({ registerNumber })} placeholder="e.g. 12345" />
            </Field>
            <VerificationBadge
              verifiedAt={statement.registerNumber.trim() === savedRegisterNumber.trim() ? verifiedAt : null}
              hasNumber={statement.registerNumber.trim() !== ""}
            />
          </div>
        </div>

        {/* What you offer */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-4xl border border-[rgba(196,154,60,0.2)] shadow-sm space-y-8">
          <SectionHeader icon={<Handshake className="w-5 h-5" />} title="What you offer" />

          <FieldGroup label="Taking on new clients" hint="Only then are you suggested to investors looking for an advisor.">
            <YesNo value={statement.acceptingClients} onChange={(v) => setOffer({ acceptingClients: v === true })} />
          </FieldGroup>

          <FieldGroup label="Languages" hint="The languages you advise in." error={errorOf("languages")}>
            <ChipSelect options={LANGUAGE_OPTIONS} selected={statement.languages} onChange={(languages) => setOffer({ languages })} />
          </FieldGroup>

          <FieldGroup label="How you meet clients" error={errorOf("meetingModes")}>
            <ChipSelect options={MEETING_OPTIONS} selected={statement.meetingModes} onChange={(meetingModes) => setOffer({ meetingModes })} />
          </FieldGroup>

          {statement.meetingModes.includes("in_person") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="City" hint="Where you meet clients in person." error={errorOf("city")}>
                <TextInput value={statement.city} onChange={(city) => setOffer({ city })} placeholder="e.g. Milano" />
              </Field>
            </div>
          )}

          <FieldGroup label="How you are paid" error={errorOf("feeModels")}>
            <ChipSelect options={FEE_OPTIONS} selected={statement.feeModels} onChange={(feeModels) => setOffer({ feeModels })} />
          </FieldGroup>

          <FieldGroup label="Topics" hint="What you help with, beyond the portfolio." error={errorOf("topics")}>
            <ChipSelect options={TOPIC_OPTIONS} selected={statement.topics} onChange={(topics) => setOffer({ topics })} />
          </FieldGroup>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Smallest client wealth" hint="Leave empty if you take on any client." error={errorOf("minClientWealth")}>
              <NumberInput value={statement.minClientWealth} onChange={(minClientWealth) => setOffer({ minClientWealth })} placeholder="0" suffix="EUR" />
            </Field>
          </div>

          <Field label="About you" hint="Who you are and how you work: what investors read when you are suggested to them." error={errorOf("bio")}>
            <TextArea value={statement.bio} onChange={(bio) => setOffer({ bio })} maxLength={3000} />
          </Field>
        </div>

        {/* What you manage: the investor policy's words */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-4xl border border-[rgba(196,154,60,0.2)] shadow-sm space-y-8">
          <SectionHeader icon={<Compass className="w-5 h-5" />} title="What you manage" />
          <p className="text-sm text-[#78716c] -mt-2">
            Investors are matched on their whole Investment Policy, in these same words. You are not suggested to an investor
            when a class they put 10% or more in is one you don&apos;t manage, when you handle none of the instruments they
            allow, when their risk profile is at the opposite end of yours, or when you review less often than they ask.
            What they leave unset never counts; the rest ranks you among the advisors suggested.
          </p>

          <FieldGroup label="Asset classes" hint="The classes you manage." error={errorOf("assetClasses")}>
            <ChipSelect options={ASSET_CLASS_OPTIONS} selected={statement.assetClasses} onChange={(assetClasses) => setOffer({ assetClasses })} />
          </FieldGroup>

          <FieldGroup label="Instruments" hint="The instruments you handle." error={errorOf("instruments")}>
            <ChipSelect options={INSTRUMENT_OPTIONS} selected={statement.instruments} onChange={(instruments) => setOffer({ instruments })} />
          </FieldGroup>

          <FieldGroup label="Leverage" hint="Whether you advise on leveraged positions." error={errorOf("leverage")}>
            <YesNo value={statement.leverage} onChange={(v) => setOffer({ leverage: v === true })} />
          </FieldGroup>

          <FieldGroup label="Purposes" hint="What the portfolios you manage are for." error={errorOf("purposes")}>
            <ChipSelect options={PURPOSE_OPTIONS} selected={statement.purposes} onChange={(purposes) => setOffer({ purposes })} />
          </FieldGroup>

          <FieldGroup label="Risk profiles" hint="The investors you follow, by how much loss they bear." error={errorOf("riskProfiles")}>
            <ChipSelect options={RISK_PROFILE_OPTIONS} selected={statement.riskProfiles} onChange={(riskProfiles) => setOffer({ riskProfiles })} />
          </FieldGroup>

          <FieldGroup label="Horizons" hint="How long your clients invest for." error={errorOf("horizons")}>
            <ChipSelect options={HORIZON_OPTIONS} selected={statement.horizons} onChange={(horizons) => setOffer({ horizons })} />
          </FieldGroup>

          <FieldGroup label="Reviews" hint="The most frequent review you offer; investors asking for more frequent ones are not suggested you." error={errorOf("reviewFrequency")}>
            <ChoiceCards columns={4} options={REVIEW_OPTIONS} value={statement.reviewFrequency} onChange={(reviewFrequency) => setOffer({ reviewFrequency })} />
          </FieldGroup>
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

function VerificationBadge({ verifiedAt, hasNumber }: { verifiedAt: string | null; hasNumber: boolean }) {
  if (verifiedAt) {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-2xl px-4 py-3.5">
        <BadgeCheck className="w-4 h-4" /> Verified on {new Date(verifiedAt).toLocaleDateString()}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-[#78716c] bg-[#F7F5EF] rounded-2xl px-4 py-3.5">
      <Clock className="w-4 h-4" />
      {hasNumber ? "To be verified: we will check your number on the register" : "Add your register number to be verified"}
    </p>
  );
}
