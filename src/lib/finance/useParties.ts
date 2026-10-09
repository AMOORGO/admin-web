"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { ApiRideDetailLite } from "@/lib/adapters/finance";

/**
 * Finance rows carry ids only (the API has no names on transactions / refunds). This resolves display names lazily from
 * the detail endpoints, cached for the page lifetime, with limited concurrency. Missing permission or a failed lookup
 * simply leaves the caller on its short-id fallback.
 */
export interface RideParty {
  ref: string;
  riderName: string;
  riderPhone: string;
  captainName: string | null;
}

type Entry<T> = T | "pending" | "failed";

const rides = new Map<string, Entry<RideParty>>();
const users = new Map<string, Entry<string>>();
const captains = new Map<string, Entry<string>>();

let version = 0;
const subscribers = new Set<() => void>();
const subscribe = (fn: () => void) => {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
};
const bump = () => {
  version += 1;
  subscribers.forEach((fn) => fn());
};

const MAX_CONCURRENT = 4;
const queue: Array<() => Promise<void>> = [];
let active = 0;
function pump() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift() as () => Promise<void>;
    active += 1;
    job().finally(() => {
      active -= 1;
      pump();
    });
  }
}

function request<T>(cache: Map<string, Entry<T>>, id: string, load: () => Promise<T>) {
  if (cache.has(id)) return;
  cache.set(id, "pending");
  queue.push(async () => {
    try {
      cache.set(id, await load());
    } catch {
      cache.set(id, "failed");
    }
    bump();
  });
  pump();
}

const ready = <T,>(e: Entry<T> | undefined): T | undefined => (e === undefined || e === "pending" || e === "failed" ? undefined : e);

export interface PartyLookup {
  ride: (id: string | null | undefined) => RideParty | undefined;
  user: (id: string | null | undefined) => string | undefined;
  captain: (id: string | null | undefined) => string | undefined;
}

export function useParties(want: { rides?: Array<string | null>; users?: Array<string | null>; captains?: Array<string | null> }): PartyLookup {
  useSyncExternalStore(subscribe, () => version, () => 0);
  const { can } = useAuth();
  const canRides = can("rides.view");
  const canUsers = can("users.view");
  const canCaptains = can("captains.view");
  const key = JSON.stringify([want.rides ?? [], want.users ?? [], want.captains ?? []]);

  useEffect(() => {
    const [r, u, c] = JSON.parse(key) as [Array<string | null>, Array<string | null>, Array<string | null>];
    if (canRides) {
      for (const id of r) {
        if (id)
          request(rides, id, async () => {
            const d = await api.get<ApiRideDetailLite>(`/admin/rides/${id}`);
            return { ref: d.ride.bookingRef, riderName: d.rider?.name ?? "", riderPhone: d.rider?.phone ?? "", captainName: d.captain?.name ?? null };
          });
      }
    }
    if (canUsers) {
      for (const id of u) if (id) request(users, id, async () => (await api.get<{ name: string }>(`/admin/users/${id}`)).name);
    }
    if (canCaptains) {
      for (const id of c) if (id) request(captains, id, async () => (await api.get<{ name: string }>(`/admin/captains/${id}`)).name);
    }
  }, [key, canRides, canUsers, canCaptains]);

  return {
    ride: (id) => (id ? ready(rides.get(id)) : undefined),
    user: (id) => (id ? ready(users.get(id)) : undefined),
    captain: (id) => (id ? ready(captains.get(id)) : undefined),
  };
}
