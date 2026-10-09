/** Rides: list, detail, timeline and the staff interventions (cancel, assign / reassign, adjust fare, change status, reset PIN). */
import {
  allowedStatusTargets,
  canAdjustFare,
  canCancelRide,
  canReassignRide,
  type ApiDispatchAttempt,
  type ApiPersonCard,
  type ApiRideDetail,
  type ApiRideListItem,
  type ApiRideStatus,
} from "../../adapters/rides";
import { numberConfig } from "../logic/config";
import { appendEvent } from "../logic/ride";
import { inScope } from "../logic/scope";
import { type Ctx, type Router, listResult, ok } from "../router";
import { type CaptainRow, type RideRow, captainById, recordAudit, rideById, riderById } from "../store";
import { DemoError, asBody, bool, conflict, flagParam, inRange, iso, matchesQuery, notFound, num, randInt, reqStr, rng, str, uuid } from "../util";

function rideOr404(ctx: Ctx): RideRow {
  const row = rideById(ctx.store, ctx.params.id);
  if (!row || !inScope(ctx.store, row.rec.cityId)) throw notFound("Ride");
  return row;
}

function vehicleCard(c: CaptainRow) {
  const v = c.d.vehicle;
  return v ? { make: v.make, model: v.model, color: v.color, plateNumber: v.plateNumber, year: v.year } : null;
}

function toListItem(ctx: Ctx, row: RideRow): ApiRideListItem {
  const { rec } = row;
  const rider = riderById(ctx.store, rec.riderId);
  const captain = captainById(ctx.store, rec.captainId);
  return {
    id: rec.id,
    bookingRef: rec.bookingRef,
    cityId: rec.cityId,
    serviceType: rec.serviceType,
    status: rec.status,
    requestedAt: rec.requestedAt,
    startedAt: rec.startedAt,
    completedAt: rec.completedAt,
    rider: { id: rec.riderId, name: rider?.name ?? null, rating: rider?.rating ?? null, photoUrl: null },
    captain: captain ? { id: captain.d.id, name: captain.d.name, rating: captain.d.metrics.rating, photoUrl: null, vehicle: vehicleCard(captain) } : null,
    pickupAddress: rec.pickupAddress,
    dropAddress: rec.dropAddress,
    estimatedFareMinor: rec.estimatedFareMinor,
    finalFareMinor: rec.finalFareMinor,
    currency: rec.currency,
    paymentMethod: rec.paymentMethod,
    paymentStatus: rec.paymentStatus,
    hasSosAlert: rec.hasSosAlert,
    isNoShow: rec.isNoShow,
  };
}

function personCard(c: CaptainRow): ApiPersonCard {
  return {
    id: c.d.id,
    name: c.d.name,
    photoUrl: null,
    ratingAvg: c.d.metrics.rating,
    ratingCount: c.d.metrics.ratingCount,
    phone: c.d.phone,
    email: c.d.email,
    vehicle: vehicleCard(c),
  };
}

function toDetail(ctx: Ctx, row: RideRow): ApiRideDetail {
  const { rec } = row;
  const rider = riderById(ctx.store, rec.riderId);
  const captain = captainById(ctx.store, rec.captainId);
  const active = captain && ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "RIDE_STARTED", "IN_PROGRESS"].includes(rec.status);
  return {
    ride: { ...rec },
    rider: {
      id: rec.riderId,
      name: rider?.name ?? "Unknown rider",
      photoUrl: null,
      ratingAvg: rider?.rating ?? 0,
      ratingCount: rider?.ratingCount,
      phone: rider?.phone ?? "",
      email: rider?.email ?? null,
    },
    captain: captain ? personCard(captain) : null,
    payment: row.payment,
    liveLocation: active ? { lat: captain.lat, lng: captain.lng, heading: randInt(rng, 0, 359), ts: iso(Date.now()) } : null,
    dispatchAttempts: row.attempts,
  };
}

function releaseCaptain(ctx: Ctx, captainId: string | null): void {
  const c = captainById(ctx.store, captainId);
  if (!c) return;
  c.d.onRide = false;
  c.d.activeRideId = null;
  if (c.d.status === "APPROVED") c.d.availability = "ONLINE";
}

function occupyCaptain(c: CaptainRow, rideId: string): void {
  c.d.onRide = true;
  c.d.activeRideId = rideId;
  c.d.availability = "ON_RIDE";
}

function sortedByRequested(rows: RideRow[]): RideRow[] {
  return [...rows].sort((a, b) => new Date(b.rec.requestedAt).getTime() - new Date(a.rec.requestedAt).getTime());
}

function applyAdjustment(ctx: Ctx, row: RideRow, amountMinor: number, reason: string, action: string): void {
  const before = { adminFareAdjustmentMinor: row.rec.adminFareAdjustmentMinor, finalFareMinor: row.rec.finalFareMinor };
  const base = row.rec.finalFareMinor ?? row.rec.estimatedFareMinor;
  row.rec.adminFareAdjustmentMinor += amountMinor;
  row.rec.finalFareMinor = Math.max(0, base + amountMinor);
  if (row.payment) row.payment.amountMinor = Math.max(0, row.payment.amountMinor + amountMinor);
  row.rec.version += 1;
  recordAudit(ctx.store, {
    category: "RIDE",
    action,
    targetType: "RIDE",
    targetId: row.rec.id,
    reason,
    before,
    after: { adminFareAdjustmentMinor: row.rec.adminFareAdjustmentMinor, finalFareMinor: row.rec.finalFareMinor },
  });
}

export function registerRides(r: Router): void {
  r.get("/admin/rides", (ctx) => {
    const { query } = ctx;
    const statuses = (query.statuses ?? "").split(",").filter(Boolean);
    const rows = sortedByRequested(ctx.store.rides).filter((row) => {
      const rec = row.rec;
      if (!inScope(ctx.store, rec.cityId)) return false;
      if (query.cityId && rec.cityId !== query.cityId) return false;
      if (query.captainId && rec.captainId !== query.captainId) return false;
      if (query.riderId && rec.riderId !== query.riderId) return false;
      if (query.status && rec.status !== query.status) return false;
      if (statuses.length > 0 && !statuses.includes(rec.status)) return false;
      if (query.serviceType && rec.serviceType.code !== query.serviceType) return false;
      if (flagParam(query.hasSos) && !rec.hasSosAlert) return false;
      if (!inRange(new Date(rec.requestedAt).getTime(), query.from, query.to)) return false;
      const rider = riderById(ctx.store, rec.riderId);
      const captain = captainById(ctx.store, rec.captainId);
      return matchesQuery(query.q, rec.bookingRef, rec.id, rider?.name, rider?.phone, captain?.d.name, captain?.d.vehicle?.plateNumber, rec.pickupAddress, rec.dropAddress);
    });
    return listResult(rows.map((row) => toListItem(ctx, row)), query);
  });

  r.get("/admin/rides/:id", (ctx) => ok(toDetail(ctx, rideOr404(ctx))));
  r.get("/admin/rides/:id/timeline", (ctx) => ok(rideOr404(ctx).events.map((e) => ({ ...e }))));

  r.post("/admin/rides/:id/cancel", (ctx) => {
    const row = rideOr404(ctx);
    const body = asBody(ctx.body);
    const reasonCode = reqStr(body, "reasonCode");
    const reason = str(body, "reason") ?? null;
    if (!canCancelRide(row.rec.status)) throw conflict(`A ride in status ${row.rec.status} cannot be cancelled by staff`);
    const before = { status: row.rec.status, captainId: row.rec.captainId };
    const waive = bool(body, "waiveFee") ?? true;
    const fee = waive ? 0 : row.rec.assignedAt ? 300 : 0;
    const now = Date.now();
    releaseCaptain(ctx, row.rec.captainId);
    row.rec.status = "CANCELLED";
    row.rec.cancelledAt = iso(now);
    row.rec.cancelledBy = "ADMIN";
    row.rec.cancelReasonCode = reasonCode;
    row.rec.cancelReason = reason;
    row.rec.cancellationFeeMinor = fee;
    if (row.payment && row.payment.status === "AUTHORIZED") {
      row.payment.status = "CANCELLED";
      row.rec.paymentStatus = "CANCELLED";
    }
    appendEvent(row, "CANCELLED", now, { realm: "STAFF", id: ctx.store.me.id }, `Cancelled by ${ctx.store.me.name} (${reasonCode})${reason ? `: ${reason}` : ""}`);
    recordAudit(ctx.store, { category: "RIDE", action: "ride.cancelled_by_staff", targetType: "RIDE", targetId: row.rec.id, reason, before, after: { status: "CANCELLED", cancelReasonCode: reasonCode, feeWaived: waive } });
    return ok({ id: row.rec.id, status: row.rec.status });
  });

  const assign = (ctx: Ctx, verb: "assign" | "reassign") => {
    const row = rideOr404(ctx);
    const body = asBody(ctx.body);
    const reason = str(body, "reason") ?? null;
    if (!canReassignRide(row.rec.status)) throw conflict(`A ride in status ${row.rec.status} cannot be ${verb}ed`);
    const captainId = str(body, "captainId");
    const now = Date.now();
    const previous = row.rec.captainId;
    if (captainId) {
      const cap = captainById(ctx.store, captainId);
      if (!cap) throw notFound("Captain");
      if (cap.d.status !== "APPROVED") throw conflict("Only approved captains can be assigned to a ride");
      if (cap.d.activeRideId && cap.d.activeRideId !== row.rec.id) throw conflict("That captain is already on another ride");
      if (previous && previous !== captainId) releaseCaptain(ctx, previous);
      row.rec.captainId = captainId;
      row.rec.status = "DRIVER_ASSIGNED";
      row.rec.assignedAt = iso(now);
      occupyCaptain(cap, row.rec.id);
      const attempt: ApiDispatchAttempt = {
        attemptNo: row.attempts.length + 1,
        radiusMeters: 0,
        strategy: "MANUAL",
        candidateCount: 1,
        result: "MANUAL_ASSIGN",
        startedAt: iso(now),
        endedAt: iso(now),
        candidates: null,
        offers: [],
      };
      row.attempts.push(attempt);
      row.rec.dispatchAttemptCount = row.attempts.length;
      appendEvent(row, "DRIVER_ASSIGNED", now, { realm: "STAFF", id: ctx.store.me.id }, `${cap.d.name} ${verb}ed by ${ctx.store.me.name}${reason ? `: ${reason}` : ""}`);
      recordAudit(ctx.store, { category: "RIDE", action: verb === "assign" ? "ride.assigned" : "ride.reassigned", targetType: "RIDE", targetId: row.rec.id, reason, before: { captainId: previous }, after: { captainId } });
    } else {
      releaseCaptain(ctx, previous);
      row.rec.captainId = null;
      row.rec.status = "SEARCHING";
      row.rec.assignedAt = null;
      row.rec.arrivedAt = null;
      appendEvent(row, "SEARCHING", now, { realm: "STAFF", id: ctx.store.me.id }, `Sent back to automatic dispatch by ${ctx.store.me.name}${reason ? `: ${reason}` : ""}`);
      recordAudit(ctx.store, { category: "RIDE", action: "ride.dispatch_restarted", targetType: "RIDE", targetId: row.rec.id, reason, before: { captainId: previous, status: "DRIVER_ASSIGNED" }, after: { captainId: null, status: "SEARCHING" } });
    }
    return ok({ id: row.rec.id, status: row.rec.status, captainId: row.rec.captainId });
  };
  r.post("/admin/rides/:id/reassign", (ctx) => assign(ctx, "reassign"));
  r.post("/admin/rides/:id/assign", (ctx) => assign(ctx, "assign"));

  r.post("/admin/rides/:id/adjust-fare", (ctx) => {
    const row = rideOr404(ctx);
    const body = asBody(ctx.body);
    const amount = num(body, "amountMinor");
    const reason = reqStr(body, "reason");
    if (amount === undefined || !Number.isInteger(amount) || amount === 0) throw new DemoError(400, "VALIDATION_FAILED", "amountMinor must be a non-zero integer");
    if (!canAdjustFare(row.rec.status)) throw conflict(`The fare of a ride in status ${row.rec.status} cannot be adjusted`);
    const threshold = numberConfig(ctx.store, "fare.adjust_second_approver_over_minor", 5000, row.rec.cityId);
    if (Math.abs(amount) > threshold) {
      const approvalId = uuid();
      ctx.store.approvals.set(approvalId, { id: approvalId, rideId: row.rec.id, amountMinor: amount, reason });
      recordAudit(ctx.store, { category: "RIDE", action: "ride.fare_adjustment_proposed", targetType: "RIDE", targetId: row.rec.id, reason, after: { amountMinor: amount, approvalId } });
      return ok({
        status: "PENDING_APPROVAL",
        approvalId,
        message: `Adjustments above ${(threshold / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} need a second approver. Approval ID: ${approvalId}`,
      });
    }
    applyAdjustment(ctx, row, amount, reason, "ride.fare_adjusted");
    return ok({ status: "APPLIED", finalFareMinor: row.rec.finalFareMinor });
  });

  r.post("/admin/rides/:id/adjust-fare/:approvalId/approve", (ctx) => {
    const row = rideOr404(ctx);
    const approval = ctx.store.approvals.get(ctx.params.approvalId);
    if (!approval || approval.rideId !== row.rec.id) throw notFound("Fare adjustment approval");
    ctx.store.approvals.delete(approval.id);
    applyAdjustment(ctx, row, approval.amountMinor, approval.reason, "ride.fare_adjustment_approved");
    return ok({ status: "APPLIED", finalFareMinor: row.rec.finalFareMinor });
  });

  r.post("/admin/rides/:id/change-status", (ctx) => {
    const row = rideOr404(ctx);
    const body = asBody(ctx.body);
    const to = reqStr(body, "to") as ApiRideStatus;
    const reason = reqStr(body, "reason");
    const from = row.rec.status;
    if (!allowedStatusTargets(from).includes(to)) throw conflict(`Changing a ride from ${from} to ${to} is not allowed`);
    const now = Date.now();
    const rec = row.rec;
    rec.status = to;
    if (to === "COMPLETED") {
      rec.completedAt = iso(now);
      releaseCaptain(ctx, rec.captainId);
    }
    if (to === "SEARCHING") rec.captainId = null;
    if (row.payment) {
      if (to === "PAYMENT_COMPLETED") {
        row.payment.status = "CAPTURED";
        row.payment.capturedMinor = row.payment.amountMinor;
        row.payment.capturedAt = iso(now);
        rec.paymentStatus = "CAPTURED";
      } else if (to === "PAYMENT_PENDING") {
        row.payment.status = "PROCESSING";
        rec.paymentStatus = "PROCESSING";
      }
    }
    appendEvent(row, to, now, { realm: "STAFF", id: ctx.store.me.id }, `Status forced from ${from} to ${to} by ${ctx.store.me.name}: ${reason}`);
    recordAudit(ctx.store, { category: "RIDE", action: "ride.status_changed_by_staff", targetType: "RIDE", targetId: rec.id, reason, before: { status: from }, after: { status: to } });
    return ok({ id: rec.id, status: rec.status });
  });

  r.post("/admin/rides/:id/reset-pin-attempts", (ctx) => {
    const row = rideOr404(ctx);
    const reason = str(asBody(ctx.body), "reason") ?? null;
    const before = row.rec.startPinAttempts;
    row.rec.startPinAttempts = 0;
    row.rec.version += 1;
    recordAudit(ctx.store, { category: "RIDE", action: "ride.start_pin_reset", targetType: "RIDE", targetId: row.rec.id, reason, before: { startPinAttempts: before }, after: { startPinAttempts: 0 } });
    return ok({ id: row.rec.id, startPinAttempts: 0 });
  });
}

