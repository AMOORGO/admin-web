"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Banknote, Car, Clock, CreditCard, FileWarning, Gauge, LifeBuoy, Receipt, ShieldCheck, Siren, TrendingUp, UserCheck, Users, Wallet, Zap } from "lucide-react";
import { Badge } from "@/components/Badge";
import { LiveMap } from "@/components/LiveMap";
import type { AdminTab } from "@/components/Sidebar";
import { BarChart } from "@/components/ui/BarChart";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Money } from "@/components/ui/Money";
import { ChipTabs } from "@/components/ui/Page";
import { PersonCell } from "@/components/ui/PersonCell";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { Skeleton } from "@/components/ui/Skeleton";
import { StackedBar } from "@/components/ui/StackedBar";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCities } from "@/lib/cities/CityProvider";
import { useCursorList, useQuery } from "@/lib/hooks/useQuery";
import { useOnInvalidate } from "@/lib/invalidate";
import { useRealtimeStatus } from "@/lib/realtime";
import { useSosAlerts } from "@/lib/safety/useSosAlerts";
import { setNavIntent } from "@/lib/navIntent";
import { formatDayLong, formatDayShort, formatMoney, formatMoneyCompact, formatNumber, formatPercent } from "@/lib/format";
import { useLiveMap, useOpsSnapshot } from "@/lib/rides/useLiveMap";
import { statusLabel, statusVariant, toRide, type ApiRideListItem } from "@/lib/adapters/rides";
import { alertTargetTab, toDashboard, toTrendDay, type AlertSeverity, type ApiAlerts, type ApiKpis, type DashboardAlertView, type TrendDay } from "@/lib/adapters/dashboard";

interface DashboardViewProps {
  selectedCityId: string | null;
  onSelectRide: (rideId: string) => void;
  onOpenSOSModal: (incidentId?: string) => void;
  onNavigateToTab: (tab: AdminTab) => void;
}

const PERIODS = [
  { id: "today", label: "Today", days: 0 },
  { id: "7d", label: "Last 7 days", days: 6 },
  { id: "30d", label: "Last 30 days", days: 29 },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

const localDate = (daysBack: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** What each attention item means, where it leads and which filter the destination opens with. */
const ALERT_META: Record<string, { heading: string; cta: string; icon: React.ElementType; filter?: string }> = {
  ACTIVE_SOS: { heading: "Active SOS", cta: "Open console", icon: Siren },
  SOS_SLA_BREACHED: { heading: "SOS past SLA", cta: "Open safety", icon: Siren, filter: "ACTIVE" },
  RISK_SIGNALS_HIGH: { heading: "High-risk signals", cta: "Review", icon: ShieldCheck },
  STUCK_SEARCHING: { heading: "Rides stuck searching", cta: "View rides", icon: Car, filter: "SEARCHING" },
  STUCK_PAYMENTS: { heading: "Failed payments", cta: "View payments", icon: CreditCard, filter: "TRANSACTIONS" },
  FAILED_PAYOUTS: { heading: "Failed payouts", cta: "View payouts", icon: Banknote, filter: "PAYOUTS" },
  PENDING_REFUNDS: { heading: "Refunds awaiting approval", cta: "Review refunds", icon: Receipt, filter: "REFUNDS" },
  DOCUMENTS_EXPIRED: { heading: "Expired documents", cta: "Open KYC queue", icon: FileWarning },
  DOCUMENTS_EXPIRING: { heading: "Documents expiring soon", cta: "Open KYC queue", icon: FileWarning },
  CAPTAIN_APPROVALS_OVERDUE: { heading: "Applications overdue", cta: "Open KYC queue", icon: UserCheck },
  PENDING_CAPTAIN_APPROVALS: { heading: "Captain applications pending", cta: "Open KYC queue", icon: UserCheck },
  OPEN_TICKETS: { heading: "Open support tickets", cta: "", icon: LifeBuoy },
  TICKET_SLA_BREACHED: { heading: "Tickets past SLA", cta: "", icon: LifeBuoy },
};

const SEVERITY: Record<AlertSeverity, { label: string; bar: string; chip: string; count: string }> = {
  critical: {
    label: "Critical",
    bar: "border-l-[#F94B35]",
    chip: "bg-[#FFF3F1] text-[#B02414] dark:bg-[#38110D] dark:text-[#FFA093]",
    count: "bg-[#D93320] text-white",
  },
  warning: {
    label: "Warning",
    bar: "border-l-amber-500",
    chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    count: "bg-amber-500 text-amber-950",
  },
  info: {
    label: "Info",
    bar: "border-l-[#A74490]",
    chip: "bg-[#FAF0F7] text-[#7A2B66] dark:bg-[#331A3B] dark:text-[#E9BFDF]",
    count: "bg-[#7A2B66] text-white dark:bg-[#A74490]",
  },
};

type TrendMetric = "gmv" | "revenue" | "trips";

const shortPlace = (address: string | null | undefined): string => (address ? address.split(",")[0] : "—");

export const DashboardView: React.FC<DashboardViewProps> = ({ selectedCityId, onSelectRide, onOpenSOSModal, onNavigateToTab }) => {
  const { can } = useAuth();
  const { cityName, selectedCity } = useCities();
  const { activeIncident } = useSosAlerts();
  const socketLive = useRealtimeStatus() === "connected";

  const [period, setPeriod] = useState<{ id: PeriodId; from: string | undefined }>({ id: "today", from: undefined });
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("gmv");
  const periodLabel = PERIODS.find((p) => p.id === period.id)?.label ?? "Today";
  const canRides = can("rides.view");

  // KPIs + alerts (reports module); refreshed every 30 s / 10 s and on any console mutation
  const kpisQ = useQuery<ApiKpis>(
    `dash-kpis:${selectedCityId ?? "all"}:${period.from ?? ""}`,
    (signal) => api.get<ApiKpis>("/admin/dashboard/kpis", { query: { cityId: selectedCityId, from: period.from }, signal }),
    { pollMs: 30_000 },
  );
  const alertsQ = useQuery<ApiAlerts>(
    `dash-alerts:${selectedCityId ?? "all"}`,
    (signal) => api.get<ApiAlerts>("/admin/dashboard/alerts", { query: { cityId: selectedCityId }, signal }),
    { pollMs: 15_000 },
  );
  // 7-day trend: the same KPI endpoint scoped to one local day each (the API has no time series of its own)
  const trendQ = useQuery<TrendDay[]>(
    `dash-trend:${selectedCityId ?? "all"}`,
    async (signal) => {
      const days = [6, 5, 4, 3, 2, 1, 0].map((back) => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - back);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return { date: localDate(back), from: start.toISOString(), to: end.toISOString() };
      });
      const results = await Promise.all(days.map((d) => api.get<ApiKpis>("/admin/dashboard/kpis", { query: { cityId: selectedCityId, from: d.from, to: d.to }, signal })));
      return results.map((k, i) => toTrendDay(days[i].date, k));
    },
    { pollMs: 120_000 },
  );
  const { refetch: refetchKpis } = kpisQ;
  const { refetch: refetchAlerts } = alertsQ;
  const { refetch: refetchTrend } = trendQ;
  useOnInvalidate("dashboard", () => {
    refetchKpis();
    refetchAlerts();
    refetchTrend();
  });

  // live counters, map and recent rides
  const snapshot = useOpsSnapshot(selectedCityId, canRides);
  const map = useLiveMap(selectedCityId, canRides);
  const recent = useCursorList<ApiRideListItem>(canRides ? "/admin/rides" : null, { cityId: selectedCityId }, { limit: 10, pollMs: 30_000 });
  useOnInvalidate("rides", recent.refetch);
  const recentRides = useMemo(() => recent.items.map((r) => toRide(r, cityName)), [recent.items, cityName]);

  const dash = useMemo(() => (kpisQ.data ? toDashboard(kpisQ.data, alertsQ.data ?? null) : null), [kpisQ.data, alertsQ.data]);
  const trend = trendQ.data;

  const live = dash?.live;
  const openSos = live?.openSos ?? 0;
  const snapshotRides = snapshot?.rides ?? {};
  const activeRidesNow = snapshot ? Object.values(snapshotRides).reduce((a, b) => a + b, 0) : null;
  const searching = (snapshotRides.REQUESTED ?? 0) + (snapshotRides.SEARCHING ?? 0);
  const onTrip = (snapshotRides.RIDE_STARTED ?? 0) + (snapshotRides.IN_PROGRESS ?? 0);
  const onlineCaptains = snapshot?.onlineCaptains ?? live?.onlineCaptains ?? null;
  const currency = dash?.currency ?? "USD";
  const loading = kpisQ.initialLoading;
  const takeRate = dash && dash.gmv.value > 0 ? (dash.revenue.value / dash.gmv.value) * 100 : null;

  const sparkOf = (pick: (d: TrendDay) => number) => (trend ? trend.map(pick) : undefined);

  const trendBars = useMemo(() => {
    if (!trend) return [];
    return trend.map((d, i) => ({
      key: d.date,
      label: formatDayShort(d.date),
      title: formatDayLong(d.date) + (i === trend.length - 1 ? " (today)" : ""),
      value: trendMetric === "gmv" ? d.gmvMinor : trendMetric === "revenue" ? d.revenueMinor : d.completed,
      highlight: i === trend.length - 1,
      details: [`${d.completed} completed trips`, `GMV ${formatMoney(d.gmvMinor, currency)}`, `Platform revenue ${formatMoney(d.revenueMinor, currency)}`],
    }));
  }, [trend, trendMetric, currency]);
  const trendTotal = trend ? trend.reduce((a, d) => a + (trendMetric === "gmv" ? d.gmvMinor : trendMetric === "revenue" ? d.revenueMinor : d.completed), 0) : 0;
  const trendFmt = (v: number) => (trendMetric === "trips" ? `${formatNumber(v)} trips` : formatMoney(v, currency));
  const trendTick = (v: number) => (trendMetric === "trips" ? formatNumber(v) : formatMoneyCompact(v, currency));

  const inProgress = dash ? Math.max(0, dash.requested.value - dash.completed.value - dash.cancelled.value - dash.noDriver.value) : 0;
  const outcomes = dash
    ? [
        { key: "completed", label: "Completed", value: dash.completed.value, color: "bg-[#189578] dark:bg-[#26B896]" },
        { key: "progress", label: "In progress / searching", value: inProgress, color: "bg-[#A74490] dark:bg-[#C76DB3]" },
        { key: "cancelled", label: "Cancelled", value: dash.cancelled.value, color: "bg-[#F94B35]" },
        { key: "nodriver", label: "No driver available", value: dash.noDriver.value, color: "bg-amber-500" },
      ]
    : [];
  const completion = dash && dash.requested.value > 0 ? (dash.completed.value / dash.requested.value) * 100 : null;

  const openAlert = (alert: DashboardAlertView) => {
    if (alert.type === "ACTIVE_SOS") {
      onOpenSOSModal(activeIncident?.id);
      return;
    }
    const tab = alertTargetTab(alert.type);
    if (!tab) return;
    const filter = ALERT_META[alert.type]?.filter;
    if (filter) setNavIntent(tab, filter);
    onNavigateToTab(tab);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top banner if an SOS is active */}
      {openSos > 0 && (
        <div className="animate-sos flex flex-col gap-3 rounded-2xl border-2 border-[#F94B35] bg-[#FFF3F1] p-4 shadow-lg dark:bg-[#38110D] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D93320] text-white">
              <Siren className="h-5 w-5 motion-safe:animate-pulse" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase text-[#B02414] dark:text-[#FF7361]">Active Emergency Alert</span>
                {activeIncident && (
                  <Badge variant="coral" size="sm" pulse>
                    SLA: {activeIncident.slaSecondsLeft}s
                  </Badge>
                )}
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {activeIncident
                  ? `${activeIncident.triggeredBy === "CAPTAIN" ? "Captain" : "Rider"} ${activeIncident.userName} triggered SOS in ${activeIncident.city}.`
                  : `${openSos} open SOS incident${openSos === 1 ? "" : "s"} need${openSos === 1 ? "s" : ""} attention.`}
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenSOSModal(activeIncident?.id)}
            className="min-h-11 w-full rounded-xl bg-[#D93320] px-5 py-2 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#B02414] sm:w-auto sm:shrink-0"
          >
            Open SOS Command Console
          </button>
        </div>
      )}

      {/* Title + period selector */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">Executive Overview</h1>
          <p className="text-[13px] text-slate-600 dark:text-slate-300">
            {selectedCity?.name ?? "All cities"} • {periodLabel.toLowerCase()} compared with the previous equal period
          </p>
        </div>
        <div role="group" aria-label="Period" className="flex w-full rounded-xl border border-slate-200 bg-white p-1 text-[13px] dark:border-[#331A3B] dark:bg-[#180D1C] sm:w-auto">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod({ id: p.id, from: p.days === 0 ? undefined : localDate(p.days) })}
              aria-pressed={period.id === p.id}
              className={`min-h-10 flex-1 whitespace-nowrap rounded-lg px-3.5 font-bold transition-colors sm:flex-none ${
                period.id === p.id ? "bg-[#3A102F] text-white dark:bg-[#7A2B66]" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#28162E]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {kpisQ.error && <ErrorBanner error={kpisQ.error} title="Could not load dashboard KPIs" onRetry={kpisQ.refetch} />}

      {/* Revenue KPIs */}
      <section aria-label="Revenue and trips" className="space-y-3">
        <StatGrid cols={4}>
          <StatCard
            label={`Gross GMV (${periodLabel.toLowerCase()})`}
            icon={Wallet}
            tone="brand"
            size="lg"
            loading={loading}
            value={dash ? <Money minor={dash.gmv.value} currency={currency} /> : "—"}
            delta={dash ? { pct: dash.gmv.deltaPct } : undefined}
            hint="vs previous period"
            spark={sparkOf((d) => d.gmvMinor)}
            sparkLabel="GMV per day, last 7 days"
          />
          <StatCard
            label="Platform revenue"
            icon={TrendingUp}
            tone="good"
            size="lg"
            loading={loading}
            value={dash ? <Money minor={dash.revenue.value} currency={currency} /> : "—"}
            delta={dash ? { pct: dash.revenue.deltaPct } : undefined}
            hint={takeRate !== null ? `${formatPercent(takeRate)} of GMV` : "vs previous period"}
            spark={sparkOf((d) => d.revenueMinor)}
            sparkLabel="Platform revenue per day, last 7 days"
          />
          <StatCard
            label="Completed trips"
            icon={Car}
            tone="info"
            size="lg"
            loading={loading}
            value={dash ? formatNumber(dash.completed.value) : "—"}
            delta={dash ? { pct: dash.completed.deltaPct } : undefined}
            hint={dash ? `of ${formatNumber(dash.requested.value)} requested` : undefined}
            spark={sparkOf((d) => d.completed)}
            sparkLabel="Completed trips per day, last 7 days"
          />
          <StatCard
            label="Average fare"
            icon={Banknote}
            tone="warn"
            size="lg"
            loading={loading}
            value={dash && dash.avgFare.valueMinor !== null ? <Money minor={dash.avgFare.valueMinor} currency={currency} /> : "—"}
            delta={dash && dash.avgFare.valueMinor !== null ? { pct: dash.avgFare.deltaPct } : undefined}
            hint={dash && dash.avgFare.valueMinor === null ? "No completed trips yet" : "per completed trip"}
            spark={sparkOf((d) => (d.completed > 0 ? Math.round(d.gmvMinor / d.completed) : 0))}
            sparkLabel="Average fare per day, last 7 days"
          />
        </StatGrid>

        {/* Operations KPIs */}
        <StatGrid cols={4}>
          <StatCard label="Active rides now" icon={Zap} tone="brand" loading={loading && activeRidesNow === null} value={activeRidesNow === null ? "—" : formatNumber(activeRidesNow)} hint={activeRidesNow === null ? "Waiting for live data" : `${searching} searching • ${onTrip} on trip`} />
          <StatCard label="Online captains" icon={Users} tone="good" loading={loading && onlineCaptains === null} value={onlineCaptains === null ? "—" : formatNumber(onlineCaptains)} hint={dash ? `${dash.activeCaptains.value} drove trips (${periodLabel.toLowerCase()})` : undefined} />
          <StatCard
            label="Avg pickup ETA"
            icon={Clock}
            tone="warn"
            loading={loading}
            value={dash && dash.etaMinutes.value > 0 ? `${dash.etaMinutes.value.toFixed(1)} min` : "—"}
            delta={dash && dash.etaMinutes.value > 0 ? { pct: dash.etaMinutes.deltaPct, goodWhen: "down" } : undefined}
            hint={dash && dash.etaMinutes.value <= 0 ? "No accepted offers in period" : "vs previous period"}
          />
          <StatCard
            label="Open SOS"
            icon={Siren}
            tone={openSos > 0 ? "bad" : "good"}
            loading={loading}
            value={dash ? (openSos > 0 ? `${openSos} open` : "0 open") : "—"}
            hint={dash ? (openSos > 0 ? "Click to open the SOS console" : "No open incidents") : undefined}
            onClick={openSos > 0 ? () => onOpenSOSModal(activeIncident?.id) : undefined}
          />
        </StatGrid>
      </section>

      {/* Trend + outcomes */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
        <Card className="xl:col-span-2">
          <CardHeader
            title="7-day trend"
            icon={TrendingUp}
            description={trend ? `${trendMetric === "trips" ? "Completed trips" : trendMetric === "gmv" ? "Gross GMV" : "Platform revenue"} this week: ${trendMetric === "trips" ? formatNumber(trendTotal) : formatMoney(trendTotal, currency)}` : "Loading the last seven days"}
            actions={<ChipTabs label="Trend metric" items={[{ id: "gmv", label: "GMV" }, { id: "revenue", label: "Revenue" }, { id: "trips", label: "Trips" }]} value={trendMetric} onChange={setTrendMetric} />}
          />
          <div className="px-4 pb-5 sm:px-5">
            {trendQ.error && !trend ? (
              <EmptyState icon={AlertTriangle} title="Trend unavailable" description="The daily KPI series could not be loaded." className="py-10" />
            ) : trend ? (
              <BarChart data={trendBars} formatValue={trendFmt} formatTick={trendTick} ariaLabel={`${trendMetric === "trips" ? "Completed trips" : trendMetric === "gmv" ? "GMV" : "Platform revenue"} per day over the last 7 days`} valueHeader={trendMetric === "trips" ? "Trips" : "Amount"} height={220} />
            ) : (
              <div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-[#211226]" role="status" aria-label="Loading trend" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={`Ride outcomes (${periodLabel.toLowerCase()})`}
            icon={Gauge}
            actions={completion !== null ? <StatusPill variant={completion >= 75 ? "teal" : completion >= 50 ? "warning" : "coral"}>Completion {formatPercent(completion, 0)}</StatusPill> : undefined}
          />
          <div className="px-4 pb-5 sm:px-5">
            {!dash ? (
              <div className="space-y-3" role="status" aria-label="Loading outcomes">
                <Skeleton className="h-9 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            ) : dash.requested.value === 0 ? (
              <EmptyState icon={Car} title="No rides requested" description="Nothing was requested in this period." className="py-8" />
            ) : (
              <StackedBar segments={outcomes} total={dash.requested.value} totalLabel="Rides requested" />
            )}
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">Scheduled rides still waiting for pickup are not counted.</p>
          </div>
        </Card>
      </div>

      {/* Attention feed + live map */}
      <div className={`grid grid-cols-1 gap-4 xl:gap-6 ${canRides ? "xl:grid-cols-5" : ""}`}>
        <Card className="flex flex-col xl:col-span-2">
          <CardHeader
            title="Operational attention"
            icon={AlertTriangle}
            description={alertsQ.data ? (dash && dash.alerts.length > 0 ? `${dash.alerts.length} items, most urgent first` : "Nothing needs action") : "Syncing"}
            actions={alertsQ.data ? <RelativeTime iso={alertsQ.data.generatedAt} className="text-xs text-slate-600 dark:text-slate-300" /> : undefined}
          />
          <div className="min-h-0 flex-1 px-4 pb-4 sm:px-5 sm:pb-5">
            {alertsQ.error && <ErrorBanner error={alertsQ.error} title="Could not load alerts" onRetry={alertsQ.refetch} className="mb-3" />}
            {alertsQ.initialLoading || !dash ? (
              <div className="space-y-3" role="status" aria-label="Loading alerts">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : dash.alerts.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="All clear" description="No operational alerts need attention right now." className="py-10" />
            ) : (
              <ul className="space-y-2.5">
                {dash.alerts.map((alert) => {
                  const meta = ALERT_META[alert.type];
                  const sev = SEVERITY[alert.severity];
                  const Icon = meta?.icon ?? AlertTriangle;
                  const tab = alertTargetTab(alert.type);
                  const actionable = alert.type === "ACTIVE_SOS" || !!tab;
                  const body = (
                    <>
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${sev.chip}`}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{meta?.heading ?? alert.title}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${sev.chip}`}>{sev.label}</span>
                        </span>
                        {meta && <span className="mt-0.5 block text-[13px] leading-snug text-slate-600 dark:text-slate-300">{alert.title}</span>}
                      </span>
                      <span className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-2 text-sm font-extrabold tabular-nums ${sev.count}`} aria-label={`${alert.count} affected`}>
                        {alert.count}
                      </span>
                      {actionable && meta?.cta && <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />}
                    </>
                  );
                  const cls = `flex w-full items-center gap-3 rounded-xl border border-l-4 border-[#F0E3ED] bg-white p-3 text-left dark:border-[#331A3B] dark:bg-[#211226] ${sev.bar}`;
                  return (
                    <li key={alert.type}>
                      {actionable ? (
                        <button type="button" onClick={() => openAlert(alert)} aria-label={`${meta?.heading ?? alert.title}, ${alert.count}. ${meta?.cta ?? "Open"}`} className={`${cls} transition-colors hover:bg-[#FAF0F7]/70 dark:hover:bg-[#28162E]`}>
                          {body}
                        </button>
                      ) : (
                        <div className={cls}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        {canRides && (
          <div className="min-w-0 space-y-3 xl:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                  <Zap className="h-4 w-4 text-[#D93320] dark:text-[#FF7361]" aria-hidden="true" />
                  Live fleet operations
                </h2>
                <p className="text-[13px] text-slate-600 dark:text-slate-300">Online captains (clustered) and active ride tracks</p>
              </div>
              <button onClick={() => onNavigateToTab("live-ops")} className="flex min-h-10 items-center gap-1 text-sm font-bold text-[#7A2B66] hover:underline dark:text-[#DB99CC]">
                Open Live Radar <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {map.error && <ErrorBanner error={map.error} title="Could not load the live map" onRetry={map.refetch} />}
            <LiveMap
              cityLabel={selectedCity?.name ?? "All Cities"}
              center={selectedCity ? [selectedCity.centerLat, selectedCity.centerLng] : null}
              rides={map.data?.rides ?? []}
              clusters={map.data?.clusters ?? []}
              onlineTotal={map.data?.onlineTotal ?? snapshot?.onlineCaptains ?? 0}
              loading={map.initialLoading}
              socketLive={socketLive}
              onSelectRide={onSelectRide}
            />
          </div>
        )}
      </div>

      {/* Recent rides */}
      {canRides && (
        <Card>
          <CardHeader
            title="Recent rides"
            icon={Car}
            description="Latest requests across the selected cities"
            actions={
              <button onClick={() => onNavigateToTab("rides")} className="flex min-h-10 items-center gap-1 text-sm font-bold text-[#7A2B66] hover:underline dark:text-[#DB99CC]">
                View all rides <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            }
          />
          {recent.error && (
            <div className="px-4 pb-4">
              <ErrorBanner error={recent.error} title="Could not load recent rides" onRetry={recent.refetch} />
            </div>
          )}
          {recent.initialLoading ? (
            <div className="space-y-3 px-5 pb-5" role="status" aria-label="Loading rides">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : recentRides.length === 0 ? (
            <EmptyState title="No rides yet" description="Rides will appear here as soon as riders start booking." className="py-8" />
          ) : (
            <>
              <ul className="divide-y divide-[#F0E3ED] border-t border-[#F0E3ED] dark:divide-[#331A3B] dark:border-[#331A3B] md:hidden">
                {recentRides.map((ride) => (
                  <li key={ride.id}>
                    <button type="button" onClick={() => onSelectRide(ride.id)} className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FAF0F7]/60 dark:hover:bg-[#28162E]/50">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-mono text-sm font-bold text-slate-900 dark:text-white">
                          {ride.bookingCode}
                          {ride.hasSOSAlert && <StatusPill variant="danger" dot={false}>SOS</StatusPill>}
                        </span>
                        <span className="block truncate text-[13px] text-slate-700 dark:text-slate-200">
                          {ride.rider.name} • {ride.captain ? ride.captain.name : "no captain yet"}
                        </span>
                        <span className="block truncate text-[13px] text-slate-600 dark:text-slate-300">
                          {shortPlace(ride.pickupAddress)} → {shortPlace(ride.dropoffAddress)}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <StatusPill variant={statusVariant(ride.rawStatus)}>{statusLabel(ride.rawStatus)}</StatusPill>
                        <Money minor={ride.finalFareMinor ?? ride.estimatedFareMinor} currency={ride.currency} className="text-sm font-bold text-slate-900 dark:text-white" />
                        <RelativeTime iso={ride.requestedAt} className="text-xs text-slate-600 dark:text-slate-300" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="data-table-container table-scroll-y hidden border-t border-[#F0E3ED] dark:border-[#331A3B] md:block">
                <table className="w-full min-w-[60rem] border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="px-5 py-3">Ride</th>
                      <th className="px-3 py-3">Rider</th>
                      <th className="px-3 py-3">Captain</th>
                      <th className="px-3 py-3">Route</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="num px-3 py-3">Fare</th>
                      <th className="px-5 py-3">Requested</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E3ED] dark:divide-[#331A3B]">
                    {recentRides.map((ride) => (
                      <tr key={ride.id} onClick={() => onSelectRide(ride.id)} className="cursor-pointer">
                        <td className="px-5 py-2.5">
                          <button type="button" onClick={(e) => { e.stopPropagation(); onSelectRide(ride.id); }} className="font-mono text-sm font-bold text-slate-900 hover:underline dark:text-white">
                            {ride.bookingCode}
                          </button>
                          {ride.hasSOSAlert && <span className="ml-2 align-middle"><StatusPill variant="danger" dot={false}>SOS</StatusPill></span>}
                          <span className="block text-xs text-slate-600 dark:text-slate-300">{ride.city}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <PersonCell name={ride.rider.name} avatar={ride.rider.avatar} size="sm" />
                        </td>
                        <td className="px-3 py-2.5">
                          {ride.captain ? <PersonCell name={ride.captain.name} avatar={ride.captain.avatar} subtitle={ride.captain.vehiclePlate} size="sm" /> : <span className="text-slate-600 dark:text-slate-300">{ride.status === "SEARCHING" ? "Matching…" : "—"}</span>}
                        </td>
                        <td className="max-w-[16rem] px-3 py-2.5">
                          <span className="block truncate text-slate-900 dark:text-white" title={ride.pickupAddress}>
                            {shortPlace(ride.pickupAddress)}
                          </span>
                          <span className="block truncate text-xs text-slate-600 dark:text-slate-300" title={ride.dropoffAddress}>
                            → {shortPlace(ride.dropoffAddress)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusPill variant={statusVariant(ride.rawStatus)}>{statusLabel(ride.rawStatus)}</StatusPill>
                        </td>
                        <td className="num px-3 py-2.5 font-bold text-slate-900 dark:text-white">
                          <Money minor={ride.finalFareMinor ?? ride.estimatedFareMinor} currency={ride.currency} />
                          {ride.finalFareMinor === null && <span className="block text-xs font-normal text-slate-600 dark:text-slate-300">estimate</span>}
                        </td>
                        <td className="px-5 py-2.5 text-slate-700 dark:text-slate-200">
                          <RelativeTime iso={ride.requestedAt} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
};
