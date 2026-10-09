"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, isApiError } from "../api";

export type MutationOutcome<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export interface MutationResult<A extends unknown[], T> {
  /** Runs the mutation. Never throws: inspect the outcome. */
  run: (...args: A) => Promise<MutationOutcome<T>>;
  pending: boolean;
  error: ApiError | null;
  reset: () => void;
}

/** Wraps an async write with pending / error state. The error carries the backend message for display. */
export function useMutation<A extends unknown[], T>(fn: (...args: A) => Promise<T>): MutationResult<A, T> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const run = useCallback(async (...args: A): Promise<MutationOutcome<T>> => {
    setPending(true);
    setError(null);
    try {
      const data = await fnRef.current(...args);
      return { ok: true, data };
    } catch (e) {
      const err = isApiError(e) ? e : new ApiError({ status: 0, code: "UNKNOWN", message: e instanceof Error ? e.message : "Unexpected error" });
      setError(err);
      return { ok: false, error: err };
    } finally {
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);
  return { run, pending, error, reset };
}
