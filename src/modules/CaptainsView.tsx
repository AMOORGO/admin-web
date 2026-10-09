"use client";

import React, { useMemo, useState } from "react";
import { Car, Heart, Eye, ShieldCheck, Users, Hourglass, UserRoundX } from "lucide-react";
import { ChipTabs, PageHeader, SearchInput, Toolbar } from "@/components/ui/Page";
import { Badge } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState, LoadMore } from "@/components/ui/EmptyState";
import { CardsSkeleton } from "@/components/ui/Skeleton";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { useListCount } from "@/lib/hooks/useListCount";
import { useOpsSnapshot } from "@/lib/rides/useLiveMap";
import { formatNumber } from "@/lib/format";
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
  onOpenCaptain: (captainId: string) => void;
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

export const CaptainsView: React.FC<CaptainsViewProps> = ({ selectedCityId, onOpenCaptain, onNavigateToSecondChance }) => {
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

  // Fleet headcounts (summary cards)
  const base = useMemo<QueryParams>(() => ({ cityId: selectedCityId ?? undefined }), [selectedCityId]);
  const approvedCount = useListCount("/admin/captains", { ...base, status: "APPROVED" }, "captains");
  const submittedCount = useListCount("/admin/captains", { ...base, status: "SUBMITTED" }, "captains");
  const reviewCount = useListCount("/admin/captains", { ...base, status: "UNDER_REVIEW" }, "captains");
  const suspendedCount = useListCount("/admin/captains", { ...base, status: "SUSPENDED" }, "captains");
  const canOps = can("dashboard.view") || can("rides.view");
  const snapshot = useOpsSnapshot(selectedCityId, canOps);
  const pending = submittedCount.count === null || reviewCount.count === null ? null : submittedCount.count + reviewCount.count;

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
      <PageHeader
        title="Captain Fleet Operations"
        description="Monitor driver availability, vehicle compliance, ratings, and Second Chance status"
        actions={
          <Can permission="second_chance.manage">
            <button
              type="button"
              onClick={onNavigateToSecondChance}
              className="flex min-h-10 items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-bold text-[#B02414] shadow-xs transition-colors hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-[#FF7361]"
            >
              <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
              Second Chance Program{enrolled !== undefined ? ` (${enrolled})` : ""}
            </button>
          </Can>
        }
      />

      <StatGrid cols={4}>
        <StatCard label="Online now" icon={Users} tone="good" loading={!snapshot && canOps} value={snapshot ? formatNumber(snapshot.onlineCaptains) : "—"} hint="Available or on a trip" />
        <StatCard label="Approved captains" icon={ShieldCheck} tone="brand" loading={approvedCount.loading} value={approvedCount.count === null ? "—" : `${approvedCount.count}${approvedCount.more ? "+" : ""}`} hint="Cleared to drive" />
        <StatCard label="Pending review" icon={Hourglass} tone={pending ? "warn" : "neutral"} loading={submittedCount.loading || reviewCount.loading} value={pending === null ? "—" : String(pending)} hint="Submitted or under review" />
        <StatCard label="Suspended" icon={UserRoundX} tone={suspendedCount.count ? "bad" : "neutral"} loading={suspendedCount.loading} value={suspendedCount.count === null ? "—" : String(suspendedCount.count)} hint="Blocked from dispatch" />
      </StatGrid>

      {/* Filter and Search Bar */}
      <Toolbar className="lg:flex lg:items-center lg:justify-between lg:space-y-0">
        <ChipTabs label="Captain status" items={FILTERS.map((f) => ({ id: f.key, label: f.label }))} value={filterKey} onChange={setFilterKey} />
        <SearchInput value={searchTerm} onValueChange={setSearchTerm} placeholder="Search captain, phone, email, plate..." maxLength={100} className="lg:w-72" />
      </Toolbar>

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
                className="flex min-w-0 flex-col justify-between space-y-4 rounded-2xl border border-[#F0E3ED] bg-white p-4 shadow-xs transition-shadow hover:shadow-md dark:border-[#331A3B] dark:bg-[#180D1C] sm:p-5"
              >
                {/* Top Details */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cap.avatar} alt="" className="h-12 w-12 shrink-0 rounded-full border-2 border-[#7A2B66] object-cover" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="truncate text-base font-bold text-slate-900 dark:text-white" title={cap.name}>{cap.name}</h3>
                          {cap.isSecondChance && (
                            <span title="Second Chance driver">
                              <Heart className="h-3.5 w-3.5 text-[#D93320] dark:text-[#FF7361] fill-current" />
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                          {cap.phone} • {cityLabel(cap.cityId, cap.cityText, cities)}
                        </p>
                        <span className="text-xs text-amber-700 dark:text-amber-400 font-bold">
                          ★ {cap.ratingCount > 0 ? cap.rating.toFixed(2) : "New"} ({cap.totalTrips} trips)
                        </span>
                      </div>
                    </div>

                    <StatusPill variant={captainStatusVariant(cap.status)}>{captainStatusLabel(cap.status)}</StatusPill>
                  </div>

                  {/* Vehicle Pill */}
                  <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-2.5 text-xs flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <Car className="h-4 w-4 shrink-0 text-[#7A2B66] dark:text-[#DB99CC]" />
                      {cap.vehicle ? (
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800 dark:text-white">
                            {cap.vehicle.make} {cap.vehicle.model}
                          </p>
                          <p className="truncate font-mono text-xs text-slate-600 dark:text-slate-300">
                            {cap.vehicle.plateNumber} • {cap.vehicle.color}
                          </p>
                        </div>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400">No vehicle registered</p>
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
                      <span className="text-xs text-slate-500 dark:text-slate-400">Acceptance</span>
                      <p className="font-mono font-bold text-[#7A2B66] dark:text-[#DB99CC]">{cap.acceptanceRate}%</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[#FAF0F7]/50 dark:bg-[#331A3B]/30">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Cancellation</span>
                      <p className="font-mono font-bold text-slate-700 dark:text-slate-300">{cap.cancellationRate}%</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[#FAF0F7]/50 dark:bg-[#331A3B]/30">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Trips</span>
                      <p className="font-mono font-bold text-[#14755F] dark:text-[#4FD2B2]">{cap.totalTrips}</p>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-[#331A3B]">
                  <button
                    onClick={() => onOpenCaptain(cap.id)}
                    className="flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#331A3B] dark:text-slate-200 dark:hover:bg-[#28162E]"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Profile &amp; Documents
                  </button>

                  {(canSuspend || isSuspended) && (
                    <Can permission="captains.suspend">
                      <button
                        onClick={() => setTarget({ captain: cap, mode: isSuspended ? "reactivate" : "suspend" })}
                        className={`min-h-10 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                          isSuspended
                            ? "bg-[#EFFCF9] text-[#14755F] dark:text-[#4FD2B2] hover:bg-[#B4F2E1]"
                            : "bg-[#FFF3F1] text-[#B02414] hover:bg-[#D93320] hover:text-white dark:bg-[#38110D] dark:text-[#FF7361]"
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
              <p className="text-xs text-slate-500 dark:text-slate-400">Leave empty for an open-ended suspension.</p>
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
};
