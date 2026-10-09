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
