/**
 * Seed: 30 days of completed (and a few cancelled) trips for every approved captain, so captain profiles, earnings and
 * the dashboard revenue trend have believable depth. Volumes follow a weekday pattern (busy Fri / Sat, quiet Sun) and
 * each captain has their own intensity. Appended after the finance seed: these rides carry a payment record but no
 * ledger postings (the ledger tab keeps its curated sample).
 */
import type { ApiPricingRule, ApiCityFull, ApiServiceType } from "../../adapters/pricing";
import type { ApiRidePayment, ApiRideRecord, ApiRideStatus } from "../../adapters/rides";
import type { ApiUserDetail } from "../../adapters/users";
import type { CaptainRow, RideRow } from "../store";
import { computeFare } from "../logic/fare";
import { appendEvent, type Actor } from "../logic/ride";
import { localWeekday, startOfLocalDay, startOfLocalDayAgo } from "../logic/time";
import { DAY, HOUR, MIN, SEC, haversineMeters, iso, mulberry32, pick, randFloat, randInt, refCode, uuid } from "../util";
import { POIS } from "./ops";

const r = mulberry32(808);

/** Volume multiplier per weekday (0 = Sunday). */
const WEEKDAY_FACTOR = [0.78, 0.9, 0.95, 1.0, 1.05, 1.35, 1.45];
/** Relative demand per hour of day (index = hour); commute and evening peaks. */
const HOUR_WEIGHT = [1, 0.5, 0.4, 0.3, 0.4, 0.8, 1.6, 3, 3.4, 2.4, 1.8, 2, 2.4, 2.2, 2, 2.2, 2.8, 3.6, 3.8, 3.2, 2.8, 2.4, 2, 1.4];

function pickHour(): number {
  const total = HOUR_WEIGHT.reduce((a, b) => a + b, 0);
  let x = r() * total;
  for (let h = 0; h < 24; h++) {
    x -= HOUR_WEIGHT[h];
    if (x <= 0) return h;
  }
  return 18;
}

export interface HistoryInput {
  now: number;
  cities: ApiCityFull[];
  serviceTypes: ApiServiceType[];
  rules: ApiPricingRule[];
  riders: ApiUserDetail[];
  captains: CaptainRow[];
  usedRefs: Set<string>;
}

function activeRule(rules: ApiPricingRule[], cityId: string, serviceTypeId: string): ApiPricingRule {
  const list = rules.filter((x) => x.cityId === cityId && x.serviceTypeId === serviceTypeId && x.isActive).sort((a, b) => b.version - a.version);
  return list[0] ?? rules[0];
}

export function seedHistory(input: HistoryInput): RideRow[] {
  const { now, cities, serviceTypes, rules, riders, captains, usedRefs } = input;
  const activeRiders = riders.filter((x) => x.status === "ACTIVE" && x.profileComplete);
  const rows: RideRow[] = [];
  const todayStart = startOfLocalDay(now);
  const minutesToday = Math.floor((now - todayStart) / MIN);
  // Share of the day's demand that has already happened (rides before ~6am are rare, demand peaks in the evening).
  const dayFraction = Math.min(1, Math.max(0.05, (minutesToday / 60 - 5) / 17));

  captains.forEach((cap, capIndex) => {
    if (cap.d.status !== "APPROVED") return;
    const cityIdx = Math.max(0, cities.findIndex((c) => c.id === cap.d.cityId));
    const cityId = cities[cityIdx].id;
    const pois = POIS[cityIdx] ?? POIS[0];
    const online = cap.d.availability !== "OFFLINE";
    // Per-captain intensity: 2..5 trips on an average day; part-timers (offline now) drive less.
    const intensity = (2.2 + ((capIndex * 7) % 11) / 4) * (online ? 1 : 0.55);
    const serviceCode = cap.d.serviceTypes.find((s) => s.enabled)?.code ?? "AMOOR_GO";
    const serviceType = serviceTypes.find((s) => s.code === serviceCode) ?? serviceTypes[0];
    const rule = activeRule(rules, cityId, serviceType.id);

    for (let back = 0; back < 30; back++) {
      const dayStart = back === 0 ? todayStart : startOfLocalDayAgo(now, back);
      const weekday = localWeekday(dayStart + 12 * HOUR);
      let count: number;
      if (back === 0) {
        // today: only captains who are working, proportional to how much of the day has passed (but never nothing)
        count = online ? Math.max(minutesToday > 15 ? 2 : 0, Math.round(intensity * WEEKDAY_FACTOR[weekday] * dayFraction * (0.8 + r() * 0.4))) : 0;
      } else if (r() < 0.04) {
        count = 0; // a day off
      } else {
        count = Math.max(0, Math.round(intensity * WEEKDAY_FACTOR[weekday] * (0.7 + r() * 0.6)));
      }

      for (let k = 0; k < count; k++) {
        let completedAt: number;
        if (back === 0) {
          const latest = now - 6 * MIN;
          const span = Math.max(1, latest - todayStart - 20 * MIN);
          completedAt = todayStart + 20 * MIN + Math.floor(r() * span);
          if (completedAt > latest) completedAt = latest;
        } else {
          completedAt = dayStart + pickHour() * HOUR + randInt(r, 0, 59) * MIN;
          if (completedAt > now - 6 * MIN) completedAt = dayStart + 12 * HOUR;
        }
        rows.push(buildRide({ completedAt, now, cityId, pois, cap, serviceType, rule, rider: pick(r, activeRiders), usedRefs, cancelled: r() < 0.05 }));
      }
    }
  });

  return rows;
}

function buildRide(p: {
  completedAt: number;
  now: number;
  cityId: string;
  pois: (typeof POIS)[number];
  cap: CaptainRow;
  serviceType: ApiServiceType;
  rule: ApiPricingRule;
  rider: ApiUserDetail;
  usedRefs: Set<string>;
  cancelled: boolean;
}): RideRow {
  const { completedAt, now, cityId, pois, cap, serviceType, rule, rider, usedRefs, cancelled } = p;
  const pickup = pick(r, pois);
  let drop = pick(r, pois);
  while (drop === pickup) drop = pick(r, pois);
  const distanceMeters = Math.max(1800, haversineMeters([pickup.lat, pickup.lng], [drop.lat, drop.lng]) * 1.28);
  const tripSeconds = Math.round(distanceMeters / randFloat(r, 7, 10) + 90);
  const surgeBps = r() < 0.14 ? pick(r, [12500, 15000]) : 10000;
  const method = r() < 0.12 ? "CASH" : r() < 0.15 ? "WALLET" : "CARD";
  const waiting = randInt(r, 0, 200);
  const breakdown = computeFare(rule, { distanceMeters, durationSeconds: tripSeconds, waitingSeconds: waiting, surgeMultiplierBps: surgeBps });

  const ageMs = now - completedAt;
  const status: ApiRideStatus = cancelled ? "CANCELLED" : ageMs < 2 * HOUR ? "PAYMENT_COMPLETED" : ageMs < DAY ? "RATED" : "CLOSED";

  let ref = `AMG-${refCode(r)}`;
  while (usedRefs.has(ref)) ref = `AMG-${refCode(r)}`;
  usedRefs.add(ref);

  const startedAt = completedAt - tripSeconds * SEC;
  const arrivedAt = startedAt - randInt(r, 120, 360) * SEC;
  const enRouteAt = arrivedAt - randInt(r, 200, 540) * SEC;
  const assignedAt = enRouteAt - 6 * SEC;
  const searchingAt = assignedAt - randInt(r, 9, 45) * SEC;
  const requestedAt = searchingAt - 2 * SEC;
  const id = uuid(r);

  const tip = !cancelled && method !== "CASH" && r() < 0.24 ? pick(r, [100, 200, 300, 500]) : 0;
  const cancelFee = cancelled ? 300 : 0;

  const rec: ApiRideRecord = {
    id,
    bookingRef: ref,
    riderId: rider.id,
    captainId: cap.d.id,
    cityId,
    status,
    version: 0,
    pickupLat: pickup.lat,
    pickupLng: pickup.lng,
    pickupAddress: pickup.address,
    pickupNotes: null,
    dropLat: drop.lat,
    dropLng: drop.lng,
    dropAddress: drop.address,
    estimatedDistanceMeters: Math.round(distanceMeters),
    estimatedDurationSeconds: tripSeconds,
    actualDistanceMeters: cancelled ? null : Math.round(distanceMeters * randFloat(r, 0.97, 1.08)),
    actualDurationSeconds: cancelled ? null : Math.round(tripSeconds * randFloat(r, 0.95, 1.15)),
    waitingSeconds: cancelled ? 0 : waiting,
    currency: "USD",
    estimatedFareMinor: breakdown.totalMinor,
    finalFareMinor: cancelled ? null : breakdown.totalMinor,
    fareBreakdown: cancelled ? null : breakdown,
    discountMinor: 0,
    adminFareAdjustmentMinor: 0,
    paymentMethod: method,
    paymentStatus: cancelled ? null : "CAPTURED",
    startPinAttempts: 0,
    scheduledFor: null,
    requestedAt: iso(requestedAt),
    assignedAt: iso(assignedAt),
    arrivedAt: iso(arrivedAt),
    startedAt: cancelled ? null : iso(startedAt),
    completedAt: cancelled ? null : iso(completedAt),
    cancelledAt: cancelled ? iso(completedAt) : null,
    cancelledBy: cancelled ? "RIDER" : null,
    cancelReasonCode: cancelled ? "CHANGE_OF_PLANS" : null,
    cancelReason: cancelled ? "Rider changed their plans after the captain accepted" : null,
    cancellationFeeMinor: cancelFee,
    isNoShow: false,
    dispatchAttemptCount: 1,
    hasSosAlert: false,
    serviceType: { code: serviceType.code, name: serviceType.name },
  };

  const payment: ApiRidePayment | null = cancelled
    ? null
    : {
        id: uuid(r),
        method,
        provider: method === "CARD" ? "STRIPE" : method === "WALLET" ? "WALLET" : "CASH",
        status: "CAPTURED",
        amountMinor: breakdown.totalMinor,
        authorizedMinor: breakdown.totalMinor,
        capturedMinor: breakdown.totalMinor,
        refundedMinor: 0,
        tipMinor: tip,
        currency: "USD",
        failureCode: null,
        failureMessage: null,
        attemptCount: 1,
        capturedAt: iso(completedAt + 4 * SEC),
      };

  const row: RideRow = { rec, payment, attempts: [], events: [] };
  const rd: Actor = { realm: "RIDER", id: rider.id };
  const cp: Actor = { realm: "CAPTAIN", id: cap.d.id };
  const sys: Actor = { realm: "SYSTEM", id: null };
  appendEvent(row, "REQUESTED", requestedAt, rd, `${rider.name} requested ${serviceType.name} from ${pickup.name}.`);
  appendEvent(row, "SEARCHING", searchingAt, sys, "Dispatch is matching nearby captains within a 5 mile radius.");
  appendEvent(row, "DRIVER_ASSIGNED", assignedAt, cp, `${cap.d.name} accepted the offer.`);
  appendEvent(row, "DRIVER_EN_ROUTE", enRouteAt, cp, `${cap.d.name} is heading to the pickup point.`);
  appendEvent(row, "DRIVER_ARRIVED", arrivedAt, cp, `${cap.d.name} arrived at ${pickup.name}. Rider notified.`);
  if (cancelled) {
    appendEvent(row, "CANCELLED", completedAt, rd, "Cancelled by rider: Rider changed their plans after the captain accepted");
  } else {
    appendEvent(row, "RIDE_STARTED", startedAt, cp, "Trip PIN verified in the captain app. Ride started.");
    appendEvent(row, "COMPLETED", completedAt, cp, `Trip ended at ${drop.name}.`);
    appendEvent(row, "PAYMENT_PENDING", completedAt + SEC, sys, `Payment capture started (${method}).`);
    appendEvent(row, "PAYMENT_COMPLETED", completedAt + 4 * SEC, sys, method === "CASH" ? "Cash collected by the captain." : "Payment captured and ledger entries posted.");
    if (status === "RATED" || status === "CLOSED") appendEvent(row, "RATED", completedAt + randInt(r, 120, 1500) * SEC, rd, `${rider.name} rated the trip.`);
    if (status === "CLOSED") appendEvent(row, "CLOSED", completedAt + randInt(r, 1800, 3600) * SEC, sys, "Ride closed and settled to the captain.");
  }
  row.rec.version = row.events.length;
  return row;
}

