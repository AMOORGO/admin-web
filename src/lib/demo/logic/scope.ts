/** City scoping: staff with a city scope only see data of those cities (like the backend's cityScopeWhere). */
import type { DemoStore } from "../store";

/** City ids the signed-in demo staff member is limited to, or null when unrestricted. */
export function scopeOf(store: DemoStore): string[] | null {
  return store.me.cityScope.length > 0 ? store.me.cityScope : null;
}

/** True when a record in `cityId` is visible (records without a city are visible to everyone). */
export function inScope(store: DemoStore, cityId: string | null | undefined): boolean {
  const scope = scopeOf(store);
  if (!scope || !cityId) return true;
  return scope.includes(cityId);
}

/** City ids to aggregate over for an optional `cityId` filter (scope-aware). Empty when the filter is out of scope. */
export function effectiveCities(store: DemoStore, cityId: string | null | undefined): string[] {
  const all = store.cities.map((c) => c.id);
  const scope = scopeOf(store);
  const allowed = scope ? all.filter((id) => scope.includes(id)) : all;
  return cityId ? allowed.filter((id) => id === cityId) : allowed;
}
