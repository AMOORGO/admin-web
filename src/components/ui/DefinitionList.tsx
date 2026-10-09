import React from "react";

export interface DefinitionItem {
  label: string;
  value: React.ReactNode;
  /** Monospace value (ids, plates, masked numbers). */
  mono?: boolean;
}

/** Label / value facts in a responsive grid: 12px labels, 14px values, "—" for empty ones. */
export const DefinitionList: React.FC<{ items: DefinitionItem[]; columns?: 1 | 2 | 3; className?: string }> = ({ items, columns = 2, className = "" }) => (
  <dl className={`grid gap-x-6 gap-y-4 ${columns === 3 ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"} ${className}`}>
    {items.map((it) => (
      <div key={it.label} className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{it.label}</dt>
        <dd className={`mt-1 break-words text-sm font-semibold text-slate-900 dark:text-white ${it.mono ? "font-mono tabular-nums" : ""}`}>
          {it.value === null || it.value === undefined || it.value === "" ? <span className="font-normal text-slate-500 dark:text-slate-400">—</span> : it.value}
        </dd>
      </div>
    ))}
  </dl>
);
