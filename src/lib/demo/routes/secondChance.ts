/** Second Chance Driver programme: applications, tier / conditions management and periodic reviews. */
import { scActionsFor, type ApiScDetail, type ApiScNote, type ApiScStats, type ApiScStatus, type ApiScTier, type ScRestrictions } from "../../adapters/secondChance";
import { type Ctx, type Router, listResult, ok } from "../router";
import { type CaptainRow, recordAudit } from "../store";
import { DAY, DemoError, asBody, bool, conflict, flagParam, iso, matchesQuery, notFound, num, reqStr, str, uuid } from "../util";

function scOr404(ctx: Ctx): { row: CaptainRow; sc: ApiScDetail } {
  const row = ctx.store.captains.find((c) => c.d.id === ctx.params.captainId);
  if (!row || !row.sc) throw notFound("Second Chance record");
  return { row, sc: row.sc };
}

function sync(row: CaptainRow): void {
  const sc = row.sc;
  if (!sc) return;
  sc.isEnrolled = sc.status === "APPROVED";
  sc.captain.status = row.d.status;
  sc.captain.availability = row.d.availability;
  sc.reviewDue = sc.status === "APPROVED" && sc.nextReviewAt !== null && new Date(sc.nextReviewAt).getTime() < Date.now();
  row.d.secondChance = { status: sc.status, tier: sc.tier, expiresAt: sc.expiresAt, nextReviewAt: sc.nextReviewAt };
}

function transition(ctx: Ctx, to: ApiScStatus, allowed: (a: ReturnType<typeof scActionsFor>) => boolean, action: string, extra?: (sc: ApiScDetail) => void) {
  const { row, sc } = scOr404(ctx);
  const reason = reqStr(asBody(ctx.body), "reason");
  if (!allowed(scActionsFor(sc.status))) throw conflict(`This action is not allowed while the application is ${sc.status}`);
  const before = { status: sc.status };
  sc.status = to;
  sc.decisionReason = reason;
  sc.reviewedAt = iso(Date.now());
  sc.reviewedBy = ctx.store.me.name;
  if (to === "REVOKED") sc.revokedAt = iso(Date.now());
  extra?.(sc);
  sync(row);
  recordAudit(ctx.store, { category: "CAPTAIN", action, targetType: "SECOND_CHANCE", targetId: row.d.id, reason, before, after: { status: to, captain: row.d.name } });
  return ok(sc);
}

export function registerSecondChance(r: Router): void {
  r.get("/admin/second-chance", (ctx) => {
    const { query } = ctx;
    const rows = ctx.store.captains
      .filter((c): c is CaptainRow & { sc: ApiScDetail } => c.sc !== null)
      .filter((c) => {
        const sc = c.sc;
        if (query.status && sc.status !== query.status) return false;
        if (query.tier && sc.tier !== query.tier) return false;
        if (query.cityId && c.d.cityId !== query.cityId) return false;
        if (flagParam(query.dueReview) && !sc.reviewDue) return false;
        return matchesQuery(query.q, c.d.name, c.d.phone, c.d.email);
      })
      .map((c) => c.sc)
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
    return listResult(rows, query, 20);
  });

  r.get("/admin/second-chance/stats", (ctx) => {
    const all = ctx.store.captains.map((c) => c.sc).filter((x): x is ApiScDetail => x !== null);
    const byStatus: ApiScStats["byStatus"] = {};
    const byTier: ApiScStats["byTier"] = {};
    for (const sc of all) {
      byStatus[sc.status] = (byStatus[sc.status] ?? 0) + 1;
      if (sc.status === "APPROVED") byTier[sc.tier] = (byTier[sc.tier] ?? 0) + 1;
    }
    const enrolled = all.filter((s) => s.status === "APPROVED");
    const now = Date.now();
    const stats: ApiScStats = {
      byStatus,
      byTier,
      pendingApplications: all.filter((s) => s.status === "APPLIED" || s.status === "UNDER_REVIEW").length,
      dueReviews: enrolled.filter((s) => s.reviewDue).length,
      expiringWithin30Days: enrolled.filter((s) => s.expiresAt !== null && new Date(s.expiresAt).getTime() - now < 30 * DAY).length,
      averageComplianceScore: enrolled.length ? Math.round(enrolled.reduce((a, s) => a + s.complianceScore, 0) / enrolled.length) : null,
      totalIncidents: all.reduce((a, s) => a + s.incidentCount, 0),
    };
    return ok(stats);
  });

  r.get("/admin/second-chance/:captainId", (ctx) => ok(scOr404(ctx).sc));

  r.post("/admin/second-chance/:captainId/start-review", (ctx) => transition(ctx, "UNDER_REVIEW", (a) => a.startReview, "second_chance.review_started"));
  r.post("/admin/second-chance/:captainId/reject", (ctx) => transition(ctx, "REJECTED", (a) => a.reject, "second_chance.rejected"));
  r.post("/admin/second-chance/:captainId/request-resubmission", (ctx) => transition(ctx, "RESUBMISSION_REQUESTED", (a) => a.requestResubmission, "second_chance.resubmission_requested"));
  r.post("/admin/second-chance/:captainId/suspend", (ctx) => transition(ctx, "SUSPENDED", (a) => a.suspend, "second_chance.suspended"));
  r.post("/admin/second-chance/:captainId/revoke", (ctx) => transition(ctx, "REVOKED", (a) => a.revoke, "second_chance.revoked"));

  r.post("/admin/second-chance/:captainId/approve", (ctx) => {
    const body = asBody(ctx.body);
    const tier = (str(body, "tier") ?? "TIER_1_PROBATION") as ApiScTier;
    const validity = num(body, "validityDays") ?? 365;
    const review = num(body, "reviewIntervalDays") ?? 90;
    const target = num(body, "probationRidesTarget");
    const mentor = str(body, "sponsorMentor");
    const notes = str(body, "eligibilityNotes");
    const { row, sc } = scOr404(ctx);
    if (!bool(body, "overrideDocuments") && sc.requiredDocuments.some((d) => !d.ok)) {
      throw new DemoError(422, "DOCUMENTS_INCOMPLETE", "Required Second Chance documents are not all verified", sc.requiredDocuments.filter((d) => !d.ok).map((d) => `${d.label}: ${d.state.toLowerCase()}`));
    }
    return transition(ctx, "APPROVED", (a) => a.approve, "second_chance.approved", (s) => {
      s.tier = tier;
      s.enrolledDate = iso(Date.now());
      s.expiresAt = iso(Date.now() + validity * DAY);
      s.nextReviewAt = iso(Date.now() + review * DAY);
      if (target !== undefined) s.probationRidesTarget = target;
      else s.probationRidesTarget = tier === "TIER_1_PROBATION" ? 50 : tier === "TIER_2_RESTRICTED" ? 60 : 100;
      if (mentor) s.sponsorMentor = mentor;
      if (notes) s.eligibilityNotes = notes;
      s.speedGovernorEnabled = tier === "TIER_1_PROBATION";
      row.d.isSecondChance = true;
    });
  });

  r.post("/admin/second-chance/:captainId/review", (ctx) => {
    const { row, sc } = scOr404(ctx);
    const body = asBody(ctx.body);
    if (!scActionsFor(sc.status).review) throw conflict("Only enrolled captains can be reviewed");
    const before = { tier: sc.tier, complianceScore: sc.complianceScore };
    const tier = str(body, "tier") as ApiScTier | undefined;
    if (tier) sc.tier = tier;
    const score = num(body, "complianceScore");
    if (score !== undefined) sc.complianceScore = score;
    const next = num(body, "nextReviewInDays");
    sc.nextReviewAt = iso(Date.now() + (next ?? 90) * DAY);
    const extend = num(body, "extendValidityDays");
    if (extend !== undefined && sc.expiresAt) sc.expiresAt = iso(new Date(sc.expiresAt).getTime() + extend * DAY);
    sc.lastAuditDate = iso(Date.now()).slice(0, 10);
    sc.reviewedAt = iso(Date.now());
    sc.reviewedBy = ctx.store.me.name;
    const notes = str(body, "notes");
    if (notes) sc.recentNotes.unshift({ id: uuid(), authorId: ctx.store.me.id, authorName: ctx.store.me.name, body: notes, isInternal: true, createdAt: iso(Date.now()) });
    sync(row);
    recordAudit(ctx.store, { category: "CAPTAIN", action: "second_chance.reviewed", targetType: "SECOND_CHANCE", targetId: row.d.id, reason: notes ?? null, before, after: { tier: sc.tier, complianceScore: sc.complianceScore } });
    return ok(sc);
  });

  r.patch("/admin/second-chance/:captainId/tier", (ctx) => {
    const { row, sc } = scOr404(ctx);
    const body = asBody(ctx.body);
    const reason = reqStr(body, "reason");
    const before = { tier: sc.tier, probationRidesTarget: sc.probationRidesTarget, complianceScore: sc.complianceScore };
    const tier = str(body, "tier") as ApiScTier | undefined;
    if (tier) sc.tier = tier;
    const target = num(body, "probationRidesTarget");
    if (target !== undefined) sc.probationRidesTarget = target;
    const score = num(body, "complianceScore");
    if (score !== undefined) sc.complianceScore = score;
    const inc = num(body, "incidentCount");
    if (inc !== undefined) sc.incidentCount = inc;
    const mentor = str(body, "sponsorMentor");
    if (mentor) sc.sponsorMentor = mentor;
    sync(row);
    recordAudit(ctx.store, { category: "CAPTAIN", action: "second_chance.tier_changed", targetType: "SECOND_CHANCE", targetId: row.d.id, reason, before, after: { tier: sc.tier, probationRidesTarget: sc.probationRidesTarget, complianceScore: sc.complianceScore } });
    return ok(sc);
  });

  r.put("/admin/second-chance/:captainId/restrictions", (ctx) => {
    const { row, sc } = scOr404(ctx);
    const body = asBody(ctx.body);
    const reason = reqStr(body, "reason");
    const restrictions = (body.restrictions !== null && typeof body.restrictions === "object" ? body.restrictions : {}) as ScRestrictions;
    const before = { restrictions: sc.restrictions, speedGovernorEnabled: sc.speedGovernorEnabled };
    sc.restrictions = restrictions;
    sc.maxDailyHours = restrictions.maxDailyHours ?? null;
    sc.restrictedNightDriving = restrictions.restrictedNightDriving === true;
    const governor = bool(body, "speedGovernorEnabled");
    if (governor !== undefined) sc.speedGovernorEnabled = governor;
    sync(row);
    recordAudit(ctx.store, { category: "CAPTAIN", action: "second_chance.restrictions_updated", targetType: "SECOND_CHANCE", targetId: row.d.id, reason, before, after: { restrictions: sc.restrictions, speedGovernorEnabled: sc.speedGovernorEnabled } });
    return ok(sc);
  });

  r.post("/admin/second-chance/:captainId/notes", (ctx) => {
    const { row, sc } = scOr404(ctx);
    const text = reqStr(asBody(ctx.body), "body");
    const note: ApiScNote = { id: uuid(), authorId: ctx.store.me.id, authorName: ctx.store.me.name, body: text, isInternal: true, createdAt: iso(Date.now()) };
    sc.recentNotes.unshift(note);
    recordAudit(ctx.store, { category: "CAPTAIN", action: "second_chance.note_added", targetType: "SECOND_CHANCE", targetId: row.d.id, reason: text });
    return ok(note);
  });
}
