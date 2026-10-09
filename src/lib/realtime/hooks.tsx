"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { realtime, type ConnectionState } from "./client";

/** Starts the staff socket while mounted (mount once, below the auth gate). */
export function useRealtimeLifecycle(): void {
  useEffect(() => {
    realtime.start();
    return () => realtime.stop();
  }, []);
}

/** Live connection state of the `/admin` socket. */
export function useRealtimeStatus(): ConnectionState {
  return useSyncExternalStore(realtime.subscribe, realtime.getState, () => "idle" as ConnectionState);
}

/** Subscribe to a server event for the lifetime of the component. The handler may change between renders. */
export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => realtime.on(event, (p) => ref.current(p as T)), [event]);
}

/** Join the live-ops room (all cities when cityId is null/undefined) to receive `ops.snapshot` and `ride.state`. */
export function useOpsRoom(cityId: string | null | undefined, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    return realtime.join({ event: "ops.join", payload: cityId ? { cityId } : {} });
  }, [cityId, enabled]);
}

/** Join a single ride's room (`ride.state`, chat, location) while mounted. */
export function useRideRoom(rideId: string | null | undefined): void {
  useEffect(() => {
    if (!rideId) return;
    return realtime.join({ event: "ride.join", payload: { rideId } });
  }, [rideId]);
}
