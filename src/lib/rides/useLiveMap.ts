"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useQuery, type QueryResult } from "@/lib/hooks/useQuery";
import { useOnInvalidate } from "@/lib/invalidate";
import { useOpsRoom, useRealtimeStatus, useSocketEvent } from "@/lib/realtime";
import { toLiveMapData, type ApiLiveMap, type LiveMapData, type OpsSnapshot, type RideStateEvent } from "@/lib/adapters/rides";

/** A `ride.state` hint plus the time we received it (so stale hints can expire once REST has caught up). */
export interface RideStateOverride extends RideStateEvent {
  receivedAt: number;
}

const OVERRIDE_TTL_MS = 30_000;

/**
 * Collects `ride.state` socket events. Calls `onEvent` (debounced by the caller) and returns the latest hint per ride for
 * the last 30 s, which views overlay on their REST data for instant feedback.
 */
export function useRideStateFeed(onEvent?: (ev: RideStateEvent) => void): Record<string, RideStateOverride> {
  const [overrides, setOverrides] = useState<Record<string, RideStateOverride>>({});
  useSocketEvent<RideStateEvent>("ride.state", (ev) => {
    if (!ev || typeof ev.rideId !== "string") return;
    setOverrides((prev) => {
      const cur = prev[ev.rideId];
      if (cur && cur.version > ev.version) return prev;
      return { ...prev, [ev.rideId]: { ...ev, receivedAt: Date.now() } };
    });
    onEvent?.(ev);
  });
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - OVERRIDE_TTL_MS;
      setOverrides((prev) => {
        const keys = Object.keys(prev);
        const keep = keys.filter((k) => prev[k].receivedAt >= cutoff);
        if (keep.length === keys.length) return prev;
        return Object.fromEntries(keep.map((k) => [k, prev[k]]));
      });
    }, 10_000);
    return () => clearInterval(id);
  }, []);
  return overrides;
}

/** Debounced trigger: many events within `ms` cause a single call. */
export function useDebouncedCallback(fn: () => void, ms: number): () => void {
  const fnRef = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      fnRef.current();
    }, ms);
  }, [ms]);
}

export interface LiveMapState extends QueryResult<LiveMapData> {
  /** True while the `/admin` socket is connected (REST polling slows down; otherwise it is the fallback). */
  socketLive: boolean;
}

/**
 * GET /admin/live/map for the selected city (or all permitted cities). Joins the ops room, refetches shortly after
 * `ride.state` events and polls every 5 s while the socket is down (30 s as a safety net while it is up).
 */
export function useLiveMap(cityId: string | null, enabled = true): LiveMapState {
  const status = useRealtimeStatus();
  const socketLive = status === "connected";
  useOpsRoom(cityId, enabled);
  const q = useQuery<LiveMapData>(
    enabled ? `live-map:${cityId ?? "all"}` : null,
    async (signal) => toLiveMapData(await api.get<ApiLiveMap>("/admin/live/map", { query: { cityId }, signal })),
    { pollMs: socketLive ? 30_000 : 5_000 },
  );
  const refetchSoon = useDebouncedCallback(q.refetch, 800);
  useRideStateFeed(refetchSoon);
  useOnInvalidate("rides", q.refetch);
  return { ...q, socketLive };
}

/**
 * Live counters (online captains, rides per status): GET /admin/ops/snapshot for first paint / fallback polling and the
 * `ops.snapshot` socket event for pushes. Keeps whichever of the two is newest.
 */
export function useOpsSnapshot(cityId: string | null, enabled = true): OpsSnapshot | null {
  const socketLive = useRealtimeStatus() === "connected";
  useOpsRoom(cityId, enabled);
  const q = useQuery<OpsSnapshot>(
    enabled ? `ops-snapshot:${cityId ?? "all"}` : null,
    (signal) => api.get<OpsSnapshot>("/admin/ops/snapshot", { query: { cityId }, signal }),
    { pollMs: socketLive ? 60_000 : 10_000 },
  );
  useOnInvalidate("rides", q.refetch);
  const [pushed, setPushed] = useState<OpsSnapshot | null>(null);
  useSocketEvent<OpsSnapshot>("ops.snapshot", (s) => {
    // the "all" room also receives every city's snapshot: keep only the one that matches the current filter
    if (s && (s.cityId ?? null) === cityId) setPushed(s);
  });
  const rest = q.data && (q.data.cityId ?? null) === cityId ? q.data : null;
  const push = pushed && (pushed.cityId ?? null) === cityId ? pushed : null;
  return push && (!rest || push.at >= rest.at) ? push : rest;
}
