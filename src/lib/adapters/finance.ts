/**
 * Finance adapters: DTOs of GET /admin/transactions, /refunds, /payouts, /payout-batches, /finance/summary,
 * /finance/discrepancies, /ledger/* mapped onto the UI types in `@/types` (money in dollars, ids kept for actions).
 * Money from the API is integer minor units; the UI types hold major units, the `*Minor` fields are kept for display.
 */
import type { PayoutBatch, RefundRequest, Transaction } from "@/types";
import { minorToMajor } from "@/lib/format";

// ── Enums (backend prisma enums) ──────────────────────────────

export type ApiTransactionType = "RIDE_FARE" | "TIP" | "CANCELLATION_FEE" | "NO_SHOW_FEE" | "REFUND" | "PAYOUT" | "WALLET_TOPUP" | "ADJUSTMENT";
export type ApiTransactionStatus = "SUCCESS" | "PENDING" | "FAILED" | "DISPUTED";
export type ApiRefundStatus = "PENDING" | "APPROVED" | "REJECTED" | "PROCESSING" | "PROCESSED" | "FAILED";
export type ApiRefundCategory =
  | "OVERCHARGED"
  | "DRIVER_MISBEHAVIOR"
  | "ROUTE_DEVIATION"
  | "VEHICLE_ISSUE"
  | "ACCIDENTAL_CHARGE"
  | "DUPLICATE_CHARGE"
  | "CANCELLATION"
  | "SERVICE_FAILURE"
  | "SAFETY_INCIDENT"
  | "OTHER";
export type ApiPayoutStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type ApiBatchStatus = "SCHEDULED" | "PROCESSING" | "COMPLETED" | "FAILED";
export type ApiPaymentStatus =
  | "REQUIRES_PAYMENT_METHOD"
  | "REQUIRES_ACTION"
  | "PROCESSING"
  | "AUTHORIZED"
  | "CAPTURED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "DISPUTED";

export const TRANSACTION_TYPES: ApiTransactionType[] = ["RIDE_FARE", "TIP", "CANCELLATION_FEE", "NO_SHOW_FEE", "REFUND", "PAYOUT", "WALLET_TOPUP", "ADJUSTMENT"];
export const TRANSACTION_STATUSES: ApiTransactionStatus[] = ["SUCCESS", "PENDING", "FAILED", "DISPUTED"];
export const REFUND_STATUSES: ApiRefundStatus[] = ["PENDING", "APPROVED", "PROCESSING", "PROCESSED", "REJECTED", "FAILED"];
export const PAYOUT_STATUSES: ApiPayoutStatus[] = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"];
export const TRANSACTION_GATEWAYS = ["STRIPE", "MOCK", "WALLET", "CASH"] as const;

// ── Transactions ──────────────────────────────────────────────

/** Row of GET /admin/transactions (raw `transactions` table row). */
export interface ApiTransaction {
  id: string;
  type: ApiTransactionType;
  status: ApiTransactionStatus;
  rideId: string | null;
  paymentId: string | null;
  refundId: string | null;
  payoutId: string | null;
  riderId: string | null;
  captainId: string | null;
  cityId: string | null;
  gateway: string;
  amountMinor: number;
  platformFeeMinor: number;
  captainEarningsMinor: number;
  taxMinor: number;
  currency: string;
  idempotencyKey: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/** UI Transaction with the real (wider) enums plus the ids/minor amounts the table needs. */
export interface TransactionView extends Omit<Transaction, "gateway" | "type" | "rideId"> {
  rideId: string | null;
  gateway: string;
  type: ApiTransactionType;
  amountMinor: number;
  platformFeeMinor: number;
  currency: string;
  riderId: string | null;
  captainId: string | null;
  cityId: string | null;
  payoutId: string | null;
  description: string | null;
  createdAt: string;
}

export function toTransaction(t: ApiTransaction): TransactionView {
  return {
    id: t.id,
    rideId: t.rideId,
    idempotencyKey: t.idempotencyKey ?? "",
    amount: minorToMajor(t.amountMinor),
    amountMinor: t.amountMinor,
    platformFee: minorToMajor(t.platformFeeMinor),
    platformFeeMinor: t.platformFeeMinor,
    captainEarnings: minorToMajor(t.captainEarningsMinor),
    gateway: t.gateway,
    type: t.type,
    status: t.status,
    timestamp: t.createdAt,
    createdAt: t.createdAt,
    customerName: "",
    captainName: "",
    currency: (t.currency ?? "USD").trim(),
    riderId: t.riderId,
    captainId: t.captainId,
    cityId: t.cityId,
    payoutId: t.payoutId,
    description: t.description,
  };
}

// ── Refunds ───────────────────────────────────────────────────

/** Row of GET /admin/refunds (raw `refunds` row). */
export interface ApiRefund {
  id: string;
  paymentId: string;
  rideId: string | null;
  amountMinor: number;
  currency: string;
  category: ApiRefundCategory;
  reason: string;
  status: ApiRefundStatus;
  isAutomatic: boolean;
  toWallet: boolean;
  requestedByRealm: string;
  requestedById: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  providerRefundId: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RefundView extends Omit<RefundRequest, "status" | "category" | "rideId"> {
  rideId: string | null;
  status: ApiRefundStatus;
  category: ApiRefundCategory;
  amountMinor: number;
  currency: string;
  paymentId: string;
  toWallet: boolean;
  isAutomatic: boolean;
  requestedById: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  failureReason: string | null;
}

export const shortId = (id: string | null | undefined): string => (id ? id.slice(0, 8) : "—");

export function toRefund(r: ApiRefund): RefundView {
  return {
    id: r.id,
    rideId: r.rideId,
    riderName: "",
    riderPhone: "",
    amount: minorToMajor(r.amountMinor),
    amountMinor: r.amountMinor,
    currency: (r.currency ?? "USD").trim(),
    reason: r.reason,
    category: r.category,
    status: r.status,
    requestedAt: r.createdAt,
    reviewedBy: r.reviewedBy ? `Staff ${shortId(r.reviewedBy)}` : undefined,
    reviewedById: r.reviewedBy,
    reviewedAt: r.reviewedAt,
    reviewNotes: r.reviewNotes ?? undefined,
    paymentId: r.paymentId,
    toWallet: r.toWallet,
    isAutomatic: r.isAutomatic,
    requestedById: r.requestedById,
    failureReason: r.failureReason,
  };
}

// ── Payout batches & payouts ──────────────────────────────────

/** Row of GET /admin/payout-batches (bigint columns arrive as numbers, or strings above 2^53). */
export interface ApiPayoutBatch {
  id: string;
  batchNumber: string;
  cityId: string | null;
  status: ApiBatchStatus;
  totalCaptains: number;
  grossMinor: number | string;
  commissionOffsetMinor: number | string;
  netMinor: number | string;
  currency: string;
  createdBy: string | null;
  generatedAt: string;
  settledAt: string | null;
}

export interface PayoutBatchView extends PayoutBatch {
  cityId: string | null;
  currency: string;
  grossMinor: number;
  commissionOffsetMinor: number;
  netMinor: number;
}

export function toPayoutBatch(b: ApiPayoutBatch, cityName: (id: string | null) => string): PayoutBatchView {
  const gross = Number(b.grossMinor);
  const offset = Number(b.commissionOffsetMinor);
  const net = Number(b.netMinor);
  return {
    id: b.id,
    batchNumber: b.batchNumber,
    city: b.cityId ? cityName(b.cityId) : "All cities",
    totalCaptains: b.totalCaptains,
    totalGrossPayable: minorToMajor(gross),
    commissionOffset: minorToMajor(offset),
    netPayoutAmount: minorToMajor(net),
    status: b.status,
    generatedAt: b.generatedAt,
    settledAt: b.settledAt ?? undefined,
    cityId: b.cityId,
    currency: (b.currency ?? "USD").trim(),
    grossMinor: gross,
    commissionOffsetMinor: offset,
    netMinor: net,
  };
}

/** Row of GET /admin/payouts. */
export interface ApiPayout {
  id: string;
  captainId: string;
  batchId: string | null;
  amountMinor: number;
  currency: string;
  status: ApiPayoutStatus;
  providerTransferId: string | null;
  failureReason: string | null;
  requestedBy: string;
  requestedAt: string;
  processedAt: string | null;
}

// ── Summary / reconciliation ──────────────────────────────────

export interface ApiFinanceSummary {
  range: { from: string; to: string };
  transactions: Array<{
    type: ApiTransactionType;
    status: ApiTransactionStatus;
    count: number;
    amountMinor: number;
    platformFeeMinor: number;
    captainEarningsMinor: number;
    taxMinor: number;
  }>;
  platformRevenueBalanceMinor: number;
  openPayouts: { count: number; amountMinor: number };
}

const REVENUE_TYPES: ApiTransactionType[] = ["RIDE_FARE", "CANCELLATION_FEE", "NO_SHOW_FEE", "TIP"];

export interface FinanceKpis {
  gmvMinor: number;
  platformNetMinor: number;
  refundedMinor: number;
  platformRevenueBalanceMinor: number;
  openPayoutCount: number;
  openPayoutMinor: number;
}

/** GMV = settled fares, fees and tips; platform net = commission + fees net of refund reversals (all SUCCESS rows). */
export function toKpis(s: ApiFinanceSummary): FinanceKpis {
  let gmv = 0;
  let net = 0;
  let refunded = 0;
  for (const g of s.transactions) {
    if (g.status !== "SUCCESS") continue;
    if (REVENUE_TYPES.includes(g.type)) gmv += g.amountMinor;
    if (REVENUE_TYPES.includes(g.type) || g.type === "REFUND" || g.type === "ADJUSTMENT") net += g.platformFeeMinor;
    if (g.type === "REFUND") refunded += g.amountMinor;
  }
  return {
    gmvMinor: gmv,
    platformNetMinor: net,
    refundedMinor: refunded,
    platformRevenueBalanceMinor: s.platformRevenueBalanceMinor,
    openPayoutCount: s.openPayouts.count,
    openPayoutMinor: s.openPayouts.amountMinor,
  };
}

export type DiscrepancyKind = "UNBALANCED_TRANSACTION" | "ACCOUNT_BALANCE_DRIFT" | "CAPTURED_WITHOUT_LEDGER" | "STUCK_PAYOUT";

export interface ApiDiscrepancies {
  at: string;
  items: Array<{ kind: DiscrepancyKind; ref: string; detail: string }>;
}

export const DISCREPANCY_LABELS: Record<DiscrepancyKind, string> = {
  UNBALANCED_TRANSACTION: "Unbalanced ledger transaction",
  ACCOUNT_BALANCE_DRIFT: "Account balance drift",
  CAPTURED_WITHOUT_LEDGER: "Captured payment without ledger posting",
  STUCK_PAYOUT: "Stuck payout transfer",
};

// ── Payments (problem list) & ledger ──────────────────────────

/** Row of GET /admin/payments (paymentView + a few raw fields). `clientSecret` is deliberately not typed: never shown. */
export interface ApiPayment {
  id: string;
  rideId: string | null;
  riderId: string;
  purpose: string;
  method: string;
  provider: string;
  providerRef: string | null;
  status: ApiPaymentStatus;
  amountMinor: number;
  capturedMinor: number;
  refundedMinor: number;
  currency: string;
  attemptCount: number;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiLedgerAccount {
  id: string;
  type: string;
  ownerId: string;
  currency: string;
  balanceMinor: number;
  updatedAt: string;
}

export interface ApiLedgerEntry {
  id: string;
  txnId: string;
  account: { id: string; type: string; ownerId: string };
  debitMinor: number;
  creditMinor: number;
  currency: string;
  kind: string;
  description: string | null;
  refType: string | null;
  refId: string | null;
  at: string;
}

export const LEDGER_ACCOUNT_TYPES = [
  "RIDER_WALLET",
  "CAPTAIN_PAYABLE",
  "CAPTAIN_CASH_IN_HAND",
  "PLATFORM_REVENUE",
  "TAX_PAYABLE",
  "PROVIDER_CLEARING",
  "MARKETING_EXPENSE",
  "SUPPORT_EXPENSE",
  "INCENTIVE_PAYABLE",
  "BANK",
] as const;

// ── Lookup DTOs used to resolve names (rides.view / users.view / captains.view) ──

export interface ApiRideDetailLite {
  ride: { id: string; bookingRef: string };
  rider: { name: string | null; phone?: string | null };
  captain: { name: string | null } | null;
}
