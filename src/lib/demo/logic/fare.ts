/** Fare calculation mirroring backend/src/contracts/fare.ts (integer minor units, basis points). */
import type { ApiFareBreakdown } from "../../adapters/rides";
import type { ApiPricingRule as PricingRule } from "../../adapters/pricing";

const METERS_PER_MILE = 1609.344;

export interface FareInput {
  distanceMeters: number;
  durationSeconds: number;
  waitingSeconds?: number;
  surgeMultiplierBps?: number;
  tollsMinor?: number;
  discountMinor?: number;
  couponCode?: string;
}

export type FareRule = Pick<
  PricingRule,
  | "currency"
  | "distanceUnit"
  | "baseFareMinor"
  | "perDistanceUnitMinor"
  | "perMinuteMinor"
  | "minimumFareMinor"
  | "waitingPerMinuteMinor"
  | "waitingFreeMinutes"
  | "bookingFeeMinor"
  | "taxRateBps"
  | "commissionBps"
  | "surgeCapBps"
>;

export function computeFare(rule: FareRule, input: FareInput): ApiFareBreakdown {
  const unitMeters = rule.distanceUnit === "KM" ? 1000 : METERS_PER_MILE;
  const distanceInUnit = Math.round((input.distanceMeters / unitMeters) * 100) / 100;
  const durationMinutes = Math.round((input.durationSeconds / 60) * 10) / 10;
  const waitingMinutes = Math.max(0, (input.waitingSeconds ?? 0) / 60 - rule.waitingFreeMinutes);

  const baseFareMinor = rule.baseFareMinor;
  const distanceFareMinor = Math.round(rule.perDistanceUnitMinor * distanceInUnit);
  const timeFareMinor = Math.round(rule.perMinuteMinor * durationMinutes);
  const waitingFareMinor = Math.round(rule.waitingPerMinuteMinor * waitingMinutes);
  const rawSubtotalMinor = baseFareMinor + distanceFareMinor + timeFareMinor + waitingFareMinor;
  const minimumFareApplied = rawSubtotalMinor < rule.minimumFareMinor;
  const subtotalMinor = minimumFareApplied ? rule.minimumFareMinor : rawSubtotalMinor;

  const cappedBps = Math.min(input.surgeMultiplierBps ?? 10000, rule.surgeCapBps);
  const surgeMinor = cappedBps > 10000 ? Math.round((subtotalMinor * (cappedBps - 10000)) / 10000) : 0;
  const fareBeforeFeesMinor = subtotalMinor + surgeMinor;
  const tollsMinor = input.tollsMinor ?? 0;
  const discountMinor = input.discountMinor ?? 0;
  const taxable = Math.max(0, fareBeforeFeesMinor + rule.bookingFeeMinor + tollsMinor - discountMinor);
  const taxMinor = Math.round((taxable * rule.taxRateBps) / 10000);
  const totalMinor = taxable + taxMinor;
  const platformCommissionMinor = Math.round((fareBeforeFeesMinor * rule.commissionBps) / 10000);
  const captainEarningMinor = fareBeforeFeesMinor - platformCommissionMinor + tollsMinor;

  return {
    currency: rule.currency,
    distanceUnit: rule.distanceUnit === "KM" ? "KM" : "MILE",
    distanceMeters: Math.round(input.distanceMeters),
    durationSeconds: Math.round(input.durationSeconds),
    distanceInUnit,
    durationMinutes,
    baseFareMinor,
    distanceFareMinor,
    timeFareMinor,
    waitingFareMinor,
    rawSubtotalMinor,
    minimumFareMinor: rule.minimumFareMinor,
    minimumFareApplied,
    subtotalMinor,
    surgeMultiplierBps: cappedBps,
    surgeMinor,
    fareBeforeFeesMinor,
    bookingFeeMinor: rule.bookingFeeMinor,
    tollsMinor,
    discountMinor,
    ...(input.couponCode ? { couponCode: input.couponCode } : {}),
    taxRateBps: rule.taxRateBps,
    taxMinor,
    totalMinor,
    commissionBps: rule.commissionBps,
    platformCommissionMinor,
    captainEarningMinor,
  };
}
