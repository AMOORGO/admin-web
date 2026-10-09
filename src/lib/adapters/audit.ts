/** Audit categories the backend emits (GET /admin/audit-logs?category=). */
export const AUDIT_CATEGORIES = ["RIDE", "CAPTAIN", "USER", "FINANCE", "SAFETY", "STAFF", "CONFIG", "AUTH", "SUPPORT", "PROMOTION", "SYSTEM"] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

/** GET /admin/audit-logs item (the backend already returns the console's shape). */
export interface ApiAuditEntry {
  id: string;
  timestamp: string;
  actor: { realm: string | null; id: string | null; name: string | null; email: string | null; role: string | null };
  action: string;
  category: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  requestId: string | null;
  reasonNotes: string | null;
  diff: { before: Record<string, unknown> | null; after: Record<string, unknown> | null } | null;
}

/** Normalised row for the audit table (nulls resolved to display-safe strings). */
export interface AuditEntryView {
  id: string;
  timestamp: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  category: string;
  action: string;
  targetType: string;
  targetId: string;
  ipAddress: string;
  requestId: string | null;
  reasonNotes: string | null;
  diff: { before: Record<string, unknown> | null; after: Record<string, unknown> | null } | null;
}

export function toAuditEntry(dto: ApiAuditEntry): AuditEntryView {
  return {
    id: dto.id,
    timestamp: dto.timestamp,
    actorName: dto.actor.name ?? (dto.actor.realm === "SYSTEM" || !dto.actor.id ? "System" : "Unknown"),
    actorEmail: dto.actor.email ?? "",
    actorRole: dto.actor.role ?? dto.actor.realm ?? "—",
    category: dto.category,
    action: dto.action,
    targetType: dto.targetType ?? "—",
    targetId: dto.targetId ?? "—",
    ipAddress: dto.ipAddress ?? "—",
    requestId: dto.requestId,
    reasonNotes: dto.reasonNotes,
    diff: dto.diff,
  };
}
