"use client";

import React, { useMemo, useState } from "react";
import { Download, Layers, RefreshCw, Search, ShieldCheck, AlertTriangle, Landmark } from "lucide-react";
import { Badge, BadgeVariant } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState, LoadMore } from "@/components/ui/EmptyState";
import { CardsSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, saveBlob } from "@/lib/api";
import { useCities } from "@/lib/cities/CityProvider";
import { formatDateTime, formatMoney, humanize } from "@/lib/format";
import { useCursorList, useQuery } from "@/lib/hooks/useQuery";
import { invalidate, useOnInvalidate } from "@/lib/invalidate";
import { useParties } from "@/lib/finance/useParties";
import {
  ApiDiscrepancies,
  ApiFinanceSummary,
  ApiLedgerAccount,
  ApiLedgerEntry,
  ApiPayment,
  ApiPayout,
  ApiPayoutBatch,
  ApiRefund,
  ApiRefundStatus,
  ApiTransaction,
  ApiPayoutStatus,
  ApiTransactionStatus,
  ApiTransactionType,
  DISCREPANCY_LABELS,
  LEDGER_ACCOUNT_TYPES,
  PAYOUT_STATUSES,
  REFUND_STATUSES,
  TRANSACTION_GATEWAYS,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  RefundView,
  shortId,
  toKpis,
  toPayoutBatch,
  toRefund,
  toTransaction,
} from "@/lib/adapters/finance";

interface FinanceViewProps {
  selectedCityId: string | null;
}

type FinanceTab = "TRANSACTIONS" | "PAYOUTS" | "REFUNDS" | "RECONCILIATION";

const CARD = "rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] shadow-xs";
const TH = "py-3 px-4";
const THEAD = "border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 font-bold uppercase tracking-wider text-[10px]";
const SELECT = "rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200";

const txStatusVariant = (s: ApiTransactionStatus): BadgeVariant => (s === "SUCCESS" ? "teal" : s === "PENDING" ? "warning" : "coral");
const refundStatusVariant = (s: ApiRefundStatus): BadgeVariant =>
  s === "PROCESSED" ? "teal" : s === "PENDING" || s === "APPROVED" || s === "PROCESSING" ? "warning" : "coral";
const payoutStatusVariant = (s: ApiPayoutStatus): BadgeVariant => (s === "COMPLETED" ? "teal" : s === "FAILED" ? "coral" : "warning");
/** Types where money leaves the platform: shown with a minus sign. */
const isOutflow = (t: ApiTransactionType) => t === "REFUND" || t === "PAYOUT";

const money = (minor: number, currency = "USD") => formatMoney(minor, currency);

export const FinanceView: React.FC<FinanceViewProps> = ({ selectedCityId }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<FinanceTab>("TRANSACTIONS");
  const [rangeDays, setRangeDays] = useState(30);
  const [exporting, setExporting] = useState<string | null>(null);

  // Financial health strip: summary of the selected range + pending refund queue size.
  const summary = useQuery<ApiFinanceSummary>(`finance-summary:${rangeDays}`, (signal) =>
    api.get<ApiFinanceSummary>("/admin/finance/summary", { query: { from: new Date(Date.now() - rangeDays * 86_400_000).toISOString() }, signal }),
  );
  const pendingRefunds = useQuery<{ count: number; more: boolean }>("finance-pending-refunds", async (signal) => {
    const p = await api.getPage<ApiRefund>("/admin/refunds", { query: { status: "PENDING", limit: 100 }, signal });
    return { count: p.items.length, more: p.nextCursor !== null };
  });
  useOnInvalidate("finance", () => {
    summary.refetch();
    pendingRefunds.refetch();
  });

  const kpis = summary.data ? toKpis(summary.data) : null;

  const exportCsv = async (report: "payments" | "revenue") => {
    setExporting(report);
    try {
      const from = new Date(Date.now() - rangeDays * 86_400_000).toISOString();
      const file = await api.download(`/admin/reports/${report}`, { query: { format: "csv", from, to: new Date().toISOString(), cityId: selectedCityId ?? undefined } }, `amoorgo-${report}.csv`);
      saveBlob(file);
      toast.success(`${humanize(report)} report exported`);
    } catch (e) {
      toast.error(e);
    } finally {
      setExporting(null);
    }
  };

  const tabClass = (tab: FinanceTab) =>
    `pb-3 border-b-2 transition-all whitespace-nowrap ${
      activeTab === tab
        ? "border-[#3A102F] text-[#3A102F] dark:border-[#A74490] dark:text-[#E9BFDF]"
        : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
    }`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Finance, Ledger & Settlements</h1>
          <p className="text-xs text-slate-500">
            Double-entry ledger integrity, gateway transactions, captain payout batches, and refund disputes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Summary period" value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))} className={SELECT}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <Can permission="reports.export">
            <button
              type="button"
              onClick={() => exportCsv("payments")}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#331A3B] px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#28162E] disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting === "payments" ? "Exporting…" : "Payments CSV"}
            </button>
            <button
              type="button"
              onClick={() => exportCsv("revenue")}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#331A3B] px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#28162E] disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting === "revenue" ? "Exporting…" : "Revenue CSV"}
            </button>
          </Can>
        </div>
      </div>

      {/* Financial Health Strip */}
      {summary.error && !summary.data && <ErrorBanner error={summary.error} title="Could not load the finance summary" onRetry={summary.refetch} />}
      {summary.initialLoading ? (
        <CardsSkeleton count={4} />
      ) : (
        kpis && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className={`${CARD} p-4 space-y-1`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gross Bookings (GMV)</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{money(kpis.gmvMinor)}</p>
              <span className="text-[11px] font-medium text-slate-500">Settled fares & fees, last {rangeDays} days</span>
            </div>
            <div className={`${CARD} p-4 space-y-1`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Platform Net Take</span>
              <p className="text-2xl font-black text-[#7A2B66] dark:text-[#DB99CC]">{money(kpis.platformNetMinor)}</p>
              <span className="text-[11px] font-medium text-slate-500">Ledger revenue balance {money(kpis.platformRevenueBalanceMinor)}</span>
            </div>
            <div className={`${CARD} p-4 space-y-1`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Captain Payouts In Flight</span>
              <p className="text-2xl font-black text-[#189578]">{money(kpis.openPayoutMinor)}</p>
              <span className="text-[11px] font-medium text-slate-500">{kpis.openPayoutCount} pending / processing payouts</span>
            </div>
            <div className={`${CARD} p-4 space-y-1`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Refund Disputes</span>
              <p className="text-2xl font-black text-[#F94B35]">
                {pendingRefunds.data ? `${pendingRefunds.data.count}${pendingRefunds.data.more ? "+" : ""}` : "—"} Pending
              </p>
              <span className="text-[11px] font-medium text-slate-500">Refunded {money(kpis.refundedMinor)} in period</span>
            </div>
          </div>
        )
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#F0E3ED] dark:border-[#331A3B] gap-6 text-xs font-bold overflow-x-auto">
        <button onClick={() => setActiveTab("TRANSACTIONS")} className={tabClass("TRANSACTIONS")}>
          Payment Transactions
        </button>
        <button onClick={() => setActiveTab("PAYOUTS")} className={tabClass("PAYOUTS")}>
          Captain Payout Batches
        </button>
        <button onClick={() => setActiveTab("REFUNDS")} className={tabClass("REFUNDS")}>
          Refund Requests
          {pendingRefunds.data && pendingRefunds.data.count > 0 && (
            <span className="ml-2 rounded-full bg-[#F94B35] px-1.5 py-0.5 text-[10px] text-white">
              {pendingRefunds.data.count}
              {pendingRefunds.data.more ? "+" : ""}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab("RECONCILIATION")} className={tabClass("RECONCILIATION")}>
          Reconciliation & Ledger
        </button>
      </div>

      {selectedCityId && activeTab !== "TRANSACTIONS" && activeTab !== "PAYOUTS" && (
        <p className="text-[11px] text-slate-400">The city filter applies to transactions and payout batches; this tab is platform-wide.</p>
      )}

      {activeTab === "TRANSACTIONS" && <TransactionsTab selectedCityId={selectedCityId} />}
      {activeTab === "PAYOUTS" && <PayoutsTab selectedCityId={selectedCityId} />}
      {activeTab === "REFUNDS" && <RefundsTab />}
      {activeTab === "RECONCILIATION" && <ReconciliationTab summary={summary.data} rangeDays={rangeDays} />}
    </div>
  );
};

// ───────────────────────────── Transactions ─────────────────────────────

const TransactionsTab: React.FC<{ selectedCityId: string | null }> = ({ selectedCityId }) => {
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [gateway, setGateway] = useState("");
  const [search, setSearch] = useState("");
  const list = useCursorList<ApiTransaction>(
    "/admin/transactions",
    { type: type || undefined, status: status || undefined, gateway: gateway || undefined, cityId: selectedCityId ?? undefined },
    { limit: 25 },
  );
  useOnInvalidate("finance", list.refetch);

  const rows = useMemo(() => list.items.map(toTransaction), [list.items]);
  const parties = useParties({
    rides: rows.map((r) => r.rideId),
    users: rows.filter((r) => !r.rideId).map((r) => r.riderId),
    captains: rows.filter((r) => !r.rideId).map((r) => r.captainId),
  });

  const view = rows.map((t) => {
    const rp = parties.ride(t.rideId);
    return {
      ...t,
      rideRef: rp?.ref ?? (t.rideId ? shortId(t.rideId) : "—"),
      customerName: rp?.riderName || parties.user(t.riderId) || (t.riderId ? `Rider ${shortId(t.riderId)}` : "—"),
      captainName: rp?.captainName || parties.captain(t.captainId) || (t.captainId ? `Captain ${shortId(t.captainId)}` : "—"),
    };
  });
  const term = search.trim().toLowerCase();
  const filtered = term
    ? view.filter((t) => [t.id, t.rideRef, t.customerName, t.captainName, t.description ?? ""].some((v) => v.toLowerCase().includes(term)))
    : view;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search loaded rows: txn, ride, name…"
            className="w-64 rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] py-2 pl-8 pr-3 text-xs dark:text-white"
          />
        </div>
        <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} className={SELECT}>
          <option value="">All types</option>
          {TRANSACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {humanize(t)}
            </option>
          ))}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={SELECT}>
          <option value="">All statuses</option>
          {TRANSACTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </select>
        <select aria-label="Gateway" value={gateway} onChange={(e) => setGateway(e.target.value)} className={SELECT}>
          <option value="">All gateways</option>
          {TRANSACTION_GATEWAYS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {list.error && <ErrorBanner error={list.error} title="Could not load transactions" onRetry={list.refetch} />}
      <div className={`${CARD} overflow-hidden`}>
        {list.initialLoading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : filtered.length === 0 && !list.error ? (
          <EmptyState title="No transactions" description="Nothing matches the current filters." icon={Landmark} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={THEAD}>
                  <th className={TH}>Txn ID</th>
                  <th className={TH}>Ride Ref</th>
                  <th className={TH}>Gateway</th>
                  <th className={TH}>Type</th>
                  <th className={TH}>Customer / Captain</th>
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={`${TH} text-right`}>Platform Cut</th>
                  <th className={`${TH} text-center`}>Status</th>
                  <th className={TH}>Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
                {filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-[#28162E]/30">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200" title={tx.id}>
                      {shortId(tx.id)}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#7A2B66] dark:text-[#DB99CC]" title={tx.rideId ?? undefined}>
                      {tx.rideRef}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="plum" size="sm">
                        {tx.gateway}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">{humanize(tx.type)}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 dark:text-white">{tx.customerName}</span>
                      <p className="text-[10px] text-slate-400">to {tx.captainName}</p>
                    </td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${isOutflow(tx.type) ? "text-rose-600" : "text-slate-900 dark:text-white"}`}>
                      {isOutflow(tx.type) ? "-" : ""}
                      {money(tx.amountMinor, tx.currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[#189578] font-semibold">{money(tx.platformFeeMinor, tx.currency)}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={txStatusVariant(tx.status)} size="sm">
                        {tx.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{formatDateTime(tx.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </div>
    </div>
  );
};

// ───────────────────────────── Payouts ─────────────────────────────

const PayoutsTab: React.FC<{ selectedCityId: string | null }> = ({ selectedCityId }) => {
  const toast = useToast();
  const { cities, cityName } = useCities();
  const [batchFilter, setBatchFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchCityId, setBatchCityId] = useState("");
  const [retryTarget, setRetryTarget] = useState<ApiPayout | null>(null);

  const batches = useCursorList<ApiPayoutBatch>("/admin/payout-batches", {}, { limit: 10 });
  const payouts = useCursorList<ApiPayout>("/admin/payouts", { status: statusFilter || undefined, batchId: batchFilter ?? undefined }, { limit: 25 });
  useOnInvalidate("finance", () => {
    batches.refetch();
    payouts.refetch();
  });

  const batchViews = useMemo(
    () => batches.items.map((b) => toPayoutBatch(b, cityName)).filter((b) => !selectedCityId || b.cityId === null || b.cityId === selectedCityId),
    [batches.items, cityName, selectedCityId],
  );
  const batchNumbers = useMemo(() => new Map(batches.items.map((b) => [b.id, b.batchNumber])), [batches.items]);
  const parties = useParties({ captains: payouts.items.map((p) => p.captainId) });

  const runBatch = async (reason: string) => {
    const created = await api.post<ApiPayoutBatch>("/admin/payouts/batch", { reason, cityId: batchCityId || undefined });
    toast.success(`Payout batch ${created.batchNumber} created for ${created.totalCaptains} captain(s)`);
    setShowBatchDialog(false);
    setBatchCityId("");
    invalidate("finance");
  };

  const retry = async (reason: string) => {
    if (!retryTarget) return;
    await api.post(`/admin/payouts/${retryTarget.id}/retry`, { reason });
    toast.success("Payout retry queued as a fresh payout");
    setRetryTarget(null);
    invalidate("finance");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#7A2B66]" />
          Settlement Batches
        </h2>
        <Can permission="finance.payouts">
          <button
            type="button"
            onClick={() => {
              setBatchCityId(selectedCityId ?? "");
              setShowBatchDialog(true);
            }}
            className="rounded-xl bg-[#3A102F] text-white px-4 py-2 text-xs font-bold hover:bg-[#521A44] transition-all"
          >
            Run Payout Batch
          </button>
        </Can>
      </div>

      {batches.error && <ErrorBanner error={batches.error} title="Could not load payout batches" onRetry={batches.refetch} />}
      {batches.initialLoading ? (
        <CardsSkeleton count={2} />
      ) : batchViews.length === 0 && !batches.error ? (
        <div className={CARD}>
          <EmptyState title="No payout batches yet" description="Batches are created by the weekly schedule or by running one manually." icon={Layers} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {batchViews.map((batch) => (
              <div key={batch.id} className={`${CARD} p-5 space-y-4 ${batchFilter === batch.id ? "ring-2 ring-[#7A2B66]" : ""}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{batch.batchNumber}</h3>
                    <p className="text-xs text-slate-500">City: {batch.city}</p>
                  </div>
                  <Badge variant={batch.status === "COMPLETED" ? "teal" : batch.status === "FAILED" ? "coral" : "warning"} size="sm">
                    {batch.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-center">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#211226]">
                    <span className="text-[10px] text-slate-400 uppercase">Captains</span>
                    <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">{batch.totalCaptains}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#211226]">
                    <span className="text-[10px] text-slate-400 uppercase">Gross Payable</span>
                    <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">{money(batch.grossMinor, batch.currency)}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#EFFCF9] dark:bg-[#0D2620]">
                    <span className="text-[10px] text-slate-400 uppercase">Net Settlement</span>
                    <p className="font-mono font-bold text-[#14755F] dark:text-[#82E5CB] mt-0.5">{money(batch.netMinor, batch.currency)}</p>
                  </div>
                </div>
                {batch.commissionOffsetMinor > 0 && (
                  <p className="text-[11px] text-slate-500">Cash commission netted: {money(batch.commissionOffsetMinor, batch.currency)}</p>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-[#331A3B] flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Generated: {formatDateTime(batch.generatedAt)}</span>
                  <button
                    type="button"
                    onClick={() => setBatchFilter(batchFilter === batch.id ? null : batch.id)}
                    className="rounded-lg bg-[#FAF0F7] dark:bg-[#331A3B] px-3 py-1 text-[11px] font-bold text-[#521A44] dark:text-[#E9BFDF] hover:bg-[#E9BFDF]/50"
                  >
                    {batchFilter === batch.id ? "Show all payouts" : "View payouts"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <LoadMore hasMore={batches.hasMore} loading={batches.loadingMore} onClick={batches.loadMore} />
        </div>
      )}

      {/* Individual payouts */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Payouts{batchFilter ? ` in ${batchNumbers.get(batchFilter) ?? shortId(batchFilter)}` : ""}
          </h2>
          <select aria-label="Payout status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={SELECT}>
            <option value="">All statuses</option>
            {PAYOUT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        </div>
        {payouts.error && <ErrorBanner error={payouts.error} title="Could not load payouts" onRetry={payouts.refetch} />}
        <div className={`${CARD} overflow-hidden`}>
          {payouts.initialLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : payouts.items.length === 0 && !payouts.error ? (
            <EmptyState title="No payouts" description="No payouts match the current filters." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className={THEAD}>
                    <th className={TH}>Payout ID</th>
                    <th className={TH}>Captain</th>
                    <th className={TH}>Batch</th>
                    <th className={TH}>Requested By</th>
                    <th className={`${TH} text-right`}>Amount</th>
                    <th className={`${TH} text-center`}>Status</th>
                    <th className={TH}>Requested</th>
                    <th className={`${TH} text-center`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
                  {payouts.items.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-[#28162E]/30">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200" title={p.id}>
                        {shortId(p.id)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{parties.captain(p.captainId) ?? `Captain ${shortId(p.captainId)}`}</td>
                      <td className="py-3 px-4 font-mono text-[#7A2B66] dark:text-[#DB99CC]">{p.batchId ? (batchNumbers.get(p.batchId) ?? shortId(p.batchId)) : "On demand"}</td>
                      <td className="py-3 px-4 text-slate-500">{humanize(p.requestedBy)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">{money(p.amountMinor, p.currency)}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={payoutStatusVariant(p.status)} size="sm">
                          {p.status}
                        </Badge>
                        {p.failureReason && <p className="mt-1 max-w-[220px] text-[10px] text-rose-600 break-words">{p.failureReason}</p>}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{formatDateTime(p.requestedAt)}</td>
                      <td className="py-3 px-4 text-center">
                        {p.status === "FAILED" ? (
                          <Can permission="finance.payouts">
                            <button
                              type="button"
                              onClick={() => setRetryTarget(p)}
                              className="rounded-lg bg-amber-50 text-amber-700 px-2.5 py-1 text-xs font-bold hover:bg-amber-100"
                            >
                              Retry
                            </button>
                          </Can>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <LoadMore hasMore={payouts.hasMore} loading={payouts.loadingMore} onClick={payouts.loadMore} />
        </div>
      </div>

      <ConfirmDialog
        isOpen={showBatchDialog}
        title="Run Captain Payout Batch"
        description="Pays out every captain whose available earnings reach the minimum withdrawal. Cash commission owed is netted first. This triggers provider transfers and cannot be undone."
        targetEntityLabel={batchCityId ? cityName(batchCityId) : "All cities"}
        confirmText="Create Payout Batch"
        isDestructive={false}
        requireReason={true}
        reasonPlaceholder="Treasury approval reference or audit note..."
        onConfirm={runBatch}
        onCancel={() => setShowBatchDialog(false)}
      >
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">City (optional)</label>
          <select value={batchCityId} onChange={(e) => setBatchCityId(e.target.value)} className={`${SELECT} w-full`}>
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={retryTarget !== null}
        title="Retry Failed Payout"
        description={
          retryTarget
            ? `Creates a fresh payout for whatever ${parties.captain(retryTarget.captainId) ?? "the captain"} has available now (the failed ${money(retryTarget.amountMinor, retryTarget.currency)} was already returned to their balance).`
            : ""
        }
        targetEntityLabel={retryTarget ? shortId(retryTarget.id) : undefined}
        confirmText="Retry Payout"
        isDestructive={false}
        requireReason={true}
        reasonPlaceholder="Why is the retry safe now (bank details fixed, provider outage over...)?"
        onConfirm={retry}
        onCancel={() => setRetryTarget(null)}
      />
    </div>
  );
};

// ───────────────────────────── Refunds ─────────────────────────────

const RefundsTab: React.FC = () => {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState("");
  const [target, setTarget] = useState<{ refund: RefundView; mode: "approve" | "reject" } | null>(null);
  const list = useCursorList<ApiRefund>("/admin/refunds", { status: statusFilter || undefined }, { limit: 25 });
  useOnInvalidate("finance", list.refetch);

  const rows = useMemo(() => list.items.map(toRefund), [list.items]);
  const parties = useParties({ rides: rows.map((r) => r.rideId) });

  const submit = async (reason: string) => {
    if (!target) return;
    const { refund, mode } = target;
    const result = await api.post<ApiRefund>(`/admin/refunds/${refund.id}/${mode}`, { reason });
    if (mode === "approve" && result.status === "FAILED") {
      toast.error(`Refund could not be processed: ${result.failureReason ?? "provider refused the refund"}`);
    } else {
      toast.success(mode === "approve" ? "Refund approved and executed" : "Refund claim rejected");
    }
    setTarget(null);
    invalidate("finance");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select aria-label="Refund status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={SELECT}>
          <option value="">All statuses</option>
          {REFUND_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </select>
      </div>
      {list.error && <ErrorBanner error={list.error} title="Could not load refunds" onRetry={list.refetch} />}
      <div className={`${CARD} overflow-hidden`}>
        {list.initialLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : rows.length === 0 && !list.error ? (
          <EmptyState title="No refund requests" description="Nothing matches the current filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={THEAD}>
                  <th className={TH}>Refund ID</th>
                  <th className={TH}>Ride</th>
                  <th className={TH}>Passenger</th>
                  <th className={TH}>Category</th>
                  <th className={TH}>Claim Reason</th>
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={`${TH} text-center`}>Status</th>
                  <th className={`${TH} text-center`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
                {rows.map((ref) => {
                  const rp = parties.ride(ref.rideId);
                  return (
                    <tr key={ref.id} className="hover:bg-slate-50 dark:hover:bg-[#28162E]/30">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200" title={ref.id}>
                        {shortId(ref.id)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#7A2B66] dark:text-[#DB99CC]" title={ref.rideId ?? undefined}>
                        {rp?.ref ?? (ref.rideId ? shortId(ref.rideId) : "—")}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 dark:text-white">{rp?.riderName || "—"}</span>
                        <p className="text-[10px] text-slate-400">{rp?.riderPhone ?? ""}</p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="plum" size="sm">
                          {humanize(ref.category)}
                        </Badge>
                        {ref.isAutomatic && <p className="mt-1 text-[10px] text-slate-400">Automatic</p>}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs">
                        {ref.reason}
                        {ref.reviewNotes && <p className="mt-1 text-[10px] italic text-slate-400">Review: {ref.reviewNotes}</p>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-rose-600">
                        {money(ref.amountMinor, ref.currency)}
                        {ref.toWallet && <p className="text-[10px] font-medium text-slate-400">to wallet</p>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={refundStatusVariant(ref.status)} size="sm">
                          {ref.status}
                        </Badge>
                        {ref.failureReason && <p className="mt-1 max-w-[200px] text-[10px] text-rose-600 break-words">{ref.failureReason}</p>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {ref.status === "PENDING" ? (
                          <Can permission="finance.refund_approve" fallback={<span className="text-slate-400 text-[11px] italic">Awaiting approver</span>}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setTarget({ refund: ref, mode: "approve" })}
                                className="rounded-lg bg-emerald-50 text-emerald-700 px-2.5 py-1 text-xs font-bold hover:bg-emerald-100"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setTarget({ refund: ref, mode: "reject" })}
                                className="rounded-lg bg-rose-50 text-rose-700 px-2.5 py-1 text-xs font-bold hover:bg-rose-100"
                              >
                                Reject
                              </button>
                            </div>
                          </Can>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">{ref.reviewedBy || "Auto-processed"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </div>

      <ConfirmDialog
        isOpen={target !== null}
        title={target?.mode === "reject" ? "Reject Refund Claim" : "Approve Customer Refund"}
        description={
          target
            ? target.mode === "reject"
              ? `Rejecting this ${money(target.refund.amountMinor, target.refund.currency)} refund claim will close the dispute.`
              : `Issuing a refund of ${money(target.refund.amountMinor, target.refund.currency)} will credit ${
                  target.refund.toWallet ? "the rider's AMOORGO wallet" : "the original payment method"
                } and generate the double-entry ledger reversal. A different staff member than the requester must approve.`
            : ""
        }
        targetEntityLabel={target ? shortId(target.refund.id) : undefined}
        confirmText={target?.mode === "reject" ? "Deny Refund Request" : "Approve & Execute Refund"}
        isDestructive={target?.mode === "reject"}
        requireReason={true}
        reasonPlaceholder={target?.mode === "reject" ? "Specify policy rejection grounds..." : "Specify justification for financial refund audit trail..."}
        onConfirm={submit}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
};

// ───────────────────────────── Reconciliation & ledger ─────────────────────────────

const ReconciliationTab: React.FC<{ summary: ApiFinanceSummary | undefined; rangeDays: number }> = ({ summary, rangeDays }) => {
  const [accountType, setAccountType] = useState("");
  const [account, setAccount] = useState<ApiLedgerAccount | null>(null);

  const discrepancies = useQuery<ApiDiscrepancies>("finance-discrepancies", (signal) => api.get<ApiDiscrepancies>("/admin/finance/discrepancies", { signal }));
  const problems = useCursorList<ApiPayment>("/admin/payments", { problemsOnly: true }, { limit: 10 });
  const accounts = useCursorList<ApiLedgerAccount>("/admin/ledger/accounts", { type: accountType || undefined }, { limit: 15 });
  const entries = useCursorList<ApiLedgerEntry>(account ? "/admin/ledger/entries" : null, { accountId: account?.id }, { limit: 15 });
  useOnInvalidate("finance", () => {
    discrepancies.refetch();
    problems.refetch();
    accounts.refetch();
  });
  const parties = useParties({ users: problems.items.map((p) => p.riderId) });

  const groups = summary?.transactions ?? [];

  return (
    <div className="space-y-6">
      {/* Discrepancies */}
      <div className={`${CARD} p-5 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#189578]" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Ledger Reconciliation</h2>
          </div>
          <div className="flex items-center gap-3">
            {discrepancies.data && <span className="text-[11px] text-slate-400">Checked {formatDateTime(discrepancies.data.at)}</span>}
            <button
              type="button"
              onClick={discrepancies.refetch}
              disabled={discrepancies.loading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#331A3B] px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#28162E] disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${discrepancies.loading ? "animate-spin" : ""}`} /> Re-check
            </button>
          </div>
        </div>
        {discrepancies.error && <ErrorBanner error={discrepancies.error} title="Could not load reconciliation" onRetry={discrepancies.refetch} />}
        {discrepancies.initialLoading ? (
          <TableSkeleton rows={2} cols={3} />
        ) : discrepancies.data && discrepancies.data.items.length === 0 ? (
          <p className="rounded-xl bg-[#EFFCF9] dark:bg-[#0D2620] px-4 py-3 text-xs font-semibold text-[#14755F] dark:text-[#82E5CB]">
            No discrepancies: every ledger transaction balances, account balances match their entries, and captured payments are booked.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-[#331A3B]">
            {discrepancies.data?.items.map((d) => (
              <li key={`${d.kind}:${d.ref}`} className="flex items-start gap-3 py-2.5 text-xs">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#F94B35]" />
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white">{DISCREPANCY_LABELS[d.kind] ?? humanize(d.kind)}</p>
                  <p className="text-slate-500 break-words">{d.detail}</p>
                  <p className="font-mono text-[10px] text-slate-400">{d.ref}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Summary by type/status */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-[#F0E3ED] dark:border-[#331A3B]">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Transaction summary, last {rangeDays} days</h2>
        </div>
        {!summary ? (
          <TableSkeleton rows={3} cols={5} />
        ) : groups.length === 0 ? (
          <EmptyState title="No transactions in this period" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={THEAD}>
                  <th className={TH}>Type</th>
                  <th className={TH}>Status</th>
                  <th className={`${TH} text-right`}>Count</th>
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={`${TH} text-right`}>Platform</th>
                  <th className={`${TH} text-right`}>Captain</th>
                  <th className={`${TH} text-right`}>Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
                {groups.map((g) => (
                  <tr key={`${g.type}:${g.status}`}>
                    <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300">{humanize(g.type)}</td>
                    <td className="py-2.5 px-4">
                      <Badge variant={txStatusVariant(g.status)} size="sm">
                        {g.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">{g.count}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">{money(g.amountMinor)}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-[#189578]">{money(g.platformFeeMinor)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{money(g.captainEarningsMinor)}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500">{money(g.taxMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Problem payments */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-[#F0E3ED] dark:border-[#331A3B]">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Payments needing attention</h2>
          <p className="text-[11px] text-slate-400">Failed, stuck processing, awaiting customer action, or disputed</p>
        </div>
        {problems.error && <ErrorBanner error={problems.error} title="Could not load payments" onRetry={problems.refetch} className="m-4" />}
        {problems.initialLoading ? (
          <TableSkeleton rows={3} cols={6} />
        ) : problems.items.length === 0 && !problems.error ? (
          <EmptyState title="No problem payments" description="Every recent payment is settled." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={THEAD}>
                  <th className={TH}>Payment ID</th>
                  <th className={TH}>Rider</th>
                  <th className={TH}>Purpose / Method</th>
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={`${TH} text-center`}>Status</th>
                  <th className={TH}>Failure</th>
                  <th className={TH}>Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
                {problems.items.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200" title={p.id}>
                      {shortId(p.id)}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{parties.user(p.riderId) ?? `Rider ${shortId(p.riderId)}`}</td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                      {humanize(p.purpose)} · {p.method}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold">{money(p.amountMinor, p.currency.trim())}</td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge variant={p.status === "FAILED" || p.status === "DISPUTED" ? "coral" : "warning"} size="sm">
                        {p.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 max-w-[260px] break-words">{p.failureMessage ?? p.failureCode ?? `${p.attemptCount} attempt(s)`}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">{formatDateTime(p.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <LoadMore hasMore={problems.hasMore} loading={problems.loadingMore} onClick={problems.loadMore} />
      </div>

      {/* Ledger accounts + entries */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-[#F0E3ED] dark:border-[#331A3B]">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Ledger Accounts</h2>
            <select
              aria-label="Account type"
              value={accountType}
              onChange={(e) => {
                setAccountType(e.target.value);
                setAccount(null);
              }}
              className={SELECT}
            >
              <option value="">All types</option>
              {LEDGER_ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </select>
          </div>
          {accounts.error && <ErrorBanner error={accounts.error} title="Could not load ledger accounts" onRetry={accounts.refetch} className="m-4" />}
          {accounts.initialLoading ? (
            <TableSkeleton rows={4} cols={3} />
          ) : accounts.items.length === 0 && !accounts.error ? (
            <EmptyState title="No ledger accounts" />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={THEAD}>
                  <th className={TH}>Account</th>
                  <th className={TH}>Owner</th>
                  <th className={`${TH} text-right`}>Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
                {accounts.items.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => setAccount(account?.id === a.id ? null : a)}
                    className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-[#28162E]/30 ${account?.id === a.id ? "bg-[#FAF0F7]/60 dark:bg-[#211226]" : ""}`}
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300">{humanize(a.type)}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">{a.ownerId ? shortId(a.ownerId) : "Platform"}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">{money(a.balanceMinor, a.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <LoadMore hasMore={accounts.hasMore} loading={accounts.loadingMore} onClick={accounts.loadMore} />
        </div>

        <div className={`${CARD} overflow-hidden`}>
          <div className="px-5 py-3 border-b border-[#F0E3ED] dark:border-[#331A3B]">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Ledger Entries{account ? `: ${humanize(account.type)}` : ""}</h2>
          </div>
          {!account ? (
            <EmptyState title="Select an account" description="Click a ledger account to inspect its double-entry lines." />
          ) : entries.error ? (
            <ErrorBanner error={entries.error} title="Could not load ledger entries" onRetry={entries.refetch} className="m-4" />
          ) : entries.initialLoading ? (
            <TableSkeleton rows={4} cols={4} />
          ) : entries.items.length === 0 ? (
            <EmptyState title="No entries" />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={THEAD}>
                  <th className={TH}>When</th>
                  <th className={TH}>Kind</th>
                  <th className={`${TH} text-right`}>Debit</th>
                  <th className={`${TH} text-right`}>Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
                {entries.items.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">{formatDateTime(e.at)}</td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300" title={e.description ?? undefined}>
                      {humanize(e.kind)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">{e.debitMinor ? money(e.debitMinor, e.currency) : ""}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-[#189578]">{e.creditMinor ? money(e.creditMinor, e.currency) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {account && <LoadMore hasMore={entries.hasMore} loading={entries.loadingMore} onClick={entries.loadMore} />}
        </div>
      </div>
    </div>
  );
};
