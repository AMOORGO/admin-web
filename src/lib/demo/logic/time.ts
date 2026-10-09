/** Local-day arithmetic in the demo platform's timezone (the backend's DEFAULT_TIMEZONE equivalent). */
import { DAY, HOUR } from "../util";

export const DEMO_TZ = "America/Chicago";

/** Offset (local minus UTC, ms) of `tz` at the instant `at`. */
function zoneOffsetMs(at: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return local - Math.floor(at / 1000) * 1000;
}

/** The instant calendar day y-m-d starts in `tz`. */
export function zonedMidnight(y: number, m: number, d: number, tz: string = DEMO_TZ): number {
  const naive = Date.UTC(y, m - 1, d);
  const first = naive - zoneOffsetMs(naive, tz);
  return naive - zoneOffsetMs(first, tz);
}

/** YYYY-MM-DD of an instant in `tz`. */
export function localDay(ms: number, tz: string = DEMO_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

export function startOfLocalDay(ms: number, tz: string = DEMO_TZ): number {
  const [y, m, d] = localDay(ms, tz).split("-").map(Number);
  return zonedMidnight(y, m, d, tz);
}

/** Day of week (0 = Sunday) of the local day containing `ms`. */
export function localWeekday(ms: number, tz: string = DEMO_TZ): number {
  const [y, m, d] = localDay(ms, tz).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Query boundary like the backend: a bare date means that local calendar day (as an exclusive upper bound it covers the
 * whole day); a full timestamp is taken literally.
 */
export function parseBoundary(value: string, kind: "from" | "to", tz: string = DEMO_TZ): number {
  const m = DATE_ONLY.exec(value);
  if (!m) return new Date(value).getTime();
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return kind === "from" ? zonedMidnight(y, mo, d, tz) : zonedMidnight(y, mo, d + 1, tz);
}

/** Start of the local day `days` days before today's (DST-safe: steps from the middle of the day). */
export const startOfLocalDayAgo = (now: number, days: number): number => startOfLocalDay(startOfLocalDay(now) - days * DAY + 12 * HOUR);
