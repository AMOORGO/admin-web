"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, isApiError } from "../api";
import type { Page, QueryParams } from "../api";

function toApiError(e: unknown): ApiError {
  if (isApiError(e)) return e;
  return new ApiError({ status: 0, code: "UNKNOWN", message: e instanceof Error ? e.message : "Unexpected error" });
}

export interface QueryResult<T> {
  /** Latest data for the current key. While a new key is loading this keeps the previous data (no flicker). */
  data: T | undefined;
  error: ApiError | null;
  /** True while a request for the current key / version is in flight. */
  loading: boolean;
  /** True only before any data has ever arrived (use for skeletons). */
  initialLoading: boolean;
  /** Re-run the request (keeps showing current data). */
  refetch: () => void;
  /** Optimistically replace the cached data. */
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

interface Settled<T> {
  key: string;
  version: number;
  data?: T;
  error: ApiError | null;
}

interface QueryOptions {
  /** Poll interval in ms (pauses while the tab is hidden). */
  pollMs?: number;
}

/**
 * Minimal data-fetching hook. `key` identifies the request (null disables it); the fetcher receives an AbortSignal and
 * is re-run whenever the key changes or refetch() is called. Stale data stays visible while revalidating.
 */
export function useQuery<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: QueryOptions = {},
): QueryResult<T> {
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setSettled({ key, version, data, error: null });
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        const err = toApiError(e);
        if (err.isAborted) return;
        setSettled((prev) => ({ key, version, data: prev?.key === key ? prev.data : undefined, error: err }));
      });
    return () => controller.abort();
  }, [key, version]);

  const { pollMs } = options;
  useEffect(() => {
    if (!pollMs || key === null) return;
    const id = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") setVersion((v) => v + 1);
    }, pollMs);
    return () => clearInterval(id);
  }, [pollMs, key]);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback(
    (updater: T | ((prev: T | undefined) => T)) => {
      setSettled((prev) => {
        if (key === null) return prev;
        const current = prev?.key === key ? prev.data : undefined;
        const next = typeof updater === "function" ? (updater as (p: T | undefined) => T)(current) : updater;
        return { key, version: prev?.version ?? 0, data: next, error: prev?.error ?? null };
      });
    },
    [key],
  );

  const current = key !== null && settled !== null && settled.key === key;
  const loading = key !== null && !(current && settled.version === version);
  // Keep the previous key's data visible while the new key loads (filters / pagination without flicker).
  const data = settled?.data;
  return {
    data,
    error: current ? settled.error : null,
    loading,
    initialLoading: loading && data === undefined,
    refetch,
    setData,
  };
}

export interface CursorListResult<T> {
  items: T[];
  error: ApiError | null;
  loading: boolean;
  initialLoading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

interface MoreState<T> {
  base: Page<T>;
  items: T[];
  nextCursor: string | null;
  loading: boolean;
  error: ApiError | null;
}

/**
 * Cursor-paginated list: first page via useQuery, further pages appended with loadMore().
 * `path` + `query` form the key; `query.cursor` / `query.limit` are managed here.
 */
export function useCursorList<T>(
  path: string | null,
  query: QueryParams = {},
  options: { limit?: number; pollMs?: number } = {},
): CursorListResult<T> {
  const limit = options.limit ?? 25;
  const key = path === null ? null : `${path}?${JSON.stringify({ ...query, limit })}`;
  const first = useQuery<Page<T>>(
    key,
    (signal) => api.getPage<T>(path as string, { query: { ...query, limit }, signal }),
    { pollMs: options.pollMs },
  );
  const [more, setMore] = useState<MoreState<T> | null>(null);

  const base = first.data;
  const active = more !== null && base !== undefined && more.base === base ? more : null;
  const nextCursor = active ? active.nextCursor : (base?.nextCursor ?? null);

  const loadMore = useCallback(() => {
    if (!base || path === null) return;
    const cursor = active ? active.nextCursor : base.nextCursor;
    if (!cursor) return;
    const prevItems = active ? active.items : [];
    setMore({ base, items: prevItems, nextCursor: cursor, loading: true, error: null });
    api
      .getPage<T>(path, { query: { ...query, limit, cursor } })
      .then((p) => setMore({ base, items: [...prevItems, ...p.items], nextCursor: p.nextCursor, loading: false, error: null }))
      .catch((e: unknown) => setMore({ base, items: prevItems, nextCursor: cursor, loading: false, error: toApiError(e) }));
    // query is intentionally read at call time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, active, path, limit, key]);

  return {
    items: base ? [...base.items, ...(active ? active.items : [])] : [],
    error: first.error ?? active?.error ?? null,
    loading: first.loading,
    initialLoading: first.initialLoading,
    loadingMore: active?.loading ?? false,
    hasMore: nextCursor !== null,
    loadMore,
    refetch: first.refetch,
  };
}
