/**
 * Staff session tokens. Kept in module memory and mirrored to sessionStorage (per-tab, cleared when the tab closes).
 * Never localStorage. Implements the external-store contract so React can subscribe with useSyncExternalStore.
 */
import { setDemoSession } from "../demo/flag";

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms at which the access token expires. */
  accessExpiresAt: number;
}

export type ClearReason = "logout" | "expired" | "revoked";

const STORAGE_KEY = "amoorgo.staff.session";

let session: StoredSession | null = null;
let loaded = false;
let lastReason: ClearReason | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

function readStorage(): StoredSession | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.accessToken === "string" &&
      typeof parsed.refreshToken === "string" &&
      typeof parsed.accessExpiresAt === "number"
    ) {
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        accessExpiresAt: parsed.accessExpiresAt,
      };
    }
  } catch {
    /* storage unavailable or corrupt: behave as signed out */
  }
  return null;
}

function writeStorage(value: StoredSession | null): void {
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode / quota: the in-memory copy still works for this page view */
  }
}

export const tokenStore = {
  /** Current session (lazy-loads from sessionStorage on first browser access). */
  get(): StoredSession | null {
    if (!loaded && typeof window !== "undefined") {
      loaded = true;
      session = readStorage();
    }
    return session;
  },

  set(next: { accessToken: string; refreshToken: string; expiresInSeconds: number }): void {
    loaded = true;
    lastReason = null;
    session = {
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
      accessExpiresAt: Date.now() + next.expiresInSeconds * 1000,
    };
    writeStorage(session);
    notify();
  },

  clear(reason: ClearReason = "logout"): void {
    loaded = true;
    lastReason = reason;
    session = null;
    writeStorage(null);
    // A demo session cannot outlive its (synthetic) tokens.
    setDemoSession(false);
    notify();
  },

  /** Why the session was last cleared (to show "your session expired" on the login screen). */
  lastClearReason(): ClearReason | null {
    return lastReason;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
