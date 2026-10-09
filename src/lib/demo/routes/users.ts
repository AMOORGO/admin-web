/** Riders (users): directory, detail, suspend / reactivate / flag, wallet credit and the ledger account lookup. */
import type { ApiUserDetail, ApiUserRow, ApiWalletAdjustResult } from "../../adapters/users";
import { addTransaction, ledgerAccount, postEntries } from "../logic/ledger";
import { type Ctx, type Router, listResult, ok } from "../router";
import { recordAudit, riderById } from "../store";
import { DemoError, asBody, bool, conflict, flagParam, matchesQuery, notFound, num, reqStr, str, uuid } from "../util";

function userOr404(ctx: Ctx, id = ctx.params.id): ApiUserDetail {
  const u = riderById(ctx.store, id);
  if (!u) throw notFound("User");
  return u;
}

const toRow = (u: ApiUserDetail): ApiUserRow => ({
  id: u.id,
  name: u.name,
  phone: u.phone,
  email: u.email,
  status: u.status,
  flagged: u.flagged,
  rating: u.rating,
  ratingCount: u.ratingCount,
  totalRides: u.totalRides,
  lifetimeSpendMinor: u.lifetimeSpendMinor,
  joinedAt: u.joinedAt,
  lastActiveAt: u.lastActiveAt,
});

const seenIdempotencyKeys = new Map<string, ApiWalletAdjustResult>();

export function registerUsers(r: Router): void {
  r.get("/admin/users", (ctx) => {
    const { query } = ctx;
    const rows = ctx.store.riders
      .filter((u) => {
        if (query.status && u.status !== query.status) return false;
        if (query.flagged !== undefined && flagParam(query.flagged) !== u.flagged) return false;
        return matchesQuery(query.q, u.name, u.phone, u.email, u.id);
      })
      .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
    return listResult(rows.map(toRow), query);
  });

  r.get("/admin/users/:id", (ctx) => ok(userOr404(ctx)));

  r.patch("/admin/users/:id", (ctx) => {
    const u = userOr404(ctx);
    const body = asBody(ctx.body);
    const reason = str(body, "reason") ?? null;
    const flagged = bool(body, "flagged");
    const before = { flagged: u.flagged };
    if (flagged !== undefined) u.flagged = flagged;
    recordAudit(ctx.store, { category: "USER", action: "user.updated", targetType: "USER", targetId: u.id, reason, before, after: { flagged: u.flagged } });
    return ok(u);
  });

  r.post("/admin/users/:id/suspend", (ctx) => {
    const u = userOr404(ctx);
    const reason = reqStr(asBody(ctx.body), "reason");
    if (u.status !== "ACTIVE") throw conflict(`A rider in status ${u.status} cannot be suspended`);
    const before = { status: u.status };
    u.status = "SUSPENDED";
    u.statusReason = reason;
    recordAudit(ctx.store, { category: "USER", action: "user.suspended", targetType: "USER", targetId: u.id, reason, before, after: { status: "SUSPENDED" } });
    return ok(u);
  });

  r.post("/admin/users/:id/reactivate", (ctx) => {
    const u = userOr404(ctx);
    const reason = reqStr(asBody(ctx.body), "reason");
    if (u.status !== "SUSPENDED" && u.status !== "BLOCKED") throw conflict(`A rider in status ${u.status} cannot be reactivated`);
    const before = { status: u.status };
    u.status = "ACTIVE";
    u.statusReason = null;
    recordAudit(ctx.store, { category: "USER", action: "user.reactivated", targetType: "USER", targetId: u.id, reason, before, after: { status: "ACTIVE" } });
    return ok(u);
  });

  r.get("/admin/ledger/accounts", (ctx) => {
    const { query } = ctx;
    const rows = ctx.store.accounts
      .filter((a) => (!query.type || a.type === query.type) && (!query.ownerId || a.ownerId === query.ownerId))
      .sort((a, b) => a.type.localeCompare(b.type) || b.balanceMinor - a.balanceMinor);
    return listResult(rows, query, 15);
  });

  r.get("/admin/ledger/entries", (ctx) => {
    const { query } = ctx;
    return listResult(ctx.store.entries.filter((e) => !query.accountId || e.account.id === query.accountId), query, 15);
  });

  r.post("/admin/wallets/:userId/adjust", (ctx) => {
    const user = userOr404(ctx, ctx.params.userId);
    const body = asBody(ctx.body);
    const amount = num(body, "amountMinor");
    const reason = reqStr(body, "reason");
    if (amount === undefined || !Number.isInteger(amount) || amount === 0) throw new DemoError(400, "VALIDATION_FAILED", "amountMinor must be a non-zero integer");
    const key = ctx.headers["idempotency-key"];
    const replay = key ? seenIdempotencyKeys.get(key) : undefined;
    if (replay) return ok(replay);
    const account = ledgerAccount(ctx.store, "RIDER_WALLET", user.id);
    if (account.balanceMinor + amount < 0) throw new DemoError(422, "INSUFFICIENT_BALANCE", "The adjustment would make the wallet balance negative");
    const before = { balanceMinor: account.balanceMinor };
    const txId = uuid();
    const lines =
      amount > 0
        ? [
            { type: "MARKETING_EXPENSE", owner: "platform", debit: amount },
            { type: "RIDER_WALLET", owner: user.id, credit: amount },
          ]
        : [
            { type: "RIDER_WALLET", owner: user.id, debit: -amount },
            { type: "PLATFORM_REVENUE", owner: "platform", credit: -amount },
          ];
    postEntries(ctx.store, txId, "ADJUSTMENT", reason, lines, { type: "WALLET", id: user.id });
    addTransaction(ctx.store, { id: txId, type: "ADJUSTMENT", status: "SUCCESS", riderId: user.id, amountMinor: Math.abs(amount), gateway: "WALLET", description: `Wallet adjustment: ${reason}`, idempotencyKey: key ?? null });
    recordAudit(ctx.store, { category: "FINANCE", action: "wallet.adjusted", targetType: "WALLET", targetId: user.id, reason, before, after: { balanceMinor: account.balanceMinor } });
    const result: ApiWalletAdjustResult = { userId: user.id, balanceMinor: account.balanceMinor };
    if (key) seenIdempotencyKeys.set(key, result);
    return ok(result);
  });
}
