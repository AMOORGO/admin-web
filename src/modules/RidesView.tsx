"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Download, Eye, RefreshCw } from "lucide-react";
import { Badge } from "@/components/Badge";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState, LoadMore } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useCities } from "@/lib/cities/CityProvider";
import { useCursorList } from "@/lib/hooks/useQuery";
import { useOnInvalidate } from "@/lib/invalidate";
import { formatDateTime, formatMoney, humanize } from "@/lib/format";
import { useServiceTypes } from "@/lib/rides/useServiceTypes";
import { useDebouncedCallback, useRideStateFeed } from "@/lib/rides/useLiveMap";
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

const inputCls =
  "rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none";

export const RidesView: React.FC<RidesViewProps> = ({ selectedCityId, onSelectRide }) => {
  const { cityName } = useCities();
  const serviceTypes = useServiceTypes();
  const [activeTab, setActiveTab] = useState<string>("ALL");
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

  const stats = useMemo(
    () => ({
      completed: rides.filter((r) => r.status === "COMPLETED").length,
      active: rides.filter((r) => r.status === "ON_TRIP" || r.status === "ARRIVING" || r.status === "ARRIVED" || r.status === "ACCEPTED").length,
      cancelled: rides.filter((r) => r.status === "CANCELLED").length,
    }),
    [rides],
  );

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

  const countLabel = (n: number) => (list.hasMore ? `${n}+` : String(n));

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Title & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Rides & Dispatch Operations</h1>
          <p className="text-xs text-slate-500">Monitor ride state machines, dispatch offers, GPS routes, and fare audits</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={list.refetch}
            disabled={list.loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#28162E] transition-colors shadow-xs disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${list.loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            disabled={rides.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#28162E] transition-colors shadow-xs disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Top Quick Metrics (computed over the rides currently loaded for the active filters) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400">Matching Rides</span>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{countLabel(rides.length)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400">Completed Trips</span>
          <p className="text-lg font-black text-emerald-600 mt-0.5">{stats.completed}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400">Active Now</span>
          <p className="text-lg font-black text-[#7A2B66] dark:text-[#DB99CC] mt-0.5">{stats.active}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400">Cancellations</span>
          <p className="text-lg font-black text-[#F94B35] mt-0.5">{stats.cancelled}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3 rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex gap-1 overflow-x-auto text-xs pb-1 sm:pb-0">
            {STATUS_TABS.map((st) => (
              <button
                key={st.id}
                onClick={() => {
                  setActiveTab(st.id);
                  setExactStatus("ALL");
                }}
                className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap ${
                  activeTab === st.id && exactStatus === "ALL"
                    ? "bg-[#3A102F] text-white dark:bg-[#7A2B66]"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#28162E]"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Search & Service Select */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search booking ref or ride ID..."
                value={searchInput}
                onChange={(e) => onSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
              />
            </div>

            <select value={serviceTypeFilter} onChange={(e) => setServiceTypeFilter(e.target.value)} className={`${inputCls} cursor-pointer`}>
              <option value="ALL">All Services</option>
              {serviceTypes.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select value={exactStatus} onChange={(e) => setExactStatus(e.target.value)} className={`${inputCls} cursor-pointer`} aria-label="Exact status">
            <option value="ALL">Any exact status</option>
            {ALL_API_RIDE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-slate-500">
            From
            <input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} className={inputCls} />
          </label>
          <label className="flex items-center gap-1.5 text-slate-500">
            To
            <input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} className={inputCls} />
          </label>
          <label className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={sosOnly} onChange={(e) => setSosOnly(e.target.checked)} className="accent-[#F94B35]" />
            SOS rides only
          </label>
          {(fromDate || toDate || sosOnly || exactStatus !== "ALL" || q || serviceTypeFilter !== "ALL" || activeTab !== "ALL") && (
            <button
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
              className="ml-auto text-[11px] font-bold text-[#7A2B66] dark:text-[#DB99CC] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {list.error && <ErrorBanner error={list.error} title="Could not load rides" onRetry={list.refetch} />}

      {/* Data Table */}
      <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] overflow-hidden shadow-xs">
        {list.initialLoading ? (
          <TableSkeleton rows={8} cols={8} />
        ) : (
          <div className="data-table-container">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Booking Code</th>
                  <th className="py-3.5 px-4">City / Service</th>
                  <th className="py-3.5 px-4">Passenger</th>
                  <th className="py-3.5 px-4">Assigned Captain</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Requested</th>
                  <th className="py-3.5 px-4 text-right">Fare</th>
                  <th className="py-3.5 px-4">Payment</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
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
                    <tr key={ride.id} className="hover:bg-slate-50/70 dark:hover:bg-[#28162E]/30 transition-colors">
                      {/* Code */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{ride.bookingCode}</span>
                          {ride.hasSOSAlert && <span className="text-[10px] text-rose-500 font-black animate-pulse">SOS</span>}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{ride.id.slice(0, 8)}</span>
                      </td>

                      {/* City / Service */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{ride.city}</span>
                        <p className="text-[11px] text-slate-400">{ride.serviceTypeName}</p>
                      </td>

                      {/* Rider */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ride.rider.avatar} alt={ride.rider.name} className="h-6 w-6 rounded-full object-cover" />
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{ride.rider.name}</p>
                            {ride.rider.rating > 0 && <p className="text-[10px] text-amber-500 font-bold">★ {ride.rider.rating.toFixed(1)}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Captain */}
                      <td className="py-3 px-4">
                        {ride.captain ? (
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ride.captain.avatar} alt={ride.captain.name} className="h-6 w-6 rounded-full object-cover" />
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{ride.captain.name}</p>
                              <p className="text-[10px] font-mono text-[#7A2B66] dark:text-[#DB99CC]">{ride.captain.vehiclePlate}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">{ride.status === "SEARCHING" ? "Matching..." : "None"}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <Badge variant={statusVariant(ride.rawStatus)} size="sm" dot>
                          {statusLabel(ride.rawStatus)}
                        </Badge>
                      </td>

                      {/* Requested */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">{formatDateTime(ride.requestedAt)}</td>

                      {/* Fare */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatMoney(ride.finalFareMinor ?? ride.estimatedFareMinor, ride.currency)}
                        {ride.finalFareMinor === null && <p className="text-[10px] font-normal text-slate-400">estimate</p>}
                      </td>

                      {/* Payment */}
                      <td className="py-3 px-4">
                        <span className="text-slate-600 dark:text-slate-300">{humanize(ride.paymentMethodRaw)}</span>
                        {ride.paymentStatusRaw && (
                          <p className="text-[10px] text-slate-400">{humanize(ride.paymentStatusRaw)}</p>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onSelectRide(ride.id)}
                          className="rounded-lg bg-[#FAF0F7] dark:bg-[#331A3B] px-3 py-1.5 font-bold text-[#7A2B66] dark:text-[#E9BFDF] hover:bg-[#3A102F] hover:text-white transition-all flex items-center justify-center gap-1 mx-auto"
                        >
                          <Eye className="h-3.5 w-3.5" />
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
