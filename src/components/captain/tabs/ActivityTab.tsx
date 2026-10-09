"use client";

import React, { useMemo } from "react";
import { History, Lock, ScrollText, UserRoundCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadMore } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { Skeleton } from "@/components/ui/Skeleton";
import { type ApiAuditEntry, toAuditEntry } from "@/lib/adapters/audit";
import type { ApiCaptainDetail } from "@/lib/adapters/captains";
import { humanize } from "@/lib/format";
import type { CursorListResult } from "@/lib/hooks/useQuery";

interface Event {
  key: string;
  at: string;
  kind: "status" | "audit";
  title: string;
  actor: string | null;
  reason: string | null;
}

/** Audit entries for the captain (what staff did) merged with the lifecycle status history, newest first. */
export const ActivityTab: React.FC<{ captain: ApiCaptainDetail; audit: CursorListResult<ApiAuditEntry> & { forbidden: boolean } }> = ({ captain, audit }) => {
  const events = useMemo<Event[]>(() => {
    const out: Event[] = captain.statusHistory.map((h) => ({
      key: `s:${h.id}`,
      at: h.at,
      kind: "status",
      title: h.from ? `Status changed: ${humanize(h.from)} → ${humanize(h.to)}` : `Account created as ${humanize(h.to)}`,
      actor: null,
      reason: h.reason,
    }));
    for (const raw of audit.items) {
      const e = toAuditEntry(raw);
      out.push({ key: `a:${e.id}`, at: e.timestamp, kind: "audit", title: humanize(e.action.replace(/^captain\./, "")), actor: e.actorName, reason: e.reasonNotes });
    }
    return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [captain.statusHistory, audit.items]);

  return (
    <div className="space-y-4">
      {audit.forbidden && (
        <p className="flex items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-700 dark:border-[#4B2757] dark:bg-[#180D1C] dark:text-slate-200">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Staff audit entries need the audit.view permission. Only the account status history is shown.
        </p>
      )}
      {audit.error && <ErrorBanner error={audit.error} title="Could not load the audit trail" onRetry={audit.refetch} />}
      <Card>
        {audit.initialLoading ? (
          <div className="space-y-3 p-5" role="status" aria-label="Loading activity">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState icon={History} title="No activity yet" description="Status changes and staff actions on this captain will be listed here." />
        ) : (
          <ol className="relative p-4 sm:p-5">
            {events.map((ev, i) => (
              <li key={ev.key} className="relative flex gap-3 pb-5 last:pb-0">
                {i < events.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-1.75rem)] w-px bg-[#E9BFDF] dark:bg-[#521A44]" aria-hidden="true" />}
                <span className={`z-[1] mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ev.kind === "status" ? "bg-[#FAF0F7] text-[#7A2B66] dark:bg-[#331A3B] dark:text-[#E9BFDF]" : "bg-[#EFFCF9] text-[#14755F] dark:bg-[#0D2620] dark:text-[#82E5CB]"}`}>
                  {ev.kind === "status" ? <UserRoundCheck className="h-4 w-4" aria-hidden="true" /> : <ScrollText className="h-4 w-4" aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{ev.title}</p>
                    <RelativeTime iso={ev.at} className="text-[13px] text-slate-600 dark:text-slate-300" />
                  </div>
                  {ev.actor && <p className="text-[13px] text-slate-600 dark:text-slate-300">by {ev.actor}</p>}
                  {ev.reason && <p className="mt-1 text-[13px] text-slate-700 dark:text-slate-200">“{ev.reason}”</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
        <LoadMore hasMore={audit.hasMore} loading={audit.loadingMore} onClick={audit.loadMore} />
      </Card>
    </div>
  );
};
