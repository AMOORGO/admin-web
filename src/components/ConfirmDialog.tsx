"use client";

import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  targetEntityLabel?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  requireReason?: boolean;
  reasonPlaceholder?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
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
  reasonPlaceholder = "Provide a mandatory operational justification for the audit trail...",
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireReason && (!reason || reason.trim().length < 6)) {
      setError("Please provide a detailed audit justification (minimum 6 characters).");
      return;
    }
    setError("");
    onConfirm(reason.trim());
    setReason("");
  };

  const handleClose = () => {
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
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {title}
              </h3>
              {targetEntityLabel && (
                <span className="text-xs font-mono text-[#F94B35]">
                  Target: {targetEntityLabel}
                </span>
              )}
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
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {description}
          </p>

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
                placeholder={reasonPlaceholder}
                className="w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#7A2B66] focus:outline-none focus:ring-1 focus:ring-[#7A2B66]"
              />
              {error && (
                <p className="text-xs font-medium text-[#F94B35] animate-shake">
                  {error}
                </p>
              )}
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                This note will be permanently recorded in the immutable audit log with your staff identity and IP.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[#F0E3ED] dark:border-[#331A3B] bg-slate-50/50 dark:bg-[#211226]/50 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#28162E] transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm transition-all ${
              isDestructive
                ? "bg-[#D93320] hover:bg-[#B02414] focus:ring-2 focus:ring-[#F94B35]"
                : "bg-[#3A102F] hover:bg-[#521A44] dark:bg-[#7A2B66] dark:hover:bg-[#A74490] focus:ring-2 focus:ring-[#7A2B66]"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
