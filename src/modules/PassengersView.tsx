"use client";

import React, { useEffect, useState } from "react";
import { Wallet, Phone, Mail, Calendar, Flag, MapPin, Star, UserRound, Users, UserCheck, Ban } from "lucide-react";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { PersonCell } from "@/components/ui/PersonCell";
import { Money } from "@/components/ui/Money";
import { countLabel, useListCount } from "@/lib/hooks/useListCount";
import { Sheet } from "@/components/ui/Sheet";
import { ChipTabs, PageHeader, SearchInput, Toolbar } from "@/components/ui/Page";
import { Badge } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState, LoadMore } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import {
  statusFilterQuery,
  toRider,
  toRiderDetail,
  type ApiLedgerAccount,
  type ApiUserDetail,
  type ApiUserRow,
  type ApiWalletAdjustResult,
  type RiderView,
} from "@/lib/adapters/users";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDate, formatDateTime, formatMoney, humanize, majorToMinor, timeAgo } from "@/lib/format";
import { useCursorList, useQuery } from "@/lib/hooks/useQuery";
import { invalidate, useOnInvalidate } from "@/lib/invalidate";

interface PassengersViewProps {
  selectedCityId: string | null;
}

type StatusFilter = "ALL" | "ACTIVE" | "FLAGGED" | "SUSPENDED";
const FILTERS: StatusFilter[] = ["ALL", "ACTIVE", "FLAGGED", "SUSPENDED"];
const MAX_CREDIT = 1000; // backend: |amountMinor| <= 100000

type Dialog =
  | { kind: "suspend" | "reactivate" | "flag" | "unflag"; rider: RiderView }
  | { kind: "credit"; rider: RiderView; idempotencyKey: string };

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.round(Math.random() * 1e9)}`);

const statusVariant = (r: RiderView) => (r.accountStatus === "ACTIVE" ? (r.flagged ? "coral" : "teal") : "danger") as "teal" | "coral" | "danger";
const statusLabel = (r: RiderView) => (r.accountStatus === "ACTIVE" ? (r.flagged ? "FLAGGED" : "ACTIVE") : r.accountStatus.replace(/_/g, " "));
const canToggleSuspend = (r: RiderView) => r.accountStatus === "ACTIVE" || r.accountStatus === "SUSPENDED" || r.accountStatus === "BLOCKED";

export const PassengersView: React.FC<PassengersViewProps> = ({ selectedCityId }) => {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [openRiderId, setOpenRiderId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [creditAmount, setCreditAmount] = useState("15");

  // Debounce the search box so each keystroke does not hit the API.
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const list = useCursorList<ApiUserRow>("/admin/users", { q: q || undefined, ...statusFilterQuery(statusFilter) }, { limit: 25 });
  useOnInvalidate("users", list.refetch);
  const riders = list.items.map(toRider);

  // Summary cards (one page of ids each, "100+" when there are more)
  const totalCount = useListCount("/admin/users", {}, "users");
  const activeCount = useListCount("/admin/users", { status: "ACTIVE" }, "users");
  const flaggedCount = useListCount("/admin/users", { flagged: true }, "users");
  const suspendedCount = useListCount("/admin/users", { status: "SUSPENDED" }, "users");

  const closeDialog = () => setDialog(null);

  const runDialog = async (reason: string): Promise<void> => {
    if (!dialog) return;
    const { rider } = dialog;
    switch (dialog.kind) {
      case "suspend":
        await api.post(`/admin/users/${rider.id}/suspend`, { reason });
        toast.success(`${rider.name} suspended; their sessions were revoked.`);
        break;
      case "reactivate":
        await api.post(`/admin/users/${rider.id}/reactivate`, { reason });
        toast.success(`${rider.name} reactivated.`);
        break;
      case "flag":
      case "unflag":
        await api.patch(`/admin/users/${rider.id}`, { flagged: dialog.kind === "flag", reason });
        toast.success(dialog.kind === "flag" ? `${rider.name} flagged.` : `Flag removed from ${rider.name}.`);
        break;
      case "credit": {
        const amountMinor = majorToMinor(Number(creditAmount));
        const res = await api.post<ApiWalletAdjustResult>(`/admin/wallets/${rider.id}/adjust`, { amountMinor, reason }, { headers: { "Idempotency-Key": dialog.idempotencyKey } });
        toast.success(`Credited ${formatMoney(amountMinor)} to ${rider.name}. New balance ${formatMoney(res.balanceMinor)}.`);
        invalidate("users", "finance");
        closeDialog();
        return;
      }
    }
    invalidate("users");
    closeDialog();
  };

  const creditNumber = Number(creditAmount);
  const creditValid = Number.isFinite(creditNumber) && creditNumber > 0 && creditNumber <= MAX_CREDIT && majorToMinor(creditNumber) > 0;

  const openCredit = (rider: RiderView) => {
    setCreditAmount("15");
    setDialog({ kind: "credit", rider, idempotencyKey: newKey() });
  };

  const dialogCopy = (d: Dialog) => {
    const n = d.rider.name;
    switch (d.kind) {
      case "suspend":
        return { title: "Suspend Passenger Account", description: `Suspending ${n} prevents new ride requests and signs them out of every device immediately.`, confirm: "Confirm Suspension", destructive: true };
      case "reactivate":
        return { title: "Reactivate Passenger Account", description: `Reactivating ${n} lets them book rides again.`, confirm: "Confirm Reactivation", destructive: false };
      case "flag":
        return { title: "Flag Passenger", description: `Flagging ${n} marks the account for closer review. It does not restrict the account.`, confirm: "Flag Passenger", destructive: false };
      case "unflag":
        return { title: "Remove Flag", description: `Remove the review flag from ${n}.`, confirm: "Remove Flag", destructive: false };
      case "credit":
        return { title: `Issue Goodwill Credit: ${n}`, description: `The credit is added to ${n}'s wallet immediately and recorded in the ledger and audit log.`, confirm: `Credit ${creditValid ? formatMoney(majorToMinor(creditNumber)) : "$0.00"} to Wallet`, destructive: false };
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <PageHeader
        title="Passenger Directory & Accounts"
        description="Manage passenger accounts, wallet credits, safety contacts, and status suspensions"
        actions={
          selectedCityId !== null ? (
            <p className="max-w-xs text-xs text-slate-600 dark:text-slate-300 sm:text-right">Passenger accounts are not tied to a city, so the city selector does not filter this list.</p>
          ) : undefined
        }
      />

      <StatGrid cols={4}>
        <StatCard label="Total passengers" icon={Users} tone="brand" loading={totalCount.loading} value={countLabel(totalCount)} hint="All accounts" />
        <StatCard label="Active" icon={UserCheck} tone="good" loading={activeCount.loading} value={countLabel(activeCount)} hint="Can book rides" />
        <StatCard label="Flagged for review" icon={Flag} tone={flaggedCount.count ? "warn" : "neutral"} loading={flaggedCount.loading} value={countLabel(flaggedCount)} hint="Marked by support or safety" />
        <StatCard label="Suspended" icon={Ban} tone={suspendedCount.count ? "bad" : "neutral"} loading={suspendedCount.loading} value={countLabel(suspendedCount)} hint="Sessions revoked" />
      </StatGrid>

      {/* Filter and Search Bar */}
      <Toolbar className="lg:flex lg:items-center lg:justify-between lg:space-y-0">
        <ChipTabs label="Account status" items={FILTERS.map((st) => ({ id: st, label: st }))} value={statusFilter} onChange={setStatusFilter} />
        <SearchInput value={search} onValueChange={setSearch} placeholder="Search passenger, phone, email, id..." className="lg:w-72" />
      </Toolbar>

      {list.error && <ErrorBanner error={list.error} title="Could not load passengers" onRetry={list.refetch} />}

      {/* Table */}
      <div className="rounded-2xl border border-[#F0E3ED] dark:border-[#331A3B] bg-white dark:bg-[#180D1C] overflow-hidden shadow-xs">
        {list.initialLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : riders.length === 0 && !list.error ? (
          <EmptyState icon={UserRound} title="No passengers found" description={q || statusFilter !== "ALL" ? "Try a different search or status filter." : "Passengers appear here once they sign up."} />
        ) : (
          <div className="data-table-container sticky-first">
            <table className="w-full min-w-[53rem] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#F0E3ED] dark:border-[#331A3B] bg-[#FAF0F7]/40 dark:bg-[#211226]/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">
                  <th className="py-3.5 px-4">Passenger</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4">Rating & Trips</th>
                  <th className="num py-3.5 px-4">Lifetime Spend</th>
                  <th className="py-3.5 px-4">Joined</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Interventions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#331A3B]">
                {riders.map((rider) => (
                  <tr key={rider.id} className="hover:bg-slate-50/70 dark:hover:bg-[#28162E]/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => setOpenRiderId(rider.id)} className="text-left" title="Open passenger profile">
                        <PersonCell name={rider.name} avatar={rider.avatar} subtitle={<span className="font-mono">ID {rider.id.slice(0, 8)}</span>} />
                      </button>
                    </td>

                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-slate-900 dark:text-white">{rider.phone}</p>
                      <p className="max-w-[16rem] truncate text-xs text-slate-600 dark:text-slate-300" title={rider.email || undefined}>{rider.email || "No email on file"}</p>
                    </td>

                    <td className="px-3 py-2.5">
                      <span className="font-bold tabular-nums text-amber-700 dark:text-amber-400">★ {rider.rating.toFixed(2)}</span>
                      <p className="text-xs tabular-nums text-slate-600 dark:text-slate-300">{rider.totalRides} completed rides</p>
                    </td>

                    <td className="num px-3 py-2.5 font-bold text-slate-900 dark:text-white"><Money minor={majorToMinor(rider.lifetimeSpend)} /></td>

                    <td className="px-3 py-2.5 tabular-nums text-slate-700 dark:text-slate-200">{formatDate(rider.joinedAt)}</td>

                    <td className="px-3 py-2.5">
                      <StatusPill variant={statusVariant(rider)}>{statusLabel(rider)}</StatusPill>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Can permission="finance.refund_approve">
                          <button
                            onClick={() => openCredit(rider)}
                            className="min-h-10 rounded-lg bg-[#EFFCF9] px-2.5 py-1 text-xs font-bold text-[#14755F] hover:opacity-80 dark:bg-[#0D2620] dark:text-[#82E5CB]"
                            title="Add Goodwill Wallet Credit"
                          >
                            +$ Credit
                          </button>
                        </Can>

                        {canToggleSuspend(rider) && (
                          <Can permission="users.suspend">
                            <button
                              onClick={() => setDialog({ kind: rider.accountStatus === "ACTIVE" ? "suspend" : "reactivate", rider })}
                              className={`min-h-10 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                                rider.accountStatus === "ACTIVE"
                                  ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100"
                                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              }`}
                            >
                              {rider.accountStatus === "ACTIVE" ? "Suspend" : "Reactivate"}
                            </button>
                          </Can>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </div>

      {openRiderId && <RiderDetailPanel riderId={openRiderId} onClose={() => setOpenRiderId(null)} onAction={(d) => setDialog(d)} onCredit={openCredit} />}

      {dialog && (
        <ConfirmDialog
          key={`${dialog.kind}:${dialog.rider.id}`}
          isOpen
          title={dialogCopy(dialog).title}
          description={dialogCopy(dialog).description}
          targetEntityLabel={dialog.rider.name}
          confirmText={dialogCopy(dialog).confirm}
          isDestructive={dialogCopy(dialog).destructive}
          requireReason
          minReasonLength={3}
          reasonPlaceholder={
            dialog.kind === "credit"
              ? "Reason for goodwill credit (e.g. Delayed pickup courtesy voucher)..."
              : "Specify reason (e.g. Chargeback abuse, severe verbal harassment, safety incident investigation)..."
          }
          confirmDisabled={dialog.kind === "credit" && !creditValid}
          onConfirm={runDialog}
          onCancel={closeDialog}
        >
          {dialog.kind === "credit" && (
            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-300">Credit Amount ($, max {MAX_CREDIT})</label>
              <input
                type="number"
                min="0.01"
                max={MAX_CREDIT}
                step="0.01"
                value={creditAmount}
                onChange={(e) => {
                  setCreditAmount(e.target.value);
                  // A new amount is a new operation: it must not replay the previous idempotency key.
                  setDialog((d) => (d && d.kind === "credit" ? { ...d, idempotencyKey: newKey() } : d));
                }}
                className="w-full rounded-xl border border-slate-300 dark:border-[#331A3B] p-2.5 text-sm dark:bg-[#211226] dark:text-white"
              />
              {!creditValid && <p className="text-xs text-[#D93320] dark:text-[#FF7361]">Enter an amount between $0.01 and ${MAX_CREDIT}.</p>}
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
};

// ── Rider detail ────────────────────────────────────────────

interface RiderDetailPanelProps {
  riderId: string;
  onClose: () => void;
  onAction: (d: { kind: "suspend" | "reactivate" | "flag" | "unflag"; rider: RiderView }) => void;
  onCredit: (rider: RiderView) => void;
}

const RiderDetailPanel: React.FC<RiderDetailPanelProps> = ({ riderId, onClose, onAction, onCredit }) => {
  const { can } = useAuth();
  const detail = useQuery<ApiUserDetail>(`rider:${riderId}`, (signal) => api.get<ApiUserDetail>(`/admin/users/${riderId}`, { signal }));
  useOnInvalidate("users", detail.refetch);

  // The rider's wallet balance lives in the ledger (finance.view); there is no per-user wallet endpoint.
  const canSeeWallet = can("finance.view");
  const wallet = useQuery<number | null>(canSeeWallet ? `rider-wallet:${riderId}` : null, async (signal) => {
    const page = await api.getPage<ApiLedgerAccount>("/admin/ledger/accounts", { query: { type: "RIDER_WALLET", ownerId: riderId, limit: 5 }, signal });
    return page.items.length ? page.items[0].balanceMinor : null;
  });
  useOnInvalidate("finance", wallet.refetch);

  const rider = detail.data ? toRiderDetail(detail.data) : null;
  // Wall clock for "last active"; refreshed when the data reloads.
  const [now] = useState<number>(() => Date.now());

  return (
    <Sheet
      open
      onClose={onClose}
      widthClass="sm:max-w-md"
      bodyClassName="space-y-5 p-4 sm:p-6"
      header={<h3 className="text-base font-black text-slate-900 dark:text-white">Passenger Profile</h3>}
    >
        {detail.error && <ErrorBanner error={detail.error} title="Could not load this passenger" onRetry={detail.refetch} />}
        {detail.initialLoading && (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {rider && (
          <>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={rider.avatar} alt="" className="h-14 w-14 shrink-0 rounded-full border-2 border-[#7A2B66]" />
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-slate-900 dark:text-white">{rider.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant={statusVariant(rider)} size="sm" dot>
                    {statusLabel(rider)}
                  </Badge>
                  {rider.flagged && rider.accountStatus !== "ACTIVE" && (
                    <Badge variant="coral" size="sm">
                      FLAGGED
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {rider.statusReason && rider.accountStatus !== "ACTIVE" && (
              <p className="rounded-xl border border-[#FFC4BC] dark:border-[#61130A] bg-[#FFF3F1] dark:bg-[#38110D] p-3 text-xs text-[#B02414] dark:text-[#FFA093]">
                <span className="font-bold">Status reason:</span> {rider.statusReason}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <Stat label="Rating" value={`★ ${rider.rating.toFixed(2)}`} sub={`${rider.ratingCount} ratings`} />
              <Stat label="Completed Rides" value={String(rider.totalRides)} />
              <Stat label="Lifetime Spend" value={formatMoney(detail.data?.lifetimeSpendMinor ?? 0)} />
              <Stat
                label="Wallet Balance"
                value={!canSeeWallet ? "Restricted" : wallet.initialLoading ? "…" : wallet.error ? "Unavailable" : wallet.data == null ? formatMoney(0) : formatMoney(wallet.data)}
                sub={!canSeeWallet ? "Needs finance access" : undefined}
                icon={<Wallet className="h-3.5 w-3.5 text-[#14755F] dark:text-[#4FD2B2]" />}
              />
            </div>

            <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              <p className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" /> {rider.phone}
              </p>
              <p className="flex min-w-0 items-center gap-2 break-all">
                <Mail className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" /> {rider.email || "No email on file"}
              </p>
              <p className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" /> Joined {formatDateTime(rider.joinedAt)}
              </p>
              <p className="flex items-center gap-2">
                <Star className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" /> Last active {rider.lastActiveAt ? timeAgo(rider.lastActiveAt, now) : "never"}
              </p>
              {!rider.profileComplete && <p className="text-xs text-amber-700 dark:text-amber-400">Profile not completed.</p>}
              {rider.deletionRequest && (
                <p className="text-xs text-[#D93320] dark:text-[#FF7361]">
                  Deletion {humanize(rider.deletionRequest.status)}
                  {rider.deletionRequest.scheduledFor ? ` (scheduled ${formatDate(rider.deletionRequest.scheduledFor)})` : ""}
                  {rider.deletionRequest.blockedReason ? `: ${rider.deletionRequest.blockedReason}` : ""}
                </p>
              )}
            </div>

            <section className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Emergency Contacts</h4>
              {rider.emergencyContacts.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">None on file.</p>
              ) : (
                rider.emergencyContacts.map((c, i) => (
                  <div key={`${c.phone}-${i}`} className="rounded-xl border border-slate-200 dark:border-[#331A3B] p-2.5 text-xs">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {c.name} {c.relation && <span className="font-normal text-slate-500 dark:text-slate-400">({c.relation})</span>}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">{c.phone}</p>
                  </div>
                ))
              )}
            </section>

            <section className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Saved Places</h4>
              {rider.savedPlaces.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">None saved.</p>
              ) : (
                rider.savedPlaces.map((p, i) => (
                  <p key={`${p.name}-${i}`} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7A2B66]" />
                    <span>
                      <span className="font-bold">{p.name}</span>: {p.address}
                    </span>
                  </p>
                ))
              )}
            </section>

            <div className="flex flex-wrap gap-2 border-t border-[#F0E3ED] dark:border-[#331A3B] pt-4">
              <Can permission="finance.refund_approve">
                <button onClick={() => onCredit(rider)} className="min-h-11 rounded-xl bg-[#EFFCF9] px-3 py-2 text-xs font-bold text-[#14755F] hover:opacity-80 dark:bg-[#0D2620] dark:text-[#82E5CB]">
                  +$ Goodwill Credit
                </button>
              </Can>
              <Can permission="users.edit">
                <button
                  onClick={() => onAction({ kind: rider.flagged ? "unflag" : "flag", rider })}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#28162E]"
                >
                  <Flag className="h-3.5 w-3.5" /> {rider.flagged ? "Remove Flag" : "Flag Account"}
                </button>
              </Can>
              {canToggleSuspend(rider) && (
                <Can permission="users.suspend">
                  <button
                    onClick={() => onAction({ kind: rider.accountStatus === "ACTIVE" ? "suspend" : "reactivate", rider })}
                    className={`rounded-xl px-3 py-2 text-xs font-bold ${
                      rider.accountStatus === "ACTIVE" ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100" : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {rider.accountStatus === "ACTIVE" ? "Suspend Account" : "Reactivate Account"}
                  </button>
                </Can>
              )}
            </div>
          </>
        )}
    </Sheet>
  );
};

const Stat: React.FC<{ label: string; value: string; sub?: string; icon?: React.ReactNode }> = ({ label, value, sub, icon }) => (
  <div className="rounded-xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226]/40 p-3">
    <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{label}</span>
    <p className="mt-0.5 flex items-center gap-1.5 font-mono text-sm font-black text-slate-900 dark:text-white">
      {icon}
      {value}
    </p>
    {sub && <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
  </div>
);
