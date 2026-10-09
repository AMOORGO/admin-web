"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useQuery } from "@/lib/hooks/useQuery";
import { useOnInvalidate } from "@/lib/invalidate";
import { useOpsRoom, useSocketEvent } from "@/lib/realtime";

interface KpisLive {
  live: { onlineCaptains: number; openSos: number; openTickets: number; pendingCaptainApprovals: number; pendingRefunds: number };
}

interface OpsSnapshot {
  at: string;
  cityId: string | null;
  onlineCaptains: number;
  rides: Record<string, number>;
}

export interface ShellCounters {
  activeRides: number;
  onlineCaptains: number;
  pendingKyc: number;
  pendingRefunds: number;
  openSos: number;
  pendingSecondChance: number;
}

/** Counters for the navbar ticker and sidebar badges: REST for first paint / polling, `ops.snapshot` for live updates. */
export function useShellCounters(cityId: string | null): ShellCounters {
  const { can } = useAuth();
  const canSeeOps = can("dashboard.view") || can("rides.view");
  const kpis = useQuery<KpisLive>(
    can("dashboard.view") ? `shell-kpis:${cityId ?? "all"}` : null,
    (signal) => api.get<KpisLive>("/admin/dashboard/kpis", { query: { cityId }, signal }),
    { pollMs: 30_000 },
  );
  useOnInvalidate(["dashboard", "kyc", "finance", "incidents"], kpis.refetch);

  const sc = useQuery<{ pendingApplications: number }>(
    can("second_chance.manage") ? "shell-second-chance" : null,
    (signal) => api.get<{ pendingApplications: number }>("/admin/second-chance/stats", { signal }),
    { pollMs: 60_000 },
  );
  useOnInvalidate("second-chance", sc.refetch);

  const ops = useQuery<OpsSnapshot>(
    canSeeOps ? `shell-ops:${cityId ?? "all"}` : null,
    (signal) => api.get<OpsSnapshot>("/admin/ops/snapshot", { query: { cityId }, signal }),
    { pollMs: 30_000 },
  );
  const [pushed, setSnap] = useState<OpsSnapshot | null>(null);
  useOpsRoom(cityId, canSeeOps);
  useSocketEvent<OpsSnapshot>("ops.snapshot", (s) => {
    // The "all" room receives every city's snapshot too; keep only the one matching the current filter.
    if ((s.cityId ?? null) === cityId) setSnap(s);
  });

  const live = kpis.data?.live;
  const pushedForCity = pushed && (pushed.cityId ?? null) === cityId ? pushed : null;
  const restSnap = ops.data && (ops.data.cityId ?? null) === cityId ? ops.data : null;
  // Newest of the REST snapshot and the last socket push.
  const snapForCity = pushedForCity && (!restSnap || pushedForCity.at >= restSnap.at) ? pushedForCity : restSnap;
  const activeRides = snapForCity ? Object.values(snapForCity.rides).reduce((a, b) => a + b, 0) : 0;
  return {
    activeRides,
    onlineCaptains: snapForCity?.onlineCaptains ?? live?.onlineCaptains ?? 0,
    pendingKyc: live?.pendingCaptainApprovals ?? 0,
    pendingRefunds: live?.pendingRefunds ?? 0,
    openSos: live?.openSos ?? 0,
    pendingSecondChance: sc.data?.pendingApplications ?? 0,
  };
}
