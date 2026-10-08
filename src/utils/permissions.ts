import { StaffRole, PermissionKey } from "@/types";

export const ROLE_PERMISSIONS: Record<StaffRole, PermissionKey[]> = {
  SUPER_ADMIN: [
    "dashboard.view",
    "rides.view",
    "rides.reassign",
    "rides.cancel",
    "rides.adjust_fare",
    "users.view",
    "users.suspend",
    "captains.view",
    "captains.approve",
    "captains.review_docs",
    "captains.suspend",
    "second_chance.manage",
    "finance.view",
    "finance.refund",
    "finance.payouts",
    "safety.manage",
    "support.manage",
    "config.view",
    "config.edit",
    "staff.create",
    "staff.manage",
    "roles.manage",
    "audit.view",
    "reports.export",
  ],
  OPERATIONS_ADMIN: [
    "dashboard.view",
    "rides.view",
    "rides.reassign",
    "rides.cancel",
    "rides.adjust_fare",
    "users.view",
    "users.suspend",
    "captains.view",
    "captains.approve",
    "captains.review_docs",
    "captains.suspend",
    "second_chance.manage",
    "safety.manage",
    "support.manage",
    "config.view",
    "audit.view",
    "reports.export",
  ],
  CAPTAIN_OPS: [
    "dashboard.view",
    "captains.view",
    "captains.approve",
    "captains.review_docs",
    "captains.suspend",
    "second_chance.manage",
    "rides.view",
    "rides.reassign",
    "safety.manage",
    "support.manage",
    "audit.view",
  ],
  FINANCE_ADMIN: [
    "dashboard.view",
    "finance.view",
    "finance.refund",
    "finance.payouts",
    "rides.view",
    "rides.adjust_fare",
    "users.view",
    "captains.view",
    "config.view",
    "audit.view",
    "reports.export",
  ],
  SUPPORT_AGENT: [
    "dashboard.view",
    "users.view",
    "captains.view",
    "rides.view",
    "support.manage",
    "finance.refund",
    "safety.manage",
  ],
  READ_ONLY: [
    "dashboard.view",
    "rides.view",
    "users.view",
    "captains.view",
    "finance.view",
    "audit.view",
  ],
};

export function hasPermission(
  role: StaffRole,
  permission: PermissionKey,
  overrides?: Record<PermissionKey, "ALLOW" | "DENY">
): boolean {
  if (overrides && overrides[permission] === "DENY") {
    return false;
  }
  if (overrides && overrides[permission] === "ALLOW") {
    return true;
  }
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes(permission);
}
