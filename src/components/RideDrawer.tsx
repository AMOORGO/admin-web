"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, User, Car, RotateCcw, Ban, Sliders, KeyRound, Shuffle, CheckCircle2, Search, Copy } from "lucide-react";
import { Badge } from "./Badge";
import { Can } from "./Can";
import { ConfirmDialog } from "./ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCities } from "@/lib/cities/CityProvider";
import { useQuery } from "@/lib/hooks/useQuery";
import { invalidate, useOnInvalidate } from "@/lib/invalidate";
import { useRideRoom, useSocketEvent } from "@/lib/realtime";
import { formatDateTime, formatMoney, humanize, majorToMinor } from "@/lib/format";
import {
  ADMIN_CANCEL_REASON_CODES,
  allowedStatusTargets,
  canAdjustFare,
  canCancelRide,
  canReassignRide,
  isAssignedStatus,
  statusLabel,
  statusVariant,
  toRideDetail,
  toTimeline,
  type AdminCancelReasonCode,
  type ApiCaptainListItem,
  type ApiRideDetail,
  type ApiRideStatus,
  type ApiTimelineStep,
  type RideDetailView,
  type RideStateEvent,
} from "@/lib/adapters/rides";

interface RideDrawerProps {
  rideId: string | null;
  onClose: () => void;
}

type DialogKind = "cancel" | "reassign" | "adjust" | "status" | "pin" | "approve" | null;

interface PendingApproval {
  rideId: string;
  approvalId: string;
  message: string;
  amountMinor: number;
}

interface PickedCaptain {
  id: string;
  label: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fieldCls =
  "w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#7A2B66] focus:outline-none focus:ring-1 focus:ring-[#7A2B66]";
const labelCls = "block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1";

/** Searchable captain list (GET /admin/captains?q=...) plus a paste-an-ID fallback. */
const CaptainPicker: React.FC<{ cityId: string; value: PickedCaptain | null; onChange: (c: PickedCaptain | null) => void }> = ({ cityId, value, onChange }) => {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(true);
  const [manualId, setManualId] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const captains = useQuery<ApiCaptainListItem[]>(`ride-captain-picker:${cityId}:${term}:${onlineOnly}`, async (signal) => {
    const page = await api.getPage<ApiCaptainListItem>("/admin/captains", {
      query: { status: "APPROVED", availability: onlineOnly ? "ONLINE" : undefined, cityId, q: term || undefined, limit: 8 },
      signal,
    });
    return page.items;
  });

  return (
    <div className="space-y-2">
      <label className={labelCls}>Assign to captain (optional)</label>
      {value ? (
        <div className="flex items-center justify-between rounded-xl border border-[#7A2B66] bg-[#FAF0F7] dark:bg-[#331A3B] px-3 py-2 text-xs">
          <span className="font-bold text-[#3A102F] dark:text-[#E9BFDF]">{value.label}</span>
          <button type="button" onClick={() => onChange(null)} className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white">
            Clear
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (timer.current) clearTimeout(timer.current);
                const v = e.target.value.trim();
                timer.current = setTimeout(() => setTerm(v), 300);
              }}
              placeholder="Search captain name, phone or plate..."
              className={`${fieldCls} pl-9`}
            />
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer">
            <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} className="accent-[#7A2B66]" />
            Online captains only (the API rejects offline / busy captains)
          </label>
          <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-[#331A3B] divide-y divide-slate-100 dark:divide-[#331A3B]">
            {captains.error ? (
              <p className="p-3 text-xs text-[#F94B35]">{errorMessage(captains.error)}</p>
            ) : captains.initialLoading ? (
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (captains.data ?? []).length === 0 ? (
              <p className="p-3 text-xs text-slate-400 italic">No matching captains.</p>
            ) : (
              (captains.data ?? []).map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => onChange({ id: c.id, label: `${c.name}${c.vehicle ? ` (${c.vehicle.plateNumber})` : ""}` })}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-[#28162E]"
                >
                  <span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{c.name}</span>
                    <span className="block text-[10px] text-slate-400">
                      {c.vehicle ? `${c.vehicle.make} ${c.vehicle.model} • ${c.vehicle.plateNumber}` : "No vehicle"} • ★ {c.rating.toFixed(1)}
                    </span>
                  </span>
                  <Badge variant={c.availability === "ONLINE" ? "teal" : "neutral"} size="sm">
                    {humanize(c.availability)}
                  </Badge>
                </button>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input value={manualId} onChange={(e) => setManualId(e.target.value.trim())} placeholder="...or paste a captain ID (UUID)" className={`${fieldCls} font-mono text-xs`} />
            <button
              type="button"
              disabled={!UUID_RE.test(manualId)}
              onClick={() => onChange({ id: manualId, label: `Captain ${manualId.slice(0, 8)}` })}
              className="rounded-xl bg-[#3A102F] px-3 text-xs font-bold text-white disabled:opacity-40"
            >
              Use
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export const RideDrawer: React.FC<RideDrawerProps> = ({ rideId, onClose }) => {
  const toast = useToast();
  const { can } = useAuth();
  const { cityName } = useCities();

  const [activeTab, setActiveTab] = useState<"TIMELINE" | "FARE" | "DISPATCH">("TIMELINE");
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [cancelCode, setCancelCode] = useState<AdminCancelReasonCode>("OPERATIONAL");
  const [waiveFee, setWaiveFee] = useState(true);
  const [pickedCaptain, setPickedCaptain] = useState<PickedCaptain | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [statusTarget, setStatusTarget] = useState<ApiRideStatus | "">("");
  const [approvalId, setApprovalId] = useState("");
  const [pending, setPending] = useState<PendingApproval | null>(null);

  const detailQ = useQuery<ApiRideDetail>(rideId ? `ride-detail:${rideId}` : null, (signal) => api.get<ApiRideDetail>(`/admin/rides/${rideId}`, { signal }));
  const timelineQ = useQuery<ApiTimelineStep[]>(rideId ? `ride-timeline:${rideId}` : null, (signal) =>
    api.get<ApiTimelineStep[]>(`/admin/rides/${rideId}/timeline`, { signal }),
  );
  const { refetch: refetchDetail } = detailQ;
  const { refetch: refetchTimeline } = timelineQ;
  const refetchAll = useCallback(() => {
    refetchDetail();
    refetchTimeline();
  }, [refetchDetail, refetchTimeline]);

  // live updates for this ride: join its room, refetch when its state changes
  useRideRoom(rideId);
  useSocketEvent<RideStateEvent>("ride.state", (ev) => {
    if (rideId && ev?.rideId === rideId) refetchAll();
  });
  useOnInvalidate("rides", refetchAll);

  const ride: RideDetailView | null = useMemo(() => {
    const d = detailQ.data;
    if (!rideId || !d || d.ride.id !== rideId) return null;
    return toRideDetail(d, cityName);
  }, [detailQ.data, rideId, cityName]);
  const timeline = useMemo(() => {
    if (!rideId || !timelineQ.data) return [];
    return toTimeline(timelineQ.data);
  }, [timelineQ.data, rideId]);

  if (!rideId) return null;

  const status = ride?.rawStatus;
  const done = async (message: string) => {
    toast.success(message);
    invalidate("rides");
    refetchAll();
    setDialog(null);
  };

  const doCancel = async (reason: string) => {
    await api.post(`/admin/rides/${rideId}/cancel`, { reasonCode: cancelCode, reason, waiveFee });
    await done("Ride cancelled");
  };

  const doReassign = async (reason: string) => {
    if (!status) return false;
    const path = isAssignedStatus(status) ? "reassign" : "assign";
    await api.post(`/admin/rides/${rideId}/${path}`, { captainId: pickedCaptain?.id, reason });
    await done(pickedCaptain ? `Ride assigned to ${pickedCaptain.label}` : "Ride sent back to automatic dispatch");
  };

  const adjustMinor = (() => {
    const n = Number(adjustAmount);
    if (!adjustAmount.trim() || !Number.isFinite(n)) return null;
    return majorToMinor(n);
  })();
  const adjustValid = adjustMinor !== null && adjustMinor !== 0 && Math.abs(adjustMinor) <= 1_000_000;

  const doAdjust = async (reason: string) => {
    if (!adjustValid || adjustMinor === null) return false;
    const res = await api.post<{ status?: string; approvalId?: string; message?: string; finalFareMinor?: number | null }>(`/admin/rides/${rideId}/adjust-fare`, {
      amountMinor: adjustMinor,
      reason,
    });
    if (res.status === "PENDING_APPROVAL" && res.approvalId) {
      setPending({ rideId, approvalId: res.approvalId, message: res.message ?? "A second approver must approve this adjustment.", amountMinor: adjustMinor });
      toast.success("Adjustment submitted: waiting for a second approver");
      invalidate("rides");
      setDialog(null);
      return;
    }
    await done("Fare adjusted");
  };

  const doApprove = async () => {
    if (!UUID_RE.test(approvalId.trim())) throw new Error("Enter a valid approval ID (UUID)");
    await api.post(`/admin/rides/${rideId}/adjust-fare/${approvalId.trim()}/approve`, {});
    setPending((p) => (p && p.approvalId === approvalId.trim() ? null : p));
    await done("Fare adjustment approved and applied");
  };

  const doStatus = async (reason: string) => {
    if (!statusTarget) return false;
    await api.post(`/admin/rides/${rideId}/change-status`, { to: statusTarget, reason });
    await done(`Status changed to ${statusLabel(statusTarget)}`);
  };

  const doResetPin = async (reason: string) => {
    await api.post(`/admin/rides/${rideId}/reset-pin-attempts`, { reason });
    await done("Start-PIN attempts reset");
  };

  const targets = status ? allowedStatusTargets(status) : [];
  const showPending = pending && pending.rideId === rideId ? pending : null;
  const tabBtn = (id: typeof activeTab, label: string, mr = true) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`py-3 text-xs font-bold border-b-2 ${mr ? "mr-6" : ""} transition-all whitespace-nowrap ${
        activeTab === id
          ? "border-[#3A102F] text-[#3A102F] dark:border-[#A74490] dark:text-[#E9BFDF]"
          : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
  const cur = ride?.currency ?? "USD";
  const b = ride?.breakdown ?? null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
        <div
          className="relative w-full max-w-xl h-full bg-white dark:bg-[#180D1C] border-l border-[#F0E3ED] dark:border-[#331A3B] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
          role="dialog"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#F0E3ED] dark:border-[#331A3B] px-6 py-4 bg-[#FAF0F7]/40 dark:bg-[#211226]/50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                {ride ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{ride.bookingCode}</h3>
                      <Badge variant={statusVariant(ride.rawStatus)} size="sm" dot>
                        {statusLabel(ride.rawStatus)}
                      </Badge>
                      {ride.hasSOSAlert && (
                        <Badge variant="coral" size="sm" pulse>
                          SOS ACTIVE
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {ride.city} • {ride.serviceTypeName} • ID: <span className="font-mono">{ride.id}</span>
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Ride details</h3>
                    <p className="text-xs text-slate-500 font-mono truncate">{rideId}</p>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#28162E] dark:hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex border-b border-[#F0E3ED] dark:border-[#331A3B] px-6 bg-white dark:bg-[#180D1C] overflow-x-auto">
            {tabBtn("TIMELINE", "Ride State Timeline")}
            {tabBtn("FARE", ride ? `Fare & Payment (${formatMoney(ride.finalFareMinor ?? ride.estimatedFareMinor, cur)})` : "Fare & Payment")}
            {tabBtn("DISPATCH", `Dispatch Log (${ride ? ride.attempts.reduce((n, a) => n + a.offers.length, 0) : 0})`, false)}
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {detailQ.error && <ErrorBanner error={detailQ.error} title="Could not load this ride" onRetry={refetchAll} />}

            {!ride && !detailQ.error && (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
                <Skeleton className="h-40 w-full" />
              </div>
            )}

            {showPending && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-1">
                <p className="font-bold text-amber-800 dark:text-amber-300">
                  Fare adjustment of {formatMoney(showPending.amountMinor, cur)} is waiting for a second approver
                </p>
                <p className="text-amber-700 dark:text-amber-200">{showPending.message}</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all">Approval ID: {showPending.approvalId}</span>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(showPending.approvalId)}
                    className="rounded-md p-1 text-slate-500 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                    title="Copy approval ID"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {ride && (
              <>
                {/* Route Summary Card */}
                <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-slate-50/50 dark:bg-[#211226]/40 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center mt-1">
                      <div className="h-3 w-3 rounded-full bg-[#3A102F] dark:bg-[#A74490]" />
                      <div className="h-8 w-0.5 bg-slate-300 dark:bg-slate-700 my-0.5" />
                      <div className="h-3 w-3 rounded-full bg-[#189578]" />
                    </div>
                    <div className="flex-1 space-y-2 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">PICKUP</span>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{ride.pickupAddress}</p>
                        <p className="font-mono text-[10px] text-slate-400">
                          {ride.pickupCoords[0].toFixed(5)}, {ride.pickupCoords[1].toFixed(5)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">DROPOFF</span>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{ride.dropoffAddress}</p>
                        <p className="font-mono text-[10px] text-slate-400">
                          {ride.dropoffCoords[0].toFixed(5)}, {ride.dropoffCoords[1].toFixed(5)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-slate-400">PIN ATTEMPTS</span>
                      <p className="text-base font-mono font-black text-[#7A2B66] dark:text-[#DB99CC]">{ride.startPinAttempts}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-200/70 dark:border-[#331A3B] pt-2 text-[11px] text-slate-500">
                    <span>Requested {formatDateTime(ride.requestedAt)}</span>
                    {ride.scheduledFor && <span>Scheduled {formatDateTime(ride.scheduledFor)}</span>}
                    {ride.estimatedDistanceKm !== null && <span>Est. {ride.estimatedDistanceKm.toFixed(1)} km</span>}
                    {ride.actualDistanceKm !== null && <span>Actual {ride.actualDistanceKm.toFixed(1)} km</span>}
                    {ride.liveLocation && (
                      <span>
                        Captain last seen {formatDateTime(ride.liveLocation.ts)} ({ride.liveLocation.lat.toFixed(4)}, {ride.liveLocation.lng.toFixed(4)})
                      </span>
                    )}
                  </div>
                  {ride.cancelledBy && (
                    <p className="rounded-lg bg-[#FFF3F1] dark:bg-[#38110D] border border-[#FFC4BC] dark:border-[#61130A] px-3 py-2 text-[11px] text-[#B02414] dark:text-[#FFA093]">
                      Cancelled by {humanize(ride.cancelledBy)}
                      {ride.cancelReasonCode ? ` (${humanize(ride.cancelReasonCode)})` : ""}
                      {ride.cancelReason ? `: ${ride.cancelReason}` : ""}
                      {ride.cancellationFeeMinor > 0 ? ` • Fee ${formatMoney(ride.cancellationFeeMinor, cur)}` : ""}
                    </p>
                  )}
                </div>

                {/* Rider & Captain Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#F0E3ED] dark:border-[#331A3B] p-3.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-[#7A2B66] dark:text-[#DB99CC]" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">PASSENGER</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ride.rider.avatar} alt={ride.rider.name} className="h-10 w-10 rounded-full object-cover border border-slate-200" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{ride.rider.name}</p>
                        <p className="text-[11px] text-slate-500">{ride.rider.phone || "—"}</p>
                        {ride.riderEmail && <p className="text-[10px] text-slate-400 truncate">{ride.riderEmail}</p>}
                        <span className="text-[11px] font-bold text-amber-500">★ {ride.rider.rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#F0E3ED] dark:border-[#331A3B] p-3.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-[#189578]" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">CAPTAIN</span>
                    </div>
                    {ride.captain ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ride.captain.avatar} alt={ride.captain.name} className="h-10 w-10 rounded-full object-cover border border-slate-200" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{ride.captain.name}</p>
                          <p className="text-[11px] text-slate-500">{ride.captain.phone || "—"}</p>
                          <p className="text-[11px] font-mono text-[#7A2B66] dark:text-[#DB99CC] font-bold">
                            {ride.captain.vehiclePlate} • {ride.captain.vehicleModel}
                          </p>
                          <span className="text-[11px] font-bold text-amber-500">★ {ride.captain.rating.toFixed(1)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-xs text-slate-400 italic">No captain assigned yet</div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Tab 1: Finite State Machine Timeline */}
            {activeTab === "TIMELINE" && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Finite State Machine Progression</h4>
                {timelineQ.error ? (
                  <ErrorBanner error={timelineQ.error} title="Could not load the timeline" onRetry={timelineQ.refetch} />
                ) : timelineQ.initialLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : timeline.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No status history recorded.</p>
                ) : (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-[#331A3B]">
                    {timeline.map((step, index) => (
                      <div key={`${step.at}-${index}`} className="relative">
                        <div className="absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-[#180D1C] border-2 border-[#7A2B66]">
                          <div className="h-2 w-2 rounded-full bg-[#7A2B66]" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{step.title}</p>
                            <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">{step.timestamp}</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{step.description}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <span className="inline-block text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-[#211226] px-2 py-0.5 rounded">By {step.actorLabel}</span>
                            {step.latencySeconds && (
                              <span className="inline-block text-[10px] font-mono font-semibold text-[#189578] bg-[#EFFCF9] dark:bg-[#0D2620] px-2 py-0.5 rounded">
                                +{step.latencySeconds}s
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Fare Breakdown + payment */}
            {activeTab === "FARE" && ride && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#F0E3ED] dark:border-[#331A3B] overflow-hidden">
                  <div className="bg-[#FAF0F7]/50 dark:bg-[#211226]/50 px-4 py-3 border-b border-[#F0E3ED] dark:border-[#331A3B] flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Pricing Component</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Amount ({cur})</span>
                  </div>
                  {b ? (
                    <div className="divide-y divide-slate-100 dark:divide-[#331A3B] text-xs">
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-slate-600 dark:text-slate-400">Base Fare</span>
                        <span className="font-mono font-semibold">{formatMoney(b.baseFareMinor, cur)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-slate-600 dark:text-slate-400">
                          Distance ({b.distanceInUnit} {b.distanceUnit === "MILE" ? "mi" : "km"})
                        </span>
                        <span className="font-mono font-semibold">{formatMoney(b.distanceFareMinor, cur)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-slate-600 dark:text-slate-400">Duration ({Number(b.durationMinutes).toFixed(1)} mins)</span>
                        <span className="font-mono font-semibold">{formatMoney(b.timeFareMinor, cur)}</span>
                      </div>
                      {b.waitingFareMinor > 0 && (
                        <div className="flex justify-between px-4 py-2.5">
                          <span className="text-slate-600 dark:text-slate-400">Waiting time</span>
                          <span className="font-mono font-semibold">{formatMoney(b.waitingFareMinor, cur)}</span>
                        </div>
                      )}
                      {b.minimumFareApplied && (
                        <div className="flex justify-between px-4 py-2.5">
                          <span className="text-slate-600 dark:text-slate-400">Minimum fare applied</span>
                          <span className="font-mono font-semibold">{formatMoney(b.minimumFareMinor, cur)}</span>
                        </div>
                      )}
                      <div className="flex justify-between px-4 py-2.5 bg-amber-50/50 dark:bg-amber-950/20">
                        <span className="text-amber-800 dark:text-amber-300 font-semibold">Surge Multiplier ({(b.surgeMultiplierBps / 10000).toFixed(2)}x)</span>
                        <span className="font-mono font-bold text-amber-600">+{formatMoney(b.surgeMinor, cur)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-slate-600 dark:text-slate-400">Booking / service fee</span>
                        <span className="font-mono font-semibold">{formatMoney(b.bookingFeeMinor, cur)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-slate-600 dark:text-slate-400">Tolls</span>
                        <span className="font-mono font-semibold">{formatMoney(b.tollsMinor, cur)}</span>
                      </div>
                      {b.discountMinor > 0 && (
                        <div className="flex justify-between px-4 py-2.5 text-emerald-700 dark:text-emerald-300">
                          <span>Discount{b.couponCode ? ` (${b.couponCode})` : ""}</span>
                          <span className="font-mono font-semibold">-{formatMoney(b.discountMinor, cur)}</span>
                        </div>
                      )}
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-slate-600 dark:text-slate-400">Taxes ({(b.taxRateBps / 100).toFixed(2)}%)</span>
                        <span className="font-mono font-semibold">{formatMoney(b.taxMinor, cur)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-3 bg-[#FAF0F7] dark:bg-[#331A3B] font-bold">
                        <span className="text-[#3A102F] dark:text-[#E9BFDF]">Gross Rider Charge</span>
                        <span className="font-mono text-sm text-[#3A102F] dark:text-[#E9BFDF]">{formatMoney(ride.finalFareMinor ?? b.totalMinor, cur)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5 text-[#14755F] dark:text-[#82E5CB]">
                        <span>Platform Commission ({(b.commissionBps / 100).toFixed(2)}%)</span>
                        <span className="font-mono font-bold">-{formatMoney(b.platformCommissionMinor, cur)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-bold">
                        <span>Captain Earning (before tips / incentives)</span>
                        <span className="font-mono text-sm">{formatMoney(b.captainEarningMinor, cur)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 px-4 py-4 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Estimated fare (quoted)</span>
                        <span className="font-mono font-bold">{formatMoney(ride.estimatedFareMinor, cur)}</span>
                      </div>
                      <p className="text-slate-400 italic">No itemised fare breakdown is stored on this ride.</p>
                    </div>
                  )}
                  {ride.adminFareAdjustmentMinor !== 0 && (
                    <div className="flex justify-between border-t border-slate-100 dark:border-[#331A3B] px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                      <span>Staff fare adjustments (cumulative)</span>
                      <span className="font-mono font-semibold">
                        {ride.adminFareAdjustmentMinor > 0 ? "+" : ""}
                        {formatMoney(ride.adminFareAdjustmentMinor, cur)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-[#F0E3ED] dark:border-[#331A3B] p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Payment</span>
                    <Badge variant={ride.paymentStatus === "CAPTURED" ? "teal" : ride.paymentStatus === "FAILED" ? "coral" : "warning"} size="sm">
                      {humanize(ride.payment?.status ?? ride.paymentStatusRaw ?? "Not started")}
                    </Badge>
                  </div>
                  <p className="text-slate-500">
                    Method: {humanize(ride.paymentMethodRaw)}
                    {ride.payment ? ` via ${ride.payment.provider}` : ""}
                  </p>
                  {ride.payment ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600 dark:text-slate-300">
                      <span>Amount</span>
                      <span className="font-mono text-right">{formatMoney(ride.payment.amountMinor, ride.payment.currency)}</span>
                      <span>Captured</span>
                      <span className="font-mono text-right">{formatMoney(ride.payment.capturedMinor, ride.payment.currency)}</span>
                      {ride.payment.refundedMinor > 0 && (
                        <>
                          <span>Refunded</span>
                          <span className="font-mono text-right">{formatMoney(ride.payment.refundedMinor, ride.payment.currency)}</span>
                        </>
                      )}
                      {ride.payment.tipMinor > 0 && (
                        <>
                          <span>Tip</span>
                          <span className="font-mono text-right">{formatMoney(ride.payment.tipMinor, ride.payment.currency)}</span>
                        </>
                      )}
                      <span>Attempts</span>
                      <span className="font-mono text-right">{ride.payment.attemptCount}</span>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">No payment record yet.</p>
                  )}
                  {ride.payment?.failureMessage && <p className="text-[11px] text-[#F94B35]">Failure: {ride.payment.failureMessage}</p>}
                </div>
              </div>
            )}

            {/* Tab 3: Dispatch Candidate Log */}
            {activeTab === "DISPATCH" && ride && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Radar Dispatch Attempts</h4>
                {ride.attempts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No dispatch attempts recorded.</p>
                ) : (
                  ride.attempts.map((a) => (
                    <div key={a.attemptNo} className="rounded-xl border border-slate-200 dark:border-[#331A3B] overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-[#211226]/60 px-3 py-2 text-[11px]">
                        <span className="font-bold text-slate-800 dark:text-slate-100">Attempt #{a.attemptNo}</span>
                        <span className="text-slate-500">
                          {humanize(a.strategy)} • {a.radiusKm.toFixed(1)} km radius • {a.candidateCount} candidate{a.candidateCount === 1 ? "" : "s"}
                        </span>
                        <Badge variant={a.result === "ASSIGNED" ? "teal" : a.result === "OPEN" ? "warning" : "coral"} size="sm">
                          {humanize(a.result)}
                        </Badge>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-[#331A3B]">
                        {a.offers.length === 0 && <p className="px-3 py-2 text-xs text-slate-400 italic">No offers were sent in this attempt.</p>}
                        {a.offers.map((o) => (
                          <div key={o.id} className="px-3 py-2.5 text-xs flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 dark:text-slate-100">
                                #{o.rank} {o.captainName}
                                {o.rating !== null && <span className="ml-1.5 text-amber-500">★ {o.rating.toFixed(1)}</span>}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {o.distanceKm !== null ? `${o.distanceKm.toFixed(1)} km away` : "distance n/a"}
                                {o.etaSeconds !== null ? ` • ETA ${Math.round(o.etaSeconds / 60)} min` : ""} • score {o.score.toFixed(2)} • offered {formatDateTime(o.offeredAt)}
                              </p>
                              {o.reason && <p className="text-[10px] text-rose-500 font-medium mt-0.5">Reason: {o.reason}</p>}
                            </div>
                            <Badge variant={o.status === "ACCEPTED" ? "teal" : o.status === "EXPIRED" || o.status === "PENDING" ? "warning" : "coral"} size="sm">
                              {o.status === "EXPIRED" ? "TIMEOUT" : o.status}
                            </Badge>
                          </div>
                        ))}
                        {a.excluded.length > 0 && (
                          <details className="px-3 py-2 text-[11px] text-slate-500">
                            <summary className="cursor-pointer font-semibold">{a.excluded.length} excluded candidate{a.excluded.length === 1 ? "" : "s"}</summary>
                            <ul className="mt-1.5 space-y-1">
                              {a.excluded.map((c) => (
                                <li key={c.captainId}>
                                  <span className="font-mono">{c.captainId.slice(0, 8)}</span>: {c.reasons.length ? c.reasons.map(humanize).join(", ") : "excluded"}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Admin Intervention Controls Footer */}
          <div className="border-t border-[#F0E3ED] dark:border-[#331A3B] p-4 bg-[#FAF0F7]/40 dark:bg-[#211226]/50 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">OPERATIONAL INTERVENTIONS</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Can permission="rides.reassign">
                <button
                  onClick={() => {
                    setPickedCaptain(null);
                    setDialog("reassign");
                  }}
                  disabled={!status || !canReassignRide(status)}
                  title={status && !canReassignRide(status) ? "Only possible before the trip starts" : undefined}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#180D1C] p-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-[#7A2B66] hover:text-[#7A2B66] disabled:opacity-40 transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {status && !isAssignedStatus(status) ? "Assign" : "Reassign"}
                </button>
              </Can>

              <Can permission="rides.adjust_fare">
                <button
                  onClick={() => {
                    setAdjustAmount("");
                    setDialog("adjust");
                  }}
                  disabled={!status || !canAdjustFare(status)}
                  title={status && !canAdjustFare(status) ? "Settled rides need a refund instead" : undefined}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#180D1C] p-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-[#189578] hover:text-[#189578] disabled:opacity-40 transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  Adjust Fare
                </button>
              </Can>

              <Can permission="rides.change_status">
                <button
                  onClick={() => {
                    setStatusTarget(targets[0] ?? "");
                    setDialog("status");
                  }}
                  disabled={targets.length === 0}
                  title={targets.length === 0 ? "No forced transition is allowed from this status" : undefined}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#180D1C] p-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-[#7A2B66] hover:text-[#7A2B66] disabled:opacity-40 transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  Change Status
                </button>
              </Can>

              <Can permission="rides.change_status">
                <button
                  onClick={() => setDialog("pin")}
                  disabled={!ride}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#180D1C] p-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-[#7A2B66] hover:text-[#7A2B66] disabled:opacity-40 transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Reset PIN Tries
                </button>
              </Can>

              <Can permission="rides.cancel">
                <button
                  onClick={() => {
                    setCancelCode("OPERATIONAL");
                    setWaiveFee(true);
                    setDialog("cancel");
                  }}
                  disabled={!status || !canCancelRide(status)}
                  className="col-span-2 sm:col-span-1 rounded-xl bg-[#FFF3F1] dark:bg-[#38110D] border border-[#FFC4BC] dark:border-[#61130A] p-2 text-xs font-bold text-[#F94B35] hover:bg-[#F94B35] hover:text-white disabled:opacity-40 transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Cancel Ride
                </button>
              </Can>
            </div>
            {can("rides.adjust_fare") && can("finance.refund_approve") && (
              <button
                onClick={() => {
                  setApprovalId(showPending?.approvalId ?? "");
                  setDialog("approve");
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-[#7A2B66] dark:text-[#DB99CC] hover:underline"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve a colleague&apos;s pending fare adjustment
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cancel */}
      <ConfirmDialog
        isOpen={dialog === "cancel"}
        title="Emergency Cancellation of Ride"
        description="Cancelling this ride will immediately terminate the passenger booking and broadcast a state change to the captain and payment gateway."
        targetEntityLabel={ride?.bookingCode}
        confirmText="Confirm Cancellation"
        isDestructive
        minReasonLength={3}
        reasonPlaceholder="Specify reason (e.g. passenger safety concern, vehicle malfunction, operator override)..."
        onConfirm={doCancel}
        onCancel={() => setDialog(null)}
      >
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Reason code</label>
            <select value={cancelCode} onChange={(e) => setCancelCode(e.target.value as AdminCancelReasonCode)} className={fieldCls}>
              {ADMIN_CANCEL_REASON_CODES.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
            <input type="checkbox" checked={waiveFee} onChange={(e) => setWaiveFee(e.target.checked)} className="accent-[#7A2B66]" />
            Waive the rider cancellation fee
          </label>
        </div>
      </ConfirmDialog>

      {/* Reassign / assign */}
      <ConfirmDialog
        isOpen={dialog === "reassign"}
        title={status && !isAssignedStatus(status) ? "Manual Driver Assignment" : "Manual Driver Reassignment"}
        description={
          status && !isAssignedStatus(status)
            ? "Pick the captain who should take this ride. The API validates eligibility, availability and service-type match."
            : "The current captain is released from the ride. Pick a replacement, or leave empty to send the ride back to automatic dispatch."
        }
        targetEntityLabel={ride?.bookingCode}
        confirmText={pickedCaptain ? "Assign Captain" : "Re-dispatch Automatically"}
        isDestructive={false}
        minReasonLength={3}
        reasonPlaceholder="Reason for manual assignment..."
        confirmDisabled={!pickedCaptain && status === "SEARCHING"}
        onConfirm={doReassign}
        onCancel={() => setDialog(null)}
      >
        {ride && <CaptainPicker cityId={ride.cityId} value={pickedCaptain} onChange={setPickedCaptain} />}
        {status === "SEARCHING" && !pickedCaptain && <p className="text-[11px] text-slate-400">This ride is already in automatic dispatch: choose a captain to assign it manually.</p>}
      </ConfirmDialog>

      {/* Adjust fare */}
      <ConfirmDialog
        isOpen={dialog === "adjust"}
        title={`Adjust Ride Fare${ride ? ` (${ride.bookingCode})` : ""}`}
        description="Add a signed amount to the fare: negative for a discount or credit, positive for a surcharge. Large adjustments need a second approver before they apply."
        confirmText="Apply Fare Adjustment"
        isDestructive={false}
        minReasonLength={3}
        confirmDisabled={!adjustValid}
        reasonPlaceholder="Operational justification for the fare adjustment..."
        onConfirm={doAdjust}
        onCancel={() => setDialog(null)}
      >
        <div>
          <label className={labelCls}>Adjustment amount ({cur}) (negative for discount, positive for surcharge)</label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="-5.00"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            className={fieldCls}
          />
          {adjustAmount !== "" && !adjustValid && <p className="mt-1 text-[11px] text-[#F94B35]">Enter a non-zero amount between -10,000.00 and 10,000.00.</p>}
          {adjustValid && adjustMinor !== null && (
            <p className="mt-1 text-[11px] text-slate-400">
              = {adjustMinor > 0 ? "+" : ""}
              {adjustMinor} minor units ({formatMoney(adjustMinor, cur)})
              {ride ? `; current total ${formatMoney(ride.finalFareMinor ?? ride.estimatedFareMinor, cur)} -> ${formatMoney((ride.finalFareMinor ?? ride.estimatedFareMinor) + adjustMinor, cur)}` : ""}
            </p>
          )}
        </div>
      </ConfirmDialog>

      {/* Approve a pending adjustment */}
      <ConfirmDialog
        isOpen={dialog === "approve"}
        title="Approve Pending Fare Adjustment"
        description="A different staff member proposed a large fare adjustment on this ride. Enter its approval ID to apply it. You cannot approve your own proposal."
        targetEntityLabel={ride?.bookingCode}
        confirmText="Approve & Apply"
        isDestructive={false}
        requireReason={false}
        confirmDisabled={!UUID_RE.test(approvalId.trim())}
        onConfirm={doApprove}
        onCancel={() => setDialog(null)}
      >
        <div>
          <label className={labelCls}>Approval ID</label>
          <input value={approvalId} onChange={(e) => setApprovalId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className={`${fieldCls} font-mono text-xs`} />
        </div>
      </ConfirmDialog>

      {/* Change status */}
      <ConfirmDialog
        isOpen={dialog === "status"}
        title="Force Ride Status Change"
        description="Moves the ride along an exceptional, whitelisted transition. Money events are never invented: stuck trips are completed through the normal path."
        targetEntityLabel={ride ? `${ride.bookingCode} (${status ? statusLabel(status) : ""})` : undefined}
        confirmText="Change Status"
        isDestructive={false}
        minReasonLength={3}
        confirmDisabled={!statusTarget}
        onConfirm={doStatus}
        onCancel={() => setDialog(null)}
      >
        <div>
          <label className={labelCls}>New status</label>
          <select value={statusTarget} onChange={(e) => setStatusTarget(e.target.value as ApiRideStatus)} className={fieldCls}>
            {targets.map((t) => (
              <option key={t} value={t}>
                {statusLabel(t)}
              </option>
            ))}
          </select>
        </div>
      </ConfirmDialog>

      {/* Reset PIN attempts */}
      <ConfirmDialog
        isOpen={dialog === "pin"}
        title="Reset Trip-PIN Attempts"
        description="Lets the captain try the start PIN again after the rider has verified their identity with support."
        targetEntityLabel={ride?.bookingCode}
        confirmText="Reset Attempts"
        isDestructive={false}
        minReasonLength={3}
        onConfirm={doResetPin}
        onCancel={() => setDialog(null)}
      />
    </>
  );
};

