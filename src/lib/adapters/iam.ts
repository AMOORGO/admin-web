import type { StaffUser } from "@/types";
import { avatarFor } from "@/lib/format";

/** GET /admin/staff item (also returned by invite / update / roles / overrides endpoints). */
export interface ApiStaff {
  id: string;
  name: string;
  email: string;
  status: "INVITED" | "ACTIVE" | "SUSPENDED";
  avatarUrl: string | null;
  /** City ids; empty = all cities */
  cityScope: string[];
  expiresAt: string | null;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: { id: string; key: string; name: string; isSystem: boolean }[];
  overrides: { permission: string; effect: "ALLOW" | "DENY" }[];
  inviteEmailSent?: boolean;
}

/** GET /admin/roles item */
export interface ApiRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

/** GET /admin/permissions item (grouped by module) */
export interface ApiPermissionGroup {
  module: string;
  permissions: { key: string; description: string; sensitive: boolean; superAdminOnly: boolean }[];
}

/** UI StaffUser plus the real role/scope detail the console needs for editing. */
export interface StaffMember extends StaffUser {
  roles: ApiStaff["roles"];
  /** City ids (empty = all cities). `cityScope` on the base type holds display names. */
  cityScopeIds: string[];
  overrides: ApiStaff["overrides"];
  expiresAt: string | null;
  rawLastLoginAt: string | null;
}

export function toStaffMember(dto: ApiStaff, cityName: (id: string) => string): StaffMember {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email,
    role: dto.roles[0]?.key ?? "NO_ROLE",
    avatar: avatarFor(dto.name, dto.avatarUrl),
    cityScope: dto.cityScope.length === 0 ? ["ALL"] : dto.cityScope.map(cityName),
    is2FAEnabled: dto.totpEnabled,
    lastLogin: dto.lastLoginAt ? new Date(dto.lastLoginAt).toLocaleString() : dto.status === "INVITED" ? "Invitation pending" : "Never",
    status: dto.status,
    roles: dto.roles,
    cityScopeIds: dto.cityScope,
    overrides: dto.overrides,
    expiresAt: dto.expiresAt,
    rawLastLoginAt: dto.lastLoginAt,
  };
}

/** Short display label for a permission key's module, used by the matrix. */
export const MODULE_LABELS: Record<string, string> = {
  dashboard: "Operations",
  rides: "Rides & Interventions",
  users: "Passengers",
  captains: "Fleet",
  second_chance: "Second Chance",
  finance: "Finance",
  promotions: "Growth",
  ratings: "Ratings",
  support: "Support",
  safety: "Safety",
  notifications: "Notifications",
  config: "Configuration",
  staff: "IAM",
  roles: "IAM",
  audit: "Compliance",
  reports: "Reports",
  system: "System",
};
