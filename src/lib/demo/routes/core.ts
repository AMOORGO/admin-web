/** Session, dashboard KPIs / alerts, ops snapshot and the live map. */
import type { ApiAlert, ApiAlerts, ApiKpis, ApiMetric } from "../../adapters/dashboard";
import { buildLiveMap, buildSnapshot, onlineCaptainCount } from "../logic/ops";
import { parseBoundary, startOfLocalDay } from "../logic/time";
import { inScope } from "../logic/scope";
import { type Router, ok } from "../router";
import type { DemoStore } from "../store";
import { DAY, HOUR, MIN, iso } from "../util";

const SETTLED = new Set(["COMPLETED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "PAYMENT_FAILED", "RATED", "CLOSED"]);

function metricOf(value: number, previous: number, decimals = 0): ApiMetric {
  const f = 10 ** decimals;
  const v = Math.round(value * f) / f;
  const p = Math.round(previous * f) / f;
  return { value: v, previous: p, delta: Math.round((v - p) * f) / f, deltaPct: p === 0 ? null : Math.round(((v - p) / p) * 1000) / 10 };
}

interface PeriodStats {
  requested: number;
  completed: number;
  cancelled: number;
  noDriver: number;
  gmv: number;
  revenue: number;
  riders: number;
  captains: number;
}

/** Ride KPIs of a period, computed from the same rides the Rides tab lists (so every screen agrees). */
function periodStats(store: DemoStore, from: number, to: number, cityId: string | undefined): PeriodStats {
  const s: PeriodStats = { requested: 0, completed: 0, cancelled: 0, noDriver: 0, gmv: 0, revenue: 0, riders: 0, captains: 0 };
  const riders = new Set<string>();
  const captains = new Set<string>();
  for (const row of store.rides) {
    const rec = row.rec;
    const t = new Date(rec.requestedAt).getTime();
    if (t < from || t >= to || rec.status === "SCHEDULED") continue;
    if (!inScope(store, rec.cityId) || (cityId && rec.cityId !== cityId)) continue;
    s.requested += 1;
    if (SETTLED.has(rec.status)) {
      s.completed += 1;
      s.gmv += rec.finalFareMinor ?? 0;
      s.revenue += (rec.fareBreakdown?.platformCommissionMinor ?? 0) + (rec.fareBreakdown?.bookingFeeMinor ?? 0);
      riders.add(rec.riderId);
      if (rec.captainId) captains.add(rec.captainId);
    } else if (rec.status === "CANCELLED") s.cancelled += 1;
    else if (rec.status === "NO_DRIVER_AVAILABLE") s.noDriver += 1;
  }
  s.riders = riders.size;
  s.captains = captains.size;
  return s;
}

function kpis(store: DemoStore, query: Record<string, string>): ApiKpis {
  const now = Date.now();
  const cityId = query.cityId || undefined;
  const from = query.from ? parseBoundary(query.from, "from") : startOfLocalDay(now);
  const to = query.to ? parseBoundary(query.to, "to") : now;
  const len = Math.max(1, to - from);
  const cur = periodStats(store, from, to, cityId);
  const prev = periodStats(store, from - len, from, cityId);
  const rate = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
  const days = Math.max(1, Math.round(len / DAY));
  const incidents = store.incidents.filter((i) => (i.status === "ACTIVE" || i.status === "ACKNOWLEDGED") && i.type === "SOS" && inScope(store, i.cityId) && (!cityId || i.cityId === cityId));
  return {
    generatedAt: iso(now),
    cityId: cityId ?? null,
    currency: "USD",
    period: { from: iso(from), to: iso(to) },
    previousPeriod: { from: iso(from - len), to: iso(from) },
    kpis: {
      ridesRequested: metricOf(cur.requested, prev.requested),
      ridesCompleted: metricOf(cur.completed, prev.completed),
      ridesCancelled: metricOf(cur.cancelled, prev.cancelled),
      ridesNoDriver: metricOf(cur.noDriver, prev.noDriver),
      completionRate: metricOf(rate(cur.completed, cur.requested), rate(prev.completed, prev.requested), 1),
      cancellationRate: metricOf(rate(cur.cancelled, cur.requested), rate(prev.cancelled, prev.requested), 1),
      noDriverRate: metricOf(rate(cur.noDriver, cur.requested), rate(prev.noDriver, prev.requested), 1),
      gmvMinor: metricOf(cur.gmv, prev.gmv),
      platformRevenueMinor: metricOf(cur.revenue, prev.revenue),
      activeRiders: metricOf(cur.riders, prev.riders),
      activeCaptains: metricOf(cur.captains, prev.captains),
      avgRating: metricOf(4.82, 4.8, 2),
      avgPickupEtaSeconds: metricOf(318 + (days % 3) * 6, 331),
      paymentFailureRate: metricOf(1.4, 1.6, 1),
    },
    live: {
      onlineCaptains: onlineCaptainCount(store, cityId ?? null),
      openSos: incidents.length,
      openTickets: Math.max(1, Math.round(7 * (cityId ? 0.6 : 1))),
      pendingCaptainApprovals: store.captains.filter((c) => (c.d.status === "SUBMITTED" || c.d.status === "UNDER_REVIEW") && inScope(store, c.d.cityId) && (!cityId || c.d.cityId === cityId)).length,
      pendingRefunds: store.refunds.filter((x) => x.status === "PENDING").length,
    },
  };
}

function alerts(store: DemoStore, query: Record<string, string>): ApiAlerts {
  const now = Date.now();
  const cityId = query.cityId || undefined;
  const items: ApiAlert[] = [];
  const breached = store.incidents.filter(
    (i) => i.type === "SOS" && i.status === "ACTIVE" && (!cityId || i.cityId === cityId) && inScope(store, i.cityId) && (i.slaBreached || (i.ackDueAt !== null && new Date(i.ackDueAt).getTime() < now)),
  ).length;
  if (breached > 0) items.push({ type: "SOS_SLA_BREACHED", severity: "critical", count: breached, title: "SOS incidents past the acknowledgement SLA", link: "/safety" });
  const stuck = store.rides.filter((x) => x.rec.status === "SEARCHING" && now - new Date(x.rec.requestedAt).getTime() > 10 * MIN && inScope(store, x.rec.cityId) && (!cityId || x.rec.cityId === cityId)).length;
  if (stuck > 0) items.push({ type: "STUCK_SEARCHING", severity: "warning", count: stuck, title: "Rides searching for a captain for more than 10 minutes", link: "/rides" });
  const failedPayments = store.payments.filter((p) => p.status === "FAILED").length;
  if (failedPayments > 0) items.push({ type: "STUCK_PAYMENTS", severity: "warning", count: failedPayments, title: "Ride payments failed and need a retry or follow-up", link: "/finance" });
  const failedPayouts = store.payouts.filter((p) => p.status === "FAILED").length;
  if (failedPayouts > 0) items.push({ type: "FAILED_PAYOUTS", severity: "warning", count: failedPayouts, title: "Captain payouts failed", link: "/finance" });
  const expiring = store.captains.filter(
    (c) => c.d.status === "APPROVED" && c.d.documentChecklist.some((d) => d.ok && d.daysToExpiry !== null && d.daysToExpiry <= 14) && inScope(store, c.d.cityId) && (!cityId || c.d.cityId === cityId),
  ).length;
  if (expiring > 0) items.push({ type: "DOCUMENTS_EXPIRING", severity: "warning", count: expiring, title: "Approved captains with documents expiring within 14 days", link: "/kyc-queue" });
  const overdue = store.captains.filter((c) => c.d.status === "SUBMITTED" && c.d.submittedAt !== null && now - new Date(c.d.submittedAt).getTime() > 24 * HOUR && inScope(store, c.d.cityId) && (!cityId || c.d.cityId === cityId)).length;
  if (overdue > 0) items.push({ type: "CAPTAIN_APPROVALS_OVERDUE", severity: "warning", count: overdue, title: "Captain applications waiting more than 24 hours", link: "/kyc-queue" });
  items.push({ type: "RISK_SIGNALS_HIGH", severity: "info", count: 2, title: "High-risk signals on rider accounts to review", link: "/safety" });
  return { generatedAt: iso(now), items };
}

export function registerCore(r: Router): void {
  r.get("/admin/me", ({ store }) => ok(store.me));
  r.post("/admin/auth/logout", () => ok({ ok: true }));
  r.get("/admin/dashboard/kpis", ({ store, query }) => ok(kpis(store, query)));
  r.get("/admin/dashboard/alerts", ({ store, query }) => ok(alerts(store, query)));
  r.get("/admin/ops/snapshot", ({ store, query }) => ok(buildSnapshot(store, query.cityId || null)));
  r.get("/admin/live/map", ({ store, query }) => ok(buildLiveMap(store, query.cityId || null)));
}
