"use client";

import React, { useState, useSyncExternalStore } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import { DEMO_ENABLED } from "@/lib/config";
import { useAuth } from "@/lib/auth/AuthProvider";
import { DEMO_ROLE_OPTIONS, getDemoRole, setDemoRoleKey, subscribeDemoSession, type DemoRoleKey } from "@/lib/demo/flag";
import type { EnrolmentInfo } from "@/lib/auth/types";
import { AuthShell, ErrorLine, PasswordField, TwoFactorPanel, fieldClass, friendlyAuthError, primaryButtonClass, secondaryButtonClass } from "./AuthCard";

type Step = { kind: "credentials" } | { kind: "twoFactor"; challengeToken: string; enrolment: EnrolmentInfo | null };

export const LoginScreen: React.FC = () => {
  const { login, startEnrolment, startDemo, sessionNotice } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [pending, setPending] = useState(false);
  const [demoPending, setDemoPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = pending || demoPending;
  const demoRole = useSyncExternalStore(subscribeDemoSession, getDemoRole, () => "SUPER_ADMIN" as DemoRoleKey);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setPending(true);
    setError(null);
    try {
      const res = await login(email, password);
      if (res.status === "TWO_FACTOR_REQUIRED") {
        const enrolment = res.enrolmentRequired ? await startEnrolment(res.challengeToken) : null;
        setStep({ kind: "twoFactor", challengeToken: res.challengeToken, enrolment });
        setPassword("");
      }
      // AUTHENTICATED: AuthProvider flips to the console; nothing else to do.
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setPending(false);
    }
  };

  const exploreDemo = async () => {
    if (busy) return;
    setDemoPending(true);
    setError(null);
    try {
      await startDemo(demoRole);
    } catch {
      setError("The demo could not be started. Reload the page and try again.");
      setDemoPending(false);
    }
  };

  if (step.kind === "twoFactor") {
    return (
      <AuthShell
        title={step.enrolment ? "Set up two-factor authentication" : "Two-factor verification"}
        subtitle={step.enrolment ? undefined : "Enter the 6-digit code from your authenticator app."}
      >
        <TwoFactorPanel challengeToken={step.challengeToken} enrolment={step.enrolment} onBack={() => setStep({ kind: "credentials" })} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Sign in" subtitle="Use your AmoorGo staff credentials.">
      <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
        {sessionNotice && (
          <p role="status" className="rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
            {sessionNotice}
          </p>
        )}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            autoFocus
            disabled={busy}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@amoorgo.com"
            aria-invalid={error ? true : undefined}
            className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-60`}
          />
        </div>
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="Enter your password"
          disabled={busy}
          invalid={!!error}
        />
        <ErrorLine message={error} />
        <button type="submit" disabled={busy || !email.trim() || !password} className={primaryButtonClass}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pending ? "Signing in…" : "Continue"}
        </button>
      </form>

      {DEMO_ENABLED && (
        <div className="mt-6 border-t border-slate-100 dark:border-[#331A3B] pt-5">
          <div className="mb-3 space-y-1.5">
            <label htmlFor="demo-role" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Explore demo as
            </label>
            <select
              id="demo-role"
              value={demoRole}
              onChange={(e) => setDemoRoleKey(e.target.value as DemoRoleKey)}
              disabled={busy}
              className={`${fieldClass} cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {DEMO_ROLE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={exploreDemo} disabled={busy} aria-busy={demoPending} className={secondaryButtonClass}>
            {demoPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PlayCircle className="h-4 w-4" aria-hidden="true" />}
            {demoPending ? "Opening demo…" : "Explore demo (no backend)"}
          </button>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            Uses sample data only. Nothing is saved or sent to a server. Each role sees exactly what that staff member would.
          </p>
        </div>
      )}
    </AuthShell>
  );
};
