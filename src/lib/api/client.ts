import { API_BASE, DEFAULT_TIMEOUT_MS } from "../config";
import { tokenStore } from "../auth/tokenStore";
import { ApiError } from "./errors";
import type { Envelope, Page, QueryParams, RequestOptions } from "./types";

/** Refresh the access token when it has less than this many ms left. */
const REFRESH_SKEW_MS = 20_000;

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function buildUrl(path: string, query?: QueryParams): string {
  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => sp.append(key, String(v)));
    else sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
}

/** Combines the caller's signal with a timeout. */
function withTimeout(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void; timedOut: () => boolean } {
  const controller = new AbortController();
  let didTimeOut = false;
  const timer = setTimeout(() => {
    didTimeOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    timedOut: () => didTimeOut,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

async function parseJsonBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const err = (body as { error?: { code?: string; message?: string; details?: unknown; requestId?: string } } | undefined)?.error;
  return new ApiError({
    status,
    code: err?.code ?? (status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : `HTTP_${status}`),
    message: err?.message ?? `Request failed (${status})`,
    details: err?.details,
    requestId: err?.requestId,
  });
}

/**
 * One network call. The timeout covers the whole exchange including reading the body, so the body is read here
 * and returned together with the response.
 */
async function rawFetch(
  method: Method,
  path: string,
  opts: RequestOptions,
  token: string | null,
  readAs: "json" | "text",
): Promise<{ res: Response; body: unknown }> {
  const { signal, cleanup, timedOut } = withTimeout(opts.signal, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal,
      cache: "no-store",
    });
    // Error bodies are always JSON; success bodies are parsed according to the caller.
    const body = readAs === "text" && res.ok ? await res.text() : await parseJsonBody(res);
    return { res, body };
  } catch (e) {
    if (opts.signal?.aborted) throw new ApiError({ status: 0, code: "ABORTED", message: "Request cancelled" });
    if (timedOut()) throw new ApiError({ status: 0, code: "TIMEOUT", message: "The request timed out. Please try again." });
    throw new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      message: "Cannot reach the server. Check your connection and try again.",
      details: e instanceof Error ? e.message : undefined,
    });
  } finally {
    cleanup();
  }
}

// ── Token refresh (single-flight) ─────────────────────────────

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

let refreshInFlight: Promise<string> | null = null;

/** Rotates the refresh token. Concurrent callers share one request. Signs the user out when the refresh token is rejected. */
export function refreshSession(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;
  const current = tokenStore.get();
  if (!current) return Promise.reject(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "You are signed out." }));

  const run = async (): Promise<string> => {
    const { res, body } = await rawFetch("POST", "/admin/auth/refresh", { body: { refreshToken: current.refreshToken }, timeoutMs: 15_000 }, null, "json");
    if (!res.ok) {
      const err = toApiError(res.status, body);
      // Only a definitive rejection ends the session; 429 / 5xx keep it so the user can retry.
      if (res.status === 401 || res.status === 403) tokenStore.clear("expired");
      throw err;
    }
    const payload = (body as Envelope<RefreshResponse>).data;
    tokenStore.set({ accessToken: payload.accessToken, refreshToken: payload.refreshToken, expiresInSeconds: payload.expiresIn });
    return payload.accessToken;
  };
  refreshInFlight = run().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** A valid access token (refreshing first if it is about to expire), or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const s = tokenStore.get();
  if (!s) return null;
  if (s.accessExpiresAt - Date.now() > REFRESH_SKEW_MS) return s.accessToken;
  try {
    return await refreshSession();
  } catch {
    // Refresh failed: hand back whatever is left (still valid for a few seconds) or null if the session was cleared.
    return tokenStore.get()?.accessToken ?? null;
  }
}

// ── Core request ──────────────────────────────────────────────

async function request(
  method: Method,
  path: string,
  opts: RequestOptions = {},
  readAs: "json" | "text" = "json",
): Promise<{ res: Response; body: unknown }> {
  const useAuth = opts.auth !== false;
  let token = useAuth ? await getAccessToken() : null;
  if (useAuth && !token) {
    throw new ApiError({ status: 401, code: "UNAUTHORIZED", message: "You are signed out. Please sign in again." });
  }

  let out = await rawFetch(method, path, opts, token, readAs);
  if (out.res.status === 401 && useAuth) {
    // Access token rejected: rotate once (shared with concurrent calls) and retry once.
    try {
      token = await refreshSession();
    } catch (e) {
      throw e instanceof ApiError ? e : new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Your session has expired." });
    }
    out = await rawFetch(method, path, opts, token, readAs);
    if (out.res.status === 401) tokenStore.clear("expired");
  }
  if (!out.res.ok) throw toApiError(out.res.status, out.body);
  return out;
}

async function data<T>(method: Method, path: string, opts?: RequestOptions): Promise<T> {
  const { body } = await request(method, path, opts);
  if (body === undefined) return undefined as T;
  return (body as Envelope<T>).data;
}

async function page<T>(path: string, opts?: RequestOptions): Promise<Page<T>> {
  const { body } = await request("GET", path, opts);
  const env = body as Envelope<T[]>;
  return { items: Array.isArray(env.data) ? env.data : [], nextCursor: env.meta?.nextCursor ?? null };
}

/** GET of a `{ data, meta }` response where the caller also needs `meta` (counts, summaries, ...). */
async function withMeta<T, M = Record<string, unknown>>(path: string, opts?: RequestOptions): Promise<{ data: T; meta: M }> {
  const { body } = await request("GET", path, opts);
  const env = body as { data: T; meta?: M };
  return { data: env.data, meta: (env.meta ?? {}) as M };
}

export interface DownloadResult {
  blob: Blob;
  filename: string;
}

/** Authenticated file download (e.g. CSV export): the bearer header is sent, so a plain <a href> cannot be used. */
async function download(path: string, opts?: RequestOptions, fallbackName = "export.csv"): Promise<DownloadResult> {
  const { res, body } = await request("GET", path, { ...opts, headers: { Accept: "text/csv,application/octet-stream,*/*", ...opts?.headers }, timeoutMs: opts?.timeoutMs ?? 120_000 }, "text");
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return { blob: new Blob([text], { type: res.headers.get("content-type") ?? "text/csv" }), filename: match?.[1] ?? fallbackName };
}

/** Triggers a browser download for a blob. */
export function saveBlob({ blob, filename }: DownloadResult): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  /** GET → unwrapped `data`. */
  get: <T>(path: string, opts?: RequestOptions) => data<T>("GET", path, opts),
  /** GET of a cursor-paginated list → items + nextCursor. */
  getPage: <T>(path: string, opts?: RequestOptions) => page<T>(path, opts),
  /** GET returning `data` and `meta`. */
  getWithMeta: withMeta,
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) => data<T>("POST", path, { ...opts, body: body ?? {} }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) => data<T>("PUT", path, { ...opts, body: body ?? {} }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) => data<T>("PATCH", path, { ...opts, body: body ?? {} }),
  /** DELETE; the backend takes `reason` in the body or as ?reason=. */
  delete: <T = void>(path: string, opts?: RequestOptions) => data<T>("DELETE", path, opts),
  download,
};

/** Unauthenticated calls for the login / invite flows (no bearer token, no refresh-retry). */
export const publicApi = {
  post: <T>(path: string, body: unknown, opts?: Omit<RequestOptions, "body" | "auth">) => data<T>("POST", path, { ...opts, body, auth: false }),
};

/** Walks every page of a cursor-paginated endpoint (bounded by maxPages): for reference lists such as roles or cities. */
export async function fetchAllPages<T>(path: string, opts?: RequestOptions & { limit?: number; maxPages?: number }): Promise<T[]> {
  const limit = opts?.limit ?? 100;
  const maxPages = opts?.maxPages ?? 20;
  const out: T[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    const p: Page<T> = await page<T>(path, { ...opts, query: { ...opts?.query, limit, cursor } });
    out.push(...p.items);
    if (!p.nextCursor) break;
    cursor = p.nextCursor;
  }
  return out;
}
