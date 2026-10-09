/**
 * Demo realtime: no sockets. Emits the same events the `/admin` Socket.IO namespace would (`ops.snapshot`, `ride.state`,
 * and once per session an optional `sos.raised`) through the handler registry of the realtime client.
 */
import type { RideStateEvent } from "../adapters/rides";
import type { SosRaisedEvent } from "../adapters/safety";
import { buildSnapshot, moveCaptains } from "./logic/ops";
import { LIVE_STATUSES } from "./logic/ride";
import { createSosIncident, pickSosRide } from "./logic/sos";
import { getStore } from "./store";
import { iso, rng } from "./util";

/** Simulate one SOS shortly after entering the demo so the beacon / command modal can be seen. Set to false to disable. */
export const SIMULATE_SOS = true;
/** Delay before the simulated SOS is raised. */
export const SOS_DELAY_MS = 20_000;

const SNAPSHOT_EVERY_MS = 7_000;
const RIDE_STATE_EVERY_MS = 11_000;
const SOS_FLAG_KEY = "amoorgo.demo.sos";

type Emit = (event: string, payload: unknown) => void;

function sosAlreadyShown(): boolean {
  try {
    return window.sessionStorage.getItem(SOS_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function markSosShown(): void {
  try {
    window.sessionStorage.setItem(SOS_FLAG_KEY, "1");
  } catch {
    /* storage unavailable: the in-memory flag on the store still prevents a repeat within this page view */
  }
}

/** Starts the simulation; returns a function that stops every timer. */
export function startDemoRealtime(emit: Emit): () => void {
  const store = getStore();
  const timers: Array<ReturnType<typeof setInterval | typeof setTimeout>> = [];

  const emitSnapshots = () => {
    moveCaptains(store);
    const drift = Math.floor(rng() * 3) - 1;
    for (const city of store.cities) emit("ops.snapshot", buildSnapshot(store, city.id, drift));
    emit("ops.snapshot", buildSnapshot(store, null, drift));
  };

  const emitRideState = () => {
    const live = store.rides.filter((x) => LIVE_STATUSES.includes(x.rec.status));
    if (live.length === 0) return;
    const row = live[Math.floor(rng() * live.length)];
    const ev: RideStateEvent = {
      rideId: row.rec.id,
      bookingRef: row.rec.bookingRef,
      status: row.rec.status,
      uiState: row.rec.status,
      version: row.rec.version,
      captainId: row.rec.captainId,
      updatedAt: iso(Date.now()),
    };
    emit("ride.state", ev);
  };

  timers.push(setInterval(emitSnapshots, SNAPSHOT_EVERY_MS));
  timers.push(setInterval(emitRideState, RIDE_STATE_EVERY_MS));

  if (SIMULATE_SOS && !store.sosSimulated && !sosAlreadyShown()) {
    timers.push(
      setTimeout(() => {
        if (store.sosSimulated) return;
        const ride = pickSosRide(store);
        if (!ride) return;
        const incident = createSosIncident(store, ride);
        if (!incident) return;
        store.sosSimulated = true;
        markSosShown();
        const event: SosRaisedEvent = {
          id: incident.id,
          ref: incident.ref,
          type: incident.type,
          severity: incident.severity,
          status: incident.status,
          rideId: incident.rideId,
          cityId: incident.cityId,
          triggeredBy: incident.triggeredBy,
          lat: incident.lat,
          lng: incident.lng,
          assignedStaffId: incident.assignedStaffId,
          acknowledgedAt: incident.acknowledgedAt,
          firstContactAt: incident.firstContactAt,
          ackDueAt: incident.ackDueAt,
          contactDueAt: incident.contactDueAt,
          slaBreached: incident.slaBreached,
          resolvedAt: incident.resolvedAt,
          outcomeCode: incident.outcomeCode,
          createdAt: incident.createdAt,
          updatedAt: incident.updatedAt,
          bookingRef: ride.rec.bookingRef,
          description: incident.description,
          batteryLevel: incident.batteryLevel,
        };
        emit("sos.raised", event);
      }, SOS_DELAY_MS),
    );
  }

  return () => {
    for (const t of timers) {
      clearInterval(t);
      clearTimeout(t);
    }
  };
}

