/** Creates a fresh SOS incident for the (optional) one-off realtime simulation. */
import type { ApiIncidentDetail } from "../../adapters/safety";
import type { DemoStore, RideRow } from "../store";
import { captainById, riderById } from "../store";
import { SEC, iso, randFloat, randInt, refCode, rng, uuid } from "../util";

export function pickSosRide(store: DemoStore): RideRow | null {
  const live = store.rides.filter((x) => x.rec.status === "IN_PROGRESS" && !x.rec.hasSosAlert && x.rec.captainId);
  return live[0] ?? store.rides.find((x) => x.rec.captainId && ["RIDE_STARTED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED"].includes(x.rec.status)) ?? null;
}

export function createSosIncident(store: DemoStore, ride: RideRow): ApiIncidentDetail | null {
  const rider = riderById(store, ride.rec.riderId);
  const captain = captainById(store, ride.rec.captainId);
  if (!rider) return null;
  const now = Date.now();
  const lat = captain?.lat ?? ride.rec.pickupLat;
  const lng = captain?.lng ?? ride.rec.pickupLng;
  const veh = captain?.d.vehicle ?? null;
  ride.rec.hasSosAlert = true;
  const createdAt = iso(now);
  const incident: ApiIncidentDetail = {
    id: uuid(),
    ref: `INC-${refCode(rng)}`,
    type: "SOS",
    severity: "CRITICAL",
    status: "ACTIVE",
    rideId: ride.rec.id,
    cityId: ride.rec.cityId,
    triggeredBy: { realm: "RIDER", id: rider.id },
    lat,
    lng,
    assignedStaffId: null,
    acknowledgedAt: null,
    firstContactAt: null,
    ackDueAt: iso(now + 60 * SEC),
    contactDueAt: iso(now + 180 * SEC),
    slaBreached: false,
    resolvedAt: null,
    outcomeCode: null,
    createdAt,
    updatedAt: createdAt,
    description: "Rider pressed the in-app SOS button during the trip.",
    batteryLevel: randInt(rng, 20, 70),
    speedMps: randFloat(rng, 7, 15),
    snapshot: {
      capturedAt: createdAt,
      trigger: { lat, lng, batteryLevel: 41 },
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
      captainLastLocation: captain ? { lat, lng, speedMps: 9.8, heading: randInt(rng, 0, 359), ts: now } : null,
      recentLocations: Array.from({ length: 10 }, (_, i) => ({
        lat: lat - (10 - i) * 0.0004 + randFloat(rng, -0.0001, 0.0001),
        lng: lng - (10 - i) * 0.0005 + randFloat(rng, -0.0001, 0.0001),
        ts: now - (10 - i) * 5 * SEC,
      })),
    },
    events: [
      { id: uuid(), kind: "CREATED", actorRealm: "RIDER", actorId: rider.id, body: "Rider pressed the in-app SOS button during the trip.", meta: { type: "SOS" }, createdAt },
      { id: uuid(), kind: "ALERT_SENT", actorRealm: "SYSTEM", actorId: null, body: "Alerts sent to the safety desk and the rider's emergency contact.", meta: null, createdAt: iso(now + SEC) },
    ],
    liveLocation: captain ? { lat, lng, heading: randInt(rng, 0, 359), ts: createdAt, etaSeconds: randInt(rng, 240, 900), status: ride.rec.status } : null,
    contacts: {
      triggeredBy: { realm: "RIDER", id: rider.id, name: rider.name, phone: rider.phone },
      counterparty: captain ? { realm: "CAPTAIN", id: captain.d.id, name: captain.d.name, phone: captain.d.phone } : null,
      emergencyContacts: rider.emergencyContacts.map((e) => ({ name: e.name, phone: e.phone, relation: e.relation })),
    },
  };
  store.incidents.unshift(incident);
  return incident;
}
