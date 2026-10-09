"use client";

import { api, fetchAllPages } from "@/lib/api";
import { useQuery } from "@/lib/hooks/useQuery";
import { useOnInvalidate } from "@/lib/invalidate";
import type { ApiFeatureFlag, ApiZone } from "@/lib/adapters/pricing";

/** Zones of a city (bbox only; polygons are not returned in list rows). */
export function useZones(cityId: string | null) {
  const q = useQuery<ApiZone[]>(cityId ? `zones:${cityId}` : null, (signal) => fetchAllPages<ApiZone>("/admin/zones", { query: { cityId }, signal }));
  useOnInvalidate("config", q.refetch);
  return q;
}

/** Feature flags as effective for the scope (global when cityId is null). */
export function useFlags(cityId: string | null) {
  const q = useQuery<ApiFeatureFlag[]>(`flags:${cityId ?? "global"}`, (signal) =>
    api.get<ApiFeatureFlag[]>("/admin/feature-flags", { query: { cityId: cityId ?? undefined }, signal }),
  );
  useOnInvalidate("config", q.refetch);
  return q;
}
