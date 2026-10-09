"use client";

import React, { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEscapeKey, useFocusTrap, useScrollLock } from "@/lib/hooks/useOverlay";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name when no visible `header` is given. */
  label?: string;
  /** "right": side drawer from sm up; "center": dialog from sm up. Always a full-screen sheet on phones. */
  variant?: "right" | "center";
  /** Tailwind max-width class applied from sm up (e.g. "sm:max-w-xl"). */
  widthClass?: string;
  /** Title area of the sticky header (the close button is added for you). */
  header?: React.ReactNode;
  /** Optional sticky strip under the header (tabs, filters). */
  subheader?: React.ReactNode;
  /** Sticky action bar (safe-area aware). */
  footer?: React.ReactNode;
  /** Header / footer surface tint. */
  headerClassName?: string;
  /** Center variant: use (almost) the full viewport height on sm+ instead of fitting the content. */
  fill?: boolean;
  /** Overrides the default body padding. */
  bodyClassName?: string;
  /** Set false while an action is in flight to block Esc / backdrop / close-button dismissal. */
  dismissible?: boolean;
  /** Coral frame for emergency screens (SOS). */
  danger?: boolean;
  /** Use a darker backdrop for high-stakes screens (SOS). */
  strongBackdrop?: boolean;
  children: React.ReactNode;
}

/**
 * The single modal primitive: portal to <body> (own stacking context above the navbar / sidebar), solid panel, scroll lock,
 * Esc to close, focus trap + focus restore, safe-area padding, sticky header / footer and a full-screen layout on phones.
 */
export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  label,
  variant = "right",
  widthClass = "sm:max-w-xl",
  header,
  subheader,
  footer,
  headerClassName = "",
  fill = false,
  bodyClassName = "p-4 sm:p-6",
  dismissible = true,
  danger = false,
  strongBackdrop = false,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const requestClose = () => {
    if (dismissible) onClose();
  };
  useScrollLock(open);
  useEscapeKey(open, requestClose);
  useFocusTrap(panelRef, open);

  if (!open || typeof document === "undefined") return null;

  const isRight = variant === "right";
  // Compact dialogs become bottom sheets on phones; `fill` ones stay full-screen.
  return createPortal(
    <div className={`fixed inset-0 z-[100] flex ${isRight ? "justify-end" : `${fill ? "" : "items-end"} sm:items-center sm:justify-center sm:p-6`}`}>
      <div
        aria-hidden="true"
        onClick={requestClose}
        className={`anim-fade absolute inset-0 ${strongBackdrop ? "bg-black/75" : "bg-black/55"} backdrop-blur-[2px]`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={header ? titleId : undefined}
        aria-label={header ? undefined : label}
        tabIndex={-1}
        className={`relative flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-white text-[#1C121A] shadow-2xl outline-none dark:bg-[#180D1C] dark:text-[#FBF8FA] ${widthClass} ${
          isRight
            ? "anim-sheet-right sm:h-dvh sm:border-l sm:border-[#F0E3ED] sm:dark:border-[#331A3B]"
            : `sm:rounded-2xl ${fill ? "anim-pop sm:h-[92dvh]" : "anim-sheet-up max-sm:h-auto max-sm:max-h-[92dvh] max-sm:rounded-t-2xl sm:h-auto sm:max-h-[min(90dvh,820px)]"} ${danger ? "sm:border-2 sm:border-[#F94B35]" : "sm:border sm:border-[#F0E3ED] sm:dark:border-[#331A3B]"}`
        }`}
      >
        <div
          className={`flex shrink-0 items-start gap-3 border-b border-[#F0E3ED] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-[#331A3B] sm:px-6 sm:pt-4 ${headerClassName}`}
        >
          <div id={titleId} className="min-w-0 flex-1">
            {header}
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={!dismissible}
            aria-label="Close"
            className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A2B66] disabled:opacity-50 dark:text-slate-400 dark:hover:bg-[#28162E] dark:hover:text-white sm:h-10 sm:w-10"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {subheader && <div className="shrink-0 border-b border-[#F0E3ED] dark:border-[#331A3B]">{subheader}</div>}

        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${bodyClassName}`}>{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-[#F0E3ED] bg-slate-50/80 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:border-[#331A3B] dark:bg-[#211226]/80 sm:px-6 sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
