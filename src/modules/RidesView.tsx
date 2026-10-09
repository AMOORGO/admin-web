"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, RefreshCw } from "lucide-react";
import { ChipTabs, FilterRow, PageHeader, SearchInput, Toolbar, fieldClass } from "@/components/ui/Page";
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

const inputCls = `${fieldClass} font-semibold text-slate-700 dark:text-slate-200`;

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

      {/* Top Quick Metrics (computed over the rides currently loaded for the active filters) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-[#331A3B] dark:bg-[#180D1C]">
          <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Matching Rides</span>
          <p className="mt-0.5 text-lg font-black text-slate-900 dark:text-white">{countLabel(rides.length)}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-[#331A3B] dark:bg-[#180D1C]">
          <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Completed Trips</span>
          <p className="mt-0.5 text-lg font-black text-emerald-700 dark:text-emerald-400">{stats.completed}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-[#331A3B] dark:bg-[#180D1C]">
          <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Active Now</span>
          <p className="mt-0.5 text-lg font-black text-[#7A2B66] dark:text-[#DB99CC]">{stats.active}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-[#331A3B] dark:bg-[#180D1C]">
          <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Cancellations</span>
          <p className="mt-0.5 text-lg font-black text-[#D93320] dark:text-[#FF7361]">{stats.cancelled}</p>
        </div>
      </div>

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
              className="min-h-10 text-left text-[11px] font-bold text-[#7A2B66] hover:underline dark:text-[#DB99CC] lg:ml-auto"
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
            <table className="w-full min-w-[68rem] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
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
                          {ride.hasSOSAlert && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-black animate-pulse">SOS</span>}
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{ride.id.slice(0, 8)}</span>
                      </td>

                      {/* City / Service */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{ride.city}</span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{ride.serviceTypeName}</p>
                      </td>

                      {/* Rider */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ride.rider.avatar} alt={ride.rider.name} className="h-6 w-6 rounded-full object-cover" />
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{ride.rider.name}</p>
                            {ride.rider.rating > 0 && <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">★ {ride.rider.rating.toFixed(1)}</p>}
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
                          <span className="text-slate-500 dark:text-slate-400 italic">{ride.status === "SEARCHING" ? "Matching..." : "None"}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <Badge variant={statusVariant(ride.rawStatus)} size="sm" dot>
                          {statusLabel(ride.rawStatus)}
                        </Badge>
                      </td>

                      {/* Requested */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDateTime(ride.requestedAt)}</td>

                      {/* Fare */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatMoney(ride.finalFareMinor ?? ride.estimatedFareMinor, ride.currency)}
                        {ride.finalFareMinor === null && <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400">estimate</p>}
                      </td>

                      {/* Payment */}
                      <td className="py-3 px-4">
                        <span className="text-slate-600 dark:text-slate-300">{humanize(ride.paymentMethodRaw)}</span>
                        {ride.paymentStatusRaw && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{humanize(ride.paymentStatusRaw)}</p>
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
