"use client";

import React from "react";
import { PermissionKey, StaffRole } from "@/types";
import { hasPermission } from "@/utils/permissions";

interface CanProps {
  role: StaffRole;
  permission: PermissionKey;
  overrides?: Record<PermissionKey, "ALLOW" | "DENY">;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({
  role,
  permission,
  overrides,
  children,
  fallback = null,
}) => {
  const allowed = hasPermission(role, permission, overrides);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
