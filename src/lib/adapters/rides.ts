import type { DispatchCandidate, Ride, RideStatus, RideTimelineStep, ServiceType } from "@/types";
import { avatarFor, formatDateTime, humanize, metersToKm, minorToMajor } from "@/lib/format";

/* ───────────────────────── Backend (API) types ───────────────────────── */

/** Prisma RideStatus enum (backend/prisma/schema.prisma). */
export type ApiRideStatus =
  | "REQUESTED"
  | "SCHEDULED"
  | "SEARCHING"
  | "DRIVER_ASSIGNED"
  | "DRIVER_EN_ROUTE"
  | "DRIVER_ARRIVED"
  | "RIDE_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PAYMENT_PENDING"
  | "PAYMENT_COMPLETED"
  | "PAYMENT_FAILED"
  | "RATED"
  | "CLOSED"
  | "CANCELLED"
  | "NO_DRIVER_AVAILABLE";

export const ALL_API_RIDE_STATUSES: ApiRideStatus[] = [
  "REQUESTED",
  "SCHEDULED",
  "SEARCHING",
  "DRIVER_ASSIGNED",
  "DRIVER_EN_ROUTE",
  "DRIVER_ARRIVED",
  "RIDE_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "PAYMENT_PENDING",
  "PAYMENT_COMPLETED",
  "PAYMENT_FAILED",
  "RATED",
  "CLOSED",
  "CANCELLED",
  "NO_DRIVER_AVAILABLE",
];

export interface ApiVehicleCard {
  make: string;
  model: string;
  color: string | null;
  plateNumber: string;
  year: number | null;
}

/** `rider` / `captain` mini card in GET /admin/rides items. */
export interface ApiPartyMini {
  id: string;
  name: string | null;
  rating: number | null;
  photoUrl: string | null;
  vehicle?: ApiVehicleCard | null;
}

export interface ApiRideListItem {
  id: string;
  bookingRef: string;
  cityId: string;
  serviceType: { code: string; name: string };
  status: ApiRideStatus;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  rider: ApiPartyMini;
  captain: ApiPartyMini | null;
  pickupAddress: string | null;
  dropAddress: string | null;
  estimatedFareMinor: number;
  finalFareMinor: number | null;
  currency: string;
  paymentMethod: "CARD" | "WALLET" | "CASH";
  paymentStatus: string | null;
  hasSosAlert: boolean;
  isNoShow: boolean;
}

/** `fareBreakdown` JSON stored on the ride (backend/src/contracts/fare.ts). Integer minor units. */
export interface ApiFareBreakdown {
  currency: string;
  distanceUnit: "MILE" | "KM";
  distanceMeters: number;
  durationSeconds: number;
  distanceInUnit: number;
  durationMinutes: number;
  baseFareMinor: number;
  distanceFareMinor: number;
  timeFareMinor: number;
  waitingFareMinor: number;
  rawSubtotalMinor: number;
  minimumFareMinor: number;
  minimumFareApplied: boolean;
  subtotalMinor: number;
  surgeMultiplierBps: number;
  surgeMinor: number;
  fareBeforeFeesMinor: number;
  bookingFeeMinor: number;
  tollsMinor: number;
  discountMinor: number;
  couponCode?: string;
  taxRateBps: number;
  taxMinor: number;
  totalMinor: number;
  commissionBps: number;
  platformCommissionMinor: number;
  captainEarningMinor: number;
}

export interface ApiRideRecord {
  id: string;
  bookingRef: string;
  riderId: string;
  captainId: string | null;
  cityId: string;
  status: ApiRideStatus;
  version: number;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string | null;
  pickupNotes: string | null;
  dropLat: number;
  dropLng: number;
  dropAddress: string | null;
  estimatedDistanceMeters: number | null;
  estimatedDurationSeconds: number | null;
  actualDistanceMeters: number | null;
  actualDurationSeconds: number | null;
  waitingSeconds: number;
  currency: string;
  estimatedFareMinor: number;
  finalFareMinor: number | null;
  fareBreakdown: ApiFareBreakdown | null;
  discountMinor: number;
  adminFareAdjustmentMinor: number;
  paymentMethod: "CARD" | "WALLET" | "CASH";
  paymentStatus: string | null;
  startPinAttempts: number;
  scheduledFor: string | null;
  requestedAt: string;
  assignedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: "RIDER" | "CAPTAIN" | "ADMIN" | "SYSTEM" | null;
  cancelReasonCode: string | null;
  cancelReason: string | null;
  cancellationFeeMinor: number;
  isNoShow: boolean;
  dispatchAttemptCount: number;
  hasSosAlert: boolean;
  serviceType: { code: string; name: string };
}

export interface ApiPersonCard {
  id: string;
  name: string;
  photoUrl: string | null;
  ratingAvg: number;
  ratingCount?: number;
  phone: string;
  email?: string | null;
  vehicle?: ApiVehicleCard | null;
}

/** Raw Payment row (GET /admin/rides/:id `payment`). `clientSecret` is deliberately not typed / never displayed. */
export interface ApiRidePayment {
  id: string;
  method: "CARD" | "WALLET" | "CASH";
  provider: string;
  status: string;
  amountMinor: number;
  authorizedMinor: number;
  capturedMinor: number;
  refundedMinor: number;
  tipMinor: number;
  currency: string;
  failureCode: string | null;
  failureMessage: string | null;
  attemptCount: number;
  capturedAt: string | null;
}

export interface ApiDispatchOffer {
  id: string;
  captainId: string;
  captainName: string | null;
  rating: number | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CANCELLED";
  rank: number;
  matchingScore: number;
  etaSeconds: number | null;
  distanceMeters: number | null;
  offeredAt: string;
  respondedAt: string | null;
  declineReason: string | null;
}

export interface ApiDispatchCandidate {
  captainId: string;
  included: boolean;
  reasons?: string[];
  score?: number;
  etaSeconds?: number;
  distanceMeters?: number;
}

export interface ApiDispatchAttempt {
  attemptNo: number;
  radiusMeters: number;
  strategy: string;
  candidateCount: number;
  result: string;
  startedAt: string;
  endedAt: string | null;
  candidates: ApiDispatchCandidate[] | null;
  offers: ApiDispatchOffer[];
}

export interface ApiRideDetail {
  ride: ApiRideRecord;
  rider: ApiPersonCard;
  captain: ApiPersonCard | null;
  payment: ApiRidePayment | null;
  liveLocation: { lat: number; lng: number; heading: number | null; ts: string } | null;
  dispatchAttempts: ApiDispatchAttempt[];
}

export interface ApiTimelineStep {
  status: ApiRideStatus;
  title: string;
  timestamp: string;
  latencySeconds: number;
  description: string;
  actor: { realm: string | null; id: string | null };
}

export interface ApiLiveMapRide {
  id: string;
  ref: string;
  status: ApiRideStatus;
  /** [lat, lng] */
  pickup: [number, number];
  drop: [number, number];
  captainId: string | null;
  sos: boolean;
  at: number;
}

export interface ApiLiveCluster {
  lat: number;
  lng: number;
  count: number;
  captainIds?: string[];
}

export interface ApiLiveMap {
  serverTime: string;
  cities: Array<{
    cityId: string;
    rides: ApiLiveMapRide[];
    captains: { total: number; clusters: ApiLiveCluster[] };
  }>;
}

/** Socket `ride.state` payload (rideStateEvent in the backend). */
export interface RideStateEvent {
  rideId: string;
  bookingRef: string;
  status: ApiRideStatus;
  uiState: string;
  version: number;
  captainId: string | null;
  updatedAt: string;
}

/** Socket `ops.snapshot` payload / GET /admin/ops/snapshot. */
export interface OpsSnapshot {
  at: string;
  cityId: string | null;
  onlineCaptains: number;
  rides: Record<string, number>;
}

export interface ApiCaptainListItem {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  status: string;
  availability: string;
  onRide: boolean;
  rating: number;
  vehicle: { make: string; model: string; plateNumber: string } | null;
}

/* ───────────────────────── Status helpers ───────────────────────── */

export const LIVE_RIDE_STATUSES: ApiRideStatus[] = [
  "REQUESTED",
  "SEARCHING",
  "DRIVER_ASSIGNED",
  "DRIVER_EN_ROUTE",
  "DRIVER_ARRIVED",
  "RIDE_STARTED",
  "IN_PROGRESS",
];

/** Backend status -> the UI's seven-value RideStatus. The raw status stays available on RideView.rawStatus. */
export function toUiStatus(status: string): RideStatus {
  switch (status) {
    case "REQUESTED":
    case "SCHEDULED":
    case "SEARCHING":
      return "SEARCHING";
    case "DRIVER_ASSIGNED":
      return "ACCEPTED";
    case "DRIVER_EN_ROUTE":
      return "ARRIVING";
    case "DRIVER_ARRIVED":
      return "ARRIVED";
    case "RIDE_STARTED":
    case "IN_PROGRESS":
      return "ON_TRIP";
    case "CANCELLED":
    case "NO_DRIVER_AVAILABLE":
      return "CANCELLED";
    default:
      // COMPLETED, PAYMENT_*, RATED, CLOSED
      return "COMPLETED";
  }
}

export type StatusVariant = "plum" | "teal" | "coral" | "neutral" | "warning";

export function statusVariant(status: string): StatusVariant {
  if (status === "NO_DRIVER_AVAILABLE" || status === "PAYMENT_FAILED") return "coral";
  switch (toUiStatus(status)) {
    case "ON_TRIP":
      return "plum";
    case "ARRIVING":
    case "ARRIVED":
    case "ACCEPTED":
    case "COMPLETED":
      return "teal";
    case "SEARCHING":
      return "warning";
    case "CANCELLED":
      return "coral";
    default:
      return "neutral";
  }
}

export const statusLabel = (status: string): string => humanize(status);

/** Quick-filter tabs of the rides table -> `statuses` query value (comma separated backend statuses). */
export const STATUS_TABS: Array<{ id: string; label: string; statuses?: ApiRideStatus[] }> = [
  { id: "ALL", label: "ALL" },
  { id: "ON_TRIP", label: "ON TRIP", statuses: ["RIDE_STARTED", "IN_PROGRESS"] },
  { id: "ARRIVING", label: "ARRIVING", statuses: ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED"] },
  { id: "SEARCHING", label: "SEARCHING", statuses: ["REQUESTED", "SEARCHING"] },
  { id: "COMPLETED", label: "COMPLETED", statuses: ["COMPLETED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "PAYMENT_FAILED", "RATED", "CLOSED"] },
  { id: "CANCELLED", label: "CANCELLED", statuses: ["CANCELLED", "NO_DRIVER_AVAILABLE"] },
];

/** Active-trip filter chips of Live Ops. */
export const LIVE_STATUS_TABS: Array<{ id: string; label: string; statuses: ApiRideStatus[] }> = [
  { id: "ALL", label: "ALL", statuses: LIVE_RIDE_STATUSES },
  { id: "ON_TRIP", label: "ON TRIP", statuses: ["RIDE_STARTED", "IN_PROGRESS"] },
  { id: "ARRIVING", label: "ARRIVING", statuses: ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED"] },
  { id: "SEARCHING", label: "SEARCHING", statuses: ["REQUESTED", "SEARCHING"] },
];

/** Staff actions, mirrored from the backend state machine (ride-state-machine.def.ts / admin-rides.service.ts). */
const ADMIN_CANCELLABLE: ApiRideStatus[] = [
  "SCHEDULED",
  "REQUESTED",
  "SEARCHING",
  "NO_DRIVER_AVAILABLE",
  "DRIVER_ASSIGNED",
  "DRIVER_EN_ROUTE",
  "DRIVER_ARRIVED",
  "RIDE_STARTED",
  "IN_PROGRESS",
];
const REASSIGN_ASSIGNED: ApiRideStatus[] = ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED"];
const REASSIGN_SEARCHING: ApiRideStatus[] = ["SEARCHING", "NO_DRIVER_AVAILABLE"];
const FARE_ADJUSTABLE: ApiRideStatus[] = [
  "REQUESTED",
  "SEARCHING",
  "DRIVER_ASSIGNED",
  "DRIVER_EN_ROUTE",
  "DRIVER_ARRIVED",
  "RIDE_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "PAYMENT_PENDING",
  "PAYMENT_FAILED",
];
/** ADMIN_FORCE_ALLOWED whitelist (the backend does not expose it; the API rejects anything else). */
const FORCE_ALLOWED: Array<{ from: ApiRideStatus; to: ApiRideStatus }> = [
  { from: "NO_DRIVER_AVAILABLE", to: "SEARCHING" },
  { from: "IN_PROGRESS", to: "COMPLETED" },
  { from: "PAYMENT_FAILED", to: "PAYMENT_PENDING" },
  { from: "PAYMENT_PENDING", to: "PAYMENT_COMPLETED" },
  { from: "PAYMENT_FAILED", to: "PAYMENT_COMPLETED" },
  { from: "COMPLETED", to: "PAYMENT_PENDING" },
  { from: "CANCELLED", to: "CLOSED" },
  { from: "PAYMENT_COMPLETED", to: "CLOSED" },
];

export const canCancelRide = (s: ApiRideStatus): boolean => ADMIN_CANCELLABLE.includes(s);
export const canReassignRide = (s: ApiRideStatus): boolean => REASSIGN_ASSIGNED.includes(s) || REASSIGN_SEARCHING.includes(s);
export const isAssignedStatus = (s: ApiRideStatus): boolean => REASSIGN_ASSIGNED.includes(s);
export const canAdjustFare = (s: ApiRideStatus): boolean => FARE_ADJUSTABLE.includes(s);
export const allowedStatusTargets = (from: ApiRideStatus): ApiRideStatus[] => FORCE_ALLOWED.filter((r) => r.from === from).map((r) => r.to);

export const ADMIN_CANCEL_REASON_CODES = ["SAFETY", "OPERATIONAL", "FRAUD", "EMERGENCY", "SUPPORT", "OTHER"] as const;
export type AdminCancelReasonCode = (typeof ADMIN_CANCEL_REASON_CODES)[number];

/* ───────────────────────── Service types ───────────────────────── */

/** The six seeded service-type codes; the API serviceType.code is the same string as the UI ServiceType union. */
export const SERVICE_TYPE_FALLBACK: Array<{ code: ServiceType; name: string }> = [
  { code: "AMOOR_GO", name: "AMOOR Go" },
  { code: "AMOOR_PRIME", name: "AMOOR Prime" },
  { code: "AMOOR_SEDAN", name: "AMOOR Sedan" },
  { code: "AMOOR_MOTO", name: "AMOOR Moto" },
  { code: "AMOOR_AUTO", name: "AMOOR Auto" },
  { code: "AMOOR_EV", name: "AMOOR EV" },
];

const KNOWN_SERVICE_TYPES = new Set<string>(SERVICE_TYPE_FALLBACK.map((s) => s.code));
export const toUiServiceType = (code: string): ServiceType => (KNOWN_SERVICE_TYPES.has(code) ? (code as ServiceType) : "AMOOR_GO");

/* ───────────────────────── View models ───────────────────────── */

export interface RideView extends Ride {
  rawStatus: ApiRideStatus;
  cityId: string;
  serviceTypeCode: string;
  serviceTypeName: string;
  requestedAt: string;
  currency: string;
  estimatedFareMinor: number;
  finalFareMinor: number | null;
  paymentMethodRaw: "CARD" | "WALLET" | "CASH";
  paymentStatusRaw: string | null;
  isNoShow: boolean;
}

const PAYMENT_METHOD: Record<string, Ride["paymentMethod"]> = { CARD: "STRIPE_CARD", WALLET: "AMOOR_WALLET", CASH: "CASH" };

function toPaymentStatus(raw: string | null): Ride["paymentStatus"] {
  switch (raw) {
    case "CAPTURED":
      return "CAPTURED";
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "REFUNDED";
    case "FAILED":
    case "CANCELLED":
      return "FAILED";
    default:
      return "PENDING";
  }
}

const emptyFare = (grossMinor: number): Ride["fare"] => ({
  baseFare: 0,
  distanceFare: 0,
  durationMinutes: 0,
  timeFare: 0,
  surgeMultiplier: 1,
  surgeFare: 0,
  tollAndWait: 0,
  taxes: 0,
  grossFare: minorToMajor(grossMinor),
  platformCommission: 0,
  captainNetPayout: 0,
});

function fareFromBreakdown(b: ApiFareBreakdown, grossMinor: number): Ride["fare"] {
  return {
    baseFare: minorToMajor(b.baseFareMinor),
    distanceMiles: b.distanceUnit === "MILE" ? b.distanceInUnit : undefined,
    distanceKm: b.distanceUnit === "KM" ? b.distanceInUnit : metersToKm(b.distanceMeters),
    distanceFare: minorToMajor(b.distanceFareMinor),
    durationMinutes: b.durationMinutes,
    timeFare: minorToMajor(b.timeFareMinor),
    surgeMultiplier: b.surgeMultiplierBps / 10000,
    surgeFare: minorToMajor(b.surgeMinor),
    tollAndWait: minorToMajor(b.tollsMinor + b.waitingFareMinor),
    taxes: minorToMajor(b.taxMinor),
    grossFare: minorToMajor(grossMinor),
    platformCommission: minorToMajor(b.platformCommissionMinor),
    captainNetPayout: minorToMajor(b.captainEarningMinor),
  };
}

/** GET /admin/rides item -> RideView. Phones, trip PIN and fare breakdown are not part of the list payload. */
export function toRide(dto: ApiRideListItem, cityLabel: (id: string) => string): RideView {
  const riderName = dto.rider.name ?? "Unknown rider";
  const captain = dto.captain;
  const v = captain?.vehicle ?? null;
  const gross = dto.finalFareMinor ?? dto.estimatedFareMinor;
  return {
    id: dto.id,
    bookingCode: dto.bookingRef,
    city: cityLabel(dto.cityId),
    cityId: dto.cityId,
    serviceType: toUiServiceType(dto.serviceType.code),
    serviceTypeCode: dto.serviceType.code,
    serviceTypeName: dto.serviceType.name,
    status: toUiStatus(dto.status),
    rawStatus: dto.status,
    createdAt: dto.requestedAt,
    requestedAt: dto.requestedAt,
    startedAt: dto.startedAt ?? undefined,
    completedAt: dto.completedAt ?? undefined,
    rider: { id: dto.rider.id, name: riderName, phone: "", rating: dto.rider.rating ?? 0, avatar: avatarFor(riderName, dto.rider.photoUrl) },
    captain: captain
      ? {
          id: captain.id,
          name: captain.name ?? "Unknown captain",
          phone: "",
          rating: captain.rating ?? 0,
          avatar: avatarFor(captain.name, captain.photoUrl),
          vehiclePlate: v?.plateNumber ?? "—",
          vehicleModel: v ? `${v.make} ${v.model}` : "—",
          vehicleColor: v?.color ?? "",
        }
      : undefined,
    pickupAddress: dto.pickupAddress ?? "—",
    dropoffAddress: dto.dropAddress ?? "—",
    pickupCoords: [0, 0],
    dropoffCoords: [0, 0],
    otpPin: "",
    fare: emptyFare(gross),
    currency: dto.currency,
    estimatedFareMinor: dto.estimatedFareMinor,
    finalFareMinor: dto.finalFareMinor,
    paymentMethod: PAYMENT_METHOD[dto.paymentMethod] ?? "STRIPE_CARD",
    paymentMethodRaw: dto.paymentMethod,
    paymentStatus: toPaymentStatus(dto.paymentStatus),
    paymentStatusRaw: dto.paymentStatus,
    timeline: [],
    dispatchAttempts: [],
    hasSOSAlert: dto.hasSosAlert,
    isNoShow: dto.isNoShow,
  };
}

/** Apply a socket `ride.state` hint to a list row (status + captain presence); REST stays the source of truth. */
export function applyRideState(ride: RideView, ev: RideStateEvent): RideView {
  if (ev.rideId !== ride.id) return ride;
  return {
    ...ride,
    rawStatus: ev.status,
    status: toUiStatus(ev.status),
    captain: ev.captainId ? ride.captain : undefined,
  };
}

/* Detail ------------------------------------------------------------------ */

export interface TimelineStepView extends RideTimelineStep {
  at: string;
  actorLabel: string;
}

export interface DispatchOfferView {
  id: string;
  captainId: string;
  captainName: string;
  rating: number | null;
  status: ApiDispatchOffer["status"];
  rank: number;
  score: number;
  etaSeconds: number | null;
  distanceKm: number | null;
  offeredAt: string;
  respondedAt: string | null;
  reason?: string;
}

export interface DispatchAttemptView {
  attemptNo: number;
  radiusKm: number;
  strategy: string;
  candidateCount: number;
  result: string;
  startedAt: string;
  endedAt: string | null;
  offers: DispatchOfferView[];
  excluded: Array<{ captainId: string; reasons: string[] }>;
}

export interface RideDetailView extends RideView {
  riderEmail: string | null;
  captainDetail: ApiPersonCard | null;
  startPinAttempts: number;
  breakdown: ApiFareBreakdown | null;
  adminFareAdjustmentMinor: number;
  cancellationFeeMinor: number;
  cancelledBy: ApiRideRecord["cancelledBy"];
  cancelReasonCode: string | null;
  cancelReason: string | null;
  payment: ApiRidePayment | null;
  liveLocation: ApiRideDetail["liveLocation"];
  attempts: DispatchAttemptView[];
  estimatedDistanceKm: number | null;
  actualDistanceKm: number | null;
  scheduledFor: string | null;
  version: number;
}

const OFFER_RESPONSE: Record<ApiDispatchOffer["status"], DispatchCandidate["response"] | null> = {
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  EXPIRED: "TIMEOUT",
  CANCELLED: "DECLINED",
  PENDING: null,
};

/** Maps an offer to the UI's DispatchCandidate (kept for reference/compat; the drawer renders DispatchOfferView). */
export function offerToCandidate(o: DispatchOfferView): DispatchCandidate | null {
  const response = OFFER_RESPONSE[o.status];
  if (!response) return null;
  return {
    captainId: o.captainId,
    captainName: o.captainName,
    rating: o.rating ?? 0,
    distanceKm: o.distanceKm ?? undefined,
    offeredAt: formatDateTime(o.offeredAt),
    response,
    reason: o.reason,
  };
}

export function toRideDetail(dto: ApiRideDetail, cityLabel: (id: string) => string): RideDetailView {
  const r = dto.ride;
  const base = toRide(
    {
      id: r.id,
      bookingRef: r.bookingRef,
      cityId: r.cityId,
      serviceType: r.serviceType,
      status: r.status,
      requestedAt: r.requestedAt,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      rider: { id: dto.rider.id, name: dto.rider.name, rating: dto.rider.ratingAvg, photoUrl: dto.rider.photoUrl },
      captain: dto.captain
        ? { id: dto.captain.id, name: dto.captain.name, rating: dto.captain.ratingAvg, photoUrl: dto.captain.photoUrl, vehicle: dto.captain.vehicle ?? null }
        : null,
      pickupAddress: r.pickupAddress,
      dropAddress: r.dropAddress,
      estimatedFareMinor: r.estimatedFareMinor,
      finalFareMinor: r.finalFareMinor,
      currency: r.currency,
      paymentMethod: r.paymentMethod,
      paymentStatus: dto.payment?.status ?? r.paymentStatus,
      hasSosAlert: r.hasSosAlert,
      isNoShow: r.isNoShow,
    },
    cityLabel,
  );
  const gross = r.finalFareMinor ?? r.estimatedFareMinor;
  base.rider.phone = dto.rider.phone;
  if (base.captain && dto.captain) base.captain.phone = dto.captain.phone;
  base.pickupCoords = [r.pickupLat, r.pickupLng];
  base.dropoffCoords = [r.dropLat, r.dropLng];
  if (dto.liveLocation) base.currentCoords = [dto.liveLocation.lat, dto.liveLocation.lng];
  if (r.fareBreakdown) base.fare = fareFromBreakdown(r.fareBreakdown, gross);

  const attempts: DispatchAttemptView[] = dto.dispatchAttempts.map((a) => ({
    attemptNo: a.attemptNo,
    radiusKm: metersToKm(a.radiusMeters),
    strategy: a.strategy,
    candidateCount: a.candidateCount,
    result: a.result,
    startedAt: a.startedAt,
    endedAt: a.endedAt,
    offers: a.offers.map((o) => ({
      id: o.id,
      captainId: o.captainId,
      captainName: o.captainName ?? "Captain",
      rating: o.rating,
      status: o.status,
      rank: o.rank,
      score: o.matchingScore,
      etaSeconds: o.etaSeconds,
      distanceKm: o.distanceMeters === null ? null : metersToKm(o.distanceMeters),
      offeredAt: o.offeredAt,
      respondedAt: o.respondedAt,
      reason: o.declineReason ?? undefined,
    })),
    excluded: (Array.isArray(a.candidates) ? a.candidates : [])
      .filter((c) => c && c.included === false)
      .map((c) => ({ captainId: c.captainId, reasons: c.reasons ?? [] })),
  }));
  base.dispatchAttempts = attempts.flatMap((a) => a.offers.map(offerToCandidate).filter((c): c is DispatchCandidate => c !== null));

  return {
    ...base,
    riderEmail: dto.rider.email ?? null,
    captainDetail: dto.captain,
    startPinAttempts: r.startPinAttempts,
    breakdown: r.fareBreakdown,
    adminFareAdjustmentMinor: r.adminFareAdjustmentMinor,
    cancellationFeeMinor: r.cancellationFeeMinor,
    cancelledBy: r.cancelledBy,
    cancelReasonCode: r.cancelReasonCode,
    cancelReason: r.cancelReason,
    payment: dto.payment,
    liveLocation: dto.liveLocation,
    attempts,
    estimatedDistanceKm: r.estimatedDistanceMeters === null ? null : metersToKm(r.estimatedDistanceMeters),
    actualDistanceKm: r.actualDistanceMeters === null ? null : metersToKm(r.actualDistanceMeters),
    scheduledFor: r.scheduledFor,
    version: r.version,
  };
}

export function toTimeline(steps: ApiTimelineStep[]): TimelineStepView[] {
  return steps.map((s) => ({
    status: s.status,
    title: s.title,
    timestamp: formatDateTime(s.timestamp),
    at: s.timestamp,
    latencySeconds: s.latencySeconds > 0 ? s.latencySeconds : undefined,
    description: s.description,
    actorLabel: s.actor.realm ? humanize(s.actor.realm) : "System",
  }));
}

/* Live map ---------------------------------------------------------------- */

export interface LiveMapRideView {
  id: string;
  ref: string;
  rawStatus: ApiRideStatus;
  status: RideStatus;
  pickup: [number, number];
  drop: [number, number];
  captainId: string | null;
  sos: boolean;
}

export interface LiveMapData {
  serverTime: string;
  rides: LiveMapRideView[];
  clusters: ApiLiveCluster[];
  onlineTotal: number;
}

/** Flattens the per-city payload of GET /admin/live/map (the console shows the selected city, or all permitted ones). */
export function toLiveMapData(dto: ApiLiveMap): LiveMapData {
  const rides: LiveMapRideView[] = [];
  const clusters: ApiLiveCluster[] = [];
  let onlineTotal = 0;
  for (const c of dto.cities) {
    for (const r of c.rides) {
      rides.push({ id: r.id, ref: r.ref, rawStatus: r.status, status: toUiStatus(r.status), pickup: r.pickup, drop: r.drop, captainId: r.captainId, sos: r.sos });
    }
    clusters.push(...c.captains.clusters);
    onlineTotal += c.captains.total;
  }
  return { serverTime: dto.serverTime, rides, clusters, onlineTotal };
}
