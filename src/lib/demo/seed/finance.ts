/** Seed: payments, transactions, refunds, payouts, payout batches, ledger accounts/entries and the audit trail. */
import type { ApiAuditEntry } from "../../adapters/audit";
import type { ApiLedgerAccount, ApiLedgerEntry, ApiPayment, ApiPayout, ApiPayoutBatch, ApiRefund, ApiRefundCategory, ApiRefundStatus, ApiTransaction } from "../../adapters/finance";
import type { ApiStaff } from "../../adapters/iam";
import type { ApiCityFull } from "../../adapters/pricing";
import type { ApiUserDetail } from "../../adapters/users";
import type { CaptainRow, RideRow } from "../store";
import { DAY, HOUR, MIN, iso, mulberry32, pick, randInt, uuid } from "../util";

const r = mulberry32(404);

const ALNUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const alnum = (n: number): string => Array.from({ length: n }, () => ALNUM[Math.floor(r() * ALNUM.length)]).join("");

export interface FinanceSeedInput {
  now: number;
  cities: ApiCityFull[];
  riders: ApiUserDetail[];
  captains: CaptainRow[];
  rides: RideRow[];
  staff: ApiStaff[];
}

export interface FinanceSeed {
  payments: ApiPayment[];
  transactions: ApiTransaction[];
  refunds: ApiRefund[];
  payouts: ApiPayout[];
  batches: ApiPayoutBatch[];
  accounts: ApiLedgerAccount[];
  entries: ApiLedgerEntry[];
  audit: ApiAuditEntry[];
}

const REFUND_REASONS: Array<{ category: ApiRefundCategory; reason: string }> = [
  { category: "ROUTE_DEVIATION", reason: "Captain took a longer route through the tollway without consent, adding 15 minutes to the trip." },
  { category: "OVERCHARGED", reason: "The final fare was much higher than the estimate shown when booking." },
  { category: "ACCIDENTAL_CHARGE", reason: "App charged a cancellation fee although the driver arrived at the wrong street corner." },
  { category: "DRIVER_MISBEHAVIOR", reason: "Captain was on a phone call for most of the trip and refused to end it." },
  { category: "VEHICLE_ISSUE", reason: "Air conditioning was not working during a 95 degree afternoon." },
  { category: "DUPLICATE_CHARGE", reason: "I was charged twice for the same ride." },
  { category: "SERVICE_FAILURE", reason: "The ride was cancelled mid-trip because of a vehicle breakdown." },
  { category: "OVERCHARGED", reason: "Surge pricing applied although the app showed no surge at booking." },
];

export function seedFinance(input: FinanceSeedInput): FinanceSeed {
  const { now, cities, riders, captains, rides, staff } = input;
  const approved = captains.filter((c) => c.d.status === "APPROVED");

  const accounts: ApiLedgerAccount[] = [];
  const entries: ApiLedgerEntry[] = [];
  const accountKey = (type: string, ownerId: string) => `${type}:${ownerId}`;
  const accountMap = new Map<string, ApiLedgerAccount>();
  const account = (type: string, ownerId: string): ApiLedgerAccount => {
    const k = accountKey(type, ownerId);
    let a = accountMap.get(k);
    if (!a) {
      a = { id: uuid(r), type, ownerId, currency: "USD", balanceMinor: 0, updatedAt: iso(now) };
      accountMap.set(k, a);
      accounts.push(a);
    }
    return a;
  };
  const CREDIT_NORMAL = new Set(["RIDER_WALLET", "CAPTAIN_PAYABLE", "PLATFORM_REVENUE", "TAX_PAYABLE", "INCENTIVE_PAYABLE"]);
  const post = (txnId: string, at: number, kind: string, description: string, lines: Array<{ type: string; owner: string; debit?: number; credit?: number }>, ref?: { type: string; id: string }) => {
    for (const l of lines) {
      const a = account(l.type, l.owner);
      const debit = l.debit ?? 0;
      const credit = l.credit ?? 0;
      a.balanceMinor += CREDIT_NORMAL.has(l.type) ? credit - debit : debit - credit;
      a.updatedAt = iso(at);
      entries.push({
        id: uuid(r),
        txnId,
        account: { id: a.id, type: a.type, ownerId: a.ownerId },
        debitMinor: debit,
        creditMinor: credit,
        currency: "USD",
        kind,
        description,
        refType: ref?.type ?? null,
        refId: ref?.id ?? null,
        at: iso(at),
      });
    }
  };

  // Platform and per-party accounts exist from the start so lists are never empty.
  account("PLATFORM_REVENUE", "platform");
  account("TAX_PAYABLE", "platform");
  account("PROVIDER_CLEARING", "stripe");
  account("BANK", "operating");
  for (const c of approved) account("CAPTAIN_PAYABLE", c.d.id);
  for (const rd of riders) account("RIDER_WALLET", rd.id);

  const payments: ApiPayment[] = [];
  const transactions: ApiTransaction[] = [];
  const mkTx = (t: Partial<ApiTransaction> & Pick<ApiTransaction, "type" | "status" | "amountMinor" | "createdAt">): ApiTransaction => {
    const tx: ApiTransaction = {
      id: uuid(r),
      rideId: null,
      paymentId: null,
      refundId: null,
      payoutId: null,
      riderId: null,
      captainId: null,
      cityId: null,
      gateway: "STRIPE",
      platformFeeMinor: 0,
      captainEarningsMinor: 0,
      taxMinor: 0,
      currency: "USD",
      idempotencyKey: null,
      description: null,
      updatedAt: t.createdAt,
      ...t,
    };
    transactions.push(tx);
    return tx;
  };

  const settleFare = (tx: ApiTransaction, captainId: string | null) => {
    const at = new Date(tx.createdAt).getTime();
    const tax = tx.taxMinor;
    const capt = tx.captainEarningsMinor;
    const fee = tx.amountMinor - tax - capt;
    tx.platformFeeMinor = fee;
    if (tx.gateway === "CASH") {
      post(tx.id, at, "RIDE_FARE", "Cash fare collected by captain", [
        { type: "CAPTAIN_CASH_IN_HAND", owner: captainId ?? "unknown", debit: tx.amountMinor },
        { type: "CAPTAIN_PAYABLE", owner: captainId ?? "unknown", credit: capt },
        { type: "PLATFORM_REVENUE", owner: "platform", credit: fee },
        { type: "TAX_PAYABLE", owner: "platform", credit: tax },
      ], { type: "TRANSACTION", id: tx.id });
    } else {
      post(tx.id, at, "RIDE_FARE", "Ride fare captured", [
        { type: "PROVIDER_CLEARING", owner: "stripe", debit: tx.amountMinor },
        { type: "CAPTAIN_PAYABLE", owner: captainId ?? "unknown", credit: capt },
        { type: "PLATFORM_REVENUE", owner: "platform", credit: fee },
        { type: "TAX_PAYABLE", owner: "platform", credit: tax },
      ], { type: "TRANSACTION", id: tx.id });
    }
  };

  // ── Ride payments, fare transactions, tips, cancellation fees ──
  for (const row of rides) {
    const rec = row.rec;
    const cap = rec.captainId;
    if (row.payment) {
      const p = row.payment;
      payments.push({
        id: p.id,
        rideId: rec.id,
        riderId: rec.riderId,
        purpose: "RIDE",
        method: p.method,
        provider: p.provider,
        providerRef: p.method === "CARD" ? `pi_3${alnum(21)}` : null,
        status: p.status as ApiPayment["status"],
        amountMinor: p.amountMinor,
        capturedMinor: p.capturedMinor,
        refundedMinor: p.refundedMinor,
        currency: "USD",
        attemptCount: p.attemptCount,
        failureCode: p.failureCode,
        failureMessage: p.failureMessage,
        createdAt: rec.requestedAt,
        updatedAt: rec.completedAt ?? rec.requestedAt,
      });
    }
    if (!row.payment || !rec.fareBreakdown || rec.finalFareMinor === null) continue;
    const b = rec.fareBreakdown;
    const status = rec.status === "PAYMENT_FAILED" ? "FAILED" : rec.status === "COMPLETED" || rec.status === "PAYMENT_PENDING" ? "PENDING" : "SUCCESS";
    const tx = mkTx({
      type: "RIDE_FARE",
      status,
      rideId: rec.id,
      paymentId: row.payment.id,
      riderId: rec.riderId,
      captainId: cap,
      cityId: rec.cityId,
      gateway: rec.paymentMethod === "CARD" ? "STRIPE" : rec.paymentMethod,
      amountMinor: rec.finalFareMinor,
      captainEarningsMinor: b.captainEarningMinor,
      taxMinor: b.taxMinor,
      idempotencyKey: `ride-fare:${rec.id}`,
      description: `Fare for ${rec.bookingRef}`,
      createdAt: rec.completedAt ?? rec.requestedAt,
    });
    if (status === "SUCCESS") settleFare(tx, cap);
    else tx.platformFeeMinor = Math.max(0, tx.amountMinor - tx.taxMinor - tx.captainEarningsMinor);
    if (row.payment.tipMinor > 0 && status === "SUCCESS") {
      const tip = mkTx({ type: "TIP", status: "SUCCESS", rideId: rec.id, paymentId: row.payment.id, riderId: rec.riderId, captainId: cap, cityId: rec.cityId, amountMinor: row.payment.tipMinor, captainEarningsMinor: row.payment.tipMinor, idempotencyKey: `tip:${rec.id}`, description: `Tip for ${rec.bookingRef}`, createdAt: rec.completedAt ?? rec.requestedAt });
      post(tip.id, new Date(tip.createdAt).getTime(), "TIP", "Tip captured", [
        { type: "PROVIDER_CLEARING", owner: "stripe", debit: tip.amountMinor },
        { type: "CAPTAIN_PAYABLE", owner: cap ?? "unknown", credit: tip.amountMinor },
      ], { type: "TRANSACTION", id: tip.id });
    }
  }
  for (const row of rides) {
    const rec = row.rec;
    if (rec.cancellationFeeMinor > 0) {
      const tx = mkTx({
        type: rec.isNoShow ? "NO_SHOW_FEE" : "CANCELLATION_FEE",
        status: "SUCCESS",
        rideId: rec.id,
        riderId: rec.riderId,
        captainId: rec.captainId,
        cityId: rec.cityId,
        amountMinor: rec.cancellationFeeMinor,
        captainEarningsMinor: Math.round(rec.cancellationFeeMinor * 0.8),
        taxMinor: 0,
        idempotencyKey: `cancel-fee:${rec.id}`,
        description: `${rec.isNoShow ? "No-show" : "Cancellation"} fee for ${rec.bookingRef}`,
        createdAt: rec.cancelledAt ?? rec.requestedAt,
      });
      settleFare(tx, rec.captainId);
    }
  }

  // ── Historic fare transactions (older than the 3 days of sample rides) so the 30 / 90 day views have substance ──
  for (let i = 0; i < 110; i++) {
    const rider = pick(r, riders);
    const cap = pick(r, approved);
    const amount = randInt(r, 950, 6400);
    const tax = Math.round((amount * 825) / 10825);
    const capt = Math.round((amount - tax - 175) * 0.8);
    const when = now - randInt(r, 3 * 24, 44 * 24) * HOUR - randInt(r, 0, 59) * MIN;
    const tx = mkTx({
      type: "RIDE_FARE",
      status: i === 7 ? "DISPUTED" : i === 41 ? "FAILED" : "SUCCESS",
      riderId: rider.id,
      captainId: cap.d.id,
      cityId: cap.d.cityId,
      gateway: i % 17 === 0 ? "CASH" : i % 9 === 0 ? "WALLET" : "STRIPE",
      amountMinor: amount,
      captainEarningsMinor: capt,
      taxMinor: tax,
      idempotencyKey: `ride-fare:hist-${i}`,
      description: "Ride fare",
      createdAt: iso(when),
    });
    if (tx.status === "SUCCESS") settleFare(tx, cap.d.id);
    else tx.platformFeeMinor = amount - tax - capt;
  }

  // ── Wallet top-ups ──
  for (const rider of riders.slice(0, 9)) {
    const amount = pick(r, [2000, 2500, 4000, 5000, 7500]);
    const when = now - randInt(r, 2, 30) * DAY;
    const tx = mkTx({ type: "WALLET_TOPUP", status: "SUCCESS", riderId: rider.id, amountMinor: amount, idempotencyKey: `topup:${rider.id}`, description: "Wallet top-up via card", createdAt: iso(when) });
    post(tx.id, when, "WALLET_TOPUP", "Wallet top-up", [
      { type: "PROVIDER_CLEARING", owner: "stripe", debit: amount },
      { type: "RIDER_WALLET", owner: rider.id, credit: amount },
    ], { type: "TRANSACTION", id: tx.id });
  }

  // ── Extra problem payments (not tied to rides) ──
  payments.push(
    { id: uuid(r), rideId: null, riderId: riders[5].id, purpose: "WALLET_TOPUP", method: "CARD", provider: "STRIPE", providerRef: `pi_3${alnum(21)}`, status: "REQUIRES_ACTION", amountMinor: 5000, capturedMinor: 0, refundedMinor: 0, currency: "USD", attemptCount: 1, failureCode: null, failureMessage: "Waiting for 3D Secure confirmation", createdAt: iso(now - 25 * MIN), updatedAt: iso(now - 25 * MIN) },
    { id: uuid(r), rideId: null, riderId: riders[14].id, purpose: "RIDE", method: "CARD", provider: "STRIPE", providerRef: `pi_3${alnum(21)}`, status: "DISPUTED", amountMinor: 2845, capturedMinor: 2845, refundedMinor: 0, currency: "USD", attemptCount: 1, failureCode: "fraudulent", failureMessage: "Cardholder opened a chargeback (reason: fraudulent)", createdAt: iso(now - 9 * DAY), updatedAt: iso(now - 2 * DAY) },
  );

  // ── Refunds ──
  const paidRides = rides.filter((x) => x.payment && x.payment.status !== "FAILED" && ["PAYMENT_COMPLETED", "RATED", "CLOSED"].includes(x.rec.status));
  const refundPlan: Array<{ status: ApiRefundStatus; hoursAgo: number; auto?: boolean; toWallet?: boolean }> = [
    { status: "PENDING", hoursAgo: 3 },
    { status: "PENDING", hoursAgo: 7 },
    { status: "PENDING", hoursAgo: 15 },
    { status: "PENDING", hoursAgo: 26 },
    { status: "APPROVED", hoursAgo: 30 },
    { status: "PROCESSED", hoursAgo: 40, toWallet: true },
    { status: "PROCESSED", hoursAgo: 52 },
    { status: "PROCESSED", hoursAgo: 60, auto: true },
    { status: "PROCESSING", hoursAgo: 1 },
    { status: "REJECTED", hoursAgo: 35 },
    { status: "REJECTED", hoursAgo: 70 },
    { status: "FAILED", hoursAgo: 20 },
  ];
  const refunds: ApiRefund[] = [];
  refundPlan.forEach((plan, i) => {
    const ride = paidRides[i % paidRides.length];
    if (!ride.payment) return;
    const t = REFUND_REASONS[i % REFUND_REASONS.length];
    const base = ride.payment.capturedMinor || ride.payment.amountMinor;
    const amount = i === 0 ? base : Math.min(base, pick(r, [500, 800, 1200, 1500, 2200, base]));
    const reviewed = plan.status !== "PENDING";
    const reviewer = staff.find((s) => s.roles.some((x) => x.key === "FINANCE_ADMIN")) ?? staff[0];
    const createdAt = now - plan.hoursAgo * HOUR;
    const refund: ApiRefund = {
      id: uuid(r),
      paymentId: ride.payment.id,
      rideId: ride.rec.id,
      amountMinor: amount,
      currency: "USD",
      category: plan.auto ? "DUPLICATE_CHARGE" : t.category,
      reason: plan.auto ? "Duplicate charge detected and reversed automatically." : t.reason,
      status: plan.status,
      isAutomatic: plan.auto ?? false,
      toWallet: plan.toWallet ?? false,
      requestedByRealm: plan.auto ? "SYSTEM" : i % 3 === 0 ? "STAFF" : "RIDER",
      requestedById: plan.auto ? null : i % 3 === 0 ? staff[4]?.id ?? null : ride.rec.riderId,
      reviewedBy: reviewed && !plan.auto ? reviewer.id : null,
      reviewedAt: reviewed ? iso(createdAt + 2 * HOUR) : null,
      reviewNotes: plan.status === "REJECTED" ? "The trip route matched the quoted route; no overcharge found." : plan.status === "PROCESSED" ? "Approved after reviewing the trip log." : null,
      providerRefundId: plan.status === "PROCESSED" || plan.status === "PROCESSING" ? `re_${alnum(24)}` : null,
      failureReason: plan.status === "FAILED" ? "Card network declined the refund: the card account is closed." : null,
      createdAt: iso(createdAt),
      updatedAt: iso(createdAt + (reviewed ? 2 * HOUR : 0)),
    };
    refunds.push(refund);
    if (plan.status === "PROCESSED") {
      const tx = mkTx({ type: "REFUND", status: "SUCCESS", rideId: ride.rec.id, paymentId: ride.payment.id, refundId: refund.id, riderId: ride.rec.riderId, captainId: ride.rec.captainId, cityId: ride.rec.cityId, amountMinor: amount, idempotencyKey: `refund:${refund.id}`, description: "Refund processed", createdAt: iso(createdAt + 3 * HOUR) });
      tx.platformFeeMinor = -amount;
      post(tx.id, createdAt + 3 * HOUR, "REFUND", "Refund processed", [
        { type: "PLATFORM_REVENUE", owner: "platform", debit: amount },
        { type: "PROVIDER_CLEARING", owner: "stripe", credit: amount },
      ], { type: "REFUND", id: refund.id });
    }
  });

  // ── Payout batches & payouts ──
  const payouts: ApiPayout[] = [];
  const batches: ApiPayoutBatch[] = [];
  const finance = staff.find((s) => s.roles.some((x) => x.key === "FINANCE_ADMIN")) ?? staff[0];
  const makeBatch = (batchNumber: string, cityId: string | null, status: ApiPayoutBatch["status"], hoursAgo: number, captainsInBatch: CaptainRow[], payoutStatuses: ApiPayout["status"][]) => {
    const batchId = uuid(r);
    const generatedAt = now - hoursAgo * HOUR;
    let gross = 0;
    let offset = 0;
    captainsInBatch.forEach((c, i) => {
      const amount = randInt(r, 8500, 64000);
      const pStatus = payoutStatuses[i % payoutStatuses.length];
      const off = pStatus === "FAILED" ? 0 : randInt(r, 0, 1800);
      gross += amount;
      offset += off;
      const payout: ApiPayout = {
        id: uuid(r),
        captainId: c.d.id,
        batchId,
        amountMinor: amount - off,
        currency: "USD",
        status: pStatus,
        providerTransferId: pStatus === "COMPLETED" || pStatus === "PROCESSING" ? `tr_${alnum(24)}` : null,
        failureReason: pStatus === "FAILED" ? "Bank account closed (R02). The captain must update their payout details." : null,
        requestedBy: finance.id,
        requestedAt: iso(generatedAt),
        processedAt: pStatus === "COMPLETED" ? iso(generatedAt + 2 * HOUR) : null,
      };
      payouts.push(payout);
      if (pStatus === "COMPLETED") {
        const tx = mkTx({ type: "PAYOUT", status: "SUCCESS", captainId: c.d.id, cityId: c.d.cityId, payoutId: payout.id, amountMinor: payout.amountMinor, idempotencyKey: `payout:${payout.id}`, description: `Payout ${batchNumber}`, createdAt: iso(generatedAt + 2 * HOUR) });
        post(tx.id, generatedAt + 2 * HOUR, "PAYOUT", `Payout ${batchNumber}`, [
          { type: "CAPTAIN_PAYABLE", owner: c.d.id, debit: payout.amountMinor },
          { type: "BANK", owner: "operating", credit: payout.amountMinor },
        ], { type: "PAYOUT", id: payout.id });
      }
    });
    batches.push({
      id: batchId,
      batchNumber,
      cityId,
      status,
      totalCaptains: captainsInBatch.length,
      grossMinor: gross,
      commissionOffsetMinor: offset,
      netMinor: gross - offset,
      currency: "USD",
      createdBy: finance.id,
      generatedAt: iso(generatedAt),
      settledAt: status === "COMPLETED" ? iso(generatedAt + 3 * HOUR) : null,
    });
  };
  const austinCaptains = approved.filter((c) => c.d.cityId === cities[0].id);
  makeBatch("PB-2026-W40-ATX", cities[0].id, "PROCESSING", 3, austinCaptains.slice(0, 9), ["PROCESSING", "PROCESSING", "PROCESSING", "PROCESSING", "COMPLETED", "PROCESSING", "PROCESSING", "FAILED", "PROCESSING"]);
  makeBatch("PB-2026-W39-ALL", null, "COMPLETED", 9 * 24, approved, ["COMPLETED"]);
  makeBatch("PB-2026-W38-ATX", cities[0].id, "COMPLETED", 16 * 24, austinCaptains, ["COMPLETED"]);
  // A transfer that never settled: shows up under reconciliation as a stuck payout.
  const stuckCaptain = approved[3];
  payouts.push({
    id: uuid(r),
    captainId: stuckCaptain.d.id,
    batchId: null,
    amountMinor: 18450,
    currency: "USD",
    status: "PROCESSING",
    providerTransferId: `tr_${alnum(24)}`,
    failureReason: null,
    requestedBy: finance.id,
    requestedAt: iso(now - 30 * HOUR),
    processedAt: null,
  });
  payouts.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  batches.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const audit = seedAudit(input, refunds);
  return { payments, transactions, refunds, payouts, batches, accounts, entries, audit };
}

// ── Audit trail ──

interface AuditTemplate {
  category: string;
  action: string;
  targetType: string;
  staffRole: string;
  reason?: string;
  target: () => string;
  diff?: { before: Record<string, unknown>; after: Record<string, unknown> };
}

function seedAudit(input: FinanceSeedInput, refunds: ApiRefund[]): ApiAuditEntry[] {
  const { now, staff, captains, rides, riders } = input;
  const roleOf = (key: string) => staff.find((s) => s.roles.some((x) => x.key === key)) ?? staff[0];
  const rid = () => pick(r, rides).rec.id;
  const cid = () => pick(r, captains).d.id;
  const uid = () => pick(r, riders).id;
  const templates: AuditTemplate[] = [
    { category: "AUTH", action: "auth.staff.login", targetType: "STAFF", staffRole: "OPERATIONS_ADMIN", target: () => roleOf("OPERATIONS_ADMIN").id },
    { category: "AUTH", action: "auth.staff.login", targetType: "STAFF", staffRole: "FINANCE_ADMIN", target: () => roleOf("FINANCE_ADMIN").id },
    { category: "AUTH", action: "auth.staff.login", targetType: "STAFF", staffRole: "CAPTAIN_OPS", target: () => roleOf("CAPTAIN_OPS").id },
    { category: "RIDE", action: "ride.cancelled_by_staff", targetType: "RIDE", staffRole: "OPERATIONS_ADMIN", reason: "Duplicate booking: rider requested cancellation via support", target: rid, diff: { before: { status: "SEARCHING" }, after: { status: "CANCELLED", cancelReasonCode: "SUPPORT" } } },
    { category: "RIDE", action: "ride.fare_adjusted", targetType: "RIDE", staffRole: "FINANCE_ADMIN", reason: "Goodwill credit after a route complaint", target: rid, diff: { before: { adminFareAdjustmentMinor: 0, finalFareMinor: 2840 }, after: { adminFareAdjustmentMinor: -300, finalFareMinor: 2540 } } },
    { category: "RIDE", action: "ride.reassigned", targetType: "RIDE", staffRole: "OPERATIONS_ADMIN", reason: "Original captain stuck in traffic, 18 min ETA", target: rid },
    { category: "RIDE", action: "ride.start_pin_reset", targetType: "RIDE", staffRole: "OPERATIONS_ADMIN", reason: "Rider locked out after 3 wrong PIN attempts", target: rid, diff: { before: { startPinAttempts: 3 }, after: { startPinAttempts: 0 } } },
    { category: "CAPTAIN", action: "captain.approved", targetType: "CAPTAIN", staffRole: "CAPTAIN_OPS", reason: "All documents verified", target: cid, diff: { before: { status: "UNDER_REVIEW" }, after: { status: "APPROVED" } } },
    { category: "CAPTAIN", action: "captain.document_approved", targetType: "DOCUMENT", staffRole: "CAPTAIN_OPS", target: () => uuid(r) },
    { category: "CAPTAIN", action: "captain.document_rejected", targetType: "DOCUMENT", staffRole: "CAPTAIN_OPS", reason: "Insurance policy expired last month", target: () => uuid(r) },
    { category: "CAPTAIN", action: "captain.suspended", targetType: "CAPTAIN", staffRole: "CAPTAIN_OPS", reason: "Two safety incidents within 30 days", target: () => captains[20].d.id, diff: { before: { status: "APPROVED" }, after: { status: "SUSPENDED" } } },
    { category: "USER", action: "user.suspended", targetType: "USER", staffRole: "SUPPORT_AGENT", reason: "Repeated no-shows and unpaid cancellation fees", target: () => riders[11].id },
    { category: "USER", action: "user.updated", targetType: "USER", staffRole: "SUPPORT_AGENT", reason: "Flagged for review: multiple chargebacks", target: uid, diff: { before: { flagged: false }, after: { flagged: true } } },
    { category: "FINANCE", action: "refund.approved", targetType: "REFUND", staffRole: "FINANCE_ADMIN", reason: "Approved after reviewing the trip log", target: () => pick(r, refunds).id },
    { category: "FINANCE", action: "refund.rejected", targetType: "REFUND", staffRole: "FINANCE_ADMIN", reason: "Route matched the quoted route; no overcharge", target: () => pick(r, refunds).id },
    { category: "FINANCE", action: "payout.batch_created", targetType: "PAYOUT_BATCH", staffRole: "FINANCE_ADMIN", reason: "Weekly settlement", target: () => uuid(r) },
    { category: "FINANCE", action: "wallet.adjusted", targetType: "WALLET", staffRole: "FINANCE_ADMIN", reason: "Goodwill credit for a cancelled trip", target: uid, diff: { before: { balanceMinor: 0 }, after: { balanceMinor: 1000 } } },
    { category: "SAFETY", action: "incident.acknowledged", targetType: "INCIDENT", staffRole: "OPERATIONS_ADMIN", target: () => uuid(r) },
    { category: "SAFETY", action: "incident.resolved", targetType: "INCIDENT", staffRole: "OPERATIONS_ADMIN", reason: "Rider confirmed safe", target: () => uuid(r) },
    { category: "STAFF", action: "staff.invited", targetType: "STAFF", staffRole: "SUPER_ADMIN", target: () => staff.find((s) => s.status === "INVITED")?.id ?? uuid(r) },
    { category: "STAFF", action: "staff.roles_changed", targetType: "STAFF", staffRole: "SUPER_ADMIN", reason: "Moved to the support desk", target: () => roleOf("SUPPORT_AGENT").id, diff: { before: { roles: ["READ_ONLY"] }, after: { roles: ["SUPPORT_AGENT"] } } },
    { category: "CONFIG", action: "config.updated", targetType: "CONFIG", staffRole: "SUPER_ADMIN", reason: "Faster offer timeout for peak hours", target: () => "dispatch.offer_timeout_seconds", diff: { before: { value: 30 }, after: { value: 25 } } },
    { category: "CONFIG", action: "feature_flag.updated", targetType: "FEATURE_FLAG", staffRole: "SUPER_ADMIN", reason: "Enable surge in Austin for the weekend", target: () => "surge.enabled", diff: { before: { enabled: false }, after: { enabled: true } } },
    { category: "CONFIG", action: "pricing_rule.created", targetType: "PRICING_RULE", staffRole: "SUPER_ADMIN", reason: "Fuel cost adjustment", target: () => uuid(r) },
    { category: "CONFIG", action: "zone.updated", targetType: "ZONE", staffRole: "SUPER_ADMIN", reason: "Extended the airport pickup zone", target: () => uuid(r) },
    { category: "SUPPORT", action: "support.ticket_updated", targetType: "TICKET", staffRole: "SUPPORT_AGENT", target: () => uuid(r) },
  ];

  const out: ApiAuditEntry[] = [];
  const total = 48;
  for (let i = 0; i < total; i++) {
    const t = templates[i % templates.length];
    const actor = roleOf(t.staffRole);
    const when = now - randInt(r, 2, 70 * 60) * MIN;
    out.push({
      id: uuid(r),
      timestamp: iso(when),
      actor: { realm: "STAFF", id: actor.id, name: actor.name, email: actor.email, role: t.staffRole },
      action: t.action,
      category: t.category,
      targetType: t.targetType,
      targetId: t.target(),
      ipAddress: pick(r, ["198.51.100.17", "203.0.113.45", "192.0.2.88", "198.51.100.204"]),
      requestId: `req-${alnum(10)}`,
      reasonNotes: t.reason ?? null,
      diff: t.diff ? { before: t.diff.before, after: t.diff.after } : null,
    });
  }
  // A few system-actor entries.
  for (let i = 0; i < 4; i++) {
    out.push({
      id: uuid(r),
      timestamp: iso(now - randInt(r, 10, 600) * MIN),
      actor: { realm: "SYSTEM", id: null, name: null, email: null, role: null },
      action: pick(r, ["ride.dispatch_exhausted", "document.expiry_sweep", "payout.batch_scheduled", "refund.auto_issued"]),
      category: "SYSTEM",
      targetType: "SYSTEM",
      targetId: "scheduler",
      ipAddress: null,
      requestId: null,
      reasonNotes: null,
      diff: null,
    });
  }
  return out.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
