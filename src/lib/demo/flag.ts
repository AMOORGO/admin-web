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
