"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { fetchAllPages } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useQuery } from "@/lib/hooks/useQuery";

/** City as returned by GET /admin/cities (fields the console uses). */
export interface City {
  id: string;
  name: string;
  state: string | null;
  country: string;
  timezone: string;
  currency: string;
  /** "MILE" | "KM" */
  distanceUnit: string;
  centerLat: number;
  centerLng: number;
  isActive: boolean;
  ridesEnabled: boolean;
}

interface CityContextValue {
  cities: City[];
  loading: boolean;
  /** Selected city id, or null for "All Cities" (within the staff member's city scope). */
  selectedCityId: string | null;
  selectedCity: City | null;
  setSelectedCityId: (id: string | null) => void;
  /** Display name for a city id (falls back to a short id when the city list is unavailable). */
  cityName: (id: string | null | undefined) => string;
  refetch: () => void;
}

const CityContext = createContext<CityContextValue | null>(null);

export function CityProvider({ children }: { children: React.ReactNode }) {
  const { can } = useAuth();
  // GET /admin/cities requires config.view; staff without it get an empty list (names fall back to ids).
  const allowed = can("config.view");
  const { data, loading, refetch } = useQuery<City[]>(allowed ? "cities" : null, (signal) => fetchAllPages<City>("/admin/cities", { signal }));
  const [selected, setSelected] = useState<string | null>(null);

  const cities = useMemo(() => data ?? [], [data]);
  const byId = useMemo(() => new Map(cities.map((c) => [c.id, c])), [cities]);
  const selectedCityId = selected && byId.has(selected) ? selected : null;

  const cityName = useCallback((id: string | null | undefined) => (id ? (byId.get(id)?.name ?? id.slice(0, 8)) : "—"), [byId]);

  const value = useMemo<CityContextValue>(
    () => ({
      cities,
      loading,
      selectedCityId,
      selectedCity: selectedCityId ? (byId.get(selectedCityId) ?? null) : null,
      setSelectedCityId: setSelected,
      cityName,
      refetch,
    }),
    [cities, loading, selectedCityId, byId, cityName, refetch],
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCities(): CityContextValue {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error("useCities must be used inside <CityProvider>");
  return ctx;
}
