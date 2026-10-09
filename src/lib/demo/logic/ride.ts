/** Ride timeline helpers shared by the seed and the ride action handlers. */
import type { ApiRideStatus, ApiTimelineStep } from "../../adapters/rides";
import type { RideRow } from "../store";
import { iso } from "../util";

export const STEP_TITLES: Record<ApiRideStatus, string> = {
  REQUESTED: "Ride requested",
  SCHEDULED: "Ride scheduled",
  SEARCHING: "Searching for a captain",
  DRIVER_ASSIGNED: "Captain accepted",
  DRIVER_EN_ROUTE: "Captain on the way",
  DRIVER_ARRIVED: "Captain arrived at pickup",
  RIDE_STARTED: "Trip started",
  IN_PROGRESS: "Trip in progress",
  COMPLETED: "Trip completed",
  PAYMENT_PENDING: "Payment pending",
  PAYMENT_COMPLETED: "Payment captured",
  PAYMENT_FAILED: "Payment failed",
  RATED: "Ride rated",
  CLOSED: "Ride closed",
  CANCELLED: "Ride cancelled",
  NO_DRIVER_AVAILABLE: "No captain available",
};

export type Actor = { realm: string | null; id: string | null };

/** Appends a timeline step (latency measured from the previous one) and bumps the optimistic-lock version. */
export function appendEvent(row: RideRow, status: ApiRideStatus, ts: number, actor: Actor, description: string): ApiTimelineStep {
  const prev = row.events[row.events.length - 1];
  const prevTs = prev ? new Date(prev.timestamp).getTime() : ts;
  const step: ApiTimelineStep = {
    status,
    title: STEP_TITLES[status],
    timestamp: iso(ts),
    latencySeconds: Math.max(0, Math.round((ts - prevTs) / 1000)),
    description,
    actor,
  };
  row.events.push(step);
  row.rec.version += 1;
  return step;
}

export const LIVE_STATUSES: ApiRideStatus[] = ["REQUESTED", "SEARCHING", "DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "RIDE_STARTED", "IN_PROGRESS"];
export const WITH_CAPTAIN_ACTIVE: ApiRideStatus[] = ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "RIDE_STARTED", "IN_PROGRESS"];
