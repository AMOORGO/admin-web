"use client";

import React from "react";

export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div aria-hidden className={`animate-pulse rounded-lg bg-slate-200/70 dark:bg-[#331A3B]/70 ${className}`} />
);

/** Placeholder rows for a table while its first page loads. */
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 6, cols = 5 }) => (
  <div role="status" aria-label="Loading" className="divide-y divide-slate-100 dark:divide-[#331A3B]">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex items-center gap-4 px-4 py-4">
        {Array.from({ length: cols }).map((__, c) => (
          <Skeleton key={c} className={`h-4 ${c === 0 ? "w-28" : "flex-1"}`} />
        ))}
      </div>
    ))}
  </div>
);

/** Placeholder tiles for KPI cards. */
export const CardsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div role="status" aria-label="Loading" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-5 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-3 w-32" />
      </div>
    ))}
  </div>
);
