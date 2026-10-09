"use client";

import React from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { LoginScreen } from "./LoginScreen";

/** Renders the console only for an authenticated staff session; otherwise the login screen. */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = useAuth();
  if (status === "booting") {
    return (
      <div role="status" aria-label="Loading" className="flex min-h-dvh items-center justify-center bg-[#FDFBFC] dark:bg-[#0F0811]">
        <span className="h-3 w-3 animate-ping rounded-full bg-[#F94B35]" />
      </div>
    );
  }
  if (status === "anonymous") return <LoginScreen />;
  return <>{children}</>;
};
