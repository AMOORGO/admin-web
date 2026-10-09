"use client";

import React, { useMemo } from "react";
import { AlertTriangle, ArrowRight, Banknote, CalendarDays, CheckCircle2, Coins, Gauge, Heart, Lock, PiggyBank, Route, ShieldAlert, Star, TrendingUp, Wallet, XCircle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { BarChart } from "@/components/ui/BarChart";
import { DefinitionList } from "@/components/ui/DefinitionList";
import { EmptyState } from "@/components/ui/EmptyState";
import { Money } from "@/components/ui/Money";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { type ApiCaptainDetail, displayDate, documentStatusLabel } from "@/lib/adapters/captains";
import { averagePerTrip, earningsBars } from "@/lib/adapters/captainEarnings";
import { statusLabel, statusVariant, type ApiRideListItem } from "@/lib/adapters/rides";
import { daysUntil, formatDate, formatMoney, formatMoneyCompact, formatNumber, formatPercent, humanize } from "@/lib/format";
import type { CaptainEarningsState } from "@/lib/hooks/useCaptainProfile";
import { useClock } from "@/lib/hooks/useClock";
import { availabilityLabel } from "../captainUi";
import type { CaptainTab } from "../captainUi";

interface OverviewTabProps {
  captain: ApiCaptainDetail;
  earnings: CaptainEarningsState;
  trips: { items: ApiRideListItem[]; initialLoading: boolean; forbidden: boolean };
  setTab: (t: CaptainTab) => void;
  onOpenRide: (rideId: string) => void;
  cityName: string;
}

interface AlertItem {
  key: string;
  tone: "danger" | "warning" | "info";
  title: string;
  detail: string;
  tab: CaptainTab;
}

/** What needs attention on this captain: expiring / expired / rejected documents, missing items, vehicles, status notes. */
function buildAlerts(c: ApiCaptainDetail, now: number): AlertItem[] {
  const out: AlertItem[] = [];
  for (const item of c.documentChecklist) {
    if (item.state === "OK") {
      const d = item.daysToExpiry ?? daysUntil(item.expiresAt, now);
      if (d !== null && d <= 30) out.push({ key: `exp:${item.documentType}`, tone: d <= 14 ? "danger" : "warning", title: `${item.label} expires ${d <= 0 ? "today" : `in ${d} ${d === 1 ? "day" : "days"}`}`, detail: `Valid until ${displayDate(item.expiresAt)}. Ask the captain to upload a renewal.`, tab: "documents" });
    } else if (item.state === "EXPIRED") {
      out.push({ key: `expired:${item.documentType}`, tone: "danger", title: `${item.label} has expired`, detail: "The captain cannot drive until a replacement is verified.", tab: "documents" });
    } else if (item.state === "REJECTED" || item.state === "RESUBMISSION_REQUESTED") {
      out.push({ key: `rej:${item.documentType}`, tone: "warning", title: `${item.label}: ${documentStatusLabel(item.state === "REJECTED" ? "REJECTED" : "RESUBMISSION_REQUESTED").toLowerCase()}`, detail: item.rejectionReason ?? "Waiting for a new upload.", tab: "documents" });
    } else if (item.state === "PENDING") {
      out.push({ key: `pend:${item.documentType}`, tone: "info", title: `${item.label} awaiting review`, detail: "Uploaded and waiting for a reviewer decision.", tab: "documents" });
    } else if (item.state === "MISSING") {
      out.push({ key: `miss:${item.documentType}`, tone: "warning", title: `${item.label} not uploaded`, detail: "Required before the captain can be approved.", tab: "documents" });
    }
  }
  for (const v of c.vehicles) {
    if (v.status === "PENDING_REVIEW") out.push({ key: `veh:${v.id}`, tone: "info", title: `Vehicle ${v.plateNumber} awaiting review`, detail: `${v.make} ${v.model} (${v.year})`, tab: "vehicles" });
  }
  if (c.status === "SUSPENDED") out.push({ key: "susp", tone: "danger", title: "Account suspended", detail: `${c.statusReason ?? "No reason recorded."}${c.suspendedUntil ? ` Ends ${displayDate(c.suspendedUntil)}.` : ""}`, tab: "activity" });
  if (c.flagged) out.push({ key: "flag", tone: "warning", title: "Flagged for review", detail: "This captain was flagged by operations or safety.", tab: "activity" });
  return out;
}

const TONE_ICON = { danger: XCircle, warning: AlertTriangle, info: ShieldAlert } as const;
const TONE_CLS = {
  danger: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-100",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100",
  info: "border-[#E9BFDF] bg-[#FAF0F7] text-[#3A102F] dark:border-[#521A44] dark:bg-[#331A3B]/50 dark:text-[#F5E2F0]",
} as const;

export const OverviewTab: React.FC<OverviewTabProps> = ({ captain, earnings, trips, setTab, onOpenRide, cityName }) => {
  const now = useClock();
  const m = captain.metrics;
  const e = earnings.query.data;
  const currency = e?.currency ?? "USD";
  const loadingMoney = !earnings.forbidden && earnings.query.initialLoading;
  const alerts = useMemo(() => buildAlerts(captain, now), [captain, now]);

  const series = e?.daily ?? [];
  const last7 = series.slice(7).reduce((a, d) => a + d.netMinor, 0);
  const prev7 = series.slice(0, 7).reduce((a, d) => a + d.netMinor, 0);
  const weekDelta = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : null;
  const sparkValues = series.map((d) => d.netMinor);
  const bestDay = series.reduce((best, d) => (d.netMinor > best.netMinor ? d : best), series[0] ?? { netMinor: 0, date: "", rides: 0, tipsMinor: 0, cashMinor: 0, isToday: false });
  const commissionPct = e && e.month.grossMinor > 0 ? (e.month.commissionMinor / e.month.grossMinor) * 100 : null;

  const facts = [
    { label: "Phone", value: captain.phone, mono: true },
    { label: "Email", value: captain.email },
    { label: "City", value: cityName },
    { label: "Address", value: [captain.address.addressLine, captain.address.city, captain.address.state, captain.address.postalCode].filter(Boolean).join(", ") },
    { label: "Member since", value: formatDate(captain.joinedAt) },
    { label: "Application submitted", value: displayDate(captain.submittedAt) },
    { label: "Approved", value: captain.approvedAt ? `${displayDate(captain.approvedAt)}${captain.approvedBy ? ` by ${captain.approvedBy}` : ""}` : "Not approved yet" },
    { label: "Last online", value: captain.lastOnlineAt ? <RelativeTime iso={captain.lastOnlineAt} /> : "Never" },
    { label: "Availability", value: availabilityLabel(captain.availability, captain.onRide) },
    { label: "Service types", value: captain.serviceTypes.filter((s) => s.enabled).map((s) => s.name).join(", ") || "None enabled" },
    { label: "Payouts", value: captain.payoutsEnabled ? "Enabled" : "Not enabled" },
    { label: "Eligibility", value: captain.eligibility.eligible ? "Eligible to drive" : captain.eligibility.reasons.slice(0, 2).join("; ") || "Not eligible yet" },
  ];

  return (
    <div className="space-y-6">
      {/* Earnings */}
      <section aria-labelledby="ov-earnings" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="ov-earnings" className="text-base font-bold text-slate-900 dark:text-white">
            Earnings
          </h2>
          {e && <span className="text-[13px] text-slate-600 dark:text-slate-300">All amounts net of platform commission, in {currency}.</span>}
        </div>
        {earnings.forbidden ? (
          <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-700 dark:border-[#4B2757] dark:bg-[#180D1C] dark:text-slate-200">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>Earnings and payout figures are not shown for your role. They require the <strong>finance.view</strong> permission.</p>
          </div>
        ) : earnings.query.error && !e ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">Could not load earnings: {earnings.query.error.message}</p>
        ) : (
          <StatGrid cols={3}>
            <StatCard label="Today's net earnings" icon={Coins} tone="good" loading={loadingMoney} value={e ? <Money minor={e.today.netMinor} currency={currency} /> : "—"} hint={e ? (e.today.completedRides > 0 ? `${e.today.completedRides} ${e.today.completedRides === 1 ? "trip" : "trips"} • ${formatMoney(averagePerTrip(e.today), currency)} avg` : "No trips yet today") : undefined} />
            <StatCard label="Last 7 days" icon={CalendarDays} tone="brand" loading={loadingMoney} value={e ? <Money minor={e.week.netMinor} currency={currency} /> : "—"} delta={e && prev7 > 0 ? { pct: weekDelta } : undefined} hint={e ? `${e.week.completedRides} trips` : undefined} spark={sparkValues} sparkLabel="Net earnings per day, last 14 days" />
            <StatCard label="Last 30 days" icon={TrendingUp} tone="brand" loading={loadingMoney} value={e ? <Money minor={e.month.netMinor} currency={currency} /> : "—"} hint={e ? `${e.month.completedRides} trips • ${formatMoney(averagePerTrip(e.month), currency)} avg` : undefined} />
            <StatCard label="Lifetime net earnings" icon={PiggyBank} tone="info" size="lg" loading={loadingMoney} value={e ? <Money minor={e.lifetime.netMinor} currency={currency} /> : "—"} hint={e ? `${formatNumber(e.lifetime.completedRides)} trips completed` : undefined} />
            <StatCard label="Gross fares (30 days)" icon={Banknote} tone="neutral" loading={loadingMoney} value={e ? <Money minor={e.month.grossMinor} currency={currency} /> : "—"} hint={e ? `Platform commission ${formatMoney(e.month.commissionMinor, currency)}${commissionPct !== null ? ` (${formatPercent(commissionPct, 0)})` : ""}` : undefined} />
            <StatCard label="Tips & incentives (30 days)" icon={Star} tone="warn" loading={loadingMoney} value={e ? <Money minor={e.month.tipsMinor + e.month.incentivesMinor} currency={currency} /> : "—"} hint={e ? `Tips ${formatMoney(e.month.tipsMinor, currency)} • Incentives ${formatMoney(e.month.incentivesMinor, currency)}` : undefined} />
            <StatCard label="Withdrawable balance" icon={Wallet} tone="good" loading={loadingMoney} value={e ? <Money minor={e.payout.withdrawableMinor} currency={currency} /> : "—"} hint={e ? `${formatMoney(e.payout.grossAvailableMinor, currency)} available digital earnings` : undefined} />
            <StatCard label="Cash owed to platform" icon={Banknote} tone={e && e.cashOwedMinor > 0 ? "warn" : "neutral"} loading={loadingMoney} value={e ? <Money minor={e.cashOwedMinor} currency={currency} /> : "—"} hint={e ? (e.cashOwedMinor > 0 ? "Netted against the next payout" : "Nothing owed") : undefined} />
          </StatGrid>
        )}
      </section>

      {/* Performance */}
      <section aria-labelledby="ov-perf" className="space-y-3">
        <h2 id="ov-perf" className="text-base font-bold text-slate-900 dark:text-white">
          Service quality
        </h2>
        <StatGrid cols={4}>
          <StatCard label="Total trips" icon={Route} tone="info" value={formatNumber(m.totalTrips)} hint={`${formatNumber(m.ridesCancelled)} cancelled by the captain`} />
          <StatCard label="Acceptance rate" icon={CheckCircle2} tone={m.acceptanceRate >= 0.85 ? "good" : "warn"} value={formatPercent(m.acceptanceRate * 100)} hint={`${formatNumber(m.offersAccepted)} of ${formatNumber(m.offersReceived)} offers`} />
          <StatCard label="Cancellation rate" icon={Gauge} tone={m.cancellationRate <= 0.05 ? "good" : "bad"} value={formatPercent(m.cancellationRate * 100)} hint={`${formatNumber(m.offersMissed)} offers missed`} />
          <StatCard label="Average rating" icon={Star} tone="warn" value={m.ratingCount > 0 ? `${m.rating.toFixed(2)} ★` : "—"} hint={`${formatNumber(m.ratingCount)} ratings`} />
        </StatGrid>
      </section>

      {/* Chart */}
      {!earnings.forbidden && (
        <Card>
          <CardHeader
            title="Net earnings, last 14 days"
            description={e && bestDay.netMinor > 0 ? `Best day ${bestDay.date ? formatDate(bestDay.date) : ""}: ${formatMoney(bestDay.netMinor, currency)} from ${bestDay.rides} trips` : "Daily net earnings including tips and incentives"}
            icon={TrendingUp}
            actions={
              <button type="button" onClick={() => setTab("earnings")} className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-[#7A2B66] hover:underline dark:text-[#DB99CC]">
                Earnings &amp; payouts <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            }
          />
          <div className="px-4 pb-5 sm:px-5">
            {e ? (
              <BarChart data={earningsBars(e.daily, currency)} formatValue={(v) => formatMoney(v, currency)} formatTick={(v) => formatMoneyCompact(v, currency)} ariaLabel="Net earnings per day over the last 14 days" valueHeader="Net earnings" />
            ) : (
              <div className="h-56 animate-pulse rounded-xl bg-slate-100 dark:bg-[#211226]" role="status" aria-label="Loading chart" />
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Facts */}
        <Card>
          <CardHeader title="Profile" icon={Heart} description={captain.isSecondChance ? `AmoorGo Second Chance${captain.secondChance ? `: ${humanize(captain.secondChance.status)} • ${humanize(captain.secondChance.tier)}` : ""}` : undefined} />
          <div className="px-4 pb-5 sm:px-5">
            <DefinitionList items={facts} columns={2} />
          </div>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader title="Needs attention" icon={ShieldAlert} description={alerts.length > 0 ? `${alerts.length} open ${alerts.length === 1 ? "item" : "items"}` : undefined} />
          <div className="px-4 pb-5 sm:px-5">
            {alerts.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Nothing needs attention" description="Documents are valid and no open review items for this captain." className="py-6" />
            ) : (
              <ul className="space-y-2.5">
                {alerts.map((a) => {
                  const Icon = TONE_ICON[a.tone];
                  return (
                    <li key={a.key}>
                      <button type="button" onClick={() => setTab(a.tab)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:brightness-95 ${TONE_CLS[a.tone]}`}>
                        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold">{a.title}</span>
                          <span className="block text-[13px] opacity-90">{a.detail}</span>
                        </span>
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* Latest trips */}
      {!trips.forbidden && (
        <Card>
          <CardHeader
            title="Latest trips"
            icon={Route}
            actions={
              <button type="button" onClick={() => setTab("trips")} className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-[#7A2B66] hover:underline dark:text-[#DB99CC]">
                View all trips <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            }
          />
          {trips.initialLoading ? (
            <div className="space-y-2 px-5 pb-5" role="status" aria-label="Loading trips">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-11 animate-pulse rounded-lg bg-slate-100 dark:bg-[#211226]" />
              ))}
            </div>
          ) : trips.items.length === 0 ? (
            <EmptyState icon={Route} title="No trips yet" description="Trips will appear here once this captain takes rides." className="py-6" />
          ) : (
            <ul className="divide-y divide-[#F0E3ED] border-t border-[#F0E3ED] dark:divide-[#331A3B] dark:border-[#331A3B]">
              {trips.items.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => onOpenRide(r.id)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#FAF0F7]/60 dark:hover:bg-[#28162E]/50 sm:px-5">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 text-sm font-bold text-slate-900 dark:text-white">
                        <span className="font-mono">{r.bookingRef}</span>
                        <StatusPill variant={statusVariant(r.status)}>{statusLabel(r.status)}</StatusPill>
                      </span>
                      <span className="block truncate text-[13px] text-slate-600 dark:text-slate-300">
                        {r.pickupAddress ?? "—"} → {r.dropAddress ?? "—"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <Money minor={r.finalFareMinor ?? r.estimatedFareMinor} currency={r.currency} className="block text-sm font-bold text-slate-900 dark:text-white" />
                      <RelativeTime iso={r.requestedAt} className="text-xs text-slate-600 dark:text-slate-300" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
};
