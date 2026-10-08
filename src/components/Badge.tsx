"use client";

import React from "react";

export type BadgeVariant =
  | "plum"
  | "coral"
  | "teal"
  | "neutral"
  | "warning"
  | "success"
  | "danger";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md" | "lg";
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "plum",
  size = "md",
  dot = false,
  pulse = false,
  className = "",
}) => {
  const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; dotColor: string }> = {
    plum: {
      bg: "bg-[#FAF0F7] dark:bg-[#331A3B]",
      text: "text-[#521A44] dark:text-[#E9BFDF]",
      border: "border-[#E9BFDF] dark:border-[#521A44]",
      dotColor: "bg-[#7A2B66] dark:bg-[#DB99CC]",
    },
    coral: {
      bg: "bg-[#FFF3F1] dark:bg-[#38110D]",
      text: "text-[#B02414] dark:text-[#FFA093]",
      border: "border-[#FFC4BC] dark:border-[#61130A]",
      dotColor: "bg-[#F94B35]",
    },
    teal: {
      bg: "bg-[#EFFCF9] dark:bg-[#0D2620]",
      text: "text-[#14755F] dark:text-[#82E5CB]",
      border: "border-[#B4F2E1] dark:border-[#14755F]",
      dotColor: "bg-[#26B896]",
    },
    neutral: {
      bg: "bg-slate-100 dark:bg-slate-800",
      text: "text-slate-700 dark:text-slate-300",
      border: "border-slate-200 dark:border-slate-700",
      dotColor: "bg-slate-400 dark:bg-slate-500",
    },
    warning: {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-200 dark:border-amber-800",
      dotColor: "bg-amber-500",
    },
    success: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-200 dark:border-emerald-800",
      dotColor: "bg-emerald-500",
    },
    danger: {
      bg: "bg-rose-50 dark:bg-rose-950/40",
      text: "text-rose-700 dark:text-rose-300",
      border: "border-rose-200 dark:border-rose-800",
      dotColor: "bg-rose-500",
    },
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs font-medium rounded-full",
    md: "px-2.5 py-1 text-xs font-semibold rounded-full",
    lg: "px-3 py-1.5 text-sm font-semibold rounded-lg",
  };

  const style = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 border transition-all ${style.bg} ${style.text} ${style.border} ${sizeStyles[size]} ${className}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${style.dotColor} ${
            pulse ? "animate-ping" : ""
          }`}
        />
      )}
      {children}
    </span>
  );
};
