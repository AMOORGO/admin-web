"use client";

import React from "react";
import { formatMoney, formatMoneyCompact } from "@/lib/format";

interface MoneyProps {
  /** Minor units (cents). null / undefined renders an em dash. */
  minor: number | null | undefined;
  currency?: string;
  /** Show "+" for positive values and colour negatives. */
  signed?: boolean;
  /** "$1.2K" instead of "$1,234.56". */
  compact?: boolean;
  className?: string;
}

/** Currency value with tabular numerals (columns of amounts line up); negatives are red, "+" amounts green when signed. */
export const Money: React.FC<MoneyProps> = ({ minor, currency = "USD", signed = false, compact = false, className = "" }) => {
  if (minor === null || minor === undefined) return <span className={`text-slate-500 dark:text-slate-400 ${className}`}>—</span>;
  const text = compact ? formatMoneyCompact(minor, currency) : formatMoney(minor, currency);
  const tone = signed ? (minor < 0 ? "text-rose-700 dark:text-rose-300" : minor > 0 ? "text-emerald-700 dark:text-emerald-300" : "") : "";
  return (
    <span className={`tabular-nums ${tone} ${className}`} title={compact ? formatMoney(minor, currency) : undefined}>
      {signed && minor > 0 ? "+" : ""}
      {text}
    </span>
  );
};
