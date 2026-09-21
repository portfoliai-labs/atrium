"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { Option } from "../../../lib/ips";

export const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wider text-[#78716c] ml-1";
export const INPUT_CLASS =
  "w-full p-3.5 bg-white border border-[rgba(196,154,60,0.25)] rounded-xl font-medium text-[#1c1917] outline-none focus:border-[#C49A3C] focus:ring-4 focus:ring-[#C49A3C]/10 transition-all placeholder:text-[#a8a29e]";

export function Field({
  label, hint, className = "", children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  // The label wraps its input, so clicking the text focuses it and screen readers announce it.
  // The text block takes the spare height, so side-by-side fields keep their inputs level
  // whatever the length of their hints.
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="block flex-1">
        <span className={LABEL_CLASS}>{label}</span>
        {hint && <span className="block text-xs text-[#78716c] font-medium mt-1 ml-1">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

// Groups that hold several controls (choice cards, chips) use a fieldset instead of a label.
export function FieldGroup({
  label, hint, className = "", children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className={`space-y-2 ${className}`}>
      <legend className="block">
        <span className={LABEL_CLASS}>{label}</span>
        {hint && <span className="block text-xs text-[#78716c] font-medium mt-1 ml-1">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

export function NumberInput({
  value, onChange, placeholder, suffix, min = 0, max, step, "aria-label": ariaLabel,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  "aria-label"?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => {
          if (e.target.value === "") return onChange(null);
          const n = Number(e.target.value);
          if (Number.isNaN(n)) return;
          onChange(max !== undefined ? Math.min(n, max) : n);
        }}
        className={`${INPUT_CLASS} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${suffix ? "pr-14" : ""}`}
      />
      {suffix && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#a8a29e] pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function TextInput({
  value, onChange, placeholder, maxLength = 200,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <input
      type="text"
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT_CLASS}
    />
  );
}

export function TextArea({
  value, onChange, placeholder, maxLength = 1000,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <textarea
      rows={3}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${INPUT_CLASS} resize-y`}
    />
  );
}

/** One choice out of a few, as cards; picking the selected one again clears it. */
export function ChoiceCards<T extends string>({
  options, value, onChange, columns = 3,
}: {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  columns?: 2 | 3 | 4;
}) {
  const grid = columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid grid-cols-1 ${grid} gap-3`}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : o.value)}
            className={`text-left p-4 rounded-2xl border-2 transition-all ${
              selected
                ? "border-[#C49A3C] bg-[#C49A3C]/10"
                : "border-[rgba(196,154,60,0.2)] bg-white hover:border-[#C49A3C]/60"
            }`}
          >
            <span className="block text-sm font-bold text-[#1c1917]">{o.label}</span>
            {o.hint && <span className="block text-xs text-[#78716c] font-medium mt-1 leading-snug">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Pick any number of the given options. */
export function ChipSelect({
  options, selected, onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const toggle = (o: string) =>
    onChange(selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o)}
            className={`px-4 py-2 rounded-full border text-[13px] font-semibold transition-all ${
              on
                ? "border-[#1c1917] bg-[#1c1917] text-white"
                : "border-[rgba(196,154,60,0.3)] bg-white text-[#44403c] hover:border-[#C49A3C]"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** A free list of short entries, with suggestions to add in one click. */
export function TagList({
  values, onChange, suggestions = [], placeholder, limit = 20,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  limit?: number;
}) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v || values.length >= limit || values.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...values, v]);
  };

  const remaining = suggestions.filter((s) => !values.some((x) => x.toLowerCase() === s.toLowerCase()));

  return (
    <div className="space-y-3">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <span
              key={v}
              className="flex items-center gap-2 pl-4 pr-2 py-1.5 rounded-full border border-[#e7e1d3] bg-white text-[13px] font-semibold text-[#44403c]"
            >
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="p-1 rounded-full text-[#a8a29e] hover:text-rose-500 hover:bg-rose-50"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-[#d6cdb8] text-[12px] font-semibold text-[#78716c] hover:border-[#C49A3C] hover:text-[#C49A3C] transition-all"
            >
              <Plus className="w-3 h-3" /> {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          maxLength={60}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
              setDraft("");
            }
          }}
          className={INPUT_CLASS}
        />
        <button
          type="button"
          disabled={!draft.trim()}
          onClick={() => { add(draft); setDraft(""); }}
          className="shrink-0 px-5 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] transition-colors disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function YesNo({
  value, onChange,
}: {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <ChoiceCards
      columns={2}
      options={[
        { value: "no", label: "No" },
        { value: "yes", label: "Yes" },
      ]}
      value={value === null ? null : value ? "yes" : "no"}
      onChange={(v) => onChange(v === null ? null : v === "yes")}
    />
  );
}
