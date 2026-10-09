"use client";

import React from "react";

export const CARD = "rounded-3xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-4 shadow-xs sm:p-6";
export const FIELD_BOX = "space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#211226] border border-slate-200 dark:border-[#331A3B]";
export const INPUT = "w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2 text-sm font-mono dark:bg-[#180D1C] dark:text-white disabled:opacity-60";
export const SELECT = "rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200";
export const BTN_PRIMARY = "rounded-xl bg-[#189578] hover:bg-[#14755F] text-white px-5 py-2 text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-2 shadow-sm";
export const BTN_PLUM = "rounded-xl bg-[#3A102F] hover:bg-[#521A44] text-white px-4 py-2 text-xs font-bold transition-all disabled:opacity-40";
export const BTN_GHOST = "rounded-lg border border-slate-200 dark:border-[#331A3B] px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#28162E] disabled:opacity-50";

interface NumFieldProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  min?: string;
  disabled?: boolean;
  tone?: string;
}

/** Labelled numeric input in the same box style as the original rate matrix. Values stay strings until saved. */
export const NumField: React.FC<NumFieldProps> = ({ label, hint, value, onChange, step = "0.01", min = "0", disabled, tone = "" }) => (
  <div className={FIELD_BOX}>
    <label className="block font-bold text-slate-700 dark:text-slate-200">{label}</label>
    <input
      type="number"
      step={step}
      min={min}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`${INPUT} ${tone}`}
    />
    {hint && <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
  </div>
);

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}

/** Accessible switch (button role="switch"). */
export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    data-compact
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors after:absolute after:-inset-x-2 after:-inset-y-2.5 after:content-[''] disabled:opacity-50 ${checked ? "bg-[#189578]" : "bg-slate-300 dark:bg-slate-600"}`}
  >
    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
  </button>
);
