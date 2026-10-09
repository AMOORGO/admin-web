/** Finance: transactions, payments, refunds (approve / reject), payouts and batches, ledger reconciliation, reports. */
import type { ApiDiscrepancies, ApiFinanceSummary, ApiPayment, ApiPayout, ApiPayoutBatch, ApiRefund, ApiTransactionStatus, ApiTransactionType } from "../../adapters/finance";
import { addTransaction, postEntries } from "../logic/ledger";
import { type Ctx, type Router, listResult, ok } from "../router";
import { recordAudit } from "../store";
import { DAY, HOUR, DemoError, asBody, conflict, flagParam, iso, inRange, notFound, randInt, reqStr, rng, str, uuid } from "../util";

function refundOr404(ctx: Ctx): ApiRefund {
  const x = ctx.store.refunds.find((f) => f.id === ctx.params.id);
  if (!x) throw notFound("Refund");
  return x;
}

const PROBLEM_PAYMENT: ApiPayment["status"][] = ["FAILED", "DISPUTED", "REQUIRES_ACTION", "REQUIRES_PAYMENT_METHOD"];

function csvCell(v: string | number | null): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  return [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
}

const alnum = (n: number): string => Array.from({ length: n }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[randInt(rng, 0, 35)]).join("");

export function registerFinance(r: Router): void {
  r.get("/admin/transactions", (ctx) => {
    const { query } = ctx;
    const rows = ctx.store.transactions.filter(
      (t) => (!query.type || t.type === query.type) && (!query.status || t.status === query.status) && (!query.gateway || t.gateway === query.gateway) && (!query.cityId || t.cityId === query.cityId),
    );
    return listResult(rows, query);
  });

  r.get("/admin/payments", (ctx) => {
    const { query } = ctx;
    const now = Date.now();
    const rows = ctx.store.payments
      .filter((p) => {
        if (query.rideId && p.rideId !== query.rideId) return false;
        if (!flagParam(query.problemsOnly)) return true;
        return PROBLEM_PAYMENT.includes(p.status) || (p.status === "PROCESSING" && now - new Date(p.createdAt).getTime() > 15 * 60_000);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return listResult(rows, query, 10);
  });

  r.get("/admin/refunds", (ctx) => {
    const { query } = ctx;
    const rows = ctx.store.refunds.filter((x) => !query.status || x.status === query.status).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return listResult(rows, query);
  });

  const decide = (ctx: Ctx, mode: "approve" | "reject") => {
    const refund = refundOr404(ctx);
    const reason = reqStr(asBody(ctx.body), "reason");
    if (refund.status !== "PENDING") throw conflict(`A refund in status ${refund.status} cannot be ${mode === "approve" ? "approved" : "rejected"}`);
    const before = { status: refund.status };
    const now = iso(Date.now());
    refund.reviewedBy = ctx.store.me.id;
    refund.reviewedAt = now;
    refund.reviewNotes = reason;
    refund.updatedAt = now;
    if (mode === "reject") {
      refund.status = "REJECTED";
    } else {
      refund.status = "PROCESSED";
      refund.providerRefundId = `re_${alnum(24)}`;
      const payment = ctx.store.payments.find((p) => p.id === refund.paymentId);
      const ride = ctx.store.rides.find((row) => row.payment?.id === refund.paymentId);
      if (payment) {
        payment.refundedMinor += refund.amountMinor;
        payment.status = payment.refundedMinor >= payment.capturedMinor ? "REFUNDED" : "PARTIALLY_REFUNDED";
        payment.updatedAt = now;
      }
      if (ride?.payment) {
        ride.payment.refundedMinor += refund.amountMinor;
        ride.payment.status = ride.payment.refundedMinor >= ride.payment.capturedMinor ? "REFUNDED" : "PARTIALLY_REFUNDED";
        ride.rec.paymentStatus = ride.payment.status;
      }
      const txId = uuid();
      postEntries(
        ctx.store,
        txId,
        "REFUND",
        "Refund processed",
        [
          { type: "PLATFORM_REVENUE", owner: "platform", debit: refund.amountMinor },
          { type: "PROVIDER_CLEARING", owner: "stripe", credit: refund.amountMinor },
        ],
        { type: "REFUND", id: refund.id },
      );
      addTransaction(ctx.store, {
        id: txId,
        type: "REFUND",
        status: "SUCCESS",
        rideId: refund.rideId,
        paymentId: refund.paymentId,
        refundId: refund.id,
        riderId: ride?.rec.riderId ?? null,
        captainId: ride?.rec.captainId ?? null,
        cityId: ride?.rec.cityId ?? null,
        amountMinor: refund.amountMinor,
        platformFeeMinor: -refund.amountMinor,
        idempotencyKey: `refund:${refund.id}`,
        description: "Refund processed",
      });
    }
    recordAudit(ctx.store, { category: "FINANCE", action: mode === "approve" ? "refund.approved" : "refund.rejected", targetType: "REFUND", targetId: refund.id, reason, before, after: { status: refund.status, amountMinor: refund.amountMinor } });
    return ok(refund);
  };
  r.post("/admin/refunds/:id/approve", (ctx) => decide(ctx, "approve"));
  r.post("/admin/refunds/:id/reject", (ctx) => decide(ctx, "reject"));

  r.get("/admin/payout-batches", (ctx) => listResult(ctx.store.batches, ctx.query, 10));
  r.get("/admin/payouts", (ctx) => {
    const { query } = ctx;
    return listResult(ctx.store.payouts.filter((p) => (!query.status || p.status === query.status) && (!query.batchId || p.batchId === query.batchId)), query);
  });

  r.post("/admin/payouts/batch", (ctx) => {
    const body = asBody(ctx.body);
    const reason = reqStr(body, "reason");
    const cityId = str(body, "cityId") ?? null;
    const captains = ctx.store.captains.filter((c) => c.d.status === "APPROVED" && c.d.payoutsEnabled && (!cityId || c.d.cityId === cityId));
    if (captains.length === 0) throw new DemoError(422, "NOTHING_TO_PAY", "No captains have a payable balance in the selected scope");
    const now = Date.now();
    const batchId = uuid();
    const seq = ctx.store.batches.length + 1;
    const batchNumber = `PB-2026-${String(seq).padStart(4, "0")}${cityId ? "-" + (ctx.store.cities.find((c) => c.id === cityId)?.name.slice(0, 3).toUpperCase() ?? "CTY") : "-ALL"}`;
    let gross = 0;
    let offset = 0;
    for (const c of captains) {
      const amount = randInt(rng, 6500, 48000);
      const off = randInt(rng, 0, 1500);
      gross += amount;
      offset += off;
      const payout: ApiPayout = {
        id: uuid(),
        captainId: c.d.id,
        batchId,
        amountMinor: amount - off,
        currency: "USD",
        status: "PROCESSING",
        providerTransferId: `tr_${alnum(24)}`,
        failureReason: null,
        requestedBy: ctx.store.me.id,
        requestedAt: iso(now),
        processedAt: null,
      };
      ctx.store.payouts.unshift(payout);
    }
    const batch: ApiPayoutBatch = {
      id: batchId,
      batchNumber,
      cityId,
      status: "PROCESSING",
      totalCaptains: captains.length,
      grossMinor: gross,
      commissionOffsetMinor: offset,
      netMinor: gross - offset,
      currency: "USD",
      createdBy: ctx.store.me.id,
      generatedAt: iso(now),
      settledAt: null,
    };
    ctx.store.batches.unshift(batch);
    recordAudit(ctx.store, { category: "FINANCE", action: "payout.batch_created", targetType: "PAYOUT_BATCH", targetId: batch.id, reason, after: { batchNumber, captains: captains.length, netMinor: batch.netMinor } });
    return ok(batch);
  });

  r.post("/admin/payouts/:id/retry", (ctx) => {
    const payout = ctx.store.payouts.find((p) => p.id === ctx.params.id);
    if (!payout) throw notFound("Payout");
    const reason = reqStr(asBody(ctx.body), "reason");
    if (payout.status !== "FAILED") throw conflict("Only a failed payout can be retried");
    const fresh: ApiPayout = { ...payout, id: uuid(), status: "PROCESSING", failureReason: null, providerTransferId: `tr_${alnum(24)}`, requestedBy: ctx.store.me.id, requestedAt: iso(Date.now()), processedAt: null };
    ctx.store.payouts.unshift(fresh);
    recordAudit(ctx.store, { category: "FINANCE", action: "payout.retried", targetType: "PAYOUT", targetId: payout.id, reason, after: { newPayoutId: fresh.id } });
    return ok(fresh);
  });

  r.get("/admin/finance/summary", (ctx) => {
    const { query } = ctx;
    const to = query.to ?? iso(Date.now());
    const from = query.from ?? iso(Date.now() - 30 * DAY);
    const groups = new Map<string, ApiFinanceSummary["transactions"][number]>();
    for (const t of ctx.store.transactions) {
      if (!inRange(new Date(t.createdAt).getTime(), from, to)) continue;
      const key = `${t.type}:${t.status}`;
      const g = groups.get(key) ?? { type: t.type as ApiTransactionType, status: t.status as ApiTransactionStatus, count: 0, amountMinor: 0, platformFeeMinor: 0, captainEarningsMinor: 0, taxMinor: 0 };
      g.count += 1;
      g.amountMinor += t.amountMinor;
      g.platformFeeMinor += t.platformFeeMinor;
      g.captainEarningsMinor += t.captainEarningsMinor;
      g.taxMinor += t.taxMinor;
      groups.set(key, g);
    }
    const open = ctx.store.payouts.filter((p) => p.status === "PENDING" || p.status === "PROCESSING");
    const out: ApiFinanceSummary = {
      range: { from, to },
      transactions: [...groups.values()],
      platformRevenueBalanceMinor: ctx.store.accounts.find((a) => a.type === "PLATFORM_REVENUE")?.balanceMinor ?? 0,
      openPayouts: { count: open.length, amountMinor: open.reduce((a, p) => a + p.amountMinor, 0) },
    };
    return ok(out);
  });

  r.get("/admin/finance/discrepancies", (ctx) => {
    const now = Date.now();
    const items: ApiDiscrepancies["items"] = ctx.store.payouts
      .filter((p) => p.status === "PROCESSING" && now - new Date(p.requestedAt).getTime() > 24 * HOUR)
      .map((p) => ({
        kind: "STUCK_PAYOUT" as const,
        ref: p.id,
        detail: `Transfer ${p.providerTransferId ?? "(none)"} has been processing since ${new Date(p.requestedAt).toISOString().slice(0, 16).replace("T", " ")} UTC without a settlement callback.`,
      }));
    const out: ApiDiscrepancies = { at: iso(now), items };
    return ok(out);
  });

  r.get("/admin/reports/payments", (ctx) => {
    const { query } = ctx;
    const rows = ctx.store.payments
      .filter((p) => inRange(new Date(p.createdAt).getTime(), query.from, query.to))
      .map((p) => [p.id, p.rideId, p.method, p.provider, p.status, (p.amountMinor / 100).toFixed(2), (p.capturedMinor / 100).toFixed(2), (p.refundedMinor / 100).toFixed(2), p.currency, p.createdAt]);
    return { file: { text: toCsv(["PaymentId", "RideId", "Method", "Provider", "Status", "Amount", "Captured", "Refunded", "Currency", "CreatedAt"], rows), filename: "amoorgo-payments.csv", contentType: "text/csv" } };
  });

  r.get("/admin/reports/revenue", (ctx) => {
    const { query } = ctx;
    const byDay = new Map<string, { gross: number; fees: number; tax: number; count: number }>();
    for (const t of ctx.store.transactions) {
      if (t.status !== "SUCCESS" || t.type !== "RIDE_FARE") continue;
      if (!inRange(new Date(t.createdAt).getTime(), query.from, query.to)) continue;
      const day = t.createdAt.slice(0, 10);
      const g = byDay.get(day) ?? { gross: 0, fees: 0, tax: 0, count: 0 };
      g.gross += t.amountMinor;
      g.fees += t.platformFeeMinor;
      g.tax += t.taxMinor;
      g.count += 1;
      byDay.set(day, g);
    }
    const rows = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, g]) => [day, g.count, (g.gross / 100).toFixed(2), (g.fees / 100).toFixed(2), (g.tax / 100).toFixed(2)]);
    return { file: { text: toCsv(["Date", "Rides", "Gross", "PlatformFees", "Tax"], rows), filename: "amoorgo-revenue.csv", contentType: "text/csv" } };
  });
}
