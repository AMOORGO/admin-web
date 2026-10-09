/** Display helpers shared by adapters and views. The API speaks integer minor units (cents) and meters. */

const METERS_PER_MILE = 1609.344;

/** 1234 -> 12.34 (the UI types hold major-unit numbers). */
export const minorToMajor = (minor: number | null | undefined): number => Math.round(minor ?? 0) / 100;

/** 12.34 -> 1234 */
export const majorToMinor = (major: number): number => Math.round(major * 100);

export const metersToMiles = (meters: number | null | undefined): number => (meters ?? 0) / METERS_PER_MILE;

export const metersToKm = (meters: number | null | undefined): number => (meters ?? 0) / 1000;

export const mpsToMph = (mps: number | null | undefined): number => ((mps ?? 0) * 3600) / METERS_PER_MILE;

export const bpsToPercent = (bps: number | null | undefined): number => (bps ?? 0) / 100;

export const bpsToMultiplier = (bps: number | null | undefined): number => (bps ?? 10000) / 10000;

export function formatMoney(minor: number | null | undefined, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minorToMajor(minor));
}

/** "2026-10-09 10:52:06" (UTC-agnostic local display used across the console tables). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** "5m ago" style label; pass `now` so callers control purity. */
export function timeAgo(iso: string | null | undefined, now: number): string {
  if (!iso) return "—";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** "AMOOR_GO" -> "Amoor Go"; "RIDE_STARTED" -> "Ride Started" */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .replace(/[._-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const AVATAR_COLORS = ["#3A102F", "#521A44", "#7A2B66", "#A74490", "#14755F", "#B02414"];

/** Self-contained initials avatar (SVG data URI): the API has no profile photos, and this needs no network. */
export function avatarFor(name: string | null | undefined, explicitUrl?: string | null): string {
  if (explicitUrl) return explicitUrl;
  const label = initials(name ?? "?");
  let hash = 0;
  for (const ch of name ?? "") hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="${color}"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-weight="700" font-size="38" fill="#fff">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ── Presentation helpers shared by the stat cards, charts and tables ──────────────────────────────────────

/** 12345 -> "12,345" */
export function formatNumber(n: number | null | undefined, maximumFractionDigits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(n);
}

/** 1234567 -> "1.2M" (axis labels, tiny cards) */
export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Minor units -> "$1.2K" (no cents) for axes and dense cards; full precision stays in formatMoney. */
export function formatMoneyCompact(minor: number | null | undefined, currency = "USD"): string {
  const major = minorToMajor(minor);
  if (Math.abs(major) < 1000) return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(major);
  return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(major);
}

/** 82 -> "82%"; 82.456 -> "82.5%" (the argument is already a percentage 0..100). */
export function formatPercent(percent: number | null | undefined, maximumFractionDigits = 1): string {
  if (percent === null || percent === undefined || Number.isNaN(percent)) return "—";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(percent)}%`;
}

/** Meters -> "3.4 mi" (the console speaks miles). */
export function formatMiles(meters: number | null | undefined, digits = 1): string {
  if (meters === null || meters === undefined) return "—";
  return `${metersToMiles(meters).toFixed(digits)} mi`;
}

/** 754 -> "12 min"; 4000 -> "1 h 7 min" */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

/** "5 min ago" / "in 3 days" / "Just now". `now` is passed in so callers control render purity. */
export function formatRelative(iso: string | null | undefined, now: number): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = now - t;
  const abs = Math.abs(diff);
  const future = diff < 0;
  const wrap = (v: string) => (future ? `in ${v}` : `${v} ago`);
  if (abs < 45_000) return "Just now";
  const m = Math.round(abs / 60_000);
  if (m < 60) return wrap(`${m} min`);
  const h = Math.round(abs / 3_600_000);
  if (h < 36) return wrap(`${h} h`);
  const d = Math.round(abs / 86_400_000);
  if (d < 45) return wrap(`${d} d`);
  return formatDate(iso);
}

/** Whole days from `now` until `iso` (negative when in the past). */
export function daysUntil(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return Math.round((t - startOfToday.getTime()) / 86_400_000);
}

/** "2026-10-09" -> "Fri 9" (chart axis). Parsed as a local calendar day so no timezone shift happens. */
export function formatDayShort(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return `${dt.toLocaleDateString("en-US", { weekday: "short" })} ${dt.getDate()}`;
}

/** "2026-10-09" -> "Fri, Oct 9" */
export function formatDayLong(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** "Oct 2026" */
export function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
