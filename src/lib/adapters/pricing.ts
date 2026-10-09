/**
 * Pricing / geo / config adapters. Backend rules are versioned per (city x service type); the UI's flat
 * `CityPricingConfig` is derived from the active rule + cancellation policy + city settings + the surge flag.
 * Money is integer minor units on the wire, dollars (strings) in the form state.
 */
import type { GeofenceZone } from "@/types";
import { bpsToMultiplier, bpsToPercent, majorToMinor, minorToMajor } from "@/lib/format";

// ── Wire types ────────────────────────────────────────────────

export interface ApiCityFull {
  id: string;
  name: string;
  state: string | null;
  country: string;
  timezone: string;
  currency: string;
  distanceUnit: "MILE" | "KM" | string;
  centerLat: number;
  centerLng: number;
  isActive: boolean;
  ridesEnabled: boolean;
  shutdownMessage: string | null;
  operatingHours: unknown[];
  scheduledRidesEnabled: boolean;
  cashEnabled: boolean;
  walletEnabled: boolean;
  settings: { airportFeeMinor?: number; messages?: Record<string, string> } | null;
  updatedAt: string;
}

export interface ApiServiceType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  enabledCityIds: string[];
}

export interface ApiPricingRule {
  id: string;
  cityId: string;
  serviceTypeId: string;
  version: number;
  currency: string;
  distanceUnit: string;
  baseFareMinor: number;
  perDistanceUnitMinor: number;
  perMinuteMinor: number;
  minimumFareMinor: number;
  waitingPerMinuteMinor: number;
  waitingFreeMinutes: number;
  bookingFeeMinor: number;
  taxRateBps: number;
  commissionBps: number;
  surgeCapBps: number;
  roundingIncrementMinor: number;
  quoteTtlSeconds: number;
  maxFareTolerancePct: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ApiCancellationPolicy {
  id: string;
  cityId: string;
  serviceTypeId: string | null;
  freeCancelSecondsAfterAssignment: number;
  feeAfterAssignmentMinor: number;
  feeAfterArrivalMinor: number;
  noShowFeeMinor: number;
  noShowGraceSeconds: number;
  captainShareBps: number;
  captainCancelWindowDays: number;
  captainCancelWarnThreshold: number;
  captainCancelReviewThreshold: number;
  isActive: boolean;
}

export interface ApiSurgeRule {
  id: string;
  zoneId: string;
  serviceTypeId: string | null;
  multiplierBps: number;
  startsAt: string;
  endsAt: string;
  isAutomated: boolean;
  zone?: { id: string; name: string; cityId: string };
}

export type ZoneTypeValue = "STANDARD" | "HIGH_DEMAND" | "RESTRICTED" | "AIRPORT";
export const ZONE_TYPES: ZoneTypeValue[] = ["STANDARD", "HIGH_DEMAND", "RESTRICTED", "AIRPORT"];

export interface ApiZone {
  id: string;
  cityId: string;
  name: string;
  type: ZoneTypeValue;
  bboxMinLat: number;
  bboxMinLng: number;
  bboxMaxLat: number;
  bboxMaxLng: number;
  surgeMultiplierBps: number;
  isActive: boolean;
  ridesEnabled: boolean;
  shutdownMessage: string | null;
  allowPickup: boolean;
  allowDropoff: boolean;
  updatedAt: string;
}

export interface ApiFeatureFlag {
  key: string;
  description: string;
  default: boolean;
  enabled: boolean;
}

export type ConfigSource = "DEFAULT" | "GLOBAL" | "CITY";

export interface ApiConfigEntry {
  key: string;
  group: string;
  description: string;
  public: boolean;
  default: unknown;
  value: unknown;
  source: ConfigSource;
}

export interface ApiIntegration {
  service: string;
  provider: string;
  configured: boolean;
  live: boolean;
}

export interface ApiFarePreview {
  draft: boolean;
  version: number | null;
  serviceTypeCode: string;
  currency: string;
  distanceUnit: string;
  totalMinor: number;
  breakdown: {
    baseFareMinor: number;
    distanceFareMinor: number;
    timeFareMinor: number;
    waitingFareMinor: number;
    subtotalMinor: number;
    minimumFareApplied: boolean;
    surgeMultiplierBps: number;
    surgeMinor: number;
    bookingFeeMinor: number;
    taxMinor: number;
    tollsMinor: number;
    totalMinor: number;
    platformCommissionMinor: number;
    captainEarningMinor: number;
  };
}

// ── Active rule resolution (mirrors PricingService.resolveRule) ──

/** The rule quotes use at `atMs`: isActive, effectiveFrom <= at < effectiveTo, highest version wins. */
export function resolveActiveRule(rules: ApiPricingRule[], atMs: number): ApiPricingRule | null {
  const live = rules.filter(
    (r) => r.isActive && new Date(r.effectiveFrom).getTime() <= atMs && (r.effectiveTo === null || new Date(r.effectiveTo).getTime() > atMs),
  );
  live.sort((a, b) => b.version - a.version);
  return live[0] ?? null;
}

// ── Rule form (dollars / percent as strings) ──────────────────

export interface RuleForm {
  baseFare: string;
  perDistance: string;
  perMinute: string;
  minimumFare: string;
  bookingFee: string;
  waitingPerMinute: string;
  waitingFreeMinutes: string;
  taxPercent: string;
  commissionPercent: string;
  surgeCap: string;
  roundingIncrementMinor: string;
  quoteTtlSeconds: string;
  maxFareTolerancePct: string;
}

const money = (minor: number) => minorToMajor(minor).toFixed(2);

export const EMPTY_RULE_FORM: RuleForm = {
  baseFare: "0.00",
  perDistance: "0.00",
  perMinute: "0.00",
  minimumFare: "0.00",
  bookingFee: "0.00",
  waitingPerMinute: "0.00",
  waitingFreeMinutes: "5",
  taxPercent: "0",
  commissionPercent: "20",
  surgeCap: "2.0",
  roundingIncrementMinor: "1",
  quoteTtlSeconds: "300",
  maxFareTolerancePct: "20",
};

export function ruleToForm(r: ApiPricingRule | null): RuleForm {
  if (!r) return EMPTY_RULE_FORM;
  return {
    baseFare: money(r.baseFareMinor),
    perDistance: money(r.perDistanceUnitMinor),
    perMinute: money(r.perMinuteMinor),
    minimumFare: money(r.minimumFareMinor),
    bookingFee: money(r.bookingFeeMinor),
    waitingPerMinute: money(r.waitingPerMinuteMinor),
    waitingFreeMinutes: String(r.waitingFreeMinutes),
    taxPercent: String(bpsToPercent(r.taxRateBps)),
    commissionPercent: String(bpsToPercent(r.commissionBps)),
    surgeCap: String(bpsToMultiplier(r.surgeCapBps)),
    roundingIncrementMinor: String(r.roundingIncrementMinor),
    quoteTtlSeconds: String(r.quoteTtlSeconds),
    maxFareTolerancePct: String(r.maxFareTolerancePct),
  };
}

const num = (s: string): number => {
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

/** Body for POST /admin/pricing/rules (without cityId / serviceTypeId / reason) and the preview `draft`. */
export function formToRuleParams(f: RuleForm) {
  return {
    baseFareMinor: majorToMinor(num(f.baseFare)),
    perDistanceUnitMinor: majorToMinor(num(f.perDistance)),
    perMinuteMinor: majorToMinor(num(f.perMinute)),
    minimumFareMinor: majorToMinor(num(f.minimumFare)),
    bookingFeeMinor: majorToMinor(num(f.bookingFee)),
    waitingPerMinuteMinor: majorToMinor(num(f.waitingPerMinute)),
    waitingFreeMinutes: Math.round(num(f.waitingFreeMinutes)),
    taxRateBps: Math.round(num(f.taxPercent) * 100),
    commissionBps: Math.round(num(f.commissionPercent) * 100),
    surgeCapBps: Math.round(num(f.surgeCap) * 10_000),
    roundingIncrementMinor: Math.max(1, Math.round(num(f.roundingIncrementMinor))),
    quoteTtlSeconds: Math.round(num(f.quoteTtlSeconds)),
    maxFareTolerancePct: Math.round(num(f.maxFareTolerancePct)),
  };
}

export const sameForm = (a: RuleForm, b: RuleForm): boolean => (Object.keys(a) as Array<keyof RuleForm>).every((k) => a[k] === b[k]);

// ── Cancellation policy form ──────────────────────────────────

export interface PolicyForm {
  freeCancelSeconds: string;
  feeAfterAssignment: string;
  feeAfterArrival: string;
  noShowFee: string;
  noShowGraceSeconds: string;
  captainSharePercent: string;
  captainCancelWindowDays: string;
  captainCancelWarnThreshold: string;
  captainCancelReviewThreshold: string;
  isActive: boolean;
}

export const EMPTY_POLICY_FORM: PolicyForm = {
  freeCancelSeconds: "120",
  feeAfterAssignment: "3.00",
  feeAfterArrival: "5.00",
  noShowFee: "5.00",
  noShowGraceSeconds: "300",
  captainSharePercent: "80",
  captainCancelWindowDays: "7",
  captainCancelWarnThreshold: "3",
  captainCancelReviewThreshold: "6",
  isActive: true,
};

export function policyToForm(p: ApiCancellationPolicy | null): PolicyForm {
  if (!p) return EMPTY_POLICY_FORM;
  return {
    freeCancelSeconds: String(p.freeCancelSecondsAfterAssignment),
    feeAfterAssignment: money(p.feeAfterAssignmentMinor),
    feeAfterArrival: money(p.feeAfterArrivalMinor),
    noShowFee: money(p.noShowFeeMinor),
    noShowGraceSeconds: String(p.noShowGraceSeconds),
    captainSharePercent: String(bpsToPercent(p.captainShareBps)),
    captainCancelWindowDays: String(p.captainCancelWindowDays),
    captainCancelWarnThreshold: String(p.captainCancelWarnThreshold),
    captainCancelReviewThreshold: String(p.captainCancelReviewThreshold),
    isActive: p.isActive,
  };
}

export function formToPolicyBody(f: PolicyForm) {
  return {
    freeCancelSecondsAfterAssignment: Math.round(num(f.freeCancelSeconds)),
    feeAfterAssignmentMinor: majorToMinor(num(f.feeAfterAssignment)),
    feeAfterArrivalMinor: majorToMinor(num(f.feeAfterArrival)),
    noShowFeeMinor: majorToMinor(num(f.noShowFee)),
    noShowGraceSeconds: Math.round(num(f.noShowGraceSeconds)),
    captainShareBps: Math.round(num(f.captainSharePercent) * 100),
    captainCancelWindowDays: Math.round(num(f.captainCancelWindowDays)),
    captainCancelWarnThreshold: Math.round(num(f.captainCancelWarnThreshold)),
    captainCancelReviewThreshold: Math.round(num(f.captainCancelReviewThreshold)),
    isActive: f.isActive,
  };
}

export const samePolicyForm = (a: PolicyForm, b: PolicyForm): boolean => (Object.keys(a) as Array<keyof PolicyForm>).every((k) => a[k] === b[k]);

// ── Mapping onto the existing UI types ────────────────────────

export interface ZoneView extends GeofenceZone {
  ridesEnabled: boolean;
  isActive: boolean;
  allowPickup: boolean;
  allowDropoff: boolean;
  shutdownMessage: string | null;
  surgeBps: number;
}

export function toGeofenceZone(z: ApiZone, cityName: (id: string) => string): ZoneView {
  return {
    id: z.id,
    city: cityName(z.cityId),
    name: z.name,
    type: z.type,
    surgeFactor: bpsToMultiplier(z.surgeMultiplierBps),
    // live counts per zone are not exposed by the API
    activeCaptainsCount: 0,
    activeRidesCount: 0,
    ridesEnabled: z.ridesEnabled,
    isActive: z.isActive,
    allowPickup: z.allowPickup,
    allowDropoff: z.allowDropoff,
    shutdownMessage: z.shutdownMessage,
    surgeBps: z.surgeMultiplierBps,
  };
}

/** Axis-aligned rectangle as GeoJSON Polygon ([lng, lat], closed ring, counter-clockwise). */
export function bboxToPolygon(minLat: number, minLng: number, maxLat: number, maxLng: number) {
  return {
    type: "Polygon" as const,
    coordinates: [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ],
  };
}

/** `<input type="datetime-local">` value -> ISO string (local time). */
export const localToIso = (v: string): string => new Date(v).toISOString();

/** ISO string -> `datetime-local` value in local time. */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── Config registry knowledge (client side typing hints) ──────

export const CONFIG_ENUMS: Record<string, string[]> = {
  "dispatch.mode": ["SEQUENTIAL", "PARALLEL"],
  "payouts.schedule": ["MANUAL", "DAILY", "WEEKLY"],
};

export type ConfigEditorKind = "boolean" | "number" | "string" | "enum" | "numberList" | "readonly";

export function editorKind(entry: ApiConfigEntry): ConfigEditorKind {
  if (CONFIG_ENUMS[entry.key]) return "enum";
  const d = entry.default;
  if (typeof d === "boolean") return "boolean";
  if (typeof d === "number") return "number";
  if (typeof d === "string") return "string";
  if (Array.isArray(d) && d.every((x) => typeof x === "number")) return "numberList";
  return "readonly";
}

export const isMinorKey = (key: string) => key.endsWith("_minor") || key.endsWith("_over_minor");
