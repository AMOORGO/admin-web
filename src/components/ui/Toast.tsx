"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { errorMessage } from "@/lib/api";

type ToastKind = "success" | "error";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  /** Accepts a message or any thrown value (ApiError messages are shown verbatim). */
  error: (messageOrError: unknown) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      counter.current += 1;
      const id = counter.current;
      setItems((prev) => [...prev.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 8000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (e) => push("error", typeof e === "string" ? e : errorMessage(e)),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-full max-w-sm flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl ${
              t.kind === "success"
                ? "border-[#B4F2E1] dark:border-[#14755F] bg-[#EFFCF9] dark:bg-[#0D2620] text-[#14755F] dark:text-[#82E5CB]"
                : "border-[#FFC4BC] dark:border-[#61130A] bg-[#FFF3F1] dark:bg-[#38110D] text-[#B02414] dark:text-[#FFA093]"
            }`}
          >
            {t.kind === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <p className="flex-1 break-words font-medium">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
