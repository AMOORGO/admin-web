/** Safety incidents: list, detail and the SOS command actions (acknowledge, assign, note, contact, escalate, resolve). */
import type { ApiIncidentDetail, ApiIncidentEvent, ApiIncidentSummary, ApiRealm } from "../../adapters/safety";
import { inScope } from "../logic/scope";
import { type Ctx, type Router, listResult, ok } from "../router";
import { recordAudit, staffById } from "../store";
import { DemoError, asBody, conflict, iso, inRange, notFound, reqStr, str, uuid } from "../util";

export function toIncidentSummary(i: ApiIncidentDetail): ApiIncidentSummary {
  return {
    id: i.id,
    ref: i.ref,
    type: i.type,
    severity: i.severity,
    status: i.status,
    rideId: i.rideId,
    cityId: i.cityId,
    triggeredBy: i.triggeredBy,
    lat: i.lat,
    lng: i.lng,
    assignedStaffId: i.assignedStaffId,
    acknowledgedAt: i.acknowledgedAt,
    firstContactAt: i.firstContactAt,
    ackDueAt: i.ackDueAt,
    contactDueAt: i.contactDueAt,
    slaBreached: i.slaBreached,
    resolvedAt: i.resolvedAt,
    outcomeCode: i.outcomeCode,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

function incidentOr404(ctx: Ctx): ApiIncidentDetail {
  const i = ctx.store.incidents.find((x) => x.id === ctx.params.id);
  if (!i || !inScope(ctx.store, i.cityId)) throw notFound("Incident");
  return i;
}

function addEvent(ctx: Ctx, i: ApiIncidentDetail, kind: string, body: string | null, meta: Record<string, unknown> | null = null, realm: ApiRealm = "STAFF"): ApiIncidentEvent {
  const e: ApiIncidentEvent = { id: uuid(), kind, actorRealm: realm, actorId: ctx.store.me.id, body, meta, createdAt: iso(Date.now()) };
  i.events.push(e);
  i.updatedAt = e.createdAt;
  return e;
}

const isOpen = (i: ApiIncidentDetail): boolean => i.status === "ACTIVE" || i.status === "ACKNOWLEDGED";

function requireOpen(i: ApiIncidentDetail): void {
  if (!isOpen(i)) throw conflict(`This incident is already ${i.status.toLowerCase().replace(/_/g, " ")}`);
}

export function registerSafety(r: Router): void {
  r.get("/admin/incidents", (ctx) => {
    const { query } = ctx;
    const rows = ctx.store.incidents
      .filter((i) => {
        if (!inScope(ctx.store, i.cityId)) return false;
        if (query.status && i.status !== query.status) return false;
        if (query.type && i.type !== query.type) return false;
        if (query.cityId && i.cityId !== query.cityId) return false;
        return inRange(new Date(i.createdAt).getTime(), query.from, query.to);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return listResult(rows.map(toIncidentSummary), query, 50);
  });

  r.get("/admin/incidents/:id", (ctx) => {
    const i = incidentOr404(ctx);
    // Open incidents show a live position that keeps moving with the captain.
    if (i.liveLocation && isOpen(i)) i.liveLocation = { ...i.liveLocation, ts: iso(Date.now()) };
    return ok(i);
  });

  r.post("/admin/incidents/:id/acknowledge", (ctx) => {
    const i = incidentOr404(ctx);
    if (i.status !== "ACTIVE") throw conflict("Only an active incident can be acknowledged");
    const before = { status: i.status };
    i.status = "ACKNOWLEDGED";
    i.acknowledgedAt = iso(Date.now());
    if (!i.assignedStaffId) i.assignedStaffId = ctx.store.me.id;
    addEvent(ctx, i, "ACKNOWLEDGED", null);
    recordAudit(ctx.store, { category: "SAFETY", action: "incident.acknowledged", targetType: "INCIDENT", targetId: i.id, before, after: { status: "ACKNOWLEDGED", ref: i.ref } });
    return ok(toIncidentSummary(i));
  });

  r.post("/admin/incidents/:id/assign", (ctx) => {
    const i = incidentOr404(ctx);
    requireOpen(i);
    const staffId = reqStr(asBody(ctx.body), "staffId");
    const member = staffById(ctx.store, staffId);
    if (!member) throw notFound("Staff member");
    const before = { assignedStaffId: i.assignedStaffId };
    i.assignedStaffId = staffId;
    addEvent(ctx, i, "ASSIGNED", `Assigned to ${member.name}`, { staffId });
    recordAudit(ctx.store, { category: "SAFETY", action: "incident.assigned", targetType: "INCIDENT", targetId: i.id, before, after: { assignedStaffId: staffId, ref: i.ref } });
    return ok(toIncidentSummary(i));
  });

  r.post("/admin/incidents/:id/note", (ctx) => {
    const i = incidentOr404(ctx);
    const text = reqStr(asBody(ctx.body), "note");
    addEvent(ctx, i, "NOTE", text);
    recordAudit(ctx.store, { category: "SAFETY", action: "incident.note_added", targetType: "INCIDENT", targetId: i.id, reason: text });
    return ok(toIncidentSummary(i));
  });

  r.post("/admin/incidents/:id/contact", (ctx) => {
    const i = incidentOr404(ctx);
    requireOpen(i);
    const body = asBody(ctx.body);
    const party = reqStr(body, "party");
    const outcome = reqStr(body, "outcome");
    const method = reqStr(body, "method");
    const note = str(body, "note") ?? null;
    if (!i.firstContactAt) i.firstContactAt = iso(Date.now());
    addEvent(ctx, i, "CONTACTED", note, { party, outcome, method });
    recordAudit(ctx.store, { category: "SAFETY", action: "incident.contact_logged", targetType: "INCIDENT", targetId: i.id, reason: note, after: { party, outcome, method } });
    return ok(toIncidentSummary(i));
  });

  r.post("/admin/incidents/:id/escalate", (ctx) => {
    const i = incidentOr404(ctx);
    requireOpen(i);
    const reason = reqStr(asBody(ctx.body), "reason");
    const before = { severity: i.severity };
    i.severity = "CRITICAL";
    addEvent(ctx, i, "ESCALATED", reason);
    recordAudit(ctx.store, { category: "SAFETY", action: "incident.escalated", targetType: "INCIDENT", targetId: i.id, reason, before, after: { severity: "CRITICAL", ref: i.ref } });
    return ok(toIncidentSummary(i));
  });

  r.post("/admin/incidents/:id/resolve", (ctx) => {
    const i = incidentOr404(ctx);
    requireOpen(i);
    const body = asBody(ctx.body);
    const outcomeCode = reqStr(body, "outcomeCode");
    const note = str(body, "note") ?? null;
    if (note === null && outcomeCode === "OTHER") throw new DemoError(400, "VALIDATION_FAILED", "A note is required when the outcome is OTHER");
    const before = { status: i.status };
    i.status = outcomeCode === "FALSE_ALARM" ? "FALSE_ALARM" : "RESOLVED";
    i.resolvedAt = iso(Date.now());
    i.outcomeCode = outcomeCode;
    if (!i.acknowledgedAt) i.acknowledgedAt = i.resolvedAt;
    i.liveLocation = null;
    addEvent(ctx, i, "RESOLVED", note, { outcomeCode });
    recordAudit(ctx.store, { category: "SAFETY", action: "incident.resolved", targetType: "INCIDENT", targetId: i.id, reason: note, before, after: { status: i.status, outcomeCode, ref: i.ref } });
    return ok(toIncidentSummary(i));
  });
}
