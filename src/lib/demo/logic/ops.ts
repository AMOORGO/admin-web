/** Live-ops derivations (snapshot counters, live map, captain movement) shared by REST handlers and the realtime simulation. */
import type { ApiLiveCluster, ApiLiveMap, ApiRideStatus, OpsSnapshot } from "../../adapters/rides";
import type { DemoStore } from "../store";
import { LIVE_STATUSES } from "./ride";
import { iso, randFloat, rng } from "../util";

const ONLINE_AVAILABILITY = new Set(["ONLINE", "ON_RIDE", "BUSY"]);

export const isOnline = (c: DemoStore["captains"][number]): boolean => c.d.status === "APPROVED" && ONLINE_AVAILABILITY.has(c.d.availability);

export function onlineCaptainCount(store: DemoStore, cityId: string | null): number {
  return store.captains.filter((c) => isOnline(c) && (!cityId || c.d.cityId === cityId)).length;
}

export function buildSnapshot(store: DemoStore, cityId: string | null, drift = 0): OpsSnapshot {
  const rides: Record<string, number> = {};
  for (const row of store.rides) {
    if (!LIVE_STATUSES.includes(row.rec.status)) continue;
    if (cityId && row.rec.cityId !== cityId) continue;
    rides[row.rec.status] = (rides[row.rec.status] ?? 0) + 1;
  }
  if (drift !== 0) {
    // Cosmetic wobble of the searching / on-trip counters so the console visibly "breathes".
    const bump = (s: ApiRideStatus) => {
      rides[s] = Math.max(0, (rides[s] ?? 0) + drift);
    };
    bump("SEARCHING");
    if (drift > 0) bump("IN_PROGRESS");
  }
  return { at: iso(Date.now()), cityId, onlineCaptains: Math.max(0, onlineCaptainCount(store, cityId) + drift), rides };
}

function clusterize(store: DemoStore, cityId: string): ApiLiveCluster[] {
  const cell = 0.014;
  const buckets = new Map<string, { lat: number; lng: number; ids: string[] }>();
  for (const c of store.captains) {
    if (!isOnline(c) || c.d.cityId !== cityId) continue;
    const key = `${Math.round(c.lat / cell)}:${Math.round(c.lng / cell)}`;
    const b = buckets.get(key) ?? { lat: 0, lng: 0, ids: [] };
    b.lat += c.lat;
    b.lng += c.lng;
    b.ids.push(c.d.id);
    buckets.set(key, b);
  }
  return [...buckets.values()].map((b) => ({ lat: b.lat / b.ids.length, lng: b.lng / b.ids.length, count: b.ids.length, captainIds: b.ids }));
}

export function buildLiveMap(store: DemoStore, cityId: string | null): ApiLiveMap {
  const cities = store.cities.filter((c) => !cityId || c.id === cityId);
  return {
    serverTime: iso(Date.now()),
    cities: cities.map((city) => {
      const rides = store.rides
        .filter((row) => row.rec.cityId === city.id && LIVE_STATUSES.includes(row.rec.status))
        .map((row) => ({
          id: row.rec.id,
          ref: row.rec.bookingRef,
          status: row.rec.status,
          pickup: [row.rec.pickupLat, row.rec.pickupLng] as [number, number],
          drop: [row.rec.dropLat, row.rec.dropLng] as [number, number],
          captainId: row.rec.captainId,
          sos: row.rec.hasSosAlert && row.rec.status === "IN_PROGRESS",
          at: new Date(row.events[row.events.length - 1]?.timestamp ?? row.rec.requestedAt).getTime(),
        }));
      return { cityId: city.id, rides, captains: { total: onlineCaptainCount(store, city.id), clusters: clusterize(store, city.id) } };
    }),
  };
}

/** Random-walk the online captains; captains on a trip creep towards their drop-off point. */
export function moveCaptains(store: DemoStore): void {
  for (const c of store.captains) {
    if (!isOnline(c)) continue;
    const ride = c.d.activeRideId ? store.rides.find((row) => row.rec.id === c.d.activeRideId) : undefined;
    if (ride && ride.rec.status === "IN_PROGRESS") {
      c.lat += (ride.rec.dropLat - c.lat) * 0.04 + randFloat(rng, -0.0002, 0.0002);
      c.lng += (ride.rec.dropLng - c.lng) * 0.04 + randFloat(rng, -0.0002, 0.0002);
    } else if (ride && (ride.rec.status === "DRIVER_EN_ROUTE" || ride.rec.status === "DRIVER_ASSIGNED")) {
      c.lat += (ride.rec.pickupLat - c.lat) * 0.06;
      c.lng += (ride.rec.pickupLng - c.lng) * 0.06;
    } else {
      c.lat += randFloat(rng, -0.0009, 0.0009);
      c.lng += randFloat(rng, -0.0009, 0.0009);
    }
  }
}
