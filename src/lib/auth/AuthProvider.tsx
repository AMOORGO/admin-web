"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { api, publicApi } from "../api";
import { DEMO_ENABLED } from "../config";
import { isDemoSession, setDemoSession, subscribeDemoSession } from "../demo/flag";
import { tokenStore } from "./tokenStore";
import type { AuthenticatedLogin, EnrolmentInfo, LoginResult, StaffMe } from "./types";

export type AuthStatus = "booting" | "anonymous" | "authenticated";

export interface AuthContextValue {
  status: AuthStatus;
  user: StaffMe | null;
  /** Set when the session ended involuntarily (refresh token rejected). Cleared on next sign-in. */
  sessionNotice: string | null;
  /** True when the staff member holds the permission key (backend-computed effective permissions). */
  can: (permission: string) => boolean;
  /** City ids the staff member is scoped to; empty = all cities. */
  cityScope: readonly string[];
  /** Step 1: email + password. Resolves to either a session or a TOTP challenge. */
  login: (email: string, password: string) => Promise<LoginResult>;
  /** Step 1b (enrolment): fetch the authenticator secret / otpauth URL for a challenge. */
  startEnrolment: (challengeToken: string) => Promise<EnrolmentInfo>;
  /** Step 2: 6-digit TOTP (also completes enrolment). */
  verifyTwoFactor: (challengeToken: string, code: string) => Promise<StaffMe>;
  /** Accept an invitation link token + chosen password; may continue into the TOTP step. */
  acceptInvite: (token: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  /** True while the console runs on the built-in sample data (no backend). Always false unless demo mode is enabled. */
  isDemo: boolean;
  /** Opens the console as a synthetic Super Admin on sample data. No-op unless demo mode is enabled at build time. */
  startDemo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const NOT_SCOPED: readonly string[] = [];

const subscribeNoop = () => () => {};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Session presence is an external store (module memory + sessionStorage). The server snapshot is "no session".
  const hasSession = useSyncExternalStore(
    tokenStore.subscribe,
    () => tokenStore.get() !== null,
    () => false,
  );
  // false during SSR / hydration, true afterwards, so the first client render matches the server HTML.
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const isDemo = useSyncExternalStore(subscribeDemoSession, isDemoSession, () => false);

  const [profile, setUser] = useState<StaffMe | null>(null);
  const [bootError, setNotice] = useState<string | null>(null);
  // A profile without a session is stale (session expired / revoked / signed out).
  const user = hasSession ? profile : null;
  const reason = hasSession ? null : tokenStore.lastClearReason();
  const notice = bootError ?? (reason === "expired" ? "Your session has expired. Please sign in again." : reason === "revoked" ? "Your session was revoked. Please sign in again." : null);

  // Restore the profile for a session that survived a page reload.
  useEffect(() => {
    if (!hydrated || !hasSession || profile) return;
    let cancelled = false;
    api
      .get<StaffMe>("/admin/me")
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        // Definitive auth failure was already handled (tokenStore cleared). For network blips keep the session and retry on reload.
        const status = (e as { status?: number }).status;
        if (status === 401 || status === 403) tokenStore.clear("expired");
        else setNotice("Could not reach the server. Reload the page to retry.");
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, hasSession, profile]);

  const status: AuthStatus = !hydrated ? "booting" : !hasSession ? "anonymous" : user ? "authenticated" : "booting";

  const finishLogin = useCallback((res: AuthenticatedLogin): StaffMe => {
    setNotice(null);
    setUser(res.user);
    tokenStore.set({ accessToken: res.accessToken, refreshToken: res.refreshToken, expiresInSeconds: res.expiresIn });
    return res.user;
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      const res = await publicApi.post<LoginResult>("/admin/auth/login", { email: email.trim(), password });
      if (res.status === "AUTHENTICATED") finishLogin(res);
      return res;
    },
    [finishLogin],
  );

  const startEnrolment = useCallback((challengeToken: string) => publicApi.post<EnrolmentInfo>("/admin/auth/2fa/enrol", { challengeToken }), []);

  const verifyTwoFactor = useCallback(
    async (challengeToken: string, code: string): Promise<StaffMe> => {
      const res = await publicApi.post<LoginResult>("/admin/auth/2fa", { challengeToken, code: code.trim() });
      if (res.status !== "AUTHENTICATED") throw new Error("Unexpected response from the server");
      return finishLogin(res);
    },
    [finishLogin],
  );

  const acceptInvite = useCallback(
    async (token: string, password: string): Promise<LoginResult> => {
      const res = await publicApi.post<LoginResult>("/admin/auth/accept-invite", { token, password });
      if (res.status === "AUTHENTICATED") finishLogin(res);
      return res;
    },
    [finishLogin],
  );

  const startDemo = useCallback(async () => {
    if (!DEMO_ENABLED) return;
    // Flag first: every request from here on is answered by the local demo backend.
    setDemoSession(true);
    try {
      const demo = await import("../demo");
      finishLogin(demo.createDemoSession());
    } catch (e) {
      setDemoSession(false);
      throw e;
    }
  }, [finishLogin]);

  const logout = useCallback(async () => {
    const session = tokenStore.get();
    // Exiting the demo never touches the network.
    if (session && !isDemoSession()) {
      // Best effort: the server revokes the refresh token; the local session is cleared regardless.
      await publicApi.post("/admin/auth/logout", { refreshToken: session.refreshToken }, { timeoutMs: 5000 }).catch(() => undefined);
    }
    setUser(null);
    setNotice(null);
    tokenStore.clear("logout");
  }, []);

  const permissionSet = useMemo(() => new Set(user?.permissions ?? []), [user]);
  const can = useCallback((permission: string) => permissionSet.has(permission), [permissionSet]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      sessionNotice: notice,
      can,
      cityScope: user?.cityScope ?? NOT_SCOPED,
      login,
      startEnrolment,
      verifyTwoFactor,
      acceptInvite,
      logout,
      isDemo,
      startDemo,
    }),
    [status, user, notice, can, login, startEnrolment, verifyTwoFactor, acceptInvite, logout, isDemo, startDemo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** The signed-in staff profile. Only call below <AuthGate>, where a user is guaranteed. */
export function useStaff(): StaffMe {
  const { user } = useAuth();
  if (!user) throw new Error("useStaff called while signed out");
  return user;
}
