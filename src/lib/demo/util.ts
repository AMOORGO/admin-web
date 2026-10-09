/** Small helpers shared by the demo seed and route handlers: seeded randomness, ids, time, pagination, request parsing. */

export const SEC = 1000;
export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

// ── Randomness (deterministic so the demo looks the same on every load) ──

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shared generator for everything created at runtime (new ids, jitter). */
export const rng: Rng = mulberry32(20261009);

export const pick = <T>(r: Rng, items: readonly T[]): T => items[Math.floor(r() * items.length)];
export const randInt = (r: Rng, min: number, max: number): number => Math.floor(r() * (max - min + 1)) + min;
export const randFloat = (r: Rng, min: number, max: number): number => r() * (max - min) + min;

export function uuid(r: Rng = rng): string {
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(r() * 4)).toString(16)}${hex(3)}-${hex(12)}`;
}

const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function refCode(r: Rng, length = 5): string {
  let out = "";
  for (let i = 0; i < length; i++) out += REF_ALPHABET[Math.floor(r() * REF_ALPHABET.length)];
  return out;
}

export const iso = (ms: number): string => new Date(ms).toISOString();
export const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export const round2 = (n: number): number => Math.round(n * 100) / 100;

// ── Errors (rendered by the transport in the backend's error envelope) ──

export class DemoError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "DemoError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (what: string): DemoError => new DemoError(404, "NOT_FOUND", `${what} not found`);
export const badRequest = (message: string, details?: string[]): DemoError => new DemoError(400, "VALIDATION_FAILED", message, details);
export const conflict = (message: string, code = "INVALID_STATE"): DemoError => new DemoError(409, code, message);

// ── Request parsing ──

export type Body = Record<string, unknown>;

export function asBody(raw: unknown): Body {
  return raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Body) : {};
}

export function str(b: Body, key: string): string | undefined {
  const v = b[key];
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

export function reqStr(b: Body, key: string): string {
  const v = str(b, key);
  if (v === undefined) throw badRequest(`${key} is required`, [`${key} should not be empty`]);
  return v;
}

export function num(b: Body, key: string): number | undefined {
  const v = b[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function bool(b: Body, key: string): boolean | undefined {
  const v = b[key];
  return typeof v === "boolean" ? v : undefined;
}

export function strList(b: Body, key: string): string[] {
  const v = b[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Query value -> boolean (`true` / `1`). */
export const flagParam = (v: string | undefined): boolean => v === "true" || v === "1";

// ── Pagination (opaque offset cursor, like the real API's) ──

const encodeCursor = (offset: number): string => btoa(`o:${offset}`);
function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const m = /^o:(\d+)$/.exec(atob(cursor));
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
}

export function paginate<T>(items: readonly T[], query: Record<string, string>, defaultLimit = 25): { items: T[]; nextCursor: string | null } {
  const limit = Math.min(200, Math.max(1, Number.parseInt(query.limit ?? "", 10) || defaultLimit));
  const offset = decodeCursor(query.cursor);
  const slice = items.slice(offset, offset + limit);
  return { items: slice, nextCursor: offset + limit < items.length ? encodeCursor(offset + limit) : null };
}

/** Case-insensitive "contains" over several fields. */
export function matchesQuery(q: string | undefined, ...fields: Array<string | null | undefined>): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(needle));
}

export function inRange(ms: number, from: string | undefined, to: string | undefined): boolean {
  if (from) {
    const f = new Date(from).getTime();
    if (!Number.isNaN(f) && ms < f) return false;
  }
  if (to) {
    const t = new Date(to).getTime();
    if (!Number.isNaN(t) && ms > t) return false;
  }
  return true;
}

// ── Geometry ──

export function haversineMeters(a: readonly [number, number], b: readonly [number, number]): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** "+1 (512) •••-2041" style masked phone: the API never returns full numbers in list payloads. */
export function maskedPhone(areaCode: string, last4: string): string {
  return `+1 (${areaCode}) •••-${last4}`;
}

export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
