/** Captains: directory, detail, KYC document queue / review, application decisions, suspension, vehicles. */
import type { ApiCaptainListItem, ApiQueueDocument, ApiSignedUrl, ApiStaffDocument } from "../../adapters/captains";
import { placeholderPdf, placeholderSvg } from "../documents";
import { refreshDerived, maskNumber } from "../logic/captain";
import { inScope } from "../logic/scope";
import { type Ctx, type Router, listResult, ok } from "../router";
import { type CaptainRow, captainById, recordAudit } from "../store";
import { DAY, DemoError, asBody, bool, conflict, iso, matchesQuery, notFound, num, reqStr, str, strList, uuid } from "../util";

export function captainOr404(ctx: Ctx, id = ctx.params.id): CaptainRow {
  const row = captainById(ctx.store, id);
  if (!row || !inScope(ctx.store, row.d.cityId)) throw notFound("Captain");
  return row;
}

export function toCaptainListItem(c: CaptainRow): ApiCaptainListItem {
  const d = c.d;
  return {
    id: d.id,
    name: d.name,
    phone: d.phone,
    email: d.email,
    avatar: d.avatar,
    cityId: d.cityId,
    city: d.city,
    status: d.status,
    availability: d.availability,
    onRide: d.onRide,
    isSecondChance: d.isSecondChance,
    flagged: d.flagged,
    rating: d.metrics.rating,
    ratingCount: d.metrics.ratingCount,
    totalTrips: d.metrics.totalTrips,
    acceptanceRate: d.metrics.acceptanceRate,
    cancellationRate: d.metrics.cancellationRate,
    serviceTypes: d.serviceTypes.filter((s) => s.enabled).map((s) => s.code),
    vehicle: d.vehicle,
    submittedAt: d.submittedAt,
    joinedAt: d.joinedAt,
  };
}

function pushStatus(c: CaptainRow, to: CaptainRow["d"]["status"], reason: string | null): void {
  c.d.statusHistory.push({ id: uuid(), from: c.d.status, to, reason, at: iso(Date.now()) });
  c.d.status = to;
  c.d.statusReason = reason;
}

function syncSc(c: CaptainRow): void {
  if (c.sc) {
    c.sc.captain.status = c.d.status;
    c.sc.captain.availability = c.d.availability;
  }
}

function toQueueDoc(c: CaptainRow, d: ApiStaffDocument): ApiQueueDocument {
  return {
    ...d,
    captain: { id: c.d.id, name: c.d.name, phone: c.d.phone, cityId: c.d.cityId, city: c.d.city, status: c.d.status, isSecondChance: c.d.isSecondChance },
  };
}

export function registerCaptains(r: Router): void {
  r.get("/admin/captains", (ctx) => {
    const { query } = ctx;
    const rows = ctx.store.captains
      .filter((c) => {
        const d = c.d;
        if (!inScope(ctx.store, d.cityId)) return false;
        if (query.status && d.status !== query.status) return false;
        if (query.availability && d.availability !== query.availability) return false;
        if (query.cityId && d.cityId !== query.cityId) return false;
        return matchesQuery(query.q, d.name, d.phone, d.email, d.vehicle?.plateNumber, d.id);
      })
      .sort((a, b) => new Date(b.d.joinedAt).getTime() - new Date(a.d.joinedAt).getTime());
    return listResult(rows.map(toCaptainListItem), query, 24);
  });

  r.get("/admin/captains/:id", (ctx) => {
    const c = captainOr404(ctx);
    refreshDerived(c.d, Date.now());
    return ok(c.d);
  });

  // ── KYC document queue (any captain's documents, oldest upload first) ──
  r.get("/admin/documents", (ctx) => {
    const { query } = ctx;
    const docs: ApiQueueDocument[] = [];
    for (const c of ctx.store.captains) {
      if (!inScope(ctx.store, c.d.cityId)) continue;
      if (query.cityId && c.d.cityId !== query.cityId) continue;
      for (const d of c.d.documents) {
        if (query.status && d.status !== query.status) continue;
        if (query.type && d.type !== query.type) continue;
        docs.push(toQueueDoc(c, d));
      }
    }
    docs.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
    return listResult(docs, query, 50);
  });

  // Signed, audited view URL: in the demo a data: URI placeholder (the "file" never leaves the browser).
  r.get("/admin/captains/:id/documents/:docId/url", (ctx) => {
    const c = captainOr404(ctx);
    const doc = c.d.documents.find((d) => d.id === ctx.params.docId);
    if (!doc) throw notFound("Document");
    const full = c.docNumbers[doc.id] ?? null;
    const input = { type: doc.type, holder: c.d.name, number: full, expiry: doc.expiryDate, captainRef: c.d.id };
    const out: ApiSignedUrl = {
      url: doc.mimeType === "application/pdf" ? placeholderPdf(input) : placeholderSvg(input),
      expiresInSeconds: 300,
      mimeType: doc.mimeType,
      documentNumber: full,
    };
    recordAudit(ctx.store, { category: "CAPTAIN", action: "captain.document_viewed", targetType: "DOCUMENT", targetId: doc.id, reason: null });
    return ok(out);
  });

  r.patch("/admin/captains/:id/documents/:docId", (ctx) => {
    const c = captainOr404(ctx);
    const doc = c.d.documents.find((d) => d.id === ctx.params.docId);
    if (!doc) throw notFound("Document");
    const body = asBody(ctx.body);
    const action = reqStr(body, "action");
    const before = { status: doc.status };
    const now = iso(Date.now());
    const me = ctx.store.me.name;
    if (action === "APPROVE" && doc.status === "VERIFIED") throw conflict("This document is already verified");
    if (action === "APPROVE") {
      const expiresAt = str(body, "expiresAt");
      const number = str(body, "documentNumber");
      if (expiresAt) doc.expiryDate = expiresAt;
      if (number) {
        c.docNumbers[doc.id] = number;
        doc.documentNumber = maskNumber(number);
      }
      doc.status = "VERIFIED";
      doc.verifiedAt = now;
      doc.verifiedBy = me;
      doc.rejectionReason = null;
    } else if (action === "REJECT") {
      doc.status = "REJECTED";
      doc.rejectionReason = reqStr(body, "reason");
      doc.verifiedAt = null;
      doc.verifiedBy = null;
    } else if (action === "REQUEST_RESUBMISSION") {
      doc.status = "RESUBMISSION_REQUESTED";
      doc.rejectionReason = reqStr(body, "reason");
      doc.verifiedAt = null;
      doc.verifiedBy = null;
    } else {
      throw new DemoError(400, "VALIDATION_FAILED", "Unknown document action", ["action must be APPROVE, REJECT or REQUEST_RESUBMISSION"]);
    }
    doc.reviewedAt = now;
    doc.reviewedBy = me;
    if (c.d.status === "SUBMITTED") pushStatus(c, "UNDER_REVIEW", "Document review started");
    refreshDerived(c.d, Date.now());
    recordAudit(ctx.store, {
      category: "CAPTAIN",
      action: action === "APPROVE" ? "captain.document_approved" : action === "REJECT" ? "captain.document_rejected" : "captain.document_resubmission_requested",
      targetType: "DOCUMENT",
      targetId: doc.id,
      reason: doc.rejectionReason,
      before,
      after: { status: doc.status, captain: c.d.name, document: doc.label },
    });
    return ok(doc);
  });

  r.post("/admin/captains/:id/approve", (ctx) => {
    const c = captainOr404(ctx);
    const body = asBody(ctx.body);
    if (c.d.status !== "SUBMITTED" && c.d.status !== "UNDER_REVIEW") throw conflict(`A captain in status ${c.d.status} cannot be approved`);
    refreshDerived(c.d, Date.now());
    if (!c.d.eligibility.eligible && !bool(body, "overrideDocuments")) {
      throw new DemoError(422, "DOCUMENTS_INCOMPLETE", "The document checklist is not complete", c.d.eligibility.reasons);
    }
    const before = { status: c.d.status };
    pushStatus(c, "APPROVED", str(body, "reason") ?? "All documents verified");
    c.d.approvedAt = iso(Date.now());
    c.d.approvedBy = ctx.store.me.name;
    c.d.availability = "OFFLINE";
    c.d.payoutsEnabled = true;
    for (const v of c.d.vehicles) if (v.status === "PENDING_REVIEW") v.status = "ACTIVE";
    if (c.d.vehicle) c.d.vehicle.status = "ACTIVE";
    syncSc(c);
    recordAudit(ctx.store, { category: "CAPTAIN", action: "captain.approved", targetType: "CAPTAIN", targetId: c.d.id, reason: str(body, "reason") ?? null, before, after: { status: "APPROVED", name: c.d.name } });
    return ok(c.d);
  });

  r.post("/admin/captains/:id/reject", (ctx) => {
    const c = captainOr404(ctx);
    const body = asBody(ctx.body);
    if (c.d.status !== "SUBMITTED" && c.d.status !== "UNDER_REVIEW") throw conflict(`A captain in status ${c.d.status} cannot be rejected`);
    const reason = reqStr(body, "reason");
    const days = num(body, "reapplyAfterDays");
    const before = { status: c.d.status };
    pushStatus(c, "REJECTED", reason);
    c.d.reapplyAfter = days !== undefined ? iso(Date.now() + days * DAY) : null;
    syncSc(c);
    recordAudit(ctx.store, { category: "CAPTAIN", action: "captain.rejected", targetType: "CAPTAIN", targetId: c.d.id, reason, before, after: { status: "REJECTED", reapplyAfterDays: days ?? null } });
    return ok(c.d);
  });

  r.post("/admin/captains/:id/request-resubmission", (ctx) => {
    const c = captainOr404(ctx);
    const body = asBody(ctx.body);
    if (c.d.status !== "SUBMITTED" && c.d.status !== "UNDER_REVIEW") throw conflict(`A captain in status ${c.d.status} cannot be sent back for resubmission`);
    const reason = reqStr(body, "reason");
    const ids = strList(body, "documentIds");
    for (const d of c.d.documents) {
      if (ids.length === 0 ? d.status === "PENDING" : ids.includes(d.id)) {
        d.status = "RESUBMISSION_REQUESTED";
        d.rejectionReason = reason;
        d.reviewedAt = iso(Date.now());
        d.reviewedBy = ctx.store.me.name;
      }
    }
    const before = { status: c.d.status };
    pushStatus(c, "DRAFT", reason);
    refreshDerived(c.d, Date.now());
    syncSc(c);
    recordAudit(ctx.store, { category: "CAPTAIN", action: "captain.resubmission_requested", targetType: "CAPTAIN", targetId: c.d.id, reason, before, after: { status: "DRAFT", documentIds: ids } });
    return ok(c.d);
  });

  r.post("/admin/captains/:id/suspend", (ctx) => {
    const c = captainOr404(ctx);
    const body = asBody(ctx.body);
    if (c.d.status !== "APPROVED") throw conflict(`A captain in status ${c.d.status} cannot be suspended`);
    if (c.d.onRide) throw conflict("This captain is on an active ride. Wait for the ride to end or reassign it first.");
    const reason = reqStr(body, "reason");
    const until = str(body, "until");
    const before = { status: c.d.status };
    pushStatus(c, "SUSPENDED", reason);
    c.d.suspendedUntil = until ?? null;
    c.d.availability = "OFFLINE";
    syncSc(c);
    recordAudit(ctx.store, { category: "CAPTAIN", action: "captain.suspended", targetType: "CAPTAIN", targetId: c.d.id, reason, before, after: { status: "SUSPENDED", until: until ?? null } });
    return ok(c.d);
  });

  r.post("/admin/captains/:id/reactivate", (ctx) => {
    const c = captainOr404(ctx);
    const reason = reqStr(asBody(ctx.body), "reason");
    if (c.d.status !== "SUSPENDED") throw conflict(`A captain in status ${c.d.status} cannot be reactivated`);
    const before = { status: c.d.status };
    pushStatus(c, "APPROVED", reason);
    c.d.suspendedUntil = null;
    syncSc(c);
    recordAudit(ctx.store, { category: "CAPTAIN", action: "captain.reactivated", targetType: "CAPTAIN", targetId: c.d.id, reason, before, after: { status: "APPROVED" } });
    return ok(c.d);
  });

  r.patch("/admin/captains/:id/vehicles/:vehicleId", (ctx) => {
    const c = captainOr404(ctx);
    const v = c.d.vehicles.find((x) => x.id === ctx.params.vehicleId);
    if (!v) throw notFound("Vehicle");
    const body = asBody(ctx.body);
    const status = str(body, "status");
    const before = { status: v.status, isPrimary: v.isPrimary };
    if (status === "ACTIVE" || status === "INACTIVE" || status === "PENDING_REVIEW" || status === "REJECTED") v.status = status;
    if (bool(body, "isPrimary")) {
      for (const other of c.d.vehicles) other.isPrimary = other.id === v.id;
      c.d.vehicle = { make: v.make, model: v.model, year: v.year, color: v.color, plateNumber: v.plateNumber, plateState: v.plateState, isElectric: v.isElectric, status: v.status };
    } else if (c.d.vehicle && v.isPrimary) {
      c.d.vehicle.status = v.status;
    }
    refreshDerived(c.d, Date.now());
    recordAudit(ctx.store, { category: "CAPTAIN", action: "captain.vehicle_updated", targetType: "VEHICLE", targetId: v.id, reason: str(body, "reason") ?? null, before, after: { status: v.status, isPrimary: v.isPrimary } });
    return ok(v);
  });
}
