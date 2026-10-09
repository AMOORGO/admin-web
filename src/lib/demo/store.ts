/**
 * In-memory, stateful demo backend. Everything here is backend-shaped (the same DTOs the NestJS API returns); the UI
 * adapters turn them into view models exactly as they do for live data. State lives only in this module's memory:
 * a page reload re-seeds it, nothing is persisted or sent anywhere.
 */
import type { StaffMe } from "../auth/types";
import type { ApiAuditEntry } from "../adapters/audit";
import type { ApiCaptainDetail, ApiVehicle } from "../adapters/captains";
import type {
  ApiLedgerAccount,
  ApiLedgerEntry,
  ApiPayment,
  ApiPayout,
  ApiPayoutBatch,
  ApiRefund,
  ApiTransaction,
} from "../adapters/finance";
import type { ApiPermissionGroup, ApiRole, ApiStaff } from "../adapters/iam";
import type {
  ApiCancellationPolicy,
  ApiCityFull,
  ApiIntegration,
  ApiPricingRule,
  ApiServiceType,
  ApiSurgeRule,
  ApiZone,
} from "../adapters/pricing";
import type { ApiDispatchAttempt, ApiRideRecord, ApiRidePayment, ApiTimelineStep } from "../adapters/rides";
import type { ApiIncidentDetail } from "../adapters/safety";
import type { ApiScDetail } from "../adapters/secondChance";
import type { ApiUserDetail } from "../adapters/users";
import { getDemoRole } from "./flag";
import { applyRole } from "./roles";
import { buildStore } from "./seed";
import { iso, uuid } from "./util";

export interface RideRow {
  rec: ApiRideRecord;
  payment: ApiRidePayment | null;
  attempts: ApiDispatchAttempt[];
  events: ApiTimelineStep[];
}

export interface CaptainRow {
  d: ApiCaptainDetail;
  /** Full document numbers (the detail payload only carries masked ones). */
  docNumbers: Record<string, string>;
  lat: number;
  lng: number;
  sc: ApiScDetail | null;
}

export interface FlagRow {
  key: string;
  description: string;
  default: boolean;
  global: boolean | undefined;
  cities: Record<string, boolean>;
}

export interface ConfigDef {
  key: string;
  group: string;
  description: string;
  public: boolean;
  default: unknown;
}

export interface FareApproval {
  id: string;
  rideId: string;
  amountMinor: number;
  reason: string;
}

export interface DemoStore {
  me: StaffMe;
  cities: ApiCityFull[];
  serviceTypes: ApiServiceType[];
  zones: ApiZone[];
  rules: ApiPricingRule[];
  policies: ApiCancellationPolicy[];
  surgeRules: ApiSurgeRule[];
  flags: FlagRow[];
  configDefs: ConfigDef[];
  configGlobal: Record<string, unknown>;
  configCity: Record<string, Record<string, unknown>>;
  integrations: ApiIntegration[];
  staff: ApiStaff[];
  roles: ApiRole[];
  permissionCatalogue: ApiPermissionGroup[];
  riders: ApiUserDetail[];
  captains: CaptainRow[];
  rides: RideRow[];
  incidents: ApiIncidentDetail[];
  transactions: ApiTransaction[];
  payments: ApiPayment[];
  refunds: ApiRefund[];
  payouts: ApiPayout[];
  batches: ApiPayoutBatch[];
  accounts: ApiLedgerAccount[];
  entries: ApiLedgerEntry[];
  audit: ApiAuditEntry[];
  approvals: Map<string, FareApproval>;
  /** Set once the one-off simulated SOS was raised in this page view. */
  sosSimulated: boolean;
}

let store: DemoStore | null = null;

/** The singleton store, built (seeded) on first use. */
export function getStore(): DemoStore {
  if (!store) {
    store = buildStore(Date.now());
    applyRole(store, getDemoRole());
  }
  return store;
}

/** Synchronous accessor for code that runs after the store exists (route handlers, realtime). */
export function peekStore(): DemoStore | null {
  return store;
}

export function resetStore(): void {
  store = null;
}

// ── Lookups ──

export const rideById = (s: DemoStore, id: string): RideRow | undefined => s.rides.find((r) => r.rec.id === id);
export const captainById = (s: DemoStore, id: string | null | undefined): CaptainRow | undefined => (id ? s.captains.find((c) => c.d.id === id) : undefined);
export const riderById = (s: DemoStore, id: string | null | undefined): ApiUserDetail | undefined => (id ? s.riders.find((r) => r.id === id) : undefined);
export const staffById = (s: DemoStore, id: string | null | undefined): ApiStaff | undefined => (id ? s.staff.find((m) => m.id === id) : undefined);

export function primaryVehicle(c: CaptainRow): ApiVehicle | undefined {
  return c.d.vehicles.find((v) => v.isPrimary) ?? c.d.vehicles[0];
}

// ── Audit ──

export interface AuditInput {
  category: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/** Writes an audit entry attributed to the demo admin. Every mutation handler calls this (the audit tab then shows it). */
export function recordAudit(s: DemoStore, input: AuditInput): ApiAuditEntry {
  const entry: ApiAuditEntry = {
    id: uuid(),
    timestamp: iso(Date.now()),
    actor: { realm: "STAFF", id: s.me.id, name: s.me.name, email: s.me.email, role: s.me.roles[0] ?? "SUPER_ADMIN" },
    action: input.action,
    category: input.category,
    targetType: input.targetType,
    targetId: input.targetId,
    ipAddress: "203.0.113.24",
    requestId: `demo-${uuid().slice(0, 8)}`,
    reasonNotes: input.reason ?? null,
    diff: input.before || input.after ? { before: input.before ?? null, after: input.after ?? null } : null,
  };
  s.audit.unshift(entry);
  return entry;
}
