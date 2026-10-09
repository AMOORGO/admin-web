"use client";

import React, { useMemo, useState } from "react";
import { Car, Search, Siren } from "lucide-react";
import { Badge } from "@/components/Badge";
import { LiveMap, type LiveMapRideLabel } from "@/components/LiveMap";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState, LoadMore } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCities } from "@/lib/cities/CityProvider";
import { useCursorList } from "@/lib/hooks/useQuery";
import { useOnInvalidate } from "@/lib/invalidate";
import { useRealtimeStatus } from "@/lib/realtime";
import { formatMoney } from "@/lib/format";
import { useDebouncedCallback, useLiveMap, useOpsSnapshot, useRideStateFeed } from "@/lib/rides/useLiveMap";
import {
  LIVE_RIDE_STATUSES,
  LIVE_STATUS_TABS,
  applyRideState,
  statusLabel,
  statusVariant,
  toRide,
  type ApiRideListItem,
  type RideView,
} from "@/lib/adapters/rides";

interface LiveOpsViewProps {
  selectedCityId: string | null;
  onSelectRide: (rideId: string) => void;
  onOpenSOSModal: (incidentId?: string) => void;
}

export const LiveOpsView: React.FC<LiveOpsViewProps> = ({ selectedCityId, onSelectRide, onOpenSOSModal }) => {
  const { cityName, selectedCity } = useCities();
  const rtStatus = useRealtimeStatus();
  const socketLive = rtStatus === "connected";
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // map + counters (REST + socket, polling fallback when the socket is down)
  const map = useLiveMap(selectedCityId);
  const snapshot = useOpsSnapshot(selectedCityId);

  // active trips stream
  const tab = LIVE_STATUS_TABS.find((t) => t.id === statusFilter) ?? LIVE_STATUS_TABS[0];
  const list = useCursorList<ApiRideListItem>(
    "/admin/rides",
    { cityId: selectedCityId, statuses: LIVE_RIDE_STATUSES.join(",") },
    { limit: 100, pollMs: socketLive ? 30_000 : 8_000 },
  );
  useOnInvalidate("rides", list.refetch);
  const refetchSoon = useDebouncedCallback(list.refetch, 800);
  const overrides = useRideStateFeed(refetchSoon);

  const rides: RideView[] = useMemo(() => {
    const base = list.items.map((r) => toRide(r, cityName));
    return base
      .map((r) => {
        const ov = overrides[r.id];
        return ov ? applyRideState(r, ov) : r;
      })
      .filter((r) => LIVE_RIDE_STATUSES.includes(r.rawStatus));
  }, [list.items, overrides, cityName]);

  const filteredRides = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return rides.filter((r) => {
      if (!tab.statuses.includes(r.rawStatus)) return false;
      if (!q) return true;
      return (
        r.bookingCode.toLowerCase().includes(q) ||
        r.rider.name.toLowerCase().includes(q) ||
        (r.captain?.name.toLowerCase().includes(q) ?? false) ||
        (r.captain?.vehiclePlate.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rides, tab, searchTerm]);

  const rideLabels = useMemo(() => {
    const out: Record<string, LiveMapRideLabel> = {};
    for (const r of rides) out[r.id] = { rider: r.rider.name, captain: r.captain?.name ?? null };
    return out;
  }, [rides]);

  const sosRides = rides.filter((r) => r.hasSOSAlert).length || (map.data?.rides.filter((r) => r.sos).length ?? 0);
  const snapshotTotal = snapshot ? Object.values(snapshot.rides).reduce((a, b) => a + b, 0) : null;
  const cityLabel = selectedCity?.name ?? "All Cities";

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header with Title and Live Counts */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-black text-slate-900 dark:text-white sm:text-xl">Live Fleet & Dispatch Radar</h1>
            {socketLive ? (
              <Badge variant="teal" size="sm" dot pulse>
                SOCKET LIVE
              </Badge>
            ) : (
              <Badge variant="warning" size="sm" dot>
                {rtStatus === "idle" || rtStatus === "connecting" ? "CONNECTING (polling 5s)" : "SOCKET DOWN (polling 5s)"}
              </Badge>
            )}
            {snapshot && (
              <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                {snapshot.onlineCaptains} online captains • {snapshotTotal} live rides
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">Real-time telemetry and active ride interventions in {cityLabel}</p>
        </div>

        {sosRides > 0 && (
          <button
            onClick={() => onOpenSOSModal()}
            className="animate-sos flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#D93320] px-4 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-[#B02414] sm:w-auto"
          >
            <Siren className="h-4 w-4 shrink-0 motion-safe:animate-bounce" aria-hidden="true" />
            <span className="min-w-0 text-left">Emergency In Progress ({sosRides} ride{sosRides === 1 ? "" : "s"} with SOS)</span>
          </button>
        )}
      </div>

      {map.error && <ErrorBanner error={map.error} title="Could not load the live map" onRetry={map.refetch} />}

      {/* Main Grid: Left Map (70%) + Right Active Rides Stream (30%) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        {/* Map Column */}
        <div className="flex min-w-0 flex-col lg:col-span-8">
          <LiveMap
            cityLabel={cityLabel}
            center={selectedCity ? [selectedCity.centerLat, selectedCity.centerLng] : null}
            rides={map.data?.rides ?? []}
            clusters={map.data?.clusters ?? []}
            onlineTotal={map.data?.onlineTotal ?? snapshot?.onlineCaptains ?? 0}
            rideLabels={rideLabels}
            loading={map.initialLoading}
            socketLive={socketLive}
            onSelectRide={onSelectRide}
          />
        </div>

        {/* Active Rides Stream Column */}
        <div className="flex h-[min(80dvh,560px)] min-h-[420px] min-w-0 flex-col rounded-2xl border border-[#F0E3ED] bg-white p-4 shadow-xs dark:border-[#331A3B] dark:bg-[#180D1C] lg:col-span-4 lg:h-[min(70dvh,540px)]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#331A3B]">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-[#7A2B66] dark:text-[#DB99CC]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Active Trips ({filteredRides.length})</h3>
            </div>
            <span className="min-w-0 truncate text-[10px] font-mono text-slate-500 dark:text-slate-400">City: {cityLabel}</span>
          </div>

          {/* Search & Filter */}
          <div className="py-2.5 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search ride #, rider, captain, plate..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search live rides"
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-500 dark:border-[#331A3B] dark:bg-[#211226] dark:text-white pointer-fine:min-h-10"
              />
            </div>

            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 text-[11px]" role="group" aria-label="Filter by status">
              {LIVE_STATUS_TABS.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id)}
                  aria-pressed={statusFilter === st.id}
                  className={`min-h-10 shrink-0 whitespace-nowrap rounded-lg px-3 font-semibold transition-colors pointer-fine:min-h-8 ${
                    statusFilter === st.id
                      ? "bg-[#3A102F] text-white"
                      : "bg-slate-100 text-slate-700 hover:text-black dark:bg-[#211226] dark:text-slate-300 dark:hover:text-white"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {list.error && <ErrorBanner error={list.error} title="Could not load active trips" onRetry={list.refetch} className="mb-2" />}

          {/* List of Active Rides */}
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain pr-1">
            {list.initialLoading ? (
              <div className="space-y-2.5">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : filteredRides.length === 0 ? (
              <EmptyState title="No active rides" description="No live rides match this filter." className="h-full" />
            ) : (
              filteredRides.map((ride) => (
                <div
                  key={ride.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectRide(ride.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectRide(ride.id);
                    }
                  }}
                  className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                    ride.hasSOSAlert
                      ? "border-rose-400 bg-rose-50/50 dark:bg-rose-950/20"
                      : "border-slate-200 dark:border-[#331A3B] hover:border-[#7A2B66] bg-slate-50/50 dark:bg-[#211226]/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate font-bold text-slate-900 dark:text-white">{ride.bookingCode}</span>
                    <Badge variant={statusVariant(ride.rawStatus)} size="sm">
                      {statusLabel(ride.rawStatus)}
                    </Badge>
                  </div>

                  <div className="mt-2 text-xs space-y-1">
                    <div className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
                      <span className="shrink-0">Rider:</span>
                      <span className="min-w-0 truncate font-semibold">{ride.rider.name}</span>
                    </div>
                    <div className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
                      <span className="shrink-0">Captain:</span>
                      <span className="min-w-0 truncate font-semibold">{ride.captain ? ride.captain.name : "Matching..."}</span>
                    </div>
                    <div className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
                      <span className="shrink-0">Fare:</span>
                      <span className="font-mono font-bold text-[#7A2B66] dark:text-[#DB99CC]">
                        {formatMoney(ride.finalFareMinor ?? ride.estimatedFareMinor, ride.currency)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {ride.pickupAddress.split(",")[0]} → {ride.dropoffAddress.split(",")[0]}
                    </span>
                    <span className="shrink-0 font-bold text-[#7A2B66] dark:text-[#DB99CC]">Inspect →</span>
                  </div>
                </div>
              ))
            )}
            <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
          </div>
        </div>
      </div>
    </div>
  );
};
