/** Builds the complete demo dataset. Deterministic apart from the clock: all timestamps are relative to `now`. */
import type { DemoStore } from "../store";
import { seedFinance } from "./finance";
import { seedGeo } from "./geo";
import { seedHistory } from "./history";
import { seedOps } from "./ops";
import { seedPeople } from "./people";

export function buildStore(now: number): DemoStore {
  const geo = seedGeo(now);
  const people = seedPeople(now, geo.cities.map((c) => c.id));
  const ops = seedOps({
    now,
    cities: geo.cities,
    serviceTypes: geo.serviceTypes,
    rules: geo.rules,
    policies: geo.policies,
    riders: people.riders,
    captains: people.captains,
    staff: people.staff,
  });
  const finance = seedFinance({ now, cities: geo.cities, riders: people.riders, captains: people.captains, rides: ops.rides, staff: people.staff });

  // 30 days of trips per approved captain (profiles, earnings, revenue trend); not part of the finance sample.
  const history = seedHistory({
    now,
    cities: geo.cities,
    serviceTypes: geo.serviceTypes,
    rules: geo.rules,
    riders: people.riders,
    captains: people.captains,
    usedRefs: new Set(ops.rides.map((x) => x.rec.bookingRef)),
  });
  const rides = [...ops.rides, ...history].sort((a, b) => new Date(b.rec.requestedAt).getTime() - new Date(a.rec.requestedAt).getTime());

  return {
    me: people.me,
    cities: geo.cities,
    serviceTypes: geo.serviceTypes,
    zones: geo.zones,
    rules: geo.rules,
    policies: geo.policies,
    surgeRules: geo.surgeRules,
    flags: geo.flags,
    configDefs: geo.configDefs,
    configGlobal: geo.configGlobal,
    configCity: geo.configCity,
    integrations: geo.integrations,
    staff: people.staff,
    roles: people.roles,
    permissionCatalogue: people.permissionCatalogue,
    riders: people.riders,
    captains: people.captains,
    rides,
    incidents: ops.incidents,
    transactions: finance.transactions,
    payments: finance.payments,
    refunds: finance.refunds,
    payouts: finance.payouts,
    batches: finance.batches,
    accounts: finance.accounts,
    entries: finance.entries,
    audit: finance.audit,
    approvals: new Map(),
    sosSimulated: false,
  };
}
