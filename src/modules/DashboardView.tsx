"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TrendingUp, Car, Users, DollarSign, Clock, ShieldCheck, Siren, AlertTriangle, ArrowRight, Zap, CreditCard, LifeBuoy } from "lucide-react";
import { Badge } from "@/components/Badge";
import { LiveMap } from "@/components/LiveMap";
import type { AdminTab } from "@/components/Sidebar";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardsSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCities } from "@/lib/cities/CityProvider";
import { useCursorList, useQuery } from "@/lib/hooks/useQuery";
import { useOnInvalidate } from "@/lib/invalidate";
import { useRealtimeStatus } from "@/lib/realtime";
import { useSosAlerts } from "@/lib/safety/useSosAlerts";
import { formatDateTime, formatMoney, timeAgo } from "@/lib/format";
import { useLiveMap, useOpsSnapshot } from "@/lib/rides/useLiveMap";
import { statusLabel, statusVariant, toRide, type ApiRideListItem } from "@/lib/adapters/rides";
import {
  alertTargetTab,
  formatDelta,
  toDashboard,
  type ApiAlerts,
  type ApiKpis,
  type DashboardAlertView,
} from "@/lib/adapters/dashboard";

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

const SEVERITY_STYLE: Record<DashboardAlertView["severity"], { box: string; icon: string; Icon: React.ElementType }> = {
  critical: {
    box: "border-[#FFC4BC] dark:border-[#61130A] bg-[#FFF3F1]/60 dark:bg-[#38110D]/30 hover:border-[#F94B35]",
    icon: "bg-[#FFF3F1] dark:bg-[#38110D] text-[#F94B35]",
    Icon: Siren,
  },
  warning: {
    box: "border-amber-200 dark:border-amber-950/60 bg-amber-50/60 dark:bg-amber-950/20 hover:border-amber-400",
    icon: "bg-amber-100 dark:bg-amber-950 text-amber-700",
    Icon: AlertTriangle,
  },
  info: {
    box: "border-[#E9BFDF] dark:border-[#521A44] bg-[#FAF0F7]/60 dark:bg-[#331A3B]/30 hover:border-[#7A2B66]",
    icon: "bg-[#FAF0F7] dark:bg-[#331A3B] text-[#7A2B66] dark:text-[#E9BFDF]",
    Icon: Users,
  },
};

export const DashboardView: React.FC<DashboardViewProps> = ({ selectedCityId, onSelectRide, onOpenSOSModal, onNavigateToTab }) => {
  const { can } = useAuth();
  const { cityName, selectedCity } = useCities();
  const { activeIncident } = useSosAlerts();
  const socketLive = useRealtimeStatus() === "connected";

  const [period, setPeriod] = useState<{ id: PeriodId; from: string | undefined }>({ id: "today", from: undefined });
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
  const { refetch: refetchKpis } = kpisQ;
  const { refetch: refetchAlerts } = alertsQ;
  useOnInvalidate("dashboard", () => {
    refetchKpis();
    refetchAlerts();
  });

  // live counters, map and recent rides
  const snapshot = useOpsSnapshot(selectedCityId, canRides);
  const map = useLiveMap(selectedCityId, canRides);
  const recent = useCursorList<ApiRideListItem>(canRides ? "/admin/rides" : null, { cityId: selectedCityId }, { limit: 8, pollMs: 30_000 });
  useOnInvalidate("rides", recent.refetch);
  const recentRides = useMemo(() => recent.items.map((r) => toRide(r, cityName)), [recent.items, cityName]);

  const dash = useMemo(() => (kpisQ.data ? toDashboard(kpisQ.data, alertsQ.data ?? null) : null), [kpisQ.data, alertsQ.data]);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const live = dash?.live;
  const openSos = live?.openSos ?? 0;
  const snapshotRides = snapshot?.rides ?? {};
  const activeRidesNow = snapshot ? Object.values(snapshotRides).reduce((a, b) => a + b, 0) : null;
  const searching = (snapshotRides.REQUESTED ?? 0) + (snapshotRides.SEARCHING ?? 0);
  const onTrip = (snapshotRides.RIDE_STARTED ?? 0) + (snapshotRides.IN_PROGRESS ?? 0);
  const onlineCaptains = snapshot?.onlineCaptains ?? live?.onlineCaptains ?? null;
  const currency = dash?.currency ?? "USD";

  const kpis = [
    {
      title: "Active Rides Now",
      value: activeRidesNow === null ? "—" : String(activeRidesNow),
      trend: activeRidesNow === null ? "Waiting for live data" : `${searching} searching • ${onTrip} on trip`,
      icon: Car,
      color: "text-[#3A102F] dark:text-[#E9BFDF]",
      bgColor: "bg-[#FAF0F7] dark:bg-[#331A3B]",
      action: undefined as (() => void) | undefined,
    },
    {
      title: "Online Fleet",
      value: onlineCaptains === null ? "—" : String(onlineCaptains),
      trend: dash ? `${dash.activeCaptains.value} captains completed trips (${periodLabel.toLowerCase()})` : "Loading...",
      icon: Users,
      color: "text-[#189578] dark:text-[#82E5CB]",
      bgColor: "bg-[#EFFCF9] dark:bg-[#0D2620]",
      action: undefined,
    },
    {
      title: `Gross GMV (${periodLabel})`,
      value: dash ? formatMoney(dash.gmv.value, currency) : "—",
      trend: dash ? formatDelta(dash.gmv.deltaPct) : "Loading...",
      icon: DollarSign,
      color: "text-[#7A2B66] dark:text-[#DB99CC]",
      bgColor: "bg-[#FAF0F7] dark:bg-[#331A3B]",
      action: undefined,
    },
    {
      title: `Platform Revenue (${periodLabel})`,
      value: dash ? formatMoney(dash.revenue.value, currency) : "—",
      trend: dash ? formatDelta(dash.revenue.deltaPct) : "Loading...",
      icon: TrendingUp,
      color: "text-[#189578] dark:text-[#82E5CB]",
      bgColor: "bg-[#EFFCF9] dark:bg-[#0D2620]",
      action: undefined,
    },
    {
      title: "Average Pickup ETA",
      value: dash && dash.etaMinutes.value > 0 ? `${dash.etaMinutes.value.toFixed(1)} min` : "—",
      trend: dash ? (dash.etaMinutes.value > 0 ? formatDelta(dash.etaMinutes.deltaPct) : "No accepted offers in period") : "Loading...",
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/40",
      action: undefined,
    },
    {
      title: "Safety / Open SOS",
      value: dash ? (openSos > 0 ? `${openSos} OPEN` : "0 Clean") : "—",
      trend: openSos > 0 ? "Tap to open the SOS console" : "No open incidents",
      icon: Siren,
      color: openSos > 0 ? "text-[#F94B35]" : "text-[#189578]",
      bgColor: openSos > 0 ? "bg-[#FFF3F1] dark:bg-[#38110D]" : "bg-[#EFFCF9] dark:bg-[#0D2620]",
      action: openSos > 0 ? () => onOpenSOSModal(activeIncident?.id) : undefined,
    },
  ];

  const outcomes = dash
    ? [
        { label: "Rides Requested", count: dash.requested.value, color: "bg-[#7A2B66]" },
        { label: "Completed", count: dash.completed.value, color: "bg-[#189578]" },
        { label: "Cancelled", count: dash.cancelled.value, color: "bg-[#F94B35]" },
        { label: "No Driver Available", count: dash.noDriver.value, color: "bg-amber-500" },
      ].map((o) => ({ ...o, pct: dash.requested.value > 0 ? Math.round((o.count / dash.requested.value) * 100) : 0 }))
    : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner if SOS Active */}
      {openSos > 0 && (
        <div className="rounded-2xl border-2 border-[#F94B35] bg-[#FFF3F1] dark:bg-[#38110D] p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg animate-sos">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F94B35] text-white">
              <Siren className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-[#F94B35]">Active Emergency Alert</span>
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
            className="rounded-xl bg-[#F94B35] hover:bg-[#D93320] text-white px-5 py-2 text-xs font-bold transition-all shadow-md"
          >
            Open SOS Command Console
          </button>
        </div>
      )}

      {/* Period selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Operations Dashboard</h1>
          <p className="text-xs text-slate-500">
            {selectedCity?.name ?? "All cities"} • money and ride KPIs for {periodLabel.toLowerCase()} vs the previous equal period
          </p>
        </div>
        <div className="flex rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-1 text-xs">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod({ id: p.id, from: p.days === 0 ? undefined : localDate(p.days) })}
              className={`rounded-lg px-3 py-1.5 font-bold transition-all ${
                period.id === p.id ? "bg-[#3A102F] text-white dark:bg-[#7A2B66]" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#28162E]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {kpisQ.error && <ErrorBanner error={kpisQ.error} title="Could not load dashboard KPIs" onRetry={kpisQ.refetch} />}

      {/* KPI Cards Grid */}
      {kpisQ.initialLoading ? (
        <CardsSkeleton count={6} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div
                key={idx}
                onClick={kpi.action}
                className={`rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-4 shadow-xs transition-all hover:shadow-md ${
                  kpi.action ? "cursor-pointer hover:border-[#F94B35]" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{kpi.title}</span>
                  <div className={`rounded-xl p-2 ${kpi.bgColor} ${kpi.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{kpi.value}</h3>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">{kpi.trend}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Fleet Radar Map Widget */}
      {canRides && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#F94B35]" />
                Live Fleet Operations & Real-Time Telemetry
              </h2>
              <p className="text-xs text-slate-500">Online captains (clustered) and active ride tracks</p>
            </div>
            <button onClick={() => onNavigateToTab("live-ops")} className="text-xs font-bold text-[#7A2B66] dark:text-[#DB99CC] hover:underline flex items-center gap-1">
              Expanded Live Radar <ArrowRight className="h-3.5 w-3.5" />
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

      {/* Two Column Section: Outcomes + Urgent Operations Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ride outcomes */}
        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Ride Outcomes ({periodLabel})</h3>
            {dash && (
              <Badge variant="teal" size="sm">
                Completion {dash.requested.value > 0 ? Math.round((dash.completed.value / dash.requested.value) * 100) : 0}%
              </Badge>
            )}
          </div>

          {!dash ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {outcomes.map((step) => (
                <div key={step.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{step.label}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {step.count} ({step.pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-[#211226] overflow-hidden">
                    <div className={`h-full rounded-full ${step.color} transition-all duration-500`} style={{ width: `${step.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-slate-400 italic">Rides requested in the selected period (scheduled rides still waiting for pickup are excluded).</p>
        </div>

        {/* Operational Attention Feed */}
        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Operations Attention Feed</h3>
            <span className="text-xs text-slate-400 font-mono">{alertsQ.data && now ? `Updated ${timeAgo(alertsQ.data.generatedAt, now)}` : "Syncing"}</span>
          </div>

          {alertsQ.error && <ErrorBanner error={alertsQ.error} title="Could not load alerts" onRetry={alertsQ.refetch} />}

          <div className="space-y-3">
            {alertsQ.initialLoading || !dash ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : dash.alerts.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="All clear" description="No operational alerts need attention right now." className="py-6" />
            ) : (
              dash.alerts.map((alert) => {
                const style = SEVERITY_STYLE[alert.severity];
                const Icon = alert.type === "STUCK_PAYMENTS" || alert.type === "FAILED_PAYOUTS" ? CreditCard : alert.type === "TICKET_SLA_BREACHED" ? LifeBuoy : style.Icon;
                const tab = alertTargetTab(alert.type);
                return (
                  <div
                    key={alert.type}
                    onClick={() => (alert.type === "ACTIVE_SOS" ? onOpenSOSModal(activeIncident?.id) : tab && onNavigateToTab(tab))}
                    className={`rounded-xl border p-3.5 flex items-start gap-3 transition-all ${tab || alert.type === "ACTIVE_SOS" ? "cursor-pointer" : ""} ${style.box}`}
                  >
                    <div className={`p-2 rounded-lg ${style.icon}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{alert.title}</span>
                        <Badge variant={alert.severity === "critical" ? "coral" : alert.severity === "warning" ? "warning" : "plum"} size="sm">
                          {alert.count}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent rides */}
      {canRides && (
        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0E3ED] dark:border-[#331A3B]">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Recent Rides</h3>
            <button onClick={() => onNavigateToTab("rides")} className="text-xs font-bold text-[#7A2B66] dark:text-[#DB99CC] hover:underline flex items-center gap-1">
              All rides <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          {recent.error && (
            <div className="p-4">
              <ErrorBanner error={recent.error} title="Could not load recent rides" onRetry={recent.refetch} />
            </div>
          )}
          {recent.initialLoading ? (
            <div className="p-5 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : recentRides.length === 0 ? (
            <EmptyState title="No rides yet" description="Rides will appear here as soon as riders start booking." className="py-8" />
          ) : (
            <div className="data-table-container">
              <table className="w-full text-left border-collapse text-xs">
                <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
                  {recentRides.map((ride) => (
                    <tr key={ride.id} onClick={() => onSelectRide(ride.id)} className="cursor-pointer hover:bg-slate-50/70 dark:hover:bg-[#28162E]/30 transition-colors">
                      <td className="py-3 px-5">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{ride.bookingCode}</span>
                        {ride.hasSOSAlert && <span className="ml-1.5 text-[10px] text-rose-500 font-black">SOS</span>}
                        <p className="text-[10px] text-slate-400">{ride.city}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-200">
                        {ride.rider.name}
                        <p className="text-[10px] text-slate-400">{ride.captain ? `with ${ride.captain.name}` : "no captain"}</p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={statusVariant(ride.rawStatus)} size="sm" dot>
                          {statusLabel(ride.rawStatus)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">{formatMoney(ride.finalFareMinor ?? ride.estimatedFareMinor, ride.currency)}</td>
                      <td className="py-3 px-5 text-right text-[10px] text-slate-400 whitespace-nowrap">{now ? timeAgo(ride.requestedAt, now) : formatDateTime(ride.requestedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
