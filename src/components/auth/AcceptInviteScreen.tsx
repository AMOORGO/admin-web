"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { EnrolmentInfo } from "@/lib/auth/types";
import { AuthShell, ErrorLine, TwoFactorPanel, fieldClass, primaryButtonClass } from "./AuthCard";

type Step = { kind: "password" } | { kind: "twoFactor"; challengeToken: string; enrolment: EnrolmentInfo | null };

/** Landing page for the invitation e-mail link (/accept-invite/<token>): choose a password, then finish 2FA enrolment. */
export const AcceptInviteScreen: React.FC<{ token: string }> = ({ token }) => {
  const router = useRouter();
  const { acceptInvite, startEnrolment, status } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (password.length < 12) {
      setError("Use at least 12 characters, mixing letters, numbers and symbols.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await acceptInvite(token, password);
      if (res.status === "TWO_FACTOR_REQUIRED") {
        const enrolment = res.enrolmentRequired ? await startEnrolment(res.challengeToken) : null;
        setStep({ kind: "twoFactor", challengeToken: res.challengeToken, enrolment });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  if (step.kind === "twoFactor") {
    return (
      <AuthShell title="Set up two-factor authentication">
        <TwoFactorPanel challengeToken={step.challengeToken} enrolment={step.enrolment} onBack={() => setStep({ kind: "password" })} onDone={() => router.replace("/")} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Accept your invitation" subtitle="Choose a password for your AmoorGo staff account.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="new-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
            New password
          </label>
          <input id="new-password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} />
          <p className="text-[11px] text-slate-400">At least 12 characters; must not contain your name or e-mail.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirm-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
            Confirm password
          </label>
          <input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={fieldClass} />
        </div>
        <ErrorLine message={error} />
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Activate account
        </button>
      </form>
    </AuthShell>
  );
};
