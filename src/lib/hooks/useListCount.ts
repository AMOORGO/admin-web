"use client";

import { api } from "@/lib/api";
import type { QueryParams } from "@/lib/api";
import { useQuery } from "./useQuery";
import { useOnInvalidate, type InvalidateTopic } from "@/lib/invalidate";

export interface ListCount {
  /** null until the first response. */
  count: number | null;
  /** More than `limit` records exist: show "100+". */
  more: boolean;
  loading: boolean;
}

/**
 * Headcount for summary cards. The API has no count endpoint, so this reads one page of up to `limit` ids and reports
 * the number of rows (and whether another page exists). Pass `path = null` to skip the request.
 */
export function useListCount(path: string | null, query: QueryParams, topic: InvalidateTopic, limit = 100): ListCount {
  const key = path === null ? null : `count:${path}:${JSON.stringify(query)}`;
  const q = useQuery<{ count: number; more: boolean }>(key, async (signal) => {
    const page = await api.getPage<unknown>(path as string, { query: { ...query, limit }, signal });
    return { count: page.items.length, more: page.nextCursor !== null };
  });
  useOnInvalidate(topic, q.refetch);
  return { count: q.data?.count ?? null, more: q.data?.more ?? false, loading: q.initialLoading };
}

/** "12" or "100+" */
export const countLabel = (c: ListCount): string => (c.count === null ? "—" : `${c.count}${c.more ? "+" : ""}`);
