/**
 * Captain earnings derived from the demo store's rides (the same rows the Rides tab lists), shaped like the backend's
 * GET /admin/captains/:id/earnings/overview. Mirrors EarningsService: gross = fare before fees, commission = platform share,
 * net = gross - commission + tip (+ incentive in the summaries), cash rides are already in the captain's hands.
 */
import type { ApiEarningRow, ApiEarningsDay, ApiEarningsOverview, ApiEarningsSummary } from "../../adapters/captainEarnings";
import type { ApiRideStatus } from "../../adapters/rides";
import type { DemoStore } from "../store";
import { DAY, HOUR } from "../util";
import { DEMO_TZ, localDay, startOfLocalDayAgo } from "./time";

const SETTLED: ApiRideStatus[] = ["COMPLETED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "RATED", "CLOSED"];
/** Digital earnings become withdrawable after this settlement delay (backend: payments.settlement_delay_hours). */
const SETTLEMENT_MS = 48 * HOUR;

interface Earning {
  rideId: string;
  at: number;
  day: string;
  gross: number;
  commission: number;
  tip: number;
  incentive: number;
  /** gross - commission + tip (the row's netMinor, without incentive). */
  net: number;
  cash: boolean;
}

/** Deterministic small hash so incentives are stable between requests. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function earningsFor(store: DemoStore, captainId: string): Earning[] {
  const out: Earning[] = [];
  for (const row of store.rides) {
    const rec = row.rec;
    if (rec.captainId !== captainId || !SETTLED.includes(rec.status) || !rec.fareBreakdown) continue;
    const b = rec.fareBreakdown;
    const at = new Date(rec.completedAt ?? rec.requestedAt).getTime();
    const gross = b.fareBeforeFeesMinor + b.tollsMinor;
    const tip = row.payment?.tipMinor ?? 0;
    // Surge trips pay a 6 % boost; one in ten ordinary trips earns a flat quest bonus.
    const incentive = b.surgeMultiplierBps > 10000 ? Math.round(gross * 0.06) : hash(rec.id) % 10 === 0 ? 150 : 0;
    out.push({ rideId: rec.id, at, day: localDay(at), gross, commission: b.platformCommissionMinor, tip, incentive, net: b.captainEarningMinor + tip, cash: rec.paymentMethod === "CASH" });
  }
  return out.sort((a, b) => b.at - a.at);
}

function emptySummary(): ApiEarningsSummary {
  return { completedRides: 0, grossMinor: 0, commissionMinor: 0, tipsMinor: 0, incentivesMinor: 0, adjustmentsMinor: 0, netMinor: 0, cashCollectedMinor: 0, availableMinor: 0, pendingMinor: 0 };
}

function summarize(rows: Earning[], from: number, to: number, now: number): ApiEarningsSummary {
  const s = emptySummary();
  for (const e of rows) {
    if (e.at < from || e.at >= to) continue;
    s.completedRides += 1;
    s.grossMinor += e.gross;
    s.commissionMinor += e.commission;
    s.tipsMinor += e.tip;
    s.incentivesMinor += e.incentive;
    s.netMinor += e.net + e.incentive;
    if (e.cash) s.cashCollectedMinor += e.gross;
    else if (now - e.at >= SETTLEMENT_MS) s.availableMinor += e.net + e.incentive;
    else s.pendingMinor += e.net + e.incentive;
  }
  return s;
}

export function earningsOverview(store: DemoStore, captainId: string, totalTrips: number, now: number): ApiEarningsOverview {
  const rows = earningsFor(store, captainId);
  const end = now + 1000;
  const today = startOfLocalDayAgo(now, 0);
  const weekStart = startOfLocalDayAgo(now, 6);
  const monthStart = startOfLocalDayAgo(now, 29);

  const month = summarize(rows, monthStart, end, now);
  const lifetime = summarize(rows, 0, end, now);
  // Trips before the 30 days the demo keeps rows for: extrapolated at the captain's recent average so lifetime > month.
  const older = Math.max(0, totalTrips - rows.length);
  if (older > 0 && month.completedRides > 0) {
    const k = older / month.completedRides;
    const add = (n: number) => Math.round(n * k);
    lifetime.completedRides += older;
    lifetime.grossMinor += add(month.grossMinor);
    lifetime.commissionMinor += add(month.commissionMinor);
    lifetime.tipsMinor += add(month.tipsMinor);
    lifetime.incentivesMinor += add(month.incentivesMinor);
    lifetime.netMinor += add(month.netMinor);
    lifetime.cashCollectedMinor += add(month.cashCollectedMinor);
  }

  // 14-day series: only days that have earnings, like the backend.
  const first = startOfLocalDayAgo(now, 13);
  const days = new Map<string, ApiEarningsDay>();
  for (const e of [...rows].reverse()) {
    if (e.at < first || e.at >= end) continue;
    const d = days.get(e.day) ?? { date: e.day, rides: 0, netMinor: 0, tipsMinor: 0, cashMinor: 0 };
    d.rides += 1;
    d.netMinor += e.net + e.incentive;
    d.tipsMinor += e.tip;
    if (e.cash) d.cashMinor += e.net;
    days.set(e.day, d);
  }

  // Withdrawable: digital earnings past the settlement delay from the last week (older ones were paid out), minus cash owed.
  const payWindowStart = now - 7 * DAY;
  const grossAvailable = rows.filter((e) => !e.cash && e.at >= payWindowStart && now - e.at >= SETTLEMENT_MS).reduce((a, e) => a + e.net + e.incentive, 0);
  const cashOwed = rows.filter((e) => e.cash && e.at >= payWindowStart).reduce((a, e) => a + e.commission, 0);

  const recent: ApiEarningRow[] = rows.slice(0, 10).map((e) => ({
    rideId: e.rideId,
    grossFareMinor: e.gross,
    commissionMinor: e.commission,
    tipMinor: e.tip,
    incentiveMinor: e.incentive,
    netMinor: e.net,
    paidInCash: e.cash,
    status: e.cash || now - e.at >= SETTLEMENT_MS ? "AVAILABLE" : "PENDING",
    createdAt: new Date(e.at).toISOString(),
  }));

  return {
    captainId,
    currency: "USD",
    timezone: DEMO_TZ,
    today: summarize(rows, today, end, now),
    week: summarize(rows, weekStart, end, now),
    month,
    lifetime,
    daily: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    payout: { grossAvailableMinor: grossAvailable, cashOwedMinor: cashOwed, withdrawableMinor: Math.max(0, grossAvailable - cashOwed) },
    cashOwedMinor: cashOwed,
    recent,
  };
}
