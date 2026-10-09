"use client";

import { useEffect, useRef } from "react";

/**
 * Tiny cross-component invalidation bus. A mutation in one place (e.g. a drawer) calls `invalidate("rides")` and every
 * list that subscribed with `useOnInvalidate("rides", refetch)` reloads, without prop drilling.
 */
export type InvalidateTopic =
  | "rides"
  | "captains"
  | "kyc"
  | "second-chance"
  | "users"
  | "incidents"
  | "finance"
  | "config"
  | "staff"
  | "audit"
  | "dashboard";

const listeners = new Map<InvalidateTopic, Set<() => void>>();

export function invalidate(...topics: InvalidateTopic[]): void {
  // Every write is audited server-side, so the audit log is always stale after a mutation.
  const all = new Set<InvalidateTopic>([...topics, "audit", "dashboard"]);
  all.forEach((t) => listeners.get(t)?.forEach((l) => l()));
}

export function useOnInvalidate(topics: InvalidateTopic | InvalidateTopic[], callback: () => void): void {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  });
  const key = Array.isArray(topics) ? topics.join("|") : topics;
  useEffect(() => {
    const list = key.split("|") as InvalidateTopic[];
    const fn = () => ref.current();
    list.forEach((t) => {
      let set = listeners.get(t);
      if (!set) {
        set = new Set();
        listeners.set(t, set);
      }
      set.add(fn);
    });
    return () => list.forEach((t) => listeners.get(t)?.delete(fn));
  }, [key]);
}
