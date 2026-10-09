"use client";

import React from "react";
import { Search } from "lucide-react";

/* Shared page-level layout primitives so every tab reflows the same way from 360px phones to wide desktops. */

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Badge(s) rendered next to the title (e.g. a live-status pill). */
  badge?: React.ReactNode;
  /** Buttons on the right; they wrap under the title on narrow screens. */
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, badge, actions }) => (
  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
    <div className="min-w-0 flex-1 basis-64">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h1 className="text-lg font-black leading-tight text-slate-900 dark:text-white sm:text-xl">{title}</h1>
        {badge}
      </div>
      {description && <p className="mt-0.5 text-[13px] text-slate-600 dark:text-slate-300">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/** Card that holds a view's search / filter controls. */
export const Toolbar: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`space-y-3 rounded-2xl border border-[#F0E3ED] bg-white p-3 shadow-xs dark:border-[#331A3B] dark:bg-[#180D1C] sm:p-4 ${className}`}>{children}</div>
);

/** Row of controls inside a Toolbar: stacks on phones, 2 columns on small tablets, one wrapping line from lg. */
export const FilterRow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:flex lg:flex-wrap lg:items-center ${className}`}>{children}</div>
);

export const fieldClass =
  "min-h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[13px] text-slate-800 placeholder-slate-500 dark:border-[#331A3B] dark:bg-[#211226] dark:text-white lg:w-auto";

interface ChipTabsProps<T extends string> {
  items: ReadonlyArray<{ id: T; label: React.ReactNode }>;
  value: T;
  onChange: (id: T) => void;
  label: string;
  /** "soft" = filled pills (default); "underline" = page-section tabs. */
  className?: string;
}

/** Pill filter / status tabs. Wraps onto extra lines instead of hiding options behind a horizontal scroll. */
export function ChipTabs<T extends string>({ items, value, onChange, label, className = "" }: ChipTabsProps<T>) {
  return (
    <div role="group" aria-label={label} className={`flex flex-wrap gap-1.5 text-[13px] ${className}`}>
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            aria-pressed={active}
            className={`min-h-10 min-w-10 whitespace-nowrap rounded-xl px-3 font-bold transition-colors ${
              active ? "bg-[#3A102F] text-white dark:bg-[#7A2B66]" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[#211226] dark:text-slate-300 dark:hover:bg-[#28162E]"
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "className"> {
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({ value, onValueChange, className = "", placeholder, "aria-label": ariaLabel, ...rest }) => (
  <div className={`relative min-w-0 ${className}`}>
    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-slate-400" aria-hidden="true" />
    <input
      type="search"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      className={`${fieldClass} pl-9 lg:w-full`}
      {...rest}
    />
  </div>
);

/** Section tabs (Finance, Pricing, Staff...): scrolls sideways when they do not fit, with the active one underlined. */
export function SectionTabs<T extends string>({ items, value, onChange, label }: { items: ReadonlyArray<{ id: T; label: React.ReactNode }>; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="-mx-4 flex gap-5 overflow-x-auto border-b border-[#F0E3ED] px-4 text-[13px] font-bold dark:border-[#331A3B] sm:mx-0 sm:gap-6 sm:px-0">
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.id)}
            className={`-mb-px min-h-11 shrink-0 whitespace-nowrap border-b-2 transition-colors ${
              active
                ? "border-[#3A102F] text-[#3A102F] dark:border-[#A74490] dark:text-[#E9BFDF]"
                : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
