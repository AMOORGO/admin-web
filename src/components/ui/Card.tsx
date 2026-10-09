import React from "react";

/** Standard content panel: border, surface, soft shadow. */
export const Card: React.FC<{ children: React.ReactNode; className?: string; as?: "section" | "div" | "article" }> = ({ children, className = "", as: Tag = "section" }) => (
  <Tag className={`min-w-0 rounded-2xl border border-[#F0E3ED] bg-white shadow-xs dark:border-[#331A3B] dark:bg-[#180D1C] ${className}`}>{children}</Tag>
);

/** Title row of a Card: heading + optional description on the left, actions on the right. */
export const CardHeader: React.FC<{ title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; icon?: React.ElementType; className?: string }> = ({
  title,
  description,
  actions,
  icon: Icon,
  className = "",
}) => (
  <div className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pb-3 pt-4 sm:px-5 sm:pt-5 ${className}`}>
    <div className="flex min-w-0 items-start gap-2.5">
      {Icon && (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FAF0F7] text-[#7A2B66] dark:bg-[#331A3B] dark:text-[#E9BFDF]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <h3 className="text-base font-bold leading-tight text-slate-900 dark:text-white">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-slate-600 dark:text-slate-300">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
