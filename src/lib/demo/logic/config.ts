/** Effective platform configuration and feature flags (city override > global override > registry default). */
import type { ApiConfigEntry, ApiFeatureFlag } from "../../adapters/pricing";
import type { DemoStore, FlagRow } from "../store";

export function effectiveValue(store: DemoStore, key: string, cityId?: string | null): unknown {
  const def = store.configDefs.find((d) => d.key === key);
  if (cityId && store.configCity[cityId] && key in store.configCity[cityId]) return store.configCity[cityId][key];
  if (key in store.configGlobal) return store.configGlobal[key];
  return def?.default;
}

export function numberConfig(store: DemoStore, key: string, fallback: number, cityId?: string | null): number {
  const v = effectiveValue(store, key, cityId);
  return typeof v === "number" ? v : fallback;
}

export function configEntries(store: DemoStore, cityId: string | null): ApiConfigEntry[] {
  return store.configDefs.map((def) => {
    const cityOverride = cityId ? store.configCity[cityId] : undefined;
    let value: unknown = def.default;
    let source: ApiConfigEntry["source"] = "DEFAULT";
    if (def.key in store.configGlobal) {
      value = store.configGlobal[def.key];
      source = "GLOBAL";
    }
    if (cityOverride && def.key in cityOverride) {
      value = cityOverride[def.key];
      source = "CITY";
    }
    return { key: def.key, group: def.group, description: def.description, public: def.public, default: def.default, value, source };
  });
}

export function flagEnabled(flag: FlagRow, cityId: string | null): boolean {
  if (cityId && flag.cities[cityId] !== undefined) return flag.cities[cityId];
  if (flag.global !== undefined) return flag.global;
  return flag.default;
}

export function flagEntries(store: DemoStore, cityId: string | null): ApiFeatureFlag[] {
  return store.flags.map((f) => ({ key: f.key, description: f.description, default: f.default, enabled: flagEnabled(f, cityId) }));
}
