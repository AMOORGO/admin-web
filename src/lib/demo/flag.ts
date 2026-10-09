/**
 * Demo-session flag (sessionStorage, per tab). Tiny and dependency-free on purpose: it is the only part of the demo
 * feature that lives in the main bundle. Everything else is dynamically imported on demand.
 */
import { DEMO_ENABLED } from "../config";

const FLAG_KEY = "amoorgo.demo.session";

let cached: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.sessionStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

/** True while a demo session is active. Always false (and tree-shakeable) when demo mode is not enabled at build time. */
export function isDemoSession(): boolean {
  if (!DEMO_ENABLED || typeof window === "undefined") return false;
  if (cached === null) cached = read();
  return cached;
}

export function setDemoSession(active: boolean): void {
  if (!DEMO_ENABLED || typeof window === "undefined") return;
  cached = active;
  try {
    if (active) window.sessionStorage.setItem(FLAG_KEY, "1");
    else window.sessionStorage.removeItem(FLAG_KEY);
  } catch {
    /* storage unavailable: the in-memory flag still covers this page view */
  }
  listeners.forEach((l) => l());
}

export function subscribeDemoSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ── Demo role (which staff member the visitor explores the console as) ──

/** System roles offered by the demo, in picker order. Keys and names mirror the backend catalogue (SYSTEM_ROLES). */
export const DEMO_ROLE_OPTIONS = [
  { key: "SUPER_ADMIN", label: "Super Admin" },
  { key: "OPERATIONS_ADMIN", label: "Operations Admin" },
  { key: "CAPTAIN_OPS", label: "Captain Ops" },
  { key: "SUPPORT_AGENT", label: "Support Agent" },
  { key: "FINANCE_ADMIN", label: "Finance Admin" },
  { key: "READ_ONLY", label: "Read Only" },
] as const;

export type DemoRoleKey = (typeof DEMO_ROLE_OPTIONS)[number]["key"];

const ROLE_KEY = "amoorgo.demo.role";
const DEFAULT_ROLE: DemoRoleKey = "SUPER_ADMIN";
const isRoleKey = (v: unknown): v is DemoRoleKey => DEMO_ROLE_OPTIONS.some((o) => o.key === v);

let cachedRole: DemoRoleKey | null = null;

/** The role chosen for the demo (persisted per tab). */
export function getDemoRole(): DemoRoleKey {
  if (cachedRole) return cachedRole;
  let stored: string | null = null;
  try {
    stored = typeof window === "undefined" ? null : window.sessionStorage.getItem(ROLE_KEY);
  } catch {
    /* storage unavailable: default role */
  }
  cachedRole = isRoleKey(stored) ? stored : DEFAULT_ROLE;
  return cachedRole;
}

export function setDemoRoleKey(role: DemoRoleKey): void {
  cachedRole = role;
  try {
    window.sessionStorage.setItem(ROLE_KEY, role);
  } catch {
    /* storage unavailable: the in-memory choice still applies to this page view */
  }
  listeners.forEach((l) => l());
}
