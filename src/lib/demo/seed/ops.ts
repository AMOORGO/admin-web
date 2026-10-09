/** Seed: rides (all statuses, timelines, dispatch attempts, payments) and safety incidents. */
import type { ApiStaff } from "../../adapters/iam";
import type { ApiCancellationPolicy, ApiCityFull, ApiPricingRule, ApiServiceType } from "../../adapters/pricing";
import type { ApiDispatchAttempt, ApiDispatchOffer, ApiRideRecord, ApiRidePayment, ApiRideStatus } from "../../adapters/rides";
import type {
  ApiIncidentDetail,
  ApiIncidentEvent,
  ApiIncidentSeverity,
  ApiIncidentStatus,
  ApiIncidentType,
  ApiRealm,
} from "../../adapters/safety";
import type { ApiUserDetail } from "../../adapters/users";
import type { CaptainRow, RideRow } from "../store";
import { computeFare } from "../logic/fare";
import { appendEvent, type Actor } from "../logic/ride";
import { HOUR, MIN, SEC, haversineMeters, iso, mulberry32, pick, randFloat, randInt, refCode, uuid } from "../util";

const r = mulberry32(303);

interface Poi {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const POIS: Poi[][] = [
  [
    { name: "Texas State Capitol", address: "1100 Congress Ave, Austin, TX 78701", lat: 30.2747, lng: -97.7404 },
    { name: "Austin-Bergstrom International Airport (AUS)", address: "3600 Presidential Blvd, Austin, TX 78719", lat: 30.1975, lng: -97.6664 },
    { name: "The Domain", address: "11410 Century Oaks Terrace, Austin, TX 78758", lat: 30.4021, lng: -97.7252 },
    { name: "South Congress Hotel", address: "1603 S Congress Ave, Austin, TX 78704", lat: 30.2478, lng: -97.7496 },
    { name: "Rainey Street Historic District", address: "85 Rainey St, Austin, TX 78701", lat: 30.2593, lng: -97.7387 },
    { name: "Zilker Metropolitan Park", address: "2100 Barton Springs Rd, Austin, TX 78746", lat: 30.2669, lng: -97.7729 },
    { name: "Barton Creek Square", address: "2901 S Capital of Texas Hwy, Austin, TX 78746", lat: 30.2597, lng: -97.8077 },
    { name: "UT Austin Main Building", address: "110 Inner Campus Dr, Austin, TX 78712", lat: 30.2849, lng: -97.7341 },
    { name: "South Lamar Plaza", address: "1400 S Lamar Blvd, Austin, TX 78704", lat: 30.2519, lng: -97.7651 },
    { name: "East 6th Street", address: "1100 E 6th St, Austin, TX 78702", lat: 30.2634, lng: -97.7276 },
    { name: "Mueller Lake Park", address: "4550 Mueller Blvd, Austin, TX 78723", lat: 30.2992, lng: -97.706 },
    { name: "Q2 Stadium", address: "10414 McKalla Pl, Austin, TX 78758", lat: 30.3877, lng: -97.7195 },
    { name: "Austin Central Library", address: "710 W Cesar Chavez St, Austin, TX 78701", lat: 30.2666, lng: -97.7525 },
    { name: "Hyde Park Bar & Grill", address: "4206 Duval St, Austin, TX 78751", lat: 30.3057, lng: -97.7273 },
  ],
  [
    { name: "Uptown Dallas, McKinney Ave", address: "3699 McKinney Ave, Dallas, TX 75204", lat: 32.7986, lng: -96.8031 },
    { name: "Dallas Love Field Airport (DAL)", address: "8008 Herb Kelleher Way, Dallas, TX 75235", lat: 32.8471, lng: -96.8518 },
    { name: "Deep Ellum", address: "2800 Main St, Dallas, TX 75226", lat: 32.7838, lng: -96.7826 },
    { name: "Dallas Arts District", address: "2200 Flora St, Dallas, TX 75201", lat: 32.7886, lng: -96.7985 },
    { name: "Reunion Tower", address: "300 Reunion Blvd E, Dallas, TX 75207", lat: 32.7757, lng: -96.8089 },
  ],
  [
    { name: "Discovery Green", address: "1500 McKinney St, Houston, TX 77010", lat: 29.7527, lng: -95.359 },
    { name: "William P. Hobby Airport (HOU)", address: "7800 Airport Blvd, Houston, TX 77061", lat: 29.6454, lng: -95.2789 },
    { name: "The Galleria", address: "5085 Westheimer Rd, Houston, TX 77056", lat: 29.7391, lng: -95.4617 },
    { name: "Rice University", address: "6100 Main St, Houston, TX 77005", lat: 29.7174, lng: -95.4018 },
  ],
];

interface RideSpec {
  status: ApiRideStatus;
  /** Minutes since the ride entered its current status. */
  lastAgoMin: number;
  city: 0 | 1 | 2;
  /** Index into the captain list (fixed assignment for rides that must line up with ON_RIDE captains). */
  captain?: number;
  service?: string;
  cancelledBy?: "RIDER" | "CAPTAIN" | "ADMIN" | "SYSTEM";
  cancelStage?: ApiRideStatus;
  sos?: boolean;
  pinAttempts?: number;
  surgeBps?: number;
  method?: "CARD" | "WALLET" | "CASH";
  scheduledInMin?: number;
  tipMinor?: number;
  refunded?: boolean;
  adjustMinor?: number;
  coupon?: string;
}

const SPECS: RideSpec[] = [
  // ── Live ──
  { status: "REQUESTED", lastAgoMin: 0.4, city: 0, service: "AMOOR_GO" },
  { status: "SEARCHING", lastAgoMin: 1.5, city: 0, service: "AMOOR_SEDAN" },
  { status: "SEARCHING", lastAgoMin: 14, city: 0, service: "AMOOR_GO" },
  { status: "DRIVER_ASSIGNED", lastAgoMin: 0.6, city: 0, captain: 0 },
  { status: "DRIVER_EN_ROUTE", lastAgoMin: 3, city: 0, captain: 1 },
  { status: "DRIVER_EN_ROUTE", lastAgoMin: 5, city: 0, captain: 2, surgeBps: 15000 },
  { status: "DRIVER_ARRIVED", lastAgoMin: 2, city: 0, captain: 5, pinAttempts: 3 },
  { status: "RIDE_STARTED", lastAgoMin: 1, city: 0, captain: 6 },
  { status: "IN_PROGRESS", lastAgoMin: 11, city: 0, captain: 8, sos: true },
  { status: "IN_PROGRESS", lastAgoMin: 6, city: 0, captain: 12 },
  { status: "IN_PROGRESS", lastAgoMin: 18, city: 0, captain: 11 },
  { status: "IN_PROGRESS", lastAgoMin: 4, city: 0, captain: 3 },
  { status: "SCHEDULED", lastAgoMin: 120, city: 0, service: "AMOOR_GO", scheduledInMin: 26 * 60 },
  // ── Completed / settled ──
  { status: "COMPLETED", lastAgoMin: 4, city: 0, service: "AMOOR_GO" },
  { status: "COMPLETED", lastAgoMin: 8, city: 0, service: "AMOOR_GO", sos: true },
  { status: "COMPLETED", lastAgoMin: 25, city: 1, service: "AMOOR_GO" },
  { status: "PAYMENT_PENDING", lastAgoMin: 2, city: 0, service: "AMOOR_SEDAN" },
  { status: "PAYMENT_COMPLETED", lastAgoMin: 40, city: 0, service: "AMOOR_GO", surgeBps: 12500 },
  { status: "PAYMENT_COMPLETED", lastAgoMin: 75, city: 0, service: "AMOOR_PRIME" },
  { status: "PAYMENT_COMPLETED", lastAgoMin: 130, city: 2, service: "AMOOR_GO", method: "WALLET" },
  { status: "PAYMENT_FAILED", lastAgoMin: 180, city: 0, service: "AMOOR_GO" },
  { status: "PAYMENT_FAILED", lastAgoMin: 600, city: 1, service: "AMOOR_GO" },
  { status: "RATED", lastAgoMin: 200, city: 0, service: "AMOOR_GO", tipMinor: 300 },
  { status: "RATED", lastAgoMin: 300, city: 0, service: "AMOOR_EV", refunded: true },
  { status: "RATED", lastAgoMin: 420, city: 0, service: "AMOOR_SEDAN" },
  { status: "RATED", lastAgoMin: 600, city: 0, service: "AMOOR_GO", method: "WALLET" },
  { status: "RATED", lastAgoMin: 900, city: 2, service: "AMOOR_GO", coupon: "WELCOME5" },
  { status: "RATED", lastAgoMin: 1400, city: 0, service: "AMOOR_PRIME", tipMinor: 500 },
  { status: "CLOSED", lastAgoMin: 1500, city: 0, service: "AMOOR_GO", adjustMinor: -300 },
  { status: "CLOSED", lastAgoMin: 1700, city: 0, service: "AMOOR_GO" },
  { status: "CLOSED", lastAgoMin: 2000, city: 1, service: "AMOOR_GO", method: "CASH" },
  { status: "CLOSED", lastAgoMin: 2400, city: 0, service: "AMOOR_EV" },
  { status: "CLOSED", lastAgoMin: 2800, city: 0, service: "AMOOR_GO", sos: true },
  // ── Cancelled / no driver ──
  { status: "CANCELLED", lastAgoMin: 35, city: 0, service: "AMOOR_GO", cancelledBy: "RIDER", cancelStage: "DRIVER_ASSIGNED" },
  { status: "CANCELLED", lastAgoMin: 95, city: 0, service: "AMOOR_GO", cancelledBy: "RIDER", cancelStage: "SEARCHING" },
  { status: "CANCELLED", lastAgoMin: 240, city: 0, service: "AMOOR_GO", cancelledBy: "CAPTAIN", cancelStage: "DRIVER_ARRIVED" },
  { status: "CANCELLED", lastAgoMin: 700, city: 0, service: "AMOOR_SEDAN", cancelledBy: "ADMIN", cancelStage: "SEARCHING" },
  { status: "CANCELLED", lastAgoMin: 1100, city: 2, service: "AMOOR_GO", cancelledBy: "SYSTEM", cancelStage: "REQUESTED" },
  { status: "NO_DRIVER_AVAILABLE", lastAgoMin: 55, city: 0, service: "AMOOR_GO" },
  { status: "NO_DRIVER_AVAILABLE", lastAgoMin: 900, city: 1, service: "AMOOR_GO" },
];

const FULL_PATH: ApiRideStatus[] = [
  "REQUESTED",
  "SEARCHING",
  "DRIVER_ASSIGNED",
  "DRIVER_EN_ROUTE",
  "DRIVER_ARRIVED",
  "RIDE_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "PAYMENT_PENDING",
  "PAYMENT_COMPLETED",
  "RATED",
  "CLOSED",
];

function pathFor(spec: RideSpec): ApiRideStatus[] {
  const upTo = (s: ApiRideStatus) => FULL_PATH.slice(0, FULL_PATH.indexOf(s) + 1);
  switch (spec.status) {
    case "SCHEDULED":
      return ["SCHEDULED"];
    case "PAYMENT_FAILED":
      return [...upTo("PAYMENT_PENDING"), "PAYMENT_FAILED"];
    case "CANCELLED":
      return [...upTo(spec.cancelStage ?? "SEARCHING"), "CANCELLED"];
    case "NO_DRIVER_AVAILABLE":
      return ["REQUESTED", "SEARCHING", "NO_DRIVER_AVAILABLE"];
    default:
      return upTo(spec.status);
  }
}

/** Seconds between a status and the previous one. */
function deltaFor(status: ApiRideStatus, tripSeconds: number): number {
  switch (status) {
    case "SEARCHING":
      return 2;
    case "DRIVER_ASSIGNED":
      return randInt(r, 9, 45);
    case "DRIVER_EN_ROUTE":
      return 4;
    case "DRIVER_ARRIVED":
      return randInt(r, 200, 420);
    case "RIDE_STARTED":
      return randInt(r, 80, 170);
    case "IN_PROGRESS":
      return 5;
    case "COMPLETED":
      return tripSeconds;
    case "PAYMENT_PENDING":
      return 1;
    case "PAYMENT_COMPLETED":
      return 3;
    case "PAYMENT_FAILED":
      return 4;
    case "RATED":
      return randInt(r, 120, 1500);
    case "CLOSED":
      return randInt(r, 1800, 3600);
    case "CANCELLED":
      return randInt(r, 25, 200);
    case "NO_DRIVER_AVAILABLE":
      return 240;
    default:
      return 0;
  }
}

export interface OpsSeedInput {
  now: number;
  cities: ApiCityFull[];
  serviceTypes: ApiServiceType[];
  rules: ApiPricingRule[];
  policies: ApiCancellationPolicy[];
  riders: ApiUserDetail[];
  captains: CaptainRow[];
  staff: ApiStaff[];
}

function activeRule(rules: ApiPricingRule[], cityId: string, serviceTypeId: string): ApiPricingRule {
  const list = rules.filter((x) => x.cityId === cityId && x.serviceTypeId === serviceTypeId && x.isActive).sort((a, b) => b.version - a.version);
  return list[0] ?? rules[0];
}

function describe(status: ApiRideStatus, ctx: { rider: string; captain: string; service: string; pickup: string; drop: string; reason?: string; cancelledBy?: string; method: string }): string {
  switch (status) {
    case "REQUESTED":
      return `${ctx.rider} requested ${ctx.service} from ${ctx.pickup}.`;
    case "SCHEDULED":
      return `${ctx.rider} scheduled a ${ctx.service} pickup.`;
    case "SEARCHING":
      return "Dispatch is matching nearby captains within a 5 mile radius.";
    case "DRIVER_ASSIGNED":
      return `${ctx.captain} accepted the offer.`;
    case "DRIVER_EN_ROUTE":
      return `${ctx.captain} is heading to the pickup point.`;
    case "DRIVER_ARRIVED":
      return `${ctx.captain} arrived at ${ctx.pickup}. Rider notified.`;
    case "RIDE_STARTED":
      return "Trip PIN verified in the captain app. Ride started.";
    case "IN_PROGRESS":
      return `Trip underway to ${ctx.drop}.`;
    case "COMPLETED":
      return `Trip ended at ${ctx.drop}.`;
    case "PAYMENT_PENDING":
      return `Payment capture started (${ctx.method}).`;
    case "PAYMENT_COMPLETED":
      return ctx.method === "CASH" ? "Cash collected by the captain." : "Payment captured and ledger entries posted.";
    case "PAYMENT_FAILED":
      return "The card was declined after 3 attempts. The rider must update the payment method.";
    case "RATED":
      return `${ctx.rider} rated the trip.`;
    case "CLOSED":
      return "Ride closed and settled to the captain.";
    case "CANCELLED":
      return ctx.reason ? `Cancelled by ${ctx.cancelledBy}: ${ctx.reason}` : `Cancelled by ${ctx.cancelledBy}.`;
    case "NO_DRIVER_AVAILABLE":
      return "No captain accepted within the search window. Rider was notified.";
  }
}

function makeAttempts(spec: RideSpec, startTs: number, cityId: string, captains: CaptainRow[], chosen: CaptainRow | null, status: ApiRideStatus): ApiDispatchAttempt[] {
  const candidates = captains.filter((c) => c.d.status === "APPROVED" && c.d.cityId === cityId && c !== chosen).slice(0, 8);
  const mkOffer = (cap: CaptainRow, rank: number, outcome: ApiDispatchOffer["status"], at: number): ApiDispatchOffer => ({
    id: uuid(r),
    captainId: cap.d.id,
    captainName: cap.d.name,
    rating: cap.d.metrics.rating,
    status: outcome,
    rank,
    matchingScore: Math.round(randFloat(r, 0.62, 0.96) * 1000) / 1000,
    etaSeconds: randInt(r, 120, 540),
    distanceMeters: randInt(r, 700, 6500),
    offeredAt: iso(at),
    respondedAt: outcome === "PENDING" ? null : iso(at + (outcome === "EXPIRED" ? 30 : randInt(r, 4, 20)) * SEC),
    declineReason: outcome === "DECLINED" ? pick(r, ["Taking a break", "Too far from pickup", "Heading home"]) : null,
  });
  const excluded = candidates.slice(5, 7).map((c, i) => ({
    captainId: c.d.id,
    included: false,
    reasons: [i === 0 ? "ON_ANOTHER_RIDE" : "RATING_BELOW_MIN"],
  }));
  const included = (list: CaptainRow[]) => list.map((c) => ({ captainId: c.d.id, included: true, score: Math.round(randFloat(r, 0.6, 0.95) * 100) / 100, etaSeconds: randInt(r, 120, 500), distanceMeters: randInt(r, 700, 6000) }));

  if (status === "NO_DRIVER_AVAILABLE" || (status === "SEARCHING" && spec.lastAgoMin > 10)) {
    const stuck = status === "SEARCHING";
    const attempts: ApiDispatchAttempt[] = [];
    for (let n = 1; n <= (stuck ? 2 : 3); n++) {
      const at = startTs + 2 * SEC + (n - 1) * 80 * SEC;
      const offered = candidates.slice((n - 1) * 2, (n - 1) * 2 + 2);
      const last = stuck && n === 2;
      attempts.push({
        attemptNo: n,
        radiusMeters: Math.round([5, 7.5, 10][n - 1] * 1609.344),
        strategy: "SEQUENTIAL",
        candidateCount: offered.length + excluded.length,
        result: last ? "IN_PROGRESS" : "NO_ACCEPT",
        startedAt: iso(at),
        endedAt: last ? null : iso(at + 75 * SEC),
        candidates: [...included(offered), ...excluded],
        offers: offered.map((c, i) => mkOffer(c, i + 1, last && i === 1 ? "PENDING" : i === 0 ? "DECLINED" : "EXPIRED", at + i * 32 * SEC)),
      });
    }
    return attempts;
  }
  if (status === "SEARCHING" || status === "REQUESTED") {
    const at = startTs + 2 * SEC;
    const offered = candidates.slice(0, 2);
    return [
      {
        attemptNo: 1,
        radiusMeters: Math.round(5 * 1609.344),
        strategy: "SEQUENTIAL",
        candidateCount: offered.length + excluded.length,
        result: "IN_PROGRESS",
        startedAt: iso(at),
        endedAt: null,
        candidates: [...included(offered), ...excluded],
        offers: offered.map((c, i) => mkOffer(c, i + 1, "PENDING", at + i * 2 * SEC)),
      },
    ];
  }
  if (!chosen) return [];
  const at = startTs + 2 * SEC;
  const decliners = candidates.slice(0, randInt(r, 0, 2));
  const offers: ApiDispatchOffer[] = [
    ...decliners.map((c, i) => mkOffer(c, i + 1, i % 2 === 0 ? "DECLINED" : "EXPIRED", at + i * 32 * SEC)),
    mkOffer(chosen, decliners.length + 1, "ACCEPTED", at + decliners.length * 32 * SEC),
  ];
  return [
    {
      attemptNo: 1,
      radiusMeters: Math.round(5 * 1609.344),
      strategy: "SEQUENTIAL",
      candidateCount: offers.length + excluded.length,
      result: "OFFER_ACCEPTED",
      startedAt: iso(at),
      endedAt: iso(at + (decliners.length * 32 + 12) * SEC),
      candidates: [...included([...decliners, chosen]), ...excluded],
      offers,
    },
  ];
}

export interface OpsSeed {
  rides: RideRow[];
  incidents: ApiIncidentDetail[];
}

export function seedOps(input: OpsSeedInput): OpsSeed {
  const { now, cities, serviceTypes, rules, riders, captains } = input;
  const approved = captains.filter((c) => c.d.status === "APPROVED");
  const rows: RideRow[] = [];
  const usedBookingRefs = new Set<string>();
  const activeRiders = riders.filter((x) => x.status === "ACTIVE" && x.profileComplete);

  for (const spec of SPECS) {
    const cityId = cities[spec.city].id;
    const fixed = spec.captain !== undefined ? captains[spec.captain] : null;
    const captainNeeded = pathFor(spec).includes("DRIVER_ASSIGNED");
    let service = spec.service;
    if (!service && fixed) {
      service = fixed.d.serviceTypes[0]?.code ?? "AMOOR_GO";
    }
    service = service ?? "AMOOR_GO";

    // Pick a captain consistent with the service type and city for rides that need one.
    let captain: CaptainRow | null = fixed;
    if (!captain && captainNeeded) {
      const eligible = approved.filter((c) => c.d.cityId === cityId && c.d.serviceTypes.some((s) => s.code === service) && c.d.availability !== "ON_RIDE");
      captain = eligible.length ? pick(r, eligible) : pick(r, approved.filter((c) => c.d.cityId === cityId && c.d.availability !== "ON_RIDE"));
    }
    const rider = pick(r, activeRiders);
    const pois = POIS[spec.city];
    const pickup = pick(r, pois);
    let drop = pick(r, pois);
    while (drop === pickup) drop = pick(r, pois);
    const distanceMeters = Math.max(1800, haversineMeters([pickup.lat, pickup.lng], [drop.lat, drop.lng]) * 1.28);
    const tripSeconds = Math.round(distanceMeters / randFloat(r, 7, 10) + 90);
    const serviceType = serviceTypes.find((s) => s.code === service) ?? serviceTypes[0];
    const rule = activeRule(rules, cityId, serviceType.id);
    const surgeBps = spec.surgeBps ?? 10000;
    const estimate = computeFare(rule, { distanceMeters, durationSeconds: tripSeconds, surgeMultiplierBps: surgeBps });

    // Timestamps: walk backwards from the moment the ride entered its current status.
    const path = pathFor(spec);
    const stamps: number[] = new Array<number>(path.length).fill(0);
    stamps[path.length - 1] = now - spec.lastAgoMin * MIN;
    for (let i = path.length - 1; i > 0; i--) stamps[i - 1] = stamps[i] - deltaFor(path[i], tripSeconds) * SEC;
    const at = (s: ApiRideStatus): number | null => {
      const idx = path.indexOf(s);
      return idx >= 0 ? stamps[idx] : null;
    };

    const method = spec.method ?? (r() < 0.12 ? "WALLET" : "CARD");
    const settled = ["COMPLETED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "PAYMENT_FAILED", "RATED", "CLOSED"].includes(spec.status);
    const actualDistance = settled ? distanceMeters * randFloat(r, 0.97, 1.1) : null;
    const actualSeconds = settled ? Math.round(tripSeconds * randFloat(r, 0.95, 1.2)) : null;
    const waiting = settled ? randInt(r, 0, 260) : 0;
    const discountMinor = spec.coupon ? 500 : 0;
    const breakdown = settled
      ? computeFare(rule, {
          distanceMeters: actualDistance ?? distanceMeters,
          durationSeconds: actualSeconds ?? tripSeconds,
          waitingSeconds: waiting,
          surgeMultiplierBps: surgeBps,
          discountMinor,
          couponCode: spec.coupon,
        })
      : null;
    const adjust = spec.adjustMinor ?? 0;
    const finalFare = breakdown ? breakdown.totalMinor + adjust : null;

    // Cancellation details
    let cancelFee = 0;
    let cancelCode: string | null = null;
    let cancelReason: string | null = null;
    let isNoShow = false;
    if (spec.status === "CANCELLED") {
      if (spec.cancelledBy === "RIDER") {
        cancelCode = "CHANGE_OF_PLANS";
        cancelReason = spec.cancelStage === "DRIVER_ASSIGNED" ? "Rider changed their plans after the captain accepted" : "Found another way to travel before a captain accepted";
        cancelFee = spec.cancelStage === "DRIVER_ASSIGNED" ? 300 : 0;
      } else if (spec.cancelledBy === "CAPTAIN") {
        cancelCode = "RIDER_NO_SHOW";
        cancelReason = "Rider did not show up within the 5 minute grace period";
        cancelFee = 500;
        isNoShow = true;
      } else if (spec.cancelledBy === "ADMIN") {
        cancelCode = "OPERATIONAL";
        cancelReason = "Cancelled by support at the rider's request (duplicate booking)";
      } else {
        cancelCode = "PAYMENT_AUTH_FAILED";
        cancelReason = "Card pre-authorization failed";
      }
    }

    const id = uuid(r);
    let ref = `AMG-${refCode(r)}`;
    while (usedBookingRefs.has(ref)) ref = `AMG-${refCode(r)}`;
    usedBookingRefs.add(ref);

    const rec: ApiRideRecord = {
      id,
      bookingRef: ref,
      riderId: rider.id,
      captainId: captain && path.includes("DRIVER_ASSIGNED") ? captain.d.id : null,
      cityId,
      status: spec.status,
      version: 0,
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      pickupAddress: pickup.address,
      pickupNotes: r() < 0.25 ? pick(r, ["Meet me at the north entrance", "Blue jacket, by the curb", "Please call when you arrive", "Waiting inside the lobby"]) : null,
      dropLat: drop.lat,
      dropLng: drop.lng,
      dropAddress: drop.address,
      estimatedDistanceMeters: Math.round(distanceMeters),
      estimatedDurationSeconds: tripSeconds,
      actualDistanceMeters: actualDistance === null ? null : Math.round(actualDistance),
      actualDurationSeconds: actualSeconds,
      waitingSeconds: waiting,
      currency: "USD",
      estimatedFareMinor: estimate.totalMinor,
      finalFareMinor: finalFare,
      fareBreakdown: breakdown,
      discountMinor,
      adminFareAdjustmentMinor: adjust,
      paymentMethod: method,
      paymentStatus: null,
      startPinAttempts: spec.pinAttempts ?? 0,
      scheduledFor: spec.scheduledInMin ? iso(now + spec.scheduledInMin * MIN) : null,
      requestedAt: iso(stamps[0]),
      assignedAt: at("DRIVER_ASSIGNED") ? iso(at("DRIVER_ASSIGNED") as number) : null,
      arrivedAt: at("DRIVER_ARRIVED") ? iso(at("DRIVER_ARRIVED") as number) : null,
      startedAt: at("RIDE_STARTED") ? iso(at("RIDE_STARTED") as number) : null,
      completedAt: at("COMPLETED") ? iso(at("COMPLETED") as number) : null,
      cancelledAt: at("CANCELLED") ? iso(at("CANCELLED") as number) : null,
      cancelledBy: spec.status === "CANCELLED" ? (spec.cancelledBy ?? "RIDER") : null,
      cancelReasonCode: cancelCode,
      cancelReason,
      cancellationFeeMinor: cancelFee,
      isNoShow,
      dispatchAttemptCount: 0,
      hasSosAlert: spec.sos ?? false,
      serviceType: { code: serviceType.code, name: serviceType.name },
    };

    // Payment
    let payment: ApiRidePayment | null = null;
    const amount = finalFare ?? estimate.totalMinor;
    if (["IN_PROGRESS", "RIDE_STARTED", "DRIVER_ARRIVED", "DRIVER_EN_ROUTE", "DRIVER_ASSIGNED"].includes(spec.status) && method !== "CASH") {
      payment = basePayment(method, "AUTHORIZED", amount, Math.round(amount * 1.2), 0, 0);
    } else if (settled) {
      const status = spec.status === "PAYMENT_FAILED" ? "FAILED" : spec.status === "COMPLETED" || spec.status === "PAYMENT_PENDING" ? "PROCESSING" : spec.refunded ? "PARTIALLY_REFUNDED" : "CAPTURED";
      payment = basePayment(method, status, amount, amount, status === "CAPTURED" || status === "PARTIALLY_REFUNDED" ? amount : 0, spec.refunded ? 800 : 0, spec.tipMinor ?? 0);
      if (status === "FAILED") {
        payment.failureCode = "card_declined";
        payment.failureMessage = "Your card was declined.";
        payment.attemptCount = 3;
      }
    }
    rec.paymentStatus = payment?.status ?? null;

    const row: RideRow = { rec, payment, attempts: [], events: [] };

    // Timeline
    const names = {
      rider: rider.name,
      captain: captain?.d.name ?? "Captain",
      service: serviceType.name,
      pickup: pickup.name,
      drop: drop.name,
      method,
    };
    const cancelActor: Actor =
      spec.cancelledBy === "RIDER" ? { realm: "RIDER", id: rider.id } : spec.cancelledBy === "CAPTAIN" ? { realm: "CAPTAIN", id: captain?.d.id ?? null } : spec.cancelledBy === "ADMIN" ? { realm: "STAFF", id: input.staff[1]?.id ?? null } : { realm: "SYSTEM", id: null };
    path.forEach((status, i) => {
      let actor: Actor = { realm: "SYSTEM", id: null };
      if (status === "REQUESTED" || status === "SCHEDULED" || status === "RATED") actor = { realm: "RIDER", id: rider.id };
      else if (["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "RIDE_STARTED", "COMPLETED"].includes(status)) actor = { realm: "CAPTAIN", id: captain?.d.id ?? null };
      else if (status === "CANCELLED") actor = cancelActor;
      appendEvent(row, status, stamps[i], actor, describe(status, { ...names, reason: cancelReason ?? undefined, cancelledBy: spec.cancelledBy?.toLowerCase() }));
    });
    row.rec.version = path.length;

    row.attempts = makeAttempts(spec, stamps[0], cityId, captains, rec.captainId ? captain : null, spec.status === "CANCELLED" && !rec.captainId ? "SEARCHING" : spec.status);
    rec.dispatchAttemptCount = row.attempts.length;
    rows.push(row);

    // Keep ON_RIDE captains consistent with their ride (position along the route, active ride id).
    if (captain && ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "RIDE_STARTED", "IN_PROGRESS"].includes(spec.status)) {
      captain.d.onRide = true;
      captain.d.availability = "ON_RIDE";
      captain.d.activeRideId = id;
      const frac = spec.status === "IN_PROGRESS" ? Math.min(0.85, 0.2 + spec.lastAgoMin / 35) : spec.status === "RIDE_STARTED" ? 0.05 : 0;
      if (spec.status === "DRIVER_ASSIGNED" || spec.status === "DRIVER_EN_ROUTE") {
        captain.lat = pickup.lat + randFloat(r, -0.012, 0.012);
        captain.lng = pickup.lng + randFloat(r, -0.012, 0.012);
      } else {
        captain.lat = pickup.lat + (drop.lat - pickup.lat) * frac;
        captain.lng = pickup.lng + (drop.lng - pickup.lng) * frac;
      }
    }
  }

  const incidents = seedIncidents(input, rows);
  return { rides: rows.sort((a, b) => new Date(b.rec.requestedAt).getTime() - new Date(a.rec.requestedAt).getTime()), incidents };
}

function basePayment(method: "CARD" | "WALLET" | "CASH", status: string, amount: number, authorized: number, captured: number, refunded: number, tip = 0): ApiRidePayment {
  return {
    id: uuid(r),
    method,
    provider: method === "CARD" ? "STRIPE" : method === "WALLET" ? "WALLET" : "CASH",
    status,
    amountMinor: amount,
    authorizedMinor: authorized,
    capturedMinor: captured,
    refundedMinor: refunded,
    tipMinor: tip,
    currency: "USD",
    failureCode: null,
    failureMessage: null,
    attemptCount: 1,
    capturedAt: captured > 0 ? iso(Date.now() - 3 * HOUR) : null,
  };
}

// ── Incidents ──

interface IncidentSpec {
  type: ApiIncidentType;
  severity: ApiIncidentSeverity;
  status: ApiIncidentStatus;
  realm: "RIDER" | "CAPTAIN";
  rideMatch: (row: RideRow) => boolean;
  createdAgoMs: number;
  ackAfterMs?: number;
  contactAfterMs?: number;
  assignee?: number;
  outcome?: string;
  description: string;
  battery: number | null;
  breached?: boolean;
  notes?: string[];
  resolvedAfterMs?: number;
}

const by = (idx: number, list: RideRow[], used: Set<string>, pred: (row: RideRow) => boolean): RideRow => {
  const found = list.find((row) => pred(row) && !used.has(row.rec.id)) ?? list.find((row) => !used.has(row.rec.id)) ?? list[idx % list.length];
  used.add(found.rec.id);
  return found;
};

function seedIncidents(input: OpsSeedInput, rows: RideRow[]): ApiIncidentDetail[] {
  const { now, riders, captains, staff } = input;
  const used = new Set<string>();
  const inProgress = (st: ApiRideStatus) => (row: RideRow) => row.rec.status === st;
  const staffAt = (i: number) => staff[Math.min(i, staff.length - 1)];

  const specs: IncidentSpec[] = [
    { type: "SOS", severity: "CRITICAL", status: "ACTIVE", realm: "RIDER", rideMatch: (x) => x.rec.status === "IN_PROGRESS" && x.rec.hasSosAlert, createdAgoMs: 15 * SEC, description: "Rider pressed the in-app SOS button during the trip.", battery: 34 },
    { type: "SOS", severity: "CRITICAL", status: "ACKNOWLEDGED", realm: "RIDER", rideMatch: (x) => x.rec.status === "COMPLETED" && x.rec.hasSosAlert, createdAgoMs: 14 * MIN, ackAfterMs: 40 * SEC, contactAfterMs: 3 * MIN, assignee: 1, description: "Rider triggered SOS after the captain took an unexpected route.", battery: 58, notes: ["Reached the rider by phone, she is safe and the trip has ended.", "Captain contacted; route change was due to a road closure. Monitoring."] },
    { type: "ROUTE_DEVIATION", severity: "MEDIUM", status: "ACTIVE", realm: "RIDER", rideMatch: inProgress("IN_PROGRESS"), createdAgoMs: 8 * MIN, description: "Vehicle left the planned corridor by more than 600 m for over 90 seconds.", battery: null },
    { type: "ACCIDENT", severity: "HIGH", status: "ACKNOWLEDGED", realm: "CAPTAIN", rideMatch: inProgress("CLOSED"), createdAgoMs: 3 * HOUR, ackAfterMs: 2 * MIN, contactAfterMs: 5 * MIN, assignee: 2, description: "Captain reported a minor rear-end collision at a red light. No injuries.", battery: 71, notes: ["Both parties exchanged insurance details. Photos requested from the captain."] },
    { type: "SOS", severity: "CRITICAL", status: "RESOLVED", realm: "RIDER", rideMatch: inProgress("CLOSED"), createdAgoMs: 26 * HOUR, ackAfterMs: 35 * SEC, contactAfterMs: 2 * MIN, assignee: 1, outcome: "SAFE_CONFIRMED", resolvedAfterMs: 22 * MIN, description: "SOS raised from a rider whose phone then lost signal.", battery: 22, notes: ["Rider confirmed safe and reached her destination."] },
    { type: "SOS", severity: "CRITICAL", status: "FALSE_ALARM", realm: "RIDER", rideMatch: inProgress("RATED"), createdAgoMs: 20 * HOUR, ackAfterMs: 28 * SEC, contactAfterMs: 90 * SEC, assignee: 2, outcome: "FALSE_ALARM", resolvedAfterMs: 6 * MIN, description: "SOS pressed by accident, rider cancelled within the grace window.", battery: 80 },
    { type: "SAFETY_REPORT", severity: "LOW", status: "RESOLVED", realm: "CAPTAIN", rideMatch: inProgress("CLOSED"), createdAgoMs: 30 * HOUR, ackAfterMs: 20 * MIN, assignee: 1, outcome: "OTHER", resolvedAfterMs: 3 * HOUR, description: "Captain reported a rider who refused to wear a seat belt.", battery: null },
    { type: "HARASSMENT", severity: "HIGH", status: "ACKNOWLEDGED", realm: "RIDER", rideMatch: inProgress("RATED"), createdAgoMs: 5 * HOUR, ackAfterMs: 4 * MIN, contactAfterMs: 15 * MIN, assignee: 2, description: "Rider reported inappropriate comments from the captain.", battery: null, notes: ["Rider interviewed. Captain placed on hold pending review."] },
    { type: "LOST_ITEM", severity: "LOW", status: "RESOLVED", realm: "RIDER", rideMatch: inProgress("RATED"), createdAgoMs: 28 * HOUR, ackAfterMs: 40 * MIN, assignee: 3, outcome: "OTHER", resolvedAfterMs: 5 * HOUR, description: "Rider left a laptop bag in the back seat.", battery: null },
    { type: "SOS", severity: "CRITICAL", status: "RESOLVED", realm: "CAPTAIN", rideMatch: inProgress("CLOSED"), createdAgoMs: 40 * HOUR, ackAfterMs: 95 * SEC, contactAfterMs: 4 * MIN, assignee: 2, outcome: "POLICE_DISPATCHED", resolvedAfterMs: 50 * MIN, breached: true, description: "Captain pressed SOS after an aggressive passenger refused to leave the vehicle.", battery: 46, notes: ["Police dispatched to the drop-off point.", "Passenger left the vehicle. Captain safe."] },
    { type: "ROUTE_DEVIATION", severity: "MEDIUM", status: "FALSE_ALARM", realm: "RIDER", rideMatch: inProgress("PAYMENT_COMPLETED"), createdAgoMs: 10 * HOUR, ackAfterMs: 3 * MIN, assignee: 1, outcome: "FALSE_ALARM", resolvedAfterMs: 12 * MIN, description: "Deviation alert caused by a highway on-ramp closure.", battery: null },
    { type: "OTHER", severity: "LOW", status: "RESOLVED", realm: "RIDER", rideMatch: inProgress("CLOSED"), createdAgoMs: 44 * HOUR, ackAfterMs: 50 * MIN, assignee: 3, outcome: "OTHER", resolvedAfterMs: 2 * HOUR, description: "Rider felt the vehicle was unclean and unsafe.", battery: null },
  ];

  return specs.map((spec, idx) => {
    const ride = by(idx, rows, used, spec.rideMatch);
    if (spec.type === "SOS") ride.rec.hasSosAlert = true;
    const rider = riders.find((x) => x.id === ride.rec.riderId) ?? riders[0];
    const captain = captains.find((c) => c.d.id === ride.rec.captainId) ?? null;
    const realm: ApiRealm = spec.realm;
    const triggererId = realm === "RIDER" ? rider.id : (captain?.d.id ?? rider.id);
    const createdAt = now - spec.createdAgoMs;
    const isSos = spec.type === "SOS";
    const ackDue = isSos ? createdAt + 60 * SEC : null;
    const ackAt = spec.ackAfterMs !== undefined ? createdAt + spec.ackAfterMs : null;
    const contactAt = spec.contactAfterMs !== undefined ? createdAt + spec.contactAfterMs : null;
    const resolvedAt = spec.resolvedAfterMs !== undefined ? createdAt + spec.resolvedAfterMs : null;
    const assignedTo = spec.assignee !== undefined ? staffAt(spec.assignee) : null;
    const lat = ride.rec.pickupLat + (ride.rec.dropLat - ride.rec.pickupLat) * 0.45;
    const lng = ride.rec.pickupLng + (ride.rec.dropLng - ride.rec.pickupLng) * 0.45;

    const events: ApiIncidentEvent[] = [
      { id: uuid(r), kind: "CREATED", actorRealm: realm, actorId: triggererId, body: spec.description, meta: { type: spec.type }, createdAt: iso(createdAt) },
      { id: uuid(r), kind: "ALERT_SENT", actorRealm: "SYSTEM", actorId: null, body: "Alerts sent to the safety desk and the rider's emergency contact.", meta: null, createdAt: iso(createdAt + 1 * SEC) },
    ];
    if (ackAt) events.push({ id: uuid(r), kind: "ACKNOWLEDGED", actorRealm: "STAFF", actorId: assignedTo?.id ?? null, body: null, meta: null, createdAt: iso(ackAt) });
    if (assignedTo && ackAt) events.push({ id: uuid(r), kind: "ASSIGNED", actorRealm: "STAFF", actorId: assignedTo.id, body: `Assigned to ${assignedTo.name}`, meta: { staffId: assignedTo.id }, createdAt: iso(ackAt + 2 * SEC) });
    if (contactAt) events.push({ id: uuid(r), kind: "CONTACTED", actorRealm: "STAFF", actorId: assignedTo?.id ?? null, body: "Called the triggering user.", meta: { party: "USER", outcome: "REACHED", method: "CALL" }, createdAt: iso(contactAt) });
    for (const [n, note] of (spec.notes ?? []).entries()) {
      events.push({ id: uuid(r), kind: "NOTE", actorRealm: "STAFF", actorId: assignedTo?.id ?? null, body: note, meta: null, createdAt: iso((contactAt ?? ackAt ?? createdAt) + (n + 1) * 2 * MIN) });
    }
    if (resolvedAt) events.push({ id: uuid(r), kind: "RESOLVED", actorRealm: "STAFF", actorId: assignedTo?.id ?? null, body: "Incident closed", meta: { outcomeCode: spec.outcome ?? "OTHER" }, createdAt: iso(resolvedAt) });
    events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const trail = Array.from({ length: 12 }, (_, i) => ({
      lat: ride.rec.pickupLat + (ride.rec.dropLat - ride.rec.pickupLat) * (0.2 + i * 0.022) + randFloat(r, -0.0004, 0.0004),
      lng: ride.rec.pickupLng + (ride.rec.dropLng - ride.rec.pickupLng) * (0.2 + i * 0.022) + randFloat(r, -0.0004, 0.0004),
      ts: createdAt - (12 - i) * 5 * SEC,
    }));
    const speed = spec.battery === null ? 9.6 : randFloat(r, 6, 17);
    const veh = captain?.d.vehicle;
    const emergency = rider.emergencyContacts.map((e) => ({ name: e.name, phone: e.phone, relation: e.relation }));
    const triggerer = realm === "RIDER" ? { realm, id: rider.id, name: rider.name, phone: rider.phone } : captain ? { realm, id: captain.d.id, name: captain.d.name, phone: captain.d.phone } : null;
    const counterparty = realm === "RIDER" ? (captain ? { realm: "CAPTAIN" as const, id: captain.d.id, name: captain.d.name, phone: captain.d.phone } : null) : { realm: "RIDER" as const, id: rider.id, name: rider.name, phone: rider.phone };
    const open = spec.status === "ACTIVE" || spec.status === "ACKNOWLEDGED";

    return {
      id: uuid(r),
      ref: `INC-${refCode(r)}`,
      type: spec.type,
      severity: spec.severity,
      status: spec.status,
      rideId: ride.rec.id,
      cityId: ride.rec.cityId,
      triggeredBy: { realm, id: triggererId },
      lat,
      lng,
      assignedStaffId: assignedTo?.id ?? null,
      acknowledgedAt: ackAt ? iso(ackAt) : null,
      firstContactAt: contactAt ? iso(contactAt) : null,
      ackDueAt: ackDue ? iso(ackDue) : null,
      contactDueAt: isSos ? iso(createdAt + 180 * SEC) : null,
      slaBreached: spec.breached ?? (isSos && spec.status === "ACTIVE" && ackDue !== null && ackDue < now),
      resolvedAt: resolvedAt ? iso(resolvedAt) : null,
      outcomeCode: spec.outcome ?? null,
      createdAt: iso(createdAt),
      updatedAt: iso(resolvedAt ?? contactAt ?? ackAt ?? createdAt),
      description: spec.description,
      batteryLevel: spec.battery,
      speedMps: spec.battery === null ? null : speed,
      snapshot: {
        capturedAt: iso(createdAt),
        trigger: { lat, lng, batteryLevel: spec.battery },
        ride: {
          id: ride.rec.id,
          bookingRef: ride.rec.bookingRef,
          status: ride.rec.status,
          cityId: ride.rec.cityId,
          pickup: ride.rec.pickupAddress ? { lat: ride.rec.pickupLat, lng: ride.rec.pickupLng, address: ride.rec.pickupAddress } : null,
          drop: ride.rec.dropAddress ? { lat: ride.rec.dropLat, lng: ride.rec.dropLng, address: ride.rec.dropAddress } : null,
        },
        rider: { id: rider.id, name: rider.name, ratingAvg: rider.rating, phone: rider.phone },
        captain: captain ? { id: captain.d.id, name: captain.d.name, ratingAvg: captain.d.metrics.rating, totalRides: captain.d.metrics.totalTrips, phone: captain.d.phone } : null,
        vehicle: veh ? { make: veh.make, model: veh.model, color: veh.color, plateNumber: veh.plateNumber, year: veh.year } : null,
        captainLastLocation: captain ? { lat, lng, speedMps: speed, heading: randInt(r, 0, 359), ts: createdAt } : null,
        recentLocations: trail,
      },
      events,
      liveLocation: open && captain ? { lat, lng, heading: randInt(r, 0, 359), ts: iso(now), etaSeconds: randInt(r, 180, 900), status: ride.rec.status } : null,
      contacts: { triggeredBy: triggerer, counterparty, emergencyContacts: emergency },
    };
  });
}

