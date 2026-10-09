import React from "react";

/** Avatar + name (+ secondary line) cell used by every people table. Truncates long names with a tooltip. */
export const PersonCell: React.FC<{ name: string; avatar: string; subtitle?: React.ReactNode; size?: "sm" | "md"; className?: string }> = ({ name, avatar, subtitle, size = "md", className = "" }) => (
  <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={avatar} alt="" className={`${size === "sm" ? "h-7 w-7" : "h-9 w-9"} shrink-0 rounded-full border border-[#E9BFDF] object-cover dark:border-[#521A44]`} />
    <div className="min-w-0">
      <p className="max-w-[14rem] truncate text-sm font-semibold text-slate-900 dark:text-white" title={name}>
        {name}
      </p>
      {subtitle && <p className="max-w-[14rem] truncate text-xs text-slate-600 dark:text-slate-300">{subtitle}</p>}
    </div>
  </div>
);
