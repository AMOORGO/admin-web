"use client";

import React, { useMemo, useState } from "react";
import { Flag, Plug, RotateCcw, Search, Sliders } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatMoney, humanize } from "@/lib/format";
import { useQuery } from "@/lib/hooks/useQuery";
import { invalidate, useOnInvalidate } from "@/lib/invalidate";
import { ApiCityFull, ApiConfigEntry, ApiFeatureFlag, ApiIntegration, CONFIG_ENUMS, editorKind, isMinorKey } from "@/lib/adapters/pricing";
import { BTN_GHOST, CARD, INPUT, SELECT, Toggle } from "./shared";
import { useFlags } from "./useGeo";

interface ConfigPanelProps {
  cities: ApiCityFull[];
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ cities }) => {
  const { can } = useAuth();
  const [scope, setScope] = useState("");
  const cityId = scope || null;
  const scopeLabel = cityId ? (cities.find((c) => c.id === cityId)?.name ?? "city") : "Global";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Scope
          <select value={scope} onChange={(e) => setScope(e.target.value)} className={SELECT}>
            <option value="">Global (all cities)</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} only
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">City scope shows effective values and writes a city-level override.</p>
      </div>

      <FlagsCard cityId={cityId} scopeLabel={scopeLabel} />
      <ConfigCard cityId={cityId} scopeLabel={scopeLabel} />
      {can("system.view") && <IntegrationsCard />}
    </div>
  );
};

// ───────────────────────────── Feature flags ─────────────────────────────

const FlagsCard: React.FC<{ cityId: string | null; scopeLabel: string }> = ({ cityId, scopeLabel }) => {
  const toast = useToast();
  const flags = useFlags(cityId);
  const [target, setTarget] = useState<ApiFeatureFlag | null>(null);

  const apply = async (reason: string) => {
    if (!target) return;
    await api.put(`/admin/feature-flags/${target.key}`, { enabled: !target.enabled, reason, ...(cityId ? { cityId } : {}) });
    toast.success(`${target.key} ${target.enabled ? "disabled" : "enabled"} (${scopeLabel})`);
    setTarget(null);
    invalidate("config");
  };

  return (
    <div className={`${CARD} space-y-4`}>
      <div className="flex items-center gap-2">
        <Flag className="h-4 w-4 text-[#7A2B66]" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Feature Flags ({scopeLabel})</h2>
      </div>
      {flags.error && <ErrorBanner error={flags.error} title="Could not load feature flags" onRetry={flags.refetch} />}
      {flags.initialLoading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(flags.data ?? []).map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-3">
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">{f.key}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 break-words">{f.description}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Default: {f.default ? "on" : "off"}</p>
              </div>
              <Can permission="config.edit" fallback={<Badge variant={f.enabled ? "teal" : "neutral"} size="sm">{f.enabled ? "ON" : "OFF"}</Badge>}>
                <Toggle label={`Toggle ${f.key}`} checked={f.enabled} onChange={() => setTarget(f)} />
              </Can>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        isOpen={target !== null}
        title={target?.enabled ? "Disable Feature Flag" : "Enable Feature Flag"}
        description={`${target?.enabled ? "Turns off" : "Turns on"} "${target?.description ?? ""}" for ${scopeLabel === "Global" ? "all cities without an override" : scopeLabel}. Mobile apps pick this up immediately.`}
        targetEntityLabel={target?.key}
        confirmText={target?.enabled ? "Disable" : "Enable"}
        isDestructive={target?.enabled ?? false}
        requireReason={true}
        onConfirm={apply}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
};

// ───────────────────────────── Platform config ─────────────────────────────

const sourceVariant = { DEFAULT: "neutral", GLOBAL: "plum", CITY: "coral" } as const;

function displayValue(entry: ApiConfigEntry, value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return isMinorKey(entry.key) ? `${value} (${formatMoney(value)})` : String(value);
  if (typeof value === "string") return value === "" ? "(empty)" : value;
  return JSON.stringify(value);
}

const ConfigCard: React.FC<{ cityId: string | null; scopeLabel: string }> = ({ cityId, scopeLabel }) => {
  const toast = useToast();
  const entries = useQuery<ApiConfigEntry[]>(`config:${cityId ?? "global"}`, (signal) =>
    api.get<ApiConfigEntry[]>("/admin/config", { query: { cityId: cityId ?? undefined }, signal }),
  );
  useOnInvalidate("config", entries.refetch);
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<{ entry: ApiConfigEntry; draft: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<ApiConfigEntry | null>(null);

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const map = new Map<string, ApiConfigEntry[]>();
    for (const e of entries.data ?? []) {
      if (term && !`${e.key} ${e.description}`.toLowerCase().includes(term)) continue;
      const list = map.get(e.group) ?? [];
      list.push(e);
      map.set(e.group, list);
    }
    return [...map.entries()];
  }, [entries.data, search]);

  const openEdit = (entry: ApiConfigEntry, draftOverride?: string) => {
    const kind = editorKind(entry);
    const v = entry.value;
    const draft = draftOverride ?? (kind === "numberList" ? (v as number[]).join(", ") : kind === "readonly" ? "" : String(v));
    setEdit({ entry, draft });
  };

  const parse = (entry: ApiConfigEntry, draft: string): unknown => {
    switch (editorKind(entry)) {
      case "boolean":
        return draft === "true";
      case "number":
        return Number(draft);
      case "numberList":
        return draft
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map(Number);
      default:
        return draft;
    }
  };

  const saveEdit = async (reason: string) => {
    if (!edit) return;
    const value = parse(edit.entry, edit.draft);
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Enter a valid number");
    if (Array.isArray(value) && value.some((n) => !Number.isFinite(n))) throw new Error("Enter a comma-separated list of numbers");
    await api.put(`/admin/config/${edit.entry.key}`, { value, reason, ...(cityId ? { cityId } : {}) });
    toast.success(`${edit.entry.key} updated (${scopeLabel})`);
    setEdit(null);
    invalidate("config");
  };

  const doReset = async (reason: string) => {
    if (!resetTarget) return;
    await api.delete(`/admin/config/${resetTarget.key}`, { query: { reason, cityId: cityId ?? undefined } });
    toast.success(`${resetTarget.key} reset to its inherited value`);
    setResetTarget(null);
    invalidate("config");
  };

  const kind = edit ? editorKind(edit.entry) : null;
  const isDestructiveEdit = edit?.entry.key === "app.maintenance_mode" && edit.draft === "true";

  return (
    <div className={`${CARD} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-[#7A2B66]" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Platform Configuration ({scopeLabel})</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keys…"
            className="w-56 rounded-xl border border-slate-200 dark:border-[#331A3B] bg-white dark:bg-[#180D1C] py-2 pl-8 pr-3 text-xs dark:text-white"
          />
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Values are validated by the server against each key&apos;s schema. Complex structured values (objects, text lists) are shown read-only.
      </p>
      {entries.error && !entries.data && <ErrorBanner error={entries.error} title="Could not load configuration" onRetry={entries.refetch} />}
      {entries.initialLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-40" />
          <TableSkeleton rows={4} cols={3} />
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState title="No matching settings" />
      ) : (
        grouped.map(([group, list]) => (
          <details key={group} open={search !== "" || group === "payments"} className="rounded-2xl border border-slate-200 dark:border-[#331A3B]">
            <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              {humanize(group)} <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">({list.length})</span>
            </summary>
            <div className="divide-y divide-slate-100 dark:divide-[#331A3B]">
              {list.map((e) => {
                const k = editorKind(e);
                const resettable = (cityId ? e.source === "CITY" : e.source === "GLOBAL");
                return (
                  <div key={e.key} className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs">
                    <div className="min-w-0 flex-1 basis-64">
                      <p className="font-mono font-bold text-slate-900 dark:text-white break-all">
                        {e.key}
                        {e.public && <span className="ml-2 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs font-sans font-semibold text-slate-500 dark:text-slate-400">public</span>}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{e.description}</p>
                    </div>
                    <div className="max-w-[22rem] basis-48 grow-0">
                      {k === "boolean" ? (
                        <Can permission="config.edit" fallback={<Badge variant={e.value ? "teal" : "neutral"} size="sm">{String(e.value)}</Badge>}>
                          <Toggle label={`Toggle ${e.key}`} checked={e.value === true} onChange={(v) => openEdit(e, String(v))} />
                        </Can>
                      ) : (
                        <p className="font-mono text-xs text-slate-700 dark:text-slate-200 break-words line-clamp-3">{displayValue(e, e.value)}</p>
                      )}
                    </div>
                    <Badge variant={sourceVariant[e.source]} size="sm">
                      {e.source === "DEFAULT" ? "default" : e.source.toLowerCase()}
                    </Badge>
                    <Can permission="config.edit">
                      <div className="flex items-center gap-1.5">
                        {k !== "readonly" && k !== "boolean" && (
                          <button type="button" onClick={() => openEdit(e)} className={BTN_GHOST}>
                            Edit
                          </button>
                        )}
                        {resettable && (
                          <button type="button" onClick={() => setResetTarget(e)} className={`${BTN_GHOST} inline-flex items-center gap-1`} title="Remove the override and fall back to the inherited value">
                            <RotateCcw className="h-3 w-3" /> Reset
                          </button>
                        )}
                        {k === "readonly" && <span className="text-xs italic text-slate-500 dark:text-slate-400">read-only</span>}
                      </div>
                    </Can>
                  </div>
                );
              })}
            </div>
          </details>
        ))
      )}

      <ConfirmDialog
        isOpen={edit !== null}
        title="Update Platform Setting"
        description={edit ? `${edit.entry.description}. Applies to ${scopeLabel === "Global" ? "all cities without an override" : scopeLabel}.` : ""}
        targetEntityLabel={edit?.entry.key}
        confirmText="Save Setting"
        isDestructive={isDestructiveEdit}
        requireReason={true}
        onConfirm={saveEdit}
        onCancel={() => setEdit(null)}
      >
        {edit && kind && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">New value</label>
            {kind === "boolean" ? (
              <select value={edit.draft} onChange={(e) => setEdit({ ...edit, draft: e.target.value })} className={`${SELECT} w-full`}>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : kind === "enum" ? (
              <select value={edit.draft} onChange={(e) => setEdit({ ...edit, draft: e.target.value })} className={`${SELECT} w-full`}>
                {(CONFIG_ENUMS[edit.entry.key] ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : kind === "number" ? (
              <>
                <input type="number" value={edit.draft} onChange={(e) => setEdit({ ...edit, draft: e.target.value })} className={INPUT} />
                {isMinorKey(edit.entry.key) && Number.isFinite(Number(edit.draft)) && <p className="text-xs text-slate-500 dark:text-slate-400">Minor units (cents) = {formatMoney(Number(edit.draft))}</p>}
              </>
            ) : (
              <input
                value={edit.draft}
                onChange={(e) => setEdit({ ...edit, draft: e.target.value })}
                placeholder={kind === "numberList" ? "e.g. 8047, 12070, 16093" : undefined}
                className={`${INPUT} font-sans`}
              />
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">Currently: {displayValue(edit.entry, edit.entry.value)} · default: {displayValue(edit.entry, edit.entry.default)}</p>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={resetTarget !== null}
        title="Reset Setting"
        description={`Removes the ${cityId ? "city" : "global"} override so the ${cityId ? "global" : "built-in default"} value applies again.`}
        targetEntityLabel={resetTarget?.key}
        confirmText="Reset to Inherited"
        isDestructive={true}
        requireReason={true}
        onConfirm={doReset}
        onCancel={() => setResetTarget(null)}
      />
    </div>
  );
};

// ───────────────────────────── Integrations ─────────────────────────────

const IntegrationsCard: React.FC = () => {
  const items = useQuery<ApiIntegration[]>("integrations", (signal) => api.get<ApiIntegration[]>("/admin/integrations", { signal }));
  return (
    <div className={`${CARD} space-y-4`}>
      <div className="flex items-center gap-2">
        <Plug className="h-4 w-4 text-[#7A2B66]" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Integrations</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">read-only, secrets are never shown</span>
      </div>
      {items.error && !items.data && <ErrorBanner error={items.error} title="Could not load integrations" onRetry={items.refetch} />}
      {items.initialLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(items.data ?? []).map((i) => (
            <div key={i.service} className="rounded-2xl border border-slate-200 dark:border-[#331A3B] bg-slate-50 dark:bg-[#211226] p-3 space-y-1.5">
              <p className="text-xs font-bold text-slate-900 dark:text-white">{humanize(i.service)}</p>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{i.provider}</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant={i.configured ? "teal" : "coral"} size="sm">
                  {i.configured ? "configured" : "not configured"}
                </Badge>
                <Badge variant={i.live ? "success" : "neutral"} size="sm">
                  {i.live ? "live" : "sandbox"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
