/** Seed: cities, service types, zones, pricing rules, cancellation policies, surge rules, feature flags, config, integrations. */
import type {
  ApiCancellationPolicy,
  ApiCityFull,
  ApiIntegration,
  ApiPricingRule,
  ApiServiceType,
  ApiSurgeRule,
  ApiZone,
  ZoneTypeValue,
} from "../../adapters/pricing";
import type { ConfigDef, FlagRow } from "../store";
import { DAY, HOUR, iso, mulberry32, uuid } from "../util";

const r = mulberry32(101);

export interface GeoSeed {
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
}

const CITY_DEFS = [
  { key: "austin", name: "Austin", lat: 30.2672, lng: -97.7431, airportFee: 500, factor: 1 },
  { key: "dallas", name: "Dallas", lat: 32.7767, lng: -96.797, airportFee: 450, factor: 0.96 },
  { key: "houston", name: "Houston", lat: 29.7604, lng: -95.3698, airportFee: 450, factor: 0.93 },
] as const;

const SERVICE_DEFS = [
  { code: "AMOOR_GO", name: "AMOOR Go", description: "Everyday rides in a standard sedan or hatchback", active: true, base: 250, mile: 140, minute: 28, min: 600, booking: 175, commission: 2000 },
  { code: "AMOOR_PRIME", name: "AMOOR Prime", description: "Premium vehicles with top-rated captains", active: true, base: 400, mile: 210, minute: 40, min: 1000, booking: 200, commission: 2000 },
  { code: "AMOOR_SEDAN", name: "AMOOR Sedan", description: "Comfortable mid-size sedans with extra legroom", active: true, base: 350, mile: 185, minute: 35, min: 800, booking: 175, commission: 2000 },
  { code: "AMOOR_EV", name: "AMOOR EV", description: "Fully electric vehicles", active: true, base: 275, mile: 150, minute: 30, min: 650, booking: 175, commission: 1800 },
  { code: "AMOOR_MOTO", name: "AMOOR Moto", description: "Motorbike taxis (not offered in the U.S. yet)", active: false, base: 150, mile: 90, minute: 15, min: 400, booking: 100, commission: 1500 },
  { code: "AMOOR_AUTO", name: "AMOOR Auto", description: "Three-wheeler rides (not offered in the U.S. yet)", active: false, base: 180, mile: 100, minute: 18, min: 450, booking: 100, commission: 1500 },
] as const;

interface ZoneDef {
  city: (typeof CITY_DEFS)[number]["key"];
  name: string;
  type: ZoneTypeValue;
  bbox: [number, number, number, number];
  surgeBps: number;
  allowPickup?: boolean;
}

const ZONE_DEFS: ZoneDef[] = [
  { city: "austin", name: "Downtown & Rainey Entertainment District", type: "HIGH_DEMAND", bbox: [30.255, -97.755, 30.278, -97.73], surgeBps: 12500 },
  { city: "austin", name: "Austin-Bergstrom Airport (AUS)", type: "AIRPORT", bbox: [30.185, -97.69, 30.215, -97.655], surgeBps: 10000 },
  { city: "austin", name: "The Domain Tech Corridor", type: "STANDARD", bbox: [30.395, -97.735, 30.415, -97.71], surgeBps: 10000 },
  { city: "austin", name: "Circuit of The Americas (COTA)", type: "RESTRICTED", bbox: [30.125, -97.655, 30.145, -97.62], surgeBps: 10000, allowPickup: false },
  { city: "austin", name: "UT Campus & West Campus", type: "STANDARD", bbox: [30.28, -97.755, 30.295, -97.735], surgeBps: 10000 },
  { city: "dallas", name: "Uptown & McKinney Avenue", type: "HIGH_DEMAND", bbox: [32.79, -96.815, 32.805, -96.795], surgeBps: 11500 },
  { city: "dallas", name: "Dallas Love Field (DAL)", type: "AIRPORT", bbox: [32.838, -96.86, 32.858, -96.835], surgeBps: 10000 },
  { city: "dallas", name: "Deep Ellum", type: "STANDARD", bbox: [32.778, -96.79, 32.788, -96.775], surgeBps: 10000 },
  { city: "houston", name: "Downtown & Discovery Green", type: "HIGH_DEMAND", bbox: [29.752, -95.372, 29.765, -95.355], surgeBps: 11000 },
  { city: "houston", name: "William P. Hobby Airport (HOU)", type: "AIRPORT", bbox: [29.636, -95.288, 29.658, -95.268], surgeBps: 10000 },
];

/** Registry of tunable settings (subset of the backend's, same keys, groups, defaults and descriptions). */
const MILE = 1609.344;
const CONFIG_DEFS: ConfigDef[] = [
  { key: "dispatch.mode", group: "dispatch", description: "Offer to one captain at a time (MVP) or several in parallel", public: false, default: "SEQUENTIAL" },
  { key: "dispatch.parallel_offer_count", group: "dispatch", description: "Offers sent at once in PARALLEL mode", public: false, default: 3 },
  { key: "dispatch.offer_timeout_seconds", group: "dispatch", description: "Seconds a captain has to accept or decline", public: true, default: 30 },
  { key: "dispatch.radius_steps_meters", group: "dispatch", description: "Search radius per attempt; first value is the initial radius", public: false, default: [Math.round(5 * MILE), Math.round(7.5 * MILE), Math.round(10 * MILE)] },
  { key: "dispatch.max_search_seconds", group: "dispatch", description: "Give up with NO_DRIVER_AVAILABLE after this long", public: false, default: 240 },
  { key: "dispatch.min_rating", group: "dispatch", description: "Rating floor for dispatch (extremely low ratings excluded)", public: false, default: 3 },
  { key: "ride.start_pin_required", group: "rides", description: "Captain must enter the rider trip PIN to start", public: true, default: true },
  { key: "ride.arrival_geofence_meters", group: "rides", description: "Captain must be this close to pickup to mark arrived", public: false, default: 200 },
  { key: "ride.captain_arrival_timeout_minutes", group: "rides", description: "Raise an alert / allow redispatch if captain has not arrived by then", public: false, default: 25 },
  { key: "ride.unpaid_ride_blocks_booking", group: "rides", description: "Rider with an unpaid completed ride cannot book again", public: false, default: true },
  { key: "ride.schedule_min_lead_minutes", group: "rides", description: "Earliest scheduled pickup from now", public: true, default: 30 },
  { key: "ride.schedule_max_days_ahead", group: "rides", description: "Latest scheduled pickup", public: true, default: 7 },
  { key: "ride.destination_change_enabled", group: "rides", description: "Allow rider to change destination mid-trip", public: true, default: false },
  { key: "location.idle_interval_seconds", group: "location", description: "Captain location frame interval while online", public: true, default: 4 },
  { key: "location.ride_interval_seconds", group: "location", description: "Captain location frame interval during a ride", public: true, default: 2 },
  { key: "location.retention_days", group: "location", description: "Keep raw ride location points this long, then reduce to polyline", public: false, default: 30 },
  { key: "safety.sos_ack_sla_seconds", group: "safety", description: "SOS must be acknowledged within", public: false, default: 60 },
  { key: "safety.sos_contact_sla_seconds", group: "safety", description: "First contact with the user within", public: false, default: 180 },
  { key: "safety.sos_cancel_window_seconds", group: "safety", description: "Grace window to cancel an accidental SOS", public: true, default: 5 },
  { key: "safety.route_deviation_alert_meters", group: "safety", description: "Soft alert when the vehicle leaves the planned corridor", public: false, default: 600 },
  { key: "safety.route_deviation_enabled", group: "safety", description: "Enable route-deviation monitoring", public: false, default: false },
  { key: "safety.emergency_number", group: "safety", description: "Number the app dials (device emergency calling)", public: true, default: "911" },
  { key: "payments.authorize_buffer_bps", group: "payments", description: "Authorize estimated fare plus this buffer, capture the final amount", public: false, default: 2000 },
  { key: "payments.max_retry_attempts", group: "payments", description: "Payment retries before support is notified", public: false, default: 3 },
  { key: "payments.settlement_delay_hours", group: "payments", description: "Captain earnings become available after this settlement period", public: false, default: 48 },
  { key: "payouts.min_withdrawal_minor", group: "payments", description: "Minimum withdrawal in minor units", public: false, default: 2000 },
  { key: "payouts.schedule", group: "payments", description: "Automatic payout batch schedule", public: false, default: "WEEKLY" },
  { key: "refunds.auto_refund_enabled", group: "payments", description: "Automatically refund defined situations (duplicate charge, cancellation fee reversal)", public: false, default: true },
  { key: "refunds.support_limit_minor", group: "payments", description: "Support agents can refund up to this without approval", public: false, default: 2500 },
  { key: "refunds.approval_over_minor", group: "payments", description: "Manual refunds above this need finance approval", public: false, default: 10000 },
  { key: "fare.adjust_second_approver_over_minor", group: "payments", description: "Fare adjustments above this need a second approver", public: false, default: 5000 },
  { key: "cash.default_limit_minor", group: "payments", description: "Cash-in-hand ceiling before a captain is blocked from new rides", public: false, default: 10000 },
  { key: "ratings.correction_window_minutes", group: "ratings", description: "Limited window to correct a rating", public: false, default: 10 },
  { key: "ratings.review_threshold_stars", group: "ratings", description: "Ratings at or below this raise a review flag", public: false, default: 2 },
  { key: "referral.referrer_reward_minor", group: "promotions", description: "Wallet credit for the rider who referred a friend (minor units)", public: false, default: 1000 },
  { key: "referral.referee_reward_minor", group: "promotions", description: "Wallet credit for the new rider after their first ride (minor units)", public: false, default: 1000 },
  { key: "captain.reapply_wait_days", group: "captain", description: "Default wait before reapplying after rejection", public: false, default: 30 },
  { key: "captain.document_reminder_days", group: "captain", description: "Days before expiry to remind captains", public: false, default: [30, 7, 0] },
  { key: "captain.cancel_review_enabled", group: "captain", description: "Flag captains for review after repeated cancellations", public: false, default: true },
  { key: "second_chance.review_interval_days", group: "captain", description: "Default Second Chance periodic review interval", public: false, default: 90 },
  { key: "second_chance.default_validity_days", group: "captain", description: "Default Second Chance validity before expiry/review", public: false, default: 365 },
  { key: "account.deletion_grace_days", group: "account", description: "Delay between a deletion request and anonymisation", public: false, default: 14 },
  { key: "app.min_version.rider", group: "app", description: "Force-update gate for the rider app", public: true, default: "1.0.0" },
  { key: "app.min_version.captain", group: "app", description: "Force-update gate for the captain app", public: true, default: "1.0.0" },
  { key: "app.maintenance_mode", group: "app", description: "Put apps into maintenance mode", public: true, default: false },
  { key: "app.support_email", group: "app", description: "Support email shown in apps", public: true, default: "support@amoorgo.com" },
  { key: "app.terms_url", group: "app", description: "Terms of service URL", public: true, default: "https://amoorgo.com/terms" },
  { key: "support.sla_hours.high", group: "support", description: "Hours until a HIGH priority ticket must get a staff response", public: false, default: 8 },
  { key: "support.sla_hours.urgent", group: "support", description: "Hours until an URGENT priority ticket must get a staff response", public: false, default: 2 },
  { key: "reports.stuck_searching_minutes", group: "reports", description: "Rides still SEARCHING after this long are listed as dashboard alerts", public: false, default: 10 },
  { key: "reports.document_expiry_alert_days", group: "reports", description: "Approved-captain documents expiring within this window raise a dashboard alert", public: false, default: 14 },
  { key: "reports.export_max_rows", group: "reports", description: "Maximum rows in one report response or CSV export", public: false, default: 5000 },
  { key: "notifications.sms_enabled", group: "notifications", description: "Send transactional SMS", public: false, default: true },
  { key: "notifications.push_enabled", group: "notifications", description: "Send push notifications", public: false, default: true },
  { key: "notifications.email_enabled", group: "notifications", description: "Send transactional email", public: false, default: true },
];

const FLAG_DEFS: Array<{ key: string; description: string; default: boolean; global?: boolean }> = [
  { key: "ride.scheduled", description: "Scheduled rides", default: false, global: true },
  { key: "ride.cash", description: "Cash payments (default off: client MVP is card/digital)", default: false },
  { key: "ride.wallet", description: "AMOORGO wallet (credits, refunds, top-up)", default: true },
  { key: "ride.tips", description: "Tips after the ride", default: false, global: true },
  { key: "ride.parcel", description: "Parcel delivery service type", default: false },
  { key: "promotions.coupons", description: "Promo codes", default: true },
  { key: "promotions.referrals", description: "Referral rewards", default: true },
  { key: "captain.incentives", description: "Captain incentive campaigns", default: false },
  { key: "comms.chat", description: "In-app ride chat", default: true },
  { key: "comms.masked_calls", description: "Masked calling", default: true },
  { key: "safety.share_trip", description: "Share live trip", default: true },
  { key: "safety.women_preference", description: "Women-safety preference options (per city, after legal review)", default: false },
  { key: "surge.enabled", description: "Surge multipliers", default: false, global: true },
  { key: "second_chance.enabled", description: "Second Chance Driver program", default: true },
  { key: "matching.vibe", description: "AMOORGO VIBE compatibility layer (reserved)", default: false },
];

export function seedGeo(now: number): GeoSeed {
  const cities: ApiCityFull[] = CITY_DEFS.map((c) => ({
    id: uuid(r),
    name: c.name,
    state: "TX",
    country: "US",
    timezone: "America/Chicago",
    currency: "USD",
    distanceUnit: "MILE",
    centerLat: c.lat,
    centerLng: c.lng,
    isActive: true,
    ridesEnabled: true,
    shutdownMessage: null,
    operatingHours: [],
    scheduledRidesEnabled: false,
    cashEnabled: false,
    walletEnabled: true,
    settings: { airportFeeMinor: c.airportFee },
    updatedAt: iso(now - 12 * DAY),
  }));
  const cityId = (key: string): string => cities[CITY_DEFS.findIndex((c) => c.key === key)].id;

  const serviceTypes: ApiServiceType[] = SERVICE_DEFS.map((s, i) => ({
    id: uuid(r),
    code: s.code,
    name: s.name,
    description: s.description,
    isActive: s.active,
    sortOrder: i + 1,
    enabledCityIds: s.active ? cities.map((c) => c.id) : [],
  }));

  const zones: ApiZone[] = ZONE_DEFS.map((z) => ({
    id: uuid(r),
    cityId: cityId(z.city),
    name: z.name,
    type: z.type,
    bboxMinLat: z.bbox[0],
    bboxMinLng: z.bbox[1],
    bboxMaxLat: z.bbox[2],
    bboxMaxLng: z.bbox[3],
    surgeMultiplierBps: z.surgeBps,
    isActive: true,
    ridesEnabled: true,
    shutdownMessage: null,
    allowPickup: z.allowPickup ?? true,
    allowDropoff: true,
    updatedAt: iso(now - 9 * DAY),
  }));

  const rules: ApiPricingRule[] = [];
  const policies: ApiCancellationPolicy[] = [];
  for (const [ci, c] of CITY_DEFS.entries()) {
    for (const [si, s] of SERVICE_DEFS.entries()) {
      if (!s.active) continue;
      const base = {
        cityId: cities[ci].id,
        serviceTypeId: serviceTypes[si].id,
        currency: "USD",
        distanceUnit: "MILE",
        waitingPerMinuteMinor: 30,
        waitingFreeMinutes: 3,
        bookingFeeMinor: s.booking,
        taxRateBps: 825,
        commissionBps: s.commission,
        surgeCapBps: 25000,
        roundingIncrementMinor: 1,
        quoteTtlSeconds: 300,
        maxFareTolerancePct: 20,
      };
      const scale = (n: number) => Math.round(n * c.factor);
      const v1: ApiPricingRule = {
        id: uuid(r),
        ...base,
        version: 1,
        baseFareMinor: scale(s.base),
        perDistanceUnitMinor: scale(s.mile),
        perMinuteMinor: scale(s.minute),
        minimumFareMinor: scale(s.min),
        effectiveFrom: iso(now - 60 * DAY),
        effectiveTo: null,
        isActive: true,
        createdAt: iso(now - 60 * DAY),
      };
      // Austin Go has a revision history so the version list and "ended" state are visible.
      if (ci === 0 && si === 0) {
        const switchAt = now - 21 * DAY;
        v1.effectiveTo = iso(switchAt);
        rules.push(v1, {
          id: uuid(r),
          ...base,
          version: 2,
          baseFareMinor: scale(s.base) + 25,
          perDistanceUnitMinor: scale(s.mile) + 10,
          perMinuteMinor: scale(s.minute) + 2,
          minimumFareMinor: scale(s.min),
          effectiveFrom: iso(switchAt),
          effectiveTo: null,
          isActive: true,
          createdAt: iso(switchAt - HOUR),
        });
      } else {
        rules.push(v1);
      }
    }
    policies.push({
      id: uuid(r),
      cityId: cities[ci].id,
      serviceTypeId: null,
      freeCancelSecondsAfterAssignment: 120,
      feeAfterAssignmentMinor: 300,
      feeAfterArrivalMinor: 500,
      noShowFeeMinor: 500,
      noShowGraceSeconds: 300,
      captainShareBps: 8000,
      captainCancelWindowDays: 7,
      captainCancelWarnThreshold: 3,
      captainCancelReviewThreshold: 6,
      isActive: true,
    });
  }
  // Prime-specific policy in Austin (stricter fee).
  policies.push({
    id: uuid(r),
    cityId: cities[0].id,
    serviceTypeId: serviceTypes[1].id,
    freeCancelSecondsAfterAssignment: 90,
    feeAfterAssignmentMinor: 500,
    feeAfterArrivalMinor: 800,
    noShowFeeMinor: 800,
    noShowGraceSeconds: 300,
    captainShareBps: 8000,
    captainCancelWindowDays: 7,
    captainCancelWarnThreshold: 3,
    captainCancelReviewThreshold: 6,
    isActive: true,
  });

  const downtown = zones[0];
  const airport = zones[1];
  const surgeRules: ApiSurgeRule[] = [
    {
      id: uuid(r),
      zoneId: downtown.id,
      serviceTypeId: null,
      multiplierBps: 15000,
      startsAt: iso(now - HOUR),
      endsAt: iso(now + 3 * HOUR),
      isAutomated: false,
      zone: { id: downtown.id, name: downtown.name, cityId: downtown.cityId },
    },
    {
      id: uuid(r),
      zoneId: airport.id,
      serviceTypeId: serviceTypes[0].id,
      multiplierBps: 12500,
      startsAt: iso(now + 20 * HOUR),
      endsAt: iso(now + 26 * HOUR),
      isAutomated: true,
      zone: { id: airport.id, name: airport.name, cityId: airport.cityId },
    },
    {
      id: uuid(r),
      zoneId: downtown.id,
      serviceTypeId: serviceTypes[1].id,
      multiplierBps: 17500,
      startsAt: iso(now - 2 * DAY),
      endsAt: iso(now - 2 * DAY + 4 * HOUR),
      isAutomated: false,
      zone: { id: downtown.id, name: downtown.name, cityId: downtown.cityId },
    },
  ];

  const flags: FlagRow[] = FLAG_DEFS.map((f) => ({
    key: f.key,
    description: f.description,
    default: f.default,
    global: f.global,
    cities: {},
  }));
  const surge = flags.find((f) => f.key === "surge.enabled");
  if (surge) surge.cities[cities[0].id] = true;
  const cash = flags.find((f) => f.key === "ride.cash");
  if (cash) cash.cities[cities[1].id] = true;

  const configGlobal: Record<string, unknown> = {
    "dispatch.offer_timeout_seconds": 25,
    "refunds.support_limit_minor": 3000,
    "app.min_version.rider": "2.4.0",
    "app.min_version.captain": "2.3.1",
  };
  const configCity: Record<string, Record<string, unknown>> = {
    [cities[0].id]: { "dispatch.max_search_seconds": 300, "safety.route_deviation_enabled": true },
  };

  const integrations: ApiIntegration[] = [
    { service: "Payments", provider: "Stripe", configured: true, live: false },
    { service: "Maps & routing", provider: "Mapbox", configured: true, live: true },
    { service: "SMS", provider: "Twilio", configured: true, live: true },
    { service: "Push notifications", provider: "Firebase Cloud Messaging", configured: true, live: true },
    { service: "Transactional email", provider: "SendGrid", configured: false, live: false },
    { service: "Document storage", provider: "Amazon S3", configured: true, live: true },
  ];

  return { cities, serviceTypes, zones, rules, policies, surgeRules, flags, configDefs: CONFIG_DEFS, configGlobal, configCity, integrations };
}
