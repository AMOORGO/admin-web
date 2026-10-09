/** Switches the demo's signed-in identity between the real system roles (permissions exactly as the backend catalogue defines). */
import type { StaffMe } from "../auth/types";
import { DEMO_ROLE_OPTIONS, type DemoRoleKey } from "./flag";
import type { DemoStore } from "./store";
import { iso, uuid } from "./util";

/**
 * Re-points `store.me` at the seeded staff member who holds the role: same name / e-mail / city scope / per-user
 * overrides as in the Staff tab, with effective permissions = role permissions adjusted by the overrides.
 */
export function applyRole(store: DemoStore, key: DemoRoleKey): StaffMe {
  const role = store.roles.find((r) => r.key === key) ?? store.roles[0];
  const member = store.staff.find((s) => s.status === "ACTIVE" && s.roles.some((r) => r.key === role.key)) ?? store.staff[0];
  const perms = new Set(role.permissions);
  for (const o of member.overrides) {
    if (o.effect === "ALLOW") perms.add(o.permission);
    else perms.delete(o.permission);
  }
  store.me = {
    id: member.id,
    name: member.name,
    email: member.email,
    avatarUrl: null,
    roles: [role.key],
    permissions: [...perms],
    cityScope: [...member.cityScope],
    totpEnabled: member.totpEnabled,
    mustEnrolTotp: false,
    lastLoginAt: iso(Date.now()),
    sessionId: store.me.sessionId ?? uuid(),
  };
  return store.me;
}

export const roleLabel = (key: string): string => DEMO_ROLE_OPTIONS.find((o) => o.key === key)?.label ?? key;
