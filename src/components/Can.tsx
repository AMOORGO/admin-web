"use client";

import React from "react";
import type { PermissionKey } from "@/types";
import { useAuth } from "@/lib/auth/AuthProvider";

interface CanProps {
  permission: PermissionKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/** Renders children only when the signed-in staff member holds the permission (backend-computed). */
export const Can: React.FC<CanProps> = ({ permission, children, fallback = null }) => {
  const { can } = useAuth();
  return <>{can(permission) ? children : fallback}</>;
};
