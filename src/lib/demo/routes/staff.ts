/** Staff, roles, the permission catalogue and the audit trail (list + CSV export). */
import type { ApiAuditEntry } from "../../adapters/audit";
import type { ApiRole, ApiStaff } from "../../adapters/iam";
import { type Ctx, type Router, listResult, ok } from "../router";
import { recordAudit } from "../store";
import { DAY, DemoError, asBody, conflict, inRange, iso, matchesQuery, notFound, reqStr, str, strList, uuid } from "../util";

function staffOr404(ctx: Ctx): ApiStaff {
  const s = ctx.store.staff.find((x) => x.id === ctx.params.id);
  if (!s) throw notFound("Staff member");
  return s;
}

function roleOr404(ctx: Ctx): ApiRole {
  const role = ctx.store.roles.find((x) => x.id === ctx.params.id);
  if (!role) throw notFound("Role");
  return role;
}

function recount(ctx: Ctx): void {
  for (const role of ctx.store.roles) role.userCount = ctx.store.staff.filter((s) => s.roles.some((x) => x.id === role.id)).length;
}

function assignRoles(ctx: Ctx, member: ApiStaff, keys: string[]): void {
  const roles = keys.map((k) => ctx.store.roles.find((role) => role.key === k));
  if (roles.some((x) => !x)) throw new DemoError(400, "VALIDATION_FAILED", "Unknown role key");
  member.roles = roles.filter((x): x is ApiRole => !!x).map((x) => ({ id: x.id, key: x.key, name: x.name, isSystem: x.isSystem }));
  recount(ctx);
}

const csvCell = (v: string | null): string => `"${(v ?? "").replace(/"/g, '""')}"`;

function filterAudit(ctx: Ctx): ApiAuditEntry[] {
  const { query } = ctx;
  return ctx.store.audit.filter((e) => {
    if (query.category && e.category !== query.category) return false;
    if (query.targetType && (e.targetType ?? "").toLowerCase() !== query.targetType.toLowerCase()) return false;
    if (query.targetId && e.targetId !== query.targetId) return false;
    if (!inRange(new Date(e.timestamp).getTime(), query.from, query.to)) return false;
    return matchesQuery(query.q, e.action, e.actor.name, e.actor.email, e.targetId, e.targetType, e.reasonNotes, e.category);
  });
}

export function registerStaff(r: Router): void {
  r.get("/admin/staff", (ctx) => {
    const { query } = ctx;
    const rows = ctx.store.staff.filter((s) => (!query.status || s.status === query.status) && matchesQuery(query.q, s.name, s.email));
    return listResult(rows, query);
  });

  r.post("/admin/staff", (ctx) => {
    const body = asBody(ctx.body);
    const name = reqStr(body, "name");
    const email = reqStr(body, "email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DemoError(400, "VALIDATION_FAILED", "Enter a valid e-mail address", ["email must be an email"]);
    if (ctx.store.staff.some((s) => s.email.toLowerCase() === email)) throw new DemoError(409, "EMAIL_TAKEN", "A staff account with this e-mail already exists");
    const member: ApiStaff = {
      id: uuid(),
      name,
      email,
      status: "INVITED",
      avatarUrl: null,
      cityScope: strList(body, "cityScope"),
      expiresAt: iso(Date.now() + 7 * DAY),
      totpEnabled: false,
      lastLoginAt: null,
      createdAt: iso(Date.now()),
      roles: [],
      overrides: [],
      inviteEmailSent: false,
    };
    assignRoles(ctx, member, strList(body, "roleKeys"));
    ctx.store.staff.unshift(member);
    recount(ctx);
    recordAudit(ctx.store, { category: "STAFF", action: "staff.invited", targetType: "STAFF", targetId: member.id, reason: str(body, "reason") ?? null, after: { email, roles: member.roles.map((x) => x.key) } });
    return ok(member);
  });

  const setStatus = (ctx: Ctx, to: ApiStaff["status"], action: string) => {
    const member = staffOr404(ctx);
    const reason = reqStr(asBody(ctx.body), "reason");
    if (member.id === ctx.store.me.id) throw conflict("You cannot change the status of your own account");
    const before = { status: member.status };
    member.status = to;
    recordAudit(ctx.store, { category: "STAFF", action, targetType: "STAFF", targetId: member.id, reason, before, after: { status: to } });
    return ok(member);
  };
  r.post("/admin/staff/:id/suspend", (ctx) => setStatus(ctx, "SUSPENDED", "staff.suspended"));
  r.post("/admin/staff/:id/reactivate", (ctx) => setStatus(ctx, "ACTIVE", "staff.reactivated"));

  r.post("/admin/staff/:id/reset-2fa", (ctx) => {
    const member = staffOr404(ctx);
    const reason = reqStr(asBody(ctx.body), "reason");
    member.totpEnabled = false;
    recordAudit(ctx.store, { category: "STAFF", action: "staff.2fa_reset", targetType: "STAFF", targetId: member.id, reason, before: { totpEnabled: true }, after: { totpEnabled: false } });
    return ok(member);
  });

  r.post("/admin/staff/:id/revoke-sessions", (ctx) => {
    const member = staffOr404(ctx);
    recordAudit(ctx.store, { category: "STAFF", action: "staff.sessions_revoked", targetType: "STAFF", targetId: member.id });
    return ok({ revoked: 1 });
  });

  r.post("/admin/staff/:id/resend-invite", (ctx) => {
    const member = staffOr404(ctx);
    if (member.status !== "INVITED") throw conflict("Only pending invitations can be resent");
    member.expiresAt = iso(Date.now() + 7 * DAY);
    member.inviteEmailSent = true;
    recordAudit(ctx.store, { category: "STAFF", action: "staff.invite_resent", targetType: "STAFF", targetId: member.id });
    return ok(member);
  });

  r.put("/admin/staff/:id/roles", (ctx) => {
    const member = staffOr404(ctx);
    const body = asBody(ctx.body);
    const reason = reqStr(body, "reason");
    const keys = strList(body, "roleKeys");
    if (keys.length === 0) throw new DemoError(400, "VALIDATION_FAILED", "Choose at least one role");
    if (member.id === ctx.store.me.id && !keys.includes("SUPER_ADMIN")) throw conflict("You cannot remove Super Admin from your own account");
    const before = { roles: member.roles.map((x) => x.key) };
    assignRoles(ctx, member, keys);
    recordAudit(ctx.store, { category: "STAFF", action: "staff.roles_changed", targetType: "STAFF", targetId: member.id, reason, before, after: { roles: keys } });
    return ok(member);
  });

  // ── Roles & permission catalogue ──
  r.get("/admin/roles", (ctx) => {
    recount(ctx);
    return ok(ctx.store.roles);
  });
  r.get("/admin/permissions", (ctx) => ok(ctx.store.permissionCatalogue));

  const knownPermission = (ctx: Ctx, key: string) => ctx.store.permissionCatalogue.some((g) => g.permissions.some((p) => p.key === key));

  r.post("/admin/roles", (ctx) => {
    const body = asBody(ctx.body);
    const name = reqStr(body, "name");
    const permissions = strList(body, "permissions");
    const unknown = permissions.filter((p) => !knownPermission(ctx, p));
    if (unknown.length > 0) throw new DemoError(400, "VALIDATION_FAILED", "Unknown permission keys", unknown);
    const key = name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (ctx.store.roles.some((x) => x.key === key)) throw new DemoError(409, "ROLE_EXISTS", "A role with this name already exists");
    const now = iso(Date.now());
    const role: ApiRole = { id: uuid(), key, name, description: str(body, "description") ?? null, isSystem: false, permissions, userCount: 0, createdAt: now, updatedAt: now };
    ctx.store.roles.push(role);
    recordAudit(ctx.store, { category: "STAFF", action: "role.created", targetType: "ROLE", targetId: role.id, reason: str(body, "reason") ?? null, after: { name, permissions: permissions.length } });
    return ok(role);
  });

  r.patch("/admin/roles/:id", (ctx) => {
    const role = roleOr404(ctx);
    if (role.isSystem) throw new DemoError(403, "FORBIDDEN", "System roles cannot be edited");
    const body = asBody(ctx.body);
    const before = { name: role.name, permissions: role.permissions.length };
    const name = str(body, "name");
    if (name) role.name = name;
    if (typeof body.description === "string") role.description = body.description || null;
    if (Array.isArray(body.permissions)) {
      const permissions = strList(body, "permissions");
      const unknown = permissions.filter((p) => !knownPermission(ctx, p));
      if (unknown.length > 0) throw new DemoError(400, "VALIDATION_FAILED", "Unknown permission keys", unknown);
      role.permissions = permissions;
    }
    role.updatedAt = iso(Date.now());
    recordAudit(ctx.store, { category: "STAFF", action: "role.updated", targetType: "ROLE", targetId: role.id, reason: str(body, "reason") ?? null, before, after: { name: role.name, permissions: role.permissions.length } });
    return ok(role);
  });

  r.delete("/admin/roles/:id", (ctx) => {
    const role = roleOr404(ctx);
    if (role.isSystem) throw new DemoError(403, "FORBIDDEN", "System roles cannot be deleted");
    recount(ctx);
    if (role.userCount > 0) throw conflict(`${role.userCount} staff member(s) still hold this role`, "ROLE_IN_USE");
    ctx.store.roles.splice(ctx.store.roles.indexOf(role), 1);
    recordAudit(ctx.store, { category: "STAFF", action: "role.deleted", targetType: "ROLE", targetId: role.id, reason: ctx.query.reason ?? null, before: { name: role.name } });
    return ok({ ok: true });
  });

  // ── Audit trail ──
  r.get("/admin/audit-logs", (ctx) => listResult(filterAudit(ctx), ctx.query, 50));

  r.get("/admin/audit-logs/export", (ctx) => {
    const rows = filterAudit(ctx).map((e) =>
      [e.timestamp, e.actor.name ?? "System", e.actor.email, e.actor.role, e.category, e.action, e.targetType, e.targetId, e.ipAddress, e.reasonNotes].map(csvCell).join(","),
    );
    const header = ["Timestamp", "Actor", "Email", "Role", "Category", "Action", "TargetType", "TargetId", "IP", "Reason"].map(csvCell).join(",");
    recordAudit(ctx.store, { category: "SYSTEM", action: "report.exported", targetType: "REPORT", targetId: "audit-logs", reason: null });
    return { file: { text: [header, ...rows].join("\n"), filename: "audit-logs.csv", contentType: "text/csv" } };
  });
}
