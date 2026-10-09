"use client";

import React from "react";
import { useClock } from "@/lib/hooks/useClock";
import { formatDateTime, formatRelative } from "@/lib/format";

/** "5 min ago" with the exact timestamp as a tooltip; refreshes with the shared 30 s clock. */
export const RelativeTime: React.FC<{ iso: string | null | undefined; className?: string }> = ({ iso, className = "" }) => {
  const now = useClock();
  if (!iso) return <span className={className}>—</span>;
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={`whitespace-nowrap ${className}`}>
      {formatRelative(iso, now)}
    </time>
  );
};
