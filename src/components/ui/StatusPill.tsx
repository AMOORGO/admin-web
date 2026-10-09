"use client";

import React from "react";
import { Badge, type BadgeVariant } from "@/components/Badge";

/**
 * Status chip with one colour language across the console:
 * teal = healthy / done, plum = in progress, amber = waiting / needs attention, coral = failed / cancelled / blocked, grey = inactive.
 */
export const StatusPill: React.FC<{ variant?: BadgeVariant; children: React.ReactNode; dot?: boolean; title?: string; className?: string }> = ({
  variant = "neutral",
  children,
  dot = true,
  title,
  className = "",
}) => (
  <span title={title} className="inline-flex max-w-full">
    <Badge variant={variant} size="sm" dot={dot} className={`min-h-6 max-w-full whitespace-nowrap ${className}`}>
      {children}
    </Badge>
  </span>
);
