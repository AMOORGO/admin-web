"use client";

import React from "react";
import { Banknote, Info, Lock, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { BarChart } from "@/components/ui/BarChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Money } from "@/components/ui/Money";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { StatusPill } from "@/components/ui/StatusPill";
import { earningsBars } from "@/lib/adapters/captainEarnings";
import { formatMoney, formatMoneyCompact, formatNumber, humanize } from "@/lib/format";
import type { CaptainEarningsState } from "@/lib/hooks/useCaptainProfile";

export const EarningsTab: React.FC<{ earnings: CaptainEarningsState; onOpenRide: (rideId: string) => void }> = ({ earnings, onOpenRide }) => {
  const { forbidden, query } = earnings;
  if (forbidden) {
    return (
      <Card>
        <EmptyState icon={Lock} title="Earnings are restricted" description="Earnings and payout details require the finance.view permission, which your role does not have." />
      </Card>
    );
  }
  if (query.error && !query.data) return <ErrorBanner error={query.error} title="Could not load earnings" onRetry={query.refetch} />;
  const e = query.data;
  if (!e) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading earnings">
        <div className="h-48 animate-pulse rounded-2xl bg-slate-100 dark:bg-[#211226]" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-[#211226]" />
      </div>
    );
  }
  const c = e.currency;
  const periods = [
    { label: "Today", s: e.today },
    { label: "Last 7 days", s: e.week },
    { label: "Last 30 days", s: e.month },
    { label: "Lifetime", s: e.lifetime },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Net earnings, last 14 days" description="Net of platform commission, including tips and incentives" icon={TrendingUp} />
          <div className="px-4 pb-5 sm:px-5">
            <BarChart data={earningsBars(e.daily, c)} formatValue={(v) => formatMoney(v, c)} formatTick={(v) => formatMoneyCompact(v, c)} ariaLabel="Net earnings per day over the last 14 days" valueHeader="Net earnings" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Wallet position" icon={Wallet} />
          <div className="space-y-4 px-4 pb-5 sm:px-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Withdrawable now</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#14755F] dark:text-[#4FD2B2]">{formatMoney(e.payout.withdrawableMinor, c)}</p>
            </div>
            <dl className="space-y-2.5 border-t border-[#F0E3ED] pt-3 text-sm dark:border-[#331A3B]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-700 dark:text-slate-200">Available digital earnings</dt>
                <dd className="font-bold tabular-nums text-slate-900 dark:text-white">{formatMoney(e.payout.grossAvailableMinor, c)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-700 dark:text-slate-200">Cash owed to platform</dt>
                <dd className="font-bold tabular-nums text-rose-700 dark:text-rose-300">− {formatMoney(e.payout.cashOwedMinor, c)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-700 dark:text-slate-200">Still settling (pending)</dt>
                <dd className="font-bold tabular-nums text-slate-900 dark:text-white">{formatMoney(e.week.pendingMinor, c)}</dd>
              </div>
            </dl>
            <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[13px] text-slate-600 dark:bg-[#211226] dark:text-slate-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Cash trips are paid to the captain directly; the platform&apos;s share is netted against digital earnings at payout.
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Earnings by period" description={`All amounts in ${c}`} icon={PiggyBank} />
        <div className="data-table-container border-t border-[#F0E3ED] dark:border-[#331A3B]">
          <table className="w-full min-w-[52rem] border-collapse text-left">
            <thead>
              <tr>
                <th className="px-5 py-3">Period</th>
                <th className="num px-3 py-3">Trips</th>
                <th className="num px-3 py-3">Gross fares</th>
                <th className="num px-3 py-3">Commission</th>
                <th className="num px-3 py-3">Tips</th>
                <th className="num px-3 py-3">Incentives</th>
                <th className="num px-3 py-3">Adjustments</th>
                <th className="num px-3 py-3">Net earnings</th>
                <th className="num px-5 py-3">Cash collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0E3ED] dark:divide-[#331A3B]">
              {periods.map(({ label, s }) => (
                <tr key={label}>
                  <td className="px-5 py-3 font-bold text-slate-900 dark:text-white">{label}</td>
                  <td className="num px-3 py-3 text-slate-800 dark:text-slate-100">{formatNumber(s.completedRides)}</td>
                  <td className="num px-3 py-3 text-slate-800 dark:text-slate-100">{formatMoney(s.grossMinor, c)}</td>
                  <td className="num px-3 py-3 text-slate-800 dark:text-slate-100">{formatMoney(s.commissionMinor, c)}</td>
                  <td className="num px-3 py-3 text-slate-800 dark:text-slate-100">{formatMoney(s.tipsMinor, c)}</td>
                  <td className="num px-3 py-3 text-slate-800 dark:text-slate-100">{formatMoney(s.incentivesMinor, c)}</td>
                  <td className="num px-3 py-3"><Money minor={s.adjustmentsMinor} currency={c} signed className="text-slate-800 dark:text-slate-100" /></td>
                  <td className="num px-3 py-3 text-base font-extrabold text-slate-900 dark:text-white">{formatMoney(s.netMinor, c)}</td>
                  <td className="num px-5 py-3 text-slate-800 dark:text-slate-100">{formatMoney(s.cashCollectedMinor, c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Latest earnings" description="The ten most recent completed trips" icon={Banknote} />
        {e.recent.length === 0 ? (
          <EmptyState icon={Banknote} title="No earnings yet" className="py-8" />
        ) : (
          <div className="data-table-container border-t border-[#F0E3ED] dark:border-[#331A3B]">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <thead>
                <tr>
                  <th className="px-5 py-3">Trip</th>
                  <th className="px-3 py-3">Completed</th>
                  <th className="num px-3 py-3">Gross</th>
                  <th className="num px-3 py-3">Commission</th>
                  <th className="num px-3 py-3">Tip</th>
                  <th className="num px-3 py-3">Incentive</th>
                  <th className="num px-3 py-3">Net</th>
                  <th className="px-3 py-3">Paid</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E3ED] dark:divide-[#331A3B]">
                {e.recent.map((row) => (
                  <tr key={row.rideId}>
                    <td className="px-5 py-3">
                      <button type="button" onClick={() => onOpenRide(row.rideId)} className="font-mono text-[13px] font-bold text-[#7A2B66] hover:underline dark:text-[#DB99CC]">
                        {row.rideId.slice(0, 8)}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-slate-800 dark:text-slate-100"><RelativeTime iso={row.createdAt} /></td>
                    <td className="num px-3 py-3 text-slate-800 dark:text-slate-100">{formatMoney(row.grossFareMinor, c)}</td>
                    <td className="num px-3 py-3 text-slate-800 dark:text-slate-100">{formatMoney(row.commissionMinor, c)}</td>
                    <td className="num px-3 py-3 text-slate-800 dark:text-slate-100">{formatMoney(row.tipMinor, c)}</td>
                    <td className="num px-3 py-3 text-slate-800 dark:text-slate-100">{formatMoney(row.incentiveMinor, c)}</td>
                    <td className="num px-3 py-3 font-extrabold text-slate-900 dark:text-white">{formatMoney(row.netMinor, c)}</td>
                    <td className="px-3 py-3"><StatusPill variant={row.paidInCash ? "warning" : "plum"} dot={false}>{row.paidInCash ? "Cash" : "Digital"}</StatusPill></td>
                    <td className="px-5 py-3"><StatusPill variant={row.status === "AVAILABLE" ? "teal" : "warning"}>{humanize(row.status)}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
