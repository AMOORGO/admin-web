"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { errorMessage, isApiError } from "@/lib/api";

interface ErrorBannerProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

/** Inline error banner for failed loads and mutations. Shows the backend message and, when present, its request id. */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, title = "Something went wrong", onRetry, className = "" }) => {
  if (!error) return null;
  const requestId = isApiError(error) ? error.requestId : undefined;
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border border-[#FFC4BC] dark:border-[#61130A] bg-[#FFF3F1] dark:bg-[#38110D] px-4 py-3 text-sm ${className}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D93320] dark:text-[#FF7361]" />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-[#B02414] dark:text-[#FFA093]">{title}</p>
        <p className="mt-0.5 break-words text-[#B02414]/90 dark:text-[#FFA093]/90">{errorMessage(error)}</p>
        {requestId && <p className="mt-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">Request ID: {requestId}</p>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#FFC4BC] dark:border-[#61130A] px-2.5 py-1 text-xs font-semibold text-[#B02414] dark:text-[#FFA093] hover:bg-white/60 dark:hover:bg-black/20"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      )}
    </div>
  );
};
