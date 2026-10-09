"use client";

import { useMemo } from "react";
import { api } from "@/lib/api";
import type { ApiCaptainDetail } from "@/lib/adapters/captains";
import { toEarningsOverview, type ApiEarningsOverview, type EarningsOverviewView } from "@/lib/adapters/captainEarnings";
import type { ApiAuditEntry } from "@/lib/adapters/audit";
import type { ApiRideListItem } from "@/lib/adapters/rides";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCursorList, useQuery, type CursorListResult, type QueryResult } from "./useQuery";
import { useOnInvalidate } from "@/lib/invalidate";

/** GET /admin/captains/:id (profile, vehicles, documents, checklist, metrics). */
export function useCaptainDetail(captainId: string): QueryResult<ApiCaptainDetail> {
  const q = useQuery<ApiCaptainDetail>(`captain-detail:${captainId}`, (signal) => api.get<ApiCaptainDetail>(`/admin/captains/${captainId}`, { signal }));
  useOnInvalidate(["captains", "kyc"], q.refetch);
  return q;
}

export interface CaptainEarningsState {
  /** True when the signed-in role lacks `finance.view`: the money cards are hidden instead of erroring. */
  forbidden: boolean;
  query: QueryResult<EarningsOverviewView>;
}

/**
 * GET /admin/captains/:id/earnings/overview. Skipped entirely without `finance.view`; a 403 from the API is treated the same way.
 */
export function useCaptainEarnings(captainId: string): CaptainEarningsState {
  const { can } = useAuth();
  const allowed = can("finance.view");
  const query = useQuery<EarningsOverviewView>(allowed ? `captain-earnings:${captainId}` : null, async (signal) => {
    const dto = await api.get<ApiEarningsOverview>(`/admin/captains/${captainId}/earnings/overview`, { signal });
    return toEarningsOverview(dto);
  });
  useOnInvalidate(["finance", "rides"], query.refetch);
  const forbidden = !allowed || (query.error?.isForbidden ?? false);
  return { forbidden, query };
}

/** The captain's rides via the rides list endpoint (needs `rides.view`). */
export function useCaptainTrips(captainId: string, enabled: boolean): CursorListResult<ApiRideListItem> & { forbidden: boolean } {
  const { can } = useAuth();
  const allowed = can("rides.view");
  const query = useMemo(() => ({ captainId }), [captainId]);
  const list = useCursorList<ApiRideListItem>(allowed && enabled ? "/admin/rides" : null, query, { limit: 20 });
  useOnInvalidate("rides", list.refetch);
  return { ...list, forbidden: !allowed };
}

/** Audit entries whose target is this captain (needs `audit.view`). */
export function useCaptainAudit(captainId: string, enabled: boolean): CursorListResult<ApiAuditEntry> & { forbidden: boolean } {
  const { can } = useAuth();
  const allowed = can("audit.view");
  const query = useMemo(() => ({ targetId: captainId }), [captainId]);
  const list = useCursorList<ApiAuditEntry>(allowed && enabled ? "/admin/audit-logs" : null, query, { limit: 20 });
  useOnInvalidate("audit", list.refetch);
  return { ...list, forbidden: !allowed };
}
