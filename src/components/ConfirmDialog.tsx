"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-[#180D1C] border border-[#F0E3ED] dark:border-[#331A3B] shadow-2xl transition-all"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F0E3ED] dark:border-[#331A3B] px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                isDestructive
                  ? "bg-[#FFF3F1] dark:bg-[#38110D] text-[#F94B35]"
                  : "bg-[#FAF0F7] dark:bg-[#331A3B] text-[#7A2B66] dark:text-[#E9BFDF]"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
              {targetEntityLabel && <span className="text-xs font-mono text-[#F94B35]">Target: {targetEntityLabel}</span>}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#28162E] dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{description}</p>

          {children}

          {requireReason && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Audit Reason <span className="text-[#F94B35]">* (Mandatory for Compliance)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError("");
                }}
                rows={3}
                maxLength={300}
                placeholder={reasonPlaceholder}
                className="w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#7A2B66] focus:outline-none focus:ring-1 focus:ring-[#7A2B66]"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                This note will be permanently recorded in the immutable audit log with your staff identity and IP.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="text-xs font-medium text-[#F94B35] break-words">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[#F0E3ED] dark:border-[#331A3B] bg-slate-50/50 dark:bg-[#211226]/50 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={pending}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#28162E] transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending || confirmDisabled}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
              isDestructive
                ? "bg-[#D93320] hover:bg-[#B02414] focus:ring-2 focus:ring-[#F94B35]"
                : "bg-[#3A102F] hover:bg-[#521A44] dark:bg-[#7A2B66] dark:hover:bg-[#A74490] focus:ring-2 focus:ring-[#7A2B66]"
            }`}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
