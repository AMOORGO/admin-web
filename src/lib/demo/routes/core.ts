/** Session, dashboard KPIs / alerts, ops snapshot and the live map. */
import type { ApiAlert, ApiAlerts, ApiKpis, ApiMetric } from "../../adapters/dashboard";
import { buildLiveMap, buildSnapshot, onlineCaptainCount } from "../logic/ops";
import { type Router, ok } from "../router";
import type { DemoStore } from "../store";
import { DAY, HOUR, MIN, iso } from "../util";

const SHARE: number[] = [0.68, 0.19, 0.13];

function metric(value: number, previousFactor: number, decimals = 0): ApiMetric {
  const f = 10 ** decimals;
  const v = Math.round(value * f) / f;
  const previous = Math.round((v / previousFactor) * f) / f;
  return { value: v, previous, delta: Math.round((v - previous) * f) / f, deltaPct: previous === 0 ? null : Math.round(((v - previous) / previous) * 1000) / 10 };
}

function cityShare(store: DemoStore, cityId: string | undefined): number {
  if (!cityId) return 1;
  const idx = store.cities.findIndex((c) => c.id === cityId);
  return idx >= 0 ? (SHARE[idx] ?? 0.1) : 0.1;
}

function kpis(store: DemoStore, query: Record<string, string>): ApiKpis {
  const now = Date.now();
  const cityId = query.cityId || undefined;
  const fromMs = query.from ? new Date(query.from).getTime() : NaN;
  const days = Number.isFinite(fromMs) ? Math.max(1, Math.floor((now - fromMs) / DAY) + 1) : 1;
  const share = cityShare(store, cityId);
  const scale = share * days * (days > 1 ? 0.97 : 1);
  const requested = 120 * scale;
  const completed = requested * 0.82;
  const cancelled = requested * 0.11;
  const noDriver = requested * 0.07;
  const gmv = completed * 2740;
  const incidents = store.incidents.filter((i) => (i.status === "ACTIVE" || i.status === "ACKNOWLEDGED") && i.type === "SOS" && (!cityId || i.cityId === cityId));
  return {
    generatedAt: iso(now),
    cityId: cityId ?? null,
    currency: "USD",
    period: { from: iso(now - days * DAY), to: iso(now) },
    previousPeriod: { from: iso(now - 2 * days * DAY), to: iso(now - days * DAY) },
    kpis: {
      ridesRequested: metric(requested, 1.04),
      ridesCompleted: metric(completed, 1.06),
      ridesCancelled: metric(cancelled, 0.95),
      ridesNoDriver: metric(noDriver, 0.91),
      completionRate: metric(82, 1.02, 1),
      cancellationRate: metric(11, 0.97, 1),
      noDriverRate: metric(7, 0.93, 1),
      gmvMinor: metric(gmv, 1.08),
      platformRevenueMinor: metric(gmv * 0.205, 1.09),
      activeRiders: metric(requested * 0.64, 1.05),
      activeCaptains: metric(Math.max(4, 13 * share * (1 + Math.log(days) * 0.18)), 1.02),
      avgRating: metric(4.82, 1.003, 2),
      avgPickupEtaSeconds: metric(318, 0.96),
      paymentFailureRate: metric(1.4, 0.88, 1),
    },
    live: {
      onlineCaptains: onlineCaptainCount(store, cityId ?? null),
      openSos: incidents.length,
      openTickets: Math.max(1, Math.round(7 * (cityId ? share * 1.4 : 1))),
      pendingCaptainApprovals: store.captains.filter((c) => (c.d.status === "SUBMITTED" || c.d.status === "UNDER_REVIEW") && (!cityId || c.d.cityId === cityId)).length,
      pendingRefunds: store.refunds.filter((x) => x.status === "PENDING").length,
    },
  };
}

function alerts(store: DemoStore, query: Record<string, string>): ApiAlerts {
  const now = Date.now();
  const cityId = query.cityId || undefined;
  const items: ApiAlert[] = [];
  const breached = store.incidents.filter(
    (i) => i.type === "SOS" && i.status === "ACTIVE" && (!cityId || i.cityId === cityId) && (i.slaBreached || (i.ackDueAt !== null && new Date(i.ackDueAt).getTime() < now)),
  ).length;
  if (breached > 0) items.push({ type: "SOS_SLA_BREACHED", severity: "critical", count: breached, title: "SOS incidents past the acknowledgement SLA", link: "/safety" });
  const stuck = store.rides.filter((x) => x.rec.status === "SEARCHING" && now - new Date(x.rec.requestedAt).getTime() > 10 * MIN && (!cityId || x.rec.cityId === cityId)).length;
  if (stuck > 0) items.push({ type: "STUCK_SEARCHING", severity: "warning", count: stuck, title: "Rides searching for a captain for more than 10 minutes", link: "/rides" });
  const failedPayments = store.payments.filter((p) => p.status === "FAILED").length;
  if (failedPayments > 0) items.push({ type: "STUCK_PAYMENTS", severity: "warning", count: failedPayments, title: "Ride payments failed and need a retry or follow-up", link: "/finance" });
  const failedPayouts = store.payouts.filter((p) => p.status === "FAILED").length;
  if (failedPayouts > 0) items.push({ type: "FAILED_PAYOUTS", severity: "warning", count: failedPayouts, title: "Captain payouts failed", link: "/finance" });
  const expiring = store.captains.filter(
    (c) => c.d.status === "APPROVED" && c.d.documentChecklist.some((d) => d.ok && d.daysToExpiry !== null && d.daysToExpiry <= 14) && (!cityId || c.d.cityId === cityId),
  ).length;
  if (expiring > 0) items.push({ type: "DOCUMENTS_EXPIRING", severity: "warning", count: expiring, title: "Approved captains with documents expiring within 14 days", link: "/kyc-queue" });
  const overdue = store.captains.filter((c) => c.d.status === "SUBMITTED" && c.d.submittedAt !== null && now - new Date(c.d.submittedAt).getTime() > 24 * HOUR && (!cityId || c.d.cityId === cityId)).length;
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
