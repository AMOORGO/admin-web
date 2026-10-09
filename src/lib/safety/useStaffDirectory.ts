"use client";

import { useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useQuery } from "@/lib/hooks/useQuery";

export interface StaffOption {
  id: string;
  name: string;
}

interface ApiStaffLite {
  id: string;
  name: string;
  status: string;
}

/**
 * Active staff for assignment pickers and "assigned to" labels. Needs `staff.view`; without it only the signed-in
 * person is known (assign-to-me still works).
 */
export function useStaffDirectory(enabled = true): { options: StaffOption[]; nameOf: (id: string | null | undefined) => string | null; meId: string | null } {
  const { can, user } = useAuth();
  const allowed = enabled && can("staff.view");
  const q = useQuery<ApiStaffLite[]>(allowed ? "safety-staff-directory" : null, async (signal) => {
    const page = await api.getPage<ApiStaffLite>("/admin/staff", { query: { status: "ACTIVE", limit: 100 }, signal });
    return page.items;
  });
  const meId = user?.id ?? null;
  const meName = user?.name ?? null;
  const options = useMemo(() => {
    const list: StaffOption[] = (q.data ?? []).filter((s) => s.status === "ACTIVE").map((s) => ({ id: s.id, name: s.name }));
    if (meId && !list.some((s) => s.id === meId)) list.unshift({ id: meId, name: meName ?? "Me" });
    return list;
  }, [q.data, meId, meName]);
  const nameOf = useCallback(
    (id: string | null | undefined) => {
      if (!id) return null;
      if (id === meId) return meName ? `${meName} (you)` : "You";
      return options.find((o) => o.id === id)?.name ?? null;
    },
    [options, meId, meName],
  );
  return { options, nameOf, meId };
}
