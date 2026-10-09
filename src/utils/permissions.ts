import type { PermissionKey } from "@/types";

/**
 * Permissions are computed by the backend (roles + per-user overrides) and delivered with the session
 * (POST /admin/auth/login, GET /admin/me). The API enforces them; the UI only mirrors them for convenience.
 * Use `useAuth().can(key)` / `<Can permission=...>` in components.
 */
export function hasPermission(granted: ReadonlySet<string> | readonly string[], permission: PermissionKey): boolean {
  return Array.isArray(granted) ? (granted as readonly string[]).includes(permission) : (granted as ReadonlySet<string>).has(permission);
}
