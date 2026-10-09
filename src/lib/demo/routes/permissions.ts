/**
 * Endpoint -> required permissions, taken from the backend controllers' @StaffAuth(...) decorators. A request whose
 * caller lacks any of them is answered with the backend's 403 PERMISSION_DENIED envelope. Routes not listed need a
 * signed-in staff member only.
 */
import type { PermissionKey } from "@/types";

type Entry = [route: string, ...permissions: PermissionKey[]];

const TABLE: Entry[] = [
  // dashboard / live ops
  ["GET /admin/dashboard/kpis", "dashboard.view"],
  ["GET /admin/dashboard/alerts", "dashboard.view"],
  ["GET /admin/ops/snapshot", "dashboard.view"],
  ["GET /admin/live/map", "rides.view"],
  // rides
  ["GET /admin/rides", "rides.view"],
  ["GET /admin/rides/:id", "rides.view"],
  ["GET /admin/rides/:id/timeline", "rides.view"],
  ["POST /admin/rides/:id/cancel", "rides.cancel"],
  ["POST /admin/rides/:id/reassign", "rides.reassign"],
  ["POST /admin/rides/:id/assign", "rides.reassign"],
  ["POST /admin/rides/:id/adjust-fare", "rides.adjust_fare"],
  ["POST /admin/rides/:id/adjust-fare/:approvalId/approve", "rides.adjust_fare", "finance.refund_approve"],
  ["POST /admin/rides/:id/change-status", "rides.change_status"],
  ["POST /admin/rides/:id/reset-pin-attempts", "rides.change_status"],
  // captains & KYC
  ["GET /admin/captains", "captains.view"],
  ["GET /admin/captains/:id", "captains.view"],
  ["GET /admin/captains/:id/earnings/overview", "finance.view"],
  ["POST /admin/captains/:id/approve", "captains.approve"],
  ["POST /admin/captains/:id/reject", "captains.approve"],
  ["POST /admin/captains/:id/request-resubmission", "captains.approve"],
  ["POST /admin/captains/:id/suspend", "captains.suspend"],
  ["POST /admin/captains/:id/reactivate", "captains.suspend"],
  ["PATCH /admin/captains/:id/documents/:docId", "captains.review_docs"],
  ["GET /admin/captains/:id/documents/:docId/url", "captains.review_docs"],
  ["PATCH /admin/captains/:id/vehicles/:vehicleId", "captains.edit"],
  ["GET /admin/documents", "captains.review_docs"],
  // second chance
  ["GET /admin/second-chance", "second_chance.manage"],
  ["GET /admin/second-chance/stats", "second_chance.manage"],
  ["GET /admin/second-chance/:captainId", "second_chance.manage"],
  ["POST /admin/second-chance/:captainId/start-review", "second_chance.manage"],
  ["POST /admin/second-chance/:captainId/approve", "second_chance.manage"],
  ["POST /admin/second-chance/:captainId/reject", "second_chance.manage"],
  ["POST /admin/second-chance/:captainId/request-resubmission", "second_chance.manage"],
  ["POST /admin/second-chance/:captainId/suspend", "second_chance.manage"],
  ["POST /admin/second-chance/:captainId/revoke", "second_chance.manage"],
  ["POST /admin/second-chance/:captainId/review", "second_chance.manage"],
  ["PUT /admin/second-chance/:captainId/restrictions", "second_chance.manage"],
  ["PATCH /admin/second-chance/:captainId/tier", "second_chance.manage"],
  ["POST /admin/second-chance/:captainId/notes", "second_chance.manage"],
  // riders
  ["GET /admin/users", "users.view"],
  ["GET /admin/users/:id", "users.view"],
  ["PATCH /admin/users/:id", "users.edit"],
  ["POST /admin/users/:id/suspend", "users.suspend"],
  ["POST /admin/users/:id/reactivate", "users.suspend"],
  ["POST /admin/wallets/:userId/adjust", "finance.refund_approve"],
  // safety
  ["GET /admin/incidents", "safety.manage"],
  ["GET /admin/incidents/:id", "safety.manage"],
  ["POST /admin/incidents/:id/acknowledge", "safety.manage"],
  ["POST /admin/incidents/:id/assign", "safety.manage"],
  ["POST /admin/incidents/:id/note", "safety.manage"],
  ["POST /admin/incidents/:id/contact", "safety.manage"],
  ["POST /admin/incidents/:id/escalate", "safety.manage"],
  ["POST /admin/incidents/:id/resolve", "safety.manage"],
  // finance
  ["GET /admin/transactions", "finance.view"],
  ["GET /admin/payments", "finance.view"],
  ["GET /admin/refunds", "finance.view"],
  ["POST /admin/refunds/:id/approve", "finance.refund_approve"],
  ["POST /admin/refunds/:id/reject", "finance.refund_approve"],
  ["GET /admin/payouts", "finance.view"],
  ["GET /admin/payout-batches", "finance.view"],
  ["POST /admin/payouts/batch", "finance.payouts"],
  ["POST /admin/payouts/:id/retry", "finance.payouts"],
  ["GET /admin/finance/summary", "finance.view"],
  ["GET /admin/finance/discrepancies", "finance.view"],
  ["GET /admin/ledger/accounts", "finance.view"],
  ["GET /admin/ledger/entries", "finance.view"],
  ["GET /admin/reports/payments", "reports.export"],
  ["GET /admin/reports/revenue", "reports.export"],
  // pricing / geo / config
  ["GET /admin/cities", "config.view"],
  ["PATCH /admin/cities/:id", "config.edit"],
  ["POST /admin/cities/:id/rides-enabled", "config.edit"],
  ["GET /admin/service-types", "config.view"],
  ["GET /admin/pricing/rules", "config.view"],
  ["POST /admin/pricing/rules", "config.edit"],
  ["PATCH /admin/pricing/rules/:id", "config.edit"],
  ["POST /admin/pricing/preview", "config.view"],
  ["GET /admin/pricing/cancellation-policies", "config.view"],
  ["PUT /admin/pricing/cancellation-policies", "config.edit"],
  ["GET /admin/pricing/surge-rules", "config.view"],
  ["POST /admin/pricing/surge-rules", "config.edit"],
  ["DELETE /admin/pricing/surge-rules/:id", "config.edit"],
  ["GET /admin/zones", "config.view"],
  ["POST /admin/zones", "config.edit"],
  ["PATCH /admin/zones/:id", "config.edit"],
  ["DELETE /admin/zones/:id", "config.edit"],
  ["POST /admin/zones/:id/rides-enabled", "config.edit"],
  ["GET /admin/feature-flags", "config.view"],
  ["PUT /admin/feature-flags/:key", "config.edit"],
  ["GET /admin/config", "config.view"],
  ["PUT /admin/config/:key", "config.edit"],
  ["DELETE /admin/config/:key", "config.edit"],
  ["GET /admin/integrations", "system.view"],
  // staff & roles
  ["GET /admin/staff", "staff.view"],
  ["POST /admin/staff", "staff.create"],
  ["POST /admin/staff/:id/suspend", "staff.manage"],
  ["POST /admin/staff/:id/reactivate", "staff.manage"],
  ["POST /admin/staff/:id/reset-2fa", "staff.manage"],
  ["POST /admin/staff/:id/revoke-sessions", "staff.manage"],
  ["POST /admin/staff/:id/resend-invite", "staff.manage"],
  ["PUT /admin/staff/:id/roles", "staff.manage"],
  ["POST /admin/roles", "roles.manage"],
  ["PATCH /admin/roles/:id", "roles.manage"],
  ["DELETE /admin/roles/:id", "roles.manage"],
  // audit
  ["GET /admin/audit-logs", "audit.view"],
  ["GET /admin/audit-logs/export", "audit.view", "reports.export"],
];

const REQUIRED = new Map<string, PermissionKey[]>(TABLE.map(([route, ...perms]) => [route, perms]));

/** Permissions the (method, route pattern) needs; empty when only a session is required. */
export function requiredPermissions(method: string, pattern: string): PermissionKey[] {
  return REQUIRED.get(`${method} ${pattern}`) ?? [];
}
