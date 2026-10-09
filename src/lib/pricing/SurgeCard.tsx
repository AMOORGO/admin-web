"use client";

import React, { useState } from "react";
import { Zap, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Can } from "@/components/Can";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useQuery } from "@/lib/hooks/useQuery";
import { invalidate, useOnInvalidate } from "@/lib/invalidate";
import { ApiCityFull, ApiServiceType, ApiSurgeRule, localToIso } from "@/lib/adapters/pricing";
import { BTN_GHOST, BTN_PLUM, INPUT, SELECT, Toggle } from "./shared";
import { useFlags, useZones } from "./useGeo";

interface SurgeCardProps {
  city: ApiCityFull;
  serviceTypes: ApiServiceType[];
}

export const SurgeCard: React.FC<SurgeCardProps> = ({ city, serviceTypes }) => {
  const toast = useToast();
  const flags = useFlags(city.id);
  const zones = useZones(city.id);
  const rules = useQuery<{ items: ApiSurgeRule[]; at: number }>(`surge-rules:${city.id}`, async (signal) => {
    const p = await api.getPage<ApiSurgeRule>("/admin/pricing/surge-rules", { query: { cityId: city.id, limit: 100 }, signal });
    return { items: p.items, at: Date.now() };
  });
  useOnInvalidate("config", rules.refetch);
  const now = rules.data?.at ?? 0;

  const surgeFlag = flags.data?.find((f) => f.key === "surge.enabled");
  const [flagConfirm, setFlagConfirm] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiSurgeRule | null>(null);
  const [zoneId, setZoneId] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [multiplier, setMultiplier] = useState("1.5");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const toggleFlag = async (reason: string) => {
    if (!surgeFlag) return;
    await api.put("/admin/feature-flags/surge.enabled", { enabled: !surgeFlag.enabled, cityId: city.id, reason });
    toast.success(`Surge pricing ${surgeFlag.enabled ? "disabled" : "enabled"} for ${city.name}`);
    setFlagConfirm(false);
    invalidate("config");
  };

  const createRule = async (reason: string) => {
    await api.post("/admin/pricing/surge-rules", {
      zoneId,
      ...(serviceTypeId ? { serviceTypeId } : {}),
      multiplierBps: Math.round((Number.parseFloat(multiplier) || 1) * 10_000),
      startsAt: localToIso(startsAt),
      endsAt: localToIso(endsAt),
      reason,
    });
    toast.success("Surge rule created");
    setCreateOpen(false);
    setZoneId("");
    setServiceTypeId("");
    setStartsAt("");
    setEndsAt("");
    invalidate("config");
  };

  const removeRule = async (reason: string) => {
    if (!deleteTarget) return;
    await api.delete(`/admin/pricing/surge-rules/${deleteTarget.id}`, { query: { reason } });
    toast.success("Surge rule removed");
    setDeleteTarget(null);
    invalidate("config");
  };

  const state = (r: ApiSurgeRule) => {
    if (new Date(r.endsAt).getTime() <= now) return { label: "ENDED", variant: "neutral" as const };
    if (new Date(r.startsAt).getTime() > now) return { label: "UPCOMING", variant: "plum" as const };
    return { label: "ACTIVE", variant: "coral" as const };
  };
  const typeName = (id: string | null) => (id ? (serviceTypes.find((s) => s.id === id)?.name ?? id.slice(0, 8)) : "All ride types");
  const formValid = zoneId !== "" && startsAt !== "" && endsAt !== "" && Number.parseFloat(multiplier) >= 1;

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-950/60 bg-amber-50/50 dark:bg-amber-950/20 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Dynamic Surge Pricing: {city.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            {surgeFlag ? (surgeFlag.enabled ? "Surge Enabled" : "Surge Disabled (multipliers ignored)") : flags.error ? "Flag unavailable" : "Loading…"}
          </span>
          <Can permission="config.edit">
            <Toggle label="Surge pricing enabled" checked={surgeFlag?.enabled ?? false} disabled={!surgeFlag} onChange={() => setFlagConfirm(true)} />
          </Can>
        </div>
      </div>
      <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
        When enabled, the larger of a zone&apos;s standing multiplier and any scheduled surge rule below applies to the pickup zone, never above the fare rule&apos;s surge cap. Rules run for a fixed window (max 14 days).
      </p>

      {(flags.error && !flags.data) || rules.error ? (
        <ErrorBanner error={flags.error ?? rules.error} title="Could not load surge settings" onRetry={() => { flags.refetch(); rules.refetch(); }} />
      ) : null}

      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900/70 dark:text-amber-200/70">Surge rules</h4>
        <Can permission="config.edit">
          <button type="button" onClick={() => setCreateOpen(true)} className={`${BTN_PLUM} flex items-center gap-1.5`}>
            <Plus className="h-3.5 w-3.5" /> New surge rule
          </button>
        </Can>
      </div>

      {!rules.data ? (
        <Skeleton className="h-16 w-full" />
      ) : rules.data.items.length === 0 ? (
        <EmptyState title="No surge rules" description="Zones use their standing multiplier only." className="py-6" />
      ) : (
        <div className="data-table-container sticky-first">
          <table className="w-full min-w-[45rem] text-left border-collapse text-xs">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-amber-100 dark:border-amber-950/40">
                <th className="py-2 px-3">Zone</th>
                <th className="py-2 px-3">Ride type</th>
                <th className="py-2 px-3">Multiplier</th>
                <th className="py-2 px-3">Window</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100/70 dark:divide-amber-950/30">
              {rules.data.items.map((r) => {
                const st = state(r);
                return (
                  <tr key={r.id}>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">{r.zone?.name ?? r.zoneId.slice(0, 8)}</td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{typeName(r.serviceTypeId)}</td>
                    <td className="py-2 px-3 font-mono font-bold text-[#D93320] dark:text-[#FF7361]">{(r.multiplierBps / 10_000).toFixed(2)}x</td>
                    <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                      {formatDateTime(r.startsAt)} → {formatDateTime(r.endsAt)}
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant={st.variant} size="sm">
                        {st.label}
                        {r.isAutomated ? " · auto" : ""}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Can permission="config.edit">
                        <button type="button" onClick={() => setDeleteTarget(r)} className={`${BTN_GHOST} inline-flex items-center gap-1`} aria-label="Delete surge rule">
                          <Trash2 className="h-3 w-3" /> Remove
                        </button>
                      </Can>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={flagConfirm}
        title={surgeFlag?.enabled ? "Disable Surge Pricing" : "Enable Surge Pricing"}
        description={`${surgeFlag?.enabled ? "Disables" : "Enables"} surge multipliers for ${city.name} (a city-level override of the global flag). New quotes change immediately.`}
        targetEntityLabel={`surge.enabled / ${city.name}`}
        confirmText={surgeFlag?.enabled ? "Disable Surge" : "Enable Surge"}
        isDestructive={surgeFlag?.enabled ?? false}
        requireReason={true}
        onConfirm={toggleFlag}
        onCancel={() => setFlagConfirm(false)}
      />

      <ConfirmDialog
        isOpen={createOpen}
        title="New Surge Rule"
        description={`Applies an extra multiplier in one zone of ${city.name} for a fixed time window. It only takes effect while surge pricing is enabled.`}
        confirmText="Create Surge Rule"
        isDestructive={false}
        requireReason={true}
        confirmDisabled={!formValid}
        onConfirm={createRule}
        onCancel={() => setCreateOpen(false)}
      >
        <div className="grid grid-cols-2 gap-3 text-xs">
          <label className="col-span-2 space-y-1">
            <span className="block font-semibold text-slate-700 dark:text-slate-200">Zone</span>
            <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={`${SELECT} w-full`}>
              <option value="">Select a zone…</option>
              {(zones.data ?? []).map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block font-semibold text-slate-700 dark:text-slate-200">Ride type</span>
            <select value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)} className={`${SELECT} w-full`}>
              <option value="">All ride types</option>
              {serviceTypes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block font-semibold text-slate-700 dark:text-slate-200">Multiplier (x, 1.0 - 10.0)</span>
            <input type="number" min="1" max="10" step="0.1" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} className={INPUT} />
          </label>
          <label className="space-y-1">
            <span className="block font-semibold text-slate-700 dark:text-slate-200">Starts</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={INPUT} />
          </label>
          <label className="space-y-1">
            <span className="block font-semibold text-slate-700 dark:text-slate-200">Ends</span>
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={INPUT} />
          </label>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Remove Surge Rule"
        description="The multiplier stops applying immediately."
        targetEntityLabel={deleteTarget ? `${deleteTarget.zone?.name ?? "zone"} ${(deleteTarget.multiplierBps / 10_000).toFixed(2)}x` : undefined}
        confirmText="Remove Rule"
        isDestructive={true}
        requireReason={true}
        onConfirm={removeRule}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
