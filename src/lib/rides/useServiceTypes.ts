"use client";

import { useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useQuery } from "@/lib/hooks/useQuery";
import { SERVICE_TYPE_FALLBACK } from "@/lib/adapters/rides";

interface ApiServiceType {
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

/** Service types for filters: GET /admin/service-types (needs config.view); falls back to the seeded catalogue. */
export function useServiceTypes(): Array<{ code: string; name: string }> {
  const { can } = useAuth();
  const q = useQuery<ApiServiceType[]>(can("config.view") ? "service-types" : null, (signal) => api.get<ApiServiceType[]>("/admin/service-types", { signal }));
  return useMemo(() => {
    if (!q.data || q.data.length === 0) return SERVICE_TYPE_FALLBACK;
    return [...q.data].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => ({ code: s.code, name: s.name }));
  }, [q.data]);
}
