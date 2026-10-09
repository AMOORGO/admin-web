"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight, Lock, Minus } from "lucide-react";
import { Sparkline } from "./Sparkline";
import { Skeleton } from "./Skeleton";

export type StatTone = "brand" | "good" | "warn" | "bad" | "info" | "neutral";

const TONES: Record<StatTone, { chip: string; spark: string }> = {
  brand: { chip: "bg-[#FAF0F7] text-[#7A2B66] dark:bg-[#331A3B] dark:text-[#E9BFDF]", spark: "text-[#7A2B66] dark:text-[#DB99CC]" },
  good: { chip: "bg-[#EFFCF9] text-[#14755F] dark:bg-[#0D2620] dark:text-[#82E5CB]", spark: "text-[#189578] dark:text-[#4FD2B2]" },
  warn: { chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300", spark: "text-amber-600 dark:text-amber-400" },
  bad: { chip: "bg-[#FFF3F1] text-[#B02414] dark:bg-[#38110D] dark:text-[#FFA093]", spark: "text-[#D93320] dark:text-[#FF7361]" },
  info: { chip: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300", spark: "text-sky-600 dark:text-sky-400" },
  neutral: { chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", spark: "text-slate-500 dark:text-slate-400" },
};

interface DeltaChipProps {
  /** Percentage change (e.g. 8.4 = +8.4 %). null = no comparison available. */
  pct: number | null | undefined;
  /** Which direction is good news: revenue "up", cancellations / ETA "down". */
  goodWhen?: "up" | "down";
  className?: string;
}

/** Up / down arrow chip. Green = moved the good way, red = the bad way, grey = flat or unknown. */
export const DeltaChip: React.FC<DeltaChipProps> = ({ pct, goodWhen = "up", className = "" }) => {
  if (pct === null || pct === undefined) {
    return <span className={`inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 ${className}`}>No prior data</span>;
  }
  const flat = Math.abs(pct) < 0.05;
  const up = pct > 0;
  const good = flat ? null : up === (goodWhen === "up");
  const cls = flat
    ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
    : good
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      : "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300";
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${cls} ${className}`} title={`${up ? "Up" : "Down"} ${Math.abs(pct).toFixed(1)}% vs the previous period`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {flat ? "0.0%" : `${Math.abs(pct).toFixed(1)}%`}
      <span className="sr-only">{flat ? "no change" : up ? "increase" : "decrease"}</span>
    </span>
  );
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  tone?: StatTone;
  /** Delta chip next to the secondary line. */
  delta?: { pct: number | null | undefined; goodWhen?: "up" | "down" };
  /** Secondary line under the number ("vs previous period", "12 on trip"). */
  hint?: React.ReactNode;
  /** Trend values (oldest -> newest) for the sparkline. */
  spark?: number[];
  sparkLabel?: string;
  onClick?: () => void;
  /** Skeleton while the first response is in flight. */
  loading?: boolean;
  /** Replaces the value with a lock + message (the role lacks the permission). */
  unavailable?: string;
  size?: "md" | "lg";
  className?: string;
}

/**
 * KPI tile: label, big tabular number, delta chip, secondary line and an optional sparkline.
 * Becomes a button when `onClick` is set.
 */
export const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, tone = "brand", delta, hint, spark, sparkLabel, onClick, loading, unavailable, size = "md", className = "" }) => {
  const t = TONES[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-[13px] font-semibold leading-snug text-slate-700 dark:text-slate-200">{label}</span>
        {Icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.chip}`}>
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        )}
      </div>
      {loading ? (
        <div className="mt-3 space-y-2" role="status" aria-label="Loading">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3.5 w-36" />
        </div>
      ) : unavailable ? (
        <div className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{unavailable}</span>
        </div>
      ) : (
        <div className="mt-2">
          <div className={`break-words font-extrabold leading-tight tracking-tight text-slate-900 tabular-nums dark:text-white ${size === "lg" ? "text-3xl sm:text-[32px]" : "text-2xl sm:text-[28px]"}`}>{value}</div>
          {(delta || hint) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
              {delta && <DeltaChip pct={delta.pct} goodWhen={delta.goodWhen} />}
              {hint && <span className="min-w-0">{hint}</span>}
            </div>
          )}
          {spark && spark.length > 1 && <Sparkline values={spark} label={sparkLabel} className={`mt-3 h-9 w-full ${t.spark}`} />}
        </div>
      )}
    </>
  );
  const base = `min-w-0 rounded-2xl border border-[#F0E3ED] bg-white p-4 text-left shadow-xs dark:border-[#331A3B] dark:bg-[#180D1C] sm:p-5 ${className}`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} block w-full cursor-pointer transition-colors hover:border-[#7A2B66] focus-visible:outline-2 dark:hover:border-[#A74490]`}>
        {body}
      </button>
    );
  }
  return <div className={base}>{body}</div>;
};

/** Responsive grid for stat cards: 1 col phone, 2 tablet, `cols` desktop. */
export const StatGrid: React.FC<{ children: React.ReactNode; cols?: 3 | 4 | 5 | 6; className?: string }> = ({ children, cols = 4, className = "" }) => {
  const map: Record<number, string> = {
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 xl:grid-cols-4",
    5: "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5",
    6: "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6",
  };
  return <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${map[cols]} ${className}`}>{children}</div>;
};
