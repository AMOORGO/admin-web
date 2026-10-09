/** Double-entry posting helper for runtime mutations (wallet credits, refunds, payouts). */
import type { ApiTransaction } from "../../adapters/finance";
import type { DemoStore } from "../store";
import { iso, uuid } from "../util";

const CREDIT_NORMAL = new Set(["RIDER_WALLET", "CAPTAIN_PAYABLE", "PLATFORM_REVENUE", "TAX_PAYABLE", "INCENTIVE_PAYABLE"]);

export function ledgerAccount(store: DemoStore, type: string, ownerId: string) {
  let a = store.accounts.find((x) => x.type === type && x.ownerId === ownerId);
  if (!a) {
    a = { id: uuid(), type, ownerId, currency: "USD", balanceMinor: 0, updatedAt: iso(Date.now()) };
    store.accounts.push(a);
  }
  return a;
}

export interface PostLine {
  type: string;
  owner: string;
  debit?: number;
  credit?: number;
}

export function postEntries(store: DemoStore, txnId: string, kind: string, description: string, lines: PostLine[], ref?: { type: string; id: string }): void {
  const at = iso(Date.now());
  for (const l of lines) {
    const a = ledgerAccount(store, l.type, l.owner);
    const debit = l.debit ?? 0;
    const credit = l.credit ?? 0;
    a.balanceMinor += CREDIT_NORMAL.has(l.type) ? credit - debit : debit - credit;
    a.updatedAt = at;
    store.entries.unshift({
      id: uuid(),
      txnId,
      account: { id: a.id, type: a.type, ownerId: a.ownerId },
      debitMinor: debit,
      creditMinor: credit,
      currency: "USD",
      kind,
      description,
      refType: ref?.type ?? null,
      refId: ref?.id ?? null,
      at,
    });
  }
}

/** Adds a transaction row (newest first); an explicit `id` ties it to ledger entries already posted under that id. */
export function addTransaction(store: DemoStore, t: Partial<ApiTransaction> & Pick<ApiTransaction, "type" | "status" | "amountMinor">): ApiTransaction {
  const now = iso(Date.now());
  const tx: ApiTransaction = {
    id: uuid(),
    rideId: null,
    paymentId: null,
    refundId: null,
    payoutId: null,
    riderId: null,
    captainId: null,
    cityId: null,
    gateway: "STRIPE",
    platformFeeMinor: 0,
    captainEarningsMinor: 0,
    taxMinor: 0,
    currency: "USD",
    idempotencyKey: null,
    description: null,
    createdAt: now,
    updatedAt: now,
    ...t,
  };
  store.transactions.unshift(tx);
  return tx;
}
