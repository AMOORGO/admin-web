"use client";

import React, { useMemo, useState } from "react";
import { Lock, Route } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadMore } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Money } from "@/components/ui/Money";
import { ChipTabs } from "@/components/ui/Page";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { type ApiRideListItem, statusLabel, statusVariant } from "@/lib/adapters/rides";
import { useAuth } from "@/lib/auth/AuthProvider";
import { humanize } from "@/lib/format";
import { useCursorList } from "@/lib/hooks/useQuery";
import { useOnInvalidate } from "@/lib/invalidate";

const FILTERS = [
  { id: "ALL", label: "All trips", statuses: undefined },
  { id: "COMPLETED", label: "Completed", statuses: "COMPLETED,PAYMENT_PENDING,PAYMENT_COMPLETED,PAYMENT_FAILED,RATED,CLOSED" },
  { id: "LIVE", label: "In progress", statuses: "DRIVER_ASSIGNED,DRIVER_EN_ROUTE,DRIVER_ARRIVED,RIDE_STARTED,IN_PROGRESS" },
  { id: "CANCELLED", label: "Cancelled", statuses: "CANCELLED,NO_DRIVER_AVAILABLE" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

/** The captain's rides from the rides list endpoint (captainId filter). */
export const TripsTab: React.FC<{ captainId: string; onOpenRide: (rideId: string) => void }> = ({ captainId, onOpenRide }) => {
  const { can } = useAuth();
  const allowed = can("rides.view");
  const [filter, setFilter] = useState<FilterId>("ALL");
  const statuses = FILTERS.find((f) => f.id === filter)?.statuses;
  const query = useMemo(() => ({ captainId, statuses }), [captainId, statuses]);
  const list = useCursorList<ApiRideListItem>(allowed ? "/admin/rides" : null, query, { limit: 20 });
  useOnInvalidate("rides", list.refetch);

  if (!allowed) {
    return (
      <Card>
        <EmptyState icon={Lock} title="Trips are not available for your role" description="Viewing rides requires the rides.view permission." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <ChipTabs label="Trip status" items={FILTERS.map((f) => ({ id: f.id, label: f.label }))} value={filter} onChange={setFilter} />
      {list.error && <ErrorBanner error={list.error} title="Could not load trips" onRetry={list.refetch} />}
      <Card>
        {list.initialLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : list.items.length === 0 && !list.error ? (
          <EmptyState icon={Route} title="No trips found" description="No trips match this filter for the captain." />
        ) : (
          <>
            <div className="data-table-container sticky-first">
              <table className="w-full min-w-[56rem] border-collapse text-left">
                <thead>
                  <tr>
                    <th className="px-5 py-3">Booking</th>
                    <th className="px-3 py-3">Requested</th>
                    <th className="px-3 py-3">Route</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Payment</th>
                    <th className="num px-5 py-3">Fare</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E3ED] dark:divide-[#331A3B]">
                  {list.items.map((r) => (
                    <tr key={r.id} onClick={() => onOpenRide(r.id)} className="cursor-pointer">
                      <td className="px-5 py-3">
                        <button type="button" onClick={(e) => { e.stopPropagation(); onOpenRide(r.id); }} className="font-mono text-sm font-bold text-slate-900 hover:underline dark:text-white">
                          {r.bookingRef}
                        </button>
                        <span className="block text-xs text-slate-600 dark:text-slate-300">{r.serviceType.name}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-800 dark:text-slate-100">
                        <RelativeTime iso={r.requestedAt} />
                      </td>
                      <td className="wrap max-w-[22rem] px-3 py-3">
                        <span className="block truncate text-slate-900 dark:text-white" title={r.pickupAddress ?? undefined}>
                          {r.pickupAddress ?? "—"}
                        </span>
                        <span className="block truncate text-[13px] text-slate-600 dark:text-slate-300" title={r.dropAddress ?? undefined}>
                          → {r.dropAddress ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill variant={statusVariant(r.status)}>{statusLabel(r.status)}</StatusPill>
                      </td>
                      <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{humanize(r.paymentMethod)}</td>
                      <td className="num px-5 py-3 font-bold text-slate-900 dark:text-white">
                        <Money minor={r.finalFareMinor ?? r.estimatedFareMinor} currency={r.currency} />
                        {r.finalFareMinor === null && <span className="block text-xs font-normal text-slate-600 dark:text-slate-300">estimate</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
          </>
        )}
      </Card>
    </div>
  );
};
