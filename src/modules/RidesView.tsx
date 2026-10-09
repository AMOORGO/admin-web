"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, Eye, RefreshCw, Search, XCircle, Zap } from "lucide-react";
import { ChipTabs, FilterRow, PageHeader, SearchInput, Toolbar, fieldClass } from "@/components/ui/Page";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState, LoadMore } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useCities } from "@/lib/cities/CityProvider";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCursorList, useQuery } from "@/lib/hooks/useQuery";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { Money } from "@/components/ui/Money";
import { PersonCell } from "@/components/ui/PersonCell";
import { clearNavIntent, peekNavIntent } from "@/lib/navIntent";
import type { ApiKpis } from "@/lib/adapters/dashboard";
import { useOnInvalidate } from "@/lib/invalidate";
import { formatNumber, humanize } from "@/lib/format";
import { useServiceTypes } from "@/lib/rides/useServiceTypes";
import { useDebouncedCallback, useOpsSnapshot, useRideStateFeed } from "@/lib/rides/useLiveMap";
import {
  ALL_API_RIDE_STATUSES,
  STATUS_TABS,
  statusLabel,
  statusVariant,
  toRide,
  type ApiRideListItem,
  type RideView,
} from "@/lib/adapters/rides";

interface RidesViewProps {
  selectedCityId: string | null;
  onSelectRide: (rideId: string) => void;
}

const startOfDayIso = (d: string): string | undefined => {
  if (!d) return undefined;
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day, 0, 0, 0, 0).toISOString();
};
const endOfDayIso = (d: string): string | undefined => {
  if (!d) return undefined;
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day, 23, 59, 59, 999).toISOString();
};

const inputCls = `${fieldClass} font-semibold text-slate-700 dark:text-slate-200`;

export const RidesView: React.FC<RidesViewProps> = ({ selectedCityId, onSelectRide }) => {
  const { cityName } = useCities();
  const { can } = useAuth();
  const serviceTypes = useServiceTypes();
  const [activeTab, setActiveTab] = useState<string>(() => {
    const hint = peekNavIntent("rides");
    return hint && STATUS_TABS.some((t) => t.id === hint) ? hint : "ALL";
  });
  useEffect(() => clearNavIntent(), []);
  const [exactStatus, setExactStatus] = useState("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sosOnly, setSosOnly] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );
  const onSearch = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setQ(value.trim()), 350);
  };

  const tab = STATUS_TABS.find((t) => t.id === activeTab);
  const query = useMemo(
    () => ({
      cityId: selectedCityId,
      status: exactStatus !== "ALL" ? exactStatus : undefined,
      statuses: exactStatus === "ALL" && tab?.statuses ? tab.statuses.join(",") : undefined,
      q: q || undefined,
      serviceType: serviceTypeFilter !== "ALL" ? serviceTypeFilter : undefined,
      from: startOfDayIso(fromDate),
      to: endOfDayIso(toDate),
      hasSos: sosOnly ? true : undefined,
    }),
    [selectedCityId, exactStatus, tab, q, serviceTypeFilter, fromDate, toDate, sosOnly],
  );

  const list = useCursorList<ApiRideListItem>("/admin/rides", query, { limit: 25 });
  useOnInvalidate("rides", list.refetch);
  // keep the first page fresh when ride states change elsewhere (socket hint, debounced)
  const refetchSoon = useDebouncedCallback(list.refetch, 1500);
  useRideStateFeed(refetchSoon);

  const rides: RideView[] = useMemo(() => list.items.map((r) => toRide(r, cityName)), [list.items, cityName]);

  // Counters above the filters
  const canOps = can("dashboard.view") || can("rides.view");
  const snapshot = useOpsSnapshot(selectedCityId, canOps);
  const kpis = useQuery<ApiKpis>(can("dashboard.view") ? `rides-kpis:${selectedCityId ?? "all"}` : null, (signal) => api.get<ApiKpis>("/admin/dashboard/kpis", { query: { cityId: selectedCityId }, signal }), { pollMs: 30_000 });
  const snapRides = snapshot?.rides ?? {};
  const activeNow = Object.values(snapRides).reduce((a, b) => a + b, 0);
  const searching = (snapRides.REQUESTED ?? 0) + (snapRides.SEARCHING ?? 0);
  const onTrip = (snapRides.RIDE_STARTED ?? 0) + (snapRides.IN_PROGRESS ?? 0);
  const arriving = (snapRides.DRIVER_ASSIGNED ?? 0) + (snapRides.DRIVER_EN_ROUTE ?? 0) + (snapRides.DRIVER_ARRIVED ?? 0);

  const exportCSV = () => {
    const headers = ["BookingCode", "City", "ServiceType", "Status", "Requested", "Rider", "Captain", "Currency", "EstimatedFare", "FinalFare", "PaymentMethod", "PaymentStatus"];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = rides.map((r) => [
      r.bookingCode,
      r.city,
      r.serviceTypeCode,
      r.rawStatus,
      r.requestedAt,
      r.rider.name,
      r.captain ? r.captain.name : "None",
      r.currency,
      (r.estimatedFareMinor / 100).toFixed(2),
      r.finalFareMinor === null ? "" : (r.finalFareMinor / 100).toFixed(2),
      r.paymentMethodRaw,
      r.paymentStatusRaw ?? "",
    ]);
    const csv = [headers.map(esc).join(","), ...rows.map((row) => row.map(esc).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `amoorgo_rides_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <PageHeader
        title="Rides & Dispatch Operations"
        description="Monitor ride state machines, dispatch offers, GPS routes, and fare audits"
        actions={
          <>
            <button
              type="button"
              onClick={list.refetch}
              disabled={list.loading}
              className="flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-[#331A3B] dark:bg-[#180D1C] dark:text-slate-200 dark:hover:bg-[#28162E]"
            >
              <RefreshCw className={`h-4 w-4 ${list.loading ? "animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportCSV}
              disabled={rides.length === 0}
              className="flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-[#331A3B] dark:bg-[#180D1C] dark:text-slate-200 dark:hover:bg-[#28162E]"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </button>
          </>
        }
      />

      {/* Operational counters: live from the ops snapshot, today's outcomes from the KPI endpoint */}
      <StatGrid cols={4}>
        <StatCard label="Active rides now" icon={Zap} tone="brand" loading={!snapshot && canOps} value={snapshot ? formatNumber(activeNow) : "—"} hint={snapshot ? `${onTrip} on trip • ${arriving} arriving` : undefined} />
        <StatCard label="Searching for a captain" icon={Search} tone={searching > 0 ? "warn" : "neutral"} loading={!snapshot && canOps} value={snapshot ? formatNumber(searching) : "—"} hint="Requested or matching" />
        <StatCard label="Completed today" icon={CheckCircle2} tone="good" loading={kpis.initialLoading} value={kpis.data ? formatNumber(kpis.data.kpis.ridesCompleted.value) : "—"} delta={kpis.data ? { pct: kpis.data.kpis.ridesCompleted.deltaPct } : undefined} hint="vs same hours yesterday" />
        <StatCard
          label="Cancelled / no driver today"
          icon={XCircle}
          tone="bad"
          loading={kpis.initialLoading}
          value={kpis.data ? formatNumber(kpis.data.kpis.ridesCancelled.value + kpis.data.kpis.ridesNoDriver.value) : "—"}
          hint={kpis.data ? `${kpis.data.kpis.ridesCancelled.value} cancelled • ${kpis.data.kpis.ridesNoDriver.value} no driver` : undefined}
        />
      </StatGrid>

      {/* Filter and Search Bar */}
      <Toolbar>
        <ChipTabs
          label="Ride status"
          items={STATUS_TABS}
          value={exactStatus === "ALL" ? activeTab : ""}
          onChange={(id) => {
            setActiveTab(id);
            setExactStatus("ALL");
          }}
        />

        <FilterRow>
          <SearchInput value={searchInput} onValueChange={onSearch} placeholder="Search booking ref or ride ID..." className="min-[480px]:col-span-2 lg:w-72" />
          <select value={serviceTypeFilter} onChange={(e) => setServiceTypeFilter(e.target.value)} className={`${inputCls} cursor-pointer`} aria-label="Service type">
            <option value="ALL">All Services</option>
            {serviceTypes.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={exactStatus} onChange={(e) => setExactStatus(e.target.value)} className={`${inputCls} cursor-pointer`} aria-label="Exact status">
            <option value="ALL">Any exact status</option>
            {ALL_API_RIDE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
          <label className="flex min-w-0 items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="w-9 shrink-0 lg:w-auto">From</span>
            <input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} className={inputCls} />
          </label>
          <label className="flex min-w-0 items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="w-9 shrink-0 lg:w-auto">To</span>
            <input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} className={inputCls} />
          </label>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={sosOnly} onChange={(e) => setSosOnly(e.target.checked)} className="accent-[#F94B35]" />
            SOS rides only
          </label>
          {(fromDate || toDate || sosOnly || exactStatus !== "ALL" || q || serviceTypeFilter !== "ALL" || activeTab !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setActiveTab("ALL");
                setExactStatus("ALL");
                setSearchInput("");
                setQ("");
                setServiceTypeFilter("ALL");
                setFromDate("");
                setToDate("");
                setSosOnly(false);
              }}
              className="min-h-10 text-left text-xs font-bold text-[#7A2B66] hover:underline dark:text-[#DB99CC] lg:ml-auto"
            >
              Clear filters
            </button>
          )}
        </FilterRow>
      </Toolbar>

      {list.error && <ErrorBanner error={list.error} title="Could not load rides" onRetry={list.refetch} />}

      {/* Data Table */}
      <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] overflow-hidden shadow-xs">
        {list.initialLoading ? (
          <TableSkeleton rows={8} cols={8} />
        ) : (
          <div className="data-table-container sticky-first">
            <table className="w-full min-w-[72rem] border-collapse text-left">
              <thead>
                <tr>
                  <th className="px-4 py-3">Booking</th>
                  <th className="px-3 py-3">City / service</th>
                  <th className="px-3 py-3">Passenger</th>
                  <th className="px-3 py-3">Captain</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Requested</th>
                  <th className="num px-3 py-3">Fare</th>
                  <th className="px-3 py-3">Payment</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
                {rides.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState title="No rides found" description="No rides match the current filters." />
                    </td>
                  </tr>
                ) : (
                  rides.map((ride) => (
                    <tr key={ride.id}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{ride.bookingCode}</span>
                          {ride.hasSOSAlert && <StatusPill variant="danger" dot={false}>SOS</StatusPill>}
                        </div>
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{ride.id.slice(0, 8)}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-semibold text-slate-900 dark:text-white">{ride.city}</span>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{ride.serviceTypeName}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <PersonCell name={ride.rider.name} avatar={ride.rider.avatar} subtitle={ride.rider.rating > 0 ? `★ ${ride.rider.rating.toFixed(1)}` : undefined} size="sm" />
                      </td>
                      <td className="px-3 py-2.5">
                        {ride.captain ? (
                          <PersonCell name={ride.captain.name} avatar={ride.captain.avatar} subtitle={<span className="font-mono">{ride.captain.vehiclePlate}</span>} size="sm" />
                        ) : (
                          <span className="text-slate-600 dark:text-slate-300">{ride.status === "SEARCHING" ? "Matching…" : "—"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill variant={statusVariant(ride.rawStatus)}>{statusLabel(ride.rawStatus)}</StatusPill>
                      </td>
                      <td className="px-3 py-2.5 text-slate-800 dark:text-slate-100">
                        <RelativeTime iso={ride.requestedAt} />
                      </td>
                      <td className="num px-3 py-2.5 font-bold text-slate-900 dark:text-white">
                        <Money minor={ride.finalFareMinor ?? ride.estimatedFareMinor} currency={ride.currency} />
                        {ride.finalFareMinor === null && <span className="block text-xs font-normal text-slate-600 dark:text-slate-300">estimate</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-slate-800 dark:text-slate-100">{humanize(ride.paymentMethodRaw)}</span>
                        {ride.paymentStatusRaw && <p className="text-xs text-slate-600 dark:text-slate-300">{humanize(ride.paymentStatusRaw)}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => onSelectRide(ride.id)}
                          className="mx-auto inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[#FAF0F7] px-3 text-[13px] font-bold text-[#7A2B66] transition-all hover:bg-[#3A102F] hover:text-white dark:bg-[#331A3B] dark:text-[#E9BFDF]"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </div>
    </div>
  );
};
