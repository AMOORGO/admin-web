"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SOSIncident } from "@/types";
import { api } from "@/lib/api";
import {
  compareUrgency,
  isOpen,
  slaSecondsLeft,
  toIncident,
  type ApiIncidentSummary,
  type IncidentUpdatedEvent,
  type SosRaisedEvent,
} from "@/lib/adapters/safety";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCities } from "@/lib/cities/CityProvider";
import { useToast } from "@/components/ui/Toast";
import { useQuery } from "@/lib/hooks/useQuery";
import { useOnInvalidate } from "@/lib/invalidate";
import { useRealtimeStatus, useSocketEvent } from "@/lib/realtime";

export interface SosAlerts {
  /** The most urgent open (unacknowledged) SOS, shown in the navbar beacon. */
  activeIncident: SOSIncident | null;
  /** Number of open incidents (sidebar badge). */
  openCount: number;
}

const MAX_OVERLAY = 200;

/**
 * Open incidents from REST (initial load, slow reconcile poll, fast poll while the socket is down) merged with the
 * `sos.raised` / `incident.updated` socket events. The SLA countdown is derived from `ackDueAt` and re-evaluated by an
 * interval callback only while an unacknowledged SOS is waiting.
 */
export function useSosAlerts(): SosAlerts {
  const { can, cityScope } = useAuth();
  const { cityName } = useCities();
  const toast = useToast();
  const allowed = can("safety.manage");
  const connected = useRealtimeStatus() === "connected";

  const open = useQuery<ApiIncidentSummary[]>(
    allowed ? "sos-open-incidents" : null,
    async (signal) => {
      const [active, acked] = await Promise.all([
        api.getPage<ApiIncidentSummary>("/admin/incidents", { query: { status: "ACTIVE", limit: 100 }, signal }),
        api.getPage<ApiIncidentSummary>("/admin/incidents", { query: { status: "ACKNOWLEDGED", limit: 100 }, signal }),
      ]);
      return [...active.items, ...acked.items];
    },
    // Socket up: events carry the changes, REST only reconciles. Socket down: poll quickly so an SOS is never missed.
    { pollMs: connected ? 60_000 : 15_000 },
  );
  useOnInvalidate("incidents", open.refetch);
  const { refetch } = open;

  // Socket events newer than the last REST snapshot, keyed by incident id.
  const [overlay, setOverlay] = useState<Record<string, ApiIncidentSummary>>({});
  const [now, setNow] = useState<number>(() => Date.now());
  const known = useRef<Set<string>>(new Set());

  const inScope = useCallback((i: ApiIncidentSummary) => cityScope.length === 0 || i.cityId === null || cityScope.includes(i.cityId), [cityScope]);

  const apply = useCallback((i: ApiIncidentSummary) => {
    setOverlay((prev) => {
      const next = { ...prev, [i.id]: i };
      const ids = Object.keys(next);
      if (ids.length > MAX_OVERLAY) {
        // Drop the oldest closed entries first; they are already gone from the REST open list.
        ids
          .filter((id) => !isOpen(next[id]))
          .sort((a, b) => new Date(next[a].updatedAt).getTime() - new Date(next[b].updatedAt).getTime())
          .slice(0, ids.length - MAX_OVERLAY)
          .forEach((id) => delete next[id]);
      }
      return next;
    });
  }, []);

  useSocketEvent<SosRaisedEvent>("sos.raised", (p) => {
    if (!allowed || !p || !p.id || !inScope(p)) return;
    apply(p);
    setNow(Date.now());
    if (!known.current.has(p.id)) {
      known.current.add(p.id);
      if (p.status === "ACTIVE") toast.error(`New SOS ${p.ref}${p.cityId ? ` in ${cityName(p.cityId)}` : ""}: acknowledge it now.`);
    }
    refetch();
  });

  useSocketEvent<IncidentUpdatedEvent>("incident.updated", (p) => {
    if (!allowed || !p || !p.id || !inScope(p)) return;
    apply(p);
    setNow(Date.now());
    if (!known.current.has(p.id)) {
      known.current.add(p.id);
      // A new safety report (not an SOS) arrives as an update; mention it quietly.
      if (p.change === "REPORTED") toast.error(`New safety report ${p.ref}.`);
    }
  });

  // Ids already announced (initial load must not toast).
  useEffect(() => {
    open.data?.forEach((i) => known.current.add(i.id));
  }, [open.data]);

  const merged = useMemo(() => {
    const map = new Map<string, ApiIncidentSummary>();
    for (const i of open.data ?? []) map.set(i.id, i);
    for (const o of Object.values(overlay)) {
      const cur = map.get(o.id);
      if (!cur || new Date(o.updatedAt).getTime() >= new Date(cur.updatedAt).getTime()) map.set(o.id, o);
    }
    return [...map.values()].filter((i) => isOpen(i) && inScope(i));
  }, [open.data, overlay, inScope]);

  const urgent = useMemo(() => merged.filter((i) => i.type === "SOS" && i.status === "ACTIVE").sort(compareUrgency)[0] ?? null, [merged]);

  // Tick once a second only while an SLA countdown is visibly running.
  const ticking = urgent !== null && slaSecondsLeft(urgent, now) > 0;
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  const activeIncident = useMemo(() => (urgent ? toIncident(urgent, { now, cityName }) : null), [urgent, now, cityName]);

  if (!allowed) return { activeIncident: null, openCount: 0 };
  return { activeIncident, openCount: merged.length };
}
