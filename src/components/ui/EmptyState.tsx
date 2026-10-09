"use client";

import React from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon: Icon = Inbox, action, className = "" }) => (
  <div className={`flex flex-col items-center justify-center gap-2 px-6 py-12 text-center ${className}`}>
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FAF0F7] dark:bg-[#331A3B] text-[#7A2B66] dark:text-[#E9BFDF]">
      <Icon className="h-6 w-6" />
    </div>
    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</p>
    {description && <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

/** "Load more" footer for cursor-paginated tables. */
export const LoadMore: React.FC<{ hasMore: boolean; loading: boolean; onClick: () => void }> = ({ hasMore, loading, onClick }) => {
  if (!hasMore) return null;
  return (
    <div className="flex justify-center border-t border-slate-100 dark:border-[#331A3B] p-3">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="rounded-xl border border-slate-200 dark:border-[#331A3B] px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#28162E] disabled:opacity-60"
      >
        {loading ? "Loading…" : "Load more"}
      </button>
    </div>
  );
};
