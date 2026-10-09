"use client";

import React, { useId, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { errorMessage } from "@/lib/api";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  targetEntityLabel?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  requireReason?: boolean;
  /** Minimum reason length (backend commonly requires 3; the console asks for 6). */
  minReasonLength?: number;
  reasonPlaceholder?: string;
  /**
   * Called with the trimmed reason. May be async: while it runs the dialog shows a spinner and blocks double submits;
   * if it throws (or returns false) the dialog stays open and shows the error so the operator can retry.
   * The caller closes the dialog (isOpen=false) after success.
   */
  onConfirm: (reason: string) => void | boolean | Promise<void | boolean>;
  onCancel: () => void;
  /** Extra fields rendered between the description and the reason box (amounts, selects ...). */
  children?: React.ReactNode;
  /** Disable the confirm button (e.g. required child fields missing). */
  confirmDisabled?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  targetEntityLabel,
  confirmText = "Confirm Action",
  cancelText = "Cancel",
  isDestructive = true,
  requireReason = true,
  minReasonLength = 6,
  reasonPlaceholder = "Provide a mandatory operational justification for the audit trail...",
  onConfirm,
  onCancel,
  children,
  confirmDisabled = false,
}) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const reasonId = useId();

  const handleConfirm = async () => {
    if (pending) return;
    if (requireReason && (!reason || reason.trim().length < minReasonLength)) {
      setError(`Please provide a detailed audit justification (minimum ${minReasonLength} characters).`);
      return;
    }
    setError("");
    setPending(true);
    try {
      const result = await onConfirm(reason.trim());
      if (result !== false) setReason("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  const handleClose = () => {
    if (pending) return;
    setReason("");
    setError("");
    onCancel();
  };

  return (
    <Sheet
      open={isOpen}
      onClose={handleClose}
      variant="center"
      widthClass="sm:max-w-lg"
      dismissible={!pending}
      header={
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              isDestructive ? "bg-[#FFF3F1] text-[#F94B35] dark:bg-[#38110D]" : "bg-[#FAF0F7] text-[#7A2B66] dark:bg-[#331A3B] dark:text-[#E9BFDF]"
            }`}
          >
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
            {targetEntityLabel && <span className="break-all text-xs font-mono text-[#D93320] dark:text-[#FF7361]">Target: {targetEntityLabel}</span>}
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={pending}
            className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-[#28162E] sm:min-h-10"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending || confirmDisabled}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-10 ${
              isDestructive ? "bg-[#D93320] hover:bg-[#B02414]" : "bg-[#3A102F] hover:bg-[#521A44] dark:bg-[#7A2B66] dark:hover:bg-[#A74490]"
            }`}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {confirmText}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{description}</p>

        {children}

        {requireReason && (
          <div className="space-y-1.5">
            <label htmlFor={reasonId} className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Audit Reason <span className="text-[#D93320] dark:text-[#FF7361]">* (Mandatory for Compliance)</span>
            </label>
            <textarea
              id={reasonId}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError("");
              }}
              rows={3}
              maxLength={300}
              placeholder={reasonPlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 placeholder-slate-500 focus:border-[#7A2B66] dark:border-[#331A3B] dark:bg-[#211226] dark:text-white"
            />
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              This note will be permanently recorded in the immutable audit log with your staff identity and IP.
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="break-words text-xs font-medium text-[#B02414] dark:text-[#FF7361]">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
};
