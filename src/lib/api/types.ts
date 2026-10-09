export type QueryValue = string | number | boolean | null | undefined | ReadonlyArray<string | number>;
export type QueryParams = Record<string, QueryValue>;

/** One page of a cursor-paginated list. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Raw success envelope: { data, meta? } */
export interface Envelope<T> {
  data: T;
  meta?: { nextCursor?: string | null; [key: string]: unknown };
}

export interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
  /** Milliseconds before the request is aborted. Default 30s. */
  timeoutMs?: number;
  /** Extra headers, e.g. Idempotency-Key. */
  headers?: Record<string, string>;
  /** Set false for public endpoints (login, refresh). Default true. */
  auth?: boolean;
}
