"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle, Heart, Flag, Mail, MapPin, Phone, RotateCcw, UserRoundX, UserRoundCheck, XCircle } from "lucide-react";
import { Can } from "@/components/Can";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SectionTabs } from "@/components/ui/Page";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { captainStatusLabel, captainStatusVariant, cityLabel, toCaptainStatus } from "@/lib/adapters/captains";
import { avatarFor, formatMonthYear } from "@/lib/format";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCities } from "@/lib/cities/CityProvider";
import { useCaptainAudit, useCaptainDetail, useCaptainEarnings, useCaptainTrips } from "@/lib/hooks/useCaptainProfile";
import { useCaptainDialogs } from "./CaptainDialogs";
import { DocumentViewer } from "./DocumentViewer";
import { type CaptainTab, RatingStars, availabilityLabel, availabilityVariant, buildDocRows } from "./captainUi";
import { ActivityTab } from "./tabs/ActivityTab";
import { DocumentsTab } from "./tabs/DocumentsTab";
import { EarningsTab } from "./tabs/EarningsTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { TripsTab } from "./tabs/TripsTab";
import { VehiclesTab } from "./tabs/VehiclesTab";

interface CaptainProfileProps {
  captainId: string | null;
  /** Tab to open first (the KYC queue opens straight on Documents). */
  initialTab?: CaptainTab;
  onClose: () => void;
  /** Opens the ride drawer for a trip of this captain. */
  onOpenRide: (rideId: string) => void;
}

/** Captain 360° profile. Keyed by captain so every captain starts with a clean tab, viewer and dialog state. */
export const CaptainProfile: React.FC<CaptainProfileProps> = ({ captainId, initialTab = "overview", onClose, onOpenRide }) => {
  if (!captainId) return null;
  return <ProfileInner key={captainId} captainId={captainId} initialTab={initialTab} onClose={onClose} onOpenRide={onOpenRide} />;
};

const REVIEWABLE_APPLICATION = ["SUBMITTED", "UNDER_REVIEW"];
const actionBtn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition-colors max-sm:flex-1";

const ProfileInner: React.FC<{ captainId: string; initialTab: CaptainTab; onClose: () => void; onOpenRide: (id: string) => void }> = ({ captainId, initialTab, onClose, onOpenRide }) => {
  const { can } = useAuth();
  const { cities } = useCities();
  const [tab, setTab] = useState<CaptainTab>(initialTab);
  const [viewerDocId, setViewerDocId] = useState<string | null>(null);

  const detail = useCaptainDetail(captainId);
  const captain = detail.data;
  const earnings = useCaptainEarnings(captainId);
  const trips = useCaptainTrips(captainId, true);
  const audit = useCaptainAudit(captainId, tab === "activity");
  const { openDialog, dialogs } = useCaptainDialogs(captain, captainId, detail.refetch);

  const { rows, older } = useMemo(() => (captain ? buildDocRows(captain) : { rows: [], older: [] }), [captain]);
  const viewerDocs = useMemo(() => {
    const list = rows.flatMap((r) => (r.doc ? [r.doc] : []));
    const extra = viewerDocId ? older.find((r) => r.doc?.id === viewerDocId)?.doc : undefined;
    return extra && !list.some((d) => d.id === extra.id) ? [...list, extra] : list;
  }, [rows, older, viewerDocId]);

  const status = captain ? toCaptainStatus(captain.status, captain.availability, captain.onRide) : null;
  const inReview = !!captain && REVIEWABLE_APPLICATION.includes(captain.status);
  const pendingDocs = captain ? captain.documents.filter((d) => d.status === "PENDING").length : 0;
  const canViewDocs = can("captains.review_docs");

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    {
      id: "documents" as const,
      label: (
        <span className="inline-flex items-center gap-2">
          Documents
          {pendingDocs > 0 && <span className="rounded-full bg-amber-100 px-1.5 text-xs font-extrabold text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">{pendingDocs}</span>}
        </span>
      ),
    },
    { id: "vehicles" as const, label: captain ? `Vehicles (${captain.vehicles.length})` : "Vehicles" },
    { id: "trips" as const, label: "Trips" },
    { id: "earnings" as const, label: "Earnings & payouts" },
    { id: "activity" as const, label: "Activity" },
  ];

  const header = captain && status ? (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarFor(captain.name, captain.avatar)} alt="" className="h-14 w-14 shrink-0 rounded-2xl border-2 border-[#7A2B66] object-cover sm:h-16 sm:w-16" />
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-xl font-extrabold leading-tight text-slate-900 dark:text-white sm:text-2xl">{captain.name}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusPill variant={captain.status === "APPROVED" ? "teal" : captainStatusVariant(status)}>{captain.status === "APPROVED" ? "Approved" : captainStatusLabel(status)}</StatusPill>
            {captain.status === "APPROVED" && <StatusPill variant={availabilityVariant(captain.availability, captain.onRide)}>{availabilityLabel(captain.availability, captain.onRide)}</StatusPill>}
            {captain.isSecondChance && (
              <StatusPill variant="coral" dot={false}>
                <Heart className="h-3 w-3 fill-current" aria-hidden="true" /> Second Chance
              </StatusPill>
            )}
            {captain.flagged && (
              <StatusPill variant="warning" dot={false}>
                <Flag className="h-3 w-3" aria-hidden="true" /> Flagged
              </StatusPill>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700 dark:text-slate-200">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              {cityLabel(captain.cityId, captain.city, cities)}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono">
              <Phone className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              {captain.phone}
            </span>
            {captain.email && (
              <span className="inline-flex max-w-full items-center gap-1.5 max-sm:hidden">
                <Mail className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <span className="truncate">{captain.email}</span>
              </span>
            )}
            <span className="max-sm:hidden">Member since {formatMonthYear(captain.joinedAt)}</span>
          </div>
          <RatingStars rating={captain.metrics.rating} count={captain.metrics.ratingCount} className="mt-1.5" />
        </div>
      </div>

      {(inReview || captain.status === "APPROVED" || captain.status === "SUSPENDED") && (
        <div className="flex flex-wrap gap-2">
          {inReview && (
            <Can permission="captains.approve">
              <button type="button" onClick={() => openDialog({ kind: "approve" })} className={`${actionBtn} border-transparent bg-[#14755F] text-white shadow-sm hover:bg-[#0E3D32]`}>
                <CheckCircle className="h-4 w-4" aria-hidden="true" /> Approve &amp; activate
              </button>
              <button type="button" onClick={() => openDialog({ kind: "reject" })} className={`${actionBtn} border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200`}>
                <XCircle className="h-4 w-4" aria-hidden="true" /> Reject application
              </button>
            </Can>
          )}
          {(inReview || captain.status === "APPROVED") && (
            <Can permission="captains.approve">
              <button type="button" onClick={() => openDialog({ kind: "resubmit" })} className={`${actionBtn} border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200`}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Request resubmission
              </button>
            </Can>
          )}
          {captain.status === "APPROVED" && (
            <Can permission="captains.suspend">
              <button type="button" onClick={() => openDialog({ kind: "suspend" })} className={`${actionBtn} border-rose-300 bg-white text-rose-800 hover:bg-rose-50 dark:border-rose-900 dark:bg-transparent dark:text-rose-200 dark:hover:bg-rose-950/40`}>
                <UserRoundX className="h-4 w-4" aria-hidden="true" /> Suspend
              </button>
            </Can>
          )}
          {captain.status === "SUSPENDED" && (
            <Can permission="captains.suspend">
              <button type="button" onClick={() => openDialog({ kind: "reactivate" })} className={`${actionBtn} border-transparent bg-[#14755F] text-white shadow-sm hover:bg-[#0E3D32]`}>
                <UserRoundCheck className="h-4 w-4" aria-hidden="true" /> Reactivate
              </button>
            </Can>
          )}
        </div>
      )}
    </div>
  ) : (
    <div className="flex items-center gap-4" role="status" aria-label="Loading captain">
      <Skeleton className="h-16 w-16 rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
    </div>
  );

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        variant="right"
        widthClass="sm:max-w-[1180px]"
        headerClassName="bg-[#FAF0F7]/60 dark:bg-[#211226]/70"
        bodyClassName="bg-[#FDFBFC] p-4 dark:bg-[#0F0811] sm:p-6"
        header={header}
        subheader={
          <div className="bg-white px-4 dark:bg-[#180D1C] sm:px-6">
            <SectionTabs label="Captain sections" items={tabs} value={tab} onChange={setTab} />
          </div>
        }
      >
        {detail.error && !captain && <ErrorBanner error={detail.error} title="Could not load the captain" onRetry={detail.refetch} />}
        {!captain && !detail.error && (
          <div className="space-y-4" role="status" aria-label="Loading">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        )}
        {captain && (
          <>
            {detail.error && <ErrorBanner error={detail.error} title="Could not refresh the captain" onRetry={detail.refetch} className="mb-4" />}
            {captain.statusReason && (captain.status === "REJECTED" || captain.status === "SUSPENDED" || captain.status === "DRAFT" || captain.status === "DEACTIVATED") && tab === "overview" && (
              <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <strong>Last status note:</strong> {captain.statusReason}
              </p>
            )}
            {tab === "overview" && <OverviewTab captain={captain} earnings={earnings} trips={{ items: trips.items, initialLoading: trips.initialLoading, forbidden: trips.forbidden }} setTab={setTab} onOpenRide={onOpenRide} cityName={cityLabel(captain.cityId, captain.city, cities)} />}
            {tab === "documents" && <DocumentsTab captain={captain} onView={setViewerDocId} onAction={openDialog} canView={canViewDocs} />}
            {tab === "vehicles" && <VehiclesTab captain={captain} onAction={openDialog} />}
            {tab === "trips" && <TripsTab captainId={captainId} onOpenRide={onOpenRide} />}
            {tab === "earnings" && <EarningsTab earnings={earnings} onOpenRide={onOpenRide} />}
            {tab === "activity" && <ActivityTab captain={captain} audit={audit} />}
          </>
        )}
      </Sheet>

      {captain && viewerDocId && viewerDocs.length > 0 && (
        <DocumentViewer
          captainId={captainId}
          captainName={captain.name}
          docs={viewerDocs}
          currentId={viewerDocs.some((d) => d.id === viewerDocId) ? viewerDocId : viewerDocs[0].id}
          onNavigate={setViewerDocId}
          onClose={() => setViewerDocId(null)}
          onAction={openDialog}
          dialogOpen={dialogs !== null}
        />
      )}
      {dialogs}
    </>
  );
};
