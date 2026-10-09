/** Tiny method + path-pattern router for the demo transport. Handlers are synchronous and operate on the in-memory store. */
import type { DemoStore } from "./store";
import type { Body } from "./util";
import { paginate } from "./util";

export interface Ctx {
  method: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: Body;
  headers: Record<string, string>;
  store: DemoStore;
}

export interface FileResult {
  file: { text: string; filename: string; contentType: string };
}

export interface DataResult {
  data: unknown;
  meta?: Record<string, unknown>;
  status?: number;
}

export type RouteResult = DataResult | FileResult;
export type Handler = (ctx: Ctx) => RouteResult;

interface Route {
  method: string;
  regex: RegExp;
  keys: string[];
  handler: Handler;
}

export class Router {
  private readonly routes: Route[] = [];

  add(method: string, pattern: string, handler: Handler): void {
    const keys: string[] = [];
    const source = pattern
      .split("/")
      .map((seg) => {
        if (seg.startsWith(":")) {
          keys.push(seg.slice(1));
          return "([^/]+)";
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("/");
    this.routes.push({ method, regex: new RegExp(`^${source}/?$`), keys, handler });
  }

  get(pattern: string, handler: Handler): void {
    this.add("GET", pattern, handler);
  }
  post(pattern: string, handler: Handler): void {
    this.add("POST", pattern, handler);
  }
  put(pattern: string, handler: Handler): void {
    this.add("PUT", pattern, handler);
  }
  patch(pattern: string, handler: Handler): void {
    this.add("PATCH", pattern, handler);
  }
  delete(pattern: string, handler: Handler): void {
    this.add("DELETE", pattern, handler);
  }

  /** Finds the first route matching method + path; static segments are registered before parameterised ones by the callers. */
  match(method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = route.regex.exec(path);
      if (!m) continue;
      const params: Record<string, string> = {};
      route.keys.forEach((k, i) => {
        params[k] = decodeURIComponent(m[i + 1]);
      });
      return { handler: route.handler, params };
    }
    return null;
  }
}

/** `{ data: items, meta: { nextCursor } }` for a cursor-paginated list. */
export function listResult<T>(items: readonly T[], query: Record<string, string>, defaultLimit = 25): DataResult {
  const p = paginate(items, query, defaultLimit);
  return { data: p.items, meta: { nextCursor: p.nextCursor } };
}

export const ok = (data: unknown): DataResult => ({ data });
