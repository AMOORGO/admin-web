"use client";

import React, { useMemo, useState } from "react";
import {
  Heart,
  ShieldCheck,
  Award,
  Sliders,
  Clock,
  Gauge,
  Search,
  X,
  Moon,
  CheckCircle,
  XCircle,
  RotateCcw,
  PauseCircle,
  ClipboardCheck,
  PlayCircle,
  Send,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState, LoadMore } from "@/components/ui/EmptyState";
import { CardsSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import {
  ApiScDetail,
  ApiScNote,
  ApiScRecord,
  ApiScStats,
  ApiScStatus,
  ApiScTier,
  SC_STATUSES,
  SC_TIERS,
  ScRestrictions,
  nightWindowOf,
  progressPercent,
  scActionsFor,
  scStatusLabel,
  scStatusVariant,
  scTierLabel,
} from "@/lib/adapters/secondChance";
import { cityLabel, displayDate } from "@/lib/adapters/captains";
import { avatarFor, formatDateTime, humanize, metersToMiles } from "@/lib/format";
import { useCities } from "@/lib/cities/CityProvider";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useCursorList, useQuery } from "@/lib/hooks/useQuery";
import { invalidate, useOnInvalidate } from "@/lib/invalidate";
import type { QueryParams } from "@/lib/api";

interface SecondChanceViewProps {
  selectedCityId: string | null;
}

type ActionKind = "start-review" | "approve" | "reject" | "resubmit" | "suspend" | "revoke" | "review" | "tier" | "restrictions";

interface ActionTarget {
  kind: ActionKind;
  record: ApiScRecord;
}

const METERS_PER_MILE = 1609.344;

export const SecondChanceView: React.FC<SecondChanceViewProps> = ({ selectedCityId }) => {
  const { cities } = useCities();
  const [statusFilter, setStatusFilter] = useState<"ALL" | ApiScStatus>("ALL");
  const [tierFilter, setTierFilter] = useState<"ALL" | ApiScTier>("ALL");
  const [dueOnly, setDueOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [action, setAction] = useState<ActionTarget | null>(null);

  const q = useDebouncedValue(search.trim(), 350);
  const query = useMemo<QueryParams>(
    () => ({
      status: statusFilter === "ALL" ? undefined : statusFilter,
      tier: tierFilter === "ALL" ? undefined : tierFilter,
      dueReview: dueOnly ? true : undefined,
      q: q || undefined,
      cityId: selectedCityId ?? undefined,
    }),
    [statusFilter, tierFilter, dueOnly, q, selectedCityId],
  );

  const list = useCursorList<ApiScRecord>("/admin/second-chance", query, { limit: 20 });
  useOnInvalidate("second-chance", list.refetch);
  const stats = useQuery<ApiScStats>("second-chance-stats", (signal) => api.get<ApiScStats>("/admin/second-chance/stats", { signal }));
  useOnInvalidate("second-chance", stats.refetch);
  const s = stats.data;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Brand Header Banner */}
      <div className="rounded-3xl border border-[#FFC4BC] dark:border-[#61130A] bg-gradient-to-r from-[#FFF3F1] via-white to-[#FAF0F7] dark:from-[#38110D]/40 dark:via-[#180D1C] dark:to-[#331A3B]/40 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F94B35] text-white">
                <Heart className="h-4 w-4 fill-current" />
              </div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">Second Chance Driver Management</h1>
              <Badge variant="coral" size="sm">
                PRD Section 28
              </Badge>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              &ldquo;Move in Love. Love is the frequency. Safety is the foundation.&rdquo; — Providing structured rehabilitation, speed telemetry monitoring, and mentored opportunities for qualified drivers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StatTile label="Program Drivers" value={s ? `${s.byStatus.APPROVED ?? 0} Enrolled` : "…"} tone="coral" />
            <StatTile label="Pending Applications" value={s ? String(s.pendingApplications) : "…"} tone="plain" />
            <StatTile label="Reviews Due" value={s ? String(s.dueReviews) : "…"} tone="plain" />
            <StatTile label="Avg Compliance" value={s ? (s.averageComplianceScore === null ? "—" : `${s.averageComplianceScore}%`) : "…"} tone="green" />
          </div>
        </div>
      </div>

      {stats.error && <ErrorBanner error={stats.error} title="Could not load programme statistics" onRetry={stats.refetch} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3 shadow-xs">
        <div className="flex gap-1 overflow-x-auto text-xs pb-1 sm:pb-0">
          {(["ALL", ...SC_STATUSES] as const).map((st) => {
            const count = st === "ALL" ? undefined : s?.byStatus[st];
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap ${
                  statusFilter === st ? "bg-[#3A102F] text-white dark:bg-[#7A2B66]" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#28162E]"
                }`}
              >
                {st === "ALL" ? "All" : scStatusLabel(st)}
                {count !== undefined ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as "ALL" | ApiScTier)}
            aria-label="Tier"
            className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] px-2 py-1.5 text-xs text-slate-800 dark:text-white"
          >
            <option value="ALL">All tiers</option>
            {SC_TIERS.map((t) => (
              <option key={t} value={t}>
                {scTierLabel(t)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} className="h-3.5 w-3.5 accent-[#F94B35]" />
            Review due
          </label>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={100}
              className="w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {list.error && <ErrorBanner error={list.error} title="Could not load Second Chance drivers" onRetry={list.refetch} />}

      {/* Driver Profiles Grid */}
      {list.initialLoading ? (
        <CardsSkeleton count={4} />
      ) : list.items.length === 0 && !list.error ? (
        <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C]">
          <EmptyState title="No Second Chance records" description="Drivers appear here once they apply from the captain app." icon={Heart} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {list.items.map((rec) => {
            const pct = progressPercent(rec);
            const acts = scActionsFor(rec.status);
            const night = nightWindowOf(rec.restrictions);
            return (
              <div key={rec.captainId} className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-5 shadow-xs space-y-4 hover:shadow-md transition-all">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarFor(rec.captain.name, rec.captain.avatar)} alt={rec.captain.name} className="h-12 w-12 rounded-2xl object-cover border-2 border-[#F94B35]" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{rec.captain.name}</h3>
                      <p className="text-xs text-slate-500">
                        {rec.captain.phone} • {cityLabel(rec.captain.cityId, rec.captain.city, cities)}
                      </p>
                      <span className="text-[11px] font-bold text-amber-500">
                        ★ {rec.captain.totalTrips > 0 ? rec.captain.rating.toFixed(2) : "New"} ({rec.captain.totalTrips} Total Trips)
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={scStatusVariant(rec.status)} size="sm" dot>
                      {scStatusLabel(rec.status)}
                    </Badge>
                    <Badge variant={rec.tier === "TIER_1_PROBATION" ? "coral" : "plum"} size="sm">
                      {scTierLabel(rec.tier)}
                    </Badge>
                  </div>
                </div>

                {/* Probation Progress Bar */}
                <div className="space-y-1.5 rounded-xl border border-slate-100 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-3">
                  {pct === null ? (
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      No probation ride target set • {rec.probationRidesCompleted} verified rides completed
                    </p>
                  ) : (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Probation Milestones ({rec.probationRidesCompleted} / {rec.probationRidesTarget} rides)
                        </span>
                        <span className="font-mono font-bold text-[#F94B35]">{pct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#F94B35] to-[#7A2B66]" style={{ width: `${pct}%` }} />
                      </div>
                    </>
                  )}
                  <p className="text-[10px] text-slate-400">
                    Compliance {rec.complianceScore}% • {rec.incidentCount} incident{rec.incidentCount === 1 ? "" : "s"}
                    {rec.reviewDue ? " • periodic review due" : rec.nextReviewAt ? ` • next review ${displayDate(rec.nextReviewAt)}` : ""}
                  </p>
                </div>

                {/* Conditions & Safety Controls Checklist */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C]">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase">
                      <Gauge className="h-3.5 w-3.5 text-[#F94B35]" />
                      Governor
                    </div>
                    <p className="font-bold text-slate-900 dark:text-white mt-1">{rec.speedGovernorEnabled ? "ACTIVE" : "Standard"}</p>
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C]">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase">
                      <Clock className="h-3.5 w-3.5 text-[#7A2B66]" />
                      Max Shift
                    </div>
                    <p className="font-bold text-slate-900 dark:text-white mt-1">{rec.maxDailyHours ? `${rec.maxDailyHours} Hours / Day` : "No limit"}</p>
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C]">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      Mentor Staff
                    </div>
                    <p className="font-bold text-slate-900 dark:text-white mt-1 truncate">{rec.sponsorMentor || "Operations"}</p>
                  </div>
                </div>
                {rec.restrictedNightDriving && (
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Moon className="h-3.5 w-3.5" /> Night driving restricted ({night.start} – {night.end})
                  </p>
                )}

                {/* Admin Notes */}
                {rec.eligibilityNotes && (
                  <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] p-3 text-xs bg-slate-50/50 dark:bg-[#211226]/40 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Administrative Review Notes</span>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">{rec.eligibilityNotes}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2 border-t border-slate-100 dark:border-[#331A3B] flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => setDetailId(rec.captainId)}
                    className="rounded-xl border border-slate-200 dark:border-[#331A3B] px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#28162E] transition-all"
                  >
                    Details &amp; Actions
                  </button>

                  <Can permission="second_chance.manage">
                    <div className="flex flex-wrap items-center gap-2">
                      {acts.startReview && (
                        <button
                          onClick={() => setAction({ kind: "start-review", record: rec })}
                          className="rounded-xl bg-[#FAF0F7] border border-[#E9BFDF] text-[#521A44] dark:bg-[#331A3B] dark:text-[#E9BFDF] px-3 py-1.5 text-xs font-bold hover:opacity-80 transition-all flex items-center gap-1"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          Start Review
                        </button>
                      )}
                      {acts.approve && (
                        <button
                          onClick={() => setAction({ kind: "approve", record: rec })}
                          className="rounded-xl bg-[#EFFCF9] border border-[#B4F2E1] text-[#14755F] dark:bg-[#0D2620] dark:text-[#82E5CB] px-3 py-1.5 text-xs font-bold hover:opacity-80 transition-all flex items-center gap-1"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          {rec.status === "APPLIED" || rec.status === "UNDER_REVIEW" ? "Approve" : "Reinstate"}
                        </button>
                      )}
                      {acts.configure && (
                        <>
                          <button
                            onClick={() => setAction({ kind: "restrictions", record: rec })}
                            className="rounded-xl border border-slate-200 dark:border-[#331A3B] px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#28162E] transition-all flex items-center gap-1.5"
                          >
                            <Sliders className="h-3.5 w-3.5" />
                            Configure Conditions
                          </button>
                          <button
                            onClick={() => setAction({ kind: "tier", record: rec })}
                            className="rounded-xl bg-[#EFFCF9] border border-[#B4F2E1] text-[#14755F] dark:bg-[#0D2620] dark:text-[#82E5CB] px-3 py-1.5 text-xs font-bold hover:opacity-80 transition-all flex items-center gap-1"
                          >
                            <Award className="h-3.5 w-3.5" />
                            Change Tier
                          </button>
                        </>
                      )}
                      {acts.revoke && (
                        <button
                          onClick={() => setAction({ kind: "revoke", record: rec })}
                          className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-3 py-1.5 text-xs font-bold hover:bg-rose-100 transition-all"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </Can>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!list.initialLoading && <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />}

      {detailId && <SecondChanceDetail captainId={detailId} onClose={() => setDetailId(null)} onAction={(kind, record) => setAction({ kind, record })} />}

      {action && <ActionDialog key={`${action.kind}:${action.record.captainId}`} target={action} onClose={() => setAction(null)} />}
    </div>
  );
};

const StatTile: React.FC<{ label: string; value: string; tone: "coral" | "green" | "plain" }> = ({ label, value, tone }) => (
  <div
    className={`rounded-2xl border bg-white dark:bg-[#180D1C] px-4 py-2 text-right shadow-xs ${
      tone === "coral" ? "border-[#FFC4BC] dark:border-[#61130A]" : tone === "green" ? "border-emerald-200 dark:border-emerald-900" : "border-slate-200 dark:border-[#331A3B]"
    }`}
  >
    <span className="text-[10px] text-slate-400 uppercase font-bold">{label}</span>
    <p className={`text-lg font-black ${tone === "coral" ? "text-[#F94B35]" : tone === "green" ? "text-emerald-600" : "text-slate-900 dark:text-white"}`}>{value}</p>
  </div>
);

/* ───────────────────────────── Detail modal ───────────────────────────── */

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] p-3">
    <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
    <div className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-100 break-words">{children}</div>
  </div>
);

const SecondChanceDetail: React.FC<{ captainId: string; onClose: () => void; onAction: (kind: ActionKind, record: ApiScRecord) => void }> = ({ captainId, onClose, onAction }) => {
  const toast = useToast();
  const { cities } = useCities();
  const detail = useQuery<ApiScDetail>(`second-chance-detail:${captainId}`, (signal) => api.get<ApiScDetail>(`/admin/second-chance/${captainId}`, { signal }));
  useOnInvalidate("second-chance", detail.refetch);
  const [note, setNote] = useState("");
  const [noting, setNoting] = useState(false);
  const d = detail.data;

  const addNote = async () => {
    const body = note.trim();
    if (!body || noting) return;
    setNoting(true);
    try {
      await api.post<ApiScNote>(`/admin/second-chance/${captainId}/notes`, { body });
      detail.refetch();
      setNote("");
      toast.success("Note added");
      invalidate("second-chance");
    } catch (e) {
      toast.error(e);
    } finally {
      setNoting(false);
    }
  };

  const acts = d ? scActionsFor(d.status) : null;
  const r: ScRestrictions = d?.restrictions ?? {};
  const night = nightWindowOf(r);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-[#180D1C] border border-[#F0E3ED] dark:border-[#331A3B] shadow-2xl overflow-hidden" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-[#F0E3ED] dark:border-[#331A3B] px-6 py-4 bg-[#FFF3F1]/50 dark:bg-[#38110D]/20">
          {d ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarFor(d.captain.name, d.captain.avatar)} alt={d.captain.name} className="h-11 w-11 rounded-2xl object-cover border-2 border-[#F94B35]" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{d.captain.name}</h3>
                  <Badge variant={scStatusVariant(d.status)} size="sm" dot>
                    {scStatusLabel(d.status)}
                  </Badge>
                  <Badge variant={d.tier === "TIER_1_PROBATION" ? "coral" : "plum"} size="sm">
                    {scTierLabel(d.tier)}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  {d.captain.phone} • {d.captain.email ?? "—"} • {cityLabel(d.captain.cityId, d.captain.city, cities)} • Captain status: {humanize(d.captain.status)}
                </p>
              </div>
            </div>
          ) : (
            <Skeleton className="h-11 w-72" />
          )}
          <button onClick={onClose} aria-label="Close" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#28162E] dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {detail.error && <ErrorBanner error={detail.error} title="Could not load the record" onRetry={detail.refetch} />}
          {!d && !detail.error && <Skeleton className="h-64 w-full" />}

          {d && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Applied">{displayDate(d.appliedAt)}</Field>
                <Field label="Enrolled">{d.status === "APPROVED" ? displayDate(d.enrolledDate) : "—"}</Field>
                <Field label="Expires">{displayDate(d.expiresAt)}</Field>
                <Field label="Next review">
                  {displayDate(d.nextReviewAt)}
                  {d.reviewDue && <span className="ml-1 text-[#F94B35]">(due)</span>}
                </Field>
                <Field label="Last audit">{displayDate(d.lastAuditDate)}</Field>
                <Field label="Compliance score">{d.complianceScore}%</Field>
                <Field label="Incidents">{d.incidentCount}</Field>
                <Field label="Probation">{d.probationRidesTarget > 0 ? `${d.probationRidesCompleted} / ${d.probationRidesTarget} rides` : `${d.probationRidesCompleted} rides (no target)`}</Field>
              </div>

              {d.decisionReason && ["REJECTED", "REVOKED", "SUSPENDED", "RESUBMISSION_REQUESTED"].includes(d.status) && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <strong>Decision reason:</strong> {d.decisionReason}
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Conditions &amp; restrictions</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="Speed governor">{d.speedGovernorEnabled ? "Active" : "Standard"}</Field>
                  <Field label="Max daily hours">{r.maxDailyHours ?? d.maxDailyHours ?? "No limit"}</Field>
                  <Field label="Night driving">{d.restrictedNightDriving ? `Restricted (${night.start} – ${night.end})` : "Allowed"}</Field>
                  <Field label="Max trip distance">{r.maxTripDistanceMeters ? `${metersToMiles(r.maxTripDistanceMeters).toFixed(1)} mi` : "No limit"}</Field>
                  <Field label="Allowed hours">{r.allowedHours ? `${r.allowedHours.start} – ${r.allowedHours.end}` : "Any"}</Field>
                  <Field label="Allowed zones">{r.allowedZoneIds?.length ? `${r.allowedZoneIds.length} zone(s)` : "Any"}</Field>
                  <Field label="Allowed vehicles">{r.allowedVehicleIds?.length ? `${r.allowedVehicleIds.length} vehicle(s)` : "Any"}</Field>
                  <Field label="Service types">{r.allowedServiceTypeCodes?.length ? r.allowedServiceTypeCodes.join(", ") : "Any"}</Field>
                </div>
                <p className="text-[11px] text-slate-400">Mentor: {d.sponsorMentor || "Operations"}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Previous platforms</h4>
                  {d.previousPlatforms.length === 0 ? (
                    <p className="text-xs text-slate-400">None declared.</p>
                  ) : (
                    d.previousPlatforms.map((p, i) => (
                      <div key={i} className="rounded-xl border border-slate-200 dark:border-[#331A3B] p-2.5 text-xs">
                        <p className="font-bold text-slate-800 dark:text-slate-100">{p.name}</p>
                        <p className="text-slate-500">
                          {p.reasonCategory ? humanize(p.reasonCategory) : "Reason not given"}
                          {p.deactivatedAt ? ` • deactivated ${displayDate(p.deactivatedAt)}` : ""}
                        </p>
                      </div>
                    ))
                  )}
                  {d.deactivationExplanation && (
                    <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50/50 dark:bg-[#211226]/40 p-3 text-xs">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Captain&apos;s explanation</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{d.deactivationExplanation}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Programme documents</h4>
                  {d.requiredDocuments.length === 0 ? (
                    <p className="text-xs text-slate-400">No extra documents required.</p>
                  ) : (
                    d.requiredDocuments.map((doc) => (
                      <div key={doc.documentType} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-[#331A3B] p-2.5 text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{doc.label}</span>
                        <Badge variant={doc.ok ? "teal" : doc.state === "PENDING" ? "neutral" : "coral"} size="sm">
                          {humanize(doc.state)}
                        </Badge>
                      </div>
                    ))
                  )}
                  {d.eligibilityNotes && (
                    <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50/50 dark:bg-[#211226]/40 p-3 text-xs">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Administrative review notes</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{d.eligibilityNotes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Internal notes</h4>
                <Can permission="second_chance.manage">
                  <div className="flex gap-2">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      maxLength={4000}
                      placeholder="Add an internal note (never shown to the captain)..."
                      className="flex-1 rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400"
                    />
                    <button
                      onClick={addNote}
                      disabled={!note.trim() || noting}
                      className="self-end rounded-xl bg-[#3A102F] hover:bg-[#521A44] text-white px-3 py-2 text-xs font-bold disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                </Can>
                {d.recentNotes.length === 0 ? (
                  <p className="text-xs text-slate-400">No notes yet.</p>
                ) : (
                  d.recentNotes.map((n) => (
                    <div key={n.id} className="rounded-xl border border-slate-200 dark:border-[#331A3B] p-2.5 text-xs">
                      <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{n.body}</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {n.authorName ?? "Staff"} • {formatDateTime(n.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {d && acts && (
          <Can permission="second_chance.manage">
            <div className="border-t border-[#F0E3ED] dark:border-[#331A3B] px-6 py-4 bg-white dark:bg-[#180D1C] flex flex-wrap items-center justify-end gap-2">
              {acts.startReview && <ActionBtn icon={PlayCircle} label="Start Review" onClick={() => onAction("start-review", d)} />}
              {acts.review && <ActionBtn icon={ClipboardCheck} label="Record Periodic Review" onClick={() => onAction("review", d)} />}
              {acts.configure && <ActionBtn icon={Sliders} label="Configure Conditions" onClick={() => onAction("restrictions", d)} />}
              {acts.configure && <ActionBtn icon={Award} label="Change Tier" onClick={() => onAction("tier", d)} />}
              {acts.requestResubmission && <ActionBtn icon={RotateCcw} label="Request Resubmission" tone="warn" onClick={() => onAction("resubmit", d)} />}
              {acts.suspend && <ActionBtn icon={PauseCircle} label="Suspend" tone="warn" onClick={() => onAction("suspend", d)} />}
              {acts.reject && <ActionBtn icon={XCircle} label="Reject" tone="danger" onClick={() => onAction("reject", d)} />}
              {acts.revoke && <ActionBtn icon={XCircle} label="Revoke" tone="danger" onClick={() => onAction("revoke", d)} />}
              {acts.approve && <ActionBtn icon={CheckCircle} label={d.status === "APPLIED" || d.status === "UNDER_REVIEW" ? "Approve" : "Reinstate"} tone="good" onClick={() => onAction("approve", d)} />}
            </div>
          </Can>
        )}
      </div>
    </div>
  );
};

const ActionBtn: React.FC<{ icon: React.ElementType; label: string; onClick: () => void; tone?: "good" | "warn" | "danger" }> = ({ icon: Icon, label, onClick, tone }) => (
  <button
    onClick={onClick}
    className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-all flex items-center gap-1.5 hover:opacity-80 ${
      tone === "good"
        ? "bg-[#189578] border-[#189578] text-white"
        : tone === "danger"
          ? "border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
          : tone === "warn"
            ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
            : "border-slate-200 dark:border-[#331A3B] text-slate-700 dark:text-slate-200"
    }`}
  >
    <Icon className="h-4 w-4" />
    {label}
  </button>
);

/* ───────────────────────────── Action dialogs ───────────────────────────── */

const inputCls = "mt-1 w-full rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-2 text-sm text-slate-900 dark:text-white";
const labelCls = "block text-xs font-semibold text-slate-700 dark:text-slate-200";

/** Parses an optional non-negative integer field; throws a readable message on bad input. */
function optInt(raw: string, label: string, min: number, max: number): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label} must be a whole number between ${min} and ${max}`);
  return n;
}

const ActionDialog: React.FC<{ target: ActionTarget; onClose: () => void }> = ({ target, onClose }) => {
  const toast = useToast();
  const { kind, record: rec } = target;
  const base = `/admin/second-chance/${rec.captainId}`;
  const name = rec.captain.name;

  // approve / tier / review fields
  const [tier, setTier] = useState<ApiScTier>(rec.tier);
  const [probationTarget, setProbationTarget] = useState(rec.probationRidesTarget > 0 ? String(rec.probationRidesTarget) : "");
  const [validityDays, setValidityDays] = useState("");
  const [reviewDays, setReviewDays] = useState("");
  const [mentor, setMentor] = useState(rec.sponsorMentor ?? "");
  const [eligNotes, setEligNotes] = useState(rec.eligibilityNotes ?? "");
  const [override, setOverride] = useState(false);
  const [score, setScore] = useState(String(rec.complianceScore));
  const [incidents, setIncidents] = useState(String(rec.incidentCount));
  const [notes, setNotes] = useState("");
  const [extendDays, setExtendDays] = useState("");
  // restrictions fields
  const r = rec.restrictions;
  const [maxHours, setMaxHours] = useState(r.maxDailyHours !== undefined ? String(r.maxDailyHours) : rec.maxDailyHours ? String(rec.maxDailyHours) : "");
  const [governor, setGovernor] = useState(rec.speedGovernorEnabled);
  const [night, setNight] = useState(rec.restrictedNightDriving);
  const [nightStart, setNightStart] = useState(nightWindowOf(r).start);
  const [nightEnd, setNightEnd] = useState(nightWindowOf(r).end);
  const [tripMiles, setTripMiles] = useState(r.maxTripDistanceMeters ? String(Math.round(metersToMiles(r.maxTripDistanceMeters) * 10) / 10) : "");

  const done = (message: string) => {
    toast.success(message);
    invalidate("second-chance", "captains");
    onClose();
  };

  const submit = async (reason: string): Promise<boolean> => {
    switch (kind) {
      case "start-review":
        await api.post(`${base}/start-review`, { reason });
        done(`Review started for ${name}`);
        return true;
      case "reject":
        await api.post(`${base}/reject`, { reason });
        done(`${name}'s Second Chance application rejected`);
        return true;
      case "resubmit":
        await api.post(`${base}/request-resubmission`, { reason });
        done(`Resubmission requested from ${name}`);
        return true;
      case "suspend":
        await api.post(`${base}/suspend`, { reason });
        done(`${name} suspended from the programme`);
        return true;
      case "revoke":
        await api.post(`${base}/revoke`, { reason });
        done(`Second Chance status revoked for ${name}`);
        return true;
      case "approve": {
        const body: Record<string, unknown> = { reason, tier };
        const t = optInt(probationTarget, "Probation ride target", 0, 1000);
        if (t !== undefined) body.probationRidesTarget = t;
        const v = optInt(validityDays, "Validity", 1, 1825);
        if (v !== undefined) body.validityDays = v;
        const rv = optInt(reviewDays, "Review interval", 1, 730);
        if (rv !== undefined) body.reviewIntervalDays = rv;
        if (mentor.trim()) body.sponsorMentor = mentor.trim();
        if (eligNotes.trim()) body.eligibilityNotes = eligNotes.trim();
        if (override) body.overrideDocuments = true;
        await api.post(`${base}/approve`, body);
        done(`${name} approved for the Second Chance programme`);
        return true;
      }
      case "review": {
        const body: Record<string, unknown> = { tier };
        if (notes.trim() || reason) body.notes = [reason, notes.trim()].filter(Boolean).join(" - ");
        const sc = optInt(score, "Compliance score", 0, 100);
        if (sc !== undefined && sc !== rec.complianceScore) body.complianceScore = sc;
        const nr = optInt(reviewDays, "Next review", 1, 730);
        if (nr !== undefined) body.nextReviewInDays = nr;
        const ex = optInt(extendDays, "Validity extension", 1, 1825);
        if (ex !== undefined) body.extendValidityDays = ex;
        await api.post(`${base}/review`, body);
        done(`Periodic review recorded for ${name}`);
        return true;
      }
      case "tier": {
        const body: Record<string, unknown> = { reason, tier };
        const t = optInt(probationTarget, "Probation ride target", 0, 1000);
        if (t !== undefined && t !== rec.probationRidesTarget) body.probationRidesTarget = t;
        const sc = optInt(score, "Compliance score", 0, 100);
        if (sc !== undefined && sc !== rec.complianceScore) body.complianceScore = sc;
        const inc = optInt(incidents, "Incident count", 0, 1000);
        if (inc !== undefined && inc !== rec.incidentCount) body.incidentCount = inc;
        if (mentor.trim() && mentor.trim() !== (rec.sponsorMentor ?? "")) body.sponsorMentor = mentor.trim();
        await api.patch(`${base}/tier`, body);
        done(`${name} moved to ${scTierLabel(tier)}`);
        return true;
      }
      case "restrictions": {
        // PUT replaces the whole object (strict schema): start from the stored one so untouched rules survive.
        const next: ScRestrictions = { ...rec.restrictions };
        delete next.maxDailyHours;
        delete next.maxTripDistanceMeters;
        delete next.restrictedNightDriving;
        delete next.nightWindow;
        if (maxHours.trim() !== "") {
          const h = Number(maxHours);
          if (!Number.isFinite(h) || h < 1 || h > 24) throw new Error("Max daily hours must be between 1 and 24");
          next.maxDailyHours = h;
        }
        if (tripMiles.trim() !== "") {
          const m = Number(tripMiles);
          const meters = Math.round(m * METERS_PER_MILE);
          if (!Number.isFinite(m) || meters < 100 || meters > 1_000_000) throw new Error("Max trip distance must be between 0.1 and 600 miles");
          next.maxTripDistanceMeters = meters;
        }
        if (night) {
          next.restrictedNightDriving = true;
          next.nightWindow = { start: nightStart, end: nightEnd };
        }
        await api.put(`${base}/restrictions`, { reason, restrictions: next, speedGovernorEnabled: governor });
        done(`Conditions updated for ${name}`);
        return true;
      }
    }
  };

  const cfg: Record<ActionKind, { title: string; description: string; confirm: string; destructive: boolean; placeholder: string; requireReason: boolean }> = {
    "start-review": { title: "Start Review", description: `Move ${name}'s application into active review.`, confirm: "Start Review", destructive: false, placeholder: "Why the review is starting (e.g. documents received)...", requireReason: true },
    approve: {
      title: rec.status === "APPLIED" || rec.status === "UNDER_REVIEW" ? "Approve Second Chance Application" : "Reinstate Second Chance Driver",
      description: `${name} will join the programme on the tier below. Core safety documents and the normal captain approval are still required separately.`,
      confirm: "Confirm Approval",
      destructive: false,
      placeholder: "Approval rationale for the audit trail...",
      requireReason: true,
    },
    reject: { title: "Reject Second Chance Application", description: `${name}'s programme application will be rejected. They can re-apply from the app.`, confirm: "Reject Application", destructive: true, placeholder: "Specify the rejection ground...", requireReason: true },
    resubmit: { title: "Request Resubmission", description: `${name} is asked to correct and re-submit the application.`, confirm: "Request Resubmission", destructive: false, placeholder: "Tell the captain what to fix...", requireReason: true },
    suspend: { title: "Suspend Programme Eligibility", description: `${name} cannot receive new rides while suspended; an active ride is never interrupted.`, confirm: "Suspend Driver", destructive: true, placeholder: "Reason for suspension (e.g. telemetry breach under investigation)...", requireReason: true },
    revoke: {
      title: "Revoke Second Chance Eligibility",
      description: `Revoking Second Chance status for ${name} terminates their probationary privileges and blocks future assignments. Only an explicit admin approval can reinstate them.`,
      confirm: "Revoke Second Chance Program",
      destructive: true,
      placeholder: "Specify reason (e.g. Critical speed telemetry breach, policy violation, failed probation milestones)...",
      requireReason: true,
    },
    review: { title: "Record Periodic Review", description: `Logs the audit date for ${name}, schedules the next review and may adjust tier or compliance score.`, confirm: "Record Review", destructive: false, placeholder: "Review summary (optional)", requireReason: false },
    tier: { title: "Change Tier", description: `Move ${name} along the tier ladder. Tier changes are audited.`, confirm: "Update Tier", destructive: false, placeholder: "Why the tier is changing (e.g. probation milestones met)...", requireReason: true },
    restrictions: { title: `Configure Conditions: ${name}`, description: "Restrictions apply to the captain's next go-online / dispatch; an active ride is not affected.", confirm: "Save Conditions", destructive: false, placeholder: "Why the conditions are changing...", requireReason: true },
  };
  const c = cfg[kind];

  const tierSelect = (
    <label className={labelCls}>
      Tier
      <select value={tier} onChange={(e) => setTier(e.target.value as ApiScTier)} className={inputCls}>
        {SC_TIERS.map((t) => (
          <option key={t} value={t}>
            {scTierLabel(t)}
          </option>
        ))}
      </select>
    </label>
  );
  const numberField = (label: string, value: string, set: (v: string) => void, placeholder = "", min = 0, max?: number) => (
    <label className={labelCls}>
      {label}
      <input type="number" min={min} max={max} value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} className={inputCls} />
    </label>
  );

  return (
    <ConfirmDialog
      isOpen
      title={c.title}
      description={c.description}
      targetEntityLabel={name}
      confirmText={c.confirm}
      isDestructive={c.destructive}
      requireReason={c.requireReason}
      minReasonLength={3}
      reasonPlaceholder={c.placeholder}
      onConfirm={submit}
      onCancel={onClose}
    >
      {kind === "approve" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {tierSelect}
            {numberField("Probation ride target", probationTarget, setProbationTarget, "0 = none", 0, 1000)}
            {numberField("Validity (days)", validityDays, setValidityDays, "Platform default", 1, 1825)}
            {numberField("Review interval (days)", reviewDays, setReviewDays, "Platform default", 1, 730)}
          </div>
          <label className={labelCls}>
            Mentor / sponsor
            <input type="text" value={mentor} onChange={(e) => setMentor(e.target.value)} maxLength={200} className={inputCls} />
          </label>
          <label className={labelCls}>
            Eligibility notes (internal)
            <textarea value={eligNotes} onChange={(e) => setEligNotes(e.target.value)} rows={2} maxLength={4000} className={inputCls} />
          </label>
          <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#F94B35]" />
            Approve even though the extra Second Chance documents are not all verified (audited)
          </label>
        </div>
      )}

      {kind === "tier" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {tierSelect}
            {numberField("Probation ride target", probationTarget, setProbationTarget, "", 0, 1000)}
            {numberField("Compliance score (%)", score, setScore, "", 0, 100)}
            {numberField("Incident count", incidents, setIncidents, "", 0, 1000)}
          </div>
          <label className={labelCls}>
            Mentor / sponsor
            <input type="text" value={mentor} onChange={(e) => setMentor(e.target.value)} maxLength={200} className={inputCls} />
          </label>
        </div>
      )}

      {kind === "review" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {tierSelect}
            {numberField("Compliance score (%)", score, setScore, "", 0, 100)}
            {numberField("Next review in (days)", reviewDays, setReviewDays, "Platform default", 1, 730)}
            {numberField("Extend validity (days)", extendDays, setExtendDays, "No change", 1, 1825)}
          </div>
          <label className={labelCls}>
            Review notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={4000} placeholder="Findings from this review..." className={inputCls} />
          </label>
        </div>
      )}

      {kind === "restrictions" && (
        <div className="space-y-3 text-xs">
          {numberField("Max daily driving hours (empty = no limit)", maxHours, setMaxHours, "No limit", 1, 24)}
          {numberField("Max trip distance, miles (empty = no limit)", tripMiles, setTripMiles, "No limit", 0)}
          <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-[#331A3B]">
            <span>Speed governor enforced (telemetry limit)</span>
            <input type="checkbox" checked={governor} onChange={(e) => setGovernor(e.target.checked)} className="h-4 w-4 accent-[#F94B35]" />
          </label>
          <div className="p-3 rounded-xl border border-slate-200 dark:border-[#331A3B] space-y-2">
            <label className="flex items-center justify-between">
              <span>Restricted night driving</span>
              <input type="checkbox" checked={night} onChange={(e) => setNight(e.target.checked)} className="h-4 w-4 accent-[#F94B35]" />
            </label>
            {night && (
              <div className="grid grid-cols-2 gap-3">
                <label className={labelCls}>
                  Night starts
                  <input type="time" value={nightStart} onChange={(e) => setNightStart(e.target.value)} className={inputCls} />
                </label>
                <label className={labelCls}>
                  Night ends
                  <input type="time" value={nightEnd} onChange={(e) => setNightEnd(e.target.value)} className={inputCls} />
                </label>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-400">Allowed hours, zones, vehicles and service types already set on the record are preserved.</p>
        </div>
      )}
    </ConfirmDialog>
  );
};

