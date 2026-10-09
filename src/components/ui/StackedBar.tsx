import React from "react";
import { formatNumber } from "@/lib/format";

export interface StackedSegment {
  key: string;
  label: string;
  value: number;
  /** Tailwind background class for the segment and its legend swatch. */
  color: string;
  hint?: string;
}

interface StackedBarProps {
  segments: StackedSegment[];
  /** Label for the grand total ("Rides requested"). */
  totalLabel: string;
  /** Override the total (defaults to the sum of the segments). */
  total?: number;
  className?: string;
}

/**
 * One segmented bar for part-of-whole data plus a legend that spells out count AND percentage for every part
 * (colour is never the only carrier of meaning).
 */
export const StackedBar: React.FC<StackedBarProps> = ({ segments, totalLabel, total, className = "" }) => {
  const sum = total ?? segments.reduce((a, s) => a + s.value, 0);
  const pct = (v: number) => (sum > 0 ? (v / sum) * 100 : 0);
  const summary = segments.map((s) => `${s.label} ${formatNumber(s.value)} (${pct(s.value).toFixed(0)}%)`).join(", ");
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{totalLabel}</span>
        <span className="text-3xl font-extrabold tabular-nums leading-none text-slate-900 dark:text-white">{formatNumber(sum)}</span>
      </div>
      <div role="img" aria-label={`${totalLabel}: ${summary}`} className="mt-3 flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-[#211226]">
        {sum > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div key={s.key} className={`${s.color} h-full first:rounded-l-full last:rounded-r-full`} style={{ width: `${Math.max(pct(s.value), 1.5)}%` }} title={`${s.label}: ${formatNumber(s.value)} (${pct(s.value).toFixed(1)}%)`} />
            ))}
      </div>
      <ul className="mt-4 divide-y divide-[#F0E3ED] dark:divide-[#331A3B]">
        {segments.map((s) => (
          <li key={s.key} className="flex min-h-11 items-center gap-3 py-2 text-sm">
            <span className={`h-3 w-3 shrink-0 rounded-[4px] ${s.color}`} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-slate-800 dark:text-slate-100">{s.label}</span>
              {s.hint && <span className="block text-xs text-slate-600 dark:text-slate-300">{s.hint}</span>}
            </span>
            <span className="w-14 text-right text-base font-bold tabular-nums text-slate-900 dark:text-white">{formatNumber(s.value)}</span>
            <span className="w-14 text-right text-sm font-semibold tabular-nums text-slate-600 dark:text-slate-300">{pct(s.value).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
