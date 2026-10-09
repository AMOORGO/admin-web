import type { AdminTab } from "@/components/Sidebar";

/** One KPI of GET /admin/dashboard/kpis: current period vs the previous equal-length period. */
export interface ApiMetric {
  value: number;
  previous: number;
  delta: number;
  /** percentage with one decimal; null when the previous value is 0 */
  deltaPct: number | null;
}

export interface ApiKpis {
  generatedAt: string;
  cityId: string | null;
  currency: string;
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  kpis: {
    ridesRequested: ApiMetric;
    ridesCompleted: ApiMetric;
    ridesCancelled: ApiMetric;
    ridesNoDriver: ApiMetric;
    completionRate: ApiMetric;
    cancellationRate: ApiMetric;
    noDriverRate: ApiMetric;
    /** minor units (cents) */
    gmvMinor: ApiMetric;
    platformRevenueMinor: ApiMetric;
    activeRiders: ApiMetric;
    activeCaptains: ApiMetric;
    avgRating: ApiMetric;
    avgPickupEtaSeconds: ApiMetric;
    paymentFailureRate: ApiMetric;
  };
  live: { onlineCaptains: number; openSos: number; openTickets: number; pendingCaptainApprovals: number; pendingRefunds: number };
}

export type AlertSeverity = "critical" | "warning" | "info";

export interface ApiAlert {
  type: string;
  severity: AlertSeverity;
  count: number;
  title: string;
  link: string;
}

export interface ApiAlerts {
  generatedAt: string;
  items: ApiAlert[];
}

export interface DashboardAlertView {
  type: string;
  severity: AlertSeverity;
  count: number;
  title: string;
}

export interface DashboardView {
  currency: string;
  requested: { value: number; deltaPct: number | null };
  completed: { value: number; deltaPct: number | null };
  cancelled: { value: number };
  noDriver: { value: number };
  /** Average fare of completed rides in minor units (GMV / completed); the delta compares with the previous period. */
  avgFare: { valueMinor: number | null; deltaPct: number | null };
  cancellationRate: { value: number; deltaPct: number | null };
  /** major units (dollars) */
  gmv: { value: number; deltaPct: number | null };
  revenue: { value: number; deltaPct: number | null };
  etaMinutes: { value: number; deltaPct: number | null };
  activeCaptains: { value: number };
  live: ApiKpis["live"];
  alerts: DashboardAlertView[];
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** Maps the API payloads onto what the dashboard cards need; gauges from `live` become extra info alerts. */
export function toDashboard(k: ApiKpis, a: ApiAlerts | null): DashboardView {
  const alerts: DashboardAlertView[] = (a?.items ?? []).map((i) => ({ type: i.type, severity: i.severity, count: i.count, title: i.title }));
  if (k.live.pendingCaptainApprovals > 0) {
    alerts.push({ type: "PENDING_CAPTAIN_APPROVALS", severity: "info", count: k.live.pendingCaptainApprovals, title: "Captain applications pending KYC review" });
  }
  if (k.live.pendingRefunds > 0) {
    alerts.push({ type: "PENDING_REFUNDS", severity: "info", count: k.live.pendingRefunds, title: "Refund requests waiting for approval" });
  }
  if (k.live.openTickets > 0) {
    alerts.push({ type: "OPEN_TICKETS", severity: "info", count: k.live.openTickets, title: "Open support tickets" });
  }
  alerts.sort((x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity]);
  return {
    currency: k.currency,
    requested: { value: k.kpis.ridesRequested.value, deltaPct: k.kpis.ridesRequested.deltaPct },
    completed: { value: k.kpis.ridesCompleted.value, deltaPct: k.kpis.ridesCompleted.deltaPct },
    cancelled: { value: k.kpis.ridesCancelled.value },
    noDriver: { value: k.kpis.ridesNoDriver.value },
    avgFare: avgFare(k),
    cancellationRate: { value: k.kpis.cancellationRate.value, deltaPct: k.kpis.cancellationRate.deltaPct },
    gmv: { value: k.kpis.gmvMinor.value, deltaPct: k.kpis.gmvMinor.deltaPct },
    revenue: { value: k.kpis.platformRevenueMinor.value, deltaPct: k.kpis.platformRevenueMinor.deltaPct },
    etaMinutes: { value: k.kpis.avgPickupEtaSeconds.value / 60, deltaPct: k.kpis.avgPickupEtaSeconds.deltaPct },
    activeCaptains: { value: k.kpis.activeCaptains.value },
    live: k.live,
    alerts,
  };
}

function avgFare(k: ApiKpis): DashboardView["avgFare"] {
  const cur = k.kpis.ridesCompleted.value > 0 ? k.kpis.gmvMinor.value / k.kpis.ridesCompleted.value : null;
  const prev = k.kpis.ridesCompleted.previous > 0 ? k.kpis.gmvMinor.previous / k.kpis.ridesCompleted.previous : null;
  return { valueMinor: cur === null ? null : Math.round(cur), deltaPct: cur !== null && prev !== null && prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null };
}

/** One day of the revenue trend (a KPI call scoped to a single local day). */
export interface TrendDay {
  date: string;
  gmvMinor: number;
  revenueMinor: number;
  completed: number;
  requested: number;
}

export const toTrendDay = (date: string, k: ApiKpis): TrendDay => ({
  date,
  gmvMinor: k.kpis.gmvMinor.value,
  revenueMinor: k.kpis.platformRevenueMinor.value,
  completed: k.kpis.ridesCompleted.value,
  requested: k.kpis.ridesRequested.value,
});

export function formatDelta(deltaPct: number | null): string {
  if (deltaPct === null) return "No prior-period data";
  const arrow = deltaPct > 0 ? "▲" : deltaPct < 0 ? "▼" : "•";
  return `${arrow} ${Math.abs(deltaPct).toFixed(1)}% vs previous period`;
}

/** Where an alert should take the operator (undefined = informational only). */
export function alertTargetTab(type: string): AdminTab | undefined {
  switch (type) {
    case "SOS_SLA_BREACHED":
    case "RISK_SIGNALS_HIGH":
      return "safety";
    case "STUCK_SEARCHING":
      return "rides";
    case "STUCK_PAYMENTS":
    case "FAILED_PAYOUTS":
    case "PENDING_REFUNDS":
      return "finance";
    case "DOCUMENTS_EXPIRED":
    case "DOCUMENTS_EXPIRING":
    case "CAPTAIN_APPROVALS_OVERDUE":
    case "PENDING_CAPTAIN_APPROVALS":
      return "kyc-queue";
    default:
      return undefined;
  }
}
