"use client";

import React, { useState } from "react";
import { Copy, Check, KeyRound, Loader2 } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { EnrolmentInfo } from "@/lib/auth/types";

export const AuthShell: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="flex min-h-screen items-center justify-center bg-[#FDFBFC] dark:bg-[#0F0811] p-4">
    <div className="w-full max-w-md rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-8 shadow-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3A102F] text-white shadow-md">
          <span className="h-3 w-3 rounded-full bg-[#F94B35]" />
        </div>
        <div>
          <p className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
            Amoor<span className="text-[#F94B35]">Go</span>{" "}
            <span className="rounded-md bg-[#FAF0F7] dark:bg-[#331A3B] px-1.5 py-0.5 align-middle text-[10px] font-extrabold uppercase tracking-widest text-[#7A2B66] dark:text-[#E9BFDF]">
              OPS
            </span>
          </p>
          <p className="text-xs text-slate-500">Staff console</p>
        </div>
      </div>
      <h1 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  </div>
);

export const fieldClass =
  "w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#7A2B66] focus:outline-none focus:ring-1 focus:ring-[#7A2B66]";

export const primaryButtonClass =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-[#3A102F] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#521A44] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#7A2B66] dark:hover:bg-[#A74490]";

export const ErrorLine: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <p role="alert" className="rounded-lg bg-[#FFF3F1] dark:bg-[#38110D] px-3 py-2 text-xs font-medium text-[#B02414] dark:text-[#FFA093] break-words">
      {message}
    </p>
  ) : null;

/** TOTP entry; when `enrolment` is given it first shows the authenticator secret / otpauth URL to add to the app. */
export const TwoFactorPanel: React.FC<{
  challengeToken: string;
  enrolment: EnrolmentInfo | null;
  onBack: () => void;
  /** Called after the session is established. */
  onDone?: () => void;
}> = ({ challengeToken, enrolment, onBack, onDone }) => {
  const { verifyTwoFactor } = useAuth();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"secret" | "url" | null>(null);

  const copy = async (what: "secret" | "url", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard unavailable: the value is selectable on screen */
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await verifyTwoFactor(challengeToken, code);
      onDone?.();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {enrolment && (
        <div className="space-y-3 rounded-xl border border-[#E9BFDF] dark:border-[#521A44] bg-[#FAF0F7] dark:bg-[#331A3B]/60 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[#521A44] dark:text-[#E9BFDF]">
            <KeyRound className="h-4 w-4" /> Set up two-factor authentication
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Two-factor authentication is required for your role. Add this account to an authenticator app (Google Authenticator, 1Password, Authy…) by
            entering the setup key, or open the otpauth link on a device that has the app. Then type the 6-digit code below.
          </p>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Setup key</p>
            <div className="mt-1 flex items-center gap-2">
              <code data-testid="totp-secret" className="flex-1 break-all rounded-lg bg-white dark:bg-[#180D1C] px-2 py-1.5 font-mono text-xs text-slate-800 dark:text-slate-100 select-all">
                {enrolment.secret}
              </code>
              <button type="button" onClick={() => copy("secret", enrolment.secret)} className="rounded-lg border border-slate-200 dark:border-[#331A3B] p-1.5 text-slate-500 hover:bg-white dark:hover:bg-[#28162E]" aria-label="Copy setup key">
                {copied === "secret" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">otpauth link (QR payload)</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg bg-white dark:bg-[#180D1C] px-2 py-1.5 font-mono text-[10px] text-slate-600 dark:text-slate-300 select-all">{enrolment.otpauthUrl}</code>
              <button type="button" onClick={() => copy("url", enrolment.otpauthUrl)} className="rounded-lg border border-slate-200 dark:border-[#331A3B] p-1.5 text-slate-500 hover:bg-white dark:hover:bg-[#28162E]" aria-label="Copy otpauth link">
                {copied === "url" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor="totp" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
          Authenticator code
        </label>
        <input
          id="totp"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className={`${fieldClass} text-center font-mono text-lg tracking-[0.4em]`}
        />
      </div>
      <ErrorLine message={error} />
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {enrolment ? "Verify & finish setup" : "Verify & sign in"}
      </button>
      <button type="button" onClick={onBack} disabled={pending} className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        Back to sign in
      </button>
    </form>
  );
};
