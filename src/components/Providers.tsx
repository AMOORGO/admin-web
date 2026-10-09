"use client";

import React from "react";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ToastProvider } from "@/components/ui/Toast";

/** Client-side providers that wrap every route (auth + toasts). City / realtime providers live below the auth gate. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  );
}
