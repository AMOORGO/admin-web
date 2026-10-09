/** Public runtime configuration. Only NEXT_PUBLIC_* values may be read here: they are inlined into the browser bundle. */
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** API origin without a trailing slash (also the Socket.IO origin). */
export const API_ORIGIN = rawApiUrl.replace(/\/+$/, "");

/** REST base, e.g. http://localhost:4000/api/v1 */
export const API_BASE = `${API_ORIGIN}/api/v1`;

/** Default request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Build-time switch for the backend-less demo (NEXT_PUBLIC_DEMO_MODE=true). When false, the demo code is never loaded
 * and the login screen shows no demo entry point.
 */
export const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
