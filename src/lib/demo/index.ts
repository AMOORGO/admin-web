/**
 * Demo transport: answers API requests locally from an in-memory store, using the same envelope shapes as the real
 * NestJS API. Loaded with a dynamic import() only while a demo session is active (see lib/api/client.ts).
 */
import type { AuthenticatedLogin } from "../auth/types";
import { registerCaptains } from "./routes/captains";
import { registerCore } from "./routes/core";
import { registerFinance } from "./routes/finance";
import { registerPricing } from "./routes/pricing";
import { registerRides } from "./routes/rides";
import { registerSafety } from "./routes/safety";
import { registerSecondChance } from "./routes/secondChance";
import { registerStaff } from "./routes/staff";
import { registerUsers } from "./routes/users";
import { Router, type Ctx, type RouteResult } from "./router";
import { getStore } from "./store";
import { DemoError, asBody, iso, randInt, sleep, uuid } from "./util";

export { startDemoRealtime } from "./realtime";

export interface DemoRequest {
  method: string;
  /** API path without the origin, e.g. `/admin/rides/123`. */
  path: string;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
  signal?: AbortSignal;
}

export interface DemoResponse {
  status: number;
  /** JSON body (success envelope or error envelope) or, for downloads, the file text. */
  body: unknown;
  headers: Record<string, string>;
}

const router = new Router();
registerCore(router);
registerRides(router);
registerCaptains(router);
registerSecondChance(router);
registerUsers(router);
registerSafety(router);
registerFinance(router);
registerPricing(router);
registerStaff(router);

const ID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

function errorResponse(status: number, code: string, message: string, details?: unknown): DemoResponse {
  return { status, headers: {}, body: { error: { code, message, details: details ?? null, requestId: `demo-${uuid().slice(0, 8)}` } } };
}

function toResponse(result: RouteResult): DemoResponse {
  if ("file" in result) {
    return {
      status: 200,
      body: result.file.text,
      headers: { "content-type": `${result.file.contentType}; charset=utf-8`, "content-disposition": `attachment; filename="${result.file.filename}"` },
    };
  }
  const body: Record<string, unknown> = { data: result.data };
  if (result.meta) body.meta = result.meta;
  return { status: result.status ?? 200, body, headers: {} };
}

/** Never throws: unknown endpoints and handler bugs degrade to an empty list / a 404 / a 500 error envelope. */
export async function handleDemoRequest(req: DemoRequest): Promise<DemoResponse> {
  // Artificial latency so loading states are visible and the demo feels like a network round-trip.
  await sleep(randInt(Math.random, 80, 250), req.signal);
  const path = req.path.split("?")[0].replace(/^\/api\/v1/, "");
  const match = router.match(req.method, path);
  if (!match) {
    if (req.method === "GET") {
      const last = path.split("/").filter(Boolean).pop() ?? "";
      if (ID_LIKE.test(last)) return errorResponse(404, "NOT_FOUND", "Not found");
      return { status: 200, headers: {}, body: { data: [], meta: { nextCursor: null } } };
    }
    return errorResponse(404, "DEMO_UNAVAILABLE", "This action is not available in demo mode.");
  }
  const ctx: Ctx = { method: req.method, params: match.params, query: req.query, body: asBody(req.body), headers: req.headers, store: getStore() };
  try {
    return toResponse(match.handler(ctx));
  } catch (e) {
    if (e instanceof DemoError) return errorResponse(e.status, e.code, e.message, e.details);
    return errorResponse(500, "INTERNAL_ERROR", "The demo could not complete this request.");
  }
}

/** Synthetic Super Admin session (all permissions) that starts a demo. */
export function createDemoSession(): AuthenticatedLogin {
  const store = getStore();
  store.me.lastLoginAt = iso(Date.now());
  return {
    status: "AUTHENTICATED",
    accessToken: "demo-access-token",
    refreshToken: "demo-refresh-token",
    expiresIn: 60 * 60 * 24 * 365,
    sessionId: store.me.sessionId ?? uuid(),
    user: store.me,
  };
}
