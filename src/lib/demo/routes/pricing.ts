/** Pricing & geo: cities, service types, fare rules (versioned), cancellation policies, surge, zones, flags and platform config. */
import type { ApiCancellationPolicy, ApiCityFull, ApiFarePreview, ApiPricingRule, ApiSurgeRule, ApiZone, ZoneTypeValue } from "../../adapters/pricing";
import { configEntries, flagEntries } from "../logic/config";
import { computeFare } from "../logic/fare";
import { inScope } from "../logic/scope";
import { type Ctx, type Router, listResult, ok } from "../router";
import { recordAudit } from "../store";
import { DemoError, asBody, bool, conflict, iso, notFound, num, reqStr, str, uuid } from "../util";

function cityOr404(ctx: Ctx, id = ctx.params.id): ApiCityFull {
  const c = ctx.store.cities.find((x) => x.id === id);
  if (!c) throw notFound("City");
  return c;
}

function zoneOr404(ctx: Ctx): ApiZone {
  const z = ctx.store.zones.find((x) => x.id === ctx.params.id);
  if (!z) throw notFound("Zone");
  return z;
}

const ZONE_TYPES: ZoneTypeValue[] = ["STANDARD", "HIGH_DEMAND", "RESTRICTED", "AIRPORT"];

/** GeoJSON polygon ring -> bounding box (the console only draws / edits rectangles). */
function bboxFromPolygon(polygon: unknown): { minLat: number; minLng: number; maxLat: number; maxLng: number } | null {
  const ring = (polygon as { coordinates?: number[][][] } | undefined)?.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 4) return null;
  const lats = ring.map((p) => p[1]);
  const lngs = ring.map((p) => p[0]);
  if ([...lats, ...lngs].some((n) => typeof n !== "number" || !Number.isFinite(n))) return null;
  return { minLat: Math.min(...lats), minLng: Math.min(...lngs), maxLat: Math.max(...lats), maxLng: Math.max(...lngs) };
}

const intField = (b: Record<string, unknown>, key: string, fallback: number): number => {
  const v = num(b, key);
  return v === undefined ? fallback : Math.round(v);
};

export function registerPricing(r: Router): void {
  // ── Cities ──
  r.get("/admin/cities", (ctx) => listResult(ctx.store.cities.filter((c) => inScope(ctx.store, c.id)), ctx.query, 100));

  r.patch("/admin/cities/:id", (ctx) => {
    const city = cityOr404(ctx);
    const body = asBody(ctx.body);
    const reason = reqStr(body, "reason");
    const before = { settings: city.settings };
    if (body.settings && typeof body.settings === "object") city.settings = body.settings as ApiCityFull["settings"];
    city.updatedAt = iso(Date.now());
    recordAudit(ctx.store, { category: "CONFIG", action: "city.updated", targetType: "CITY", targetId: city.id, reason, before, after: { settings: city.settings } });
    return ok(city);
  });

  r.post("/admin/cities/:id/rides-enabled", (ctx) => {
    const city = cityOr404(ctx);
    const body = asBody(ctx.body);
    const reason = reqStr(body, "reason");
    const enabled = bool(body, "enabled");
    if (enabled === undefined) throw new DemoError(400, "VALIDATION_FAILED", "enabled is required");
    const before = { ridesEnabled: city.ridesEnabled };
    city.ridesEnabled = enabled;
    city.shutdownMessage = enabled ? null : (str(body, "message") ?? null);
    city.updatedAt = iso(Date.now());
    recordAudit(ctx.store, { category: "CONFIG", action: enabled ? "city.rides_resumed" : "city.rides_paused", targetType: "CITY", targetId: city.id, reason, before, after: { ridesEnabled: enabled } });
    return ok(city);
  });

  r.get("/admin/service-types", (ctx) => ok(ctx.store.serviceTypes));

  // ── Fare rules (immutable versions) ──
  r.get("/admin/pricing/rules", (ctx) => {
    const { query } = ctx;
    const rows = ctx.store.rules
      .filter((x) => inScope(ctx.store, x.cityId) && (!query.cityId || x.cityId === query.cityId) && (!query.serviceTypeId || x.serviceTypeId === query.serviceTypeId))
      .sort((a, b) => b.version - a.version);
    return listResult(rows, query, 100);
  });

  r.post("/admin/pricing/rules", (ctx) => {
    const body = asBody(ctx.body);
    const cityId = reqStr(body, "cityId");
    const serviceTypeId = reqStr(body, "serviceTypeId");
    const reason = reqStr(body, "reason");
    cityOr404(ctx, cityId);
    if (!ctx.store.serviceTypes.some((s) => s.id === serviceTypeId)) throw notFound("Service type");
    const existing = ctx.store.rules.filter((x) => x.cityId === cityId && x.serviceTypeId === serviceTypeId);
    const version = existing.reduce((m, x) => Math.max(m, x.version), 0) + 1;
    const now = Date.now();
    const from = str(body, "effectiveFrom") ?? iso(now);
    const created: ApiPricingRule = {
      id: uuid(),
      cityId,
      serviceTypeId,
      version,
      currency: "USD",
      distanceUnit: "MILE",
      baseFareMinor: intField(body, "baseFareMinor", 0),
      perDistanceUnitMinor: intField(body, "perDistanceUnitMinor", 0),
      perMinuteMinor: intField(body, "perMinuteMinor", 0),
      minimumFareMinor: intField(body, "minimumFareMinor", 0),
      waitingPerMinuteMinor: intField(body, "waitingPerMinuteMinor", 0),
      waitingFreeMinutes: intField(body, "waitingFreeMinutes", 3),
      bookingFeeMinor: intField(body, "bookingFeeMinor", 0),
      taxRateBps: intField(body, "taxRateBps", 0),
      commissionBps: intField(body, "commissionBps", 2000),
      surgeCapBps: intField(body, "surgeCapBps", 20000),
      roundingIncrementMinor: Math.max(1, intField(body, "roundingIncrementMinor", 1)),
      quoteTtlSeconds: intField(body, "quoteTtlSeconds", 300),
      maxFareTolerancePct: intField(body, "maxFareTolerancePct", 20),
      effectiveFrom: from,
      effectiveTo: str(body, "effectiveTo") ?? null,
      isActive: true,
      createdAt: iso(now),
    };
    // Close the version that is live when the new one starts.
    for (const x of existing) if (x.isActive && x.effectiveTo === null && new Date(x.effectiveFrom).getTime() <= new Date(from).getTime()) x.effectiveTo = from;
    ctx.store.rules.push(created);
    recordAudit(ctx.store, { category: "CONFIG", action: "pricing_rule.created", targetType: "PRICING_RULE", targetId: created.id, reason, after: { version, baseFareMinor: created.baseFareMinor, perDistanceUnitMinor: created.perDistanceUnitMinor, perMinuteMinor: created.perMinuteMinor } });
    return ok(created);
  });

  r.patch("/admin/pricing/rules/:id", (ctx) => {
    const rule = ctx.store.rules.find((x) => x.id === ctx.params.id);
    if (!rule) throw notFound("Pricing rule");
    const body = asBody(ctx.body);
    const reason = reqStr(body, "reason");
    const active = bool(body, "isActive");
    const before = { isActive: rule.isActive };
    if (active !== undefined) rule.isActive = active;
    recordAudit(ctx.store, { category: "CONFIG", action: "pricing_rule.updated", targetType: "PRICING_RULE", targetId: rule.id, reason, before, after: { isActive: rule.isActive } });
    return ok(rule);
  });

  r.post("/admin/pricing/preview", (ctx) => {
    const body = asBody(ctx.body);
    const cityId = reqStr(body, "cityId");
    const serviceTypeId = reqStr(body, "serviceTypeId");
    const st = ctx.store.serviceTypes.find((s) => s.id === serviceTypeId);
    if (!st) throw notFound("Service type");
    const draft = (body.draft ?? {}) as Record<string, unknown>;
    const live = ctx.store.rules.filter((x) => x.cityId === cityId && x.serviceTypeId === serviceTypeId && x.isActive).sort((a, b) => b.version - a.version)[0];
    const rule = {
      currency: "USD",
      distanceUnit: "MILE",
      baseFareMinor: intField(draft, "baseFareMinor", live?.baseFareMinor ?? 0),
      perDistanceUnitMinor: intField(draft, "perDistanceUnitMinor", live?.perDistanceUnitMinor ?? 0),
      perMinuteMinor: intField(draft, "perMinuteMinor", live?.perMinuteMinor ?? 0),
      minimumFareMinor: intField(draft, "minimumFareMinor", live?.minimumFareMinor ?? 0),
      waitingPerMinuteMinor: intField(draft, "waitingPerMinuteMinor", live?.waitingPerMinuteMinor ?? 0),
      waitingFreeMinutes: intField(draft, "waitingFreeMinutes", live?.waitingFreeMinutes ?? 3),
      bookingFeeMinor: intField(draft, "bookingFeeMinor", live?.bookingFeeMinor ?? 0),
      taxRateBps: intField(draft, "taxRateBps", live?.taxRateBps ?? 0),
      commissionBps: intField(draft, "commissionBps", live?.commissionBps ?? 2000),
      surgeCapBps: intField(draft, "surgeCapBps", live?.surgeCapBps ?? 20000),
    };
    const distanceInUnit = num(body, "distanceInUnit") ?? 0;
    const durationMinutes = num(body, "durationMinutes") ?? 0;
    const fare = computeFare(rule, {
      distanceMeters: distanceInUnit * 1609.344,
      durationSeconds: durationMinutes * 60,
      surgeMultiplierBps: intField(body, "surgeMultiplierBps", 10000),
    });
    const out: ApiFarePreview = {
      draft: true,
      version: live?.version ?? null,
      serviceTypeCode: st.code,
      currency: "USD",
      distanceUnit: "MILE",
      totalMinor: fare.totalMinor,
      breakdown: {
        baseFareMinor: fare.baseFareMinor,
        distanceFareMinor: fare.distanceFareMinor,
        timeFareMinor: fare.timeFareMinor,
        waitingFareMinor: fare.waitingFareMinor,
        subtotalMinor: fare.subtotalMinor,
        minimumFareApplied: fare.minimumFareApplied,
        surgeMultiplierBps: fare.surgeMultiplierBps,
        surgeMinor: fare.surgeMinor,
        bookingFeeMinor: fare.bookingFeeMinor,
        taxMinor: fare.taxMinor,
        tollsMinor: fare.tollsMinor,
        totalMinor: fare.totalMinor,
        platformCommissionMinor: fare.platformCommissionMinor,
        captainEarningMinor: fare.captainEarningMinor,
      },
    };
    return ok(out);
  });

  // ── Cancellation policies ──
  r.get("/admin/pricing/cancellation-policies", (ctx) => {
    const { query } = ctx;
    return listResult(ctx.store.policies.filter((p) => inScope(ctx.store, p.cityId) && (!query.cityId || p.cityId === query.cityId)), query, 100);
  });

  r.put("/admin/pricing/cancellation-policies", (ctx) => {
    const body = asBody(ctx.body);
    const cityId = reqStr(body, "cityId");
    const reason = reqStr(body, "reason");
    cityOr404(ctx, cityId);
    const serviceTypeId = typeof body.serviceTypeId === "string" ? body.serviceTypeId : null;
    let policy = ctx.store.policies.find((p) => p.cityId === cityId && p.serviceTypeId === serviceTypeId);
    const before = policy ? { ...policy } : null;
    const next: Omit<ApiCancellationPolicy, "id"> = {
      cityId,
      serviceTypeId,
      freeCancelSecondsAfterAssignment: intField(body, "freeCancelSecondsAfterAssignment", 120),
      feeAfterAssignmentMinor: intField(body, "feeAfterAssignmentMinor", 0),
      feeAfterArrivalMinor: intField(body, "feeAfterArrivalMinor", 0),
      noShowFeeMinor: intField(body, "noShowFeeMinor", 0),
      noShowGraceSeconds: intField(body, "noShowGraceSeconds", 300),
      captainShareBps: intField(body, "captainShareBps", 8000),
      captainCancelWindowDays: intField(body, "captainCancelWindowDays", 7),
      captainCancelWarnThreshold: intField(body, "captainCancelWarnThreshold", 3),
      captainCancelReviewThreshold: intField(body, "captainCancelReviewThreshold", 6),
      isActive: bool(body, "isActive") ?? true,
    };
    if (policy) Object.assign(policy, next);
    else {
      policy = { id: uuid(), ...next };
      ctx.store.policies.push(policy);
    }
    recordAudit(ctx.store, { category: "CONFIG", action: "cancellation_policy.updated", targetType: "CANCELLATION_POLICY", targetId: policy.id, reason, before: before ? { ...before } : null, after: { ...policy } });
    return ok(policy);
  });

  // ── Surge ──
  r.get("/admin/pricing/surge-rules", (ctx) => {
    const { query } = ctx;
    const zoneIds = new Set(ctx.store.zones.filter((z) => inScope(ctx.store, z.cityId) && (!query.cityId || z.cityId === query.cityId)).map((z) => z.id));
    const rows = ctx.store.surgeRules.filter((s) => zoneIds.has(s.zoneId)).sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
    return listResult(rows, query, 100);
  });

  r.post("/admin/pricing/surge-rules", (ctx) => {
    const body = asBody(ctx.body);
    const zoneId = reqStr(body, "zoneId");
    const reason = reqStr(body, "reason");
    const zone = ctx.store.zones.find((z) => z.id === zoneId);
    if (!zone) throw notFound("Zone");
    const startsAt = reqStr(body, "startsAt");
    const endsAt = reqStr(body, "endsAt");
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) throw new DemoError(400, "VALIDATION_FAILED", "The end must be after the start");
    const rule: ApiSurgeRule = {
      id: uuid(),
      zoneId,
      serviceTypeId: str(body, "serviceTypeId") ?? null,
      multiplierBps: intField(body, "multiplierBps", 10000),
      startsAt,
      endsAt,
      isAutomated: false,
      zone: { id: zone.id, name: zone.name, cityId: zone.cityId },
    };
    ctx.store.surgeRules.push(rule);
    recordAudit(ctx.store, { category: "CONFIG", action: "surge_rule.created", targetType: "SURGE_RULE", targetId: rule.id, reason, after: { zone: zone.name, multiplierBps: rule.multiplierBps } });
    return ok(rule);
  });

  r.delete("/admin/pricing/surge-rules/:id", (ctx) => {
    const idx = ctx.store.surgeRules.findIndex((s) => s.id === ctx.params.id);
    if (idx < 0) throw notFound("Surge rule");
    const [removed] = ctx.store.surgeRules.splice(idx, 1);
    recordAudit(ctx.store, { category: "CONFIG", action: "surge_rule.deleted", targetType: "SURGE_RULE", targetId: removed.id, reason: ctx.query.reason ?? null });
    return ok({ ok: true });
  });

  // ── Zones ──
  r.get("/admin/zones", (ctx) => {
    const { query } = ctx;
    return listResult(ctx.store.zones.filter((z) => inScope(ctx.store, z.cityId) && (!query.cityId || z.cityId === query.cityId)), query, 100);
  });

  r.post("/admin/zones", (ctx) => {
    const body = asBody(ctx.body);
    const cityId = reqStr(body, "cityId");
    const reason = reqStr(body, "reason");
    cityOr404(ctx, cityId);
    const bbox = bboxFromPolygon(body.polygon);
    if (!bbox) throw new DemoError(400, "VALIDATION_FAILED", "A valid polygon is required");
    const type = (str(body, "type") ?? "STANDARD") as ZoneTypeValue;
    if (!ZONE_TYPES.includes(type)) throw new DemoError(400, "VALIDATION_FAILED", "Unknown zone type");
    const zone: ApiZone = {
      id: uuid(),
      cityId,
      name: reqStr(body, "name"),
      type,
      bboxMinLat: bbox.minLat,
      bboxMinLng: bbox.minLng,
      bboxMaxLat: bbox.maxLat,
      bboxMaxLng: bbox.maxLng,
      surgeMultiplierBps: intField(body, "surgeMultiplierBps", 10000),
      isActive: bool(body, "isActive") ?? true,
      ridesEnabled: true,
      shutdownMessage: null,
      allowPickup: bool(body, "allowPickup") ?? true,
      allowDropoff: bool(body, "allowDropoff") ?? true,
      updatedAt: iso(Date.now()),
    };
    ctx.store.zones.push(zone);
    recordAudit(ctx.store, { category: "CONFIG", action: "zone.created", targetType: "ZONE", targetId: zone.id, reason, after: { name: zone.name, type: zone.type } });
    return ok(zone);
  });

  r.patch("/admin/zones/:id", (ctx) => {
    const zone = zoneOr404(ctx);
    const body = asBody(ctx.body);
    const reason = reqStr(body, "reason");
    const before = { name: zone.name, type: zone.type, surgeMultiplierBps: zone.surgeMultiplierBps, isActive: zone.isActive };
    const name = str(body, "name");
    if (name) zone.name = name;
    const type = str(body, "type") as ZoneTypeValue | undefined;
    if (type && ZONE_TYPES.includes(type)) zone.type = type;
    zone.surgeMultiplierBps = intField(body, "surgeMultiplierBps", zone.surgeMultiplierBps);
    const active = bool(body, "isActive");
    if (active !== undefined) zone.isActive = active;
    const pickup = bool(body, "allowPickup");
    if (pickup !== undefined) zone.allowPickup = pickup;
    const dropoff = bool(body, "allowDropoff");
    if (dropoff !== undefined) zone.allowDropoff = dropoff;
    const bbox = bboxFromPolygon(body.polygon);
    if (bbox) {
      zone.bboxMinLat = bbox.minLat;
      zone.bboxMinLng = bbox.minLng;
      zone.bboxMaxLat = bbox.maxLat;
      zone.bboxMaxLng = bbox.maxLng;
    }
    zone.updatedAt = iso(Date.now());
    recordAudit(ctx.store, { category: "CONFIG", action: "zone.updated", targetType: "ZONE", targetId: zone.id, reason, before, after: { name: zone.name, type: zone.type, surgeMultiplierBps: zone.surgeMultiplierBps, isActive: zone.isActive } });
    return ok(zone);
  });

  r.delete("/admin/zones/:id", (ctx) => {
    const zone = zoneOr404(ctx);
    if (ctx.store.surgeRules.some((s) => s.zoneId === zone.id && new Date(s.endsAt).getTime() > Date.now())) throw conflict("Remove the zone's active surge rules first", "ZONE_IN_USE");
    ctx.store.zones.splice(ctx.store.zones.indexOf(zone), 1);
    recordAudit(ctx.store, { category: "CONFIG", action: "zone.deleted", targetType: "ZONE", targetId: zone.id, reason: ctx.query.reason ?? null, before: { name: zone.name } });
    return ok({ ok: true });
  });

  r.post("/admin/zones/:id/rides-enabled", (ctx) => {
    const zone = zoneOr404(ctx);
    const body = asBody(ctx.body);
    const reason = reqStr(body, "reason");
    const enabled = bool(body, "enabled");
    if (enabled === undefined) throw new DemoError(400, "VALIDATION_FAILED", "enabled is required");
    const before = { ridesEnabled: zone.ridesEnabled };
    zone.ridesEnabled = enabled;
    zone.shutdownMessage = enabled ? null : (str(body, "message") ?? null);
    zone.updatedAt = iso(Date.now());
    recordAudit(ctx.store, { category: "CONFIG", action: enabled ? "zone.rides_resumed" : "zone.rides_paused", targetType: "ZONE", targetId: zone.id, reason, before, after: { ridesEnabled: enabled } });
    return ok(zone);
  });

  // ── Feature flags & platform config ──
  r.get("/admin/feature-flags", (ctx) => ok(flagEntries(ctx.store, ctx.query.cityId || null)));

  r.put("/admin/feature-flags/:key", (ctx) => {
    const flag = ctx.store.flags.find((f) => f.key === ctx.params.key);
    if (!flag) throw notFound("Feature flag");
    const body = asBody(ctx.body);
    const reason = reqStr(body, "reason");
    const enabled = bool(body, "enabled");
    if (enabled === undefined) throw new DemoError(400, "VALIDATION_FAILED", "enabled is required");
    const cityId = str(body, "cityId");
    const before = { enabled: cityId && flag.cities[cityId] !== undefined ? flag.cities[cityId] : (flag.global ?? flag.default) };
    if (cityId) flag.cities[cityId] = enabled;
    else flag.global = enabled;
    recordAudit(ctx.store, { category: "CONFIG", action: "feature_flag.updated", targetType: "FEATURE_FLAG", targetId: flag.key, reason, before, after: { enabled, scope: cityId ? "CITY" : "GLOBAL" } });
    return ok({ key: flag.key, enabled });
  });

  r.get("/admin/config", (ctx) => ok(configEntries(ctx.store, ctx.query.cityId || null)));

  r.put("/admin/config/:key", (ctx) => {
    const def = ctx.store.configDefs.find((d) => d.key === ctx.params.key);
    if (!def) throw notFound("Config key");
    const body = asBody(ctx.body);
    const reason = reqStr(body, "reason");
    const value = body.value;
    const sameType = typeof value === typeof def.default && Array.isArray(value) === Array.isArray(def.default);
    if (!sameType) throw new DemoError(400, "VALIDATION_FAILED", `Invalid value for ${def.key}`, [`value must be of type ${Array.isArray(def.default) ? "array" : typeof def.default}`]);
    const cityId = str(body, "cityId");
    const before = { value: cityId ? (ctx.store.configCity[cityId]?.[def.key] ?? ctx.store.configGlobal[def.key] ?? def.default) : (ctx.store.configGlobal[def.key] ?? def.default) };
    if (cityId) ctx.store.configCity[cityId] = { ...(ctx.store.configCity[cityId] ?? {}), [def.key]: value };
    else ctx.store.configGlobal[def.key] = value;
    recordAudit(ctx.store, { category: "CONFIG", action: "config.updated", targetType: "CONFIG", targetId: def.key, reason, before, after: { value } });
    return ok({ key: def.key, value });
  });

  r.delete("/admin/config/:key", (ctx) => {
    const def = ctx.store.configDefs.find((d) => d.key === ctx.params.key);
    if (!def) throw notFound("Config key");
    const cityId = ctx.query.cityId || null;
    if (cityId) {
      const scope = ctx.store.configCity[cityId];
      if (scope) delete scope[def.key];
    } else {
      delete ctx.store.configGlobal[def.key];
    }
    recordAudit(ctx.store, { category: "CONFIG", action: "config.reset", targetType: "CONFIG", targetId: def.key, reason: ctx.query.reason ?? null });
    return ok({ ok: true });
  });

  r.get("/admin/integrations", (ctx) => ok(ctx.store.integrations));
}
