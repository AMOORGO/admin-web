"use client";

import React, { useMemo, useState } from "react";
import { Search, Car, Heart, Eye } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState, LoadMore } from "@/components/ui/EmptyState";
import { CardsSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import {
  ApiCaptainListItem,
  CaptainRow,
  captainStatusLabel,
  captainStatusVariant,
  cityLabel,
  toCaptainRow,
} from "@/lib/adapters/captains";
import type { ApiScStats } from "@/lib/adapters/secondChance";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCities } from "@/lib/cities/CityProvider";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useCursorList, useQuery } from "@/lib/hooks/useQuery";
import { invalidate, useOnInvalidate } from "@/lib/invalidate";
import type { QueryParams } from "@/lib/api";

interface CaptainsViewProps {
  selectedCityId: string | null;
  onOpenKYCViewer: (captainId: string) => void;
  onNavigateToSecondChance: () => void;
}

/** Filter chips -> server-side query (status / availability are separate backend filters). */
const FILTERS: { key: string; label: string; query: QueryParams }[] = [
  { key: "ALL", label: "All", query: {} },
  { key: "ACTIVE", label: "Online", query: { status: "APPROVED", availability: "ONLINE" } },
  { key: "ON_TRIP", label: "On trip", query: { status: "APPROVED", availability: "ON_RIDE" } },
  { key: "OFFLINE", label: "Offline", query: { status: "APPROVED", availability: "OFFLINE" } },
  { key: "SUBMITTED", label: "Submitted", query: { status: "SUBMITTED" } },
  { key: "UNDER_REVIEW", label: "Under review", query: { status: "UNDER_REVIEW" } },
  { key: "SUSPENDED", label: "Suspended", query: { status: "SUSPENDED" } },
  { key: "REJECTED", label: "Rejected", query: { status: "REJECTED" } },
];

interface SuspendTarget {
  captain: CaptainRow;
  mode: "suspend" | "reactivate";
}

export const CaptainsView: React.FC<CaptainsViewProps> = ({ selectedCityId, onOpenKYCViewer, onNavigateToSecondChance }) => {
  const toast = useToast();
  const { can } = useAuth();
  const { cities } = useCities();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterKey, setFilterKey] = useState("ALL");
  const [target, setTarget] = useState<SuspendTarget | null>(null);
  const [until, setUntil] = useState("");

  const q = useDebouncedValue(searchTerm.trim(), 350);
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const query = useMemo<QueryParams>(
    () => ({ ...filter.query, cityId: selectedCityId ?? undefined, q: q || undefined }),
    [filter, selectedCityId, q],
  );

  const list = useCursorList<ApiCaptainListItem>("/admin/captains", query, { limit: 24 });
  useOnInvalidate(["captains", "kyc"], list.refetch);
  const captains = useMemo(() => list.items.map(toCaptainRow), [list.items]);

  // Second Chance headline count: only when the staff member may read the programme (lazy, tiny request).
  const canSc = can("second_chance.manage");
  const sc = useQuery<ApiScStats>(canSc ? "captains-sc-stats" : null, (signal) => api.get<ApiScStats>("/admin/second-chance/stats", { signal }));
  useOnInvalidate("second-chance", sc.refetch);
  const enrolled = sc.data?.byStatus.APPROVED;

  const closeDialog = () => {
    setTarget(null);
    setUntil("");
  };

  const submitSuspension = async (reason: string): Promise<boolean> => {
    if (!target) return false;
    const { captain, mode } = target;
    if (mode === "suspend") {
      const untilIso = until ? new Date(until).toISOString() : undefined;
      if (untilIso && new Date(untilIso).getTime() <= Date.now()) throw new Error("The suspension end must be in the future");
      await api.post(`/admin/captains/${captain.id}/suspend`, { reason, ...(untilIso ? { until: untilIso } : {}) });
      toast.success(`${captain.name} suspended`);
    } else {
      await api.post(`/admin/captains/${captain.id}/reactivate`, { reason });
      toast.success(`${captain.name} reactivated`);
    }
    invalidate("captains", "kyc");
    closeDialog();
    return true;
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Captain Fleet Operations</h1>
          <p className="text-xs text-slate-500">Monitor driver availability, vehicle compliance, ratings, and Second Chance status</p>
        </div>

        <Can permission="second_chance.manage">
          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToSecondChance}
              className="flex items-center gap-1.5 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2 text-xs font-bold text-[#F94B35] hover:bg-rose-100 transition-colors shadow-xs"
            >
              <Heart className="h-4 w-4 fill-current" />
              Second Chance Program{enrolled !== undefined ? ` (${enrolled})` : ""}
            </button>
          </div>
        </Can>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 shadow-xs">
        <div className="flex gap-1 overflow-x-auto text-xs pb-1 sm:pb-0">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterKey(f.key)}
              className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap ${
                filterKey === f.key
                  ? "bg-[#3A102F] text-white dark:bg-[#7A2B66]"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#28162E]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search captain, phone, email, plate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            maxLength={100}
            className="w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {list.error && <ErrorBanner error={list.error} title="Could not load captains" onRetry={list.refetch} />}

      {list.initialLoading ? (
        <CardsSkeleton count={6} />
      ) : captains.length === 0 && !list.error ? (
        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C]">
          <EmptyState title="No captains match" description="Try a different status, city or search term." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {captains.map((cap) => {
            const isSuspended = cap.rawStatus === "SUSPENDED";
            const canSuspend = cap.rawStatus === "APPROVED";
            return (
              <div
                key={cap.id}
                className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-5 shadow-xs space-y-4 hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* Top Details */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cap.avatar} alt={cap.name} className="h-12 w-12 rounded-full object-cover border-2 border-[#7A2B66]" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{cap.name}</h3>
                          {cap.isSecondChance && (
                            <span title="Second Chance driver">
                              <Heart className="h-3.5 w-3.5 text-[#F94B35] fill-current" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {cap.phone} • {cityLabel(cap.cityId, cap.cityText, cities)}
                        </p>
                        <span className="text-[11px] text-amber-500 font-bold">
                          ★ {cap.ratingCount > 0 ? cap.rating.toFixed(2) : "New"} ({cap.totalTrips} trips)
                        </span>
                      </div>
                    </div>

                    <Badge variant={captainStatusVariant(cap.status)} size="sm" dot>
                      {captainStatusLabel(cap.status)}
                    </Badge>
                  </div>

                  {/* Vehicle Pill */}
                  <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-2.5 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-[#7A2B66] dark:text-[#DB99CC]" />
                      {cap.vehicle ? (
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-white">
                            {cap.vehicle.make} {cap.vehicle.model}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {cap.vehicle.plateNumber} • {cap.vehicle.color}
                          </p>
                        </div>
                      ) : (
                        <p className="text-slate-400">No vehicle registered</p>
                      )}
                    </div>
                    {cap.vehicle?.isElectric && (
                      <Badge variant="teal" size="sm">
                        ⚡ EV
                      </Badge>
                    )}
                  </div>

                  {/* Metric Strip */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-[#FAF0F7]/50 dark:bg-[#331A3B]/30">
                      <span className="text-[10px] text-slate-400">Acceptance</span>
                      <p className="font-mono font-bold text-[#7A2B66] dark:text-[#DB99CC]">{cap.acceptanceRate}%</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[#FAF0F7]/50 dark:bg-[#331A3B]/30">
                      <span className="text-[10px] text-slate-400">Cancellation</span>
                      <p className="font-mono font-bold text-slate-700 dark:text-slate-300">{cap.cancellationRate}%</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[#FAF0F7]/50 dark:bg-[#331A3B]/30">
                      <span className="text-[10px] text-slate-400">Trips</span>
                      <p className="font-mono font-bold text-[#189578]">{cap.totalTrips}</p>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-[#331A3B] flex items-center justify-between gap-2">
                  <button
                    onClick={() => onOpenKYCViewer(cap.id)}
                    className="rounded-xl border border-slate-200 dark:border-[#331A3B] px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#28162E] transition-colors flex items-center gap-1.5"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Profile &amp; Documents
                  </button>

                  {(canSuspend || isSuspended) && (
                    <Can permission="captains.suspend">
                      <button
                        onClick={() => setTarget({ captain: cap, mode: isSuspended ? "reactivate" : "suspend" })}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                          isSuspended
                            ? "bg-[#EFFCF9] text-[#189578] hover:bg-[#B4F2E1]"
                            : "bg-[#FFF3F1] text-[#F94B35] hover:bg-[#F94B35] hover:text-white"
                        }`}
                      >
                        {isSuspended ? "Reactivate" : "Suspend Driver"}
                      </button>
                    </Can>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!list.initialLoading && (
        <div>
          <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
        </div>
      )}

      {/* Suspend / reactivate with mandatory reason (backend: 3..1000 chars) */}
      {target && (
        <ConfirmDialog
          isOpen
          title={target.mode === "reactivate" ? "Reactivate Captain Account" : "Suspend Captain Credentials"}
          description={
            target.mode === "reactivate"
              ? `Reactivating ${target.captain.name} will restore dispatch availability.`
              : `Suspending ${target.captain.name} takes them offline immediately and blocks new dispatch. A ride already in progress is not interrupted.`
          }
          targetEntityLabel={target.captain.name}
          confirmText={target.mode === "reactivate" ? "Confirm Reactivation" : "Confirm Suspension"}
          isDestructive={target.mode === "suspend"}
          requireReason
          minReasonLength={3}
          reasonPlaceholder="Specify reason (e.g. Speed telemetry violation, customer complaint investigation, document lapse)..."
          onConfirm={submitSuspension}
          onCancel={closeDialog}
        >
          {target.mode === "suspend" && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Automatic reactivation (optional)
              </label>
              <input
                type="datetime-local"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-2 text-sm text-slate-900 dark:text-white"
              />
              <p className="text-[11px] text-slate-400">Leave empty for an open-ended suspension.</p>
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
};
