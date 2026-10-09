import { formatDayLong, formatDayShort, formatMoney } from "@/lib/format";
import type { BarPoint } from "@/components/ui/BarChart";

/**
 * GET /admin/captains/:id/earnings/overview (permission finance.view; backend wallet-admin.controller.ts).
 * Every amount is an integer in minor units (cents). `daily` only lists local days that have earnings.
 */
export interface ApiEarningsSummary {
  completedRides: number;
  grossMinor: number;
  commissionMinor: number;
  tipsMinor: number;
  incentivesMinor: number;
  adjustmentsMinor: number;
  netMinor: number;
  cashCollectedMinor: number;
  availableMinor: number;
  pendingMinor: number;
}

export interface ApiEarningsDay {
  /** Local calendar day, YYYY-MM-DD, in `timezone`. */
  date: string;
  rides: number;
  netMinor: number;
  tipsMinor: number;
  cashMinor: number;
}

export interface ApiEarningRow {
  rideId: string;
  grossFareMinor: number;
  commissionMinor: number;
  tipMinor: number;
  incentiveMinor: number;
  netMinor: number;
  paidInCash: boolean;
  status: string;
  createdAt: string;
}

export interface ApiEarningsOverview {
  captainId: string;
  currency: string;
  timezone: string;
  today: ApiEarningsSummary;
  week: ApiEarningsSummary;
  month: ApiEarningsSummary;
  lifetime: ApiEarningsSummary;
  daily: ApiEarningsDay[];
  payout: { grossAvailableMinor: number; cashOwedMinor: number; withdrawableMinor: number };
  cashOwedMinor: number;
  recent: ApiEarningRow[];
}

export interface EarningsDayView extends ApiEarningsDay {
  isToday: boolean;
}

export interface EarningsOverviewView extends Omit<ApiEarningsOverview, "daily"> {
  /** Always 14 entries, oldest first; days without earnings are zero-filled. */
  daily: EarningsDayView[];
}

/** YYYY-MM-DD of an instant in an IANA timezone. */
export function localDayIn(timeZone: string, at: number): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return new Date(at).toISOString().slice(0, 10);
  }
}

/** Zero-fills the 14-day series the way the captain app does (the API omits empty days). */
export function toEarningsOverview(dto: ApiEarningsOverview, now: number = Date.now()): EarningsOverviewView {
  const byDay = new Map(dto.daily.map((d) => [d.date, d]));
  const today = localDayIn(dto.timezone, now);
  const daily: EarningsDayView[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = localDayIn(dto.timezone, now - i * 86_400_000);
    const d = byDay.get(date);
    daily.push({ date, rides: d?.rides ?? 0, netMinor: d?.netMinor ?? 0, tipsMinor: d?.tipsMinor ?? 0, cashMinor: d?.cashMinor ?? 0, isToday: date === today });
  }
  return { ...dto, daily };
}

/** Chart points (major units are not needed: values stay in minor units and are formatted by the chart). */
export function earningsBars(days: EarningsDayView[], currency: string): BarPoint[] {
  return days.map((d) => ({
    key: d.date,
    label: formatDayShort(d.date),
    title: formatDayLong(d.date) + (d.isToday ? " (today)" : ""),
    value: d.netMinor,
    highlight: d.isToday,
    details: d.rides === 0 ? ["No trips"] : [`${d.rides} ${d.rides === 1 ? "trip" : "trips"}`, `Tips ${formatMoney(d.tipsMinor, currency)}`, ...(d.cashMinor > 0 ? [`Cash ${formatMoney(d.cashMinor, currency)}`] : [])],
  }));
}

/** Net earnings per completed trip, or null when there were none. */
export const averagePerTrip = (s: ApiEarningsSummary): number | null => (s.completedRides > 0 ? Math.round(s.netMinor / s.completedRides) : null);
