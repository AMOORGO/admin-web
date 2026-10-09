"use client";

import React, { useState } from "react";
import { Siren, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/Badge";
import { EmptyState, LoadMore } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ChipTabs, PageHeader, fieldClass } from "@/components/ui/Page";
import { CardsSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { toIncident, type ApiIncidentDetail, type ApiIncidentSummary, type ApiIncidentStatus, type ApiIncidentType, type IncidentView } from "@/lib/adapters/safety";
import { useCities } from "@/lib/cities/CityProvider";
import { formatDateTime, humanize, timeAgo } from "@/lib/format";
import { useCursorList, useQuery } from "@/lib/hooks/useQuery";
import { useOnInvalidate } from "@/lib/invalidate";
import { useRealtimeStatus, useSocketEvent } from "@/lib/realtime";
import { useNow } from "@/lib/safety/useNow";
import { useStaffDirectory } from "@/lib/safety/useStaffDirectory";

interface SafetyConsoleViewProps {
  selectedCityId: string | null;
  onOpenSOSModal: (incidentId: string) => void;
}

type LogFilter = "ALL" | Exclude<ApiIncidentStatus, "ACTIVE">;
const LOG_FILTERS: { value: LogFilter; label: string }[] = [
  { value: "ALL", label: "ALL" },
  { value: "ACKNOWLEDGED", label: "ACKNOWLEDGED" },
  { value: "RESOLVED", label: "RESOLVED" },
  { value: "FALSE_ALARM", label: "FALSE ALARM" },
];
const TYPES: ApiIncidentType[] = ["SOS", "SAFETY_REPORT", "ROUTE_DEVIATION", "ACCIDENT", "LOST_ITEM", "HARASSMENT", "OTHER"];

const statusVariant = (s: ApiIncidentStatus) => (s === "ACTIVE" ? "coral" : s === "ACKNOWLEDGED" ? "warning" : s === "RESOLVED" ? "teal" : "neutral") as "coral" | "warning" | "teal" | "neutral";

export const SafetyConsoleView: React.FC<SafetyConsoleViewProps> = ({ selectedCityId, onOpenSOSModal }) => {
  const { cityName } = useCities();
  const staff = useStaffDirectory();
  const connected = useRealtimeStatus() === "connected";
  const [logFilter, setLogFilter] = useState<LogFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<ApiIncidentType | "ALL">("ALL");
  const [dayStart] = useState<string>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  });

  const city = selectedCityId ?? undefined;
  const pollMs = connected ? 60_000 : 15_000;

  const active = useCursorList<ApiIncidentSummary>("/admin/incidents", { status: "ACTIVE", cityId: city }, { limit: 50, pollMs });
  const log = useCursorList<ApiIncidentSummary>(
    "/admin/incidents",
    { status: logFilter === "ALL" ? undefined : logFilter, type: typeFilter === "ALL" ? undefined : typeFilter, cityId: city },
    { limit: 25, pollMs: 60_000 },
  );
  const today = useQuery<ApiIncidentSummary[]>(
    `incidents-today:${city ?? "all"}:${dayStart}`,
    async (signal) => (await api.getPage<ApiIncidentSummary>("/admin/incidents", { query: { from: dayStart, cityId: city, limit: 100 }, signal })).items,
    { pollMs: 60_000 },
  );

  const refreshAll = () => {
    active.refetch();
    log.refetch();
    today.refetch();
  };
  useOnInvalidate("incidents", refreshAll);
  // Live pushes: reload the lists on raise/update (location pings are frequent and carry nothing the lists show).
  useSocketEvent("sos.raised", refreshAll);
  useSocketEvent<{ change?: string }>("incident.updated", (p) => {
    if (p?.change !== "LOCATION") refreshAll();
  });

  const activeSosRunning = active.items.some((i) => i.type === "SOS");
  const now = useNow(1000, activeSosRunning);
  const ctx = { now, cityName, staffName: staff.nameOf };

  const handledToday = (today.data ?? []).filter((i) => i.status === "RESOLVED" || i.status === "FALSE_ALARM").length;
  const logRows = log.items.map((i) => toIncident(i, ctx));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Safety & Emergency Incident Console"
        badge={
          <Badge variant="coral" size="sm">
            SLA Monitored
          </Badge>
        }
        description="Real-time SOS triggers, acknowledgement SLA, incident timeline, and contact logging"
      />

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:max-w-xl">
        <div className="min-w-0 rounded-xl border border-[#FFC4BC] bg-[#FFF3F1] px-3.5 py-2 text-xs dark:border-[#61130A] dark:bg-[#38110D]">
          <span className="text-[10px] font-bold uppercase text-[#B02414] dark:text-[#FF7361]">Active Alarms</span>
          <p className="font-mono font-black text-[#B02414] dark:text-[#FF7361]">
            {active.items.length}
            {active.hasMore ? "+" : ""} Unacknowledged
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs dark:border-[#331A3B] dark:bg-[#180D1C]">
          <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Handled Today</span>
          <p className="font-mono font-black text-emerald-700 dark:text-emerald-400">{today.data ? handledToday : "—"} Closed</p>
        </div>
      </div>

      {/* Active Critical Incidents */}
      {active.error && <ErrorBanner error={active.error} title="Could not load active incidents" onRetry={active.refetch} />}
      {active.initialLoading && <CardsSkeleton count={1} />}
      {active.items.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-[#D93320] dark:text-[#FF7361] flex items-center gap-2">
            <Siren className="h-4 w-4 shrink-0 motion-safe:animate-bounce" aria-hidden="true" />
            Active Emergencies Requiring Immediate Response
          </h2>

          <div className="space-y-4">
            {active.items.map((i) => (
              <ActiveCard key={i.id} summary={i} ctx={ctx} onOpen={() => onOpenSOSModal(i.id)} />
            ))}
          </div>
          <LoadMore hasMore={active.hasMore} loading={active.loadingMore} onClick={active.loadMore} />
        </div>
      )}
      {!active.initialLoading && !active.error && active.items.length === 0 && (
        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] shadow-xs">
          <EmptyState icon={ShieldCheck} title="No unacknowledged incidents" description="New SOS alerts appear here instantly and sound the beacon in the top bar." />
        </div>
      )}

      {/* Incident History Table */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Incident Resolution Log</h2>
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
            <ChipTabs label="Incident status" items={LOG_FILTERS.map((f) => ({ id: f.value, label: f.label }))} value={logFilter} onChange={setLogFilter} />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ApiIncidentType | "ALL")}
              className={`${fieldClass} cursor-pointer`}
              aria-label="Incident type"
            >
              <option value="ALL">All types</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {log.error && <ErrorBanner error={log.error} title="Could not load the incident log" onRetry={log.refetch} />}

        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] overflow-hidden shadow-xs">
          {log.initialLoading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : logRows.length === 0 && !log.error ? (
            <EmptyState icon={ShieldCheck} title="No incidents found" description="Nothing matches the current filters." />
          ) : (
            <div className="data-table-container sticky-first">
              <table className="w-full min-w-[60rem] text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Incident</th>
                    <th className="py-3 px-4">City</th>
                    <th className="py-3 px-4">Initiator</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned Staff</th>
                    <th className="py-3 px-4">Raised</th>
                    <th className="py-3 px-4">Resolution Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
                  {logRows.map((inc) => (
                    <tr key={inc.id} onClick={() => onOpenSOSModal(inc.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-[#28162E]/30">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {inc.ref}
                        <p className="font-sans text-[10px] font-normal text-slate-500 dark:text-slate-400">{humanize(inc.type)}</p>
                      </td>
                      <td className="py-3 px-4">{inc.city}</td>
                      <td className="py-3 px-4 font-semibold">{inc.realm === "CAPTAIN" ? "Captain" : "Rider"}</td>
                      <td className="py-3 px-4">
                        <Badge variant={inc.severity === "CRITICAL" || inc.severity === "HIGH" ? "coral" : "neutral"} size="sm">
                          {inc.severity}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={statusVariant(inc.status)} size="sm">
                          {inc.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                        {inc.assignedStaffId ? (staff.nameOf(inc.assignedStaffId) ?? `Staff ${inc.assignedStaffId.slice(0, 6)}`) : "Unassigned"}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{inc.timestamp}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {inc.outcomeCode ? humanize(inc.outcomeCode) : inc.status === "ACKNOWLEDGED" ? "In progress" : "Awaiting acknowledgement"}
                        {inc.slaBreached && <span className="ml-1.5 text-[#D93320] dark:text-[#FF7361] font-bold">SLA breached</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <LoadMore hasMore={log.hasMore} loading={log.loadingMore} onClick={log.loadMore} />
        </div>
      </div>
    </div>
  );
};

interface ActiveCardProps {
  summary: ApiIncidentSummary;
  ctx: { now: number; cityName: (id: string | null | undefined) => string; staffName: (id: string | null | undefined) => string | null };
  onOpen: () => void;
}

/** One unacknowledged incident. The list row has no names or telemetry, so the detail is fetched for the card. */
const ActiveCard: React.FC<ActiveCardProps> = ({ summary, ctx, onOpen }) => {
  const detail = useQuery<ApiIncidentDetail>(`incident-card:${summary.id}`, (signal) => api.get<ApiIncidentDetail>(`/admin/incidents/${summary.id}`, { signal }));
  const incident: IncidentView = toIncident(summary, ctx, detail.data);
  const breached = incident.slaRunning && (incident.slaSecondsLeft === 0 || incident.slaBreached);
  const rideRef = detail.data?.snapshot?.ride?.bookingRef;

  return (
    <div className="animate-sos min-w-0 space-y-4 rounded-3xl border-2 border-[#F94B35] bg-white p-4 shadow-xl dark:bg-[#180D1C] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D93320] text-white">
            <Siren className="h-6 w-6 motion-safe:animate-pulse" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase text-[#D93320] dark:text-[#FF7361]">
                {incident.ref} • {incident.city}
              </span>
              <Badge variant="coral" size="sm" pulse>
                {incident.status} • {humanize(incident.type)}
              </Badge>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Triggered by {incident.triggeredBy === "CAPTAIN" ? "Captain" : "Rider"}: {incident.userName}
              {incident.userPhone ? ` (${incident.userPhone})` : ""}
            </h3>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {incident.slaRunning && (
            <div className={`rounded-2xl border px-4 py-2 text-center ${breached ? "bg-rose-600 text-white border-rose-700" : "bg-[#FFF3F1] dark:bg-[#38110D] border-[#FFC4BC] text-[#B02414] dark:border-[#61130A] dark:text-[#FF7361]"}`}>
              <span className="text-[10px] font-bold uppercase">{breached ? "SLA BREACHED" : "SLA TIMER"}</span>
              <p className="text-xl font-mono font-black">{incident.slaSecondsLeft}s Left</p>
            </div>
          )}

          <button onClick={onOpen} className="min-h-11 rounded-xl bg-[#D93320] px-5 py-2.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-[#B02414]">
            Launch Incident Command
          </button>
        </div>
      </div>

      {/* Telemetry info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Tile label="Speed" value={incident.speedMph !== undefined ? `${incident.speedMph} mph` : "—"} mono />
        <Tile label="Battery" value={incident.battery !== null ? `${incident.battery}%` : "—"} mono />
        <Tile label="Linked Trip" value={rideRef ?? (incident.rideId ? incident.rideId.slice(0, 8) : "No active ride")} accent />
        <Tile label="Raised" value={timeAgo(incident.createdAt, ctx.now)} sub={formatDateTime(incident.createdAt)} />
      </div>
    </div>
  );
};

const Tile: React.FC<{ label: string; value: string; sub?: string; mono?: boolean; accent?: boolean }> = ({ label, value, sub, mono, accent }) => (
  <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#331A3B] dark:bg-[#211226]">
    <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold">{label}</span>
    <p className={`truncate font-bold ${mono ? "font-mono" : ""} ${accent ? "text-[#7A2B66] dark:text-[#DB99CC]" : "text-slate-900 dark:text-white"}`}>{value}</p>
    {sub && <p className="text-[10px] text-slate-500 dark:text-slate-400">{sub}</p>}
  </div>
);
