"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FileText, Car, ArrowRight, ShieldCheck, Clock } from "lucide-react";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/ui/Page";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { LoadMore } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  ApiCaptainListItem,
  ApiQueueDocument,
  ApiVehicleLite,
  ApiCaptainStatus,
  cityLabel,
  displayDate,
} from "@/lib/adapters/captains";
import { avatarFor, humanize, timeAgo } from "@/lib/format";
import { useCities } from "@/lib/cities/CityProvider";
import { useCursorList } from "@/lib/hooks/useQuery";
import { useOnInvalidate } from "@/lib/invalidate";

interface KYCQueueViewProps {
  selectedCityId: string | null;
  onOpenKYCViewer: (captainId: string) => void;
}

interface QueueEntry {
  captainId: string;
  name: string;
  phone: string;
  avatar: string;
  cityId: string | null;
  cityText: string | null;
  status: ApiCaptainStatus;
  isSecondChance: boolean;
  vehicle: ApiVehicleLite | null;
  pendingDocs: ApiQueueDocument[];
  /** Earliest moment this captain started waiting (application submission or oldest pending upload). */
  waitingSince: string | null;
  /** Application (SUBMITTED / UNDER_REVIEW) needs a decision, as opposed to a renewal upload of a working captain. */
  hasApplication: boolean;
}

/**
 * Queue = captains with documents awaiting review (GET /admin/documents, PENDING) plus captains whose application
 * is SUBMITTED / UNDER_REVIEW (GET /admin/captains), merged per captain and sorted oldest first.
 */
export const KYCQueueView: React.FC<KYCQueueViewProps> = ({ selectedCityId, onOpenKYCViewer }) => {
  const { cities } = useCities();
  const base = useMemo(() => ({ cityId: selectedCityId ?? undefined }), [selectedCityId]);
  const docsQuery = useMemo(() => ({ ...base, status: "PENDING" }), [base]);
  const submittedQuery = useMemo(() => ({ ...base, status: "SUBMITTED" }), [base]);
  const reviewQuery = useMemo(() => ({ ...base, status: "UNDER_REVIEW" }), [base]);

  const docs = useCursorList<ApiQueueDocument>("/admin/documents", docsQuery, { limit: 50 });
  const submitted = useCursorList<ApiCaptainListItem>("/admin/captains", submittedQuery, { limit: 50 });
  const underReview = useCursorList<ApiCaptainListItem>("/admin/captains", reviewQuery, { limit: 50 });
  const refetchAll = () => {
    docs.refetch();
    submitted.refetch();
    underReview.refetch();
  };
  useOnInvalidate(["kyc", "captains"], refetchAll);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const entries = useMemo<QueueEntry[]>(() => {
    const map = new Map<string, QueueEntry>();
    for (const c of [...submitted.items, ...underReview.items]) {
      map.set(c.id, {
        captainId: c.id,
        name: c.name,
        phone: c.phone,
        avatar: avatarFor(c.name, c.avatar),
        cityId: c.cityId,
        cityText: c.city,
        status: c.status,
        isSecondChance: c.isSecondChance,
        vehicle: c.vehicle,
        pendingDocs: [],
        waitingSince: c.submittedAt ?? c.joinedAt,
        hasApplication: true,
      });
    }
    for (const d of docs.items) {
      const existing = map.get(d.captain.id);
      if (existing) {
        existing.pendingDocs.push(d);
        if (!existing.waitingSince || d.uploadedAt < existing.waitingSince) existing.waitingSince = d.uploadedAt;
      } else {
        map.set(d.captain.id, {
          captainId: d.captain.id,
          name: d.captain.name,
          phone: d.captain.phone,
          avatar: avatarFor(d.captain.name),
          cityId: d.captain.cityId,
          cityText: d.captain.city,
          status: d.captain.status,
          isSecondChance: d.captain.isSecondChance,
          vehicle: null,
          pendingDocs: [d],
          waitingSince: d.uploadedAt,
          hasApplication: false,
        });
      }
    }
    return [...map.values()].sort((a, b) => (a.waitingSince ?? "").localeCompare(b.waitingSince ?? ""));
  }, [docs.items, submitted.items, underReview.items]);

  const hasMore = docs.hasMore || submitted.hasMore || underReview.hasMore;
  const loadingMore = docs.loadingMore || submitted.loadingMore || underReview.loadingMore;
  const loadMore = () => {
    if (docs.hasMore) docs.loadMore();
    if (submitted.hasMore) submitted.loadMore();
    if (underReview.hasMore) underReview.loadMore();
  };
  const initialLoading = docs.initialLoading || submitted.initialLoading || underReview.initialLoading;
  const error = docs.error ?? submitted.error ?? underReview.error;

  const pendingDocCount = docs.items.length;
  const applicationCount = entries.filter((e) => e.hasApplication).length;
  const oldest = entries[0]?.waitingSince ?? null;
  const more = hasMore ? "+" : "";

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <PageHeader
        title="Driver KYC Approval Queue"
        badge={
          <Badge variant="plum" size="sm">
            P0 Priority Flow
          </Badge>
        }
        description="Verify driver licenses, vehicle registrations, commercial insurance, and background checks"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs dark:border-[#331A3B] dark:bg-[#180D1C]">
          <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Queue Size</span>
          <p className="truncate font-mono font-black text-slate-900 dark:text-white">{entries.length}{more} Captains</p>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs dark:border-[#331A3B] dark:bg-[#180D1C]">
          <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Applications</span>
          <p className="truncate font-mono font-black text-slate-900 dark:text-white">{applicationCount}{more}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs dark:border-[#331A3B] dark:bg-[#180D1C]">
          <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Documents Pending</span>
          <p className="truncate font-mono font-black text-slate-900 dark:text-white">{pendingDocCount}{more}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs dark:border-[#331A3B] dark:bg-[#180D1C]">
          <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Oldest Waiting</span>
          <p className="truncate font-mono font-black text-[#14755F] dark:text-[#4FD2B2]">{oldest ? timeAgo(oldest, now).replace(" ago", "") : "—"}</p>
        </div>
      </div>

      {error && <ErrorBanner error={error} title="Could not load the KYC queue" onRetry={refetchAll} />}

      {/* Applications Cards */}
      <div className="space-y-3">
        {initialLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-5 flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-72" />
              </div>
            </div>
          ))
        ) : entries.length === 0 ? (
          !error && (
            <div className="space-y-3 rounded-2xl border border-[#F0E3ED] bg-white p-8 text-center dark:border-[#331A3B] dark:bg-[#180D1C] sm:p-12">
              <ShieldCheck className="h-12 w-12 text-[#14755F] dark:text-[#4FD2B2] mx-auto" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">All KYC Applications Processed</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">There are currently no driver applications waiting in the verification queue.</p>
            </div>
          )
        ) : (
          entries.map((cap) => (
            <div
              key={cap.captainId}
              className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#F0E3ED] bg-white p-4 shadow-xs transition-shadow hover:shadow-md dark:border-[#331A3B] dark:bg-[#180D1C] sm:p-5 lg:flex-row lg:items-center"
            >
              {/* Left: Applicant Bio & Vehicle */}
              <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cap.avatar} alt="" className="h-12 w-12 shrink-0 rounded-2xl border-2 border-[#7A2B66] object-cover sm:h-14 sm:w-14" />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words text-base font-bold text-slate-900 dark:text-white">{cap.name}</h3>
                    <Badge variant="plum" size="sm">
                      {cityLabel(cap.cityId, cap.cityText, cities)}
                    </Badge>
                    {cap.isSecondChance && (
                      <Badge variant="coral" size="sm">
                        Second Chance
                      </Badge>
                    )}
                    <Badge variant={cap.hasApplication ? "warning" : "neutral"} size="sm">
                      {cap.hasApplication ? humanize(cap.status) : cap.status === "APPROVED" ? "Document renewal" : `${humanize(cap.status)} captain`}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Phone: {cap.phone} • Waiting since: {displayDate(cap.waitingSince)} ({timeAgo(cap.waitingSince, now)})
                  </p>
                  {cap.vehicle && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <Car className="h-3.5 w-3.5 text-[#7A2B66] dark:text-[#DB99CC]" />
                      <span>
                        {cap.vehicle.make} {cap.vehicle.model} ({cap.vehicle.year}) • Plate:{" "}
                        <span className="font-mono font-bold text-[#7A2B66] dark:text-[#DB99CC]">{cap.vehicle.plateNumber}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Center: Documents awaiting review */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {cap.pendingDocs.length === 0 ? (
                  <div className="px-3 py-1.5 rounded-xl border flex items-center gap-1.5 bg-slate-50 dark:bg-[#211226] border-slate-200 dark:border-[#331A3B] text-slate-600 dark:text-slate-400">
                    <Clock className="h-3 w-3" />
                    <span className="font-semibold">No pending documents, awaiting decision</span>
                  </div>
                ) : (
                  cap.pendingDocs.map((d) => (
                    <div
                      key={d.id}
                      className="flex min-w-0 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                      title={`${d.label} v${d.version}, uploaded ${displayDate(d.uploadedAt)}`}
                    >
                      <FileText className="h-3 w-3" />
                      <span className="font-semibold">{d.label}</span>
                      <span className="text-[10px] uppercase font-bold">(!)</span>
                    </div>
                  ))
                )}
              </div>

              {/* Right: Inspection CTA */}
              <button
                onClick={() => onOpenKYCViewer(cap.captainId)}
                className="flex min-h-11 items-center justify-center gap-2 self-stretch whitespace-nowrap rounded-xl bg-[#3A102F] px-5 py-2.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-[#521A44] dark:bg-[#7A2B66] dark:hover:bg-[#A74490] lg:self-auto"
              >
                <span>Open Verification Workbench</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {!initialLoading && <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} />}
    </div>
  );
};
